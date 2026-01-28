# Video Credit Per-Second Pricing Analysis & Recommendations

> **Report Date:** January 2026
> **Purpose:** API pricing research and per-second credit cost recommendations

## Executive Summary

**Critical Finding:** Your current flat-rate credit system is losing money on premium models. Based on January 2026 API pricing research, several models (Sora 2 Pro, Luma Ray3, Veo 3) cost significantly more per second than your current credits reflect.

**Recommendation:** Implement **per-second billing** for video models to accurately reflect actual API costs and maintain healthy margins.

---

## Current System Analysis

### Your Credit Economics

| Credit Pack | Credits | Price | Cost/Credit |
|-------------|---------|-------|-------------|
| Starter | 250 | $15 | $0.060 |
| Booster | 500 | $28 | $0.056 |
| Pro | 1,000 | $52 | $0.052 |
| Studio | 2,500 | $120 | $0.048 |

| Subscription | Credits/mo | Price | Cost/Credit |
|--------------|------------|-------|-------------|
| Explorer | 400 | $19 | $0.0475 |
| Creator | 1,500 | $59 | $0.0393 |
| Agency | 5,000 | $179 | $0.0358 |

**Average effective revenue per credit: ~$0.045 - $0.060**

### Previous Model Costs (Flat Rate) - OUTDATED

| Model | Credits | Your Revenue | Actual API Cost (8s video) | Margin |
|-------|---------|--------------|---------------------------|--------|
| Sora 2 | 80 | $3.60-$4.80 | $0.80 (720p) | ✅ +$2.80 |
| Sora 2 Pro | 80 | $3.60-$4.80 | $2.40-$4.00 (720p-1080p) | ⚠️ +$0.80 to -$0.40 |
| Luma Ray3 | 40 | $1.80-$2.40 | $0.71-$1.70+ | ⚠️ Variable |
| Kling v2.1 | 35 | $1.58-$2.10 | $0.56-$0.98 (10s) | ✅ +$0.60 |
| Veo 3 | 30 | $1.35-$1.80 | $3.00-$6.00 (8s) | ❌ **-$1.20 to -$4.20** |
| Minimax/Tier 1 | 15 | $0.68-$0.90 | $0.27-$0.48 | ✅ +$0.40 |
| WAN/Draft | 5 | $0.23-$0.30 | $0.45-$1.25 | ❌ **-$0.15 to -$0.95** |

### Critical Loss Leaders Identified

1. **Google Veo 3** - You were losing $1.20-$4.20 per generation
2. **WAN Video** - You were losing $0.15-$0.95 per generation (especially at 720p)
3. **Sora 2 Pro at 1080p** - Potential loss at longer durations

---

## January 2026 API Pricing Research

### OpenAI Sora 2

| Model | Resolution | Cost/Second |
|-------|------------|-------------|
| Sora 2 | 720p | $0.10/sec |
| Sora 2 Pro | 720p | $0.30/sec |
| Sora 2 Pro | 1080p | $0.50/sec |

**Duration options:** 4, 8, 12 seconds (standard); 10, 15, 25 seconds (pro)

