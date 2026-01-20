export type CreditPack = {
  priceId: string;
  name: string;
  credits: number;
  price: string;
  description: string;
};

export const CREDIT_PACKS: CreditPack[] = [
  {
    priceId: 'price_credits_250',
    name: 'Starter Pack',
    credits: 250,
    price: '$15',
    description: 'Quick top-up for extra previews and drafts.',
  },
  {
    priceId: 'price_credits_500',
    name: 'Booster Pack',
    credits: 500,
    price: '$28',
    description: 'Extra room for weekend sprints and iterations.',
  },
  {
    priceId: 'price_credits_1000',
    name: 'Pro Pack',
    credits: 1000,
    price: '$52',
    description: 'Solid buffer for heavier rendering weeks.',
  },
  {
    priceId: 'price_credits_2500',
    name: 'Studio Pack',
    credits: 2500,
    price: '$120',
    description: 'Bulk credits for big launches and campaigns.',
  },
];
