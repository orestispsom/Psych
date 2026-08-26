import { useEffect, useState } from "react";

const BMC_URL = "https://buymeacoffee.com/kmivzd3csi";
const SHOW_AFTER_MS = 30 * 60 * 1000; // 30 minutes
const DISMISS_KEY = "psych_support_dismissed";

/**
 * A small, self-contained "buy me a coffee" nudge — deliberately outside the
 * instrument-sheet design system, since it's a personal ask from the author,
 * not part of the study product.
 *
 * Mounted once at the App root (a sibling of AppShell, not inside it), so it
 * survives every route change: navigating between MCQ/oral/SOS/tables never
 * unmounts App itself, only the screen content inside the shell, so the
 * 30-minute timer keeps running and the popup can appear on whatever screen
 * the trainee happens to be on when it fires.
 *
 * "Not again this session" uses sessionStorage, not localStorage — closing
 * it quiets it for this tab until the next visit, not forever.
 */
export default function SupportWidget() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = sessionStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      /* storage unavailable — treat as not dismissed */
    }
    if (dismissed) return undefined;

    const timer = setTimeout(() => setVisible(true), SHOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => {
    setVisible(false);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* best effort — worst case it can pop up again this session */
    }
  };

  if (!visible) return null;

  return (
    <div className="support-widget" role="complementary" aria-label="Στήριξη της εφαρμογής">
      <button
        type="button"
        className="support-widget-close"
        onClick={dismiss}
        aria-label="Κλείσιμο"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>

      <div className="support-widget-body">
        <span className="support-widget-cup" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 9h13a3 3 0 0 1 0 6h-1" />
            <path d="M4 9h12v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V9z" />
            <path d="M8 2c-.5 1 .5 1.5 0 2.5S7 6.5 7.5 7" />
            <path d="M12 2c-.5 1 .5 1.5 0 2.5S11 6.5 11.5 7" />
          </svg>
        </span>
        <span className="support-widget-text">
          <strong>Σ' αρέσει η εφαρμογή;</strong>
          <span>Ένας καφές βοηθάει να συνεχίσει να ενημερώνεται.</span>
        </span>
      </div>

      <a
        className="support-widget-cta"
        href={BMC_URL}
        target="_blank"
        rel="noopener noreferrer"
      >
        Κέρασέ με έναν καφέ
      </a>
    </div>
  );
}
