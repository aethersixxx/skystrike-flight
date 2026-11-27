export const SHOTS = Object.freeze({
  start: {
    key: 'start',
    mode: 'title',
    mission: 'ring',
    camera: 'chase',
    seed: 1,
    position: [330, 320, -1740],
    rotation: [-1.5, 0, 16],
    speed: 58,
    throttle: 0.78,
  },
  play: {
    key: 'play',
    mode: 'flying',
    mission: 'ring',
    camera: 'chase',
    seed: 1,
    position: [140, 240, -1020],
    rotation: [-0.03, 0, 9],
    speed: 58,
    throttle: 0.78,
  },
  cockpit: {
    key: 'cockpit',
    mode: 'flying',
    mission: 'ring',
    camera: 'chase',
    seed: 1,
    position: [-140, 190, -1230],
    rotation: [0.0, 0, 10],
    speed: 56,
    throttle: 0.7,
  },
  title: {
    key: 'title',
    mode: 'title',
    mission: 'ring',
    camera: 'chase',
    seed: 1,
    position: [330, 320, -1740],
    rotation: [-1.5, 0, 16],
    speed: 58,
    throttle: 0.78,
  },
  end: {
    key: 'end',
    mode: 'flying',
    mission: 'landing',
    camera: 'chase',
    seed: 1,
    position: [0, 95, -430],
    rotation: [-0.05, 0, 0],
    speed: 46,
    throttle: 0.24,
  },
});

export function getShotSetup(search = window.location.search) {
  const params = new URLSearchParams(search);
  const key = params.get('shot') || '';
  if (!key) return null;
  const seed = Number.parseInt(params.get('seed') || '1', 10) || 1;
  const base = SHOTS[key] || SHOTS.start;
  return { key, ...base, seed };
}

export function applyShotSetup(game, setup) {
  game.seed = setup.seed;
  game.shotKey = setup.key;
  game.cameraMode = setup.camera === 'cockpit' ? 'cockpit' : 'chase';
  game.selectedMission = setup.mission || 'ring';
  game.mode = setup.mode || 'flying';
  game.screenshotPose = setup;
  game.screenshotMode = true;
  return game;
}
