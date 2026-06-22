/**
 * GuardrailToast.tsx
 *
 * Floating toast notification that appears over the video area when a
 * guardrail is violated. Auto-dismisses after a timeout or can be
 * closed manually. Only visible while a violation is active.
 *
 * Consumed by: InterviewScreen
 */

import { useEffect, useState, useCallback } from "react";

interface GuardrailToastProps {
  message: string | null;
  onDismiss: () => void;
  duration?: number;
}

const ALERT_ICON = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="var(--color-destructive)"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const CLOSE_ICON = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export function GuardrailToast({
  message,
  onDismiss,
  duration = 5000,
}: GuardrailToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!message) {
      setVisible(false);
      return;
    }

    setVisible(true);
    const timer = setTimeout(() => {
      setVisible(false);
      onDismiss();
    }, duration);

    return () => clearTimeout(timer);
  }, [message, duration, onDismiss]);

  const handleClose = useCallback(() => {
    setVisible(false);
    onDismiss();
  }, [onDismiss]);

  if (!message || !visible) return null;

  return (
    <div className="guardrail-toast" role="alert">
      <div className="guardrail-toast-content">
        {ALERT_ICON}
        <span className="guardrail-toast-message">{message}</span>
      </div>
      <button
        className="guardrail-toast-close"
        onClick={handleClose}
        aria-label="Dismiss"
      >
        {CLOSE_ICON}
      </button>
    </div>
  );
}
