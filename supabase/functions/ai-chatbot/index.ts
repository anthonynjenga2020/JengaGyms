import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai@0.3.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AIChatbotRequest {
  client_id: string;
  conversation_id: string;
  contact_phone: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { client_id, conversation_id, contact_phone } = await req.json() as AIChatbotRequest;

    if (!client_id || !conversation_id || !contact_phone) {
      throw new Error('Missing required parameters');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Fetch Client Info & Knowledge Base
    const { data: client } = await supabase
      .from('clients')
      .select('gym_name, gym_knowledge_base')
      .eq('id', client_id)
      .single();

    if (!client) throw new Error('Client not found');

    // 2. Fetch Conversation History (last 10 messages)
    const { data: messages } = await supabase
      .from('messages')
      .select('direction, body')
      .eq('conversation_id', conversation_id)
      .order('sent_at', { ascending: false })
      .limit(10);

    if (!messages || messages.length === 0) {
      return new Response(JSON.stringify({ status: 'no_messages' }), { status: 200, headers: corsHeaders });
    }

    // Sort to chronological order for the LLM
    messages.reverse();

    // 3. Prepare Gemini Chat Session
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) throw new Error('Gemini API key is not configured');
    
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const systemPrompt = `You are the friendly front desk assistant for ${client.gym_name}. 
Your goal is to answer questions politely and concisely. Try to encourage them to book a free trial or visit the gym.
Here is the gym's knowledge base containing rules, pricing, and class times:
${client.gym_knowledge_base || "No specific knowledge base provided. Answer generally about gym inquiries."}

Rules:
1. Keep replies short, conversational, and WhatsApp-friendly (use emojis occasionally).
2. Never make up prices or class times that are not in the knowledge base. If you don't know, say you'll have a human team member check and get back to them.
3. Don't sound robotic.`;

    const chatHistory = messages.map(msg => ({
      role: msg.direction === 'inbound' ? 'user' : 'model',
      parts: [{ text: msg.body }]
    }));

    // Start chat with history (excluding the very last message which we will send as the prompt)
    const previousHistory = chatHistory.slice(0, -1);
    const currentMessage = chatHistory[chatHistory.length - 1];

    if (currentMessage.role !== 'user') {
       // Last message was from us, no need to reply
       return new Response(JSON.stringify({ status: 'ignored' }), { status: 200, headers: corsHeaders });
    }

    const chat = model.startChat({
      history: previousHistory,
      generationConfig: {
        maxOutputTokens: 200, // Keep replies short
        temperature: 0.7,
      },
    });

    // We prepend the system prompt to the current message to ensure it adheres to instructions
    const result = await chat.sendMessage(`System Instructions:\n${systemPrompt}\n\nUser Message:\n${currentMessage.parts[0].text}`);
    const aiResponseText = result.response.text();

    // 4. Send the AI response via Meta Graph API
    const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
    const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');

    if (!accessToken || !phoneNumberId) throw new Error('WhatsApp API credentials are not configured.');

    // Remove '+' from phone if present
    const formattedPhone = contact_phone.replace('+', '').trim();
    const metaApiUrl = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`;

    // Send as a free-form text message (we are within 24h window)
    const payload = {
      messaging_product: 'whatsapp',
      to: formattedPhone,
      type: 'text',
      text: {
        body: aiResponseText
      }
    };

    const metaResponse = await fetch(metaApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const metaData = await metaResponse.json();

    if (!metaResponse.ok) {
      console.error('Meta API Error:', metaData);
      throw new Error(metaData.error?.message || 'Failed to send AI response');
    }

    // 5. Save the AI's outbound message to the database
    await supabase
      .from('messages')
      .insert({
        conversation_id: conversation_id,
        client_id: client_id,
        direction: 'outbound',
        body: aiResponseText,
        sender_name: 'AI Assistant',
        whatsapp_message_id: metaData.messages?.[0]?.id,
        read: true
      });

    // Update conversation last_message
    await supabase
      .from('conversations')
      .update({ last_message: aiResponseText, last_message_at: new Date().toISOString() })
      .eq('id', conversation_id);

    return new Response(JSON.stringify({ success: true, ai_response: aiResponseText }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('AI Chatbot Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
