# INTRA — Team Balancer & Rankings

A web app for building balanced teams and tracking game rankings. Create even teams (Yin/Yang), share games with others, submit results, and rank via **Team Builder** games or **Ranked Queue** matchmaking.

![INTRA](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js)  
Next.js 15 · React 18 · TypeScript · Prisma · PostgreSQL · NextAuth · MUI · Tailwind

---

## Features

- **Team Builder** — Add players with 1–10 ratings; get two balanced teams. Start a shared game so everyone in the match sees it and can submit the result (when eligible). Once a game is shared, all players (including the creator) see only the result-posting view until the game is finished or cancelled.
- **Ranked Queue** — Join a queue per game (LoL, Overwatch). When 10 players are in queue, a match is created automatically; you’re redirected to the queue-match page to post the result. ELO and rank are tracked separately from Team Builder.
- **Rankings** — Two ladders: **Ranked Custom** (Team Builder games) and **Ranked Queue** (queue matchmaking). Per-game tables (LoL, Overwatch, Survival Chaos, Battlerite) with seasons, validation, and CSV export. Ranking index page shows a ladder preview for each.
- **Profile** — Per-user stats: **Team Builder** ELO/rank and **Ranked Queue** ELO/rank (or “Unranked” when no queue games). Game history and favorite teammates.
- **Chat** — Game channels, DMs, and group channels (when enabled).
- **Auth** — Register (username/password) or sign in with Google. First user is admin.
- **Admin** — User management (list, delete, ban), KPIs, and activity graphs (admin-only).
- **Safeguards** — Registration rate limit (one account per IP per 10 min). Result submission requires ≥10 registered users and (for Team Builder) all players in the game to have an account. “Game finished” to close games that can’t be submitted.

---

## Quick start

### Prerequisites

- Node.js 18+
- PostgreSQL

### 1. Install

```bash
git clone https://github.com/YOUR_USERNAME/team-balancer.git
cd team-balancer
npm install
```

### 2. Environment

Copy `.env.example` to `.env` (or `.env.local`) and set:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/team_balancer?schema=public"
AUTH_SECRET="your-secret"   # e.g. openssl rand -base64 32
# Optional Google login:
AUTH_GOOGLE_ID=""
AUTH_GOOGLE_SECRET=""
```

### 3. Database

```bash
npm run db:generate
npm run db:push
```

For production DB (e.g. Neon), use your prod env and:

```bash
npm run db:push:prod
```

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Register the first user (they become admin).

---

## Main routes

| Route | Description |
|-------|-------------|
| `/` | Home — game summaries and links to rankings |
| `/team-builder` | Build teams, start shared games, submit or finish games |
| `/ranking` | Ranking hub — choose **Ranked Custom** or **Ranked Queue** (ladder preview) |
| `/ranking/rankedcustom`, `/ranking/rankedcustom/[game]` | Team Builder ladder (LoL, OW, SC, Battlerite) |
| `/ranking/rankedqueue`, `/ranking/rankedqueue/[game]` | Queue matchmaking ladder |
| `/ranking/rankedcustom/table/[game]` | Table view (rows = games) for Ranked Custom |
| `/queue-match/[gameId]` | Queue-popped match: view teams, submit Yin/Yang won |
| `/profile` | Your stats (Team Builder + Ranked Queue ELO/rank) |
| `/profile/[username]` | Public profile and game history |
| `/admin` | Admin console (admin only) |
| `/login`, `/register` | Auth |
| `/search` | User search |

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run db:generate` | Regenerate Prisma client |
| `npm run db:push` | Apply schema to DB (uses `.env.local`) |
| `npm run db:push:prod` | Apply schema to prod DB (uses `.env`) |
| `npm run db:studio` | Open Prisma Studio (local) |
| `npm run games:cancel-all` | Cancel all pending team-builder games |
| `npm run set-admin` | Grant admin: `node scripts/set-admin.mjs <username>` |

**Node scripts (run with `node` or `npx dotenv -e .env.local -- node`):**

| Script | Description |
|--------|-------------|
| `scripts/set-admin.mjs <username>` | Grant admin role to user |
| `scripts/seed-queue.mjs [lol\|ow]` | **Dev only.** Seed 10 users into queue so next GET /api/queue pops. Refuses to run on prod. |
| `scripts/pop-queue.mjs [lol\|ow] [--confirm]` | Seed 10 users into queue (allowed on prod; `--confirm` required when DB looks like prod). |
| `scripts/clear-queue.mjs [--confirm] [--game lol\|ow]` | Remove all queue entries. `--confirm` required on prod. |
| `scripts/cancel-pending-games.mjs` | Cancel all pending team-builder games (used by `games:cancel-all`). |
| `scripts/seed-test-users.mjs` | Create test users (e.g. test5–test14, password `azerty`). |

---

## Documentation

For a full guide to the app, database, API, and project structure, see **[DOCUMENTATION.md](./DOCUMENTATION.md)**.

---

## License

Use and modify as you like.
