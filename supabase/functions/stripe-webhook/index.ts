import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});

// Snapshot webhook secret — payment_intent.succeeded / payment_failed
const SNAPSHOT_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;
// Thin webhook secret — v2.core.account.updated (thin events only)
const THIN_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET_THIN')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' },
    });
  }

  const body = await req.text();
  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return new Response('Missing stripe-signature', { status: 400 });
  }

  // Determine which webhook this came from by trying each secret in turn.
  // Each endpoint has a unique signing secret, so only the right one will verify.
  let event: Stripe.Event | null = null;
  let isThinEvent = false;

  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, SNAPSHOT_SECRET);
  } catch {
    // not from the snapshot endpoint — try the thin endpoint
  }

  if (!event && THIN_SECRET) {
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, THIN_SECRET);
      isThinEvent = true;
    } catch {
      // neither secret matched
    }
  }

  if (!event) {
    return new Response('Webhook signature verification failed', { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    // ── Snapshot events (v1) ────────────────────────────────────────────────
    if (!isThinEvent) {
      switch (event.type) {
        case 'payment_intent.succeeded': {
          const pi = event.data.object as Stripe.PaymentIntent;
          const { challenge_id, user_id } = pi.metadata;
          if (!challenge_id || !user_id) break;

          const { data: challenge } = await supabase
            .from('challenges')
            .select('buy_in_amount, prize_pool')
            .eq('id', challenge_id)
            .single();

          if (!challenge) break;

          await supabase
            .from('challenge_participants')
            .update({ payment_status: 'paid' })
            .eq('challenge_id', challenge_id)
            .eq('user_id', user_id);

          await supabase
            .from('challenges')
            .update({ prize_pool: challenge.prize_pool + challenge.buy_in_amount })
            .eq('id', challenge_id);

          await supabase.from('transactions').insert({
            user_id,
            challenge_id,
            amount: challenge.buy_in_amount,
            transaction_type: 'buy_in',
            status: 'verified',
          });

          break;
        }

        case 'payment_intent.payment_failed': {
          const pi = event.data.object as Stripe.PaymentIntent;
          const { challenge_id, user_id } = pi.metadata;
          if (!challenge_id || !user_id) break;

          await supabase.from('transactions').insert({
            user_id,
            challenge_id,
            amount: pi.amount / 100,
            transaction_type: 'buy_in',
            status: 'denied',
            denial_reason: pi.last_payment_error?.message ?? 'Payment failed',
          });

          break;
        }
      }
    }

    // ── Thin events (v2) ────────────────────────────────────────────────────
    if (isThinEvent) {
      switch (event.type) {
        case 'v2.core.account.updated': {
          // Thin event — fetch the full account data from Stripe API
          const accountId = (event.data as any)?.object?.id ?? (event as any).related_object?.id;
          if (!accountId) break;

          const accountRes = await fetch(`https://api.stripe.com/v1/accounts/${accountId}`, {
            headers: { Authorization: `Bearer ${Deno.env.get('STRIPE_SECRET_KEY')}` },
          });
          const account = await accountRes.json() as Stripe.Account;

          const isComplete =
            account.charges_enabled &&
            account.payouts_enabled &&
            !account.requirements?.currently_due?.length;

          if (isComplete) {
            await supabase
              .from('profiles')
              .update({ stripe_onboarding_complete: true })
              .eq('stripe_account_id', account.id);
          }
          break;
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('stripe-webhook handler error:', error.message);
    // Return 200 so Stripe does not retry — the error is ours to investigate
    return new Response(JSON.stringify({ received: true, warning: error.message }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
