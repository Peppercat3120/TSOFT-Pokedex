import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { HttpError, NetworkError } from '../../domain/errors/PokemonErrors';

export function canRecoverAutomatically(error: unknown): boolean {
  return (
    error instanceof NetworkError ||
    (error instanceof HttpError &&
      (error.status === 408 || (error.status >= 500 && error.status <= 599)))
  );
}

const DELAYS = [2000, 4000, 8000, 16000, 30000];

/** Owns one retry budget; network operations remain in the screen controller. */
export function useRecovery(
  pending: boolean,
  recover: () => Promise<void | boolean>,
  focused: boolean,
) {
  const [active, setActive] = useState(
    AppState.currentState !== 'background' &&
      AppState.currentState !== 'inactive',
  );
  const [round, setRound] = useState(0);
  const [epoch, setEpoch] = useState(0);
  const pendingRef = useRef(pending);
  const focusedRef = useRef(focused);
  pendingRef.current = pending;
  focusedRef.current = focused;
  const callback = useRef(recover);
  callback.current = recover;
  const restart = useCallback(() => {
    setRound(0);
    setEpoch(value => value + 1);
  }, []);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      setActive(state === 'active');
      if (state === 'active') {
        restart();
        if (pendingRef.current && focusedRef.current) {
          callback.current();
        }
      }
    });
    return () => subscription.remove();
  }, [restart]);
  useEffect(() => {
    if (focused) {
      restart();
      if (pendingRef.current && AppState.currentState === 'active') {
        callback.current();
      }
    }
  }, [focused, restart]);
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
      const completed = await callback.current();
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
  }, [pending, active, focused, round, epoch]);
  return { restart, exhausted: pending && round >= DELAYS.length };
}

export function useImageRecovery() {
  const failures = useRef(new Set<string>());
  const [pending, setPending] = useState(false);
  const [imageRetryGeneration, setGeneration] = useState(0);
  const reportImageFailure = useCallback((key: string, failed: boolean) => {
    if (failed) {
      failures.current.add(key);
    } else {
      failures.current.delete(key);
    }
    setPending(failures.current.size > 0);
  }, []);
  const retryImages = useCallback(() => {
    setGeneration(value => value + 1);
  }, []);
  return { pending, imageRetryGeneration, reportImageFailure, retryImages };
}
