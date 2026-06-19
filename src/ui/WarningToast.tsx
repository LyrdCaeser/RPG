import { useEffect } from "react";
import { useGameStore } from "../store/useGameStore";

export function WarningToast() {
  const warnings = useGameStore((state) => state.warnings);
  const notices = useGameStore((state) => state.notices);
  const dismissWarning = useGameStore((state) => state.dismissWarning);
  const dismissNotice = useGameStore((state) => state.dismissNotice);

  useEffect(() => {
    if (warnings.length === 0) return;
    const warning = warnings[0];
    const timeoutId = window.setTimeout(() => dismissWarning(warning), 4500);
    return () => window.clearTimeout(timeoutId);
  }, [dismissWarning, warnings]);

  useEffect(() => {
    if (notices.length === 0) return;
    const notice = notices[0];
    const timeoutId = window.setTimeout(() => dismissNotice(notice), 3500);
    return () => window.clearTimeout(timeoutId);
  }, [dismissNotice, notices]);

  if (warnings.length === 0 && notices.length === 0) return null;

  return (
    <aside className="warnings" aria-label="Thông báo">
      {notices.map((notice) => (
        <button key={notice} type="button" data-kind="notice" onClick={() => dismissNotice(notice)}>
          {notice}
        </button>
      ))}
      {warnings.map((warning) => (
        <button key={warning} type="button" data-kind="warning" onClick={() => dismissWarning(warning)}>
          {warning}
        </button>
      ))}
    </aside>
  );
}
