# Build: "SKYSTRIKE" — a 3D flight game (original), static files, no build step

Everything below is YOUR code: write every source file with your own edit/write tools. Do not copy starter code.

## Layout (repository root = current dir)
- main.ts        (Node 22, stdlib only; copy game/ + screenshots/ to $MAKEFUN_OUTPUT_DIR (default /output) and write dossier.json via buildDossier from ./vendor/makefun-game.ts, options text_max_bytes 163840, screenshots {max:4,max_bytes:262144}, game_max_files 993, game_max_bytes 50331648, game_path_max_bytes 1000). mkdir -p out; must run with `MAKEFUN_OUTPUT_DIR=out node main.ts`.
- serve.ts       (stdlib static server for game/ on :8080)
- vendor/three.min.js  ALREADY PRESENT — UMD build, exposes global THREE via <script src="vendor/three.min.js">. Never edit. (repo also has vendor/makefun-game.ts, keep unchanged)
- game/index.html  loads vendor/three.min.js as a classic script, then <script type="module" src="src/main.js">
- game/src/*.js   ES modules, one job each, e.g. terrain.js, aircraft.js, physics.js, hud.js, input.js, missions.js, audio.js, camera.js, world.js, main.js
- shots.json  + game/src/shots.js: query params ?shot=start|play|end&seed=1 drive deterministic states so screenshots are reproducible (like the kit starter)

## Game design (judge criteria, most important first)
1. Complete flight game: chase/cockpit view over recognisable procedurally generated terrain (mountains, valleys, coast, water), the aircraft visibly IN FRAME (built 3D model from THREE primitives: fuselage, wings, tail, spinning propeller), instruments lit on the HUD, and a TARGET RING or runway ahead, with ALTITUDE / SPEED / HEADING readouts on the HUD (canvas or DOM overlay).
2. Fun & depth: throttle (W/S or Shift/Ctrl) + pitch/roll/yaw with arrows or mouse; turn discipline matters (G-force stall if turning too hard at low speed); 3 mission types: ring slalom (fly through target rings), landing challenge (align with runway, flare, touchdown scoring), free flight with fuel; fuel + damage model; score, combo for consecutive rings.
3. Feel & polish: smooth responsive controls, camera smoothing that never fights the pilot, readable crash (explosion particles, screen shake) and landing feedback, pause, restart, title screen with instructions.
4. Look & originality: one coherent colour palette for terrain/sky (sunset palette, fog), soft procedural clouds, sun glare, HUD styled like real avionics (green monospace, artificial horizon ribbon), original name "SKYSTRIKE". Simple WebAudio synth sounds (engine hum pitch follows throttle, ring chime, crash) — no audio files, generate in code. No external assets whatsoever: everything procedural, no network, no data: fonts (use monospace).
5. Structure: small files each named for one job, functions named for what they do.

## Hard constraints
- game/ static only; every reference is a relative path inside game/ or data: URI; NO http(s) URLs, no bare imports (three is a classic script global), no import maps needed.
- All source in game/src/*.js must be ES modules that parse.
- index.html < 1 MiB; total game/ well under 48 MiB.
- After writing code: verify with `node --check` equivalents (node -e "import('./game/src/main.js')" fails on browser globals — instead just syntax-check each file with `node --check` for classic or `node --input-type=module --check`? Use: for f in game/src/*.js; do node --experimental-default-type=module --check "$f" || node --check "$f"; done — just ensure no syntax errors), then run `mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts` and confirm out/dossier.json exists.
- Do not touch vendor/ files, LICENSE, .makefun/.
- Commit nothing; just write files.

Do it step by step; report when all files written and `node main.ts` succeeds.
