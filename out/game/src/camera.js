import { clamp, lerp } from './noise.js';

const THREE = globalThis.THREE;

export function createCamera(camera, aircraftGroup) {
  const state = {
    mode: 'chase',
    shake: 0,
    initialized: false,
    desired: new THREE.Vector3(),
    lookAt: new THREE.Vector3(),
    currentLookAt: new THREE.Vector3(),
  };

  state.currentLookAt.set(0, 0, 30);
  camera.position.set(0, 30, -170);

  function frameVectors(physicsState) {
    const pos = physicsState.position;
    const quat = physicsState.quaternion;
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(quat);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(quat);
    return { pos, quat, forward, up };
  }

  function update(dt, physicsState, effects) {
    if (!physicsState || !effects) return;
    const vectors = frameVectors(physicsState);
    const delta = clamp(dt, 0, 0.05);
    const initialized = state.initialized;
    state.initialized = true;
    const smooth = initialized
      ? 1 - Math.exp(-delta * (state.mode === 'chase' ? 6.2 : 11))
      : 1;
    let targetPosition;
    let lookTarget;

    if (state.mode === 'chase') {
      const aft = new THREE.Vector3(0, 3.35, -10.2).applyQuaternion(vectors.quat);
      targetPosition = vectors.pos.clone().add(aft);
      const ahead = new THREE.Vector3(0, 1.15, 16).applyQuaternion(vectors.quat);
      lookTarget = vectors.pos.clone().add(ahead);
      aircraftGroup.visible = true;
    } else {
      const cockpit = new THREE.Vector3(0, 1.15, 1.4).applyQuaternion(vectors.quat);
      targetPosition = vectors.pos.clone().add(cockpit);
      const ahead = new THREE.Vector3(0, -0.12, 52).applyQuaternion(vectors.quat);
      lookTarget = vectors.pos.clone().add(ahead);
      aircraftGroup.visible = false;
    }

    const previous = state.currentLookAt.clone();
    state.currentLookAt.lerp(lookTarget, smooth);
    camera.position.lerp(targetPosition, smooth);

    const shake = effects.takeShake();
    const rollCamera = physicsState.rollDeg * 0.028;
    const cameraUp = new THREE.Vector3(
      -Math.sin(rollCamera),
      Math.cos(rollCamera),
      PhysicsUpBlend(physicsState, state.currentLookAt),
    ).normalize();

    camera.up.copy(cameraUp);
    camera.lookAt(state.currentLookAt);

    const shakeX = shake.x + (Math.random() - 0.5) * state.shake * 0.01;
    const shakeY = shake.y + (Math.random() - 0.5) * state.shake * 0.01;
    camera.position.x += shakeX;
    camera.position.y += shakeY;
    state.shake = Math.max(0, state.shake - delta * 1.8);
  }

  function PhysicsUpBlend(physicsState, target) {
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(physicsState.quaternion);
    return clamp(0.16 + forward.y * 0.12, 0, 0.4) + (target.y > 0 ? 0.04 : 0);
  }

  return {
    state,
    update,
    setMode(mode) {
      state.mode = mode === 'cockpit' ? 'cockpit' : 'chase';
    },
  };
}
