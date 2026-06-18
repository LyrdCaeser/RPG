import { Router } from "express";
import { cutsceneDefinitions, eventDefinitions } from "../../data/events.js";
import { getCurrentUserId } from "../auth.js";
import { query } from "../db.js";

const router = Router();
const cutsceneIds = new Set(cutsceneDefinitions.map((cutscene) => cutscene.id));

router.post("/complete", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    const cutsceneId = String(req.body.cutsceneId ?? "");
    if (!cutsceneIds.has(cutsceneId)) {
      res.status(400).json({ error: "Valid cutsceneId is required." });
      return;
    }

    await query(
      `insert into cutscene_progress (user_id, cutscene_id, completed_at)
       values ($1, $2, now())
       on conflict (user_id, cutscene_id)
       do update set completed_at = now()`,
      [userId, cutsceneId]
    );

    const event = eventDefinitions.find((candidate) => candidate.cutsceneId === cutsceneId);
    if (event) {
      await query(
        `insert into player_events (user_id, event_id, state, progress)
         values ($1, $2, 'completed', '{"cutsceneComplete": true}'::jsonb)
         on conflict (user_id, event_id)
         do update set state = 'completed',
           progress = player_events.progress || '{"cutsceneComplete": true}'::jsonb,
           updated_at = now()`,
        [userId, event.id]
      );
    }

    res.json({ cutsceneId, completed: true });
  } catch (error) {
    next(error);
  }
});

export default router;
