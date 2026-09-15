import { useCallback, useEffect, useRef, useState } from 'react';
import type { RecoveryLifecycle } from './useRecoveryLifecycle';

export type RecoveryOutcome = 'attempted' | 'busy';
const DELAYS = [2000, 4000, 8000, 16000, 30000];

/** Schedules one channel; it knows nothing about pages, images, or transport. */
export function useBoundedRecovery(
  pending: boolean,
  { enabled, revision }: RecoveryLifecycle,
  attempt: () => Promise<RecoveryOutcome>,
) {
  const [round, setRound] = useState(0);
  const [epoch, setEpoch] = useState(0);
  const callback = useRef(attempt);
  callback.current = attempt;
  const running = useRef(false);
  const lastRevision = useRef(revision);
  const immediate = useRef(false);
  const restart = useCallback(() => {
    setRound(0);
    setEpoch(value => value + 1);
  }, []);

  useEffect(() => {
    if (lastRevision.current !== revision) {
      lastRevision.current = revision;
      immediate.current = pending;
      restart();
    }
    if (!pending) {
      immediate.current = false;
      setRound(0);
    }
  }, [pending, revision, restart]);

  useEffect(() => {
    if (
      !pending ||
      !enabled ||
      (round >= DELAYS.length && !immediate.current)
    ) {
      return;
    }
    let cancelled = false;
    const run = async () => {
      const isImmediate = immediate.current;
      immediate.current = false;
      if (running.current) {
        if (!cancelled) {
          setEpoch(value => value + 1);
        }
        return;
      }
      running.current = true;
      try {
        const outcome = await callback.current();
        if (!cancelled) {
          if (outcome === 'attempted') {
            immediate.current = false;
            if (!isImmediate) {
              setRound(value => value + 1);
            }
          }
          setEpoch(value => value + 1);
        }
      } finally {
        running.current = false;
      }
    };
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (immediate.current) {
      run();
    } else {
      timer = setTimeout(run, DELAYS[round]);
    }
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [pending, enabled, revision, round, epoch]);

  return { restart, exhausted: pending && round >= DELAYS.length };
}
