import { Router } from "express";
import { enemyDefinitions } from "../../data/enemies.js";
import { getRuntimeContentDefinitions } from "../contentDefinitions.js";

const router = Router();

router.get("/spawns", async (_req, res) => {
  try {
    const content = await getRuntimeContentDefinitions();
    res.json({ enemies: content.enemies });
  } catch {
    res.json({ enemies: enemyDefinitions, warning: "Using static enemy spawns because database content is unavailable." });
  }
});

export default router;
