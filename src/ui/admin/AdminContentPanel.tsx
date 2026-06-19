import { useEffect, useMemo, useState } from "react";
import {
  createAdminEnemy,
  createAdminEvent,
  createAdminItem,
  createAdminNpc,
  createAdminQuest,
  disableAdminEnemy,
  disableAdminEvent,
  disableAdminItem,
  disableAdminNpc,
  disableAdminQuest,
  getAdminEnemies,
  getAdminEvents,
  getAdminItems,
  getAdminNpcs,
  getAdminQuests,
  updateAdminEnemy,
  updateAdminEvent,
  updateAdminItem,
  updateAdminNpc,
  updateAdminQuest
} from "../../api/client";
import type {
  AdminEnemyContent,
  AdminEventContent,
  AdminItemContent,
  AdminNpcContent,
  AdminQuestContent
} from "../../data/types";
import { useGameStore } from "../../store/useGameStore";

type ContentKind = "npcs" | "quests" | "items" | "enemies" | "events";
type ContentRecord = AdminNpcContent | AdminQuestContent | AdminItemContent | AdminEnemyContent | AdminEventContent;

interface AdminContentPanelProps {
  kind: ContentKind;
}

const defaults: Record<ContentKind, ContentRecord> = {
  npcs: {
    npcId: "",
    name: "",
    role: "npc",
    mapId: "starter_village",
    x: 128,
    y: 128,
    dialogue: { default: ["Xin chào."] },
    questIds: [],
    enabled: true
  },
  quests: {
    questId: "",
    title: "",
    description: "",
    stateRules: { giverNpcId: "" },
    objectives: [],
    rewards: { gold: 0, exp: 0, items: [] },
    requiredLevel: 1,
    enabled: true
  },
  items: {
    itemId: "",
    name: "",
    type: "material",
    rarity: "common",
    description: "",
    icon: "?",
    statBonuses: {},
    sellPrice: 0,
    stackable: true,
    enabled: true
  },
  enemies: {
    enemyId: "",
    name: "",
    level: 1,
    hp: 20,
    attack: 4,
    defense: 1,
    expReward: 1,
    goldReward: 1,
    drops: [],
    aggroRange: 160,
    attackRange: 34,
    chaseSpeed: 80,
    respawnMs: 12000,
    enabled: true
  },
  events: {
    eventId: "",
    title: "",
    type: "world_event",
    state: "scheduled",
    trigger: [],
    rewards: { gold: 0, exp: 0, items: [] },
    enabled: true
  }
};

const labels: Record<ContentKind, { title: string; idKey: string; nameKey: string }> = {
  npcs: { title: "NPC", idKey: "npcId", nameKey: "name" },
  quests: { title: "Nhiệm vụ", idKey: "questId", nameKey: "title" },
  items: { title: "Vật phẩm", idKey: "itemId", nameKey: "name" },
  enemies: { title: "Kẻ địch", idKey: "enemyId", nameKey: "name" },
  events: { title: "Sự kiện", idKey: "eventId", nameKey: "title" }
};

