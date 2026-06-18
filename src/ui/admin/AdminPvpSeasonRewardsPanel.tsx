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
      .catch((error) => addWarning(adminPvpRewardWarning(error, "PvP reward rules load failed.")))
      .finally(() => setLoading(false));
  }

  function saveRule() {
    const rewards = parseRewardJson(form.rewardsJson);
    if (!rewards) {
      addWarning("Reward JSON validation failed.");
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
        addNotice(form.rewardRuleId ? "PvP reward rule updated." : "PvP reward rule created.");
      })
      .catch((error) => addWarning(adminPvpRewardWarning(error, form.rewardRuleId ? "PvP reward rule update failed." : "PvP reward rule create failed.")))
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
          addNotice("PvP reward rule delete succeeded.");
        })
        .catch((error) => addWarning(adminPvpRewardWarning(error, "PvP reward rule delete failed.")))
        .finally(() => setLoading(false));
      return;
    }

    const request = action === "enable" ? enableAdminPvpSeasonReward(rewardRuleId) : disableAdminPvpSeasonReward(rewardRuleId);

    void request
      .then((response) => {
        setRules(response.rewards);
        setForm((current) => (current.rewardRuleId === response.reward.rewardRuleId ? toForm(response.reward) : current));
        addNotice(`PvP reward rule ${action} succeeded.`);
      })
      .catch((error) => addWarning(adminPvpRewardWarning(error, `PvP reward rule ${action} failed.`)))
      .finally(() => setLoading(false));
  }

  return (
    <div className="admin-pvp-rewards">
      <section className="admin-form">
        <h3>{form.rewardRuleId ? "Update PvP Season Reward" : "Create PvP Season Reward"}</h3>
        <div className="admin-form-grid">
          <label>
            Season
            <select value={form.seasonId} onChange={(event) => setForm((current) => ({ ...current, seasonId: event.target.value }))}>
              <option value="">Select season</option>
              {seasons.map((season) => (
                <option key={season.seasonId} value={season.seasonId}>
                  {season.name} - {season.state}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tier
            <input value={form.tier} onChange={(event) => setForm((current) => ({ ...current, tier: event.target.value }))} />
          </label>
          <label>
            Min rank
            <input value={form.minRank} onChange={(event) => setForm((current) => ({ ...current, minRank: event.target.value }))} />
          </label>
          <label>
            Max rank
            <input value={form.maxRank} onChange={(event) => setForm((current) => ({ ...current, maxRank: event.target.value }))} />
          </label>
          <label>
            Min rating
            <input value={form.minRating} onChange={(event) => setForm((current) => ({ ...current, minRating: event.target.value }))} />
          </label>
          <label>
            Min season points
            <input value={form.minSeasonPoints} onChange={(event) => setForm((current) => ({ ...current, minSeasonPoints: event.target.value }))} />
          </label>
          <label className="admin-check">
            <input type="checkbox" checked={form.enabled} onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked }))} />
            Enabled
          </label>
        </div>
        <label className="admin-json">
          Rewards JSON
          <textarea value={form.rewardsJson} onChange={(event) => setForm((current) => ({ ...current, rewardsJson: event.target.value }))} />
        </label>
        <div className="admin-row-actions">
          <button type="button" onClick={saveRule} disabled={loading || !canSubmitRewardRule(form)}>
            {form.rewardRuleId ? "Update" : "Create"}
          </button>
          <button type="button" onClick={newRule}>New</button>
          <button type="button" onClick={loadData} disabled={loading}>Refresh</button>
        </div>
      </section>

      <section className="admin-table admin-pvp-reward-table">
        <div className="admin-table-header">
          <h3>PvP Season Reward Rules</h3>
          {loading ? <span>Loading</span> : null}
        </div>
        {!loading && rules.length === 0 ? <p>No PvP reward rules recorded.</p> : null}
        {rules.map((rule) => (
          <article key={rule.rewardRuleId} data-revoked={!rule.enabled}>
            <button type="button" onClick={() => selectRule(rule)}>
              <strong>{rule.tier}</strong>
              <span>{rule.seasonName ?? rule.seasonId}</span>
            </button>
            <span>{formatRewardRequirements(rule)}</span>
            <span>{formatRewardPreview(rule.rewards)}</span>
            <span>{rule.claimCount} claims</span>
            <span>{rule.enabled ? "Enabled" : "Disabled"}</span>
            <span>Created {formatDate(rule.createdAt)}</span>
            <span>Updated {formatDate(rule.updatedAt)}</span>
            <div className="admin-row-actions">
              <button type="button" onClick={() => runRuleAction("enable", rule.rewardRuleId)} disabled={loading || rule.enabled}>Enable</button>
              <button type="button" onClick={() => runRuleAction("disable", rule.rewardRuleId)} disabled={loading || !rule.enabled}>Disable</button>
              <button type="button" onClick={() => runRuleAction("delete", rule.rewardRuleId)} disabled={loading}>Delete</button>
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
    rule.minRank || rule.maxRank ? `Rank ${rule.minRank ?? "any"} to ${rule.maxRank ?? "any"}` : "",
    rule.minRating ? `Rating ${rule.minRating}+` : "",
    rule.minSeasonPoints ? `Season points ${rule.minSeasonPoints}+` : ""
  ].filter(Boolean);
  return requirements.length > 0 ? requirements.join(" / ") : "No minimum requirement";
}

function formatRewardPreview(rewards: EventReward) {
  const parts = [
    rewards.gold ? `${rewards.gold} gold` : "",
    rewards.exp ? `${rewards.exp} EXP` : "",
    rewards.pvpPoints ? `${rewards.pvpPoints} PvP points` : "",
    ...(rewards.items ?? []).map((item) => `${item.quantity}x ${item.itemId}`),
    ...(rewards.pets ?? []).map((pet) => `Pet ${pet.petId}`),
    ...(rewards.mounts ?? []).map((mount) => `Mount ${mount.mountId}`),
    ...(rewards.titles ?? []).map((title) => `Title ${title.titleId}`)
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" / ") : "No rewards";
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
    return "database unavailable";
  }
  if (message.includes("unsupported key")) return "Reward JSON validation failed: unsupported key.";
  if (message.includes("malformed")) return "Reward JSON validation failed: malformed payload.";
  if (message.includes("safe integer")) return "Reward JSON validation failed: invalid number.";
  if (message.includes("invalid")) return "Reward JSON validation failed.";
  if (message.includes("not found")) return "PvP season reward rule was not found.";
  if (message.includes("season_id")) return "Season id is required.";
  if (message.includes("tier")) return "Tier is required.";
  return fallback;
}
