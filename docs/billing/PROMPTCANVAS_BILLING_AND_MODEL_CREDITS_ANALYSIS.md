# PromptCanvas Billing and Model Credits Analysis (Updated)

## 1. Overview of the product

PromptCanvas is an interactive prompt‑editing environment for AI video generation. Users compose a video prompt in a rich text editor; the system automatically labels spans (subject, action, camera, lighting, style, etc.) and provides context‑aware alternatives for each highlighted segment. The interface encourages users to iteratively refine the prompt before committing to an expensive video render.

To help reduce iteration costs, the platform supplies a cheap image preview (Flux Schnell) and an optional short video preview (Wan 2.2) before generating the final high‑quality video on a selected model. The backend exposes endpoints for prompt optimisation, span labelling, suggestion generation, preview generation and video rendering. A credit system is in place to meter video generation, and subscription tiers grant monthly credits.

## 2. Current subscription tiers and pricing

The front‑end defines three paid plans plus a free tier. Each plan has a Stripe `priceId`, a monthly fee and a credit allowance per month:

| Tier | Stripe price ID | Price/month | Credits/month | Notes |
|------|------------------|-------------|---------------|-------|
| Explorer | `price_explorer_monthly` | US$15 | 400 credits | intended for hobbyists and students [1] |
| Creator | `price_creator_monthly` | US$49 | 1,600 credits | highlighted as the most popular plan [2] |
| Agency | `price_agency_monthly` | US$149 | 6,000 credits | targeted at high‑volume teams [3] |
| Free | – | US$0 | n/a | only local history, core prompt optimisation and an “upgrade anytime” upsell [4] |

These plans are displayed on the pricing page and convert to Stripe checkout sessions for the corresponding `priceId`.

The per‑credit cost decreases significantly on higher tiers:

- Explorer: 400 credits / $15 → $0.0375 per credit
- Creator: 1,600 credits / $49 → $0.0306 per credit
- Agency: 6,000 credits / $149 → $0.0248 per credit

The decreasing marginal cost encourages users to upgrade to higher tiers.

## 3. Credit ledger and billing implementation

The credit system stores a credits balance under each user document in Firestore. The `UserCreditService.reserveCredits()` method deducts credits when a video preview is requested and refunds them on failure [5][6].

Credits can be topped up through Stripe purchases; the `PaymentService` reads a `STRIPE_PRICE_CREDITS` environment variable mapping each price ID to a numeric credit amount and grants credits upon successful payment [7].

Video generation handlers determine the estimated cost of a request using the `getVideoCost()` function from `modelCosts.ts` and call `UserCreditService.reserveCredits()` before queuing the job [8]. If the user lacks sufficient credits, a 402 response is returned.

Image preview generation does not deduct credits; it simply calls the image generation service and returns the result [9].

## 4. Video models and current credit cost per generation

Credit costs for video generation are defined centrally in `modelCosts.ts`. Each entry maps an internal model alias from `VIDEO_MODELS` to a credit cost [10]:

| Model alias | Provider / description (from `modelConfig.ts`) | Credit cost |
|------------|-----------------------------------------------|------------|
| DRAFT | `wan-video/wan-2.2-t2v-fast` (cheap, fast; used for drafts) | 5 |
| PRO | `wan-video/wan-2.2-t2v-fast` (same underlying model) | 5 |
| SORA 2 | OpenAI Sora 2 (flagship) [11] | 50 |
| SORA 2 Pro | OpenAI Sora 2 Pro (higher quality) [12] | 50 |
| LUMA RAY‑3 | Luma Ray‑3 (Dream Machine) [13] | 25 |
| KLING v2.1 | Kling v2.1 (official API) [14] | 25 |
| VEO 3 | Google Veo 3.1 (text→video with audio) [15] | 20 |
| TIER 1 | Minimax “Hailuo‑02” model [16] | 10 |
| ARTISTIC | Genmo Mochi 1 (artistic) [17] | 25 (default) |
| Unknown | any unspecified model | 25 (default) |

The cost mapping implies that a Sora 2 or Sora 2 Pro generation currently consumes 50 credits, Luma and Kling cost 25 credits, Veo costs 20 credits, Minimax costs 10 credits, and Wan costs 5 credits per generation. Models such as Genmo Mochi default to 25 credits.

## 5. Cost of image previews (Flux Schnell)

