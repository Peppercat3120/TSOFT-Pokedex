import { useCallback, useRef, useState } from 'react';
import type { ImageFailureReporter } from './useRetryableImage';

/** Failed mounted instances remain pending until success or disposal. */
export function useImageRecovery() {
  const failures = useRef(new Set<string>());
  const [pending, setPending] = useState(false);
  const [imageRetryGeneration, setGeneration] = useState(0);
  const reportImageFailure = useCallback<ImageFailureReporter>(
    (key, failed) => {
      if (failed) {
        failures.current.add(key);
      } else {
        failures.current.delete(key);
      }
      setPending(failures.current.size > 0);
    },
    [],
  );
  const retryImages = useCallback(() => setGeneration(value => value + 1), []);
  return { pending, imageRetryGeneration, reportImageFailure, retryImages };
}
