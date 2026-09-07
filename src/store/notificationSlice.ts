import { create } from 'zustand'

export type NotificationKind = 'error' | 'warning' | 'info' | 'success'

export interface Notification {
  kind: NotificationKind
  title: string
  message: string
}

/**
 * A modal message the user has to acknowledge.
 *
 * Separate from dialogSlice on purpose: a notification can be raised while a
 * dialog is open (a validation failure inside one, say), so it must not evict
 * whatever `activeDialog` holds.
 *
 * The status line stays the channel for routine progress; this is for outcomes
 * the user needs to notice — a refusal, or a failure they can act on.
 */
export interface NotificationState {
  notification: Notification | null
  notify: (kind: NotificationKind, title: string, message: string) => void
  notifyError: (message: string, title?: string) => void
  dismissNotification: () => void
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notification: null,

  notify: (kind, title, message) => set({ notification: { kind, title, message } }),
  notifyError: (message, title = '操作未能完成') =>
    set({ notification: { kind: 'error', title, message } }),
  dismissNotification: () => set((s) => (s.notification === null ? s : { notification: null })),
}))
