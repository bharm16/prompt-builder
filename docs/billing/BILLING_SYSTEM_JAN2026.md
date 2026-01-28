# PromptCanvas Billing System (January 2026)

## Overview

PromptCanvas uses a credit-based billing system with per-second video pricing. This document describes the current pricing structure, margin analysis, and rationale.

---

## Pricing Philosophy

### Core Principles

1. **WAN is the workflow backbone** — Users do 10-20 previews per final render. WAN needs to be accessible enough for iteration while maintaining healthy margins.

2. **Premium models are the draw, not the profit center** — Competitive pricing on Sora/Veo attracts users; profit comes from the preview workflow.

3. **Balanced margins across tiers** — No single model should be a loss leader or feel exploitative.

### Margin Targets

| Tier | Target Margin | Rationale |
|------|---------------|-----------|
| WAN Draft | 165% | Most used, must be profitable per-use |
| Mid-tier (Kling, Minimax) | 170-240% | Solid workhorses, good margins |
| Premium (Sora, Veo) | 50-130% | Competitive draw, acceptable lower margin |

---

## Credit Costs (Per-Second)

### Current Rates

| Model | Credits/sec | 8-sec Cost | API Cost | Margin |
|-------|-------------|------------|----------|--------|
| **WAN Draft** | 3.5 | 28 | $0.40 | 165% |
| WAN Pro | 5 | 40 | $0.72 | 110% |
| Minimax (Tier 1) | 4 | 32 | $0.36 | 238% |
| Kling v2.1 | 5 | 40 | $0.56 | 170% |
| Luma Ray3 | 7 | 56 | $1.12 | 90% |
| Sora 2 | 6 | 48 | $0.80 | 128% |
| **Sora 2 Pro** | 14 | 112 | $2.80 | 52% |
| **Veo 3** | 24 | 192 | $4.80 | 52% |
| Artistic (Mochi) | 6 | 48 | $0.80 | 128% |

### API Cost Sources (January 2026)

- **OpenAI Sora**: $0.10/sec (standard), $0.30-$0.50/sec (pro)
- **Google Veo 3**: $0.50-$0.75/sec (with audio)
- **Luma Ray**: ~$0.14/sec (Ray 2/3)
- **Kling v2.1**: $0.056-$0.098/sec
- **MiniMax Hailuo**: ~$0.045/sec
- **WAN Video**: $0.05-$0.09/sec

---

## Subscription Tiers

| Tier | Price | Credits | $/Credit |
|------|-------|---------|----------|
| Explorer | $19/mo | 500 | $0.038 |
| Creator | $59/mo | 1,800 | $0.033 |
| Agency | $179/mo | 6,000 | $0.030 |

### What Users Get

#### Explorer ($19/month)

| Model | Cost | Videos/Month |
|-------|------|--------------|
| WAN Draft | 28 | **17** |
| Sora 2 | 48 | **10** |
| Sora 2 Pro | 112 | **4** |
| Veo 3 | 192 | **2** |
| Kling | 40 | **12** |
| Luma | 56 | **8** |

#### Creator ($59/month)

| Model | Cost | Videos/Month |
|-------|------|--------------|
| WAN Draft | 28 | **64** |
| Sora 2 | 48 | **37** |
| Sora 2 Pro | 112 | **16** |
| Veo 3 | 192 | **9** |
| Kling | 40 | **45** |

#### Agency ($179/month)

| Model | Cost | Videos/Month |
|-------|------|--------------|
| WAN Draft | 28 | **214** |
| Sora 2 | 48 | **125** |
| Sora 2 Pro | 112 | **53** |
| Veo 3 | 192 | **31** |
| Kling | 40 | **150** |

---

## Credit Packs (One-Time)

| Pack | Price | Credits | $/Credit |
|------|-------|---------|----------|
| Starter | $15 | 300 | $0.050 |
| Booster | $28 | 600 | $0.047 |
| Pro | $52 | 1,200 | $0.043 |
| Studio | $120 | 3,000 | $0.040 |

Credit packs are priced ~10-30% higher per-credit than subscriptions to encourage recurring revenue.

---

## Profit Analysis

### Per-Session Economics

Typical workflow: 10 WAN previews → 1 premium render

| Component | Videos | Profit Each | Total |
|-----------|--------|-------------|-------|
| WAN Draft | 10 | $0.66 | $6.60 |
| Sora 2 Pro | 1 | $1.46 | $1.46 |
| **Session Total** | | | **$8.06** |

