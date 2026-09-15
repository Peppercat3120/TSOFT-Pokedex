import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

export interface RecoveryLifecycle {
  readonly enabled: boolean;
  readonly revision: number;
}

/** One native subscription shared by a screen's recovery channels. */
export function useRecoveryLifecycle(focused: boolean): RecoveryLifecycle {
  const [active, setActive] = useState(AppState.currentState === 'active');
  const [revision, setRevision] = useState(0);
  const previousFocus = useRef(focused);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      setActive(state === 'active');
      if (state === 'active') {
        setRevision(value => value + 1);
      }
    });
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    if (focused && !previousFocus.current) {
      setRevision(value => value + 1);
    }
    previousFocus.current = focused;
  }, [focused]);
  return { enabled: active && focused, revision };
}
