import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockList,
  mockUpload,
  mockUploadFromUrl,
  mockDelete,
} = vi.hoisted(() => ({
  mockList: vi.fn(),
  mockUpload: vi.fn(),
  mockUploadFromUrl: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock('../../api/referenceImageApi', () => ({
  referenceImageApi: {
    list: mockList,
    upload: mockUpload,
    uploadFromUrl: mockUploadFromUrl,
    delete: mockDelete,
  },
}));

import { useReferenceImages } from '../useReferenceImages';

const imageA = {
  id: 'img-a',
  userId: 'u1',
  imageUrl: 'https://cdn/a.png',
  thumbnailUrl: 'https://cdn/a-thumb.png',
  storagePath: 'users/u1/a.png',
  thumbnailPath: 'users/u1/a-thumb.png',
  metadata: {
    width: 100,
    height: 100,
    sizeBytes: 100,
    contentType: 'image/png',
  },
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};

const imageB = {
  ...imageA,
  id: 'img-b',
  imageUrl: 'https://cdn/b.png',
  thumbnailUrl: 'https://cdn/b-thumb.png',
  storagePath: 'users/u1/b.png',
  thumbnailPath: 'users/u1/b-thumb.png',
};

describe('useReferenceImages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockList.mockResolvedValue([imageA]);
  });

  it('refreshes on mount and populates images', async () => {
    const { result } = renderHook(() => useReferenceImages());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.images).toEqual([imageA]);
    });

    expect(mockList).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBeNull();
  });

  it('sets error state when initial refresh fails', async () => {
    mockList.mockRejectedValueOnce(new Error('List failed'));

    const { result } = renderHook(() => useReferenceImages());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe('List failed');
    });
    expect(result.current.images).toEqual([]);
  });

  it('uploadImage prepends new image to existing state', async () => {
    mockUpload.mockResolvedValue(imageB);
    const { result } = renderHook(() => useReferenceImages());

    await waitFor(() => expect(result.current.images).toHaveLength(1));

    await act(async () => {
      const file = new File(['payload'], 'upload.png', { type: 'image/png' });
      await result.current.uploadImage(file, { label: 'Uploaded' });
    });

    expect(mockUpload).toHaveBeenCalledWith(expect.any(File), { label: 'Uploaded' });
    expect(result.current.images[0]?.id).toBe('img-b');
    expect(result.current.images[1]?.id).toBe('img-a');
  });

  it('uploadFromUrl prepends imported image to existing state', async () => {
    mockUploadFromUrl.mockResolvedValue(imageB);
    const { result } = renderHook(() => useReferenceImages());

    await waitFor(() => expect(result.current.images).toHaveLength(1));

    await act(async () => {
      await result.current.uploadFromUrl('https://remote/ref.png', { source: 'url' });
    });

    expect(mockUploadFromUrl).toHaveBeenCalledWith('https://remote/ref.png', { source: 'url' });
    expect(result.current.images.map((img) => img.id)).toEqual(['img-b', 'img-a']);
  });

  it('deleteImage removes deleted image from local state', async () => {
    mockList.mockResolvedValueOnce([imageA, imageB]);
    mockDelete.mockResolvedValue(undefined);
    const { result } = renderHook(() => useReferenceImages());

    await waitFor(() => expect(result.current.images).toHaveLength(2));

    await act(async () => {
      await result.current.deleteImage('img-a');
    });

    expect(mockDelete).toHaveBeenCalledWith('img-a');
    expect(result.current.images).toEqual([imageB]);
  });

  it('exposes refresh action to clear prior errors after recovery', async () => {
    mockList
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockResolvedValueOnce([imageA]);

    const { result } = renderHook(() => useReferenceImages());

    await waitFor(() => {
      expect(result.current.error).toBe('temporary failure');
    });

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.images).toEqual([imageA]);
  });
});
