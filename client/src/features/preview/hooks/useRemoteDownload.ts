import { useCallback, useState } from 'react';

interface DownloadOptions {
  url?: string | null;
  fileName: string;
  openInNewTabOnFailure?: boolean;
}

export function useRemoteDownload(): {
  isDownloading: boolean;
  download: (options: DownloadOptions) => Promise<void>;
} {
  const [isDownloading, setIsDownloading] = useState(false);

  const download = useCallback(
    async ({ url, fileName, openInNewTabOnFailure = true }: DownloadOptions) => {
      if (!url || isDownloading) return;
      setIsDownloading(true);
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to fetch file: ${response.status}`);
        }
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(objectUrl);
      } catch (error) {
        if (openInNewTabOnFailure) {
          window.open(url, '_blank', 'noopener,noreferrer');
        }
      } finally {
        setIsDownloading(false);
      }
    },
    [isDownloading]
  );

  return { isDownloading, download };
}
