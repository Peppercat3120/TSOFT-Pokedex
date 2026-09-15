import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import type { PokemonListState } from '../../src/presentation/hooks/usePokemonList';
import { usePokemonList } from '../../src/presentation/hooks/usePokemonList';
import { PokemonListProvider } from '../../src/presentation/context/PokemonListContext';
import type { PokemonPageUseCase } from '../../src/presentation/context/PokemonListContext';
import { mapPokemonListDto } from '../../src/data/mappers/PokemonMapper';
import {
  HttpError,
  InvalidPayloadError,
  NetworkError,
} from '../../src/domain/errors/PokemonErrors';
import type { RepositoryResult } from '../../src/domain/repositories/PokemonRepository';
import type { PokemonPage } from '../../src/domain/entities/Pokemon';
import type { PokemonListDto } from '../../src/data/dtos/PokemonDtos';
import {
  firstPageFixture,
  secondPageFixture,
  finalPageFixture,
  listPageFixture,
} from '../data/fixtures';

function result(
  dto: PokemonListDto,
  isStale = false,
): RepositoryResult<PokemonPage> {
  return {
    data: mapPokemonListDto(dto),
    source: isStale ? 'cache' : 'remote',
    isStale,
    cachedAt: 1,
  };
}

describe('usePokemonList', () => {
  let controller: ReturnType<typeof usePokemonList>;
  let renderer: ReactTestRenderer.ReactTestRenderer;
  let execute: jest.MockedFunction<PokemonPageUseCase['execute']>;
  function Harness() {
    controller = usePokemonList();
    return null;
  }
  async function mount() {
    await act(async () => {
      renderer = ReactTestRenderer.create(
        <PokemonListProvider useCase={{ execute }}>
          <Harness />
        </PokemonListProvider>,
      );
    });
  }
  function ready() {
    expect(controller.state.status).toBe('ready');
    return controller.state as Extract<PokemonListState, { status: 'ready' }>;
  }
  beforeEach(() => {
    execute = jest.fn().mockResolvedValue(result(firstPageFixture));
  });
  afterEach(async () => {
    if (renderer) {
      await act(async () => renderer.unmount());
    }
  });

  it('refreshes stale pages in place and clears warnings only after all pages recover', async () => {
    execute
      .mockResolvedValueOnce(result(firstPageFixture, true))
      .mockResolvedValueOnce(result(secondPageFixture, true));
    await mount();
    await act(async () => controller.loadNextPage());
    execute
      .mockResolvedValueOnce(result(firstPageFixture))
      .mockResolvedValueOnce(result(secondPageFixture, true));
    await act(async () => {
      await controller.refresh();
    });
    expect(ready().items).toHaveLength(40);
    expect(ready().hasStaleData).toBe(true);
    expect(ready().nextPage?.offset).toBe(40);
    execute
      .mockResolvedValueOnce(result(firstPageFixture))
      .mockResolvedValueOnce(result(secondPageFixture));
    await act(async () => {
      await controller.refresh();
    });
    expect(ready().hasStaleData).toBe(false);
    expect(ready().items).toHaveLength(40);
  });
  it('recovers image-only failures without a JSON request', async () => {
    jest.useFakeTimers();
    try {
      await mount();
      await act(async () => controller.reportImageFailure('image', true));
      await act(async () => {
        jest.advanceTimersByTime(2000);
      });
      expect(controller.imageRetryGeneration).toBeGreaterThan(0);
      expect(execute).toHaveBeenCalledTimes(1);
      await act(async () => controller.reportImageFailure('image', false));
      await act(async () => {
        jest.advanceTimersByTime(60000);
      });
      expect(execute).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });
  it('automatically refreshes stale pages before retrying the failed cursor', async () => {
    jest.useFakeTimers();
    try {
      execute
        .mockResolvedValueOnce(result(firstPageFixture, true))
        .mockRejectedValueOnce(new NetworkError('offline'));
      await mount();
      await act(async () => controller.loadNextPage());
      execute
        .mockResolvedValueOnce(result(firstPageFixture))
        .mockResolvedValueOnce(result(secondPageFixture));
      await act(async () => {
        jest.advanceTimersByTime(2000);
      });
      expect(ready().items).toHaveLength(40);
      expect(ready().hasStaleData).toBe(false);
      expect(execute.mock.calls.slice(2)).toEqual([
        [{ offset: 0, limit: 20 }, { policy: 'network-first' }],
        [{ offset: 20, limit: 20 }, { policy: 'network-first' }],
      ]);
    } finally {
      jest.useRealTimers();
    }
  });
  it('coalesces refresh requests arriving during pagination and preserves visible rows', async () => {
    await mount();
    let resolve!: (value: RepositoryResult<PokemonPage>) => void;
    execute.mockImplementationOnce(
      () =>
        new Promise(done => {
          resolve = done;
        }),
    );
    await act(async () => controller.loadNextPage());
    await act(async () => {
      await controller.refresh();
      await controller.refresh();
    });
    expect(execute).toHaveBeenCalledTimes(2);
    expect(ready().items).toHaveLength(20);
    execute
      .mockResolvedValueOnce(result(firstPageFixture))
      .mockResolvedValueOnce(result(secondPageFixture));
    await act(async () => resolve(result(secondPageFixture)));
    expect(execute).toHaveBeenCalledTimes(4);
    expect(ready().items).toHaveLength(40);
  });
  it.each([
    new HttpError(429),
    new HttpError(403),
    new InvalidPayloadError('invalid'),
  ])('does not retry a data error during image recovery: %s', async error => {
    jest.useFakeTimers();
    try {
      await mount();
      execute.mockRejectedValueOnce(error);
      await act(async () => controller.loadNextPage());
      await act(async () => controller.reportImageFailure('image', true));
      for (const delay of [2000, 4000, 8000, 16000, 30000]) {
        await act(async () => {
          jest.advanceTimersByTime(delay);
        });
      }
      expect(execute).toHaveBeenCalledTimes(2);
      expect(controller.recoveryExhausted).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });
  it('footer retry refreshes stale rows before loading the failed cursor', async () => {
    execute
      .mockResolvedValueOnce(result(firstPageFixture, true))
      .mockRejectedValueOnce(new HttpError(429));
    await mount();
    await act(async () => controller.loadNextPage());
    execute
      .mockResolvedValueOnce(result(firstPageFixture))
      .mockResolvedValueOnce(result(secondPageFixture));
    await act(async () => controller.retryNextPage());
    expect(ready().items).toHaveLength(40);
    expect(ready().hasStaleData).toBe(false);
    expect(execute.mock.calls.slice(2)).toEqual([
      [{ offset: 0, limit: 20 }, { policy: 'network-first' }],
      [{ offset: 20, limit: 20 }, { policy: 'network-first' }],
    ]);
  });
  it.each(['empty', 'duplicate'])(
    'keeps a %s page stopped through refresh',
    async kind => {
      const stopped = {
        ...secondPageFixture,
        results: kind === 'empty' ? [] : firstPageFixture.results,
      };
      await mount();
      execute.mockResolvedValueOnce(result(stopped));
      await act(async () => controller.loadNextPage());
      expect(ready().nextPage).toBeNull();
      execute
        .mockResolvedValueOnce(result(firstPageFixture))
        .mockResolvedValueOnce(result(stopped));
      await act(async () => {
        await controller.refresh();
      });
      expect(ready().nextPage).toBeNull();
      expect(ready().items).toHaveLength(20);
      const calls = execute.mock.calls.length;
      await act(async () => controller.loadNextPage());
      expect(execute).toHaveBeenCalledTimes(calls);
      execute
        .mockResolvedValueOnce(result(firstPageFixture))
        .mockResolvedValueOnce(result(secondPageFixture));
      await act(async () => {
        await controller.refresh();
      });
      expect(ready().nextPage).toEqual({ offset: 40, limit: 20 });
      expect(ready().items).toHaveLength(40);
    },
  );
  it('shows the empty state when a refreshed first page becomes empty', async () => {
    await mount();
    execute.mockResolvedValueOnce(result({ ...firstPageFixture, results: [] }));
    await act(async () => {
      await controller.refresh();
    });
    expect(controller.state.status).toBe('empty');
    expect(controller.refreshing).toBe(false);
    execute.mockResolvedValueOnce(result(firstPageFixture));
    await act(async () => controller.retryInitial());
    expect(ready().items).toHaveLength(20);
  });
  it('keeps images recovering during a locked pagination request', async () => {
    jest.useFakeTimers();
    try {
      await mount();
      let finish!: (value: RepositoryResult<PokemonPage>) => void;
      execute.mockImplementationOnce(
        () =>
          new Promise(resolve => {
            finish = resolve;
          }),
      );
      await act(async () => controller.loadNextPage());
      await act(async () => controller.reportImageFailure('image', true));
      await act(async () => {
        jest.advanceTimersByTime(2000);
      });
      expect(controller.imageRetryGeneration).toBe(1);
      expect(execute).toHaveBeenCalledTimes(2);
      await act(async () => finish(result(secondPageFixture)));
    } finally {
      jest.useRealTimers();
    }
  });

  it('loads and appends 20 at a time, preserves rows, and stops on a final partial page', async () => {
    execute
      .mockResolvedValueOnce(result(firstPageFixture))
      .mockResolvedValueOnce(result(secondPageFixture))
      .mockResolvedValueOnce(result(finalPageFixture));
    await mount();
    const first = ready().items[0];
    expect(ready().items).toHaveLength(20);
    await act(async () => controller.loadNextPage());
    expect(ready().items).toHaveLength(40);
    expect(ready().items[0]).toBe(first);
    await act(async () => controller.loadNextPage());
    expect(ready().items).toHaveLength(43);
    expect(ready().nextPage).toBeNull();
    await act(async () => controller.loadNextPage());
    expect(execute.mock.calls).toEqual([
      [{ offset: 0, limit: 20 }],
      [{ offset: 20, limit: 20 }],
      [{ offset: 40, limit: 20 }],
    ]);
  });

  it('locks immediately and preserves visible rows while loading', async () => {
    await mount();
    let resolve!: (value: RepositoryResult<PokemonPage>) => void;
    execute.mockImplementationOnce(
      () =>
        new Promise(done => {
          resolve = done;
        }),
    );
    await act(async () => {
      controller.loadNextPage();
      controller.loadNextPage();
    });
    expect(ready().items).toHaveLength(20);
    expect(ready().loadMore.status).toBe('loading');
    expect(execute).toHaveBeenCalledTimes(2);
    await act(async () => resolve(result(secondPageFixture)));
    expect(ready().items).toHaveLength(40);
  });

  it('retains a failed cursor, blocks automatic retries, and retries explicitly once', async () => {
    await mount();
    execute.mockRejectedValueOnce(new NetworkError('offline'));
    await act(async () => controller.loadNextPage());
    expect(ready().items).toHaveLength(20);
    expect(ready().loadMore.status).toBe('error');
    expect(ready().nextPage?.offset).toBe(20);
    await act(async () => controller.loadNextPage());
    expect(execute).toHaveBeenCalledTimes(2);
    execute.mockResolvedValueOnce(result(secondPageFixture));
    await act(async () => {
      controller.retryNextPage();
      controller.retryNextPage();
    });
    expect(ready().items).toHaveLength(40);
    expect(execute.mock.calls[2]).toEqual([
      { offset: 20, limit: 20 },
      { policy: 'network-first' },
    ]);
  });

  it.each([new NetworkError('offline'), new HttpError(503)])(
    'handles initial errors and successful retry: %s',
    async error => {
      execute.mockRejectedValueOnce(error);
      await mount();
      expect(controller.state.status).toBe('error');
      await act(async () => controller.retryInitial());
      expect(ready().items).toHaveLength(20);
    },
  );

  it('blocks retries for permanent initial failures', async () => {
    execute.mockRejectedValueOnce(new HttpError(403));
    await mount();
    expect(controller.state).toMatchObject({
      status: 'error',
      canRetry: false,
    });
    await act(async () => controller.retryInitial());
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('keeps rows and blocks all retries for permanent pagination failures', async () => {
    await mount();
    const items = ready().items;
    execute.mockRejectedValueOnce(new HttpError(400));
    await act(async () => controller.loadNextPage());
    expect(ready().items).toBe(items);
    expect(ready().loadMore).toMatchObject({
      status: 'error',
      canRetry: false,
    });
    await act(async () => {
      controller.retryNextPage();
      controller.loadNextPage();
    });
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it('handles initial loading and ignores responses after unmount', async () => {
    let resolve!: (value: RepositoryResult<PokemonPage>) => void;
    execute.mockImplementationOnce(
      () =>
        new Promise(done => {
          resolve = done;
        }),
    );
    await mount();
    expect(controller.state.status).toBe('loading');
    await act(async () => renderer.unmount());
    await act(async () => resolve(result(firstPageFixture)));
    expect(controller.state.status).toBe('loading');
  });

  it('handles empty initial results and retry', async () => {
    execute.mockResolvedValueOnce(result(listPageFixture(0, 0, null)));
    await mount();
    expect(controller.state.status).toBe('empty');
    await act(async () => controller.retryInitial());
    expect(ready().items).toHaveLength(20);
  });

  it('deduplicates IDs in order, keeping the first instance', async () => {
    await mount();
    execute.mockResolvedValueOnce(
      result({
        ...secondPageFixture,
        results: [firstPageFixture.results[0], ...secondPageFixture.results],
      }),
    );
    await act(async () => controller.loadNextPage());
    expect(ready().items).toHaveLength(40);
    expect(ready().items.map(item => item.id)).toEqual(
      Array.from({ length: 40 }, (_, i) => i + 1),
    );
  });

  it.each([
    listPageFixture(20, 0, 40),
    { ...firstPageFixture, next: secondPageFixture.next },
    { ...secondPageFixture, next: firstPageFixture.next },
  ])('stops empty, duplicate-only, or non-advancing pages', async dto => {
    await mount();
    execute.mockResolvedValueOnce(result(dto));
    await act(async () => controller.loadNextPage());
    expect(ready().nextPage).toBeNull();
    await act(async () => controller.loadNextPage());
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it('uses the next offset but always requests limit 20', async () => {
    execute.mockResolvedValueOnce(
      result({
        ...firstPageFixture,
        next: 'https://pokeapi.co/api/v2/pokemon?offset=20&limit=99',
      }),
    );
    await mount();
    await act(async () => controller.loadNextPage());
    expect(execute).toHaveBeenLastCalledWith({ offset: 20, limit: 20 });
  });

  it('retains stale metadata across pages without labeling fresh cache as stale', async () => {
    execute
      .mockResolvedValueOnce({ ...result(firstPageFixture), source: 'cache' })
      .mockResolvedValueOnce(result(secondPageFixture, true))
      .mockResolvedValueOnce(result(finalPageFixture));
    await mount();
    expect(ready().hasStaleData).toBe(false);
    await act(async () => controller.loadNextPage());
    expect(ready().hasStaleData).toBe(true);
    await act(async () => controller.loadNextPage());
    expect(ready().hasStaleData).toBe(true);
  });
});
