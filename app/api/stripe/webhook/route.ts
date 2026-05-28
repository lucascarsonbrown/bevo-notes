import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createClient } from '@/lib/supabase/server';
import Stripe from 'stripe';

function tierFromPriceId(priceId: string): 'pro' | 'free' {
  if (priceId === process.env.STRIPE_PRO_PRICE_ID) return 'pro';
  return 'free';
}

async function syncSubscription(
  supabase: Awaited<ReturnType<typeof createClient>>,
  subscription: Stripe.Subscription
) {
  const customerId = subscription.customer as string;
  const item = subscription.items.data[0];
  const priceId = item?.price.id ?? '';
  const status = subscription.status;
  const periodEnd = item?.current_period_end
    ? new Date(item.current_period_end * 1000).toISOString()
    : null;

  const isActive = status === 'active' || status === 'trialing';
  const tier = isActive ? tierFromPriceId(priceId) : 'free';

  await supabase
    .from('users')
    .update({
      subscription_tier: tier,
      stripe_subscription_id: subscription.id,
      stripe_price_id: priceId,
      subscription_current_period_end: periodEnd,
    })
    .eq('stripe_customer_id', customerId);
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get('stripe-signature');

  if (!sig) return NextResponse.json({ error: 'Missing signature' }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: `Webhook signature failed: ${msg}` }, { status: 400 });
  }

  const supabase = await createClient();

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.resumed': {
      const sub = event.data.object as Stripe.Subscription;
      await syncSubscription(supabase, sub);
      break;
    }

    case 'customer.subscription.deleted':
    case 'customer.subscription.paused': {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = sub.customer as string;
      await supabase
        .from('users')
        .update({
          subscription_tier: 'free',
          stripe_subscription_id: null,
          stripe_price_id: null,
          subscription_current_period_end: null,
        })
        .eq('stripe_customer_id', customerId);
      break;
    }

    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === 'subscription' && session.subscription) {
        const sub = await stripe.subscriptions.retrieve(session.subscription as string);
        await syncSubscription(supabase, sub);
      }
      break;
    }

    case 'invoice.payment_failed': {
      // Optionally: notify user or flag account — for now just log
      console.warn('Payment failed for customer:', (event.data.object as Stripe.Invoice).customer);
      break;
    }

    default:
      // Unhandled event types — return 200 so Stripe doesn't retry
      break;
  }

  return NextResponse.json({ received: true });
}
