import "dotenv/config";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import playerRouter from "./routes/player.js";
import authRouter from "./routes/auth.js";
import accountRouter from "./routes/account.js";
import questsRouter from "./routes/quests.js";
import leaderboardRouter from "./routes/leaderboard.js";
import battleRouter from "./routes/battle.js";
import enemiesRouter from "./routes/enemies.js";
import inventoryRouter from "./routes/inventory.js";
import shopRouter from "./routes/shop.js";
import eventsRouter from "./routes/events.js";
import cutscenesRouter from "./routes/cutscenes.js";
import adminRouter from "./routes/admin.js";
import adminTopupRouter from "./routes/adminTopup.js";
import adminWalletRouter from "./routes/adminWallet.js";
import adminShopRouter from "./routes/adminShop.js";
import giftcodesRouter from "./routes/giftcodes.js";
import contentRouter from "./routes/content.js";
import adminContentRouter from "./routes/adminContent.js";
import mapsRouter from "./routes/maps.js";
import dungeonsRouter from "./routes/dungeons.js";
import classesRouter from "./routes/classes.js";
import skillsRouter from "./routes/skills.js";
import gatheringRouter from "./routes/gathering.js";
import craftingRouter from "./routes/crafting.js";
import upgradesRouter from "./routes/upgrades.js";
import petsRouter from "./routes/pets.js";
import mountsRouter from "./routes/mounts.js";
import rewardsRouter from "./routes/rewards.js";
import achievementsRouter from "./routes/achievements.js";
import titlesRouter from "./routes/titles.js";
import collectionsRouter from "./routes/collections.js";
import mailboxRouter from "./routes/mailbox.js";
import adminMailboxRouter from "./routes/adminMailbox.js";
import socialRouter from "./routes/social.js";
import chatRouter from "./routes/chat.js";
import partyRouter from "./routes/party.js";
import guildRouter from "./routes/guild.js";
import pvpRouter from "./routes/pvp.js";
import topupRouter from "./routes/topup.js";
import walletRouter from "./routes/wallet.js";
import { isAuthError } from "./auth.js";

const app = express();
const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? "0.0.0.0";
const serverDir = dirname(fileURLToPath(import.meta.url));
const clientDistPath = resolve(serverDir, "../../dist");
const clientIndexPath = join(clientDistPath, "index.html");

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  const databaseConfigured = Boolean(process.env.DATABASE_URL);
  res.json({
    ok: true,
    database: {
      configured: databaseConfigured,
      status: databaseConfigured ? "configured_not_checked" : "not_configured"
    }
  });
});

app.use("/api/auth", authRouter);
app.use("/api/account", accountRouter);
app.use("/api/player", playerRouter);
app.use("/api/quests", questsRouter);
app.use("/api/leaderboard", leaderboardRouter);
app.use("/api/battle", battleRouter);
app.use("/api/enemies", enemiesRouter);
app.use("/api/inventory", inventoryRouter);
app.use("/api/shop", shopRouter);
app.use("/api/events", eventsRouter);
app.use("/api/cutscenes", cutscenesRouter);
app.use("/api/admin", adminRouter);
app.use("/api/admin", adminTopupRouter);
app.use("/api/admin", adminWalletRouter);
app.use("/api/admin", adminShopRouter);
app.use("/api/admin", adminContentRouter);
app.use("/api/giftcodes", giftcodesRouter);
app.use("/api/content", contentRouter);
app.use("/api/maps", mapsRouter);
app.use("/api/dungeons", dungeonsRouter);
app.use("/api/classes", classesRouter);
app.use("/api/skills", skillsRouter);
app.use("/api/gathering", gatheringRouter);
app.use("/api/crafting", craftingRouter);
app.use("/api/upgrades", upgradesRouter);
app.use("/api/pets", petsRouter);
app.use("/api/mounts", mountsRouter);
app.use("/api/rewards", rewardsRouter);
app.use("/api/achievements", achievementsRouter);
app.use("/api/titles", titlesRouter);
app.use("/api/collections", collectionsRouter);
app.use("/api/mailbox", mailboxRouter);
app.use("/api/admin", adminMailboxRouter);
app.use("/api/social", socialRouter);
app.use("/api/chat", chatRouter);
app.use("/api/party", partyRouter);
app.use("/api/guild", guildRouter);
app.use("/api/pvp", pvpRouter);
app.use("/api/topup", topupRouter);
app.use("/api/wallet", walletRouter);

app.use("/api", (_req, res) => {
  res.status(404).json({ error: "not found" });
});

const clientStatic = express.static(clientDistPath, { index: false });
app.use((req, res, next) => {
  if (req.path.startsWith("/api")) {
    next();
    return;
  }
  clientStatic(req, res, next);
});

app.use((req, res, next) => {
  if ((req.method !== "GET" && req.method !== "HEAD") || req.path.startsWith("/api")) {
    next();
    return;
  }
  if (!existsSync(clientIndexPath)) {
    res.status(500).json({ error: "Frontend build is missing. Run npm run build before starting the server." });
    return;
  }
  res.sendFile(clientIndexPath);
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : "Unexpected server error.";
  const lowerMessage = message.toLowerCase();
  const databaseUnavailable =
    message.includes("DATABASE_URL") ||
    lowerMessage.includes("econnrefused") ||
    lowerMessage.includes("enotfound") ||
    lowerMessage.includes("database unavailable") ||
    lowerMessage.includes("connection terminated") ||
    lowerMessage.includes("connection timeout") ||
    lowerMessage.includes("timeout expired");
  const status = databaseUnavailable ? 503 : isAuthError(error) ? 401 : message.includes("Account is banned") ? 403 : 500;
  res.status(status).json({ error: databaseUnavailable ? "database unavailable" : isAuthError(error) ? "unauthenticated" : message });
});

const server = app.listen(port, host, () => {
  console.log(`RPG API listening on http://${host}:${port}`);
});

function shutdown() {
  server.close(() => {
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
