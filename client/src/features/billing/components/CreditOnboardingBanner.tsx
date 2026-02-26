import React from 'react';
import { Link } from 'react-router-dom';
import { X } from '@promptstudio/system/components/ui';

interface CreditOnboardingBannerProps {
  userId: string | null;
  starterGrantCredits: number | null;
}

const dismissedKey = (userId: string): string => `credit-onboarding-dismissed:${userId}`;

export function CreditOnboardingBanner({
  userId,
  starterGrantCredits,
}: CreditOnboardingBannerProps): React.ReactElement | null {
  const [dismissed, setDismissed] = React.useState(false);

  React.useEffect(() => {
    if (!userId) {
      setDismissed(true);
      return;
    }
    try {
      setDismissed(localStorage.getItem(dismissedKey(userId)) === '1');
    } catch {
      setDismissed(true);
    }
  }, [userId]);

  const handleDismiss = React.useCallback((): void => {
    if (!userId) return;
    try {
      localStorage.setItem(dismissedKey(userId), '1');
    } catch {
      // Ignore storage failures.
    }
    setDismissed(true);
  }, [userId]);

  if (!userId || dismissed) {
    return null;
  }

  const starterText =
    typeof starterGrantCredits === 'number' && starterGrantCredits > 0
      ? `You started with ${starterGrantCredits} credits.`
      : 'Credits are required for previews and renders.';

  return (
    <section
      className="mx-3 mt-3 rounded-lg border border-[#1A1C22] bg-[#111318] px-3 py-2"
      data-testid="credit-onboarding-banner"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold text-white">Credits power generation</p>
          <p className="mt-0.5 text-[11px] text-[#8B92A5]">
            {starterText} You can top up anytime in{' '}
            <Link to="/billing" className="text-white underline underline-offset-2">
              billing
            </Link>
            .
          </p>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          className="rounded-md p-1 text-[#8B92A5] transition-colors hover:bg-[#1A1C22] hover:text-white"
          aria-label="Dismiss credit onboarding"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </section>
  );
}