export function AdminContentPanel({ kind }: AdminContentPanelProps) {
  const addWarning = useGameStore((state) => state.addWarning);
  const label = labels[kind];
  const [rows, setRows] = useState<ContentRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [jsonText, setJsonText] = useState(() => JSON.stringify(defaults[kind], null, 2));
  const [busy, setBusy] = useState(false);

  const selected = useMemo(
    () => rows.find((row) => String(toRecord(row)[label.idKey]) === selectedId) ?? null,
    [label.idKey, rows, selectedId]
  );

  const loadRows = () => {
    setBusy(true);
    void load(kind)
      .then(setRows)
      .catch(() => addWarning(`Tải nội dung ${label.title} thất bại.`))
      .finally(() => setBusy(false));
  };

  useEffect(() => {
    setSelectedId(null);
    setJsonText(JSON.stringify(defaults[kind], null, 2));
    loadRows();
  }, [kind]);

  const selectRow = (row: ContentRecord) => {
    setSelectedId(String(toRecord(row)[label.idKey]));
    setJsonText(JSON.stringify(row, null, 2));
  };

  const newRow = () => {
    setSelectedId(null);
    setJsonText(JSON.stringify(defaults[kind], null, 2));
  };

  const save = () => {
    const parsed = parseContent(jsonText);
    if (!parsed) {
      addWarning(`JSON ${label.title} không hợp lệ.`);
      return;
    }
    const id = String(parsed[label.idKey] ?? "").trim();
    const name = String(parsed[label.nameKey] ?? "").trim();
    if (!id || !name) {
      addWarning(`${label.title} cần có ${label.idKey} và ${label.nameKey}.`);
      return;
    }
    setBusy(true);
    void saveContent(kind, parsed as unknown as ContentRecord, Boolean(selectedId))
      .then((nextRows) => {
        setRows(nextRows);
        setSelectedId(id);
      })
      .catch(() => addWarning(`Lưu ${label.title} thất bại.`))
      .finally(() => setBusy(false));
  };

  const disable = () => {
    if (!selectedId) return;
    if (!window.confirm(`Tắt ${selectedId}?`)) return;
    setBusy(true);
    void disableContent(kind, selectedId)
      .then((nextRows) => {
        setRows(nextRows);
        setSelectedId(null);
        setJsonText(JSON.stringify(defaults[kind], null, 2));
      })
      .catch(() => addWarning(`Tắt ${label.title} thất bại.`))
      .finally(() => setBusy(false));
  };

  return (
    <div className="admin-tool">
      <div className="admin-actions">
        <button type="button" onClick={newRow}>
          Tạo mới
        </button>
        <button type="button" onClick={save} disabled={busy}>
          {selected ? "Cập nhật" : "Tạo"}
        </button>
        <button type="button" onClick={disable} disabled={busy || !selectedId}>
          Tắt
        </button>
        <button type="button" onClick={loadRows} disabled={busy}>
          Làm mới
        </button>
      </div>
      <div className="admin-columns">
        <div className="admin-list">
          {rows.map((row) => {
            const id = String(toRecord(row)[label.idKey]);
            const name = String(toRecord(row)[label.nameKey]);
            return (
              <button type="button" key={id} data-active={selectedId === id} onClick={() => selectRow(row)}>
                <strong>{name || id}</strong>
                <span>{(row as { enabled?: boolean }).enabled ? id : `${id} đã tắt`}</span>
              </button>
            );
          })}
        </div>
        <label className="admin-json">
          {label.title} JSON
          <textarea value={jsonText} onChange={(event) => setJsonText(event.target.value)} spellCheck={false} />
        </label>
      </div>
    </div>
  );
}

function parseContent(text: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(text) as unknown;
    return typeof parsed === "object" && parsed && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function toRecord(row: ContentRecord) {
  return row as unknown as Record<string, unknown>;
}

async function load(kind: ContentKind): Promise<ContentRecord[]> {
  if (kind === "npcs") return (await getAdminNpcs()).npcs;
  if (kind === "quests") return (await getAdminQuests()).quests;
  if (kind === "items") return (await getAdminItems()).items;
  if (kind === "enemies") return (await getAdminEnemies()).enemies;
  return (await getAdminEvents()).events;
}

async function saveContent(kind: ContentKind, content: ContentRecord, update: boolean): Promise<ContentRecord[]> {
  if (kind === "npcs") return (update ? await updateAdminNpc(content as AdminNpcContent) : await createAdminNpc(content as AdminNpcContent)).npcs;
  if (kind === "quests") return (update ? await updateAdminQuest(content as AdminQuestContent) : await createAdminQuest(content as AdminQuestContent)).quests;
  if (kind === "items") return (update ? await updateAdminItem(content as AdminItemContent) : await createAdminItem(content as AdminItemContent)).items;
  if (kind === "enemies") return (update ? await updateAdminEnemy(content as AdminEnemyContent) : await createAdminEnemy(content as AdminEnemyContent)).enemies;
  return (update ? await updateAdminEvent(content as AdminEventContent) : await createAdminEvent(content as AdminEventContent)).events;
}

async function disableContent(kind: ContentKind, id: string): Promise<ContentRecord[]> {
  if (kind === "npcs") return (await disableAdminNpc(id)).npcs;
  if (kind === "quests") return (await disableAdminQuest(id)).quests;
  if (kind === "items") return (await disableAdminItem(id)).items;
  if (kind === "enemies") return (await disableAdminEnemy(id)).enemies;
  return (await disableAdminEvent(id)).events;
}
