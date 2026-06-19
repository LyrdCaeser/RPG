import { useEffect, useState } from "react";
import {
  createAdminPvpSeasonReward,
  deleteAdminPvpSeasonReward,
  disableAdminPvpSeasonReward,
  enableAdminPvpSeasonReward,
  getAdminPvpSeasonRewards,
  getAdminPvpSeasons,
  updateAdminPvpSeasonReward
} from "../../api/client";
import type { AdminPvPSeasonRewardRule, EventReward, PvPSeason } from "../../data/types";
import { useGameStore } from "../../store/useGameStore";

interface RewardFormState {
  rewardRuleId?: string;
  seasonId: string;
  tier: string;
  minRank: string;
  maxRank: string;
  minRating: string;
  minSeasonPoints: string;
  rewardsJson: string;
  enabled: boolean;
}

const emptyRewardForm: RewardFormState = {
  seasonId: "",
  tier: "",
  minRank: "",
  maxRank: "",
  minRating: "",
  minSeasonPoints: "",
  rewardsJson: "{}",
  enabled: false
};

export function AdminPvpSeasonRewardsPanel() {
  const addWarning = useGameStore((state) => state.addWarning);
  const addNotice = useGameStore((state) => state.addNotice);
  const [rules, setRules] = useState<AdminPvPSeasonRewardRule[]>([]);
  const [seasons, setSeasons] = useState<PvPSeason[]>([]);
  const [form, setForm] = useState<RewardFormState>(emptyRewardForm);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void loadData();
  }, []);

  function loadData() {
    setLoading(true);
    return Promise.all([
      getAdminPvpSeasonRewards().then((response) => setRules(response.rewards)),
      getAdminPvpSeasons().then((response) => setSeasons(response.seasons))
    ])
      .catch((error) => addWarning(adminPvpRewardWarning(error, "Tải quy tắc thưởng đấu trường thất bại.")))
      .finally(() => setLoading(false));
  }

  function saveRule() {
    const rewards = parseRewardJson(form.rewardsJson);
    if (!rewards) {
      addWarning("JSON phần thưởng không hợp lệ.");
      return;
    }
    const payload = {
      seasonId: form.seasonId,
      tier: form.tier,
      minRank: optionalNumber(form.minRank),
      maxRank: optionalNumber(form.maxRank),
      minRating: optionalNumber(form.minRating),
      minSeasonPoints: optionalNumber(form.minSeasonPoints),
      rewards,
      enabled: form.enabled
    };

    setLoading(true);
    const request = form.rewardRuleId
      ? updateAdminPvpSeasonReward({ ...payload, rewardRuleId: form.rewardRuleId })
      : createAdminPvpSeasonReward(payload);

    void request
      .then((response) => {
        setRules(response.rewards);
        setForm(toForm(response.reward));
        addNotice(form.rewardRuleId ? "Đã cập nhật quy tắc thưởng đấu trường." : "Đã tạo quy tắc thưởng đấu trường.");
      })
      .catch((error) => addWarning(adminPvpRewardWarning(error, form.rewardRuleId ? "Cập nhật quy tắc thưởng đấu trường thất bại." : "Tạo quy tắc thưởng đấu trường thất bại.")))
      .finally(() => setLoading(false));
  }

  function selectRule(rule: AdminPvPSeasonRewardRule) {
    setForm(toForm(rule));
  }

  function newRule() {
    setForm(emptyRewardForm);
  }

  function runRuleAction(action: "enable" | "disable" | "delete", rewardRuleId: string) {
    setLoading(true);
    if (action === "delete") {
      void deleteAdminPvpSeasonReward(rewardRuleId)
        .then((response) => {
          setRules(response.rewards);
          setForm((current) => (current.rewardRuleId === rewardRuleId ? emptyRewardForm : current));
          addNotice("Đã xóa quy tắc thưởng đấu trường.");
        })
        .catch((error) => addWarning(adminPvpRewardWarning(error, "Xóa quy tắc thưởng đấu trường thất bại.")))
        .finally(() => setLoading(false));
      return;
    }

    const request = action === "enable" ? enableAdminPvpSeasonReward(rewardRuleId) : disableAdminPvpSeasonReward(rewardRuleId);

    void request
      .then((response) => {
        setRules(response.rewards);
        setForm((current) => (current.rewardRuleId === response.reward.rewardRuleId ? toForm(response.reward) : current));
        addNotice(`Đã ${action === "enable" ? "bật" : "tắt"} quy tắc thưởng đấu trường.`);
      })
      .catch((error) => addWarning(adminPvpRewardWarning(error, `Thao tác quy tắc thưởng đấu trường thất bại.`)))
      .finally(() => setLoading(false));
  }

  return (
    <div className="admin-pvp-rewards">
      <section className="admin-form">
        <h3>{form.rewardRuleId ? "Cập nhật thưởng mùa đấu trường" : "Tạo thưởng mùa đấu trường"}</h3>
        <div className="admin-form-grid">
          <label>
            Mùa
            <select value={form.seasonId} onChange={(event) => setForm((current) => ({ ...current, seasonId: event.target.value }))}>
              <option value="">Chọn mùa</option>
              {seasons.map((season) => (
                <option key={season.seasonId} value={season.seasonId}>
                  {season.name} - {season.state}
                </option>
              ))}
            </select>
          </label>
          <label>
            Bậc
            <input value={form.tier} onChange={(event) => setForm((current) => ({ ...current, tier: event.target.value }))} />
          </label>
          <label>
            Hạng tối thiểu
            <input value={form.minRank} onChange={(event) => setForm((current) => ({ ...current, minRank: event.target.value }))} />
          </label>
          <label>
            Hạng tối đa
            <input value={form.maxRank} onChange={(event) => setForm((current) => ({ ...current, maxRank: event.target.value }))} />
          </label>
          <label>
            Điểm hạng tối thiểu
            <input value={form.minRating} onChange={(event) => setForm((current) => ({ ...current, minRating: event.target.value }))} />
          </label>
          <label>
            Điểm mùa tối thiểu
            <input value={form.minSeasonPoints} onChange={(event) => setForm((current) => ({ ...current, minSeasonPoints: event.target.value }))} />
          </label>
          <label className="admin-check">
            <input type="checkbox" checked={form.enabled} onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked }))} />
            Đang bật
          </label>
        </div>
        <label className="admin-json">
          JSON phần thưởng
          <textarea value={form.rewardsJson} onChange={(event) => setForm((current) => ({ ...current, rewardsJson: event.target.value }))} />
        </label>
        <div className="admin-row-actions">
          <button type="button" onClick={saveRule} disabled={loading || !canSubmitRewardRule(form)}>
            {form.rewardRuleId ? "Cập nhật" : "Tạo"}
          </button>
          <button type="button" onClick={newRule}>Tạo mới</button>
          <button type="button" onClick={loadData} disabled={loading}>Làm mới</button>
        </div>
      </section>

      <section className="admin-table admin-pvp-reward-table">
        <div className="admin-table-header">
          <h3>Quy tắc thưởng mùa đấu trường</h3>
          {loading ? <span>Đang tải</span> : null}
        </div>
        {!loading && rules.length === 0 ? <p>Chưa có quy tắc thưởng đấu trường trong cơ sở dữ liệu.</p> : null}
        {rules.map((rule) => (
          <article key={rule.rewardRuleId} data-revoked={!rule.enabled}>
            <button type="button" onClick={() => selectRule(rule)}>
              <strong>{rule.tier}</strong>
              <span>{rule.seasonName ?? rule.seasonId}</span>
            </button>
            <span>{formatRewardRequirements(rule)}</span>
            <span>{formatRewardPreview(rule.rewards)}</span>
            <span>{rule.claimCount} lượt nhận</span>
            <span>{rule.enabled ? "Đang bật" : "Đã tắt"}</span>
            <span>Tạo lúc {formatDate(rule.createdAt)}</span>
            <span>Cập nhật {formatDate(rule.updatedAt)}</span>
            <div className="admin-row-actions">
              <button type="button" onClick={() => runRuleAction("enable", rule.rewardRuleId)} disabled={loading || rule.enabled}>Bật</button>
              <button type="button" onClick={() => runRuleAction("disable", rule.rewardRuleId)} disabled={loading || !rule.enabled}>Tắt</button>
              <button type="button" onClick={() => runRuleAction("delete", rule.rewardRuleId)} disabled={loading}>Xóa</button>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

function toForm(rule: AdminPvPSeasonRewardRule): RewardFormState {
  return {
    rewardRuleId: rule.rewardRuleId,
    seasonId: rule.seasonId,
    tier: rule.tier,
    minRank: valueOrEmpty(rule.minRank),
    maxRank: valueOrEmpty(rule.maxRank),
    minRating: valueOrEmpty(rule.minRating),
    minSeasonPoints: valueOrEmpty(rule.minSeasonPoints),
    rewardsJson: JSON.stringify(rule.rewards, null, 2),
    enabled: rule.enabled
  };
}

function canSubmitRewardRule(form: RewardFormState) {
  return Boolean(form.seasonId && form.tier.trim() && form.rewardsJson.trim());
}

function parseRewardJson(text: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function optionalNumber(value: string) {
  return value.trim() ? Number(value) : undefined;
}

function valueOrEmpty(value?: number) {
  return value === undefined ? "" : String(value);
}

function formatRewardRequirements(rule: AdminPvPSeasonRewardRule) {
  const requirements = [
    rule.minRank || rule.maxRank ? `Hạng ${rule.minRank ?? "bất kỳ"} đến ${rule.maxRank ?? "bất kỳ"}` : "",
    rule.minRating ? `Điểm hạng ${rule.minRating}+` : "",
    rule.minSeasonPoints ? `Điểm mùa ${rule.minSeasonPoints}+` : ""
  ].filter(Boolean);
  return requirements.length > 0 ? requirements.join(" / ") : "Không có yêu cầu tối thiểu";
}

function formatRewardPreview(rewards: EventReward) {
  const parts = [
    rewards.gold ? `${rewards.gold} vàng` : "",
    rewards.exp ? `${rewards.exp} kinh nghiệm` : "",
    rewards.pvpPoints ? `${rewards.pvpPoints} điểm đấu trường` : "",
    ...(rewards.items ?? []).map((item) => `${item.quantity}x ${item.itemId}`),
    ...(rewards.pets ?? []).map((pet) => `Thú cưng ${pet.petId}`),
    ...(rewards.mounts ?? []).map((mount) => `Thú cưỡi ${mount.mountId}`),
    ...(rewards.titles ?? []).map((title) => `Danh hiệu ${title.titleId}`)
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" / ") : "Không có phần thưởng";
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function adminPvpRewardWarning(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (
    message.includes("database") ||
    message.includes("database_url") ||
    message.includes("econnrefused") ||
    message.includes("enotfound") ||
    message.includes("connection terminated") ||
    message.includes("connection timeout") ||
    message.includes("timeout expired")
  ) {
    return "Cơ sở dữ liệu không khả dụng.";
  }
  if (message.includes("unsupported key")) return "JSON phần thưởng không hợp lệ: khóa không được hỗ trợ.";
  if (message.includes("malformed")) return "JSON phần thưởng không hợp lệ: dữ liệu sai định dạng.";
  if (message.includes("safe integer")) return "JSON phần thưởng không hợp lệ: số không hợp lệ.";
  if (message.includes("invalid")) return "JSON phần thưởng không hợp lệ.";
  if (message.includes("not found")) return "Không tìm thấy quy tắc thưởng đấu trường.";
  if (message.includes("season_id")) return "Cần chọn mùa.";
  if (message.includes("tier")) return "Cần nhập bậc thưởng.";
  return fallback;
}
