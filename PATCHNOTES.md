# Patch notes

What’s new and what changed in INTRA — written for everyone who uses the app.

---

## [Unreleased]

### Queue & matchmaking
- **Battlerite** is now available in Ranked Queue. When 6 players are in queue, a match is created with two balanced teams of 3. The rest works like League of Legends and Overwatch: join queue, get matched, report who won.

### Queue match result page
- When reporting who won, the button for **your own team** (e.g. “Yin won” if you’re on Yin) is now greyed out. Only the losing team can submit the result, so you can’t click the wrong button by mistake.

### Ranking
- The ranking hub now shows **Custom leaderboard** and **Ranked leaderboard** (renamed from “Ranked Custom” and “Ranked Queue”) so the two ladders are easier to tell apart.
- On the ranking hub, each ladder shows a **preview for every game** (League of Legends, Overwatch, Survival Chaos, Battlerite) with the game name and top 5. Your own name is highlighted with a **golden border** in the preview when you’re in the top 5.
- Games that don’t have any leaderboard data yet are **no longer shown** in the preview — only games with at least one ranked player appear.
- Preview layout updated: **game names are larger and clearer**, with more spacing so each game’s top 5 is easier to scan. The Ranked leaderboard card is now labeled **“Queue games”** instead of “Queue matchmaking”.

### Welcome notice
- The **welcome notice** when you first open the app has been updated with all recent features: **Queue games**, **Chat**, and the two leaderboards (Custom and Ranked).
- A new **“Queue games” tab** in the notice explains how queue works: join the queue, get matched when there are enough players (10 for LoL/Overwatch, 6 for Battlerite), report who won, and climb the Ranked leaderboard. It also clarifies that queue uses a separate ladder from team builder games.

### Performance (hosted app)
- **Faster first load:** The chat panel and the welcome notice are now loaded only when needed (e.g. when you open chat or when the notice is shown), so the initial page loads with less code and feels snappier.
- **Ranking data** can be cached briefly by the browser and CDN (20 seconds), so switching between games or refreshing the ranking page is often faster.
- **Fewer requests:** Chat unread count is polled every 5 seconds instead of 3, and the app already uses a single “nav” request for pending games and online list where possible.

---

*(New changes are added under [Unreleased] or under a new date when we release.)*
