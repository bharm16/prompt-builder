import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { continuityApi } from '../../api/continuityApi';

interface ContinueSceneButtonProps {
  sourceVideoId?: string | null;
  defaultName?: string;
  className?: string;
}

export function ContinueSceneButton({
  sourceVideoId,
  defaultName = 'Continuity Session',
  className,
}: ContinueSceneButtonProps): React.ReactElement {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    if (!sourceVideoId || isLoading) return;
    setError(null);
    setIsLoading(true);
    try {
      const session = await continuityApi.createSession({
        name: defaultName,
        sourceVideoId,
      });
      navigate(`/continuity/${session.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={className}>
      <button
        type="button"
        className={`rounded-md px-2 py-1 text-xs font-medium ${
          sourceVideoId
            ? 'bg-accent text-white'
            : 'bg-surface-3 text-muted cursor-not-allowed'
        }`}
        onClick={handleClick}
        disabled={!sourceVideoId || isLoading}
      >
        {isLoading ? 'Starting...' : 'Continue Scene'}
      </button>
      {error && <div className="mt-1 text-xs text-error">{error}</div>}
    </div>
  );
}

export default ContinueSceneButton;
