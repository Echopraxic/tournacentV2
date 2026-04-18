import { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';

const SCALE_DOWN = 0.95;
const SPRING_CONFIG = { damping: 15, stiffness: 300 };

/**
 * Attach to any pressable to get a spring scale-down on press-in and
 * spring-back on press-out. Works with TouchableOpacity, Pressable, or
 * a GestureDetector — just spread the returned handlers onto the component.
 *
 * Usage:
 *   const { animatedStyle, onPressIn, onPressOut } = useScalePress();
 *   <Animated.View style={animatedStyle}>
 *     <Pressable onPressIn={onPressIn} onPressOut={onPressOut} ... />
 *   </Animated.View>
 */
export function useScalePress(scaleTarget = SCALE_DOWN) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const onPressIn = () => {
    scale.value = withSpring(scaleTarget, SPRING_CONFIG);
  };

  const onPressOut = () => {
    scale.value = withSpring(1, SPRING_CONFIG);
  };

  return { animatedStyle, onPressIn, onPressOut };
}
