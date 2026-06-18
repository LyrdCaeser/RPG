import { Router } from "express";
import { getRuntimeContentDefinitions } from "../contentDefinitions.js";

const router = Router();

router.get("/definitions", async (_req, res, next) => {
  try {
    res.json(await getRuntimeContentDefinitions());
  } catch (error) {
    next(error);
  }
});

export default router;
