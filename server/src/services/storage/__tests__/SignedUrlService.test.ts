import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SignedUrlService } from '../services/SignedUrlService';

const buildService = () => {
  const mockFile = {
    getSignedUrl: vi.fn().mockResolvedValue(['https://storage.googleapis.com/signed']),
    exists: vi.fn().mockResolvedValue([true]),
  };
  const mockBucket = {
    file: vi.fn().mockReturnValue(mockFile),
  };
  const mockStorage = {
    bucket: vi.fn().mockReturnValue(mockBucket),
  };

  const service = new SignedUrlService(mockStorage as unknown as any);
  return { service, mockFile };
};

describe('SignedUrlService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generates upload URL with write action', async () => {
    const { service, mockFile } = buildService();
    const result = await service.getUploadUrl('users/user123/file.webp', 'image/webp', 1024);

    expect(result.uploadUrl).toBeDefined();
    expect(mockFile.getSignedUrl).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'write', contentType: 'image/webp' })
    );
  });

  it('throws when view URL requested for missing file', async () => {
    const { service, mockFile } = buildService();
    mockFile.exists.mockResolvedValueOnce([false]);

    await expect(service.getViewUrl('users/user123/missing.mp4')).rejects.toThrow('File not found');
  });
});
