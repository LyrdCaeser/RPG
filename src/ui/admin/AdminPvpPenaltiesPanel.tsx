import { useEffect, useMemo, useState } from "react";
import { applyAdminPvpPenalty, getAdminPvpPenalties, liftAdminPvpPenalty } from "../../api/client";
import type { PvPPenalty, PvPPenaltyStatus, PvPPenaltyType } from "../../data/types";
import { useGameStore } from "../../store/useGameStore";
import { notifyAdminPvpModerationRefresh, requestOpenAdminPvpPlayerProfile } from "./adminPvpRefreshEvents";

type PenaltyStatusFilter = "all" | PvPPenaltyStatus;
type PenaltyTypeFilter = "all" | PvPPenaltyType;
type DurationMode = "none" | "expires_at" | "permanent";

interface PenaltyFormState {
  targetPlayerId: string;
  penaltyType: PvPPenaltyType;
  reason: string;
  details: string;
  durationMode: DurationMode;
  expiresAt: string;
}

const statusFilters: PenaltyStatusFilter[] = ["all", "active", "expired", "lifted"];
const typeFilters: PenaltyTypeFilter[] = ["all", "warning", "ranked_suspension", "duel_suspension", "pvp_full_ban", "shop_suspension"];

const emptyPenaltyForm: PenaltyFormState = {
  targetPlayerId: "",
  penaltyType: "warning",
  reason: "",
  details: "",
  durationMode: "none",
  expiresAt: ""
};

