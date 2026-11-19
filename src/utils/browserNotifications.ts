export type BrowserNotificationPermission =
  | 'granted'
  | 'denied'
  | 'default'
  | 'unsupported';

const PREF_STORAGE_KEY = 'saforent_owner_notifications_enabled_v1';

export function getBrowserNotificationPermission(): BrowserNotificationPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return window.Notification.permission;
}

export function isOwnerNotificationsEnabled(): boolean {
  try {
    const raw = window.localStorage.getItem(PREF_STORAGE_KEY);
    if (raw === null) return true;
    return raw === 'true';
  } catch {
    return true;
  }
}

export function setOwnerNotificationsEnabled(enabled: boolean): void {
  try {
    window.localStorage.setItem(PREF_STORAGE_KEY, enabled ? 'true' : 'false');
  } catch {
    // Ignore storage errors
  }
}

export async function requestBrowserNotificationPermission(): Promise<BrowserNotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  try {
    const result = await window.Notification.requestPermission();
    if (result === 'granted') {
      setOwnerNotificationsEnabled(true);
    }
    return result;
  } catch {
    return getBrowserNotificationPermission();
  }
}

export interface BrowserNotificationPayload {
  title: string;
  body: string;
  tag: string;
}

export function triggerOwnerBrowserNotification(
  payload: BrowserNotificationPayload
): boolean {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  if (window.Notification.permission !== 'granted' || !isOwnerNotificationsEnabled()) {
    return false;
  }
  try {
    const notification = new window.Notification(payload.title, {
      body: payload.body,
      tag: payload.tag,
    });
    notification.onclick = () => {
      try {
        window.focus();
      } catch {
        // Ignore focus errors in sandboxed iframes
      }
      notification.close();
    };
    return true;
  } catch {
    return false;
  }
}
