import { Router } from "express";
import { classDefinitions } from "../../data/classes.js";

const router = Router();

router.get("/", (_req, res) => {
  res.json({ classes: classDefinitions });
});

export default router;
