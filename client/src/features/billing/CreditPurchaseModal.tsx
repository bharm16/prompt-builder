import { useState } from 'react';
import { apiClient } from '../../services/ApiClient';
import { Button } from '../../components/Button';

const TIERS = [
  { 
    id: 'price_explorer_monthly', 
    name: 'Explorer', 
    credits: 400, 
    price: '$15',
    description: 'Perfect for hobbyists and students'
  },
  { 
    id: 'price_creator_monthly', 
    name: 'Creator', 
    credits: 1600, 
    price: '$49',
    description: 'For freelancers and content creators'
  },
  { 
    id: 'price_agency_monthly', 
    name: 'Agency', 
    credits: 6000, 
    price: '$149',
    description: 'High volume for teams and agencies'
  },
];

export const CreditPurchaseModal = () => {
  const [loading, setLoading] = useState<string | null>(null);

  const handlePurchase = async (priceId: string) => {
    setLoading(priceId);
    try {
      const response = await apiClient.post('/api/payment/checkout', { priceId });
      const redirectUrl = (response as { url?: string }).url;

      if (!redirectUrl) {
        throw new Error('Missing checkout URL');
      }

      window.location.href = redirectUrl;
    } catch (error) {
      console.error('Checkout failed', error);
      setLoading(null);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-3">
      {TIERS.map((tier) => (
        <div
          key={tier.id}
          className="rounded-lg border border-gray-200 p-6 transition-colors hover:border-blue-500 flex flex-col"
        >
          <h3 className="text-xl font-bold">{tier.name}</h3>
          <div className="mt-2 text-3xl font-bold">{tier.price}<span className="text-base font-normal text-gray-500">/mo</span></div>
          <p className="mt-1 text-gray-500 font-medium">{tier.credits} Credits</p>
          <p className="mt-2 text-sm text-gray-400 flex-grow">{tier.description}</p>

          <Button
            onClick={() => handlePurchase(tier.id)}
            loading={loading === tier.id}
            className="mt-6 w-full"
          >
            Subscribe
          </Button>
        </div>
      ))}
    </div>
  );
};
