# Phaser RPG PostgreSQL

Vite + React + TypeScript RPG foundation using Phaser 3 for the world and React for UI panels.

Game progress is persisted only through API calls backed by PostgreSQL. The frontend does not use `localStorage`, `sessionStorage`, IndexedDB, or browser cookies for player progress. Zustand is used only for temporary in-memory UI and game state.

## Requirements

- Node.js 22+
- PostgreSQL 14+
- npm

## PostgreSQL Setup For Codex/OpenAI App

1. Add `DATABASE_URL` as an environment variable or secret in the Codex/OpenAI app environment.

Use your production PostgreSQL connection string:

```text
postgresql://user:password@host:5432/database?sslmode=require
```

2. Add `PORT` as an environment variable if your environment does not already provide one:

```text
8787
```

3. Apply the PostgreSQL schema after `DATABASE_URL` is available:

```powershell
npm run db:schema
```

`npm run db:schema` has a preflight check. If `DATABASE_URL` is missing, it prints a clear message and exits without applying anything.

For local development outside Codex, you may create a real `.env` file manually from `.env.example`. Never commit `.env`; it is listed in `.gitignore`.

The schema creates the core player, gameplay, social, guild, PvP, moderation, mailbox, and admin tables needed by the API. Key tables include:

- `users`
- `players`
- `player_quests`
- `player_inventory`
- `player_equipment`
- `player_flags`
- `leaderboard`
- `leaderboard_snapshots`
- `player_save_logs`
- `battle_results`
- `shop_transactions`
- `item_transactions`
- `player_events`
- `event_results`
- `boss_results`
- `cutscene_progress`
- `daily_claims`
- `player_sessions`
- `guilds`
- `guild_members`
- `guild_quests`
- `guild_boss_summons`
- `guild_leaderboard`
- `pvp_profiles`
- `pvp_duel_matches`
- `pvp_ranked_matches`
- `pvp_ranked_results`
- `pvp_seasons`
- `pvp_season_reward_rules`
- `pvp_shop_items`
- `pvp_reports`
- `pvp_penalties`
- `pvp_penalty_appeals`
- `pvp_moderation_watchlist`

## Run The Game

Install dependencies:

```powershell
npm install
```

Start the API server and Vite client together:

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

## Persistence Rules

- Player load: `GET /api/player/me`
- Player save and autosave: `POST /api/player/save`
- Quest load: `GET /api/quests/me`
- Quest update: `POST /api/quests/update`
- Guest account: `POST /api/account/guest`
- Leaderboard read: `GET /api/leaderboard?type=level`
- Leaderboard submit: `POST /api/leaderboard/submit`
- Player leaderboard rank: `GET /api/leaderboard/me`
- Enemy spawns: `GET /api/enemies/spawns`
- Battle result save: `POST /api/battle/result`
- Inventory load: `GET /api/inventory/me`
- Inventory update: `POST /api/inventory/update`
- Equipment update: `POST /api/inventory/equip`
- Consumable use: `POST /api/inventory/use`
- Auth status: `GET /api/auth/me`
- Shop load: `GET /api/shop/:npcId`
- Shop buy: `POST /api/shop/buy`
- Shop sell: `POST /api/shop/sell`
- Event load: `GET /api/events/me`
- Event update: `POST /api/events/update`
- Event claim: `POST /api/events/claim`
- Boss event result save: `POST /api/events/boss-result`
- Cutscene completion save: `POST /api/cutscenes/complete`

Frontend fetch calls use `credentials: "omit"` so browser cookies are not part of game-progress persistence.

Protected APIs require a real session token from `POST /api/account/guest` or another production-auth-backed session source. Missing or invalid sessions return `401 { "error": "unauthenticated" }`; the server does not create a fallback player identity for protected API calls.

`GET /api/auth/me` returns `{ "authenticated": false }` when no valid session is supplied. `GET /api/health` reports whether `DATABASE_URL` is configured; it does not perform schema application.

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
