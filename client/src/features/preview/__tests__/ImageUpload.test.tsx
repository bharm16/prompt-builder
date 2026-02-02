import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import { ImageUpload } from '../components/ImageUpload';
import { uploadPreviewImage } from '../api/previewApi';

vi.mock('../api/previewApi', async () => {
  const actual = await vi.importActual<typeof import('../api/previewApi')>('../api/previewApi');
  return {
    ...actual,
    uploadPreviewImage: vi.fn(),
  };
});

const mockUploadPreviewImage = vi.mocked(uploadPreviewImage);

const createFile = (type: string, size = 1024) => {
  const file = new File(['x'.repeat(size)], 'file', { type });
  return file;
};

// ============================================================================
// ImageUpload
// ============================================================================

describe('ImageUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('error handling', () => {
    it('rejects unsupported file types', async () => {
      render(<ImageUpload />);

      const input = screen.getByRole('button').querySelector('input[type="file"]') as HTMLInputElement;
      const file = createFile('image/gif');

      fireEvent.change(input, { target: { files: [file] } });

      expect(screen.getByText('Only PNG, JPEG, and WebP files are supported.')).toBeInTheDocument();
      expect(mockUploadPreviewImage).not.toHaveBeenCalled();
    });

    it('rejects files larger than 10MB', () => {
      render(<ImageUpload />);

      const input = screen.getByRole('button').querySelector('input[type="file"]') as HTMLInputElement;
      const file = createFile('image/png');
      Object.defineProperty(file, 'size', { value: 10 * 1024 * 1024 + 1 });

      fireEvent.change(input, { target: { files: [file] } });

      expect(screen.getByText('Image must be 10MB or smaller.')).toBeInTheDocument();
      expect(mockUploadPreviewImage).not.toHaveBeenCalled();
    });

    it('surfaces upload failures when the API returns no URL', async () => {
      mockUploadPreviewImage.mockResolvedValueOnce({
        success: true,
        data: {
          storagePath: 'path',
        },
      });

      render(<ImageUpload />);

      const input = screen.getByRole('button').querySelector('input[type="file"]') as HTMLInputElement;
      const file = createFile('image/png');

      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText('Upload did not return an image URL')).toBeInTheDocument();
      });
    });
  });

  describe('edge cases', () => {
    it('shows uploading state while the request is in flight', async () => {
      let resolveUpload: (value: unknown) => void = () => {};
      const uploadPromise = new Promise((resolve) => {
        resolveUpload = resolve;
      });

      mockUploadPreviewImage.mockReturnValueOnce(uploadPromise as ReturnType<typeof uploadPreviewImage>);

      render(<ImageUpload />);

      const input = screen.getByRole('button').querySelector('input[type="file"]') as HTMLInputElement;
      const file = createFile('image/png');

      fireEvent.change(input, { target: { files: [file] } });

      expect(screen.getByText('Uploading image...')).toBeInTheDocument();

      resolveUpload({
        success: true,
        data: {
          imageUrl: 'https://example.com/upload.png',
        },
      });

      await waitFor(() => {
        expect(screen.getByText('Upload a keyframe image')).toBeInTheDocument();
      });
    });
  });

  describe('core behavior', () => {
    it('calls onUploadComplete with the resolved upload payload', async () => {
      const onUploadComplete = vi.fn();

      mockUploadPreviewImage.mockResolvedValueOnce({
        success: true,
        data: {
          viewUrl: 'https://example.com/view.png',
          imageUrl: 'https://example.com/raw.png',
          storagePath: 'preview/path',
          viewUrlExpiresAt: '2024-01-01T00:00:00Z',
          sizeBytes: 1234,
          contentType: 'image/png',
        },
      });

      render(<ImageUpload onUploadComplete={onUploadComplete} />);

      const input = screen.getByRole('button').querySelector('input[type="file"]') as HTMLInputElement;
      const file = createFile('image/png');

      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(onUploadComplete).toHaveBeenCalledWith({
          imageUrl: 'https://example.com/view.png',
          storagePath: 'preview/path',
          viewUrlExpiresAt: '2024-01-01T00:00:00Z',
          sizeBytes: 1234,
          contentType: 'image/png',
        });
      });
    });
  });
});
