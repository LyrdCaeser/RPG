import { useEffect, useState } from "react";
import { getAdminAuditLogs } from "../../api/client";
import type { AdminAuditLog } from "../../data/types";
import { useGameStore } from "../../store/useGameStore";

export function AdminAuditLogsPanel() {
  const addWarning = useGameStore((state) => state.addWarning);
  const [logs, setLogs] = useState<AdminAuditLog[]>([]);
  const [busy, setBusy] = useState(false);

  const loadLogs = () => {
    setBusy(true);
    void getAdminAuditLogs()
      .then((response) => setLogs(response.logs))
      .catch(() => addWarning("Admin audit log load failed."))
      .finally(() => setBusy(false));
  };

  useEffect(loadLogs, []);

  return (
    <div className="admin-tool">
      <button type="button" onClick={loadLogs} disabled={busy}>
        Refresh
      </button>
      <div className="admin-table">
        {logs.map((log) => (
          <article key={log.id}>
            <strong>{log.action}</strong>
            <span>{new Date(log.createdAt).toLocaleString()}</span>
            <span>
              {log.targetType ?? "system"} {log.targetId ?? ""}
            </span>
            <code>{JSON.stringify(log.metadata)}</code>
          </article>
        ))}
      </div>
    </div>
  );
}
