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
    priceMonthly: '$15',
    creditsPerMonth: 400,
    description: 'Perfect for hobbyists and students.',
    bullets: ['400 credits / month', 'Priority generation queue', 'Email support'],
  },
  {
    priceId: 'price_creator_monthly',
    name: 'Creator',
    priceMonthly: '$49',
    creditsPerMonth: 1600,
    description: 'For freelancers and content creators.',
    bullets: ['1,600 credits / month', 'Faster generations', 'Early feature access'],
    highlight: true,
  },
  {
    priceId: 'price_agency_monthly',
    name: 'Agency',
    priceMonthly: '$149',
    creditsPerMonth: 6000,
    description: 'High volume for teams and agencies.',
    bullets: ['6,000 credits / month', 'Team-ready workflows', 'Priority support'],
  },
];

