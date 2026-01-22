import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import AssetLibrary from '../AssetLibrary';

vi.mock('../api/assetApi', () => ({
  assetApi: {
    list: vi.fn().mockResolvedValue({
      assets: [],
      total: 0,
      byType: { character: 0, style: 0, location: 0, object: 0 },
    }),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    addImage: vi.fn(),
    get: vi.fn(),
    deleteImage: vi.fn(),
    setPrimaryImage: vi.fn(),
    getForGeneration: vi.fn(),
  },
}));

describe('AssetLibrary', () => {
  it('renders empty state when no assets exist', async () => {
    render(<AssetLibrary />);
    expect(await screen.findByText('No assets yet')).toBeInTheDocument();
  });
});
