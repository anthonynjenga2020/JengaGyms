import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendWhatsAppRequest {
  client_id: string;
  to_phone: string;
  template_name: string;
  language_code?: string;
  components?: any[]; // For dynamic variables in the template
  sender_name?: string; // Optional context for the UI
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse the request
    const { client_id, to_phone, template_name, language_code = 'en_US', components = [], sender_name = 'Jenga System' } = await req.json() as SendWhatsAppRequest;

    if (!client_id || !to_phone || !template_name) {
      throw new Error('Missing required fields: client_id, to_phone, template_name');
    }

    // Clean phone number (Meta expects it without the '+')
    const formattedPhone = to_phone.replace('+', '').trim();

    // In a white-labeled setup, you would fetch the token and phone ID from the `clients` table.
    // For Option 1 (Centralized), we use environment variables.
    const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
    const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');

    if (!accessToken || !phoneNumberId) {
      throw new Error('WhatsApp API credentials are not configured.');
    }

    // 1. Send the message via Meta Graph API
    const metaApiUrl = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`;
    
    const payload = {
      messaging_product: 'whatsapp',
      to: formattedPhone,
      type: 'template',
      template: {
        name: template_name,
        language: {
          code: language_code
        },
        components: components
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
      throw new Error(metaData.error?.message || 'Failed to send WhatsApp message');
    }

    const messageId = metaData.messages?.[0]?.id;
    console.log(`Successfully sent message ${messageId} to ${formattedPhone}`);

    // 2. Log to the database
    // First, ensure a conversation exists
    let conversationId = null;
    const { data: existingConv } = await supabase
      .from('conversations')
      .select('id')
      .eq('client_id', client_id)
      .eq('contact_phone', `+${formattedPhone}`)
      .eq('channel', 'whatsapp')
      .limit(1)
      .single();

    if (existingConv) {
      conversationId = existingConv.id;
    } else {
      const { data: newConv } = await supabase
        .from('conversations')
        .insert({
          client_id: client_id,
          contact_name: to_phone, // We don't have the name here unless passed in
          contact_phone: `+${formattedPhone}`,
          channel: 'whatsapp',
          last_message: `[Template: ${template_name}]`,
          status: 'open',
          unread_count: 0
        })
        .select()
        .single();
      if (newConv) conversationId = newConv.id;
    }

    // Insert outbound message
    if (conversationId) {
      await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          client_id: client_id,
          direction: 'outbound',
          body: `[Sent template: ${template_name}]`, // Or reconstruct the actual message if you know the template body
          sender_name: sender_name,
          whatsapp_message_id: messageId,
          read: true // We sent it, so it's read by us
        });
    }

    return new Response(
      JSON.stringify({ success: true, messageId: messageId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Error sending WhatsApp:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
