import { useCallback, useRef, useState } from 'react';
import type { RecoveryOutcome } from './useBoundedRecovery';
import type { ImageFailureReporter } from './useRetryableImage';

/** Failed mounted instances remain pending until success or disposal. */
export function useImageRecovery() {
  const failures = useRef(new Map<string, 'failed' | 'retrying'>());
  const [pending, setPending] = useState(false);
  const [imageRetryGeneration, setGeneration] = useState(0);
  const reportImageFailure = useCallback<ImageFailureReporter>(
    (key, failed) => {
      if (failed) {
        failures.current.set(key, 'failed');
      } else {
        failures.current.delete(key);
      }
      setPending(failures.current.size > 0);
    },
    [],
  );
  const retryImages = useCallback((): RecoveryOutcome => {
    let started = false;
    for (const [key, status] of failures.current) {
      if (status === 'failed') {
        failures.current.set(key, 'retrying');
        started = true;
      }
    }
    if (!started) {
      return 'busy';
    }
    setGeneration(value => value + 1);
    return 'attempted';
  }, []);
  return { pending, imageRetryGeneration, reportImageFailure, retryImages };
}
