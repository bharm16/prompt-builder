import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type React from 'react';

import { GenerationBadge } from '@features/prompt-optimizer/GenerationsPanel/components/GenerationBadge';
import { VersionDivider } from '@features/prompt-optimizer/GenerationsPanel/components/VersionDivider';
import { FaceMatchIndicator } from '@features/prompt-optimizer/GenerationsPanel/components/KeyframeStep/FaceMatchIndicator';
import { VideoThumbnail } from '@features/prompt-optimizer/GenerationsPanel/components/VideoThumbnail';
import { KeyframeOptionCard } from '@features/prompt-optimizer/GenerationsPanel/components/KeyframeStep/KeyframeOptionCard';
import type { KeyframeOption } from '@features/prompt-optimizer/GenerationsPanel/components/KeyframeStep/hooks/useKeyframeGeneration';

vi.mock('@promptstudio/system/components/ui/badge', () => ({
  Badge: ({ className, children }: { className?: string; children: React.ReactNode }) => (
    <div className={className}>{children}</div>
  ),
}));

vi.mock('@promptstudio/system/components/ui', () => ({
  Play: () => <span>play</span>,
}));

describe('GenerationBadge', () => {
  describe('error handling', () => {
    it('falls back to muted styling when status is undefined for drafts', () => {
      render(<GenerationBadge tier="draft" />);
      const badge = screen.getByText('Draft');
      expect(badge.className).toContain('bg-surface-2');
    });
  });

  describe('edge cases', () => {
    it('renders the render label for non-draft tiers', () => {
      render(<GenerationBadge tier="render" />);
      expect(screen.getByText('Render')).toBeInTheDocument();
    });
  });

  describe('core behavior', () => {
    it('uses success styling for completed status', () => {
      render(<GenerationBadge tier="render" status="completed" />);
      const badge = screen.getByText('Render');
      const dot = badge.querySelector('span');
      expect(dot?.className).toContain('bg-success');
    });
  });
});

describe('VersionDivider', () => {
  describe('error handling', () => {
    it('omits the prompt changed label when prompt is unchanged', () => {
      render(<VersionDivider versionLabel="v1" promptChanged={false} />);
      expect(screen.queryByText(/prompt changed/i)).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('includes prompt changed in the aria label', () => {
      render(<VersionDivider versionLabel="v2" promptChanged={true} />);
      const divider = screen.getByRole('separator');
      expect(divider).toHaveAttribute('aria-label', 'Version v2, prompt changed');
    });
  });

  describe('core behavior', () => {
    it('renders the version label text', () => {
      render(<VersionDivider versionLabel="v3" promptChanged={false} />);
      expect(screen.getByText('v3')).toBeInTheDocument();
    });
  });
});

describe('FaceMatchIndicator', () => {
  describe('error handling', () => {
    it('renders a placeholder when score is missing', () => {
      render(<FaceMatchIndicator />);
      expect(screen.getByText('Face match: --')).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('uses red styling for low scores', () => {
      render(<FaceMatchIndicator score={0.4} />);
      const label = screen.getByText('40% match');
      expect(label.className).toContain('text-red-400');
    });
  });

  describe('core behavior', () => {
    it('renders percentage and bar for high scores', () => {
      render(<FaceMatchIndicator score={0.85} />);
      expect(screen.getByText('85% match')).toBeInTheDocument();
      const bar = screen.getByText('85% match').nextSibling as HTMLElement;
      expect(bar.querySelector('div')?.style.width).toBe('85%');
    });
  });
});

describe('VideoThumbnail', () => {
  describe('error handling', () => {
    it('shows a fallback message when no media is available', () => {
      render(<VideoThumbnail videoUrl={null} thumbnailUrl={null} isGenerating={false} />);
      expect(screen.getByText('No preview available')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /play preview/i })).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('shows a shimmer placeholder while generating', () => {
      render(<VideoThumbnail videoUrl={null} thumbnailUrl={null} isGenerating />);
      expect(screen.queryByRole('button', { name: /play preview/i })).toBeNull();
    });
  });

  describe('core behavior', () => {
    it('renders a video element when a video url is available', () => {
      const { container } = render(
        <VideoThumbnail videoUrl="https://cdn/video.mp4" isGenerating={false} />
      );
      expect(container.querySelector('video')).not.toBeNull();
    });
  });
});

describe('KeyframeOptionCard', () => {
  const keyframe: KeyframeOption = {
    imageUrl: 'https://cdn/keyframe.png',
    faceStrength: 0.8,
    faceMatchScore: 0.7,
  };

  describe('error handling', () => {
    it('renders even when face match score is missing', () => {
      render(
        <KeyframeOptionCard
          keyframe={{ ...keyframe, faceMatchScore: undefined }}
          isSelected={false}
          onSelect={() => {}}
        />
      );
      expect(screen.getByAltText('Keyframe option')).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('shows the selection checkmark when selected', () => {
      render(<KeyframeOptionCard keyframe={keyframe} isSelected onSelect={() => {}} />);
      const button = screen.getByRole('button');
      expect(button.className).toContain('border-violet-500');
    });
  });

  describe('core behavior', () => {
    it('calls onSelect when clicked', () => {
      const onSelect = vi.fn();
      render(<KeyframeOptionCard keyframe={keyframe} isSelected={false} onSelect={onSelect} />);

      fireEvent.click(screen.getByRole('button'));
      expect(onSelect).toHaveBeenCalled();
    });
  });
});
