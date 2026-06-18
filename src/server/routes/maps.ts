import { Router } from "express";
import { mapDefinitions } from "../../data/maps.js";

const router = Router();

router.get("/definitions", (_req, res) => {
  res.json({ maps: mapDefinitions });
});

export default router;
