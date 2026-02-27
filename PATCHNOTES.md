# Patch notes

What’s new and what changed in INTRA — written for everyone who uses the app.

---

## [Unreleased]

### Game result validation (team builder & queue)
- **Two votes to confirm:** For team games (Yin vs Yang), the result is only confirmed when **two players** submit the same outcome (e.g. two "Yin won" or two "Yang won"). After your vote, a **"Vote recorded"** dialog shows the current counts and explains that two matching votes are required. When a second player agrees, the game is validated and the result is saved.
- **Admins** can validate any game's result (one admin vote confirms immediately) and can cancel any game. **Queue matches** can only be cancelled by an admin; team builder games can be cancelled by the creator or an admin.

### When a game is shared
- If a **team builder game** is shared with you (or you created it), you are **taken straight to the Team Builder** page when the app detects the new game — no popup. The nav poll runs every 5 seconds so this happens quickly.

### Login and home
- **After login**, if you're in an ongoing game (queue match or team builder game), you're **redirected to that game** first instead of the home page. The same redirect applies when you open the home page while already in a game.

### Team Builder
- **Add by name:** Players who are already in the current team are **no longer suggested** in the "add by name" field. You can **select a suggestion and press Enter** to add that player without clicking.
- **"You" highlight** in match views (team builder and queue match): the row for the current user is aligned with teammates and uses an outline so the layout stays consistent.

### Queue & matchmaking
- **Battlerite** is now available in Ranked Queue. When 6 players are in queue, a match is created with two balanced teams of 3. The rest works like League of Legends and Overwatch: join queue, get matched, report who won.
- **Queue match page** no longer errors on empty API responses; after you submit a vote, the "vote recorded" message and vote counts are shown until the result is confirmed.

### Queue match result page
- When reporting who won, the button for **your own team** (e.g. “Yin won” if you’re on Yin) is now greyed out. Only the losing team can submit the result, so you can’t click the wrong button by mistake.

### Ranking
- The ranking hub now shows **Custom leaderboard** and **Ranked leaderboard** (renamed from “Ranked Custom” and “Ranked Queue”) so the two ladders are easier to tell apart.
- On the ranking hub, each ladder shows a **preview for every game** (League of Legends, Overwatch, Survival Chaos, Battlerite) with the game name and top 5. Your own name is highlighted with a **golden border** in the preview when you’re in the top 5.
- Games that don’t have any leaderboard data yet are **no longer shown** in the preview — only games with at least one ranked player appear.
- Preview layout updated: **game names are larger and clearer**, with more spacing so each game’s top 5 is easier to scan. The Ranked leaderboard card is now labeled **“Queue games”** instead of “Queue matchmaking”.

- The short line "Team builder games or Queue games." under "Choose a ladder" has been removed for a cleaner layout.

### Welcome notice
- The **welcome notice** when you first open the app has been updated with all recent features: **Queue games**, **Chat**, and the two leaderboards (Custom and Ranked).
- A new **“Queue games” tab** in the notice explains how queue works: join the queue, get matched when there are enough players (10 for LoL/Overwatch, 6 for Battlerite), report who won, and climb the Ranked leaderboard. It also clarifies that queue uses a separate ladder from team builder games. The notice text and layout have been tightened for readability.

### UI and assets
- **INTRA logo** (yin-yang style) next to "INTRA" uses the new asset and is more visible in the navbar; the home page hero uses a larger version.
- **Vote recorded** dialog (after submitting a result vote) has a clearer layout: centered content, colored Yin/Yang vote counts that span the width, and a single prominent **Dismiss** button. The text now says: "In order to validate the game's result, two matching votes are required."

### Scripts
- **`scripts/cancel-all-ongoing.mjs`** cancels all pending team builder and queue games and clears everyone from the queue. Run with `node scripts/cancel-all-ongoing.mjs`.

### Performance (hosted app)
- **Faster first load:** The chat panel and the welcome notice are now loaded only when needed (e.g. when you open chat or when the notice is shown), so the initial page loads with less code and feels snappier.
- **Ranking data** can be cached briefly by the browser and CDN (20 seconds), so switching between games or refreshing the ranking page is often faster.
- **Fewer requests:** Chat unread count is polled every 5 seconds instead of 3, and the app already uses a single “nav” request for pending games and online list where possible.

---

*(New changes are added under [Unreleased] or under a new date when we release.)*
