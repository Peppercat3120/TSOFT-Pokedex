import { createContext, useContext } from 'react';
import type { PropsWithChildren } from 'react';
import type { GetPokemonById } from '../../domain/usecases/GetPokemonById';

export type PokemonDetailUseCase = Pick<GetPokemonById, 'execute'>;
const PokemonDetailContext = createContext<PokemonDetailUseCase | null>(null);

export function PokemonDetailProvider({
  useCase,
  children,
}: PropsWithChildren<{ readonly useCase: PokemonDetailUseCase }>) {
  return (
    <PokemonDetailContext.Provider value={useCase}>
      {children}
    </PokemonDetailContext.Provider>
  );
}

export function usePokemonDetailUseCase(): PokemonDetailUseCase {
  const useCase = useContext(PokemonDetailContext);
  if (useCase === null) {
    throw new Error('PokemonDetailProvider is required');
  }
  return useCase;
}
