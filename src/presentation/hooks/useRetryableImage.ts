import { useEffect, useRef, useState } from 'react';

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
  const identity = JSON.stringify(urls);
  const [attempt, setAttempt] = useState({
    identity,
    generation,
    index: 0,
    loaded: false,
    serial: 0,
  });
  let current = attempt;
  if (
    attempt.identity !== identity ||
    (attempt.generation !== generation &&
      attempt.index >= urls.length &&
      urls.length > 0)
  ) {
    current = {
      identity,
      generation,
      index: 0,
      loaded: false,
      serial: attempt.serial + 1,
    };
    setAttempt(current);
  }
  const latest = useRef(current);
  latest.current = current;
  const failed = urls.length > 0 && current.index >= urls.length;
  useEffect(() => {
    if (failed) {
      report?.(identity, true);
    } else if (current.loaded) {
      report?.(identity, false);
    }
  }, [identity, failed, current.loaded, report]);
  useEffect(() => () => report?.(identity, false), [identity, report]);
  const update = (loaded: boolean) => {
    if (!mounted.current || latest.current !== current) {
      return;
    }
    const next = loaded
      ? { ...current, loaded: true }
      : { ...current, index: current.index + 1, loaded: false };
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
