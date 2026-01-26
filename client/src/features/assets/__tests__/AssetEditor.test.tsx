import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AssetEditor } from '../components/AssetEditor';
import type { Asset } from '@shared/types/asset';

vi.mock('@promptstudio/system/components/ui/dialog', () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}));

vi.mock('@promptstudio/system/components/ui/input', () => ({
  Input: (props: any) => <input {...props} />,
}));

vi.mock('@promptstudio/system/components/ui/textarea', () => ({
  Textarea: (props: any) => <textarea {...props} />,
}));

vi.mock('@promptstudio/system/components/ui/button', () => ({
  Button: (props: any) => <button {...props} />,
}));

vi.mock('../components/ReferenceImageUploader', () => ({
  default: () => <div data-testid="uploader" />,
}));

vi.mock('../components/ReferenceImageGrid', () => ({
  default: () => <div data-testid="grid" />,
}));

const baseAsset: Asset = {
  id: 'asset-1',
  userId: 'user-1',
  type: 'character',
  trigger: '@Ada',
  name: 'Ada',
  textDefinition: 'Text',
  referenceImages: [],
  usageCount: 0,
  lastUsedAt: null,
  createdAt: 'now',
  updatedAt: 'now',
};

describe('AssetEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('error handling', () => {
    it('requires description for non-character assets', async () => {
      const onCreate = vi.fn().mockResolvedValue(baseAsset);

      render(
        <AssetEditor
          mode="create"
          preselectedType="style"
          onClose={vi.fn()}
          onCreate={onCreate}
          onUpdate={vi.fn()}
          onAddImage={vi.fn()}
          onDeleteImage={vi.fn()}
          onSetPrimaryImage={vi.fn()}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      expect(await screen.findByText('Description is required for this asset type.')).toBeInTheDocument();
      expect(onCreate).not.toHaveBeenCalled();
    });

    it('surfaces errors from create calls', async () => {
      const onCreate = vi.fn().mockRejectedValue(new Error('Boom'));

      render(
        <AssetEditor
          mode="create"
          preselectedType="character"
          onClose={vi.fn()}
          onCreate={onCreate}
          onUpdate={vi.fn()}
          onAddImage={vi.fn()}
          onDeleteImage={vi.fn()}
          onSetPrimaryImage={vi.fn()}
        />
      );

      fireEvent.change(screen.getByPlaceholderText('e.g., Alice (Protagonist)'), { target: { value: 'Ada' } });
      fireEvent.change(screen.getByPlaceholderText('e.g., @Alice'), { target: { value: '@Ada' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      expect(await screen.findByText('Boom')).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('prefills fields when editing an asset', () => {
      render(
        <AssetEditor
          mode="edit"
          asset={baseAsset}
          onClose={vi.fn()}
          onCreate={vi.fn()}
          onUpdate={vi.fn()}
          onAddImage={vi.fn()}
          onDeleteImage={vi.fn()}
          onSetPrimaryImage={vi.fn()}
        />
      );

      expect(screen.getByDisplayValue('Ada')).toBeInTheDocument();
      expect(screen.getByDisplayValue('@Ada')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Text')).toBeInTheDocument();
      expect(screen.getByText('Type is locked')).toBeInTheDocument();
    });

    it('shows guidance when reference images are unavailable in create mode', () => {
      render(
        <AssetEditor
          mode="create"
          preselectedType="character"
          onClose={vi.fn()}
          onCreate={vi.fn()}
          onUpdate={vi.fn()}
          onAddImage={vi.fn()}
          onDeleteImage={vi.fn()}
          onSetPrimaryImage={vi.fn()}
        />
      );

      expect(screen.getByText('You can add reference images after saving this asset.')).toBeInTheDocument();
    });
  });

  describe('core behavior', () => {
    it('creates asset without blank description', async () => {
      const onCreate = vi.fn().mockResolvedValue(baseAsset);
      const onClose = vi.fn();

      render(
        <AssetEditor
          mode="create"
          preselectedType="character"
          onClose={onClose}
          onCreate={onCreate}
          onUpdate={vi.fn()}
          onAddImage={vi.fn()}
          onDeleteImage={vi.fn()}
          onSetPrimaryImage={vi.fn()}
        />
      );

      fireEvent.change(screen.getByPlaceholderText('e.g., Alice (Protagonist)'), { target: { value: 'Ada' } });
      fireEvent.change(screen.getByPlaceholderText('e.g., @Alice'), { target: { value: '@Ada' } });
      fireEvent.change(screen.getByPlaceholderText(/shoulder-length auburn hair/i), { target: { value: '   ' } });
      fireEvent.change(screen.getByPlaceholderText('e.g., no glasses, no hat'), { target: { value: 'none' } });

      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => {
        expect(onCreate).toHaveBeenCalledWith({
          type: 'character',
          trigger: '@Ada',
          name: 'Ada',
          negativePrompt: 'none',
        });
        expect(onClose).toHaveBeenCalled();
      });
    });

    it('updates asset with trimmed description', async () => {
      const onUpdate = vi.fn().mockResolvedValue(baseAsset);
      const onClose = vi.fn();

      render(
        <AssetEditor
          mode="edit"
          asset={baseAsset}
          onClose={onClose}
          onCreate={vi.fn()}
          onUpdate={onUpdate}
          onAddImage={vi.fn()}
          onDeleteImage={vi.fn()}
          onSetPrimaryImage={vi.fn()}
        />
      );

      fireEvent.change(screen.getByDisplayValue('Text'), { target: { value: '  Updated  ' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => {
        expect(onUpdate).toHaveBeenCalledWith('asset-1', {
          trigger: '@Ada',
          name: 'Ada',
          textDefinition: 'Updated',
          negativePrompt: '',
        });
        expect(onClose).toHaveBeenCalled();
      });
    });
  });
});
