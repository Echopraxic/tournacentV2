import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound: 'default';
}

async function getTokens(supabase: ReturnType<typeof createClient>, userIds: string[]): Promise<Map<string, string>> {
  if (!userIds.length) return new Map();
  const { data } = await supabase
    .from('profiles')
    .select('id, expo_push_token')
    .in('id', userIds)
    .not('expo_push_token', 'is', null);
  const map = new Map<string, string>();
  for (const row of (data ?? [])) {
    if (row.expo_push_token) map.set(row.id, row.expo_push_token);
  }
  return map;
}

async function send(messages: PushMessage[]): Promise<void> {
  if (!messages.length) return;
  await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(messages),
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const ok = (extra?: object) =>
    new Response(JSON.stringify({ received: true, ...extra }), {
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });

  try {
    const body = await req.json();

    // ── Direct call: payout arrived (called by payout-winner function) ────────
    if (body.event === 'payout_arrived') {
      const { user_id, amount } = body;
      const tokens = await getTokens(supabase, [user_id]);
      const token = tokens.get(user_id);
      if (token) {
        await send([{
          to: token,
          title: '💰 Payout Received!',
          body: `$${Number(amount).toFixed(2)} has been transferred to your payout account.`,
          sound: 'default',
          data: { screen: 'wallet' },
        }]);
      }
      return ok({ sent: !!token });
    }

    // ── Database Webhook: challenges UPDATE ───────────────────────────────────
    if (body.table === 'challenges' && body.type === 'UPDATE') {
      const { record, old_record } = body;

      // Group challenge just activated → notify all participants to pay in
      if (record.status === 'active' && old_record?.status !== 'active') {
        const { data: participants } = await supabase
          .from('challenge_participants')
          .select('user_id')
          .eq('challenge_id', record.id)
          .is('dropped_out_at', null);

        const userIds = (participants ?? []).map((p: any) => p.user_id);
        const tokens = await getTokens(supabase, userIds);
        const messages: PushMessage[] = [];
        for (const [, token] of tokens) {
          messages.push({
            to: token,
            title: '🏆 Challenge Activated!',
            body: `"${record.name}" is now live. Complete your buy-in to secure your spot.`,
            sound: 'default',
            data: { screen: 'home' },
          });
        }
        await send(messages);
      }
      return ok();
    }

    // ── Database Webhook: challenge_participants INSERT ────────────────────────
    // Fires when a new player joins; notifies the challenge organizer.
    if (body.table === 'challenge_participants' && body.type === 'INSERT') {
      const { challenge_id, user_id: joiner_id } = body.record;

      const { data: challenge } = await supabase
        .from('challenges')
        .select('name, organizer_id, challenge_type, status')
        .eq('id', challenge_id)
        .single();

      if (!challenge || challenge.status !== 'pending') return ok();

      const { count } = await supabase
        .from('challenge_participants')
        .select('*', { count: 'exact', head: true })
        .eq('challenge_id', challenge_id)
        .is('dropped_out_at', null);

      const organizer_id: string | null = challenge.organizer_id;
      if (organizer_id && organizer_id !== joiner_id) {
        const tokens = await getTokens(supabase, [organizer_id]);
        const token = tokens.get(organizer_id);
        if (token) {
          await send([{
            to: token,
            title: '👥 A Friend Joined!',
            body: `${count} of 3 players ready for "${challenge.name}".`,
            sound: 'default',
            data: { screen: 'home' },
          }]);
        }
      }
      return ok();
    }

    // ── Database Webhook: notification_queue INSERT (pg_cron scheduled jobs) ──
    if (body.table === 'notification_queue' && body.type === 'INSERT') {
      const { id: queue_id, event_type, payload } = body.record;

      if (event_type === 'challenge_ending_soon') {
        const { challenge_id } = payload;
        const { data: challenge } = await supabase
          .from('challenges')
          .select('name')
          .eq('id', challenge_id)
          .single();

        const { data: participants } = await supabase
          .from('challenge_participants')
          .select('user_id')
          .eq('challenge_id', challenge_id)
          .is('dropped_out_at', null);

        const userIds = (participants ?? []).map((p: any) => p.user_id);
        const tokens = await getTokens(supabase, userIds);
        const messages: PushMessage[] = [];
        for (const [, token] of tokens) {
          messages.push({
            to: token,
            title: '⏰ Challenge Ending Tomorrow',
            body: `"${challenge?.name}" ends in 24 hours. Complete your remaining tasks!`,
            sound: 'default',
            data: { screen: 'tasks' },
          });
        }
        await send(messages);
      }

      if (event_type === 'buyin_deadline_soon') {
        const { challenge_id } = payload;
        const { data: challenge } = await supabase
          .from('challenges')
          .select('name')
          .eq('id', challenge_id)
          .single();

        // Only ping participants who still haven't paid
        const { data: pending } = await supabase
          .from('challenge_participants')
          .select('user_id')
          .eq('challenge_id', challenge_id)
          .eq('payment_status', 'pending')
          .is('dropped_out_at', null);

        const userIds = (pending ?? []).map((p: any) => p.user_id);
        const tokens = await getTokens(supabase, userIds);
        const messages: PushMessage[] = [];
        for (const [, token] of tokens) {
          messages.push({
            to: token,
            title: '💸 Buy-In Deadline Soon',
            body: `~2 hours left to pay your buy-in for "${challenge?.name}" or you'll be removed.`,
            sound: 'default',
            data: { screen: 'wallet' },
          });
        }
        await send(messages);
      }

      // Clean up processed queue row
      await supabase.from('notification_queue').delete().eq('id', queue_id);
      return ok();
    }

    return ok();
  } catch (error: any) {
    console.error('send-notification error:', error.message);
    // Return 200 so Database Webhooks don't retry on transient errors
    return new Response(JSON.stringify({ received: true, warning: error.message }), {
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }
});
