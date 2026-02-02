import { useEffect, useMemo } from 'react';
import debounce from 'lodash/debounce';
import { validatePromptTriggers } from '../api/triggerValidation';

export function useTriggerValidation(delayMs = 500): (text: string) => void {
  const debouncedValidate = useMemo(
    () =>
      debounce((text: string) => {
        void validatePromptTriggers(text);
      }, delayMs),
    [delayMs]
  );

  useEffect(() => {
    return () => {
      debouncedValidate.cancel();
    };
  }, [debouncedValidate]);

  return debouncedValidate;
}
