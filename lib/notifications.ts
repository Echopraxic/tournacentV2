import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

// Show alerts and play sound when a notification arrives while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const BUY_IN_REMINDER_ID = 'tournacent-buyin-reminder';
const ENDING_REMINDER_ID = 'tournacent-ending-reminder';

/**
 * Requests push permission and stores the Expo push token in the user's
 * profile row. Safe to call multiple times — re-uses an existing token.
 * Returns the token string, or null if permission was denied or the device
 * is a simulator (simulators don't support push).
 */
export async function registerForPushNotifications(userId: string): Promise<string | null> {
  if (!Device.isDevice) return null;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Tournacent',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  // projectId is required for production push tokens. `eas init` injects it into
  // app.json's extra.eas.projectId (read via expo-constants); fall back to the
  // env var, and degrade gracefully in dev if neither is set.
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? process.env.EXPO_PUBLIC_PROJECT_ID;
  const token = (
    await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)
  ).data;

  await supabase
    .from('profiles')
    .update({ expo_push_token: token })
    .eq('id', userId);

  return token;
}

/**
 * Schedules a local notification 2 hours before the buy-in deadline.
 * Replaces any previously scheduled buy-in reminder.
 */
export async function scheduleBuyInReminder(deadline: Date): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(BUY_IN_REMINDER_ID);
  const triggerDate = new Date(deadline.getTime() - 2 * 60 * 60 * 1000);
  if (triggerDate <= new Date()) return;

  await Notifications.scheduleNotificationAsync({
    identifier: BUY_IN_REMINDER_ID,
    content: {
      title: '💸 Buy-In Deadline Soon',
      body: "2 hours left to complete your buy-in or you'll be removed from the challenge.",
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
    },
  });
}

export async function cancelBuyInReminder(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(BUY_IN_REMINDER_ID);
}

/**
 * Schedules a local "ending tomorrow" notification 24 hours before end_date.
 * Acts as a client-side fallback in case the server-side pg_cron notification
 * doesn't arrive (e.g., user has no push token yet).
 */
export async function scheduleEndingReminder(endDate: Date): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(ENDING_REMINDER_ID);
  const triggerDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);
  if (triggerDate <= new Date()) return;

  await Notifications.scheduleNotificationAsync({
    identifier: ENDING_REMINDER_ID,
    content: {
      title: '⏰ Challenge Ending Tomorrow',
      body: 'Your challenge ends in 24 hours. Complete your remaining tasks to maximize your score!',
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
    },
  });
}

export async function cancelEndingReminder(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(ENDING_REMINDER_ID);
}

/**
 * Fires an immediate local notification celebrating a progress milestone.
 * Called client-side right after a task is completed and the threshold is hit.
 */
export async function showMilestoneNotification(percentage: number): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `${percentage}% Complete! 🎯`,
      body: 'Great progress! Keep going to maximize your score.',
      sound: true,
    },
    trigger: null, // fire immediately
  });
}
