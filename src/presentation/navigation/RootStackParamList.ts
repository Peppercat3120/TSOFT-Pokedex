import type {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';

export type RootStackParamList = {
  PokemonList: undefined;
  PokemonDetail: {
    pokemonId: number;
  };
};

export type RootStackNavigationProp = NativeStackNavigationProp<RootStackParamList>;

export type PokemonListScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'PokemonList'
>;

export type PokemonDetailScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'PokemonDetail'
>;
