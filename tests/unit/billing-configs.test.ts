import { describe, expect, it } from 'vitest';
import { CREDIT_PACKS } from '@/features/billing/creditPacks';
import { SUBSCRIPTION_TIERS } from '@/features/billing/subscriptionTiers';

describe('billing config contracts', () => {
  it('defines unique credit pack price IDs with positive credit amounts', () => {
    const priceIds = CREDIT_PACKS.map((pack) => pack.priceId);
    expect(new Set(priceIds).size).toBe(priceIds.length);
    for (const pack of CREDIT_PACKS) {
      expect(pack.credits).toBeGreaterThan(0);
      expect(pack.price.trim().length).toBeGreaterThan(0);
      expect(pack.name.trim().length).toBeGreaterThan(0);
    }
  });

  it('defines unique subscription tier price IDs with positive monthly credits', () => {
    const priceIds = SUBSCRIPTION_TIERS.map((tier) => tier.priceId);
    expect(new Set(priceIds).size).toBe(priceIds.length);
    for (const tier of SUBSCRIPTION_TIERS) {
      expect(tier.creditsPerMonth).toBeGreaterThan(0);
      expect(tier.name.trim().length).toBeGreaterThan(0);
      expect(tier.bullets.length).toBeGreaterThan(0);
    }
  });
});
