import { useEffect, useRef } from 'react'
import { useNotificationStore, type NotificationKind } from '../store/notificationSlice'

const ICONS: Record<NotificationKind, string> = {
  error: '⚠',
  warning: '⚠',
  info: 'ℹ',
  success: '✓',
}

/**
 * Modal for messages the user must acknowledge.
 *
 * The status line in the ribbon's top-right corner is easy to miss, so a refused
 * action reported only there looks like nothing happened at all. This puts the
 * reason in front of the user instead.
 */
export function NotificationDialog() {
  const notification = useNotificationStore((s) => s.notification)
  const dismiss = useNotificationStore((s) => s.dismissNotification)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!notification) return

    buttonRef.current?.focus()

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault()
        e.stopPropagation()
        dismiss()
      }
    }
    // Capture phase: the grid canvas also listens for keydown on window, and Escape
    // there would otherwise reach it while this modal is up.
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [notification, dismiss])

  if (!notification) return null

  return (
    <div className="modal-backdrop notification-backdrop" onClick={dismiss}>
      <div
        className={`modal-window notification-dialog ${notification.kind}`}
        role="alertdialog"
        aria-labelledby="notification-title"
        aria-describedby="notification-message"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3 id="notification-title">
            <span className="notification-icon" aria-hidden="true">
              {ICONS[notification.kind]}
            </span>
            {notification.title}
          </h3>
          <button className="modal-close-btn" onClick={dismiss} aria-label="关闭">
            ✕
          </button>
        </div>

        <div className="dialog-body">
          <p id="notification-message" className="notification-message">
            {notification.message}
          </p>
        </div>

        <div className="modal-actions">
          <button ref={buttonRef} type="button" className="dialog-btn primary" onClick={dismiss}>
            确定
          </button>
        </div>
      </div>
    </div>
  )
}
