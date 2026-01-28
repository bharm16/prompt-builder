export type SubscriptionTier = {
  priceId: string;
  name: string;
  priceMonthly: string;
  creditsPerMonth: number;
  description: string;
  bullets: string[];
  highlight?: boolean;
};

/**
 * Subscription Tiers (January 2026 Rebalance)
 *
 * Credit allocations designed for balanced workflow:
 * - Explorer: 17 WAN previews + 4 Sora 2 Pro videos
 * - Creator: 64 WAN previews + 16 Sora 2 Pro videos
 * - Agency: 214 WAN previews + 53 Sora 2 Pro videos
 *
 * Per-credit economics:
 * - Explorer: $0.038/credit
 * - Creator: $0.033/credit
 * - Agency: $0.030/credit
 */
export const SUBSCRIPTION_TIERS: SubscriptionTier[] = [
  {
    priceId: 'price_explorer_monthly',
    name: 'Explorer',
    priceMonthly: '$19',
    creditsPerMonth: 500,
    description: 'Perfect for hobbyists and students.',
    bullets: [
      '500 credits / month',
      '~17 WAN previews + 4 Sora videos',
      'Priority generation queue',
      'Email support',
    ],
  },
  {
    priceId: 'price_creator_monthly',
    name: 'Creator',
    priceMonthly: '$59',
    creditsPerMonth: 1800,
    description: 'For freelancers and content creators.',
    bullets: [
      '1,800 credits / month',
      '~64 WAN previews + 16 Sora videos',
      'Faster generations',
      'Early feature access',
    ],
    highlight: true,
  },
  {
    priceId: 'price_agency_monthly',
    name: 'Agency',
    priceMonthly: '$179',
    creditsPerMonth: 6000,
    description: 'High volume for teams and agencies.',
    bullets: [
      '6,000 credits / month',
      '~214 WAN previews + 53 Sora videos',
      'Team-ready workflows',
      'Priority support',
    ],
  },
];
