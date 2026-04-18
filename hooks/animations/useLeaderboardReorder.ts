import { useEffect, useRef } from 'react';
import {
  makeMutable,
  withSpring,
  withSequence,
  SharedValue,
} from 'react-native-reanimated';

const ROW_HEIGHT = 80; // approximate height of one participant card + gap
const SPRING_CONFIG = { damping: 18, stiffness: 180 };
const PULSE_CONFIG  = { damping: 10, stiffness: 400 };

/**
 * Tracks rank-order changes between renders and drives per-row translate/scale
 * animations. Uses `makeMutable` (not a hook) to create shared values on-demand
 * inside the loop — safe because it doesn't go through React's hook queue.
 *
 * Returns a map keyed by user_id containing raw SharedValues:
 *   { translateY, rankScale }
 *
 * Consume them inside an `AnimatedParticipantRow` subcomponent that calls
 * `useAnimatedStyle` at its own top level (not in a loop).
 */
export function useLeaderboardReorder(
  participants: Array<{ user_id: string; rank: number }>
) {
  // makeMutable is NOT a hook — safe to call inside a loop
  const translateYMap = useRef<Record<string, SharedValue<number>>>({});
  const rankScaleMap  = useRef<Record<string, SharedValue<number>>>({});
  const prevIndexMap  = useRef<Record<string, number>>({});

  for (const p of participants) {
    if (!translateYMap.current[p.user_id]) {
      translateYMap.current[p.user_id] = makeMutable(0);
    }
    if (!rankScaleMap.current[p.user_id]) {
      rankScaleMap.current[p.user_id] = makeMutable(1);
    }
  }

  useEffect(() => {
    participants.forEach((p, currentIndex) => {
      const prev = prevIndexMap.current[p.user_id];

      if (prev !== undefined && prev !== currentIndex) {
        const deltaRows = prev - currentIndex; // positive = moved up
        const ty = translateYMap.current[p.user_id];
        const rs = rankScaleMap.current[p.user_id];

        if (ty && rs) {
          // Snap to old visual position then spring to new position (0)
          ty.value = deltaRows * ROW_HEIGHT;
          ty.value = withSpring(0, SPRING_CONFIG);

          rs.value = withSequence(
            withSpring(1.35, PULSE_CONFIG),
            withSpring(1,    PULSE_CONFIG)
          );
        }
      }

      prevIndexMap.current[p.user_id] = currentIndex;
    });
  }, [participants]);

  const result: Record<string, {
    translateY: SharedValue<number>;
    rankScale: SharedValue<number>;
  }> = {};

  for (const p of participants) {
    result[p.user_id] = {
      translateY: translateYMap.current[p.user_id],
      rankScale:  rankScaleMap.current[p.user_id],
    };
  }

  return result;
}
