import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { ContinuitySessionProvider, useContinuitySession } from '@/features/continuity';
import { ContinuitySessionView } from '@/features/continuity/components/ContinuitySession';

function ContinuityPageInner(): React.ReactElement {
  const { sessionId } = useParams();
  const { loadSession, session, loading, error } = useContinuitySession();

  useEffect(() => {
    if (sessionId) {
      void loadSession(sessionId);
    }
  }, [sessionId]);

  if (loading) {
    return <div className="p-6">Loading continuity session...</div>;
  }

  if (error) {
    return <div className="p-6 text-red-500">{error}</div>;
  }

  if (!session) {
    return <div className="p-6">No session found.</div>;
  }

  return <ContinuitySessionView />;
}

export function ContinuityPage(): React.ReactElement {
  return (
    <ContinuitySessionProvider>
      <ContinuityPageInner />
    </ContinuitySessionProvider>
  );
}

export default ContinuityPage;
