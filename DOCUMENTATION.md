# INTRA — Team Balancer & Rankings

Documentation for the **INTRA** application: balanced team building and per-game rankings with seasons.

---

## 1. Overview

**INTRA** lets you:

- **Build balanced teams** — Add players with a 1–10 rating; the app splits them into two teams (Yin / Yang) with minimal rating imbalance. You can record which team won to update rankings.
- **Track rankings per game** — Per-game, per-season tables where each column is a player and each row is a game. Scores are win/loss (0/1) for LoL, Overwatch, Battlerite, or 1–4 for Survival Chaos. Averages and win rates are computed.
- **Use auth optionally** — Sign in with email/password or Google. The first registered user becomes **admin**; admins can edit rankings, end seasons, and delete the current season. The app works without an account for viewing and for the Team Builder (ranking updates still work).

**Tech stack:** Next.js 15 (App Router), React 18, TypeScript, Prisma, PostgreSQL, NextAuth v5 (beta), MUI (Material UI), Tailwind CSS.

---

## 2. Getting started

### Prerequisites

- **Node.js** (v18+)
- **PostgreSQL** (running locally or remote)
- **pnpm** or **npm**

### Install

```bash
npm install
# or
pnpm install
```

### Environment

Copy `.env.example` to `.env.local` and set:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string, e.g. `postgresql://USER:PASSWORD@localhost:5432/team_balancer?schema=public` |
| `AUTH_SECRET` | Random secret for NextAuth (e.g. `openssl rand -base64 32`) |
| `AUTH_GOOGLE_ID` | Google OAuth client ID (optional; leave empty to disable Google login) |
| `AUTH_GOOGLE_SECRET` | Google OAuth client secret (optional) |

### Database

Generate the Prisma client and push the schema (creates/updates tables):

```bash
npm run db:generate
npm run db:push
```

Optional: open Prisma Studio to inspect/edit data:

```bash
npm run db:studio
```

### Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## 3. How to use the app

### 3.1 Home (`/`)

- Shows a **summary** of all four games (LoL, Overwatch, Survival Chaos, Battlerite): current season and top 10 players by average (and win rate where applicable).
- **Survival Chaos** is “lower is better”; others are “higher is better.”
- Click a card or “Full ranking” to go to that game’s ranking page.

### 3.2 Team Builder (`/team-builder`)

1. **Select game and season** — Use the dropdowns (e.g. LoL, Season 2).
2. **Add players** — Type a name (suggestions come from existing ranking players and, if logged in, registered user names). Click “Add player.” Players are stored in **localStorage** so your list persists.
3. **Set ratings** — Each player has a 1–10 slider. The algorithm splits players into **Yin** and **Yang** so total rating is as even as possible (one team may have one extra if odd count).
4. **Record result** — After a game, click “Yin Won” or “Yang Won,” confirm in the dialog. The app adds a new game column to the ranking for that game/season: winners get 1, losers 0 (for LoL/OW/Battlerite). The ranking view and home summary update (including via the `rankingUpdated` event).

There is also a **timer** (“RESPECTE MON TEMPS”) for session length.

### 3.3 Ranking (`/ranking`, `/ranking/[game]`)

- **Navigation** — Default ranking route redirects to `/ranking/lol`. Use the left sidebar to switch between LoL, Overwatch, Survival Chaos, Battlerite.
- **Season** — Use the “Season” dropdown to view a past or the current season.
- **Table** — Rows = games (1, 2, 3, …), columns = players. First data row is **total** (player averages). Score rules:
  - **LoL, Overwatch, Battlerite:** 0 = loss, 1 = win.
  - **Survival Chaos (sc):** 1–4 (e.g. placement).
- **Admin-only actions** (when logged in as admin):
  - **Add player** — New column.
  - **Add game** — New row.
  - **Validate row** — Lock a game row (✓); validated rows are read-only until “unvalidated” (edit icon).
  - **Validate player** — Lock player name (✓); then you can still edit name via edit icon.
  - **End season** — Increment season (e.g. Season 2 → 3); current season becomes read-only in the dropdown.
  - **Reset** — Clear all players and data for the current season (irreversible).
  - **Delete current season** — Remove the latest season and its data; max season goes back by one (admin only, irreversible).
- **Export CSV** — Download current view (game index, player names, totals, per-game scores) as CSV.

**Validation:** In the current season, admins can validate game rows and player names. Validated state is stored in `SeasonMeta` and used to show edit vs read-only in the UI.

---

## 4. Database (Prisma / PostgreSQL)

### 4.1 Schema overview

| Model | Purpose |
|-------|---------|
| **User** | Auth users (email, optional password, name, image, role). |
| **Account** | OAuth accounts (e.g. Google) linked to User. |
| **Session** | NextAuth DB sessions (adapter). |
| **VerificationToken** | NextAuth verification tokens. |
| **GameResult** | Legacy/unused in current UI: per-user game scores (e.g. 0–100). |
| **RankingPlayer** | One row per (player name, game, season); `scores` is a JSON array of numbers (one per game). |
| **GameSeason** | Per-game current season: `gameType` (e.g. `lol`), `maxSeason` (integer). |
| **SeasonMeta** | Per (game, season): `validatedIndices` (JSON array of game row indices), `validatedPlayerIds` (JSON array of player IDs). |

### 4.2 Tables in detail

**User**

- `id` (cuid), `name`, `email` (unique), `emailVerified`, `image`, `password` (nullable), `role` (`"admin"` \| `"user"`).
- First user created via register API gets `role: "admin"`.

**Account** (NextAuth)

