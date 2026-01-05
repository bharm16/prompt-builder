import { useState } from 'react';
import { apiClient } from '../../services/ApiClient';
import { Button } from '../../components/Button';

const TIERS = [
  { id: 'price_creator_id_from_stripe', name: 'Creator', credits: 800, price: '$29' },
  { id: 'price_pro_id_from_stripe', name: 'Pro', credits: 2500, price: '$79' },
  { id: 'price_power_id_from_stripe', name: 'Power', credits: 7000, price: '$199' },
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
          className="rounded-lg border border-gray-200 p-6 transition-colors hover:border-blue-500"
        >
          <h3 className="text-xl font-bold">{tier.name}</h3>
          <div className="mt-2 text-3xl font-bold">{tier.price}</div>
          <p className="mt-1 text-gray-500">{tier.credits} Credits</p>

          <Button
            onClick={() => handlePurchase(tier.id)}
            loading={loading === tier.id}
            className="mt-4 w-full"
          >
            Buy with Link
          </Button>
        </div>
      ))}
    </div>
  );
};
