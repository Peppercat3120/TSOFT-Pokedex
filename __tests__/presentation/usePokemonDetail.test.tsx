import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { PokemonDetailProvider } from '../../src/presentation/context/PokemonDetailContext';
import type { PokemonDetailUseCase } from '../../src/presentation/context/PokemonDetailContext';
import { usePokemonDetail } from '../../src/presentation/hooks/usePokemonDetail';
import { mapPokemonDetailDto } from '../../src/data/mappers/PokemonMapper';
import {
  HttpError,
  InvalidPayloadError,
  NetworkError,
  NotFoundError,
} from '../../src/domain/errors/PokemonErrors';
import { GetPokemonById } from '../../src/domain/usecases/GetPokemonById';
import { pokemonDetailFixture } from '../data/fixtures';

const detail = {
  data: mapPokemonDetailDto(pokemonDetailFixture),
  source: 'remote' as const,
  isStale: false,
  cachedAt: 1,
};

describe('usePokemonDetail', () => {
  let renderer: ReactTestRenderer.ReactTestRenderer;
  let controller: ReturnType<typeof usePokemonDetail>;
  let execute: jest.MockedFunction<PokemonDetailUseCase['execute']>;
  let useCase: PokemonDetailUseCase;
  function Harness({ id }: { readonly id: number }) {
    controller = usePokemonDetail(id);
    return null;
  }
  function tree(id: number) {
    return (
      <PokemonDetailProvider useCase={useCase}>
        <Harness id={id} />
      </PokemonDetailProvider>
    );
  }
  async function mount(id = 1) {
    await act(async () => {
      renderer = ReactTestRenderer.create(tree(id));
    });
  }
  beforeEach(() => {
    execute = jest.fn().mockResolvedValue(detail);
    useCase = { execute };
  });
  afterEach(async () => {
    await act(async () => renderer.unmount());
  });

  it('loads the requested identifier and passes ready data', async () => {
    await mount(25);
    expect(execute).toHaveBeenCalledWith(25);
    expect(controller.state).toEqual({
      status: 'ready',
      pokemon: detail.data,
      isStale: false,
    });
  });

  it('shows loading and ignores a response after unmount', async () => {
    let resolve!: (value: typeof detail) => void;
    execute.mockImplementationOnce(
      () =>
        new Promise(done => {
          resolve = done;
        }),
    );
    await mount();
    expect(controller.state.status).toBe('loading');
    await act(async () => renderer.unmount());
    await act(async () => resolve(detail));
    expect(controller.state.status).toBe('loading');
  });

  it.each([
    new NetworkError('secret'),
    new HttpError(503),
    new HttpError(429),
    new InvalidPayloadError('secret'),
  ])('handles errors and guarded retry: %s', async error => {
    execute.mockRejectedValueOnce(error);
    await mount();
    expect(controller.state.status).toBe('error');
    expect(JSON.stringify(controller.state)).not.toContain('secret');
    let resolve!: (value: typeof detail) => void;
    execute.mockImplementationOnce(
      () =>
        new Promise(done => {
          resolve = done;
        }),
    );
    await act(async () => {
      controller.retry();
      controller.retry();
    });
    expect(execute).toHaveBeenCalledTimes(2);
    expect(controller.state.status).toBe('loading');
    await act(async () => resolve(detail));
    expect(controller.state.status).toBe('ready');
  });

  it.each([new NotFoundError(), new HttpError(404)])(
    'distinguishes not found and does not retry: %s',
    async error => {
      execute.mockRejectedValueOnce(error);
      await mount();
      expect(controller.state.status).toBe('not-found');
      await act(async () => controller.retry());
      expect(execute).toHaveBeenCalledTimes(1);
    },
  );

  it('does not retry a permanent HTTP failure', async () => {
    execute.mockRejectedValueOnce(new HttpError(403));
    await mount();
    expect(controller.state).toMatchObject({
      status: 'error',
      canRetry: false,
    });
    await act(async () => controller.retry());
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it.each([0, -1, 0.5, Number.NaN])(
    'handles invalid ID %s without accessing the repository',
    async id => {
      const getPokemonById = jest.fn();
      useCase = new GetPokemonById({
        getPokemonById,
        getPokemonPage: jest.fn(),
      });
      await mount(id);
      expect(controller.state).toEqual({
        status: 'error',
        message:
          'We couldn’t open this Pokémon. Return to the list and select it again.',
        canRetry: false,
      });
      expect(getPokemonById).not.toHaveBeenCalled();
      await act(async () => controller.retry());
      expect(getPokemonById).not.toHaveBeenCalled();
    },
  );

  it('clears the old profile on ID change and ignores its late response', async () => {
    await mount();
    let resolveOld!: (value: typeof detail) => void;
    let resolveNew!: (value: typeof detail) => void;
    execute
      .mockImplementationOnce(
        () =>
          new Promise(done => {
            resolveOld = done;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise(done => {
            resolveNew = done;
          }),
      );
    await act(async () => renderer.update(tree(2)));
    expect(controller.state.status).toBe('loading');
    await act(async () => renderer.update(tree(3)));
    await act(async () =>
      resolveOld({ ...detail, data: { ...detail.data, id: 2 } }),
    );
    expect(controller.state.status).toBe('loading');
    await act(async () =>
      resolveNew({ ...detail, data: { ...detail.data, id: 3 } }),
    );
    expect(controller.state).toMatchObject({
      status: 'ready',
      pokemon: { id: 3 },
    });
    expect(execute.mock.calls).toEqual([[1], [2], [3]]);
  });

  it.each([false, true])(
    'retains stale metadata %s from cache',
    async isStale => {
      execute.mockResolvedValueOnce({ ...detail, source: 'cache', isStale });
      await mount();
      expect(controller.state).toMatchObject({ status: 'ready', isStale });
    },
  );
});
