import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { HttpError, NetworkError } from '../../domain/errors/PokemonErrors';

export type RecoveryReason = 'data' | 'images' | 'data-and-images';

export type ImageFailureReporter = (key: string, failed: boolean) => void;

export function canRecoverAutomatically(error: unknown): boolean {
  return (
    error instanceof NetworkError ||
    (error instanceof HttpError &&
      (error.status === 408 || (error.status >= 500 && error.status <= 599)))
  );
}

const DELAYS = [2000, 4000, 8000, 16000, 30000];

function recoveryReason(
  dataPending: boolean,
  imagesPending: boolean,
): RecoveryReason | null {
  if (dataPending && imagesPending) {
    return 'data-and-images';
  }
  if (dataPending) {
    return 'data';
  }
  return imagesPending ? 'images' : null;
}

/**
 * Owns recovery timing, lifecycle cancellation, and failed-image tracking.
 * Controllers only decide how a data recovery should be performed.
 */
export function useAutomaticRecovery({
  dataPending,
  focused,
  onRecover,
}: {
  readonly dataPending: boolean;
  readonly focused: boolean;
  readonly onRecover: (
    reason: RecoveryReason,
    retryImages: () => void,
  ) => Promise<void | boolean>;
}) {
  const failures = useRef(new Set<string>());
  const [imagesPending, setImagesPending] = useState(false);
  const [imageRetryGeneration, setImageRetryGeneration] = useState(0);
  const [active, setActive] = useState(
    AppState.currentState !== 'background' &&
      AppState.currentState !== 'inactive',
  );
  const [round, setRound] = useState(0);
  const [epoch, setEpoch] = useState(0);
  const pending = dataPending || imagesPending;
  const pendingRef = useRef(pending);
  const dataPendingRef = useRef(dataPending);
  const imagesPendingRef = useRef(imagesPending);
  const focusedRef = useRef(focused);
  const callback = useRef(onRecover);
  pendingRef.current = pending;
  dataPendingRef.current = dataPending;
  imagesPendingRef.current = imagesPending;
  focusedRef.current = focused;
  callback.current = onRecover;

  const restartRecovery = useCallback(() => {
    setRound(0);
    setEpoch(value => value + 1);
  }, []);
  const retryImages = useCallback(() => {
    setImageRetryGeneration(value => value + 1);
  }, []);
  const reportImageFailure = useCallback<ImageFailureReporter>((key, failed) => {
    if (failed) {
      failures.current.add(key);
    } else {
      failures.current.delete(key);
    }
    setImagesPending(failures.current.size > 0);
  }, []);
  const recover = useCallback(() => {
    const reason = recoveryReason(
      dataPendingRef.current,
      imagesPendingRef.current,
    );
    return reason === null
      ? Promise.resolve()
      : callback.current(reason, retryImages);
  }, [retryImages]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      setActive(state === 'active');
      if (state === 'active') {
        restartRecovery();
        if (pendingRef.current && focusedRef.current) {
          recover();
        }
      }
    });
    return () => subscription.remove();
  }, [recover, restartRecovery]);
  useEffect(() => {
    if (focused) {
      restartRecovery();
      if (pendingRef.current && AppState.currentState === 'active') {
        recover();
      }
    }
  }, [focused, recover, restartRecovery]);
  useEffect(() => {
    if (!pending) {
      setRound(0);
    }
  }, [pending]);
  useEffect(() => {
    if (!pending || !active || !focused || round >= DELAYS.length) {
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      const completed = await recover();
      if (!cancelled) {
        if (completed === false) {
          setEpoch(value => value + 1);
        } else {
          setRound(value => (pendingRef.current ? value + 1 : 0));
        }
      }
    }, DELAYS[round]);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [pending, active, focused, round, epoch, recover]);

  return {
    restartRecovery,
    recoveryExhausted: pending && round >= DELAYS.length,
    imageRetryGeneration,
    reportImageFailure,
    retryImages,
  };
}
