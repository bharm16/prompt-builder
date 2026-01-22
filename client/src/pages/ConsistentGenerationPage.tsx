import React from 'react';
import { AppShell } from '@components/navigation/AppShell';
import ConsistentGenerationPanel from '@/features/generation/ConsistentGenerationPanel';

export function ConsistentGenerationPage(): React.ReactElement {
  return (
    <AppShell>
      <ConsistentGenerationPanel />
    </AppShell>
  );
}

export default ConsistentGenerationPage;
