import { useEffect, useState } from "react";
import {
  activateAdminPvpSeason,
  archiveAdminPvpSeason,
  createAdminPvpSeason,
  endAdminPvpSeason,
  getAdminPvpSeasons,
  updateAdminPvpSeason
} from "../../api/client";
import type { PvPSeason, PvPSeasonState } from "../../data/types";
import { useGameStore } from "../../store/useGameStore";

const states: PvPSeasonState[] = ["scheduled", "active", "ended", "archived"];

interface SeasonFormState {
  seasonId?: string;
  name: string;
  state: PvPSeasonState;
  startAt: string;
  endAt: string;
}

const emptyForm: SeasonFormState = {
  name: "",
  state: "scheduled",
  startAt: "",
  endAt: ""
};

export function AdminPvpSeasonsPanel() {
  const addWarning = useGameStore((state) => state.addWarning);
  const [seasons, setSeasons] = useState<PvPSeason[]>([]);
  const [createForm, setCreateForm] = useState<SeasonFormState>(emptyForm);
  const [editForm, setEditForm] = useState<SeasonFormState | null>(null);

  useEffect(() => {
    void loadSeasons();
  }, []);

  function loadSeasons() {
    return getAdminPvpSeasons()
      .then((response) => setSeasons(response.seasons))
      .catch((error) => addWarning(adminPvpSeasonWarning(error, "PvP season load failed.")));
  }

  function createSeason() {
    void createAdminPvpSeason({
      name: createForm.name,
      state: createForm.state,
      startAt: createForm.startAt,
      endAt: createForm.endAt
    })
      .then((response) => {
        setSeasons(response.seasons);
        setCreateForm(emptyForm);
      })
      .catch((error) => addWarning(adminPvpSeasonWarning(error, "PvP season create failed.")));
  }

  function updateSeason() {
    if (!editForm?.seasonId) return;
    void updateAdminPvpSeason({
      seasonId: editForm.seasonId,
      name: editForm.name,
      state: editForm.state,
      startAt: editForm.startAt,
      endAt: editForm.endAt
    })
      .then((response) => {
        setSeasons(response.seasons);
        setEditForm(toForm(response.season));
      })
      .catch((error) => addWarning(adminPvpSeasonWarning(error, "PvP season update failed.")));
  }

  function runSeasonAction(action: "activate" | "end" | "archive", seasonId: string) {
    const request =
      action === "activate"
        ? activateAdminPvpSeason(seasonId)
        : action === "end"
          ? endAdminPvpSeason(seasonId)
          : archiveAdminPvpSeason(seasonId);
    void request
      .then((response) => {
        setSeasons(response.seasons);
        setEditForm((current) => (current?.seasonId === response.season.seasonId ? toForm(response.season) : current));
      })
      .catch((error) => addWarning(adminPvpSeasonWarning(error, `PvP season ${action} failed.`)));
  }

  return (
    <div className="admin-pvp-seasons">
      <section className="admin-form">
        <h3>Create PvP Season</h3>
        <SeasonForm form={createForm} onChange={setCreateForm} includeState />
        <button type="button" onClick={createSeason} disabled={!canSubmitSeason(createForm)}>
          Create
        </button>
      </section>

      {editForm ? (
        <section className="admin-form">
          <h3>Update PvP Season</h3>
          <SeasonForm form={editForm} onChange={setEditForm} includeState />
          <div className="admin-row-actions">
            <button type="button" onClick={updateSeason} disabled={!canSubmitSeason(editForm)}>
              Update
            </button>
            <button type="button" onClick={() => setEditForm(null)}>
              Clear
            </button>
          </div>
        </section>
      ) : null}

      <section className="admin-table">
        <div className="admin-table-header">
          <h3>PvP Seasons</h3>
          <button type="button" onClick={loadSeasons}>Refresh</button>
        </div>
        {seasons.length === 0 ? <p>No PvP seasons recorded.</p> : null}
        {seasons.map((season) => (
          <article key={season.seasonId} className="admin-table-row">
            <div>
              <strong>{season.name}</strong>
              <span>{season.state}</span>
            </div>
            <small>Start {formatAdminDate(season.startAt)}</small>
            <small>End {formatAdminDate(season.endAt)}</small>
            <small>Created {formatAdminDate(season.createdAt)}</small>
            <small>Updated {formatAdminDate(season.updatedAt)}</small>
            <div className="admin-row-actions">
              <button type="button" onClick={() => setEditForm(toForm(season))}>
                Edit
              </button>
              <button type="button" onClick={() => runSeasonAction("activate", season.seasonId)} disabled={season.state !== "scheduled"}>
                Activate
              </button>
              <button type="button" onClick={() => runSeasonAction("end", season.seasonId)} disabled={season.state !== "active" && season.state !== "scheduled"}>
                End
              </button>
              <button type="button" onClick={() => runSeasonAction("archive", season.seasonId)} disabled={season.state !== "ended"}>
                Archive
              </button>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

function SeasonForm({
  form,
  onChange,
  includeState
}: {
  form: SeasonFormState;
  onChange: (form: SeasonFormState) => void;
  includeState: boolean;
}) {
  return (
    <div className="admin-form-grid">
      <label>
        Name
        <input value={form.name} onChange={(event) => onChange({ ...form, name: event.target.value })} />
      </label>
      {includeState ? (
        <label>
          State
          <select value={form.state} onChange={(event) => onChange({ ...form, state: event.target.value as PvPSeasonState })}>
            {states.map((state) => (
              <option key={state} value={state}>{state}</option>
            ))}
          </select>
        </label>
      ) : null}
      <label>
        Start
        <input type="datetime-local" value={form.startAt} onChange={(event) => onChange({ ...form, startAt: event.target.value })} />
      </label>
      <label>
        End
        <input type="datetime-local" value={form.endAt} onChange={(event) => onChange({ ...form, endAt: event.target.value })} />
      </label>
    </div>
  );
}

function canSubmitSeason(form: SeasonFormState) {
  return Boolean(form.name.trim() && form.startAt && form.endAt && new Date(form.endAt).getTime() > new Date(form.startAt).getTime());
}

function toForm(season: PvPSeason): SeasonFormState {
  return {
    seasonId: season.seasonId,
    name: season.name,
    state: season.state,
    startAt: toDateTimeLocal(season.startAt),
    endAt: toDateTimeLocal(season.endAt)
  };
}

function toDateTimeLocal(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function formatAdminDate(value: string) {
  return new Date(value).toLocaleString();
}

function adminPvpSeasonWarning(error: unknown, fallback: string) {
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
  if (message.includes("active pvp season")) return "Another active PvP season already exists.";
  if (message.includes("valid date")) return "Season dates are invalid.";
  if (message.includes("after start")) return "Season end must be after start.";
  if (message.includes("transition")) return "Season state transition is invalid.";
  if (message.includes("not found")) return "PvP season was not found.";
  return fallback;
}
