import { COLORS, HUD_COPY } from './config.js';
import { createAircraft } from './aircraft.js';
import { createAudio } from './audio.js';
import { createCamera } from './camera.js';
import { createEffects } from './effects.js';
import { createHud } from './hud.js';
import { createInput } from './input.js';
import { createMissions } from './missions.js';
import { createPhysics, flightReadout } from './physics.js';
import { applyShotSetup, getShotSetup } from './shots.js';
import { createWorld } from './world.js';

const THREE = globalThis.THREE;

const canvas = document.getElementById('world-canvas');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  66,
  window.innerWidth / Math.max(1, window.innerHeight),
  0.12,
  14000,
);

const shotSetup = getShotSetup();
const game = {
  mode: 'title',
  paused: false,
  score: 0,
  combo: 0,
  selectedMission: 'ring',
  seed: shotSetup?.seed ?? 1,
  time: 0,
  cameraMode: 'chase',
  landing: {},
  missions: null,
  screenshotMode: false,
  screenshotPose: null,
  shotKey: null,
};

const world = createWorld(scene, game.seed);
const aircraft = createAircraft(scene, game.seed);
const physics = createPhysics();
const missions = createMissions(scene);
game.missions = missions;
const effects = createEffects(scene);
const audio = createAudio();
const input = createInput(canvas);
const cameraRig = createCamera(camera, aircraft.group);
const hud = createHud();

function missionLabel(id) {
  if (id === 'ring') return 'RING SLALOM';
  if (id === 'landing') return 'LANDING CHALLENGE';
  return 'FREE FLIGHT';
}

function syncAircraftWithPhysics() {
  aircraft.group.position.copy(physics.state.position);
  aircraft.group.quaternion.copy(physics.state.quaternion);
}

function applyShotPose() {
  if (!shotSetup?.position) return;
  const [pitch, yaw, roll] = shotSetup.rotation ?? [0, 0, 0];
  const [x, requestedY, z] = shotSetup.position;
  const groundY = world.terrain.heightAt(x, z);
  const minimumAltitude = shotSetup.groundClearance ?? 24;
  const y = Math.max(requestedY, groundY + minimumAltitude);
  physics.setStart({
    x,
    y,
    z,
    pitch,
    yaw,
    roll,
    speed: shotSetup.speed ?? 55,
    throttle: shotSetup.throttle ?? 0.72,
  });
  physics.state.altitudeMsl = y;
  physics.state.altitudeAgl = y - groundY;
}

function shotPoseCommands() {
  const [pitch = 0, yaw = 0, roll = 0] = shotSetup?.rotation ?? [];
  const clampControl = (value, limit = 1) => Math.max(-limit, Math.min(limit, value));
  return {
    pitch: clampControl(-pitch * 0.2),
    roll: clampControl(roll * 0.06),
    yaw: clampControl(yaw * 0.06),
  };
}

function startSelectedMission() {
  audio.ensure();
  audio.startEngine();
  game.mode = 'flying';
  game.paused = false;
  game.score = 0;
  game.combo = 0;
  game.landing = {};
  missions.start(game.selectedMission, physics);
  if (shotSetup) applyShotPose();
  syncAircraftWithPhysics();
  game.screenshotMode = Boolean(game.screenshotMode);
  hud.setMessage(`${missionLabel(game.selectedMission)}  START`, 1.4);
}

function restart() {
  game.score = 0;
  game.combo = 0;
  game.landing = {};
  game.screenshotMode = false;
  startSelectedMission();
}

function togglePause() {
  if (game.mode !== 'flying' && game.mode !== 'paused') return;
  game.paused = !game.paused;
  if (game.paused) hud.setMessage('PAUSED', 0.8);
}

function cycleCamera() {
  const next = game.cameraMode === 'chase' ? 'cockpit' : 'chase';
  game.cameraMode = next;
  cameraRig.setMode(next);
  hud.setMessage(next === 'chase' ? 'CHASE CAMERA' : 'COCKPIT CAMERA', 0.9);
}

function handleCrash(event) {
  if (game.mode !== 'flying') return;
  game.mode = 'crashed';
  game.paused = false;
  game.combo = 0;
  physics.state.health = 0;
  audio.crashSound();
  effects.spawnExplosion(event?.position || physics.state.position, event?.surface === 'water' ? 1.2 : 1.1);
  effects.setShake(1.15);
  hud.setMessage(`CRASHED — ${event?.surface?.toUpperCase() || 'IMPACT'}`, 3.2);
}

