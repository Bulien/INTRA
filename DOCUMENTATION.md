# INTRA — Documentation

Technical documentation for **INTRA**: balanced team building, shared games, **Ranked Custom** and **Ranked Queue** ladders, queue matchmaking, chat, and per-game rankings. Use this to understand the codebase and modify it.

---

## Table of contents

1. [Overview](#1-overview)
2. [Getting started](#2-getting-started)
3. [Application guide](#3-application-guide)
4. [Database (Prisma)](#4-database-prisma)
5. [API reference](#5-api-reference)
6. [Auth, roles & bans](#6-auth-roles--bans)
7. [Project structure](#7-project-structure)
8. [Scripts](#8-scripts)
9. [Deployment](#9-deployment)

---

## 1. Overview

**INTRA** provides:

| Feature | Description |
|--------|-------------|
| **Team Builder** | Add players with 1–10 rating; algorithm splits into Yin/Yang with minimal imbalance. Create shared games; submit results to update **Ranked Custom** ladder. When a game is shared, all players (including creator) see only the result-posting view until the game is resolved. |
| **Ranked Queue** | Join a queue per game (LoL, Overwatch). When 10 are in queue, a match is created automatically; users see a queue-pop modal and are sent to `/queue-match/[gameId]` to post the result. ELO/rank tracked separately (**Ranked Queue** ladder). |
| **Rankings** | Two ladders: **Ranked Custom** (Team Builder games) and **Ranked Queue** (queue matchmaking). Per-game, per-season tables (LoL, OW, SC, Battlerite). Ranking index (`/ranking`) is centered with ladder previews; sub-routes have side-by-side Ranked Custom (blue) / Ranked Queue (gold) buttons. Table view available for Ranked Custom. |
| **Profile** | Team Builder ELO/rank and Ranked Queue ELO/rank (or “Unranked” when no queue games). Game history, favorite teammates. |
| **Chat** | Game channels, DMs, group channels. |
| **Auth** | Login with username/password or Google. Register (rate-limited by IP). First user is admin. |
| **Admin** | User management (list, delete, ban), KPIs, activity graphs (admin-only). |

**Tech stack:** Next.js 15 (App Router), React 18, TypeScript, Prisma, PostgreSQL, NextAuth v5 (beta), MUI, Tailwind CSS, Recharts.

---

## 2. Getting started

### Prerequisites

- **Node.js** 18+
- **PostgreSQL** (local or remote, e.g. Neon)
- **npm** (or pnpm)

### Install

```bash
npm install
```

### Environment

Copy `.env.example` to `.env` (or `.env.local`) and set:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL URL, e.g. `postgresql://USER:PASSWORD@localhost:5432/team_balancer?schema=public` |
| `AUTH_SECRET` | Secret for NextAuth (e.g. `openssl rand -base64 32`) |
| `AUTH_GOOGLE_ID` | Google OAuth client ID (optional) |
| `AUTH_GOOGLE_SECRET` | Google OAuth client secret (optional) |

### Database

```bash
npm run db:generate
npm run db:push
```

For production: `npm run db:push:prod` (uses `.env`). Optional: inspect data with `npm run db:studio`.

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Static assets (images)

Next.js serves static files only from the **`public/`** directory. Put image (or other asset) files in `public/` so they are available at the root URL, e.g.:

- `public/images/Alysia.png` → [http://localhost:3000/images/Alysia.png](http://localhost:3000/images/Alysia.png)

**Do not** create symlinks or junctions to folders outside `public/`. Instead, **copy or move** your files into `public/` (e.g. `public/images/`).

---

## 3. Application guide

### 3.1 Home (`/`)

- Summary of all games: current season and top players (parallel fetch for all games).
- Links to each game’s full ranking (Ranked Custom). Survival Chaos: lower is better; others: higher ELO is better.

### 3.2 Team Builder (`/team-builder`)

- **Game & season** — Select game (LoL, Overwatch, Battlerite, Survival Chaos) and use current season.
- **Players** — Add names; suggestions from ranking players and registered users. List is stored in **localStorage**.
- **Ratings** — 1–10 per player; teams are balanced by total rating (Yin vs Yang).
- **Shared games** — “Start game” creates a **pending** shared game. When any user has an active shared game (they are in it), they see **only** the result-posting view: list of shared games with MatchCard layout (Team Yin | VS | Team Yang), Cancel (creator), Yin Won / Yang Won or Submit placements (SC), or “Game finished”. There is no “Continue to team builder” — everyone stays on result view until games are resolved.
- **Submitting results** — To submit “Yin Won” / “Yang Won” (or SC placements): app must have **at least 10 registered users**; for Team Builder, **all players in the game** (or minimum required for LoL/OW/SC) must have an account. Otherwise “Game finished” marks the game as finished without updating rankings.
- **Banned users** — See suspension message with time left; cannot use Team Builder until the ban expires.

### 3.3 Ranking (`/ranking`, `/ranking/rankedcustom`, `/ranking/rankedqueue`)

- **Index** (`/ranking`) — Centered layout with two cards: **Ranked Custom** (Team Builder games) and **Ranked Queue** (queue matchmaking). Each shows a ladder preview (e.g. top 5 LoL). Links to `/ranking/rankedcustom` and `/ranking/rankedqueue`.
- **Ranked Custom** — Sidebar: game links (LoL, OW, SC, Battlerite), **Ranked Custom** (blue, current) and **Ranked Queue** (gold) buttons, Leaderboard/Table toggle. Leaderboard: rows = players, ELO; Table: rows = games. Season dropdown, CSV export. Admin-only: validate, end season, delete current season.
- **Ranked Queue** — Same game sidebar; **Ranked Queue** (gold, current) and **Ranked Custom** (blue) buttons. Leaderboard only (no table view). Uses `source=ranked_queue` for ranking data.
- **Score rules:** LoL/OW/Battlerite = 0 (loss) / 1 (win); Survival Chaos = 1–4 (placement).

### 3.4 Queue matchmaking

- **Navbar** — “Play” opens queue modal: choose game (LoL, OW), Join queue. When in queue, list of queued players and timer; Leave queue. When 10 are in queue, the next GET `/api/queue` creates a match; user sees a queue-pop modal (click to go to match) and a red “Ongoing game” nav button linking to `/queue-match/[gameId]`.
- **Queue-match page** (`/queue-match/[gameId]`) — Single card: overline “Queue match”, game name, Team Yin | VS | Team Yang (with ELO and player list). Current user’s name is highlighted with a golden border. Footer: “Yin won” / “Yang won” (only losing side can submit in UI). After submit, result recorded and badge disappears.

### 3.5 Profile (`/profile`, `/profile/[username]`)

- Requires login for own profile. Shows **Team Builder** ELO/rank and **Ranked Queue** ELO/rank (or “Unranked” for queue when no queue games). Game history, favorite teammates per game.

### 3.6 Admin (`/admin`)

- **Visible only to admins.** User management: list users, delete (except self), ban (1h / 1d / 7d / 30d) or unban. KPIs: total users, team games, ranking results, banned count; breakdowns for last 7d/30d. Graphs: users over time, team builder games by day, ranking results by day.

### 3.7 Auth & Search

- **Login** (`/login`) — Username/password or Google.
- **Register** (`/register`) — Username + password (min 6 chars). One account per IP per 10 minutes. First user becomes admin.
- **Search** (`/search`) — User search (e.g. for profiles).

### 3.8 Chat

- Game channels, DMs, group channels. Accessible from navbar/bottom bar when implemented.

---

## 4. Database (Prisma)

### 4.1 Schema overview

| Model | Purpose |
|-------|---------|
| **User** | Auth: id, username, name, email, password?, role, bannedUntil?, lastSeenAt?, createdAt. |
| **Account** | OAuth (e.g. Google) linked to User. |
| **Session** | NextAuth DB sessions. |
| **VerificationToken** | NextAuth verification tokens. |
| **RegistrationAttempt** | Rate limit: ip, createdAt (one registration per IP per 10 min). |
| **QueueEntry** | One row per user in queue: userId (unique), gameType, joinedAt. |
| **GameResult** | Legacy per-user scores; not used by main ranking UI. |
| **RankingPlayer** | One row per (name, gameType, season); `scores` = JSON array of numbers. |
| **GameSeason** | gameType → maxSeason (current season number). |
| **SeasonMeta** | Per (gameType, season): validatedIndices, validatedPlayerIds (JSON). |
| **TeamBuilderGame** | Shared/queue game: gameType, season, teamA/teamB (JSON), status, winner?, createdById, **source** (`team_builder` \| `ranked_queue`). |
| **PlayerGameRating** | Per-player ELO cache (e.g. for queue matchmaking). |
| **ChatChannel** | type (game \| dm \| group), gameType?, dmUser1Id?, dmUser2Id?, name? (group). |
| **ChatChannelMember** | channelId, userId. |
| **ChatMessage** | channelId, senderId, content, createdAt. |
| **UserChannelRead** | userId, channelId, readAt. |
| **UserClosedDm** | userId, channelId (closed DMs). |

### 4.2 Key fields

**User**

- `role`: `"admin"` \| `"user"`.
- `bannedUntil`: if set and in the future, user cannot log in and sees ban message on Team Builder.
- `lastSeenAt`: used for “online” list and nav API.

**TeamBuilderGame**

- `status`: `"pending"`, `"result_submitted"`, `"finished"`, `"cancelled"`.
- `source`: `"team_builder"` (Team Builder shared games) or `"ranked_queue"` (queue-popped matches). Only `team_builder` pending games count for Team Builder badge; `ranked_queue` pending shows “Ongoing game” in navbar.

### 4.3 Valid game types

`lol`, `ow`, `sc`, `battlerite`. Queue matchmaking runs only for `lol` and `ow`.

### 4.4 Commands

```bash
npm run db:generate   # Regenerate Prisma client after schema change
npm run db:push       # Apply schema to local DB (.env.local)
npm run db:push:prod  # Apply schema to prod DB (.env)
npm run db:studio     # Open Prisma Studio (local)
```

---

## 5. API reference

### Auth

| Method | Route | Auth | Description |
|--------|--------|------|-------------|
| * | `/api/auth/[...nextauth]` | — | NextAuth (login, callback, session). |
| POST | `/api/auth/register` | No | Register: body `{ login, password, confirmPassword }`. Rate-limited by IP (10 min). |

### Users

| Method | Route | Auth | Description |
|--------|--------|------|-------------|
| GET | `/api/users/names` | Session | List of names/usernames (Team Builder autocomplete). |
| GET | `/api/users/search?q=` | Session | Search users by name/username. |
| GET | `/api/users/[username]/stats` | No | Public profile stats (Team Builder + Ranked Queue ELO/rank). |
| GET | `/api/users/[username]/game-history` | No | Public game history. |

### Profile

| Method | Route | Auth | Description |
|--------|--------|------|-------------|
| GET | `/api/profile/stats` | Session | Own stats (games, win rate, teammates, both ELOs). |
| GET | `/api/profile/game-history` | Session | Own game history. |

### Nav (combined)

| Method | Route | Auth | Description |
|--------|--------|------|-------------|
| GET | `/api/nav` | Session | Combined: `pendingGamesCount`, `ongoingQueueMatchId`, `online` (users). Updates `lastSeenAt`. Use instead of separate pending + online for navbar. |

### Queue

| Method | Route | Auth | Description |
|--------|--------|------|-------------|
| GET | `/api/queue` | Session | My queue entry, `playersByGame`, `gameLabels`. If 10 in queue for lol/ow, creates match and returns `matchedGame`, `recentlyMatchedGameId`. |
| POST | `/api/queue/join` | Session | Join queue: body `{ gameType }` (lol \| ow). |
| POST | `/api/queue/leave` | Session | Leave queue. |

### Online

| Method | Route | Auth | Description |
|--------|--------|------|-------------|
| GET | `/api/online` | Session | List of users with `lastSeenAt` in last 5 minutes. Updates current user’s `lastSeenAt`. |

### Ranking

| Method | Route | Auth | Description |
|--------|--------|------|-------------|
| GET | `/api/ranking/[game]` | No | Ranking for game; `?season=N`, `?source=ranked_queue` (default `team_builder`). |
| PUT | `/api/ranking/[game]` | Session | Upsert players and validation (body: season, players, validatedGameIndices, validatedPlayerIds). |
| POST | `/api/ranking/[game]/end-season` | Session | Increment max season. |
| POST | `/api/ranking/[game]/delete-current-season` | Admin | Delete current season and decrement max. |
| GET | `/api/ranking` | Session | Legacy GameResult API (not used by main UI). |

### Team Builder

| Method | Route | Auth | Description |
|--------|--------|------|-------------|
| GET | `/api/team-builder/games` | Session | List games; `?status=pending` (default). Returns only games where user is in teamA or teamB. |
| GET | `/api/team-builder/games/[id]` | Session | Single game (user must be in game or admin). |
| POST | `/api/team-builder/games` | Session | Create shared game: body `{ gameType, season, teamA, teamB }`. |
| POST | `/api/team-builder/games/[id]/result` | Session | Submit result: body `{ winner: "yin" \| "yang" }`. Requirements: ≥10 users, all players registered (or min for LoL/OW/SC). |
| POST | `/api/team-builder/games/[id]/finish` | Session | Mark game as finished (no ranking update). |
| POST | `/api/team-builder/games/[id]/cancel` | Session | Cancel pending game (creator or admin). |
| GET | `/api/team-builder/can-validate` | No | `{ canValidate, userCount, minRequired: 10 }`. |
| GET | `/api/team-builder/average-ratings` | Session | Average ratings for names (Team Builder). |
| GET | `/api/team-builder/last-game` | Session | Last game for gameType (prefill). |
| POST | `/api/team-builder/games/cancel-all` | Session | Cancel all pending games (creator). |

### Admin

| Method | Route | Auth | Description |
|--------|--------|------|-------------|
| GET | `/api/admin/users` | Admin | List all users. |
| GET | `/api/admin/stats` | Admin | KPIs and time-series for charts. |
| DELETE | `/api/admin/users/[id]` | Admin | Delete user (cannot delete self). |
| PATCH | `/api/admin/users/[id]` | Admin | Update user; body `{ bannedUntil: string \| null }`. |

### Chat

| Method | Route | Auth | Description |
|--------|--------|------|-------------|
| GET | `/api/chat/channels` | Session | List channels (game, DMs, groups). |
| GET | `/api/chat/channels/[channelId]/messages` | Session | Messages for channel. |
| POST | `/api/chat/channels/[channelId]/read` | Session | Mark channel read. |
| POST | `/api/chat/channels/[channelId]/leave` | Session | Leave channel. |
| GET | `/api/chat/users` | Session | Users for chat (search/invite). |
| POST | `/api/chat/dm` | Session | Open or get DM channel. |
| POST | `/api/chat/group` | Session | Create group channel. |
| POST | `/api/chat/dm/close` | Session | Close DM. |

---

## 6. Auth, roles & bans

- **Login:** `/login` — Username/password (credentials) or Google. Banned users (`bannedUntil` > now) are rejected at login.
- **Register:** `/register` — Username + password (min 6 chars). One registration per IP per 10 minutes. First user gets `role: "admin"`.
- **Session:** JWT, 30 days. Role and `bannedUntil` read from DB in session callback.
- **Admin:** Required for admin console, delete current season, ranking admin actions. Check: `session?.user?.role === "admin"`.
- **Ban:** Set via admin (PATCH `/api/admin/users/[id]`). Login blocked; Team Builder shows “Account suspended” with time left.

---

## 7. Project structure

```
src/
  app/
    layout.tsx
    page.tsx                          # Home (game summary cards, parallel fetch)
    globals.css
    login/, register/
    profile/
      page.tsx                        # Own stats (Team Builder + Ranked Queue ELO)
      [username]/page.tsx, game-history/
    admin/
      layout.tsx, page.tsx
    team-builder/
      page.tsx                        # Team Builder + shared games (MatchCard layout)
    ranking/
      page.tsx                        # Ranking index (RankingIndexClient)
      RankingIndexClient.tsx          # Centered ladder preview (Ranked Custom / Ranked Queue)
      RankingGameNav.tsx              # Sidebar for Ranked Custom (blue/gold buttons)
      rankedcustom/
        layout.tsx, page.tsx
        [game]/page.tsx               # LeaderboardClient
        table/[game]/page.tsx         # Table view
      rankedqueue/
        layout.tsx, page.tsx
        [game]/page.tsx
      [game]/LeaderboardClient.tsx    # Shared leaderboard UI
    queue-match/
      [gameId]/page.tsx               # Queue-popped match: teams + submit result
    search/page.tsx
    api/
      auth/[...nextauth], register/
      users/names, search, [username]/stats, game-history/
      nav/route.ts                    # GET: pendingGamesCount, ongoingQueueMatchId, online
      profile/stats, game-history/
      queue/route.ts, join, leave/
      online/route.ts
      ranking/route.ts, [game]/route.ts (GET ?source=ranked_queue), end-season, delete-current-season/
      team-builder/
        can-validate, average-ratings, last-game/
        games/route.ts, cancel-all/
        games/[id]/route.ts (GET single), result, finish, cancel/
      admin/users, users/[id], stats/
      chat/channels, channels/[id]/messages, read, leave, users, dm, group, dm/close/
  components/
    Navbar.tsx                        # Links, Play (queue), Ongoing game, Online, Admin
    MatchCard.tsx                     # MatchCard, TeamColumn, TeamPlayerRow, VsDivider
    BottomBar.tsx, ChatPanel.tsx, LeaveQueueOnUnload.tsx
    ThemeProvider.tsx, SessionProvider.tsx
  lib/
    auth.ts
    prisma.ts
    teamBalancer.ts                   # balanceTeams for Team Builder
    queueMatchmaking.ts               # getElosForPlayers, balanceTeams for queue
    elo.ts, eloReplay.ts
    sanitizeInput.ts
prisma/
  schema.prisma
scripts/
  set-admin.mjs
  seed-queue.mjs                      # Dev only: seed 10 users into queue
  pop-queue.mjs                       # Prod-safe: seed queue (--confirm on prod)
  clear-queue.mjs                    # Clear queue (--confirm, optional --game)
  cancel-pending-games.mjs
  seed-test-users.mjs
  make-yin-yang-transparent.mjs
```

---

## 8. Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (typecheck + next dev). |
| `npm run build` | Production build. |
| `npm run start` | Start production server. |
| `npm run lint` | ESLint. |
| `npm run db:generate` | Regenerate Prisma client. |
| `npm run db:push` | Apply schema to DB (`.env.local`). |
| `npm run db:push:prod` | Apply schema to prod DB (`.env`). |
| `npm run db:studio` | Prisma Studio (local). |
| `npm run games:cancel-all` | Cancel all pending team-builder games. |
| `npm run set-admin` | Grant admin: `node scripts/set-admin.mjs <username>`. |

**Node scripts:**

| Script | Description |
|--------|-------------|
| `scripts/set-admin.mjs <username>` | Set user role to admin. |
| `scripts/seed-queue.mjs [lol\|ow]` | **Dev only.** Seed 10 users into queue; next GET /api/queue pops. Refuses to run when DATABASE_URL/NODE_ENV look like prod. Use: `npx dotenv -e .env.local -- node scripts/seed-queue.mjs lol`. |
| `scripts/pop-queue.mjs [lol\|ow] [--confirm]` | Seed 10 users into queue. Allowed on prod; `--confirm` required when DB looks like prod. |
| `scripts/clear-queue.mjs [--confirm] [--game lol\|ow]` | Remove all queue entries. `--confirm` required on prod; `--game` limits to one game type. |
| `scripts/cancel-pending-games.mjs` | Cancel all pending team-builder games (used by `games:cancel-all`). |
| `scripts/seed-test-users.mjs` | Create test users (e.g. test5–test14, password `azerty`). |

---

## 9. Deployment

- **Secrets:** Do not commit `.env` / `.env.local`. Use your host’s environment (Vercel, Railway, etc.) for `DATABASE_URL`, `AUTH_SECRET`, and optional Google OAuth.
- **Database:** Run `npm run db:push:prod` (or migrations) against the production DB after setting `DATABASE_URL`.
- **First admin:** Register the first user (they become admin) or create a user in the DB and run `set-admin.mjs` with the prod DB URL.
- **Performance:** Home page fetches ranking in parallel; navbar uses `/api/nav` for pending + online in one request. For faster hosted performance, use the same region for the app and DB (e.g. Vercel + Neon in the same region).

Use this doc to onboard, run the app, understand the DB and APIs, and extend or change behavior. For implementation details, refer to the code in `src/` and `prisma/schema.prisma`.
