import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Webhook Verification (GET)
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const mode = url.searchParams.get('hub.mode');
      const token = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');

      // The VERIFY_TOKEN is a secret you set in Supabase AND in the Meta App portal
      const verifyToken = Deno.env.get('WHATSAPP_VERIFY_TOKEN');

      if (mode === 'subscribe' && token === verifyToken) {
        console.log('Webhook verified successfully!');
        return new Response(challenge, { status: 200 });
      } else {
        console.error('Webhook verification failed.');
        return new Response('Forbidden', { status: 403 });
      }
    }

    // 2. Incoming Messages (POST)
    if (req.method === 'POST') {
      const body = await req.json();

      // Check if it's a WhatsApp status update or message
      if (body.object === 'whatsapp_business_account') {
        for (const entry of body.entry) {
          for (const change of entry.changes) {
            if (change.value && change.value.messages) {
              
              const message = change.value.messages[0];
              const contact = change.value.contacts[0];
              const metadata = change.value.metadata;

              const senderPhone = message.from; // Phone number of the user who sent the message
              const senderName = contact.profile.name;
              const messageBody = message.text?.body || '[Non-text message received]';
              const messageId = message.id; // Meta's message ID
              const receivingNumberId = metadata.phone_number_id;

              console.log(`Received message from ${senderName} (${senderPhone}): ${messageBody}`);

              // Initialize Supabase Client
              const supabase = createClient(
                Deno.env.get('SUPABASE_URL') ?? '',
                Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
              );

              // FIND THE CLIENT BASED ON THE RECEIVING NUMBER (For white-label)
              // Since we are using Option 1 (Centralized), we might just route to a specific client
              // or match the senderPhone against all leads/members to find the right gym.
              
              // Let's try to match the senderPhone to a member or lead to find the client_id
              let clientId = null;
              let contactId = null; // Either lead_id or member_id

              // Clean phone number (Meta sends it with country code but no '+')
              const cleanPhone = `+${senderPhone}`;

              const { data: memberMatch } = await supabase
                .from('members')
                .select('client_id, id')
                .eq('phone', cleanPhone)
                .limit(1)
                .single();

              if (memberMatch) {
                clientId = memberMatch.client_id;
              } else {
                const { data: leadMatch } = await supabase
                  .from('leads')
                  .select('client_id, id')
                  .eq('phone', cleanPhone)
                  .limit(1)
                  .single();
                
                if (leadMatch) {
                  clientId = leadMatch.client_id;
                }
              }

              // If we still don't have a client_id, and we are running a centralized number,
              // we might route it to a default "Jenga Admin" client, or drop it.
              if (!clientId) {
                console.warn(`Could not match sender phone ${cleanPhone} to any gym client. Skipping.`);
                return new Response('OK', { status: 200 }); // Always return 200 to Meta
              }

              // 1. Get or Create Conversation
              let conversationId = null;
              const { data: existingConv } = await supabase
                .from('conversations')
                .select('id')
                .eq('client_id', clientId)
                .eq('contact_phone', cleanPhone)
                .eq('channel', 'whatsapp')
                .limit(1)
                .single();

              if (existingConv) {
                conversationId = existingConv.id;
                // Update last_message time
                await supabase
                  .from('conversations')
                  .update({ last_message: messageBody, last_message_at: new Date().toISOString(), status: 'open', unread_count: supabase.rpc('increment', { x: 1 }) }) // Assuming you have an increment rpc, or just fetch and add
                  .eq('id', conversationId);
              } else {
                // Create new conversation
                const { data: newConv } = await supabase
                  .from('conversations')
                  .insert({
                    client_id: clientId,
                    contact_name: senderName,
                    contact_phone: cleanPhone,
                    channel: 'whatsapp',
                    last_message: messageBody,
                    status: 'open',
                    unread_count: 1
                  })
                  .select()
                  .single();
                if (newConv) conversationId = newConv.id;
              }

              // 2. Insert Message
              if (conversationId) {
                await supabase
                  .from('messages')
                  .insert({
                    conversation_id: conversationId,
                    client_id: clientId,
                    direction: 'inbound',
                    body: messageBody,
                    sender_name: senderName,
                    whatsapp_message_id: messageId,
                    read: false
                  });
              }

            } else if (change.value && change.value.statuses) {
              // Handle delivery statuses (sent, delivered, read)
              const status = change.value.statuses[0];
              console.log(`Message ${status.id} status updated to ${status.status}`);
              
              const supabase = createClient(
                Deno.env.get('SUPABASE_URL') ?? '',
                Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
              );

              // Update review_requests delivery status if it matches
              if (status.status === 'delivered' || status.status === 'read' || status.status === 'failed') {
                 await supabase
                  .from('review_requests')
                  .update({ delivery_status: status.status })
                  .eq('message_id', status.id);
              }
            }
          }
        }
      }

      return new Response('EVENT_RECEIVED', { status: 200, headers: corsHeaders });
    }

    return new Response('Method Not Allowed', { status: 405 });
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
