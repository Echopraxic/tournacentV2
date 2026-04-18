import { View, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { tokens } from '@/constants/tokens';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

/**
 * Themed surface container. Background and shadow adapt to the active color mode.
 * Drop-in replacement for any `<View style={styles.card}>` pattern in the app.
 */
export function Card({ children, style }: CardProps) {
  const { theme } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.surface }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: tokens.radius.md,
    padding: tokens.spacing[3], // 16
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
});
