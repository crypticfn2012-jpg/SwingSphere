# SwingSphere

SwingSphere is a 2D side-view browser swinging platformer built with HTML Canvas and JavaScript, with CrazyGames SDK v3 integration.

## Run locally
```bash
npm install
npm run dev
```

## Production build
```bash
npm run build
npm run preview
```

The production files are generated in `dist/`. Upload the contents of that folder to CrazyGames.

GitHub Actions builds the production game on every push to `main` and stores the `dist/` output as a Pages artifact. To enable automatic deployment, open Settings → Pages and select **GitHub Actions**, then add the repository Actions variable `PAGES_ENABLED=true`. The deployed game will be at `https://crypticfn2012-jpg.github.io/SwingSphere/`.

## Gameplay
- **A / D** or **Left / Right** — steer and build swing momentum
- **Space** — jump from platforms
- **Hold left mouse / touch** on a glowing ring — attach your grappling line
- **Release** — let go and carry your momentum
- **R** — restart
- **Esc** — pause

## Modes and progression
- 10 handcrafted campaign levels
- Endless Swing with generated platforms and hazards
- Floor Is Lava survival climb
- Unlockable ball colours, shapes and trails
- SwingCoins, XP, achievements, daily and playtime rewards
- Local progress saving, optional CrazyGames cloud saving and leaderboard support

## CrazyGames
The HTML5 SDK v3 is loaded in `index.html`. SDK initialization, lifecycle, cloud-save helpers and rewarded ads live in `src/platform/crazygames.js`. The game remains playable when the SDK is unavailable. Cloud saves, leaderboard submission and rewarded ads should be verified in CrazyGames Preview before release.
