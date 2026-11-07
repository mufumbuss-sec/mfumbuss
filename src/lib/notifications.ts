export type NotificationType = "success" | "error";

export type AppNotification = {
  id: number;
  type: NotificationType;
  message: string;
};

const NOTIFICATION_DURATION = 5000;
let notifications: AppNotification[] = [];
let nextId = 0;
const listeners = new Set<() => void>();
const timers = new Map<number, ReturnType<typeof setTimeout>>();

function publish() {
  listeners.forEach((listener) => listener());
}

export function notify(type: NotificationType, message: string) {
  const id = nextId++;
  notifications = [...notifications, { id, type, message }];
  publish();

  timers.set(
    id,
    setTimeout(() => dismissNotification(id), NOTIFICATION_DURATION),
  );
}

export function dismissNotification(id: number) {
  const timer = timers.get(id);
  if (timer !== undefined) clearTimeout(timer);
  timers.delete(id);
  notifications = notifications.filter((notification) => notification.id !== id);
  publish();
}

export function subscribeToNotifications(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getNotifications() {
  return notifications;
}
