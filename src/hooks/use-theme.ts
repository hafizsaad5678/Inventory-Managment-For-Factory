import { useColorScheme } from './use-color-scheme';
import { Colors } from '../constants/theme';

export function useTheme() {
  const scheme = useColorScheme();
  return Colors[scheme === 'dark' ? 'dark' : 'light'];
}
