# SwingSphere

A 3D browser swinging game built with Three.js, Rapier physics, Vite and the CrazyGames JavaScript SDK v3.

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

## Controls
- **WASD** — steer in the air / move on platforms
- **Space** — jump
- **Hold left mouse** — grapple the highlighted cube
- **Release left mouse** — detach while preserving momentum
- **R** — restart run
- **Esc** — pause

## CrazyGames
The HTML5 SDK v3 is loaded in `index.html`. SDK initialization, lifecycle, cloud-save helpers and rewarded ads live in `src/platform/crazygames.js`. CrazyGames leaderboards are invitation-only and currently support one board per game. This project submits Total Stars when configured.

To enable client-side score submission, set `VITE_CG_LEADERBOARD_ENCRYPTION_KEY` to the 32-byte base64 encryption key from the game's CrazyGames Developer Portal before building. Do not commit a private server API key. Verify score submissions in the CrazyGames Preview tool.

## Current implementation notes
Player progress is saved locally with versioned, validated storage. The game is designed to remain playable when the CrazyGames SDK is unavailable. Cloud save, platform leaderboard submission and rewarded ads are guarded behind SDK capability checks and must be verified in the CrazyGames Preview environment before launch.