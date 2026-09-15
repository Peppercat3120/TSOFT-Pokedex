/**
 * @format
 */

import { NavigationContainer } from '@react-navigation/native';
import { StatusBar, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from './src/presentation/navigation/RootNavigator';
import { FetchPokemonRemoteDataSource } from './src/data/datasources/PokemonRemoteDataSource';
import { AsyncStoragePokemonLocalDataSource } from './src/data/datasources/PokemonLocalDataSource';
import { CachedPokemonRepository } from './src/data/repositories/CachedPokemonRepository';
import { GetPokemonPage } from './src/domain/usecases/GetPokemonPage';
import { PokemonListProvider } from './src/presentation/context/PokemonListContext';
import type { PokemonPageUseCase } from './src/presentation/context/PokemonListContext';
import { GetPokemonById } from './src/domain/usecases/GetPokemonById';
import { PokemonDetailProvider } from './src/presentation/context/PokemonDetailContext';
import type { PokemonDetailUseCase } from './src/presentation/context/PokemonDetailContext';

const defaultRepository = new CachedPokemonRepository(
  new FetchPokemonRemoteDataSource(),
  new AsyncStoragePokemonLocalDataSource(),
);
const defaultUseCase = new GetPokemonPage(defaultRepository);
const defaultDetailUseCase = new GetPokemonById(defaultRepository);

function App({
  pokemonPageUseCase = defaultUseCase,
  pokemonDetailUseCase = defaultDetailUseCase,
}: {
  readonly pokemonPageUseCase?: PokemonPageUseCase;
  readonly pokemonDetailUseCase?: PokemonDetailUseCase;
}) {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <PokemonListProvider useCase={pokemonPageUseCase}>
        <PokemonDetailProvider useCase={pokemonDetailUseCase}>
          <NavigationContainer>
            <RootNavigator />
          </NavigationContainer>
        </PokemonDetailProvider>
      </PokemonListProvider>
    </SafeAreaProvider>
  );
}

export default App;
