# Phaser RPG PostgreSQL

Vite + React + TypeScript RPG foundation using Phaser 3 for the world and React for UI panels.

Game progress is persisted only through API calls backed by PostgreSQL. The frontend does **not** use `localStorage`, `sessionStorage`, IndexedDB, or browser cookies for player progress. Zustand is used only for temporary in-memory UI and game state.

## Tech Stack

* Vite
* React
* TypeScript
* Phaser 3
* Node.js / Express API
* PostgreSQL / Neon
* Zustand for temporary in-memory state only

## Requirements

* Node.js 22+
* PostgreSQL 14+ or Neon PostgreSQL
* npm

## PostgreSQL / Neon Setup

Create a Neon PostgreSQL project and copy the connection string.

Use a production PostgreSQL connection string like:

```text
postgresql://user:password@host:5432/database?sslmode=require
```

Create a local `.env` file at the project root:

```env
DATABASE_URL="postgresql://user:password@host:5432/database?sslmode=require"
PORT=8787
HOST=0.0.0.0
```

Never commit `.env`. It contains secrets and is ignored by Git.

After `DATABASE_URL` is available, apply the PostgreSQL schema:

```powershell
npm run db:schema
```

`npm run db:schema` has a preflight check. If `DATABASE_URL` is missing, it prints a clear message and exits without applying anything.

The schema is designed to be idempotent. It uses safe `IF NOT EXISTS` table/index creation and safe column additions where needed.

The schema creates the core player, gameplay, social, guild, PvP, moderation, mailbox, and admin tables needed by the API. Key tables include:

* `users`
* `players`
* `player_sessions`
* `player_quests`
* `player_inventory`
* `player_equipment`
* `player_flags`
* `leaderboard`
* `leaderboard_snapshots`
* `player_save_logs`
* `battle_results`
* `shop_transactions`
* `item_transactions`
* `player_events`
* `event_results`
* `boss_results`
* `cutscene_progress`
* `daily_claims`
* `guilds`
* `guild_members`
* `guild_quests`
* `guild_boss_summons`
* `guild_leaderboard`
* `mailbox_messages`
* `mailbox_reads`
* `mailbox_claims`
* `pvp_profiles`
* `pvp_duel_matches`
* `pvp_ranked_matches`
* `pvp_ranked_results`
* `pvp_seasons`
* `pvp_season_reward_rules`
* `pvp_shop_items`
* `pvp_reports`
* `pvp_report_penalties`
* `pvp_penalties`
* `pvp_penalty_events`
* `pvp_penalty_appeals`
* `pvp_penalty_appeal_events`
* `pvp_moderation_watchlist`
* `pvp_moderation_watchlist_events`

No seed rows, demo rows, fake rows, or sample player data are required.

## Environment Variables

Required:

```env
DATABASE_URL="postgresql://user:password@host:5432/database?sslmode=require"
```

Optional:

```env
PORT=8787
HOST=0.0.0.0
```

For Render deployment, `PORT` is usually provided by Render automatically. `HOST=0.0.0.0` is safe for hosted runtimes.

## Local Development

Install dependencies:

```powershell
npm install
```

Run the API server and Vite client together:

```powershell
npm run dev
```

Open:

```text
http://127.0.0.1:5173/
```

If port `5173` is already occupied, Vite will print the alternate local URL to use.

The API runs on:

```text
http://127.0.0.1:8787/
```

Vite proxies `/api` calls to the API server.

## Production Build

Run TypeScript checks:

```powershell
npm run typecheck
```

Build the app:

```powershell
npm run build
```

Start the production API server:

```powershell
npm run server
```

The build command does **not** automatically run `npm run db:schema`.

Run schema application manually only when needed:

```powershell
npm run db:schema
```

## Render Deployment

Recommended deployment target: **Render Web Service**.

Render settings:

```text
Service Type: Web Service
Runtime: Node
Branch: main
Build Command: npm run build
Start Command: npm run server
```

Environment variables on Render:

```env
DATABASE_URL="postgresql://user:password@host:5432/database?sslmode=require"
HOST=0.0.0.0
```

`PORT` is normally provided by Render. Set it manually only if the host requires it.

After deployment, test the live URL:

```text
https://your-service-name.onrender.com/api/health
```

Expected health response:

