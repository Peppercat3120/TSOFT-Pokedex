import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {PokemonDetailScreen} from '../screens/PokemonDetailScreen';
import {PokemonListScreen} from '../screens/PokemonListScreen';
import type {RootStackParamList} from './RootStackParamList';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <Stack.Navigator initialRouteName="PokemonList">
      <Stack.Screen
        component={PokemonListScreen}
        name="PokemonList"
        options={{title: 'Pokédex'}}
      />
      <Stack.Screen
        component={PokemonDetailScreen}
        name="PokemonDetail"
        options={{title: 'Pokémon Details'}}
      />
    </Stack.Navigator>
  );
}
