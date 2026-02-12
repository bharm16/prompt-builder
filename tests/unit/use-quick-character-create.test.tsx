import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useQuickCharacterCreate } from '@features/prompt-optimizer/components/QuickCharacterCreate/hooks/useQuickCharacterCreate';
import { assetApi } from '@features/assets/api/assetApi';

vi.mock('@features/assets/api/assetApi', () => ({
  assetApi: {
    create: vi.fn(),
    addImage: vi.fn(),
    setPrimaryImage: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockCreate = vi.mocked(assetApi.create);
const mockAddImage = vi.mocked(assetApi.addImage);
const mockSetPrimaryImage = vi.mocked(assetApi.setPrimaryImage);
const mockGet = vi.mocked(assetApi.get);
const mockDelete = vi.mocked(assetApi.delete);

describe('useQuickCharacterCreate', () => {
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;

  beforeEach(() => {
    vi.clearAllMocks();

    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn(() => 'blob:preview-1'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: originalCreateObjectURL,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: originalRevokeObjectURL,
    });
  });

  it('deletes the created asset when image upload fails during quick create', async () => {
    mockCreate.mockResolvedValue({
      id: 'asset_123',
      userId: 'user-1',
      type: 'character',
      trigger: '@luke',
      name: 'Luke',
      textDefinition: '',
      negativePrompt: '',
      referenceImages: [],
      usageCount: 0,
      lastUsedAt: null,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    });
    mockAddImage.mockRejectedValue(new Error('The specified bucket does not exist.'));
    mockDelete.mockResolvedValue(true);
    mockSetPrimaryImage.mockResolvedValue({} as any);
    mockGet.mockResolvedValue({} as any);

    const { result } = renderHook(() =>
      useQuickCharacterCreate({
        isOpen: true,
      })
    );

    const file = new File(['test-image'], 'headshot.jpg', { type: 'image/jpeg' });

    act(() => {
      result.current.setTrigger('luke');
      result.current.setName('Luke');
      result.current.handleAddImages([file]);
    });

    let createdAsset = null;
    await act(async () => {
      createdAsset = await result.current.createCharacter();
    });

    expect(createdAsset).toBeNull();
    expect(mockDelete).toHaveBeenCalledWith('asset_123');
    expect(result.current.error).toBe('The specified bucket does not exist.');
  });
});
