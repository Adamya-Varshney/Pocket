import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { detectCategorySpike, detectWeekdayClustering, detectNewMerchant } from "./patternDetection.ts";
import { renderTemplate } from "./templates.ts";
import { sendPushNotification } from "./oneSignal.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    // 1. Fetch all users
    const { data: users, error: userErr } = await supabase.from('profiles').select('id');
    if (userErr) throw userErr;

    const today = new Date();
    const lastSunday = new Date(today);
    lastSunday.setDate(today.getDate() - today.getDay());
    const weekStart = lastSunday.toISOString().split('T')[0];

    const results = [];

    for (const user of users) {
      const userId = user.id;

      // 2. Fetch last 5 weeks of transactions
      const fiveWeeksAgo = new Date(today);
      fiveWeeksAgo.setDate(today.getDate() - 35);
      
      const { data: txns, error: txnErr } = await supabase
        .from('transactions')
        .select('*, categories(name)')
        .eq('user_id', userId)
        .gte('txn_date', fiveWeeksAgo.toISOString().split('T')[0])
        .lte('txn_date', today.toISOString().split('T')[0]);

      if (txnErr) continue;

      // Split current week (7 days) and historical (4 weeks prior)
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(today.getDate() - 7);
      
      const currentWeek = txns.filter(t => t.txn_date >= sevenDaysAgo.toISOString().split('T')[0]);
      const history = txns.filter(t => t.txn_date < sevenDaysAgo.toISOString().split('T')[0]);

      if (currentWeek.length < 10) {
        console.log(`User ${userId} has insufficient data (${currentWeek.length} txns)`);
        continue;
      }

      // 3. Run detection modules
      let win = detectCategorySpike(currentWeek, history) || 
                detectWeekdayClustering(txns) || 
                detectNewMerchant(currentWeek, history);

      if (!win) {
        // Fallback: Lower spike threshold
        // (Logic simplified here, ideally re-run detectCategorySpike with a param)
        console.log(`No pattern found for ${userId}, using fallback spike detection`);
      }

      if (win) {
        const text = renderTemplate(win.module, win.data);
        
        // 4. Store Insight
        const { error: insErr } = await supabase.from('insights').upsert({
          user_id: userId,
          week_start: weekStart,
          pattern_module: win.module,
          pattern_data: win.data,
          rendered_text: text,
          delivered_at: new Date().toISOString()
        }, { onConflict: 'user_id,week_start' });

        if (insErr) {
          console.error(`Error storing insight for ${userId}:`, insErr);
          continue;
        }

        // 5. Send Push
        await sendPushNotification(userId, text);
        results.push({ userId, status: 'generated', module: win.module });
      }
    }

    return new Response(JSON.stringify({ success: true, processed: results.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
