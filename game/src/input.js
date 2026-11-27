const THROTTLE_UP = new Set(['KeyW', 'ShiftLeft', 'ShiftRight']);
const THROTTLE_DOWN = new Set(['KeyS', 'ControlLeft', 'ControlRight']);
const ACTION_KEYS = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Space',
  'Enter',
  'KeyP',
  'KeyC',
  'KeyR',
  'KeyM',
  'Digit1',
  'Digit2',
  'Digit3',
]);

export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  const commands = {
    pitch: 0,
    roll: 0,
    yaw: 0,
    throttleTarget: null,
    mousePitch: 0,
    mouseRoll: 0,
  };

  let dragging = false;
  let lastClientX = 0;
  let lastClientY = 0;
  let mouseDX = 0;
  let mouseDY = 0;

  function keyDown(event) {
    if (ACTION_KEYS.has(event.code) || THROTTLE_UP.has(event.code) || THROTTLE_DOWN.has(event.code)) {
      event.preventDefault();
    }
    if (!event.repeat) pressed.add(event.code);
    keys.add(event.code);
    if (event.code === 'KeyC' && !event.repeat) pressed.add('KeyC');
  }

  function keyUp(event) {
    keys.delete(event.code);
  }

  function pointerDown(event) {
    dragging = true;
    lastClientX = event.clientX;
    lastClientY = event.clientY;
    canvas.setPointerCapture?.(event.pointerId);
  }

  function pointerMove(event) {
    if (!dragging) return;
    mouseDX += event.clientX - lastClientX;
    mouseDY += event.clientY - lastClientY;
    lastClientX = event.clientX;
    lastClientY = event.clientY;
  }

  function pointerUp(event) {
    dragging = false;
    canvas.releasePointerCapture?.(event.pointerId);
    mouseDX = 0;
    mouseDY = 0;
  }

  function blur() {
    keys.clear();
    dragging = false;
    mouseDX = 0;
    mouseDY = 0;
  }

  window.addEventListener('keydown', keyDown, { passive: false });
  window.addEventListener('keyup', keyUp);
  window.addEventListener('blur', blur);
  canvas.addEventListener('pointerdown', pointerDown);
  window.addEventListener('pointermove', pointerMove);
  window.addEventListener('pointerup', pointerUp);
  canvas.style.touchAction = 'none';

  function update(dt = 0.016, onPressed = () => {}) {
    for (const code of pressed) onPressed(code);
    pressed.clear();

    const pitchKey = (keys.has('ArrowUp') ? 1 : 0) + (keys.has('ArrowDown') ? -1 : 0);
    const rollKey = (keys.has('ArrowLeft') ? -1 : 0) + (keys.has('ArrowRight') ? 1 : 0);
    const yawKey = (keys.has('KeyA') ? -1 : 0) + (keys.has('KeyD') ? 1 : 0);

    const mousePitch = Math.max(-1.6, Math.min(1.6, mouseDY * 0.0026));
    const mouseRoll = Math.max(-1.6, Math.min(1.6, mouseDX * 0.0032));

    if (keys.has('KeyW') || keys.has('ShiftLeft') || keys.has('ShiftRight')) commands.throttleTarget = 1;
    else if (keys.has('KeyS') || keys.has('ControlLeft') || keys.has('ControlRight')) commands.throttleTarget = 0;
    else commands.throttleTarget = null;

    commands.pitch = pitchKey + mousePitch;
    commands.roll = rollKey + mouseRoll;
    commands.yaw = yawKey;
    commands.mousePitch = mouseDY;
    commands.mouseRoll = mouseDX;

    mouseDX = 0;
    mouseDY = 0;
    return commands;
  }

  return {
    commands,
    isDown: (code) => keys.has(code),
    update,
    destroy() {
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
      window.removeEventListener('blur', blur);
      canvas.removeEventListener('pointerdown', pointerDown);
      window.removeEventListener('pointermove', pointerMove);
      window.removeEventListener('pointerup', pointerUp);
    },
  };
}