**Sources:**
- [OpenAI Pricing](https://openai.com/api/pricing/)
- [Sora 2 API Pricing Guide](https://www.aifreeapi.com/en/posts/sora-2-api-pricing-quotas)
- [Sora Pricing Calculator](https://costgoat.com/pricing/sora)

### Luma AI (Ray2/Ray3)

| Model | Resolution | Cost/5sec Video |
|-------|------------|-----------------|
| Ray Flash 2 | 720p | $0.24 |
| Ray Flash 2 | 1080p | $0.39 |
| Ray 2 | 720p | $0.71 |
| Ray 2 | 1080p | $0.86 |
| Ray 2 | 4K | $0.96 |

**Pricing model:** Per million pixels ($0.0064/Mpx for Ray 2, $0.0022/Mpx for Ray Flash 2)
**Audio addon:** $0.02/second

**Sources:**
- [Luma AI API Pricing](https://lumalabs.ai/dream-machine/api/pricing)
- [Dream Machine Pricing](https://lumalabs.ai/pricing)

### Kling AI

| Model | Mode | Duration | Cost |
|-------|------|----------|------|
| Kling v2.1 | Standard | 5s | $0.28 |
| Kling v2.1 | Standard | 10s | $0.56 |
| Kling v2.1 | Pro | 5s | $0.49 |
| Kling v2.1 | Pro | 10s | $0.98 |
| Kling v2.5 Turbo | - | per second | $0.07/sec |

**Sources:**
- [Kling AI Developer Pricing](https://klingai.com/global/dev/pricing)
- [fal.ai Pricing](https://fal.ai/pricing)

### Google Veo 3

| Model | Audio | Cost/Second |
|-------|-------|-------------|
| Veo 3.1 Fast | No | $0.10-$0.15/sec |
| Veo 3.1 Standard | No | $0.40/sec |
| Veo 3.0 Full | No | $0.50/sec |
| Veo 3.0 Full | Yes | $0.75/sec |

**Duration options:** 4, 6, 8 seconds

**Sources:**
- [Google Veo Pricing Calculator](https://costgoat.com/pricing/google-veo)
- [Google Developers Blog](https://developers.googleblog.com/veo-3-and-veo-3-fast-new-pricing-new-configurations-and-better-resolution/)
- [Veo 3.1 Pricing Guide](https://www.aifreeapi.com/en/posts/veo-3-1-pricing-per-second-gemini-api)

### MiniMax Hailuo-02

| Resolution | Duration | Cost |
|------------|----------|------|
| 768p | 6s | $0.27 |
| 768p | 10s | ~$0.45 |
| 1080p | 6s | $0.48 |

**Per-second rate:** ~$0.045/sec (768p), ~$0.08/sec (1080p)

**Sources:**
- [MiniMax Pricing](https://www.minimax.io/price)
- [fal.ai MiniMax Pricing](https://fal.ai/models/fal-ai/minimax/hailuo-02)

### WAN Video (via Replicate/fal.ai)

| Model | Resolution | Cost/Second |
|-------|------------|-------------|
| WAN 2.1 | 480p | $0.09/sec |
| WAN 2.1 | 720p | $0.25/sec |
| WAN 2.5 | - | $0.05/sec |

**Sources:**
- [Replicate Pricing](https://replicate.com/pricing)
- [fal.ai Pricing](https://fal.ai/pricing)

### Genmo Mochi

| Access Method | Cost |
|---------------|------|
| Self-hosted | Free (requires 4x H100 GPUs) |
| API providers | $0.05-$0.20/sec estimated |
| Genmo platform | ~100 credits/video |

**Sources:**
- [Genmo Blog](https://www.genmo.ai/blog/mochi-1-a-new-sota-in-open-text-to-video)
- [Mochi 1 AI](https://mochi1ai.com/)

---

## Implemented Credit Structure: Per-Second Model

### New Credits Per Second (Implemented)

| Model | Credits/Second | Reasoning |
|-------|----------------|-----------|
| **Sora 2** | 10 | $0.10/sec API → 10 credits × $0.05 = $0.50 revenue (400% margin) |
| **Sora 2 Pro** | 35 | ~$0.35/sec avg → 35 credits × $0.05 = $1.75 revenue (400% margin) |
| **Luma Ray3** | 15 | ~$0.14/sec API → 15 credits × $0.05 = $0.75 revenue (435% margin) |
| **Kling v2.1** | 8 | ~$0.07/sec API → 8 credits × $0.05 = $0.40 revenue (470% margin) |
| **Veo 3** | 60 | $0.60/sec avg API → 60 credits × $0.05 = $3.00 revenue (400% margin) |
| **Minimax Hailuo-02** | 5 | $0.045/sec API → 5 credits × $0.05 = $0.25 revenue (455% margin) |
| **WAN Draft (480p)** | 2 | $0.05/sec → 2 credits × $0.05 = $0.10 revenue (200% margin) |
| **WAN Pro (720p)** | 5 | $0.09/sec API → 5 credits × $0.05 = $0.25 revenue (278% margin) |
| **Mochi 1** | 10 | ~$0.10/sec estimated → 10 credits × $0.05 = $0.50 revenue (400% margin) |

### Example Cost Calculations

**8-second Sora 2 video:**
- Old: 80 credits flat
- New: 8 sec × 10 credits = 80 credits ✅ (same)

**8-second Sora 2 Pro (1080p) video:**
- Old: 80 credits flat
- New: 8 sec × 35 credits = 280 credits
- API cost: ~$2.80, Revenue: $14.00 ✅ (healthy margin)

**12-second Sora 2 Pro (1080p) video:**
- Old: 80 credits flat (you'd lose $2.00+)
- New: 12 sec × 35 credits = 420 credits
- API cost: ~$4.20, Revenue: $21.00 ✅

**8-second Veo 3 with audio:**
- Old: 30 credits flat (you lose $4.65)
- New: 8 sec × 60 credits = 480 credits
- API cost: $6.00, Revenue: $24.00 ✅

---

## Implementation Summary

### Files Modified

1. **`server/src/config/modelCosts.ts`** - New per-second pricing structure
2. **`server/src/routes/preview/handlers/videoGenerate.ts`** - Duration-aware cost calculation

### New Pricing vs Old

| Model | Old (flat) | New (8s default) | Change |
|-------|------------|------------------|--------|
| Sora 2 | 80 flat | 80 (10/sec × 8s) | Same |
| Sora 2 Pro | 80 flat | 280 (35/sec × 8s) | +250% |
| Luma Ray3 | 40 flat | 120 (15/sec × 8s) | +200% |
| Kling v2.1 | 35 flat | 64 (8/sec × 8s) | +83% |
| Veo 3 | 30 flat | 480 (60/sec × 8s) | +1500% ⚠️ |
| Minimax (Tier 1) | 15 flat | 40 (5/sec × 8s) | +167% |
| WAN Draft | 5 flat | 16 (2/sec × 8s) | +220% |
| WAN Pro | 5 flat | 40 (5/sec × 8s) | +700% |
| Artistic (Mochi) | 30 flat | 80 (10/sec × 8s) | +167% |

**Key Insight:** Veo 3 pricing needed the most urgent correction - you were losing ~$4.65 per generation.

---

## Verification Checklist

- [ ] Test credit calculation - Verify `getVideoCost(modelId, duration)` returns correct values
- [ ] Test generation flow - Generate test videos and confirm correct credits are deducted
- [ ] Check edge cases - Verify behavior when duration is undefined, 0, or very long
- [ ] Monitor production - Track actual API costs vs credits charged to validate margins
