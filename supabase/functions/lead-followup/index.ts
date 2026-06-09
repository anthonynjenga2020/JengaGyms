import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all active leads (only those who haven't booked or completed a trial)
    const { data: leads, error: fetchError } = await supabase
      .from('leads')
      .select('*')
      .in('status', ['new', 'contacted']) // Stop follow-ups if 'trial_booked', 'trial_completed', or 'lost'
      .lt('followup_day_sent', 4); // Don't process leads who already got day 4

    if (fetchError) throw fetchError;
    if (!leads || leads.length === 0) {
      return new Response(JSON.stringify({ status: 'no_leads_to_process' }), { status: 200, headers: corsHeaders });
    }

    const now = new Date();
    let sentCount = 0;

    for (const lead of leads) {
      const createdAt = new Date(lead.created_at);
      const diffTime = Math.abs(now.getTime() - createdAt.getTime());
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)); // Days since creation

      let templateToSend = null;
      let newFollowupDaySent = lead.followup_day_sent;

      if (diffDays >= 4 && lead.followup_day_sent < 4) {
        templateToSend = 'lead_followup_day_4';
        newFollowupDaySent = 4;
      } else if (diffDays >= 2 && lead.followup_day_sent < 2) {
        templateToSend = 'lead_followup_day_2';
        newFollowupDaySent = 2;
      } else if (diffDays >= 0 && lead.followup_day_sent < 0) {
        templateToSend = 'lead_followup_day_0';
        newFollowupDaySent = 0;
      }

      if (templateToSend) {
        // Send WhatsApp Message via our existing function
        const { error: invokeError } = await supabase.functions.invoke('send-whatsapp', {
          body: {
            client_id: lead.client_id,
            to_phone: lead.phone,
            template_name: templateToSend,
            components: [
              {
                type: 'body',
                parameters: [
                  { type: 'text', text: lead.name.split(' ')[0] } // First name
                ]
              }
            ]
          }
        });

        if (invokeError) {
          console.error(`Failed to send ${templateToSend} to ${lead.phone}`, invokeError);
        } else {
          // Update the lead's tracking field
          await supabase
            .from('leads')
            .update({ followup_day_sent: newFollowupDaySent, status: 'contacted' })
            .eq('id', lead.id);
          
          sentCount++;
          console.log(`Sent ${templateToSend} to ${lead.phone}`);
        }
      }
    }

    return new Response(JSON.stringify({ success: true, messages_sent: sentCount }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Lead Follow-Up Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