function handleTouchdown(event) {
  if (game.mode !== 'flying') return;
  if (game.selectedMission !== 'landing') {
    handleCrash({ ...event, surface: 'terrain' });
    return;
  }
  const result = missions.evaluateLanding(event, game, physics);
  if (result.crash) {
    handleCrash({ ...event, surface: 'landing' });
    return;
  }
  game.mode = 'landed';
  game.paused = false;
  game.combo = 0;
  game.score += result.points;
  game.landing = result;
  physics.state.speed = 6;
  audio.landingThump();
  effects.spawnTouchdownDust(event.position);
  effects.setShake(0.5);
  hud.setMessage(`${result.label}`, 3.4);
}

function handlePhysicsEvents(events) {
  for (const event of events) {
    if (game.mode !== 'flying') break;
    if (event.type === 'stall') audio.stallWarning(0.05);
    else if (event.type === 'touchdown') handleTouchdown(event);
    else if (event.type === 'crash') handleCrash(event);
  }
}

function onPressed(code) {
  const ending = game.mode === 'crashed' || game.mode === 'landed';
  if (code === 'Digit1' || code === 'Digit2' || code === 'Digit3') {
    if (game.mode === 'title') {
      game.selectedMission = code === 'Digit1' ? 'ring' : code === 'Digit2' ? 'landing' : 'free';
      audio.uiSelect();
      hud.setMessage(missionLabel(game.selectedMission), 1);
    }
    return;
  }
  if (code === 'Enter' || code === 'Space') {
    if (game.mode === 'title' || ending) {
      startSelectedMission();
      audio.uiSelect();
    }
    return;
  }
  if (code === 'KeyP') {
    togglePause();
    return;
  }
  if (code === 'KeyC') {
    cycleCamera();
    return;
  }
  if (code === 'KeyR') {
    if (game.mode !== 'title') {
      startSelectedMission();
    } else {
      startSelectedMission();
    }
    return;
  }
  if (code === 'KeyM' && game.mode === 'title') {
    const order = ['ring', 'landing', 'free'];
    const current = order.indexOf(game.selectedMission);
    game.selectedMission = order[(current + 1) % order.length];
    audio.uiSelect();
    hud.setMessage(missionLabel(game.selectedMission), 1);
  }
}

if (shotSetup) {
  applyShotSetup(game, shotSetup);
  if (game.mode === 'title') {
    applyShotPose();
    syncAircraftWithPhysics();
    cameraRig.setMode(game.cameraMode);
  } else {
    startSelectedMission();
    applyShotPose();
    syncAircraftWithPhysics();
    cameraRig.setMode(game.cameraMode);
  }
} else {
  syncAircraftWithPhysics();
  cameraRig.setMode(game.cameraMode);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / Math.max(1, window.innerHeight);
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

let previous = performance.now();

function animate(now) {
  requestAnimationFrame(animate);
  const delta = Math.min(0.05, Math.max(0.001, (now - previous) / 1000));
  previous = now;
  const commands = input.update(delta, onPressed);

  if (!game.paused) {
    if (!game.screenshotMode) {
      game.time += delta;
      world.update(delta, game.time);
    }
    if (game.mode === 'flying' && !game.screenshotMode) {
      const events = physics.update(delta, commands, world, effects);
      handlePhysicsEvents(events);
      syncAircraftWithPhysics();
      aircraft.update(delta, commands, physics.state);
      missions.update(delta, game, {
        physics,
        effects,
        audio,
        hud,
      });
      audio.setEngine(physics.state.throttle, physics.state.speed, physics.state.stalled);
    } else if (game.screenshotMode && (game.mode === 'flying' || game.mode === 'title')) {
      aircraft.update(delta, shotPoseCommands(), physics.state);
      if (game.mode === 'flying') audio.setEngine(physics.state.throttle, physics.state.speed, false);
    }
    effects.update(delta);
  }

  cameraRig.update(delta, physics.state, effects);
  hud.draw(game, physics.state, flightReadout(physics.state), delta);
  renderer.render(scene, camera);
}

requestAnimationFrame(animate);
window.__dbg = { world };