```json
{
  "ok": true,
  "database": {
    "configured": true,
    "status": "configured_not_checked"
  }
}
```

The health endpoint confirms process liveness and whether `DATABASE_URL` is configured. It does not apply schema automatically.

## Admin / Owner Role

Do **not** create a public `set-admin` endpoint.

Admin or owner role should be assigned manually through Neon SQL Editor after a real deployed user exists.

First, create a real user by using the deployed app or guest API:

```text
POST /api/account/guest
```

Then find the user in Neon SQL Editor:

```sql
SELECT *
FROM users
ORDER BY created_at DESC
LIMIT 20;
```

Update only the selected user:

```sql
UPDATE users
SET role = 'owner'
WHERE id = 'PASTE_USER_ID_HERE'
RETURNING id, role, created_at;
```

If the table uses `user_id` instead of `id`, use:

```sql
UPDATE users
SET role = 'owner'
WHERE user_id = 'PASTE_USER_ID_HERE'
RETURNING user_id, role, created_at;
```

Never run:

```sql
UPDATE users SET role = 'owner';
```

That would promote every user.

## Auth Behavior

Guest account creation:

```text
POST /api/account/guest
```

Auth status:

```text
GET /api/auth/me
```

Unauthenticated requests return:

```json
{
  "authenticated": false
}
```

Protected APIs require a real session token from `POST /api/account/guest` or another production-auth-backed session source.

Missing or invalid sessions return:

```json
{
  "error": "unauthenticated"
}
```

Admin APIs require a real `admin` or `owner` role from the database. Non-admin users receive a forbidden response.

The server does not create fallback player identities for protected API calls.

## Persistence Rules

Important player/game APIs include:

* Player load: `GET /api/player/me`
* Player save and autosave: `POST /api/player/save`
* Quest load: `GET /api/quests/me`
* Quest update: `POST /api/quests/update`
* Guest account: `POST /api/account/guest`
* Leaderboard read: `GET /api/leaderboard?type=level`
* Leaderboard submit: `POST /api/leaderboard/submit`
* Player leaderboard rank: `GET /api/leaderboard/me`
* Enemy spawns: `GET /api/enemies/spawns`
* Battle result save: `POST /api/battle/result`
* Inventory load: `GET /api/inventory/me`
* Inventory update: `POST /api/inventory/update`
* Equipment update: `POST /api/inventory/equip`
* Consumable use: `POST /api/inventory/use`
* Auth status: `GET /api/auth/me`
* Shop load: `GET /api/shop/:npcId`
* Shop buy: `POST /api/shop/buy`
* Shop sell: `POST /api/shop/sell`
* Event load: `GET /api/events/me`
* Event update: `POST /api/events/update`
* Event claim: `POST /api/events/claim`
* Boss event result save: `POST /api/events/boss-result`
* Cutscene completion save: `POST /api/cutscenes/complete`

PvP and moderation APIs include:

* PvP reports: `GET /api/pvp/reports/me`
* PvP penalties: `GET /api/pvp/penalties/me`
* PvP penalty appeals: `GET /api/pvp/penalties/appeals/me`
* PvP ranked / duel APIs
* PvP admin reports, penalties, appeals, risk queue, watchlist, seasons, rewards, and shop APIs

Frontend fetch calls use `credentials: "omit"` so browser cookies are not part of game-progress persistence.

## Database Failure Behavior

If `DATABASE_URL` is missing or the database cannot be reached, DB-backed routes return a database unavailable error instead of fake success.

Empty arrays are valid only when a real database query succeeds and returns no rows.

## Verification

Run TypeScript checks:

```powershell
npm run typecheck
```

Build the app:

```powershell
npm run build
```

Audit app source for forbidden browser persistence APIs:

```powershell
rg "localStorage|sessionStorage|indexedDB|IndexedDB|document\.cookie|cookie|Cookie|createJSONStorage|zustand/middleware" src
```

Expected rule:

* No `localStorage`
* No `sessionStorage`
* No IndexedDB
* No browser cookies for game progress
* No Zustand persistence middleware

## Notes

The Vite build may report a large chunk warning for `vendor-phaser`. Phaser is core gameplay code and is intentionally split into a vendor chunk.

The main app chunk is kept small through lazy loading and manual vendor chunk splitting.
