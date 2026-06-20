import { Router } from "express";
import { getCurrentUserId } from "../auth.js";
import { WeeklyMissionError, claimWeeklyMission, getWeeklySnapshot } from "../weekly.js";

const router = Router();

router.get("/me", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    res.json(await getWeeklySnapshot(userId));
  } catch (error) {
    next(error);
  }
});

router.post("/claim", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const missionId = String(req.body.missionId ?? req.body.mission_id ?? "").trim();
    res.json(await claimWeeklyMission(userId, missionId));
  } catch (error) {
    if (error instanceof WeeklyMissionError) {
      res.status(400).json({ error: error.message });
      return;
    }
    next(error);
  }
});

export default router;
