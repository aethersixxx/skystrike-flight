import { COLORS, WORLD } from './config.js';
import { createRng } from './noise.js';
import { createTerrain } from './terrain.js';

const THREE = globalThis.THREE;

function makeGradientTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, `#${COLORS.skyTop.toString(16).padStart(6, '0')}`);
  gradient.addColorStop(0.46, `#${COLORS.skyMid.toString(16).padStart(6, '0')}`);
  gradient.addColorStop(1, `#${COLORS.skyBottom.toString(16).padStart(6, '0')}`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  return texture;
}

function makeSunTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(128, 128, 8, 128, 128, 126);
  gradient.addColorStop(0, 'rgba(255,248,228,1)');
  gradient.addColorStop(0.18, 'rgba(255,214,145,0.92)');
  gradient.addColorStop(0.45, 'rgba(255,140,82,0.32)');
  gradient.addColorStop(1, 'rgba(255,120,68,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeCloudTexture(random) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < 14; i += 1) {
    const x = 28 + random() * 200;
    const y = 28 + random() * 72;
    const radius = 20 + random() * 42;
    const gradient = ctx.createRadialGradient(x, y, 2, x, y, radius);
    gradient.addColorStop(0, 'rgba(255,225,198,0.22)');
    gradient.addColorStop(1, 'rgba(255,225,198,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createRunway(scene) {
  const group = new THREE.Group();
  const length = WORLD.runwayEndZ - WORLD.runwayStartZ;
  const centerZ = (WORLD.runwayStartZ + WORLD.runwayEndZ) / 2;

  const baseGeometry = new THREE.PlaneGeometry(WORLD.runwayHalfWidth * 2, length);
  baseGeometry.rotateX(-Math.PI / 2);
  const base = new THREE.Mesh(
    baseGeometry,
    new THREE.MeshStandardMaterial({ color: COLORS.runway, roughness: 0.94, metalness: 0.0 }),
  );
  base.position.set(0, WORLD.runwayY + 0.04, centerZ);
  base.receiveShadow = false;
  group.add(base);

  const markMaterial = new THREE.MeshBasicMaterial({ color: COLORS.runwayMark, transparent: true, opacity: 0.9 });
  const tallMaterial = new THREE.MeshBasicMaterial({ color: COLORS.runwayMark, transparent: true, opacity: 0.85 });
  for (let i = 0; i < 7; i += 1) {
    const dashGeo = new THREE.PlaneGeometry(0.7, 8);
    dashGeo.rotateX(-Math.PI / 2);
    const dash = new THREE.Mesh(dashGeo, markMaterial);
    dash.position.set(0, WORLD.runwayY + 0.11, centerZ - length * 0.36 + i * 14);
    group.add(dash);
  }
  for (let i = 0; i < 6; i += 1) {
    const barGeo = new THREE.PlaneGeometry(9, 2.2);
    barGeo.rotateX(-Math.PI / 2);
    const bar = new THREE.Mesh(barGeo, tallMaterial);
    bar.position.set(0, WORLD.runwayY + 0.115, centerZ - 2 + i * 8);
    group.add(bar);
  }
  const thresholdGeo = new THREE.PlaneGeometry(WORLD.runwayHalfWidth * 2, 1.7);
  thresholdGeo.rotateX(-Math.PI / 2);
  const threshold = new THREE.Mesh(thresholdGeo, tallMaterial);
  threshold.position.set(0, WORLD.runwayY + 0.125, WORLD.runwayEndZ - 3);
  group.add(threshold);
  const startThreshold = new THREE.Mesh(thresholdGeo, tallMaterial);
  startThreshold.position.set(0, WORLD.runwayY + 0.125, WORLD.runwayStartZ + 3);
  group.add(startThreshold);

  const lightMaterial = new THREE.MeshBasicMaterial({ color: COLORS.hud });
  for (const z of [WORLD.runwayStartZ, WORLD.runwayEndZ]) {
    for (const side of [-1, 1]) {
      const lampGeo = new THREE.SphereGeometry(0.55, 8, 6);
      const lamp = new THREE.Mesh(lampGeo, lightMaterial);
      lamp.position.set(side * (WORLD.runwayHalfWidth + 3), WORLD.runwayY + 1.2, z);
      group.add(lamp);
    }
  }
  scene.add(group);
  return group;
}

export function createWorld(scene, seed = 1) {
  const horizonColor = new THREE.Color(COLORS.skyBottom);
  scene.background = horizonColor;
  scene.fog = new THREE.Fog(horizonColor, WORLD.fogNear, WORLD.fogFar);

  const random = createRng(seed + 41);
  const skyGeometry = new THREE.SphereGeometry(6400, 40, 20);
  const skyMaterial = new THREE.MeshBasicMaterial({
    map: makeGradientTexture(),
    side: THREE.BackSide,
    fog: false,
    depthWrite: false,
  });
  const sky = new THREE.Mesh(skyGeometry, skyMaterial);
  sky.name = 'sunset-dome';
  sky.renderOrder = -20;
  scene.add(sky);

  const sun = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeSunTexture(),
    color: COLORS.sun,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
    transparent: true,
  }));
  sun.position.set(-3600, 2350, -4300);
  sun.scale.setScalar(2400);
  sun.renderOrder = -10;
  scene.add(sun);

  const sunLight = new THREE.DirectionalLight(COLORS.sun, 1.7);
  sunLight.position.copy(sun.position).normalize();
  sunLight.position.set(-0.55, 0.48, -0.62);
  scene.add(sunLight);
  const hemisphere = new THREE.HemisphereLight(0xffd9b0, 0x403029, 0.95);
  scene.add(hemisphere);
  scene.add(new THREE.AmbientLight(0x2c1f3d, 0.32));

  const terrain = createTerrain(scene, seed);

  const waterGeometry = new THREE.PlaneGeometry(WORLD.size * 1.55, WORLD.size * 1.55);
  waterGeometry.rotateX(-Math.PI / 2);
  const waterMaterial = new THREE.MeshStandardMaterial({
    color: COLORS.water,
    roughness: 0.16,
    metalness: 0.0,
    transparent: true,
    opacity: 0.88,
    depthWrite: false,
  });
  const water = new THREE.Mesh(waterGeometry, waterMaterial);
  water.name = 'sunset-coast-water';
  water.position.y = WORLD.seaLevel;
  water.renderOrder = 5;
  scene.add(water);

  const runway = createRunway(scene);

  const cloudTexture = makeCloudTexture(random);
  const clouds = [];
  for (let i = 0; i < WORLD.cloudCount; i += 1) {
    const material = new THREE.SpriteMaterial({
      map: cloudTexture,
      color: 0xf3c4ae,
      transparent: true,
      opacity: 0.23 + random() * 0.16,
      depthWrite: false,
    });
    const cloud = new THREE.Sprite(material);
    const angle = random() * Math.PI * 2;
    const radius = 850 + random() * 4200;
    cloud.position.set(
      Math.cos(angle) * radius,
      WORLD.cloudMinY + random() * (WORLD.cloudMaxY - WORLD.cloudMinY),
      Math.sin(angle) * radius - random() * 900,
    );
    const scale = 360 + random() * 980;
    cloud.scale.set(scale, scale * 0.32, 1);
    cloud.userData.drift = 2 + random() * 7;
    cloud.userData.radius = radius * 0.5;
    clouds.push(cloud);
    scene.add(cloud);
  }

  function update(dt, elapsed) {
    const move = Math.min(dt, 0.05);
    for (const cloud of clouds) {
      cloud.position.x += cloud.userData.drift * move;
      if (cloud.position.x > 5200) cloud.position.x = -5200;
    }
  }

  return {
    terrain,
    water,
    sky,
    sun,
    runway,
    clouds,
    update,
  };
}
