export function createRng(seed = 1) {
  let state = (Number(seed) >>> 0) || 0x9e3779b9;
  return function random() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createNoise2(seed = 1) {
  const lattice = new Map();
  const random = createRng(seed);
  const at = (x, z) => {
    const key = `${x | 0}:${z | 0}`;
    let value = lattice.get(key);
    if (value !== undefined) return value;
    value = random();
    if (lattice.size > 42000) lattice.clear();
    lattice.set(key, value);
    return value;
  };

  const smooth = (t) => t * t * (3 - 2 * t);
  const lerp = (a, b, t) => a + (b - a) * t;

  function value2(x, z) {
    const x0 = Math.floor(x);
    const z0 = Math.floor(z);
    const tx = smooth(x - x0);
    const tz = smooth(z - z0);
    const a = at(x0, z0);
    const b = at(x0 + 1, z0);
    const c = at(x0, z0 + 1);
    const d = at(x0 + 1, z0 + 1);
    return lerp(lerp(a, b, tx), lerp(c, d, tx), tz);
  }

  function fbm2(x, z, octaves = 5, lacunarity = 2.05, gain = 0.52) {
    let amp = 0.5;
    let freq = 1;
    let total = 0;
    let norm = 0;
    for (let i = 0; i < octaves; i += 1) {
      total += value2(x * freq, z * freq) * amp;
      norm += amp;
      amp *= gain;
      freq *= lacunarity;
    }
    return total / Math.max(norm, 1e-8);
  }

  function ridge2(x, z, octaves = 4) {
    let value = 0;
    let amp = 0.5;
    let freq = 1;
    let norm = 0;
    for (let i = 0; i < octaves; i += 1) {
      const n = value2(x * freq, z * freq);
      value += (1 - Math.abs(n * 2 - 1)) * amp;
      norm += amp;
      amp *= 0.55;
      freq *= 2.1;
    }
    return value / Math.max(norm, 1e-8);
  }

  return { value2, fbm2, ridge2 };
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function smoothstep(edge0, edge1, value) {
  const t = clamp((value - edge0) / (edge1 - edge0 || 1e-8), 0, 1);
  return t * t * (3 - 2 * t);
}
