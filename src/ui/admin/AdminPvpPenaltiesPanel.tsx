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
        const message = adminPvpPenaltyWarning(caught, "Làm mới án phạt đấu trường thất bại.");
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
        addNotice("Đã áp dụng án phạt đấu trường.");
        notifyAdminPvpModerationRefresh();
      })
      .catch((caught) => {
        const message = adminPvpPenaltyWarning(caught, "Áp dụng án phạt đấu trường thất bại.");
        setError(message);
        addWarning(message);
      })
      .finally(() => setLoading(false));
  }

  function liftPenalty(penalty: PvPPenalty) {
    const liftReason = window.prompt("Lý do gỡ án phạt");
    if (!liftReason?.trim()) {
      addWarning("Cần nhập lý do gỡ án phạt.");
      return;
    }
    setLoading(true);
    setError(null);
    void liftAdminPvpPenalty(penalty.penaltyId, liftReason.trim())
      .then((response) => {
        setPenalties(response.penalties);
        addNotice("Đã gỡ án phạt đấu trường.");
        notifyAdminPvpModerationRefresh();
      })
      .catch((caught) => {
        const message = adminPvpPenaltyWarning(caught, "Gỡ án phạt đấu trường thất bại.");
        setError(message);
        addWarning(message);
      })
      .finally(() => setLoading(false));
  }

  return (
    <div className="admin-pvp-penalties">
      <section className="admin-form">
        <h3>Áp dụng án phạt đấu trường</h3>
        <div className="admin-form-grid">
          <label>
            ID người chơi mục tiêu
            <input
              value={form.targetPlayerId}
              onChange={(event) => setForm((current) => ({ ...current, targetPlayerId: event.target.value }))}
            />
          </label>
          <label>
            Loại án phạt
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
                  {formatPenaltyType(type)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Chế độ thời hạn
            <select
              value={form.durationMode}
              onChange={(event) => setForm((current) => ({ ...current, durationMode: event.target.value as DurationMode }))}
            >
              <option value="none">cảnh cáo/không hết hạn</option>
              <option value="expires_at">ngày giờ hết hạn</option>
              <option value="permanent">vĩnh viễn</option>
            </select>
          </label>
          <label>
            Hết hạn lúc
            <input
              type="datetime-local"
              value={form.expiresAt}
              disabled={form.durationMode !== "expires_at"}
              onChange={(event) => setForm((current) => ({ ...current, expiresAt: event.target.value }))}
            />
          </label>
          <label>
            Lý do
            <input value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} />
          </label>
          <label>
            Chi tiết
            <input value={form.details} onChange={(event) => setForm((current) => ({ ...current, details: event.target.value }))} />
          </label>
        </div>
        <div className="admin-row-actions">
          <button type="button" onClick={applyPenalty} disabled={loading || Boolean(validatePenaltyForm(form))}>
            Áp dụng
          </button>
          <button type="button" onClick={() => setForm(emptyPenaltyForm)} disabled={loading}>
            Xóa form
          </button>
        </div>
      </section>

      <section className="admin-table admin-pvp-penalty-table">
        <div className="admin-table-header">
          <h3>Án phạt đấu trường</h3>
          <button type="button" onClick={loadPenalties} disabled={loading}>
            Làm mới
          </button>
        </div>
        <div className="admin-actions">
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as PenaltyStatusFilter)}>
            {statusFilters.map((status) => (
              <option key={status} value={status}>
                {formatPenaltyStatus(status)}
              </option>
            ))}
          </select>
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as PenaltyTypeFilter)}>
            {typeFilters.map((type) => (
              <option key={type} value={type}>
                {formatPenaltyType(type)}
              </option>
            ))}
          </select>
          <input
            value={targetFilter}
            onChange={(event) => setTargetFilter(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void loadPenalties();
            }}
            aria-label="Lọc theo ID người chơi mục tiêu"
          />
          <button type="button" onClick={loadPenalties} disabled={loading}>
            Lọc
          </button>
        </div>
        {loading ? <span className="admin-loading">Đang tải</span> : null}
        {error ? <div className="admin-denied">{error}</div> : null}
        {!loaded ? null : penalties.length === 0 ? <p>Chưa có án phạt đấu trường.</p> : null}
        {penalties.map((penalty) => (
          <article key={penalty.penaltyId} data-revoked={penalty.status !== "active"}>
            <strong>{formatPenaltyType(penalty.penaltyType)}</strong>
            <span>{penalty.penaltyId}</span>
            <span>{penalty.targetPlayer.displayName}</span>
            <span>{penalty.targetPlayer.playerId}</span>
            <button type="button" onClick={() => requestOpenAdminPvpPlayerProfile(penalty.targetPlayer.playerId)}>
              Mở hồ sơ
            </button>
            <span>{formatPenaltyStatus(penalty.status)}</span>
            <span>{penalty.reason}</span>
            <span>{penalty.details || "Không có chi tiết"}</span>
            <span>Bắt đầu {formatDate(penalty.startsAt)}</span>
            <span>{penalty.permanent ? "Vĩnh viễn" : penalty.expiresAt ? `Hết hạn ${formatDate(penalty.expiresAt)}` : "Không hết hạn"}</span>
            <span>Tạo bởi {penalty.createdByAdminId}</span>
            <span>Tạo {formatDate(penalty.createdAt)}</span>
            <span>Cập nhật {formatDate(penalty.updatedAt)}</span>
            <span>{penalty.liftedByAdminId ? `Gỡ bởi ${penalty.liftedByAdminId}` : "Chưa gỡ"}</span>
            <span>{penalty.liftedAt ? `Gỡ ${formatDate(penalty.liftedAt)}` : "Chưa có thời điểm gỡ"}</span>
            <span>{penalty.liftReason || "Chưa có lý do gỡ"}</span>
            <div className="admin-row-actions">
              <button type="button" onClick={() => liftPenalty(penalty)} disabled={loading || penalty.status !== "active"}>
                Gỡ
              </button>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

function validatePenaltyForm(form: PenaltyFormState) {
  if (!form.targetPlayerId.trim()) return "Cần nhập target_player_id.";
  if (!form.reason.trim()) return "Cần nhập lý do án phạt.";
  if (form.reason.trim().length > 240) return "Lý do án phạt quá dài.";
  if (form.details.length > 2000) return "Chi tiết án phạt quá dài.";
  if (form.penaltyType !== "warning" && form.durationMode === "none") {
    return "Đình chỉ và cấm cần ngày hết hạn hoặc trạng thái vĩnh viễn.";
  }
  if (form.durationMode === "expires_at") {
    const expiresAt = new Date(form.expiresAt);
    if (!Number.isFinite(expiresAt.getTime())) return "expires_at phải là ngày giờ hợp lệ.";
    if (expiresAt.getTime() <= Date.now()) return "expires_at phải ở tương lai.";
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
    return "Cơ sở dữ liệu không khả dụng.";
  }
  if (message) return message;
  return fallback;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function formatPenaltyType(type: PenaltyTypeFilter) {
  const labels: Record<string, string> = {
    all: "tất cả",
    warning: "cảnh cáo",
    ranked_suspension: "đình chỉ xếp hạng",
    duel_suspension: "đình chỉ tay đôi",
    pvp_full_ban: "cấm toàn bộ đấu trường",
    shop_suspension: "đình chỉ cửa hàng"
  };
  return labels[type] ?? type;
}

function formatPenaltyStatus(status: PenaltyStatusFilter) {
  const labels: Record<string, string> = {
    all: "tất cả",
    active: "đang hiệu lực",
    expired: "hết hạn",
    lifted: "đã gỡ"
  };
  return labels[status] ?? status;
}
