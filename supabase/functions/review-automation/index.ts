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

    // Fetch leads who completed a trial, haven't been sent a review request, 
    // and the trial was completed at least 2 hours ago.
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    const { data: leads, error: fetchError } = await supabase
      .from('leads')
      .select('*')
      .eq('status', 'trial_completed')
      .eq('post_trial_review_sent', false)
      .lte('trial_completed_at', twoHoursAgo);

    if (fetchError) throw fetchError;
    if (!leads || leads.length === 0) {
      return new Response(JSON.stringify({ status: 'no_leads_to_process' }), { status: 200, headers: corsHeaders });
    }

    let sentCount = 0;

    for (const lead of leads) {
      // 1. Send WhatsApp Message
      const { error: invokeError } = await supabase.functions.invoke('send-whatsapp', {
        body: {
          client_id: lead.client_id,
          to_phone: lead.phone,
          template_name: 'review_request', // Ensure this Meta template is approved
          components: [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: lead.name.split(' ')[0] }
              ]
            }
          ]
        }
      });

      if (invokeError) {
        console.error(`Failed to send review request to ${lead.phone}`, invokeError);
      } else {
        // 2. Mark lead as processed
        await supabase
          .from('leads')
          .update({ post_trial_review_sent: true })
          .eq('id', lead.id);

        // 3. Log into review_requests table for UI visibility
        await supabase
          .from('review_requests')
          .insert({
            client_id: lead.client_id,
            member_name: lead.name,
            member_phone: lead.phone,
            platform: 'google',
            status: 'pending',
            channel: 'whatsapp',
            trigger_source: 'post_trial'
          });
        
        sentCount++;
        console.log(`Sent post-trial review request to ${lead.phone}`);
      }
    }

    return new Response(JSON.stringify({ success: true, review_requests_sent: sentCount }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Review Automation Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
