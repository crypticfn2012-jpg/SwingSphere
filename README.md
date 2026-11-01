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
The HTML5 SDK v3 is loaded in `index.html`. SDK initialization and lifecycle handling live in `src/platform/crazygames.js`. Global leaderboard IDs and dashboard-side setup must be configured in the CrazyGames Developer Portal before online score submission can be enabled.

## Current implementation notes
Player progress is saved locally with versioned, validated storage. The game is designed to remain playable when the CrazyGames SDK is unavailable. Cloud save, platform leaderboard submission and rewarded ads are guarded behind SDK capability checks and must be verified in the CrazyGames Preview environment before launch.