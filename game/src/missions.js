import { COLORS, HUD_COPY, WORLD } from './config.js';
import { clamp, createRng } from './noise.js';

const THREE = globalThis.THREE;

const MISSION_STARTS = {
  ring: {
    x: 0,
    y: 240,
    z: -1700,
    yaw: 0,
    pitch: 0,
    roll: 0,
    speed: 58,
    throttle: 0.78,
  },
  landing: {
    x: 0,
    y: 168,
    z: -760,
    yaw: 0,
    pitch: -2.5,
    roll: 0,
    speed: 48,
    throttle: 0.27,
  },
  free: {
    x: 0,
    y: 260,
    z: -1500,
    yaw: 0,
    pitch: 0,
    roll: 0,
    speed: 60,
    throttle: 0.82,
  },
};

export function createMissions(scene) {
  const group = new THREE.Group();
  group.name = 'mission-objects';
  scene.add(group);

  const mission = {
    id: null,
    nextRingIndex: 0,
    rings: [],
    startedAt: 0,
    startPosition: new THREE.Vector3(),
    landing: {},
    complete: false,
  };

  function disposeObject(object) {
    object.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose());
        else child.material.dispose();
      }
    });
  }

  function clearMissionObjects() {
    while (group.children.length > 0) {
      const child = group.children.pop();
      disposeObject(child);
      group.remove(child);
    }
  }

  function makeRingGeometry() {
    return new THREE.TorusGeometry(9, 0.85, 12, 40);
  }

  function addRing(position, normal) {
    const center = position.clone();
    const ringGroup = new THREE.Group();
    const ringMaterial = new THREE.MeshStandardMaterial({
      color: COLORS.ring,
      emissive: COLORS.ring,
      emissiveIntensity: 0.55,
      roughness: 0.44,
      metalness: 0.05,
    });
    const ring = new THREE.Mesh(makeRingGeometry(), ringMaterial);
    ringGroup.add(ring);
    ringGroup.position.copy(center);
    ringGroup.lookAt(center.clone().add(normal));

    const glowGeo = new THREE.TorusGeometry(10.35, 0.36, 10, 44);
    const glow = new THREE.Mesh(glowGeo, new THREE.MeshBasicMaterial({
      color: COLORS.ringPulse,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    }));
    glow.userData.isGlow = true;
    ringGroup.add(glow);

    for (const side of [-1, 1]) {
      const towerGeo = new THREE.CylinderGeometry(0.22, 0.3, 7, 8);
      const tower = new THREE.Mesh(towerGeo, new THREE.MeshStandardMaterial({
        color: COLORS.rock,
        roughness: 0.8,
        metalness: 0.1,
      }));
      tower.position.set(side * 9, 0, 0);
      ringGroup.add(tower);
    }
    group.add(ringGroup);
    return { center, normal, ringGroup, glow };
  }

  function createRingCourse(seed) {
    const rng = createRng(seed + 101);
    const course = [];
    const count = 10;
    let position = new THREE.Vector3(0, 148, -1420);
    for (let i = 0; i < count; i += 1) {
      if (i > 0) {
        position = course[i - 1].next.clone();
      }
      const t = i / Math.max(1, count - 1);
      const serpentine = Math.sin(i * 0.95) * (125 + rng() * 55);
      const height = 118 + Math.abs(Math.sin(i * 0.74)) * 118 + rng() * 28;
      const nextZ = position.z + 295 + rng() * 40;
      position = new THREE.Vector3(serpentine, height, nextZ);
      const next = new THREE.Vector3(
        i === count - 1 ? position.x : Math.sin((i + 1) * 0.95) * (125 + rng() * 55),
        i === count - 1 ? position.y + 16 : 118 + Math.abs(Math.sin((i + 1) * 0.74)) * 118 + rng() * 28,
        i === count - 1 ? position.z + 320 : position.z + 295 + rng() * 40,
      );
      const normal = next.clone().sub(position).normalize();
      const ring = addRing(position, normal);
      ring.basePosition = position.clone();
      ring.normal = normal;
      ring.next = next;
      ring.previousSign = null;
      course.push(ring);
    }
    return course;
  }

  function buildLandingMarkers() {
    const markerMaterial = new THREE.MeshBasicMaterial({
      color: COLORS.hudAmber,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
    });
    for (let i = 0; i < 10; i += 1) {
      const z = WORLD.runwayStartZ - 110 - i * 90;
      for (const side of [-1, 1]) {
        const markerGeo = new THREE.PlaneGeometry(2.2, 9);
        markerGeo.rotateX(-Math.PI / 2);
        const marker = new THREE.Mesh(markerGeo, markerMaterial);
        marker.position.set(side * 18, WORLD.runwayY + 0.45, z);
        marker.userData.isGlidePath = true;
        group.add(marker);
      }
    }
  }

  function start(id, physics) {
    clearMissionObjects();
    mission.id = id;
    mission.nextRingIndex = 0;
    mission.rings = [];
    mission.complete = false;
    mission.landing = {
      distanceToRunway: 0,
      centerlineOffset: 0,
      glideSlope: 0,
      lineUpDeg: 0,
      rollDeg: 0,
      flareScore: 0,
    };
    const start = MISSION_STARTS[id] ?? MISSION_STARTS.ring;
    mission.startPosition.set(start.x, start.y, start.z);
    physics.setStart({
      x: start.x,
      y: start.y,
      z: start.z,
      yaw: start.yaw,
      pitch: start.pitch,
      roll: start.roll,
      speed: start.speed,
      throttle: start.throttle,
    });
    if (id === 'ring') mission.rings = createRingCourse(physics.state.totalDistance === 0 ? 7 : 1);
    if (id === 'landing') buildLandingMarkers();
    return mission.id;
  }

  function checkRingPass(physics) {
    if (!mission.rings.length || mission.nextRingIndex >= mission.rings.length) return null;
    const ring = mission.rings[mission.nextRingIndex];
    const deltaToCenter = physics.state.position.clone().sub(ring.center);
    const along = deltaToCenter.dot(ring.normal);
    const radial = deltaToCenter.clone().addScaledVector(ring.normal, -along).length();
    const sign = Math.sign(along);
    if (ring.previousSign === null) ring.previousSign = sign;

    if (ring.previousSign < 0 && sign >= 0 && radial < 10.5 && Math.abs(along) < 16) {
      if (mission.nextRingIndex < mission.rings.length - 1) {
        mission.nextRingIndex += 1;
        mission.rings[mission.nextRingIndex].previousSign = null;
      } else {
        mission.nextRingIndex += 1;
        mission.complete = true;
      }
      return ring;
    }
    ring.previousSign = sign;

    if (along > 55 && radial > 22) {
      mission.nextRingIndex += 1;
      if (mission.nextRingIndex < mission.rings.length) mission.rings[mission.nextRingIndex].previousSign = null;
    }
    return null;
  }

  function update(dt, game, context) {
    if (!mission.id) return;
    const elapsed = game.time;
    for (const ring of mission.rings) {
      if (ring.glow) {
        const pulse = 0.5 + Math.sin(elapsed * 4.2 + ring.basePosition.x * 0.11) * 0.25;
        ring.glow.scale.setScalar(1 + pulse * 0.08);
        ring.glow.material.opacity = pulse;
      }
      ring.ringGroup.children.forEach((child) => {
        if (child.userData.isGlow) child.rotation.z += Math.min(dt, 0.05) * 0.75;
      });
    }

    if (mission.id === 'ring') {
      const previousRingIndex = mission.nextRingIndex;
      const passed = checkRingPass(context.physics);
      if (passed) {
        game.score += 100 * Math.max(1, game.combo);
        game.combo += 1;
        context.effects.spawnRingBurst(passed.basePosition);
        context.audio.ringChime(game.combo);
        context.hud.setMessage(`GATE ${mission.nextRingIndex}  +${100 * Math.max(1, game.combo - 1)}`, 1.4);
        if (mission.complete) {
          game.score += 2500;
          context.hud.setMessage('SLALOM COMPLETE  +2500', 2.6);
          context.audio.tone?.(720, 1180, 0.5, 'sine', 0.12);
        }
      } else if (mission.nextRingIndex !== previousRingIndex) {
        game.combo = 0;
        context.hud.setMessage('GATE MISSED — COMBO RESET', 1.2);
      }
    } else if (mission.id === 'landing') {
      const runwayFront = WORLD.runwayStartZ;
      const horizontal = Math.max(1, runwayFront - context.physics.state.position.z);
      const altitudeAboveRunway = context.physics.state.position.y - WORLD.runwayY;
      const slope = Math.atan2(altitudeAboveRunway, horizontal);
      const lineUpDeg = THREE.MathUtils.radToDeg(Math.atan2(context.physics.state.position.x, Math.max(1, horizontal)));
      mission.landing.distanceToRunway = horizontal;
      mission.landing.centerlineOffset = context.physics.state.position.x;
      mission.landing.glideSlope = THREE.MathUtils.radToDeg(slope);
      mission.landing.lineUpDeg = lineUpDeg;
      mission.landing.rollDeg = context.physics.state.rollDeg;
      mission.landing.flareScore = context.physics.state.pitchDeg > 3 && context.physics.state.verticalSpeed < 1.5 ? 80 : 0;
    } else if (mission.id === 'free') {
      game.score = Math.max(game.score, Math.floor(context.physics.state.totalDistance * 1.6));
    }
  }

  function grade(score) {
    if (score >= 880) return 'PERFECT TOUCHDOWN';
    if (score >= 720) return 'CLEAN TOUCHDOWN';
    if (score >= 540) return 'GOOD TOUCHDOWN';
    if (score >= 300) return 'HEAVY TOUCHDOWN';
    return 'ROUGH TOUCHDOWN';
  }

  function evaluateLanding(event, game, physics) {
    if (!event.onRunway) {
      return {
        crash: true,
        label: `OFF RUNWAY  ${Math.round(event.offsetFromCenter || 0)}m`,
        points: 0,
      };
    }
    const vertical = event.verticalSpeed ?? 0;
    const offset = Math.abs(event.offsetFromCenter ?? 0);
    const pitch = event.pitchDeg ?? 0;
    if (vertical > 17 || offset > 9.5 || Math.abs(event.rollDeg ?? 0) > 13) {
      return {
        crash: true,
        label: vertical > 17 ? 'TOO FAST ON TOUCHDOWN' : 'TOUCHDOWN OUT OF LINE',
        points: 0,
      };
    }
    const rawScore =
      780 -
      vertical * 27 -
      offset * 17 -
      Math.max(0, (event.speed ?? 0) - 36) * 3.3 +
      (pitch > -7 && pitch < 7 ? 45 : 0) +
      (pitch > 3 ? 35 : 0);
    const points = clamp(Math.round(rawScore), 140, 940);
    const damage = clamp(Math.round(vertical * 3 + offset * 1.7 + Math.max(0, (event.speed ?? 0) - 34) * 1.1), 0, 100);
    physics.state.damage = clamp(physics.state.damage + damage * 0.25, 0, 100);
    physics.state.health = clamp(physics.state.health - damage * 0.25, 0, 100);
    return {
      crash: false,
      label: `${grade(points)}  +${points}`,
      points,
      damage,
      vertical,
      offset,
    };
  }

  function resetForRestart(physics) {
    start(mission.id || 'ring', physics);
  }

  return {
    mission,
    start,
    update,
    evaluateLanding,
    resetForRestart,
    clearMissionObjects,
    group,
  };
}