### Blended Tier Margins

| Tier | Sessions/Month | Profit | Revenue | Margin |
|------|----------------|--------|---------|--------|
| Explorer | ~1.5 | $12.09 | $19 | 64% |
| Creator | ~5.5 | $44.33 | $59 | 75% |
| Agency | ~18 | $145.08 | $179 | 81% |

These are healthy SaaS margins (industry standard: 70-85%).

---

## Competitive Positioning

### vs. Direct Competitors (January 2026)

| Platform | Entry Price | Premium Videos |
|----------|-------------|----------------|
| Runway Standard | $12/mo | ~5 Gen-4 videos |
| Pika Standard | $8/mo | ~15 videos |
| Luma Lite | $10/mo | 50 generations |
| Kling Standard | $10/mo | 33 videos |
| **PromptCanvas Explorer** | **$19/mo** | **4 Sora Pro + 17 previews** |

### Our Differentiators

1. **Multi-model access** — Sora, Veo, Luma, Kling, WAN in one platform
2. **Prompt optimization workflow** — Span labeling, click-to-enhance, visual previews
3. **Preview-first workflow** — Cheap WAN iterations before expensive final renders

---

## Implementation Details

### Files

- `server/src/config/modelCosts.ts` — Per-second credit rates
- `client/src/features/billing/subscriptionTiers.ts` — Subscription definitions
- `client/src/features/billing/creditPacks.ts` — One-time pack definitions
- `server/src/services/credits/UserCreditService.ts` — Credit ledger operations

### Credit Flow

1. User requests video generation
2. `getVideoCost(modelId, duration)` calculates credits needed
3. `UserCreditService.reserveCredits()` deducts credits atomically
4. On failure, `UserCreditService.refundCredits()` restores balance
5. On success, credits remain deducted

### Stripe Integration

Subscription `priceId` values must match Stripe dashboard:
- `price_explorer_monthly`
- `price_creator_monthly`
- `price_agency_monthly`

Credit pack `priceId` values (kept original names, updated credit amounts via env var):
- `price_credits_250` → grants 300 credits
- `price_credits_500` → grants 600 credits
- `price_credits_1000` → grants 1,200 credits
- `price_credits_2500` → grants 3,000 credits

**Environment Variable:**
```
STRIPE_PRICE_CREDITS=price_explorer_monthly=500,price_creator_monthly=1800,price_agency_monthly=6000,price_credits_250=300,price_credits_500=600,price_credits_1000=1200,price_credits_2500=3000
```

---

## Changelog

### January 2026 Rebalance

**Problem:** Previous flat-rate pricing created broken economics:
- Explorer couldn't afford a single Veo 3 video (480 > 400 credits)
- Starter pack couldn't buy one Sora 2 Pro (280 > 250 credits)
- $19 for 1 premium video was terrible value proposition

**Solution:** Rebalanced per-second rates and credit allocations:

| Change | Before | After |
|--------|--------|-------|
| WAN Draft | 2 credits/sec | 3.5 credits/sec |
| Sora 2 Pro | 35 credits/sec | 14 credits/sec |
| Veo 3 | 60 credits/sec | 24 credits/sec |
| Explorer credits | 400 | 500 |
| Creator credits | 1,500 | 1,800 |
| Agency credits | 5,000 | 6,000 |

**Result:**
- Explorer: 1 Sora Pro → 4 Sora Pro (+300%)
- Explorer: 0 Veo 3 → 2 Veo 3 (now accessible)
- WAN margin: 90% → 165% (sustainable)
- Premium margin: 375% → 52-128% (competitive)

---

## Future Considerations

### Price Adjustments

Monitor these metrics quarterly:
- Credit utilization rate per tier
- Model popularity distribution
- Churn rate by tier
- API cost changes from providers

### Potential Additions

1. **Annual plans** — 20% discount, improves cash flow
2. **Team seats** — Agency tier with multiple users
3. **Enterprise tier** — Custom pricing, dedicated support
4. **Usage-based overflow** — Auto-buy credits at pack rates when subscription depletes

---

## References

- [Subscription Tier Competitive Analysis](./SUBSCRIPTION_TIER_COMPETITIVE_ANALYSIS_JAN2026.md)
- [Video Model Per-Second Pricing Report](./VIDEO_MODEL_PERSECOND_PRICING_REPORT_JAN2026.md)
- [Original Billing Analysis](./PROMPTCANVAS_BILLING_AND_MODEL_CREDITS_ANALYSIS.md)
