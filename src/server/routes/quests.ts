import { Router } from "express";
import { getCurrentUserId } from "../auth.js";
import { getRuntimeContentDefinitions, getStaticRuntimeContentDefinitions } from "../contentDefinitions.js";
import { query } from "../db.js";
import type { PlayerQuest, QuestState } from "../../data/types.js";

interface QuestRow {
  quest_id: string;
  state: QuestState;
  progress: Record<string, unknown>;
  updated_at: Date;
}

const allowedStates: QuestState[] = ["locked", "available", "active", "completed", "claimed"];
const router = Router();

function toQuest(row: QuestRow): PlayerQuest {
  return {
    questId: row.quest_id,
    state: row.state,
    progress: row.progress ?? {},
    updatedAt: row.updated_at.toISOString()
  };
}

async function ensureQuests(userId: string) {
  const content = await getRuntimeContentDefinitions().catch(() => getStaticRuntimeContentDefinitions());
  for (const [index, quest] of content.quests.entries()) {
    await query(
      `insert into player_quests (user_id, quest_id, state, progress)
       values ($1, $2, $3, $4)
       on conflict (user_id, quest_id) do nothing`,
      [userId, quest.id, index === 0 ? "available" : "locked", { objectives: {} }]
    );
  }

  const result = await query<QuestRow>(
    `select quest_id, state, progress, updated_at
     from player_quests
     where user_id = $1
     order by quest_id`,
    [userId]
  );

  return result.rows.map(toQuest);
}

router.get("/me", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const quests = await ensureQuests(userId);
    res.json({ quests });
  } catch (error) {
    next(error);
  }
});

router.post("/update", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const content = await getRuntimeContentDefinitions().catch(() => getStaticRuntimeContentDefinitions());
    const allowedQuestIds = new Set(content.quests.map((quest) => quest.id));
    const questId = String(req.body.questId ?? "");
    const state = String(req.body.state ?? "") as QuestState;
    const progress =
      typeof req.body.progress === "object" && req.body.progress && !Array.isArray(req.body.progress)
        ? req.body.progress
        : {};

    if (!questId || !allowedQuestIds.has(questId) || !allowedStates.includes(state)) {
      res.status(400).json({ error: "Valid questId and state are required." });
      return;
    }

    const result = await query<QuestRow>(
      `insert into player_quests (user_id, quest_id, state, progress)
       values ($1, $2, $3, $4)
       on conflict (user_id, quest_id)
       do update set state = excluded.state, progress = excluded.progress, updated_at = now()
       returning quest_id, state, progress, updated_at`,
      [userId, questId, state, progress]
    );

    res.json({ quest: toQuest(result.rows[0]) });
  } catch (error) {
    next(error);
  }
});

export default router;
