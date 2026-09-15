import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import {
  useBoundedRecovery,
  type RecoveryOutcome,
} from '../../src/presentation/hooks/useBoundedRecovery';

describe('single-channel scheduler', () => {
  let renderer: Renderer.ReactTestRenderer;
  let controller: ReturnType<typeof useBoundedRecovery>;
  let attempt: jest.Mock<Promise<RecoveryOutcome>, []>;
  function Harness({ pending = true, enabled = true, revision = 0 }) {
    controller = useBoundedRecovery(pending, { enabled, revision }, attempt);
    return null;
  }
  beforeEach(() => {
    jest.useFakeTimers();
    attempt = jest.fn().mockResolvedValue('attempted');
  });
  afterEach(async () => {
    await act(async () => renderer?.unmount());
    jest.useRealTimers();
  });
  async function mount() {
    await act(async () => {
      renderer = Renderer.create(<Harness />);
    });
  }
  async function advance(ms: number) {
    await act(async () => {
      jest.advanceTimersByTime(ms);
    });
  }
  it('does not overlap attempts and schedules the next delay after completion', async () => {
    let finish!: (outcome: RecoveryOutcome) => void;
    attempt.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finish = resolve;
        }),
    );
    await mount();
    await advance(2000);
    await advance(60000);
    expect(attempt).toHaveBeenCalledTimes(1);
    await act(async () => finish('attempted'));
    await advance(3999);
    expect(attempt).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(attempt).toHaveBeenCalledTimes(2);
  });
  it('resumes immediately with a fresh budget and does not count the immediate attempt', async () => {
    await mount();
    for (const delay of [2000, 4000, 8000, 16000, 30000]) {
      await advance(delay);
    }
    expect(controller.exhausted).toBe(true);
    await act(async () => renderer.update(<Harness enabled={false} />));
    await advance(60000);
    expect(attempt).toHaveBeenCalledTimes(5);
    await act(async () => renderer.update(<Harness revision={1} />));
    expect(attempt).toHaveBeenCalledTimes(6);
    for (const delay of [2000, 4000, 8000, 16000, 30000]) {
      await advance(delay);
    }
    expect(attempt).toHaveBeenCalledTimes(11);
    expect(controller.exhausted).toBe(true);
  });
  it('ignores a completion belonging to an older manual restart', async () => {
    let finish!: (outcome: RecoveryOutcome) => void;
    attempt.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finish = resolve;
        }),
    );
    await mount();
    await advance(2000);
    await act(async () => controller.restart());
    await act(async () => finish('attempted'));
    await advance(2000);
    expect(attempt).toHaveBeenCalledTimes(2);
    await advance(4000);
    expect(attempt).toHaveBeenCalledTimes(3);
  });
  it('cancels scheduled work on resolution and ignores late completions after unmount', async () => {
    await mount();
    await act(async () => renderer.update(<Harness pending={false} />));
    await advance(60000);
    expect(attempt).not.toHaveBeenCalled();
    let finish!: (outcome: RecoveryOutcome) => void;
    attempt.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finish = resolve;
        }),
    );
    await act(async () => renderer.update(<Harness />));
    await advance(2000);
    await act(async () => renderer.unmount());
    await act(async () => finish('attempted'));
    await advance(60000);
    expect(attempt).toHaveBeenCalledTimes(1);
  });
});
