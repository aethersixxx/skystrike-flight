import { COLORS } from './config.js';
import { clamp, lerp } from './noise.js';

const THREE = globalThis.THREE;
const CAPACITY = 1100;

function colorRgb(hex) {
  return new THREE.Color(hex);
}

export function createEffects(scene) {
  const positions = new Float32Array(CAPACITY * 3);
  const colors = new Float32Array(CAPACITY * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    size: 2.6,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
    opacity: 0.9,
    sizeAttenuation: true,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = 30;
  scene.add(points);

  const particles = [];
  for (let i = 0; i < CAPACITY; i += 1) {
    particles.push({
      alive: false,
      life: 0,
      maxLife: 1,
      x: 0,
      y: -10000,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      drag: 0.985,
      gravity: -5.6,
      color: colorRgb(COLORS.fire),
    });
    positions[i * 3] = 0;
    positions[i * 3 + 1] = -10000;
    positions[i * 3 + 2] = 0;
    colors[i * 3] = 1;
    colors[i * 3 + 1] = 0.5;
    colors[i * 3 + 2] = 0.2;
  }

  let cursor = 0;
  let aliveCount = 0;
  let shakeIntensity = 0;

  function emit(count, position, colorHex, speed = 24, life = 1.1) {
    const color = colorRgb(colorHex);
    const black = colorRgb(COLORS.smoke);
    for (let n = 0; n < count; n += 1) {
      cursor = (cursor + 1) % CAPACITY;
      const particle = particles[cursor];
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const power = speed * (0.22 + Math.random() * 0.82);
      particle.alive = true;
      particle.maxLife = life * (0.45 + Math.random() * 0.8);
      particle.life = particle.maxLife;
      particle.x = position.x;
      particle.y = position.y;
      particle.z = position.z;
      particle.vx = Math.sin(phi) * Math.cos(theta) * power;
      particle.vy = Math.sin(phi) * Math.sin(theta) * power * 0.62 + 4;
      particle.vz = Math.cos(phi) * power;
      particle.drag = 0.975 + Math.random() * 0.015;
      particle.gravity = -6 - Math.random() * 7;
      particle.color = Math.random() < 0.68 ? color : new THREE.Color().lerpColors(color, black, Math.random() * 0.6);
    }
  }

  function spawnExplosion(position, size = 1) {
    emit(510, position, COLORS.fire, 45 * size, 0.95 * size);
    emit(140, position, COLORS.sun, 17 * size, 1.4 * size);
    emit(90, position, COLORS.smoke, 10 * size, 2.2 * size);
    shakeIntensity = Math.min(1.4, shakeIntensity + 0.85 + size * 0.35);
  }

  function spawnRingBurst(position) {
    emit(45, position, COLORS.ringPulse, 14, 0.5);
    shakeIntensity = Math.min(0.5, shakeIntensity + 0.22);
  }

  function spawnTouchdownDust(position) {
    emit(110, position, COLORS.sand, 11, 0.9);
    emit(30, position, COLORS.smoke, 7, 1.6);
    shakeIntensity = Math.min(0.75, shakeIntensity + 0.4);
  }

  function update(dt) {
    const delta = clamp(dt, 0, 0.05);
    aliveCount = 0;
    for (let i = 0; i < CAPACITY; i += 1) {
      const particle = particles[i];
      if (particle.alive) {
        particle.life -= delta;
        if (particle.life <= 0) {
          particle.alive = false;
          positions[i * 3 + 1] = -10000;
          continue;
        }
        particle.x += particle.vx * delta;
        particle.y += particle.vy * delta;
        particle.z += particle.vz * delta;
        particle.vy += particle.gravity * delta;
        particle.vx *= particle.drag;
        particle.vy *= particle.drag;
        particle.vz *= particle.drag;
        positions[i * 3] = particle.x;
        positions[i * 3 + 1] = particle.y;
        positions[i * 3 + 2] = particle.z;
        colors[i * 3] = particle.color.r;
        colors[i * 3 + 1] = particle.color.g;
        colors[i * 3 + 2] = particle.color.b;
        aliveCount += 1;
      }
    }
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;
    material.opacity = aliveCount > 0 ? clamp(aliveCount / 260, 0.16, 0.95) : 0;
    shakeIntensity = Math.max(0, shakeIntensity - delta * 3.2);
  }

  function takeShake(time) {
    if (shakeIntensity <= 0.001) return { x: 0, y: 0 };
    const s = shakeIntensity;
    const n = (typeof time === 'number' ? time : performance.now() / 1000) * 37;
    return {
      x: Math.sin(n * 1.7) * s * 0.085,
      y: Math.cos(n * 2.1) * s * 0.065,
    };
  }

  return {
    update,
    spawnExplosion,
    spawnRingBurst,
    spawnTouchdownDust,
    setShake(value) {
      shakeIntensity = Math.min(1.4, shakeIntensity + value);
    },
    takeShake,
    get aliveCount() {
      return aliveCount;
    },
  };
}
