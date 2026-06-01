import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }

    const { challenge_id } = await req.json();
    if (!challenge_id) {
      return new Response(JSON.stringify({ error: 'challenge_id required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }

    // Verify user is a participant who hasn't paid yet
    const { data: participant, error: partError } = await supabase
      .from('challenge_participants')
      .select('id, payment_status, challenges(buy_in_amount, name, status)')
      .eq('challenge_id', challenge_id)
      .eq('user_id', user.id)
      .is('dropped_out_at', null)
      .single();

    if (partError || !participant) {
      return new Response(JSON.stringify({ error: 'Participant record not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }

    if (participant.payment_status === 'paid') {
      return new Response(JSON.stringify({ error: 'Buy-in already paid' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }

    const challenge = participant.challenges as any;
    if (!challenge || challenge.status !== 'active') {
      return new Response(JSON.stringify({ error: 'Challenge is not active' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }

    const amountCents = Math.round(challenge.buy_in_amount * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      metadata: {
        challenge_id,
        user_id: user.id,
        participant_id: participant.id,
      },
      description: `Tournacent buy-in: ${challenge.name}`,
    });

    // Store payment intent ID on participant row for reconciliation
    await supabase
      .from('challenge_participants')
      .update({ stripe_payment_intent_id: paymentIntent.id })
      .eq('id', participant.id);

    return new Response(
      JSON.stringify({ client_secret: paymentIntent.client_secret, payment_intent_id: paymentIntent.id }),
      { headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }
});
