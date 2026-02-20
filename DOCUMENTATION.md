# INTRA — Documentation

Technical documentation for **INTRA**: balanced team building, shared games, and per-game rankings with seasons. Use this to understand the codebase and modify it.

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
9. [Deployment & GitHub](#9-deployment--github)

---

## 1. Overview

**INTRA** provides:

| Feature | Description |
|--------|-------------|
| **Team Builder** | Add players with 1–10 rating; algorithm splits into Yin/Yang with minimal imbalance. Create shared games and submit results to update rankings. |
| **Rankings** | Per-game, per-season tables (LoL, Overwatch, Survival Chaos, Battlerite). Rows = games, columns = players; scores are win/loss or placement. |
| **Auth** | Login with username/password or Google. Register (rate-limited by IP). First user is admin; admins manage users, rankings, and see the admin console. |
| **Profile** | Per-user stats: games played, win rate, favorite teammates (when logged in). |
| **Admin console** | User management (list, delete, ban), KPIs, and activity graphs (admin-only). |

**Tech stack:** Next.js 15 (App Router), React 18, TypeScript, Prisma, PostgreSQL, NextAuth v5 (beta), MUI, Tailwind CSS, Recharts.

---

## 2. Getting started

### Prerequisites

- **Node.js** 18+
- **PostgreSQL** (local or remote)
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
| `AUTH_GOOGLE_ID` | Google OAuth client ID (optional; omit to disable Google login) |
| `AUTH_GOOGLE_SECRET` | Google OAuth client secret (optional) |

### Database

```bash
npm run db:generate
npm run db:push
```

Optional: inspect data with `npm run db:studio`.

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## 3. Application guide

### 3.1 Home (`/`)

- Summary of all games: current season and top 10 players.
- Survival Chaos: lower is better; others: higher is better.
- Links to each game’s full ranking.

### 3.2 Team Builder (`/team-builder`)

- **Game & season** — Select game (LoL, Overwatch, Battlerite) and use current season.
- **Players** — Add names; suggestions from ranking players and registered users. List is stored in **localStorage**.
- **Ratings** — 1–10 per player; teams are balanced by total rating (Yin vs Yang).
- **Shared games** — “Start game” creates a **pending** shared game. Other players (in the teams) see it under “Games waiting for result.”
- **Submitting results** — To submit “Yin Won” / “Yang Won”:
  - The app must have **at least 10 registered users**.
  - **All players in the game** must have an account (name/username matches a user).
- If result submission is not allowed, a **“Game finished”** button appears: it marks the game as finished (no ranking update) and removes it from the list so a new game can be created.
- **Banned users** — See a suspension message with time left; cannot use Team Builder until the ban expires.

### 3.3 Ranking (`/ranking`, `/ranking/[game]`)

- Default route redirects to `/ranking/lol`. Sidebar: LoL, Overwatch, Survival Chaos, Battlerite.
- **Season** dropdown for current or past seasons.
- **Table:** rows = games, columns = players; first data row = totals (averages).
- **Score rules:** LoL/OW/Battlerite = 0 (loss) / 1 (win); Survival Chaos = 1–4 (placement).
- **Admin-only:** add player/game, validate row/player, end season, reset, delete current season.
- **Export CSV** for the current view.

### 3.4 Profile (`/profile`)

- Requires login. Shows games played, win rate, and favorite teammates per game (from ranking + team builder results).

### 3.5 Admin (`/admin`)

- **Visible only to admins** (link in navbar + layout guard).
- **User management:** list users, delete (except self), ban for 1h / 1d / 7d / 30d or unban.
- **KPIs:** total users, team games, ranking results, banned count; breakdowns for last 7d/30d.
- **Graphs:** users over time, team builder games by day, ranking results by day.

### 3.6 Auth pages

- **Login** (`/login`) — Username/password or Google.
- **Register** (`/register`) — Username + password (min 6 chars). One account per IP per 10 minutes (rate limit). First user becomes admin.

---

## 4. Database (Prisma)

### 4.1 Schema overview

| Model | Purpose |
|-------|---------|
| **User** | Auth: id, username, name, email, password?, role, bannedUntil?, createdAt. |
| **Account** | OAuth (e.g. Google) linked to User. |
| **Session** | NextAuth DB sessions. |
| **VerificationToken** | NextAuth verification tokens. |
| **RegistrationAttempt** | Rate limit: ip, createdAt (one registration per IP per 10 min). |
| **GameResult** | Legacy per-user scores; not used by main ranking UI. |
| **RankingPlayer** | One row per (name, gameType, season); `scores` = JSON array of numbers. |
| **GameSeason** | gameType → maxSeason (current season number). |
| **SeasonMeta** | Per (gameType, season): validatedIndices, validatedPlayerIds (JSON). |
| **TeamBuilderGame** | Shared game: gameType, season, teamA/teamB (JSON), status, winner?, createdById. |

### 4.2 Key fields

**User**

- `role`: `"admin"` \| `"user"`.
- `bannedUntil`: if set and in the future, user cannot log in and sees ban message on Team Builder.
- `createdAt`: used for admin stats and “users over time.”

**TeamBuilderGame**

- `status`: `"pending"` (waiting for result), `"result_submitted"` (result sent to ranking), `"finished"` (ended without recording), `"cancelled"`.
- Only `pending` games are shown in “Games waiting for result.”

**RegistrationAttempt**

- One row per successful registration; used to block another registration from the same IP within 10 minutes.

### 4.3 Valid game types

`lol`, `ow`, `sc`, `battlerite` (used in APIs and UI).

### 4.4 Commands

```bash
npm run db:generate   # Regenerate Prisma client after schema change
npm run db:push       # Apply schema to DB (no migration files)
npm run db:studio     # Open Prisma Studio
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
| GET | `/api/users/names` | Session | List of names/usernames (for Team Builder autocomplete). |

### Profile

| Method | Route | Auth | Description |
|--------|--------|------|-------------|
| GET | `/api/profile/stats` | Session | Games played, win rate, teammates per game. |

### Ranking

| Method | Route | Auth | Description |
|--------|--------|------|-------------|
| GET | `/api/ranking/[game]` | No | Ranking for game; `?season=N`. |
| PUT | `/api/ranking/[game]` | No | Upsert players and validation (body: season, players, validatedGameIndices, validatedPlayerIds). |
| POST | `/api/ranking/[game]/end-season` | No | Increment max season. |
| POST | `/api/ranking/[game]/delete-current-season` | Admin | Delete current season and decrement max. |
| GET/POST | `/api/ranking` | Yes | Legacy GameResult API (not used by main ranking UI). |

### Team Builder

| Method | Route | Auth | Description |
|--------|--------|------|-------------|
| GET | `/api/team-builder/games` | Session | List games; `?status=pending` (default). Returns only games where the user is in teamA or teamB. |
| POST | `/api/team-builder/games` | Session | Create shared game: body `{ gameType, season, teamA, teamB }`. |
| POST | `/api/team-builder/games/[id]/result` | Session | Submit result: body `{ winner: "yin" \| "yang" }`. Requires ≥10 users and all players registered. |
| POST | `/api/team-builder/games/[id]/finish` | Session | Mark game as finished (no ranking update). Creator or a player in the game. |
| GET | `/api/team-builder/can-validate` | No | `{ canValidate, userCount, minRequired: 10 }` for showing submit buttons. |
| POST | `/api/team-builder/games/cancel-all` | Session | Set all pending games to cancelled. |

### Admin

| Method | Route | Auth | Description |
|--------|--------|------|-------------|
| GET | `/api/admin/users` | Admin | List all users (id, username, name, email, role, bannedUntil, createdAt). |
| DELETE | `/api/admin/users/[id]` | Admin | Delete user (cannot delete self). |
| PATCH | `/api/admin/users/[id]` | Admin | Update user; body `{ bannedUntil: string \| null }` (ISO date or null to unban). |
| GET | `/api/admin/stats` | Admin | KPIs and time-series for charts (users/games/results over time). |

---

## 6. Auth, roles & bans

- **Login:** `/login` — Username/password (credentials) or Google. Banned users (bannedUntil > now) are rejected at login.
- **Register:** `/register` — Username + password (min 6 chars). One registration per IP per 10 minutes. First user gets `role: "admin"`.
- **Session:** JWT, 30 days. Role and `bannedUntil` are read from DB in the session callback so the client can show ban state.
- **Admin:** Required for admin console, delete current season, and (in UI) ranking admin actions. Check: `session?.user?.role === "admin"`.
- **Ban:** Set via admin console (PATCH `/api/admin/users/[id]`). Login is blocked; Team Builder shows “Account suspended” with time left.

---

## 7. Project structure

```
src/
  app/
    layout.tsx                    # Root layout (fonts, Navbar, ThemeProvider, SessionProvider)
    page.tsx                      # Home (game summary cards)
    globals.css
    login/
      page.tsx, LoginForm.tsx
    register/
      page.tsx, RegisterForm.tsx
    profile/
      page.tsx                    # User stats (games, win rate, teammates)
    admin/
      layout.tsx                  # Redirects non-admins to /
      page.tsx                    # Admin console (users, KPIs, graphs)
    team-builder/
      page.tsx                    # Team Builder + shared games UI
    ranking/
      page.tsx                    # Redirect to /ranking/lol
      layout.tsx                  # Ranking layout + sidebar
      RankingGameNav.tsx          # LoL, OW, SC, Battlerite links
      [game]/
        page.tsx                  # Server: passes game, isAdmin
        RankingClient.tsx         # Ranking table, admin actions, CSV export
    api/
      auth/
        [...nextauth]/route.ts
        register/route.ts         # Register + IP rate limit
      users/names/route.ts
      profile/stats/route.ts
      ranking/
        route.ts                  # Legacy GameResult
        [game]/
          route.ts                # GET/PUT ranking
          end-season/route.ts
          delete-current-season/route.ts
      team-builder/
        can-validate/route.ts      # GET canValidate, userCount
        games/
          route.ts                # GET (list) / POST (create)
          cancel-all/route.ts
          [id]/
            result/route.ts       # POST submit winner
            finish/route.ts       # POST mark finished
      admin/
        users/
          route.ts                # GET list
          [id]/route.ts           # DELETE, PATCH (ban)
        stats/route.ts            # GET KPIs + chart data
  components/
    Navbar.tsx                    # Links + Admin (if admin) + Profile + Login/Logout
    MainWrapper.tsx
    ThemeProvider.tsx
    SessionProvider.tsx
  lib/
    auth.ts                       # NextAuth config, session callbacks, ban check at login
    prisma.ts                     # Prisma client singleton
    teamBalancer.ts               # balanceTeams(players) → { teamA, teamB, ... }
    sanitizeInput.ts              # sanitizeDisplayName, sanitizePassword
prisma/
  schema.prisma
scripts/
  set-admin.mjs                   # node scripts/set-admin.mjs <username>
  seed-test-users.mjs             # Create test5..test14, password azerty
  cancel-pending-games.mjs       # Used by npm run games:cancel-all
```

---

## 8. Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server. |
| `npm run build` | Production build. |
| `npm run start` | Start production server. |
| `npm run lint` | Run ESLint. |
| `npm run db:generate` | Regenerate Prisma client. |
| `npm run db:push` | Apply schema to DB. |
| `npm run db:studio` | Open Prisma Studio. |
| `npm run games:cancel-all` | Set all pending team-builder games to cancelled. |
| `npm run set-admin` | Grant admin role: `node scripts/set-admin.mjs <username>`. |

**One-off scripts (run with `node`):**

- `scripts/seed-test-users.mjs` — Creates users test5–test14 with password `azerty` (skips existing).

---

## 9. Deployment & GitHub

- **Secrets:** `.env` and `.env.local` are in `.gitignore`. Do not commit them. Use `.env.example` as a template; set the same variables in your host’s environment (Vercel, Railway, etc.).
- **Database:** Run `db:push` or migrations on the host after setting `DATABASE_URL`.
- **First admin:** After deploy, create a user via `/register` (first user is admin) or create a user in DB and run `set-admin` with your DB URL if you have a way to run scripts against the deployed DB.

**Pushing to GitHub:**

```bash
git init
git add .
git status   # Ensure .env.local is not staged
git commit -m "Initial commit: INTRA team balancer"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

Use this doc to onboard, run the app, understand the DB and APIs, and extend or change behavior. For implementation details, refer to the code in `src/` and `prisma/schema.prisma`.