PromptCanvas uses Flux Schnell (a fast latent diffusion model) to generate static image previews before video generation. The model’s documentation states that it costs US$3 per 1,000 output images, which is equivalent to US$0.003 per image [18]. Pricing is based solely on the number of output images and is independent of resolution or prompt complexity. The model offers volume discounts when purchasing in bulk.

Because the app currently offers unlimited image previews for free, the underlying cost of each preview is absorbed by the service.

Flux Schnell can generate up to four images per request with sub‑second latency; the cost scales linearly with the number of images. The model supports various aspect ratios, output formats (WebP, JPEG, PNG) and quality settings, but these do not affect pricing. A typical single‑image preview therefore costs the application $0.003 in API fees.

## 6. Analysis of current pricing and credit mapping

1. Pricing ladder – The monthly plans provide successively larger credit bundles at decreasing per‑credit cost. Assuming the service’s marginal cost per credit is constant, this design encourages upgrades but may compress margins on higher tiers. At the current rates, Explorer credits are 51% more expensive than Agency credits ($0.0375 vs. $0.0248). The price spread creates a natural upsell path.
2. Credit sufficiency vs. model cost – With the current credit mapping, an Explorer subscriber (400 credits/month) can afford 8 Sora 2 videos (8 × 50 credits), 16 Luma or Kling videos (16 × 25 credits), 20 Veo videos (20 × 20 credits) or 40 Minimax videos (40 × 10 credits). A Creator plan (1,600 credits) could afford 32 Sora videos per month, and an Agency plan (6,000 credits) could produce 120 Sora videos monthly. These allowances may underprice high‑end compute if Sora renders cost several dollars each.
3. Model cost differentials – The credit costs roughly reflect the relative compute cost or vendor pricing: Sora → 50 credits, Luma/Kling → 25, Veo → 20, Minimax → 10, Wan → 5. Industry pricing for these models (as of late 2025) is evolving, and some (Sora, Luma) are still in early access. If each credit roughly corresponds to US$0.03–$0.04 (Explorer tier), then 50 credits equate to $1.50–$2.00—likely below actual cost for a full 1080p, 4–10 s Sora render. This suggests the credit cost may need to be raised or the monthly credit allowances reduced to preserve profitability.
4. Free image previews – Each Flux Schnell preview costs about $0.003, so unlimited free previews can become expensive. A user generating 1,000 previews would cost the service $3 in API fees. Currently, there is no credit charge for images [9], so heavy users could incur disproportionate costs.
5. Lack of pay‑as‑you‑go option – The current billing flow only supports subscriptions tied to Stripe price IDs. There is no simple one‑time credit purchase or consumption‑based billing, limiting monetisation flexibility for occasional users.

## 7. Recommendations for updated pricing and credit allocation

Given the above, and under the constraint that we cannot query live vendor pricing, the following proposals aim to maintain profitability while keeping the product attractive.

### 7.1 Adjust subscription pricing and credit bundles

| Proposed tier | Price/month | Credits/month | Rationale |
|--------------|-------------|---------------|-----------|
| Explorer | US$19 | 400 credits | Raises effective price per credit to ~$0.0475, providing margin. Credits remain unchanged so hobbyists still get a modest allowance. |
| Creator | US$59 | 1,500 credits | Reduces credits slightly (−100) while raising price; effective cost per credit ~$0.039. |
| Agency | US$179 | 5,000 credits | Decreases credits (−1,000) and raises price; effective cost per credit ~$0.0358. |
| Add‑on packs | e.g. US$49 per 1,000 credits | – | Introduces one‑off credit bundles for pay‑as‑you‑go or overage; price per credit ~$0.049. |

These adjustments slightly increase revenue and narrow the per‑credit gap between tiers while preserving a discount for larger plans.

### 7.2 Revise credit costs per video model

| Model | Current credits | Proposed credits | Reasoning |
|------|------------------|------------------|----------|
| SORA 2 / SORA 2 Pro | 50 | 80 | High‑resolution video with audio is expensive; raising to 80 credits (~US$2.40–$3.20) better covers costs. |
| LUMA RAY‑3 | 25 | 40 | HDR Dream Machine output warrants a higher cost; 40 credits yields ~$1.20–$1.60. |
| KLING v2.1 | 25 | 35 | Less expensive than Luma but costlier than Veo; 35 credits (~$1.05–$1.40) balances usage. |
| VEO 3 | 20 | 30 | Audio output and high fidelity justify 30 credits (~$0.90–$1.20). |
| ARTISTIC (Mochi 1) | 25 | 30 | Aligns with Veo; style adherence may increase compute. |
| TIER 1 (Minimax) | 10 | 15 | Ensures margin even at lower compute cost; still the cheapest option. |
| DRAFT / PRO (Wan) | 5 | 5 | Keep cheap previews at 5 credits (~US$0.15–$0.20) to encourage experimentation. |
| Unknown models | 25 | 40 | Higher default cost hedges against unforeseen API fees. |

