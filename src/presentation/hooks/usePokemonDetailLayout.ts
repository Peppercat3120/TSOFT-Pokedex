import { Dimensions, Platform, useWindowDimensions } from 'react-native';

/** Use display size for device classification and window size for layout. */
export function usePokemonDetailLayout(): boolean {
  const { width, height } = useWindowDimensions();
  const screen = Dimensions.get('screen');
  const isTablet =
    Platform.OS === 'ios'
      ? Platform.isPad
      : Platform.OS === 'android' &&
        Math.min(screen.width, screen.height) >= 600;
  return isTablet && width > height;
}
