import type { ReactElement } from 'react';
import { Palette } from '@promptstudio/system/components/ui';

export function StylesPanel(): ReactElement {
  return (
    <div className="flex flex-col h-full items-center justify-center">
      <Palette className="w-12 h-12 text-ghost mb-4" />
      <p className="text-sm text-ghost">Style presets coming soon</p>
    </div>
  );
}