### 7.3 Introduce image preview credits or quotas

Because each Flux Schnell preview costs $0.003, unlimited free previews can become expensive. Two options to cover this cost:

1. Charge 1 credit per image preview – At ~US$0.03–$0.05 per credit, this covers the $0.003 cost with margin and discourages frivolous usage. Users on free or low tiers will be mindful of image usage, but the cost remains negligible relative to video generations.
2. Provide a free quota – Include, for example, 100 free image previews per month with each subscription. After the quota, charge 1 credit per image. This encourages exploration while bounding costs.

### 7.4 Implement pay‑as‑you‑go credit packs

Offering one‑time credit purchases would serve occasional users and generate incremental revenue. Suggested pricing (per 1,000 credits) should be slightly higher than subscription rates to encourage subscriptions but still accessible. For example:

| Credits | Price | Effective cost/credit |
|--------|-------|------------------------|
| 250 | US$15 | $0.06 |
| 500 | US$28 | $0.056 |
| 1,000 | US$52 | $0.052 |
| 2,500 | US$120 | $0.048 |

## 8. Next steps and cautions

1. Validate vendor pricing – When web access is available, research up‑to‑date costs for Sora, Veo, Kling, Luma Ray‑3, Minimax and Wan models. Adjust credit costs accordingly.
2. Monitor usage patterns – Use analytics to track average credits consumed per user and model. If heavy users consistently exhaust credits or certain models are under‑used due to cost, refine the pricing or provide targeted promotions.
3. Update the UI – Clearly communicate credit costs per model and the cost of image previews so users understand charges before generating.
4. Grandfather existing subscribers – If subscription pricing changes, consider grandfathering current subscribers at their existing rate for a transitional period to avoid churn.

## References

[1] Subscription tiers: [`client/src/features/billing/subscriptionTiers.ts`](../../client/src/features/billing/subscriptionTiers.ts)  
[2] Subscription tiers: [`client/src/features/billing/subscriptionTiers.ts`](../../client/src/features/billing/subscriptionTiers.ts)  
[3] Subscription tiers: [`client/src/features/billing/subscriptionTiers.ts`](../../client/src/features/billing/subscriptionTiers.ts)  
[4] Pricing page: [`client/src/pages/PricingPage.tsx`](../../client/src/pages/PricingPage.tsx)  
[5] Credit reservation/refunds: [`server/src/services/credits/UserCreditService.ts`](../../server/src/services/credits/UserCreditService.ts)  
[6] Credit reservation/refunds: [`server/src/services/credits/UserCreditService.ts`](../../server/src/services/credits/UserCreditService.ts)  
[7] Stripe credit granting: [`server/src/services/payment/PaymentService.ts`](../../server/src/services/payment/PaymentService.ts)  
[8] Video generation billing: [`server/src/routes/preview/handlers/videoGenerate.ts`](../../server/src/routes/preview/handlers/videoGenerate.ts)  
[9] Image previews (no credit deduction): [`server/src/routes/preview/handlers/imageGenerate.ts`](../../server/src/routes/preview/handlers/imageGenerate.ts)  
[10] Model credit costs: [`server/src/config/modelCosts.ts`](../../server/src/config/modelCosts.ts)  
[11] Model config: [`server/src/config/modelConfig.ts`](../../server/src/config/modelConfig.ts)  
[12] Model config: [`server/src/config/modelConfig.ts`](../../server/src/config/modelConfig.ts)  
[13] Model config: [`server/src/config/modelConfig.ts`](../../server/src/config/modelConfig.ts)  
[14] Model config: [`server/src/config/modelConfig.ts`](../../server/src/config/modelConfig.ts)  
[15] Model config: [`server/src/config/modelConfig.ts`](../../server/src/config/modelConfig.ts)  
[16] Model config: [`server/src/config/modelConfig.ts`](../../server/src/config/modelConfig.ts)  
[17] Model config: [`server/src/config/modelConfig.ts`](../../server/src/config/modelConfig.ts)  
[18] Flux Schnell pricing notes: [`docs/integrations/Replicate/flux-schnell.md`](../integrations/Replicate/flux-schnell.md)  

