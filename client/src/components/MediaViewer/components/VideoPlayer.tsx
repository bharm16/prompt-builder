import { cn } from '@/utils/cn';

interface VideoPlayerProps {
  src: string | null;
  className?: string | undefined;
  controls?: boolean | undefined;
  autoPlay?: boolean | undefined;
  loop?: boolean | undefined;
  muted?: boolean | undefined;
  poster?: string | undefined;
  onError?: () => void;
}

export function VideoPlayer({
  src,
  className,
  controls = true,
  autoPlay = false,
  loop = false,
  muted = true,
  poster,
  onError,
}: VideoPlayerProps) {
  if (!src) {
    return (
      <div
        className={cn(
          'flex h-full w-full items-center justify-center rounded-md bg-[rgb(30,34,40)] text-xs text-faint',
          className
        )}
      >
        Video unavailable
      </div>
    );
  }

  return (
    <video
      src={src}
      className={cn('h-full w-full rounded-md bg-black object-cover', className)}
      controls={controls}
      autoPlay={autoPlay}
      loop={loop}
      muted={muted}
      playsInline
      poster={poster}
      onError={onError}
    />
  );
}

export default VideoPlayer;
