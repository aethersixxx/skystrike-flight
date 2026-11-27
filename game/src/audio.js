export function createAudio() {
  let context = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let engineFilter = null;
  let noiseBuffer = null;
  let warningTimer = 0;

  function makeNoiseBuffer() {
    const length = Math.max(1, Math.floor(context.sampleRate * 1.2));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i += 1) {
      const white = Math.random() * 2 - 1;
      last = last * 0.925 + white * 0.075;
      data[i] = last;
    }
    return buffer;
  }

  function ensure() {
    if (!context) {
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.65;
      master.connect(context.destination);
      noiseBuffer = makeNoiseBuffer();
    }
    if (context.state === 'suspended') context.resume();
  }

  function startEngine() {
    ensure();
    if (engineOsc) return;
    engineOsc = context.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 52;
    engineFilter = context.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 520;
    engineFilter.Q.value = 1.4;
    engineGain = context.createGain();
    engineGain.gain.value = 0.045;
    engineOsc.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(master);
    engineOsc.start();
  }

  function setEngine(throttle = 0.6, speed = 50, stalled = false) {
    ensure();
    if (!engineOsc) startEngine();
    const rough = 1 + Math.random() * 0.07;
    const targetHz = 42 + throttle * 138 + speed * 0.35;
    engineOsc.frequency.setTargetAtTime(targetHz * rough, context.currentTime, 0.12);
    engineFilter.frequency.setTargetAtTime(420 + throttle * 880 + speed * 2, context.currentTime, 0.18);
    const level = stalled ? 0.032 : 0.038 + throttle * 0.06;
    engineGain.gain.setTargetAtTime(level, context.currentTime, 0.25);
  }

  function tone(freq, endFreq, duration, type = 'sine', volume = 0.12, when = 0) {
    ensure();
    const start = context.currentTime + when;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }

  function noiseBurst(volume, lowpass, duration, when = 0) {
    ensure();
    const start = context.currentTime + when;
    const src = context.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const gain = context.createGain();
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(start);
    src.stop(start + duration + 0.05);
  }

  function ringChime(combo = 1) {
    const lift = Math.min(500, combo * 70);
    tone(620 + lift, 940 + lift, 0.18, 'sine', 0.16);
    tone(1240 + lift, 1880 + lift, 0.22, 'sine', 0.06, 0.04);
  }

  function landingThump() {
    noiseBurst(0.32, 560, 0.26);
    tone(70, 34, 0.32, 'sine', 0.2);
  }

  function crashSound() {
    noiseBurst(0.42, 900, 0.85);
    noiseBurst(0.38, 300, 1.4, 0.06);
    tone(130, 28, 1.1, 'triangle', 0.2);
    tone(78, 20, 1.4, 'sawtooth', 0.14, 0.1);
  }

  function stallWarning(dt) {
    ensure();
    if (warningTimer > 0) {
      warningTimer -= dt;
      return;
    }
    warningTimer = 0.55;
    tone(880, 640, 0.11, 'square', 0.028);
  }

  function uiSelect() {
    tone(360, 540, 0.14, 'triangle', 0.1);
  }

  return {
    ensure,
    startEngine,
    setEngine,
    ringChime,
    landingThump,
    crashSound,
    stallWarning,
    uiSelect,
  };
}
