import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useTheme } from '@/contexts/ThemeContext';

interface ProgressBarProps {
  /** 0.0 → 1.0 */
  progress: number;
  height?: number;
  trackColor?: string;
}

/**
 * Animated horizontal progress bar.
 * Fill color comes from theme.primary. Animates with withTiming on every
 * `progress` change so refreshes (pull-to-refresh, new data) feel smooth.
 */
export function ProgressBar({ progress, height = 8, trackColor }: ProgressBarProps) {
  const { theme } = useTheme();
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = withTiming(Math.min(Math.max(progress, 0), 1), {
      duration: 500,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${width.value * 100}%`,
  }));

  return (
    <View
      style={[
        styles.track,
        {
          height,
          backgroundColor: trackColor ?? '#E5E7EB',
        },
      ]}
    >
      <Animated.View
        style={[
          styles.fill,
          { height, backgroundColor: theme.primary },
          fillStyle,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    borderRadius: 999,
    overflow: 'hidden',
    width: '100%',
  },
  fill: {
    borderRadius: 999,
  },
});