- `userId`, `provider`, `providerAccountId`, tokens, etc. Unique on `(provider, providerAccountId)`.

**Session** (NextAuth)

- `sessionToken`, `userId`, `expires`.

**RankingPlayer**

- `id` (cuid), `name`, `gameType`, `season`, `scores` (JSON text, e.g. `"[0,1,null,1]"`), `updatedAt`.
- Unique on `(name, gameType, season)`.

**GameSeason**

- `gameType` (PK), `maxSeason` (default 1). Tracks the latest season number per game.

**SeasonMeta**

- Composite PK `(gameType, season)`. `validatedIndices`: JSON array of game row indices that are “validated”; `validatedPlayerIds`: JSON array of player IDs that are “validated.”

**GameResult** (optional / legacy)

- `userId`, `gameType`, `score` (float), `createdAt`. Used by `/api/ranking` GET/POST for an alternative ranking by user; not used by the main ranking UI which uses `RankingPlayer` + `SeasonMeta`.

### 4.3 Valid game types

Used in APIs and UI: `lol`, `ow`, `sc`, `battlerite`.

### 4.4 Useful commands

```bash
npm run db:generate   # Regenerate Prisma client after schema change
npm run db:push       # Apply schema to DB (no migrations)
npm run db:studio     # Open Prisma Studio
```

---

## 5. API (summary)

| Method | Route | Auth | Description |
|--------|--------|------|-------------|
| GET/POST | `/api/auth/[...nextauth]` | — | NextAuth handlers (login, callback, etc.). |
| POST | `/api/auth/register` | No | Register (email, password, optional name). |
| GET | `/api/users/names` | Session | List of user names (for Team Builder suggestions). |
| GET | `/api/ranking/[game]` | No | Get ranking for `game`; query `?season=N`. Returns players, maxSeason, validatedIndices, validatedPlayerIds. |
| PUT | `/api/ranking/[game]` | No | Upsert players and optional validation for a season (body: season, players, validatedGameIndices, validatedPlayerIds). |
| POST | `/api/ranking/[game]/end-season` | No | Increment max season for game. |
| POST | `/api/ranking/[game]/delete-current-season` | Admin | Delete current season data and decrement max season. |
| GET/POST | `/api/ranking` | Yes | Legacy: list/post GameResult by game type (not used by main ranking UI). |

---

## 6. Auth & roles

- **Login:** `/login` — Email/password or Google (if configured).
- **Register:** `/register` — Email + password (min 6 chars); first user becomes **admin**.
- **Session:** JWT, 30 days. Role stored in token and synced from DB when needed.
- **Admin:** Required only for “Delete current season.” Other ranking write operations (PUT ranking, end season) are not restricted by role in the API; the UI shows admin-only buttons based on `session?.user?.role === "admin"`.

---

## 7. Project structure (main paths)

```
src/
  app/
    page.tsx                 # Home (game cards)
    layout.tsx                # Root layout (Navbar, ThemeProvider, SessionProvider)
    login/, register/        # Auth pages
    team-builder/page.tsx    # Team Builder
    ranking/
      page.tsx               # Redirect to /ranking/lol
      layout.tsx             # Ranking layout + RankingGameNav
      [game]/page.tsx        # Ranking page (server); passes game + isAdmin
      [game]/RankingClient.tsx  # Full ranking table UI
      RankingGameNav.tsx     # Sidebar links (LoL, OW, SC, Battlerite)
    api/
      auth/[...nextauth]/route.ts
      auth/register/route.ts
      users/names/route.ts
      ranking/route.ts       # Legacy GameResult API
      ranking/[game]/route.ts         # GET/PUT ranking
      ranking/[game]/end-season/route.ts
      ranking/[game]/delete-current-season/route.ts
  components/
    Navbar.tsx, MainWrapper.tsx, ThemeProvider.tsx, SessionProvider.tsx
  lib/
    auth.ts        # NextAuth config
    prisma.ts      # Prisma client singleton
    teamBalancer.ts  # balanceTeams(players) → { teamA, teamB, scores, imbalance }
prisma/
  schema.prisma   # DB schema
```

---

## 8. Pushing to GitHub

### Will `.env.local` be a problem?

**No.** `.env.local` is in `.gitignore` (as `.env*.local`), so Git will **never** commit or push it. Your secrets stay only on your machine.

- **Do commit** `.env.example` (it has no secrets; it just lists variable names and placeholders).
- **Never** commit `.env`, `.env.local`, or any file with real keys or passwords.

### Steps to upload to GitHub

1. **Create a new repository on GitHub**
   - Go to [github.com/new](https://github.com/new).
   - Name it e.g. `team-balancer`, leave it empty (no README, no .gitignore).

2. **Initialize Git and push from your project**
   - In the project folder (`team-balancer`), run:

   ```bash
   git init
   git add .
   git status
   ```
   - Check that **`.env.local` does not appear** under "Changes to be committed". If it does, do not commit; fix `.gitignore` first.
   - Then:

   ```bash
   git commit -m "Initial commit: INTRA team balancer"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/team-balancer.git
   git push -u origin main
   ```
   - Replace `YOUR_USERNAME` and `team-balancer` with your GitHub username and repo name.

3. **Deploying later (Vercel, Railway, etc.)**
   - Do **not** put `.env.local` in the repo.
   - On the host, set the same variables (e.g. `DATABASE_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_*`) in the project’s environment / settings. Use `.env.example` as a checklist.

---

You can use this doc to onboard, run the app, understand the DB, and extend or change behavior. For code changes or new features, refer to the sections above and the code in `src/` and `prisma/`.
