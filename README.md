# Team Balancer

A modern web app for creating balanced teams and tracking gaming rankings. Built with Next.js, React, Tailwind CSS, Material UI, PostgreSQL, and Auth.js.

## Features

- **Team Builder** — Add players with ratings 1–10; get two balanced teams with equal sizes and minimal score difference
- **Ranking** — Log game results per player; view global rankings by average score. Sub-tabs: LoL, Overwatch, StarCraft, Battlerite
- **Auth** — Google sign-in (Auth.js). Ranking pages require login

## Setup (Local)

### Prerequisites

- Node.js 18+
- PostgreSQL

### 1. Install dependencies

```bash
cd team-balancer
npm install
```

### 2. Environment variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/team_balancer?schema=public"
AUTH_SECRET="generate-with-openssl-rand-base64-32"
AUTH_GOOGLE_ID="your-google-client-id"
AUTH_GOOGLE_SECRET="your-google-client-secret"
```

- **AUTH_SECRET**: Run `openssl rand -base64 32`
- **Google OAuth**: Create credentials at [Google Cloud Console](https://console.cloud.google.com/apis/credentials)

### 3. Database

```bash
npx prisma generate
npx prisma db push
```

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Pages

| Route | Description |
|-------|-------------|
| `/` | Team Builder (no auth) |
| `/login` | Sign in |
| `/ranking` | Redirects to `/ranking/lol` |
| `/ranking/lol` | LoL rankings |
| `/ranking/ow` | Overwatch rankings |
| `/ranking/sc` | StarCraft rankings |
| `/ranking/battlerite` | Battlerite rankings |

## Tech Stack

- **Frontend**: Next.js 15, React 19, Tailwind CSS, Material UI
- **Backend**: Next.js API routes
- **Database**: PostgreSQL + Prisma
- **Auth**: Auth.js (NextAuth v5) + Google
