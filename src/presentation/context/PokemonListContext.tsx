import { createContext, useContext } from 'react';
import type { PropsWithChildren } from 'react';
import type { GetPokemonPage } from '../../domain/usecases/GetPokemonPage';

export type PokemonPageUseCase = Pick<GetPokemonPage, 'execute'>;

const PokemonListContext = createContext<PokemonPageUseCase | null>(null);

export function PokemonListProvider({
  useCase,
  children,
}: PropsWithChildren<{ readonly useCase: PokemonPageUseCase }>) {
  return (
    <PokemonListContext.Provider value={useCase}>
      {children}
    </PokemonListContext.Provider>
  );
}

export function usePokemonPageUseCase(): PokemonPageUseCase {
  const useCase = useContext(PokemonListContext);
  if (useCase === null) {
    throw new Error('PokemonListProvider is required');
  }
  return useCase;
}
