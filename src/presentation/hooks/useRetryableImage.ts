import { useEffect, useId, useRef, useState } from 'react';

export type ImageFailureReporter = (key: string, failed: boolean) => void;

/** Attempt identity prevents late native image callbacks from changing a newer load. */
export function useRetryableImage(
  urls: readonly string[],
  generation: number,
  report?: ImageFailureReporter,
) {
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const instance = useId();
  const identity = JSON.stringify(urls);
  const failureKey = `${instance}:${identity}`;
  const [attempt, setAttempt] = useState({
    identity,
    generation,
    index: 0,
    loaded: false,
    serial: 0,
  });
  let current = attempt;
  if (attempt.identity !== identity || attempt.generation !== generation) {
    const restart =
      attempt.identity !== identity ||
      (attempt.index >= urls.length && urls.length > 0);
    current = restart
      ? {
          identity,
          generation,
          index: 0,
          loaded: false,
          serial: attempt.serial + 1,
        }
      : { ...attempt, generation };
    // Consume busy generations without changing the native attempt's identity.
    setAttempt(current);
  }
  const latest = useRef(current);
  latest.current = current;
  const failed = urls.length > 0 && current.index >= urls.length;
  useEffect(() => {
    if (failed) {
      report?.(failureKey, true);
    } else if (current.loaded) {
      report?.(failureKey, false);
    }
  }, [failureKey, failed, current.loaded, report]);
  useEffect(() => () => report?.(failureKey, false), [failureKey, report]);
  const update = (loaded: boolean) => {
    const active = latest.current;
    if (
      !mounted.current ||
      active.identity !== current.identity ||
      active.serial !== current.serial ||
      active.index !== current.index ||
      active.loaded !== current.loaded
    ) {
      return;
    }
    const next = loaded
      ? { ...active, loaded: true }
      : { ...active, index: active.index + 1, loaded: false };
    latest.current = next;
    setAttempt(next);
  };
  return {
    url: urls[current.index],
    loaded: current.loaded,
    key: `${identity}:${current.serial}:${current.index}`,
    onLoad: () => update(true),
    onError: () => update(false),
  };
}
