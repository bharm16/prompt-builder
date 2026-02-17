import type { IconProps } from '@promptstudio/system/components/ui';
import type { User } from './prompt-session';

export interface Mode {
  id: string;
  name: string;
  icon: IconProps['icon'];
  description: string;
}

export type WorkspaceUser = User;
