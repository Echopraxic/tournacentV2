import { useSharedValue, useAnimatedStyle, withSpring, runOnJS } from 'react-native-reanimated';
import { Gesture } from 'react-native-gesture-handler';
import { Dimensions } from 'react-native';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SPRING_CONFIG = { damping: 20, stiffness: 200 };
const SNAP_SPRING = { damping: 15, stiffness: 120 };

/**
 * Horizontal swipe gesture using RNGH Pan gesture + Reanimated.
 *
 * - Swipe right beyond `threshold` (default 40% of screen width) → calls `onAction`,
 *   then snaps the card off-screen right and resets.
 * - Release below threshold → springs back to center.
 * - `direction: 'right'` (default) for complete-on-swipe-right.
 *
 * Returns:
 *   `gesture`       — attach to <GestureDetector gesture={gesture}>
 *   `animatedStyle` — apply to the card's Animated.View
 *   `underlayStyle` — apply to the revealed action layer (opacity driven by progress)
 *
 * Usage:
 *   const { gesture, animatedStyle, underlayStyle } = useSwipeAction({
 *     onAction: () => openCompleteModal(),
 *   });
 *   <GestureDetector gesture={gesture}>
 *     <Animated.View style={[styles.card, animatedStyle]}>
 *       <Animated.View style={[styles.underlay, underlayStyle]} />
 *       {children}
 *     </Animated.View>
 *   </GestureDetector>
 */
export function useSwipeAction({
  onAction,
  threshold = SCREEN_WIDTH * 0.4,
  disabled = false,
}: {
  onAction: () => void;
  threshold?: number;
  disabled?: boolean;
}) {
  const translateX = useSharedValue(0);
  const progress = useSharedValue(0); // 0 → 1 as swipe reaches threshold

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const underlayStyle = useAnimatedStyle(() => ({
    opacity: Math.min(progress.value, 1),
  }));

  const gesture = Gesture.Pan()
    .enabled(!disabled)
    .activeOffsetX(10)           // only activate after 10px horizontal movement
    .failOffsetY([-20, 20])      // cancel if vertical movement exceeds ±20px
    .onUpdate((e) => {
      // Only allow rightward swipe
      if (e.translationX < 0) return;
      translateX.value = e.translationX;
      progress.value = e.translationX / threshold;
    })
    .onEnd((e) => {
      if (e.translationX >= threshold) {
        // Past threshold — snap off and trigger action
        translateX.value = withSpring(SCREEN_WIDTH, SNAP_SPRING, () => {
          translateX.value = 0;
          progress.value = 0;
        });
        runOnJS(onAction)();
      } else {
        // Below threshold — spring back
        translateX.value = withSpring(0, SPRING_CONFIG);
        progress.value = withSpring(0, SPRING_CONFIG);
      }
    });

  return { gesture, animatedStyle, underlayStyle };
}
