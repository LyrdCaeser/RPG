import { Router } from "express";
import { getCurrentUserId } from "../auth.js";
import {
  DailyClaimError,
  claimDailyCheckin,
  claimDailyQuest,
  getDailySnapshot,
  recordDailyQuestProgress
} from "../daily.js";

const router = Router();

router.get("/me", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    res.json(await getDailySnapshot(userId));
  } catch (error) {
    next(error);
  }
});

router.post("/checkin/claim", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    res.json(await claimDailyCheckin(userId));
  } catch (error) {
    if (error instanceof DailyClaimError) {
      res.status(400).json({ error: error.message });
      return;
    }
    next(error);
  }
});

router.post("/quests/claim", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const questId = String(req.body.questId ?? req.body.quest_id ?? "").trim();
    res.json(await claimDailyQuest(userId, questId));
  } catch (error) {
    if (error instanceof DailyClaimError) {
      res.status(400).json({ error: error.message });
      return;
    }
    next(error);
  }
});

router.post("/progress", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const eventType = String(req.body.eventType ?? req.body.event_type ?? "").trim();
    const targetId = String(req.body.targetId ?? req.body.target_id ?? "").trim();
    const amount = Math.max(1, Math.trunc(Number(req.body.amount ?? 1)));
    if (eventType !== "talk_to_npc" || targetId !== "elder-mira" || amount !== 1) {
      res.status(400).json({ error: "Tiến trình nhiệm vụ ngày không hợp lệ." });
      return;
    }
    const updated = await recordDailyQuestProgress(userId, {
      eventType: "talk_to_npc",
      targetId,
      amount: 1
    });
    res.json({ updated, snapshot: await getDailySnapshot(userId) });
  } catch (error) {
    next(error);
  }
});

export default router;
