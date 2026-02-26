import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { VideoTabContent } from '../VideoTabContent';

type VideoTabContentProps = ComponentProps<typeof VideoTabContent>;

const buildProps = (
  overrides: Partial<VideoTabContentProps> = {}
): VideoTabContentProps => ({
  startFrame: null,
  endFrame: null,
  videoReferenceImages: [],
  extendVideo: null,
  supportsStartFrame: true,
  supportsEndFrame: false,
  supportsReferenceImages: false,
  supportsExtendVideo: false,
  maxReferenceImages: 0,
  isUploadDisabled: false,
  isEndFrameUploadDisabled: false,
  onRequestUpload: vi.fn(),
  onUploadFile: vi.fn(),
  onClearStartFrame: vi.fn(),
  onRequestEndFrameUpload: vi.fn(),
  onEndFrameUpload: vi.fn(),
  onClearEndFrame: vi.fn(),
  onRequestVideoReferenceUpload: vi.fn(),
  onAddVideoReference: vi.fn(),
  onRemoveVideoReference: vi.fn(),
  onUpdateVideoReferenceType: vi.fn(),
  onClearExtendVideo: vi.fn(),
  promptLength: 20,
  faceSwapMode: 'direct',
  faceSwapCharacterOptions: [],
  selectedCharacterId: '',
  onFaceSwapCharacterChange: vi.fn(),
  onFaceSwapPreview: vi.fn(),
  isFaceSwapPreviewDisabled: true,
  faceSwapPreviewReady: false,
  faceSwapPreviewLoading: false,
  faceSwapError: null,
  faceSwapCredits: 1,
  videoCredits: null,
  totalCredits: null,
  canCopy: true,
  canClear: true,
  onCopy: vi.fn(),
  onClear: vi.fn(),
  canGeneratePreviews: true,
  onGenerateSinglePreview: vi.fn(),
  onGenerateFourPreviews: vi.fn(),
  ...overrides,
});

describe('VideoTabContent', () => {
  it('hides references section when model does not support references', () => {
    render(<VideoTabContent {...buildProps({ supportsReferenceImages: false })} />);

    expect(screen.queryByText('References')).toBeNull();
  });

  it('shows references onboarding when capability is enabled', () => {
    render(
      <VideoTabContent
        {...buildProps({
          supportsReferenceImages: true,
          maxReferenceImages: 3,
        })}
      />
    );

    expect(screen.getByText('References')).toBeInTheDocument();
    expect(screen.getByText('Create consistent scenes')).toBeInTheDocument();
  });

  it('shows extend banner and clears extend mode', () => {
    const onClearExtendVideo = vi.fn();

    render(
      <VideoTabContent
        {...buildProps({
          supportsExtendVideo: true,
          extendVideo: {
            url: 'https://example.com/video.mp4',
            source: 'generation',
            generationId: 'gen-1',
          },
          onClearExtendVideo,
        })}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));

    expect(screen.getByText('Extending video')).toBeInTheDocument();
    expect(onClearExtendVideo).toHaveBeenCalledTimes(1);
  });
});
