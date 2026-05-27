import * as Notifications from "expo-notifications";
import * as BackgroundFetch from "expo-background-fetch";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";
import { API_URL } from "@/config/api";

const PENDING_CHECK_TASK = "wib-pending-check";
const CAPTURE_NOTIF_ID = "wib-capture-shortcut";

// Background task: calls API and notifies if there are pending items
TaskManager.defineTask(PENDING_CHECK_TASK, async () => {
  try {
    const res = await fetch(`${API_URL}/api/inbox?status=needs_review`, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return BackgroundFetch.BackgroundFetchResult.NoData;
    const items: unknown[] = await res.json();
    if (Array.isArray(items) && items.length > 0) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "WIB — Pendências",
          body: `${items.length} item${items.length > 1 ? "s" : ""} aguardando revisão na Inbox`,
          data: { screen: "inbox" },
          sound: false,
        },
        trigger: null,
      });
      return BackgroundFetch.BackgroundFetchResult.NewData;
    }
    return BackgroundFetch.BackgroundFetchResult.NoData;
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export async function setupNotifications(): Promise<boolean> {
  if (Platform.OS === "web") return false;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") return false;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowList: true,
    }),
  });

  // Register hourly background check
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(PENDING_CHECK_TASK);
    if (!isRegistered) {
      await BackgroundFetch.registerTaskAsync(PENDING_CHECK_TASK, {
        minimumInterval: 60 * 60, // 1 hour
        stopOnTerminate: false,
        startOnBoot: true,
      });
    }
  } catch {
    // Background fetch may not be available on all devices
  }

  // Schedule repeating hourly local notification as fallback
  await scheduleHourlyReminder();

  return true;
}

export async function scheduleHourlyReminder() {
  // Cancel existing to avoid duplicates
  await Notifications.cancelAllScheduledNotificationsAsync();

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "WIB — Lembrete",
      body: "Verifique suas pendências e tarefas do dia",
      data: { screen: "inbox" },
      sound: false,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 60 * 60, // 1 hour
      repeats: true,
    },
  });
}

export async function cancelHourlyReminder() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function showCaptureShortcut() {
  await Notifications.scheduleNotificationAsync({
    identifier: CAPTURE_NOTIF_ID,
    content: {
      title: "WIB — Capturar",
      body: "Toque para gravar áudio, foto ou documento",
      data: { screen: "captura" },
      sound: false,
      sticky: true,
    },
    trigger: null,
  });
}

export async function hideCaptureShortcut() {
  await Notifications.dismissNotificationAsync(CAPTURE_NOTIF_ID);
}
