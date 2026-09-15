import {GetPokemonById} from '../../src/domain/usecases/GetPokemonById';
import {GetPokemonPage} from '../../src/domain/usecases/GetPokemonPage';
import {InvalidArgumentError} from '../../src/domain/errors/PokemonErrors';
import type {PokemonRepository} from '../../src/domain/repositories/PokemonRepository';

function repositoryMock() {
  return {
    getPokemonPage: jest.fn(),
    getPokemonById: jest.fn(),
  } satisfies PokemonRepository;
}

describe('Pokémon use cases', () => {
  it('applies default pagination', () => {
    const repository = repositoryMock();
    const useCase = new GetPokemonPage(repository);

    useCase.execute();

    expect(repository.getPokemonPage).toHaveBeenCalledWith({offset: 0, limit: 20});
  });

  it.each([
    {offset: -1, limit: 20},
    {offset: 0.5, limit: 20},
    {offset: 0, limit: 0},
  ])('rejects invalid pagination %#', request => {
    const useCase = new GetPokemonPage(repositoryMock());

    expect(() => useCase.execute(request)).toThrow(InvalidArgumentError);
  });

  it.each([0, -1, 1.5])('rejects invalid Pokémon id %s', id => {
    const useCase = new GetPokemonById(repositoryMock());

    expect(() => useCase.execute(id)).toThrow(InvalidArgumentError);
  });
});
