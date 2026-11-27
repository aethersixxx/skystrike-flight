import { COLORS, HUD_COPY, WORLD } from './config.js';

function css(hex) {
  return `#${hex.toString(16).padStart(6, '0')}`;
}

function roundedRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w * 0.5, h * 0.5);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export function createHud() {
  const canvas = document.getElementById('hud-canvas');
  const ctx = canvas.getContext('2d');
  const state = {
    width: window.innerWidth,
    height: window.innerHeight,
    message: '',
    messageTimer: 0,
    flash: 0,
  };

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    state.width = window.innerWidth;
    state.height = window.innerHeight;
    canvas.width = Math.floor(state.width * dpr);
    canvas.height = Math.floor(state.height * dpr);
    canvas.style.width = `${state.width}px`;
    canvas.style.height = `${state.height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function text(text, x, y, size = 16, color = COLORS.hud, align = 'left', glow = true) {
    ctx.save();
    ctx.font = `${size}px "Courier New", ui-monospace, monospace`;
    ctx.textAlign = align;
    ctx.textBaseline = 'top';
    if (glow) {
      ctx.shadowColor = css(color);
      ctx.shadowBlur = 10;
    }
    ctx.fillStyle = css(color);
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  function line(x1, y1, x2, y2, color = COLORS.hud, width = 1, alpha = 0.85) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = css(color);
    ctx.lineWidth = width;
    ctx.shadowColor = css(color);
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
  }

  function drawHorizon(readout) {
    const cx = state.width * 0.5;
    const cy = state.height * 0.44;
    const roll = (readout?.roll ?? 0) * Math.PI / 180;
    const pitch = Math.max(-33, Math.min(33, readout?.pitch ?? 0));
    const pitchPx = pitch * 5.2;
    const ext = Math.max(state.width, state.height) * 1.75;
    const skyTop = `#${COLORS.skyTop.toString(16).padStart(6, '0')}`;
    const skyMid = `#${COLORS.skyMid.toString(16).padStart(6, '0')}`;
    const groundLow = `#${((COLORS.grassLow & 0xfefefe) >>> 1).toString(16).padStart(6, '0')}`;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-roll);
    const sky = ctx.createLinearGradient(0, -ext, 0, pitchPx + 40);
    sky.addColorStop(0, skyTop);
    sky.addColorStop(1, skyMid);
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = sky;
    ctx.fillRect(-ext, -ext, ext * 2, ext + pitchPx);
    ctx.fillStyle = groundLow;
    ctx.fillRect(-ext, pitchPx, ext * 2, ext - pitchPx);
    ctx.globalAlpha = 1;
    line(-ext, pitchPx, ext, pitchPx, COLORS.hud, 2, 0.95);
    for (let deg = -40; deg <= 40; deg += 5) {
      const y = deg * 5.2 - pitchPx;
      const length = deg % 20 === 0 ? 42 : 22;
      if (Math.abs(y - pitchPx) < 12) continue;
      if (y > -cy && y < cy) {
        line(-length, y, length, y, COLORS.hud, 1, 0.45);
        if (deg % 20 === 0) text(`${Math.abs(deg)}`, -length - 22, y - 7, 11, COLORS.hud, 'right', false);
      }
    }
    ctx.restore();
  }

  function drawReadout(game, fs) {
    const w = state.width;
    const h = state.height;
    text(`${String(fs.heading).padStart(3, '0')}°`, w * 0.5, 18, 21, COLORS.hud, 'center');
    text('HDG', w * 0.5, 41, 10, COLORS.hudAmber, 'center', false);

    text('SPD', 26, h - 74, 10, COLORS.hudAmber, 'left', false);
    text(`${Math.round(fs.speed)}`, 24, h - 57, 24, fs.speed < 25 ? COLORS.hudRed : COLORS.hud);
    text('ALT', w - 24, h - 74, 10, COLORS.hudAmber, 'right', false);
    text(`${Math.round(fs.altitudeAgl)}`, w - 26, h - 57, 24, COLORS.hud, 'right');

    const vsp = fs.verticalSpeed > 0 ? 'CLB' : 'DSC';
    text(`${vsp} ${Math.abs(fs.verticalSpeed).toFixed(0)}`, 26, h - 39, 11, COLORS.hudAmber, 'left', false);
    const throttlePercent = Math.round(fs.throttle * 100);
    text(`THR ${throttlePercent}%`, w / 2, h - 38, 12, throttlePercent < 15 ? COLORS.hudRed : COLORS.hudAmber, 'center', false);

    ctx.save();
    ctx.globalAlpha = 0.78;
    roundedRect(ctx, w / 2 - 110, h - 24, 220, 11, 5);
    ctx.fillStyle = 'rgba(10,20,16,0.7)';
    ctx.fill();
    ctx.fillStyle = css(COLORS.hud);
    ctx.shadowColor = css(COLORS.hud);
    ctx.shadowBlur = 6;
    ctx.fillRect(w / 2 - 108, h - 22, 216 * (fs.throttle || 0), 7);
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.78;
    roundedRect(ctx, 22, h - 110, 130, 8, 4);
    ctx.fillStyle = 'rgba(8,14,12,0.7)';
    ctx.fill();
    ctx.fillStyle = css(fs.health < 25 ? COLORS.hudRed : COLORS.hud);
    ctx.shadowColor = css(fs.health < 25 ? COLORS.hudRed : COLORS.hud);
    ctx.shadowBlur = 5;
    ctx.fillRect(24, h - 108, 126 * (fs.health / 100), 4);
    ctx.restore();
    text('HULL', 26, h - 126, 10, COLORS.hudAmber, 'left', false);

    ctx.save();
    ctx.globalAlpha = 0.78;
    roundedRect(ctx, w - 154, h - 110, 130, 8, 4);
    ctx.fillStyle = 'rgba(8,14,12,0.7)';
    ctx.fill();
    const fuelColor = fs.fuel < 18 ? COLORS.hudRed : COLORS.hudAmber;
    ctx.fillStyle = css(fuelColor);
    ctx.shadowColor = css(fuelColor);
    ctx.shadowBlur = 5;
    ctx.fillRect(w - 152, h - 108, 126 * (fs.fuel / 100), 4);
    ctx.restore();
    text('FUEL', w - 24, h - 126, 10, COLORS.hudAmber, 'right', false);

    if (fs.stalled) {
      const blink = Math.sin(state.flash * 12) > -0.2;
      if (blink) text('STALL — REDUCE G', w / 2, h * 0.24, 20, COLORS.hudRed, 'center');
    }
    if (fs.gLoad > 2.8) {
      text(`${fs.gLoad.toFixed(1)} G`, w - 27, h * 0.26, 16, fs.gLoad > 3.6 ? COLORS.hudRed : COLORS.hudAmber, 'right');
    }
  }

  function drawMission(game, mission, fs) {
    const w = state.width;
    const h = state.height;
    if (game.mode === 'title' || game.mode === 'crashed' || game.mode === 'landed') return;
    text(game.selectedMission.toUpperCase(), 26, 18, 14, COLORS.hudAmber, 'left');
    text(`SCORE ${game.score}`, 26, 39, 14, COLORS.hud, 'left');
    text(`COMBO x${game.combo}`, 26, 59, 12, game.combo > 0 ? COLORS.ringPulse : COLORS.hud, 'left', false);

    if (game.selectedMission === 'ring') {
      text(`GATE ${Math.min(game.missions.mission.nextRingIndex + 1, game.missions.mission.rings.length)} / ${game.missions.mission.rings.length}`, w - 26, 18, 14, COLORS.hud, 'right');
      if (game.combo >= 2) text(`COMBO ${game.combo}x`, w - 26, 38, 12, COLORS.ringPulse, 'right');
    } else if (game.selectedMission === 'landing') {
      const ld = mission.landing;
      text(`RWY ${Math.round(ld.distanceToRunway)}m`, w - 26, 18, 14, COLORS.hud, 'right');
      text(`LINE ${ld.lineUpDeg.toFixed(1)}°`, w - 26, 38, 12, Math.abs(ld.lineUpDeg) < 1.2 ? COLORS.hud : COLORS.hudRed, 'right');
      text(`SLOPE ${ld.glideSlope.toFixed(1)}°`, w - 26, 57, 12, ld.glideSlope > 1.8 && ld.glideSlope < 4.2 ? COLORS.hud : COLORS.hudRed, 'right');
      if (ld.flareScore > 0) text('FLARE HOLD', w - 26, 77, 12, COLORS.hudAmber, 'right');
    } else {
      text(`DIST ${Math.round(fs.totalDistance || 0)}m`, w - 26, 18, 14, COLORS.hud, 'right');
    }
  }

  function drawTitle(game) {
    const w = state.width;
    const h = state.height;
    ctx.fillStyle = 'rgba(8,12,20,0.32)';
    ctx.fillRect(0, 0, w, h);
    text(HUD_COPY.title, w / 2, h * 0.22, Math.min(52, w * 0.09), COLORS.hud, 'center');
    text(HUD_COPY.subtitle, w / 2, h * 0.31, 12, COLORS.hudAmber, 'center', false);
    HUD_COPY.missions.forEach((missionText, index) => {
      const selected = game.selectedMission === (index === 0 ? 'ring' : index === 1 ? 'landing' : 'free');
      text(missionText, w / 2, h * 0.43 + index * 28, 15, selected ? COLORS.hud : COLORS.hudAmber, 'center', !selected);
    });
    const blink = Math.sin(state.flash * 5) > -0.3;
    if (blink) text(HUD_COPY.start, w / 2, h * 0.58, 18, COLORS.hud, 'center');
    text(HUD_COPY.keys, w / 2, h * 0.72, 11, COLORS.hud, 'center', false);
    text('MISSION SELECT: 1 2 3', w / 2, h * 0.80, 14, COLORS.ringPulse, 'center');
  }

  function drawPause(game) {
    const w = state.width;
    const h = state.height;
    ctx.fillStyle = 'rgba(8,14,24,0.62)';
    ctx.fillRect(0, 0, w, h);
    text('PAUSED', w / 2, h * 0.42, 34, COLORS.hud, 'center');
    text('P TO RESUME   R TO RESTART   C TO CHANGE VIEW', w / 2, h * 0.52, 13, COLORS.hudAmber, 'center');
  }

  function drawEnd(game) {
    const w = state.width;
    const h = state.height;
    ctx.fillStyle = 'rgba(8,12,20,0.62)';
    ctx.fillRect(0, 0, w, h);
    const title = game.mode === 'landed' ? game.landing.label.toUpperCase() : 'AIRCRAFT DOWN';
    text(title, w / 2, h * 0.35, 30, game.mode === 'landed' ? COLORS.hud : COLORS.hudRed, 'center');
    text(`FINAL SCORE ${game.score}`, w / 2, h * 0.43, 16, COLORS.hud, 'center', false);
    const blink = Math.sin(state.flash * 5) > -0.3;
    if (blink) text('R RESTART   ENTER NEW FLIGHT', w / 2, h * 0.55, 14, COLORS.hud, 'center');
  }

  function setMessage(message, seconds = 1.4) {
    state.message = message;
    state.messageTimer = seconds;
  }

  function draw(game, fs, readout, dt = 0.016) {
    state.flash += dt;
    if (state.messageTimer > 0) state.messageTimer -= dt;
    else state.message = '';
    ctx.clearRect(0, 0, state.width, state.height);

    if (game.mode === 'flying' || game.mode === 'landed' || game.mode === 'crashed') {
      drawHorizon(readout);
      drawReadout(game, fs);
      drawMission(game, game.missions.mission, fs);
      if (state.message) {
        const alpha = Math.min(1, state.messageTimer / 0.35);
        ctx.save();
        ctx.globalAlpha = alpha;
        text(state.message, state.width / 2, state.height * 0.62, 15, COLORS.ringPulse, 'center');
        ctx.restore();
      }
    }

    if (game.mode === 'title') drawTitle(game);
    if (game.mode === 'paused') drawPause(game);
    if (game.mode === 'landed' || game.mode === 'crashed') drawEnd(game);
  }

  resize();
  window.addEventListener('resize', resize);
  return { state, resize, draw, setMessage };
}
