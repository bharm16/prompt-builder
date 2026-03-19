import { describe, expect, it, vi } from 'vitest';
import { FaceSwapService } from '../FaceSwapService';
import type { FalFaceSwapProvider, FaceSwapResult } from '../providers/FalFaceSwapProvider';

describe('FaceSwapService', () => {
  it('reports availability based on the provider', () => {
    const provider = {
      isAvailable: vi.fn().mockReturnValue(true),
    } as unknown as FalFaceSwapProvider;

    const service = new FaceSwapService({ faceSwapProvider: provider });
    expect(service.isAvailable()).toBe(true);
  });

  it('throws when provider is unavailable', async () => {
    const provider = {
      isAvailable: vi.fn().mockReturnValue(false),
    } as unknown as FalFaceSwapProvider;

    const service = new FaceSwapService({ faceSwapProvider: provider });

    await expect(
      service.swap({
        characterPrimaryImageUrl: 'https://images.example.com/face.webp',
        targetCompositionUrl: 'https://images.example.com/target.webp',
      })
    ).rejects.toThrow('Face-swap provider is not configured. Set FAL_KEY or FAL_API_KEY.');
  });

  it('orchestrates provider swap and returns response metadata', async () => {
    const provider = {
      isAvailable: vi.fn().mockReturnValue(true),
      swapFace: vi.fn().mockResolvedValue({
        imageUrl: 'https://images.example.com/swapped.webp',
        width: 1024,
        height: 768,
        contentType: 'image/webp',
      } satisfies FaceSwapResult),
    } as unknown as FalFaceSwapProvider;

    const service = new FaceSwapService({ faceSwapProvider: provider });

    const result = await service.swap({
      characterPrimaryImageUrl: 'https://images.example.com/face.webp',
      targetCompositionUrl: 'https://images.example.com/target.webp',
      aspectRatio: '16:9',
    });

    expect(provider.swapFace).toHaveBeenCalledTimes(1);
    expect(result.swappedImageUrl).toBe('https://images.example.com/swapped.webp');
    expect(result.provider).toBe('easel');
    expect(typeof result.durationMs).toBe('number');
  });

  it('throws when character image is missing', async () => {
    const provider = {
      isAvailable: vi.fn().mockReturnValue(true),
      swapFace: vi.fn(),
    } as unknown as FalFaceSwapProvider;

    const service = new FaceSwapService({ faceSwapProvider: provider });

    await expect(
      service.swap({
        characterPrimaryImageUrl: '',
        targetCompositionUrl: 'https://images.example.com/target.webp',
      })
    ).rejects.toThrow('Character reference image is required for face swap');
  });

  it('throws when target image is missing', async () => {
    const provider = {
      isAvailable: vi.fn().mockReturnValue(true),
      swapFace: vi.fn(),
    } as unknown as FalFaceSwapProvider;

    const service = new FaceSwapService({ faceSwapProvider: provider });

    await expect(
      service.swap({
        characterPrimaryImageUrl: 'https://images.example.com/face.webp',
        targetCompositionUrl: '',
      })
    ).rejects.toThrow('Target composition image is required for face swap');
  });

  it('passes default swap options to provider', async () => {
    const provider = {
      isAvailable: vi.fn().mockReturnValue(true),
      swapFace: vi.fn().mockResolvedValue({
        imageUrl: 'https://images.example.com/swapped.webp',
        width: 1024,
        height: 768,
        contentType: 'image/webp',
      } satisfies FaceSwapResult),
    } as unknown as FalFaceSwapProvider;

    const service = new FaceSwapService({ faceSwapProvider: provider });

    await service.swap({
      characterPrimaryImageUrl: 'https://images.example.com/face.webp',
      targetCompositionUrl: 'https://images.example.com/target.webp',
    });

    expect(provider.swapFace).toHaveBeenCalledWith({
      faceImageUrl: 'https://images.example.com/face.webp',
      targetImageUrl: 'https://images.example.com/target.webp',
      preserveHair: 'user',
      upscale: true,
    });
  });

  it('wraps provider error with preprocessing context', async () => {
    const provider = {
      isAvailable: vi.fn().mockReturnValue(true),
      swapFace: vi.fn().mockRejectedValue(new Error('Fal queue failed')),
    } as unknown as FalFaceSwapProvider;

    const service = new FaceSwapService({ faceSwapProvider: provider });

    await expect(
      service.swap({
        characterPrimaryImageUrl: 'https://images.example.com/face.webp',
        targetCompositionUrl: 'https://images.example.com/target.webp',
      })
    ).rejects.toThrow('Face swap preprocessing failed: Fal queue failed');
  });
});
