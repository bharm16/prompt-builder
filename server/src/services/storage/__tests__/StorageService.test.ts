import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StorageService } from '../StorageService';

const buildStorageService = () => {
  const mockBucket = {
    file: vi.fn().mockReturnValue({
      exists: vi.fn().mockResolvedValue([true]),
      getMetadata: vi.fn().mockResolvedValue([{ size: '1024', contentType: 'video/mp4' }]),
    }),
  };

  const mockStorage = {
    bucket: vi.fn().mockReturnValue(mockBucket),
  };

  const mockSignedUrlService = {
    getUploadUrl: vi.fn().mockResolvedValue({
      uploadUrl: 'https://storage.googleapis.com/upload',
      expiresAt: '2024-01-21T12:00:00Z',
    }),
    getViewUrl: vi.fn().mockResolvedValue({
      viewUrl: 'https://storage.googleapis.com/view',
      expiresAt: '2024-01-21T12:00:00Z',
    }),
    getDownloadUrl: vi.fn().mockResolvedValue({
      downloadUrl: 'https://storage.googleapis.com/download',
      expiresAt: '2024-01-22T12:00:00Z',
    }),
  };

  const mockUploadService = {
    uploadFromUrl: vi.fn().mockResolvedValue({
      storagePath: 'users/user123/generations/123-abc.mp4',
      sizeBytes: 52428800,
      contentType: 'video/mp4',
      createdAt: '2024-01-21T12:00:00Z',
    }),
    confirmUpload: vi.fn().mockResolvedValue({
      storagePath: 'users/user123/previews/images/123-abc.webp',
      sizeBytes: 1024,
      contentType: 'image/webp',
      createdAt: '2024-01-21T12:00:00Z',
    }),
  };

  const mockRetentionService = {
    deleteFile: vi.fn().mockResolvedValue({ deleted: true, path: 'users/user123/file.mp4' }),
    deleteFiles: vi.fn().mockResolvedValue({ deleted: 2, failed: 0, details: [] }),
    listUserFiles: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    getUserStorageUsage: vi.fn().mockResolvedValue({ totalBytes: 0 }),
  };

  const service = new StorageService({
    storage: mockStorage as unknown as any,
    signedUrlService: mockSignedUrlService as unknown as any,
    uploadService: mockUploadService as unknown as any,
    retentionService: mockRetentionService as unknown as any,
  });

  return {
    service,
    mockSignedUrlService,
    mockUploadService,
    mockRetentionService,
  };
};

describe('StorageService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns upload URL for valid type and content type', async () => {
    const { service, mockSignedUrlService } = buildStorageService();
    const result = await service.getUploadUrl('user123', 'preview-image', 'image/webp');

    expect(result).toHaveProperty('uploadUrl');
    expect(result.storagePath).toContain('users/user123/previews/images/');
    expect(mockSignedUrlService.getUploadUrl).toHaveBeenCalled();
  });

  it('rejects invalid storage type', async () => {
    const { service } = buildStorageService();
    await expect(
      service.getUploadUrl('user123', 'invalid-type' as never, 'image/webp')
    ).rejects.toThrow('Invalid storage type');
  });

  it('rejects invalid content type', async () => {
    const { service } = buildStorageService();
    await expect(
      service.getUploadUrl('user123', 'preview-image', 'application/pdf')
    ).rejects.toThrow('Invalid content type');
  });

  it('saves from URL and returns view URL', async () => {
    const { service, mockUploadService } = buildStorageService();
    const result = await service.saveFromUrl(
      'user123',
      'https://api.openai.com/video.mp4',
      'generation',
      { model: 'sora-2' }
    );

    expect(result).toHaveProperty('storagePath');
    expect(result).toHaveProperty('viewUrl');
    expect(mockUploadService.uploadFromUrl).toHaveBeenCalledWith(
      'https://api.openai.com/video.mp4',
      'user123',
      'generation',
      { model: 'sora-2' }
    );
  });

  it('rejects access to other user files', async () => {
    const { service } = buildStorageService();
    await expect(
      service.getViewUrl('user123', 'users/otheruser/generations/123-abc.mp4')
    ).rejects.toMatchObject({
      message: 'Unauthorized - cannot access files belonging to other users',
      statusCode: 403,
    });
  });

  it('rejects download URL requests for non-owned files with 403', async () => {
    const { service } = buildStorageService();
    await expect(
      service.getDownloadUrl('user123', 'users/otheruser/generations/123-abc.mp4')
    ).rejects.toMatchObject({
      message: 'Unauthorized - cannot access files belonging to other users',
      statusCode: 403,
    });
  });

  it('rejects metadata requests for non-owned files with 403', async () => {
    const { service } = buildStorageService();
    await expect(
      service.getFileMetadata('user123', 'users/otheruser/generations/123-abc.mp4')
    ).rejects.toMatchObject({
      message: 'Unauthorized',
      statusCode: 403,
    });
  });

  it('deletes owned file', async () => {
    const { service, mockRetentionService } = buildStorageService();
    const result = await service.deleteFile('user123', 'users/user123/generations/123-abc.mp4');

    expect(result.deleted).toBe(true);
    expect(mockRetentionService.deleteFile).toHaveBeenCalled();
  });
});
