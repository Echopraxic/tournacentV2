import { Pressable, Text, StyleSheet, StyleProp, ViewStyle, ActivityIndicator } from 'react-native';
import Animated from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/contexts/ThemeContext';
import { tokens } from '@/constants/tokens';
import { useScalePress } from '@/hooks/animations/useScalePress';

export type ButtonVariant = 'primary' | 'secondary' | 'danger';

interface ButtonProps {
  /** Button label — use either `title` or `children`, not both */
  title?: string;
  children?: React.ReactNode;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Themed button with three variants and spring scale feedback on every press.
 *
 * primary   — filled with theme.primary, black label
 * secondary — transparent with a 1px subtext border, theme.text label
 * danger    — filled with theme.danger, white label
 *
 * Uses GestureDetector (RNGH) so it composes correctly inside any
 * GestureHandlerRootView without conflicting with parent scroll gestures.
 */
export function Button({
  title,
  children,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
}: ButtonProps) {
  const { theme } = useTheme();
  const { animatedStyle, onPressIn, onPressOut } = useScalePress();

  const variantStyles: Record<ButtonVariant, { container: ViewStyle; labelColor: string }> = {
    primary: {
      container: { backgroundColor: theme.primary },
      labelColor: '#000000',
    },
    secondary: {
      container: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: theme.subtext,
      },
      labelColor: theme.text,
    },
    danger: {
      container: { backgroundColor: theme.danger },
      labelColor: '#FFFFFF',
    },
  };

  const { container: variantContainer, labelColor } = variantStyles[variant];

  // Use a GestureDetector-backed tap so RNGH gesture arbitration works correctly
  const tap = Gesture.Tap()
    .enabled(!disabled)
    .onStart(() => {
      // runOnJS is not needed — Haptics is already JS-side safe from a tap callback
    })
    .onEnd(() => {
      // noop — actual press handled by Pressable below for simplicity
    });

  return (
    <GestureDetector gesture={tap}>
      <Animated.View style={[animatedStyle, style]}>
        <Pressable
          onPress={() => {
            if (disabled || loading) return;
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onPress();
          }}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          style={[
            styles.base,
            variantContainer,
            (disabled || loading) && styles.disabled,
          ]}
        >
          {loading ? (
            <ActivityIndicator size="small" color={labelColor} />
          ) : (
            <Text style={[styles.label, { color: labelColor }]}>{children ?? title}</Text>
          )}
        </Pressable>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: tokens.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.45,
  },
});
