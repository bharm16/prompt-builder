export type CreditPack = {
  priceId: string;
  name: string;
  credits: number;
  price: string;
  description: string;
};

/**
 * Credit Packs (January 2026 Rebalance)
 *
 * One-time credit purchases for top-ups and overage.
 * Priced slightly higher than subscription rates to encourage subscriptions.
 *
 * Per-credit economics:
 * - Starter: $0.050/credit
 * - Booster: $0.047/credit
 * - Pro: $0.043/credit
 * - Studio: $0.040/credit
 *
 * NOTE: priceIds kept as original Stripe values.
 * Update STRIPE_PRICE_CREDITS env var to map these to new credit amounts:
 *   price_credits_250=300
 *   price_credits_500=600
 *   price_credits_1000=1200
 *   price_credits_2500=3000
 */
export const CREDIT_PACKS: CreditPack[] = [
  {
    priceId: 'price_credits_250',
    name: 'Starter Pack',
    credits: 300,
    price: '$15',
    description: 'Quick top-up. ~10 WAN previews + 2 Sora videos.',
  },
  {
    priceId: 'price_credits_500',
    name: 'Booster Pack',
    credits: 600,
    price: '$28',
    description: 'Weekend sprint. ~21 WAN previews + 5 Sora videos.',
  },
  {
    priceId: 'price_credits_1000',
    name: 'Pro Pack',
    credits: 1200,
    price: '$52',
    description: 'Heavy week. ~42 WAN previews + 10 Sora videos.',
  },
  {
    priceId: 'price_credits_2500',
    name: 'Studio Pack',
    credits: 3000,
    price: '$120',
    description: 'Big launch. ~107 WAN previews + 26 Sora videos.',
  },
];
