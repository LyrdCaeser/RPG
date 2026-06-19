import { Router } from "express";
import { getCurrentUserId } from "../auth.js";
import { getWalletSnapshot } from "../wallet.js";

const router = Router();

router.get("/me", async (req, res, next) => {
  try {
    const userId = await getCurrentUserId(req);
    res.json(await getWalletSnapshot(userId));
  } catch (error) {
    next(error);
  }
});

export default router;
