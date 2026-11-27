import { COLORS, WORLD } from './config.js';
import { createNoise2, clamp, lerp, smoothstep } from './noise.js';

const THREE = globalThis.THREE;

function hexRgb(hex) {
  return new THREE.Color(hex);
}

function isRunwayRect(x, z) {
  return (
    Math.abs(x) <= WORLD.runwayHalfWidth &&
    z >= WORLD.runwayStartZ &&
    z <= WORLD.runwayEndZ
  );
}

function positionColor(height) {
  const sea = WORLD.seaLevel;

  if (height < sea - 1.4) return hexRgb(COLORS.water);
  if (height < sea + 0.55) return hexRgb(COLORS.sand);
  if (height < 16) return hexRgb(COLORS.grassLow).lerp(hexRgb(COLORS.grassHigh), (height - 0.2) / 16);
  if (height < 44) return hexRgb(COLORS.grassHigh).lerp(hexRgb(COLORS.rock), (height - 16) / 28);
  if (height < 74) return hexRgb(COLORS.rock).lerp(hexRgb(COLORS.snow), (height - 44) / 30);
  return hexRgb(COLORS.snow);
}

export function createTerrain(scene, seed = 1) {
  const noise = createNoise2(seed + 17);
  const size = WORLD.size;
  const segments = WORLD.segments;
  const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
  const positions = geometry.attributes.position;

  function rawHeightAt(x, z) {
    const distance = Math.hypot(x, z);
    const shorelineWarp = noise.fbm2(x * 0.00042, z * 0.00042, 3, 2.1, 0.55);
    const coast = distance + (shorelineWarp - 0.5) * 420;
    const landMask = 1 - smoothstep(1740, 2780, coast);
    const seaDepth = -24 + (shorelineWarp - 0.5) * 14;

    const broad = noise.fbm2(x * 0.00095, z * 0.00095, 5, 2.05, 0.52);
    const hills = noise.fbm2(x * 0.0034, z * 0.0034, 4, 2.25, 0.5);
    const ridges = noise.ridge2(x * 0.00155, z * 0.00155, 4);
    const basin = smoothstep(560, 150, distance);
    const mountainMass = broad * 58 + ridges * 92 + hills * 18;
    const landHeight = -4.5 + mountainMass * (1.6 + basin * 0.5);
    return lerp(seaDepth, landHeight, landMask);
  }

  function runwayBlend(x, z) {
    if (isRunwayRect(x, z)) return 1;
    const dx = Math.max(Math.abs(x) - WORLD.runwayHalfWidth, 0);
    const dz = Math.max(WORLD.runwayStartZ - z, z - WORLD.runwayEndZ, 0);
    const distance = Math.hypot(dx, dz);
    return 1 - smoothstep(0, 52, distance);
  }

  function heightAt(x, z) {
    const raw = rawHeightAt(x, z);
    const blend = runwayBlend(x, z);
    return lerp(raw, WORLD.runwayY, blend);
  }

  const count = positions.count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const x = positions.getX(i);
    const z = positions.getY(i);
    const height = heightAt(x, z);
    positions.setXYZ(i, x, -z, height);
    const color = positionColor(height);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  positions.needsUpdate = true;
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.rotateX(-Math.PI / 2);
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.78,
    metalness: 0.0,
    flatShading: false,
  });
  const terrain = new THREE.Mesh(geometry, material);
  terrain.name = 'procedural-terrain';
  terrain.receiveShadow = false;
  terrain.castShadow = false;
  scene.add(terrain);

  return {
    mesh: terrain,
    heightAt,
    isRunway: isRunwayRect,
    isRunwayRect,
    seaLevel: WORLD.seaLevel,
    dispose() {
      geometry.dispose();
      material.dispose();
      scene.remove(terrain);
    },
  };
}
