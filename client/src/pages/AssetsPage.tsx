import React from 'react';
import { AppShell } from '@components/navigation/AppShell';
import AssetLibrary from '@/features/assets/AssetLibrary';

export function AssetsPage(): React.ReactElement {
  return (
    <AppShell>
      <AssetLibrary />
    </AppShell>
  );
}

export default AssetsPage;
