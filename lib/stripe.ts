import Stripe from 'stripe';

let _stripe: Stripe | null = null;
export function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY is not set');
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-05-27.dahlia' });
  }
  return _stripe;
}

// Convenience alias — only use in route handlers, not at module level
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return (getStripe() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export const PLANS = {
  pro: {
    name: 'Pro',
    priceId: process.env.STRIPE_PRO_PRICE_ID!,
    price: '$10',
    period: 'month',
    description: 'Everything unlimited',
    features: [
      'Unlimited courses',
      'Unlimited AI lecture notes',
      'Up to 100 quizzes / month',
      'Unlimited uploads',
      'Textbook uploads',
      'Semantic quiz retrieval (RAG)',
    ],
  },
} as const;

export type PlanKey = keyof typeof PLANS;
