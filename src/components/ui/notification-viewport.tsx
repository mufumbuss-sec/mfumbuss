"use client";

import { useSyncExternalStore } from "react";
import { AlertCircle, CheckCircle2, X } from "lucide-react";
import {
  dismissNotification,
  getNotifications,
  subscribeToNotifications,
  type AppNotification,
} from "@/lib/notifications";

const EMPTY_NOTIFICATIONS: AppNotification[] = [];

export function NotificationViewport() {
  const notifications = useSyncExternalStore(
    subscribeToNotifications,
    getNotifications,
    () => EMPTY_NOTIFICATIONS,
  );

  return (
    <div
      className="pointer-events-none fixed inset-x-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[100] flex flex-col items-end gap-3 sm:inset-x-auto sm:right-5 sm:top-5"
      aria-live="polite"
      aria-relevant="additions"
    >
      {notifications.map((notification) => {
        const isSuccess = notification.type === "success";
        const Icon = isSuccess ? CheckCircle2 : AlertCircle;

        return (
          <div
            key={notification.id}
            role={isSuccess ? "status" : "alert"}
            className={`pointer-events-auto relative w-full max-w-sm overflow-hidden rounded-2xl border bg-white p-4 pr-12 shadow-xl shadow-slate-900/10 ${
              isSuccess ? "border-emerald-200" : "border-rose-200"
            }`}
          >
            <div className="flex items-start gap-3">
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                  isSuccess
                    ? "bg-emerald-50 text-emerald-600"
                    : "bg-rose-50 text-rose-600"
                }`}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <p className="pt-1.5 text-sm font-medium leading-5 text-slate-800">
                {notification.message}
              </p>
            </div>
            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => dismissNotification(notification.id)}
              className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <X className="h-4 w-4" />
            </button>
            <span
              aria-hidden="true"
              className={`notification-progress absolute inset-x-0 bottom-0 h-1 origin-left ${
                isSuccess ? "bg-emerald-500" : "bg-rose-500"
              }`}
            />
          </div>
        );
      })}
    </div>
  );
}
