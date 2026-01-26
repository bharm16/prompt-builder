import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ReferenceImageUploader } from '../components/ReferenceImageUploader';

vi.mock('@promptstudio/system/components/ui/button', () => ({
  Button: (props: any) => <button {...props} />,
}));

describe('ReferenceImageUploader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('error handling', () => {
    it('does not call upload when no file is selected', () => {
      const onUpload = vi.fn();
      const { container } = render(
        <ReferenceImageUploader
          assetType="character"
          onUpload={onUpload}
          maxImages={5}
          currentCount={0}
        />
      );

      const input = container.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(input, { target: { files: [] } });

      expect(onUpload).not.toHaveBeenCalled();
    });

    it('resets uploading state when upload fails', async () => {
      const onUpload = vi.fn().mockRejectedValue(new Error('fail'));
      const { container } = render(
        <ReferenceImageUploader
          assetType="character"
          onUpload={onUpload}
          maxImages={5}
          currentCount={0}
        />
      );

      const input = container.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(['image'], 'test.png', { type: 'image/png' });
      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(onUpload).toHaveBeenCalled();
        expect(screen.getByText('Upload image')).toBeInTheDocument();
      });
    });
  });

  describe('edge cases', () => {
    it('disables upload when max images reached', () => {
      render(
        <ReferenceImageUploader
          assetType="character"
          onUpload={vi.fn()}
          maxImages={3}
          currentCount={3}
        />
      );

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('renders metadata fields for character assets', () => {
      render(
        <ReferenceImageUploader
          assetType="character"
          onUpload={vi.fn()}
          maxImages={5}
          currentCount={0}
        />
      );

      expect(screen.getByText('Angle')).toBeInTheDocument();
      expect(screen.getByText('Expression')).toBeInTheDocument();
      expect(screen.getByText('Lighting')).toBeInTheDocument();
    });
  });

  describe('core behavior', () => {
    it('passes metadata selections to upload handler', async () => {
      const onUpload = vi.fn().mockResolvedValue(undefined);
      const { container } = render(
        <ReferenceImageUploader
          assetType="character"
          onUpload={onUpload}
          maxImages={5}
          currentCount={0}
        />
      );

      const selects = screen.getAllByRole('combobox');
      const angleSelect = selects[0] as HTMLSelectElement;
      const lightingSelect = selects[2] as HTMLSelectElement;
      fireEvent.change(angleSelect, { target: { value: 'front' } });
      fireEvent.change(lightingSelect, { target: { value: 'studio' } });

      const input = container.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(['image'], 'test.png', { type: 'image/png' });
      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(onUpload).toHaveBeenCalledWith(file, expect.objectContaining({
          angle: 'front',
          lighting: 'studio',
        }));
      });
    });
  });
});