export function AdminPvpPenaltiesPanel() {
  const addWarning = useGameStore((state) => state.addWarning);
  const addNotice = useGameStore((state) => state.addNotice);
  const [penalties, setPenalties] = useState<PvPPenalty[]>([]);
  const [statusFilter, setStatusFilter] = useState<PenaltyStatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<PenaltyTypeFilter>("all");
  const [targetFilter, setTargetFilter] = useState("");
  const [form, setForm] = useState<PenaltyFormState>(emptyPenaltyForm);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeFilters = useMemo(
    () => ({
      status: statusFilter === "all" ? undefined : statusFilter,
      penaltyType: typeFilter === "all" ? undefined : typeFilter,
      targetPlayerId: targetFilter.trim() || undefined
    }),
    [statusFilter, targetFilter, typeFilter]
  );

  useEffect(() => {
    void loadPenalties();
  }, [statusFilter, typeFilter]);

  function loadPenalties() {
    setLoading(true);
    setError(null);
    return getAdminPvpPenalties(activeFilters)
      .then((response) => {
        setPenalties(response.penalties);
        setLoaded(true);
      })
      .catch((caught) => {
        const message = adminPvpPenaltyWarning(caught, "PvP penalty refresh failed.");
        setError(message);
        addWarning(message);
      })
      .finally(() => setLoading(false));
  }

  function applyPenalty() {
    const validation = validatePenaltyForm(form);
    if (validation) {
      setError(validation);
      addWarning(validation);
      return;
    }

    setLoading(true);
    setError(null);
    void applyAdminPvpPenalty({
      targetPlayerId: form.targetPlayerId.trim(),
      penaltyType: form.penaltyType,
      reason: form.reason.trim(),
      details: form.details.trim() || undefined,
      expiresAt: form.durationMode === "expires_at" ? new Date(form.expiresAt).toISOString() : undefined,
      permanent: form.durationMode === "permanent" ? true : undefined
    })
      .then((response) => {
        setPenalties(response.penalties);
        setForm(emptyPenaltyForm);
        addNotice("PvP penalty apply succeeded.");
        notifyAdminPvpModerationRefresh();
      })
      .catch((caught) => {
        const message = adminPvpPenaltyWarning(caught, "PvP penalty apply failed.");
        setError(message);
        addWarning(message);
      })
      .finally(() => setLoading(false));
  }

  function liftPenalty(penalty: PvPPenalty) {
    const liftReason = window.prompt("Lift reason");
    if (!liftReason?.trim()) {
      addWarning("Lift reason is required.");
      return;
    }
    setLoading(true);
    setError(null);
    void liftAdminPvpPenalty(penalty.penaltyId, liftReason.trim())
      .then((response) => {
        setPenalties(response.penalties);
        addNotice("PvP penalty lift succeeded.");
        notifyAdminPvpModerationRefresh();
      })
      .catch((caught) => {
        const message = adminPvpPenaltyWarning(caught, "PvP penalty lift failed.");
        setError(message);
        addWarning(message);
      })
      .finally(() => setLoading(false));
  }

  return (
    <div className="admin-pvp-penalties">
      <section className="admin-form">
        <h3>Apply PvP Penalty</h3>
        <div className="admin-form-grid">
          <label>
            Target player ID
            <input
              value={form.targetPlayerId}
              onChange={(event) => setForm((current) => ({ ...current, targetPlayerId: event.target.value }))}
            />
          </label>
          <label>
            Penalty type
            <select
              value={form.penaltyType}
              onChange={(event) => {
                const penaltyType = event.target.value as PvPPenaltyType;
                setForm((current) => ({
                  ...current,
                  penaltyType,
                  durationMode: penaltyType === "warning" ? "none" : current.durationMode === "none" ? "expires_at" : current.durationMode
                }));
              }}
            >
              {typeFilters.filter((type) => type !== "all").map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <label>
            Duration mode
            <select
              value={form.durationMode}
              onChange={(event) => setForm((current) => ({ ...current, durationMode: event.target.value as DurationMode }))}
            >
              <option value="none">warning/no expiry</option>
              <option value="expires_at">expires_at datetime</option>
              <option value="permanent">permanent</option>
            </select>
          </label>
          <label>
            Expires at
            <input
              type="datetime-local"
              value={form.expiresAt}
              disabled={form.durationMode !== "expires_at"}
              onChange={(event) => setForm((current) => ({ ...current, expiresAt: event.target.value }))}
            />
          </label>
          <label>
            Reason
            <input value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} />
          </label>
          <label>
            Details
            <input value={form.details} onChange={(event) => setForm((current) => ({ ...current, details: event.target.value }))} />
          </label>
        </div>
        <div className="admin-row-actions">
          <button type="button" onClick={applyPenalty} disabled={loading || Boolean(validatePenaltyForm(form))}>
            Apply
          </button>
          <button type="button" onClick={() => setForm(emptyPenaltyForm)} disabled={loading}>
            Clear
          </button>
        </div>
      </section>

      <section className="admin-table admin-pvp-penalty-table">
        <div className="admin-table-header">
          <h3>PvP Penalties</h3>
          <button type="button" onClick={loadPenalties} disabled={loading}>
            Refresh
          </button>
        </div>
        <div className="admin-actions">
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as PenaltyStatusFilter)}>
            {statusFilters.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as PenaltyTypeFilter)}>
            {typeFilters.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          <input
            value={targetFilter}
            onChange={(event) => setTargetFilter(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void loadPenalties();
            }}
            aria-label="Filter by target player ID"
          />
          <button type="button" onClick={loadPenalties} disabled={loading}>
            Filter
          </button>
        </div>
        {loading ? <span className="admin-loading">Loading</span> : null}
        {error ? <div className="admin-denied">{error}</div> : null}
        {!loaded ? null : penalties.length === 0 ? <p>No PvP penalties recorded.</p> : null}
        {penalties.map((penalty) => (
          <article key={penalty.penaltyId} data-revoked={penalty.status !== "active"}>
            <strong>{penalty.penaltyType}</strong>
            <span>{penalty.penaltyId}</span>
            <span>{penalty.targetPlayer.displayName}</span>
            <span>{penalty.targetPlayer.playerId}</span>
            <button type="button" onClick={() => requestOpenAdminPvpPlayerProfile(penalty.targetPlayer.playerId)}>
              Open Profile
            </button>
            <span>{penalty.status}</span>
            <span>{penalty.reason}</span>
            <span>{penalty.details || "No details"}</span>
            <span>Starts {formatDate(penalty.startsAt)}</span>
            <span>{penalty.permanent ? "Permanent" : penalty.expiresAt ? `Expires ${formatDate(penalty.expiresAt)}` : "No expiry"}</span>
            <span>Created by {penalty.createdByAdminId}</span>
            <span>Created {formatDate(penalty.createdAt)}</span>
            <span>Updated {formatDate(penalty.updatedAt)}</span>
            <span>{penalty.liftedByAdminId ? `Lifted by ${penalty.liftedByAdminId}` : "Not lifted"}</span>
            <span>{penalty.liftedAt ? `Lifted ${formatDate(penalty.liftedAt)}` : "No lift time"}</span>
            <span>{penalty.liftReason || "No lift reason"}</span>
            <div className="admin-row-actions">
              <button type="button" onClick={() => liftPenalty(penalty)} disabled={loading || penalty.status !== "active"}>
                Lift
              </button>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

function validatePenaltyForm(form: PenaltyFormState) {
  if (!form.targetPlayerId.trim()) return "target_player_id is required.";
  if (!form.reason.trim()) return "Penalty reason is required.";
  if (form.reason.trim().length > 240) return "Penalty reason is too long.";
  if (form.details.length > 2000) return "Penalty details are too long.";
  if (form.penaltyType !== "warning" && form.durationMode === "none") {
    return "Suspensions and bans require expires_at or permanent.";
  }
  if (form.durationMode === "expires_at") {
    const expiresAt = new Date(form.expiresAt);
    if (!Number.isFinite(expiresAt.getTime())) return "expires_at must be a valid datetime.";
    if (expiresAt.getTime() <= Date.now()) return "expires_at must be in the future.";
  }
  return "";
}

function adminPvpPenaltyWarning(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : "";
  const lower = message.toLowerCase();
  if (
    lower.includes("database") ||
    lower.includes("database_url") ||
    lower.includes("econnrefused") ||
    lower.includes("enotfound") ||
    lower.includes("connection terminated") ||
    lower.includes("connection timeout") ||
    lower.includes("timeout expired")
  ) {
    return "database unavailable";
  }
  if (message) return message;
  return fallback;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}
