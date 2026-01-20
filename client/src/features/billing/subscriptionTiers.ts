export type SubscriptionTier = {
  priceId: string;
  name: string;
  priceMonthly: string;
  creditsPerMonth: number;
  description: string;
  bullets: string[];
  highlight?: boolean;
};

export const SUBSCRIPTION_TIERS: SubscriptionTier[] = [
  {
    priceId: 'price_explorer_monthly',
    name: 'Explorer',
    priceMonthly: '$19',
    creditsPerMonth: 400,
    description: 'Perfect for hobbyists and students.',
    bullets: ['400 credits / month', 'Priority generation queue', 'Email support'],
  },
  {
    priceId: 'price_creator_monthly',
    name: 'Creator',
    priceMonthly: '$59',
    creditsPerMonth: 1500,
    description: 'For freelancers and content creators.',
    bullets: ['1,500 credits / month', 'Faster generations', 'Early feature access'],
    highlight: true,
  },
  {
    priceId: 'price_agency_monthly',
    name: 'Agency',
    priceMonthly: '$179',
    creditsPerMonth: 5000,
    description: 'High volume for teams and agencies.',
    bullets: ['5,000 credits / month', 'Team-ready workflows', 'Priority support'],
  },
];
