# INTRA — Team Balancer & Rankings

A web app for building balanced teams and tracking game rankings. Create even teams (Yin/Yang), share games with others, and submit results to update per-game, per-season leaderboards.

![INTRA](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js)  
Next.js 15 · React 18 · TypeScript · Prisma · PostgreSQL · NextAuth · MUI · Tailwind

---

## Features

- **Team Builder** — Add players with 1–10 ratings; get two balanced teams. Start a shared game so everyone in the match can see it and submit the result (when eligible).
- **Rankings** — Per-game tables (LoL, Overwatch, Survival Chaos, Battlerite) with seasons, validation, and CSV export.
- **Auth** — Register (username/password) or sign in with Google. First user is admin. Optional profile with stats and favorite teammates.
- **Admin console** — User management (list, delete, ban), KPIs, and activity graphs (admin-only).
- **Safeguards** — Registration rate limit (one account per IP per 10 min). Result submission requires ≥10 registered users and all players in the game to have an account. “Game finished” to close games that can’t be submitted.

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
| `/ranking` | Redirects to `/ranking/lol` |
| `/ranking/lol`, `/ow`, `/sc`, `/battlerite` | Per-game ranking tables |
| `/profile` | Your stats (login required) |
| `/admin` | Admin console (admin only) |
| `/login`, `/register` | Auth |

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run db:generate` | Regenerate Prisma client |
| `npm run db:push` | Apply schema to DB |
| `npm run set-admin` | Grant admin: `node scripts/set-admin.mjs <username>` |

---

## Documentation

For a full guide to the app, database, API, and project structure, see **[DOCUMENTATION.md](./DOCUMENTATION.md)**.

---

## License

Use and modify as you like.
