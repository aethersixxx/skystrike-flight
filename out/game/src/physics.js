import { PHYSICS } from './config.js';
import { clamp, lerp, smoothstep } from './noise.js';

const THREE = globalThis.THREE;

function approach(current, target, delta, speed = 5.5) {
  const step = Math.min(1, delta * speed);
  return current + (target - current) * step;
}

export function createPhysics() {
  const state = {
    position: new THREE.Vector3(0, 260, -1400),
    quaternion: new THREE.Quaternion(),
    speed: 56,
    throttle: 0.72,
    fuel: 100,
    health: 100,
    damage: 0,
    stalled: false,
    gLoad: 1,
    pitchControl: 0,
    rollControl: 0,
    yawControl: 0,
    pitchDeg: 0,
    yawDeg: 0,
    rollDeg: 0,
    heading: 0,
    altitudeAgl: 0,
    altitudeMsl: 0,
    verticalSpeed: 0,
    totalDistance: 0,
    onRunway: false,
  };

  const active = {
    pitch: 0,
    roll: 0,
    yaw: 0,
  };

  const axisX = new THREE.Vector3(1, 0, 0);
  const axisY = new THREE.Vector3(0, 1, 0);
  const axisZ = new THREE.Vector3(0, 0, 1);
  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const up = new THREE.Vector3();
  const euler = new THREE.Euler();
  const deltaQuat = new THREE.Quaternion();

  function applyOrientation(yawDeg = 0, pitchDeg = 0, rollDeg = 0) {
    state.quaternion.setFromEuler(new THREE.Euler(
      THREE.MathUtils.degToRad(pitchDeg),
      THREE.MathUtils.degToRad(yawDeg),
      THREE.MathUtils.degToRad(rollDeg),
      'YXZ',
    ));
  }

  function setStart(location) {
    state.position.set(location.x, location.y, location.z);
    applyOrientation(location.yaw ?? 0, location.pitch ?? 0, location.roll ?? 0);
    state.speed = location.speed ?? 55;
    state.throttle = location.throttle ?? 0.72;
    state.fuel = 100;
    state.health = 100;
    state.damage = 0;
    state.stalled = false;
    state.gLoad = 1;
    active.pitch = 0;
    active.roll = 0;
    active.yaw = 0;
    state.pitchControl = 0;
    state.rollControl = 0;
    state.yawControl = 0;
    state.totalDistance = 0;
  }

  function update(dt, commands, world, effects) {
    const events = [];
    const delta = clamp(dt, 0, 0.05);
    if (!world || !world.terrain) return events;

    state.throttle = commands.throttleTarget === null
      ? state.throttle
      : approach(state.throttle, commands.throttleTarget, delta, 1.25);
    state.throttle = clamp(state.throttle, 0, 1);

    state.pitchControl = approach(state.pitchControl, clamp(commands.pitch ?? 0, -1.6, 1.6), delta, PHYSICS.controlSmoothing);
    state.rollControl = approach(state.rollControl, clamp(commands.roll ?? 0, -1.6, 1.6), delta, PHYSICS.controlSmoothing);
    state.yawControl = approach(state.yawControl, clamp(commands.yaw ?? 0, -1.6, 1.6), delta, PHYSICS.controlSmoothing);

    const deflection = Math.abs(state.pitchControl) + Math.abs(state.yawControl) * 1.15;
    const turnLoad = 1 + deflection * state.speed * 0.17;
    const maxLoad = 1.25 + state.speed * 0.052;
    const wasStalled = state.stalled;
    if (!wasStalled && turnLoad > maxLoad * 1.05) state.stalled = true;
    else if (wasStalled && turnLoad < maxLoad * 0.68) state.stalled = false;
    if (wasStalled !== state.stalled) {
      events.push({ type: 'stall-change', stalled: state.stalled, turnLoad, maxLoad });
    }

    state.gLoad = turnLoad;
    if (state.stalled) {
      state.speed -= 7.5 * delta;
      state.damage += 0.55 * delta;
      state.health -= 0.4 * delta;
      events.push({ type: 'stall', delta, turnLoad });
    } else if (turnLoad > 3.8) {
      state.damage += (turnLoad - 3.8) * PHYSICS.damageFromOverG * delta;
      state.health -= (turnLoad - 3.8) * PHYSICS.damageFromOverG * 0.55 * delta;
    }

    const stallDrop = state.stalled ? -0.55 : 0;
    const authority = state.stalled ? 0.16 : 1;
    const pitchRate = (state.pitchControl + stallDrop) * PHYSICS.pitchRate * authority;
    const rollRate = state.rollControl * PHYSICS.rollRate * authority;
    const yawRate = (state.yawControl + state.rollControl * 0.18) * PHYSICS.yawRate * authority;

    deltaQuat.setFromAxisAngle(axisX, pitchRate * delta);
    state.quaternion.multiply(deltaQuat);
    deltaQuat.setFromAxisAngle(axisY, yawRate * delta);
    state.quaternion.multiply(deltaQuat);
    deltaQuat.setFromAxisAngle(axisZ, rollRate * delta);
    state.quaternion.multiply(deltaQuat);
    state.quaternion.normalize();

    forward.set(0, 0, 1).applyQuaternion(state.quaternion);
    right.set(1, 0, 0).applyQuaternion(state.quaternion);
    up.set(0, 1, 0).applyQuaternion(state.quaternion);

    euler.setFromQuaternion(state.quaternion, 'YXZ');
    state.pitchDeg = THREE.MathUtils.radToDeg(euler.x);
    state.yawDeg = THREE.MathUtils.radToDeg(euler.y);
    state.rollDeg = THREE.MathUtils.radToDeg(euler.z);
    state.heading = ((state.yawDeg % 360) + 360) % 360;

    const thrust = state.fuel <= 0
      ? PHYSICS.idlingThrust * 0.12
      : PHYSICS.idlingThrust + state.throttle * PHYSICS.maxThrottle;
    const climbPenalty = PHYSICS.climbGravity * Math.max(0, forward.y);
    const diveAssist = PHYSICS.climbGravity * Math.max(0, -forward.y) * 0.45;
    const drag = PHYSICS.dragBase + PHYSICS.dragDynamic * state.speed * state.speed + climbPenalty;
    const acceleration = thrust - drag + diveAssist - (state.stalled ? 2.8 : 0);
    state.speed += acceleration * delta;
    state.speed = clamp(state.speed, PHYSICS.minSpeed, PHYSICS.maxSpeed);

    const previousPosition = state.position.clone();
    state.position.addScaledVector(forward, state.speed * delta);
    state.totalDistance += previousPosition.distanceTo(state.position);

    state.fuel = Math.max(0, state.fuel - state.throttle * PHYSICS.fuelBurnPerThrottle * delta);
    state.health = clamp(state.health, 0, 100);
    state.damage = clamp(state.damage, 0, 100);

    const groundY = world.terrain.heightAt(state.position.x, state.position.z);
    state.altitudeAgl = state.position.y - groundY;
    state.altitudeMsl = state.position.y;
    state.verticalSpeed = -forward.y * state.speed;
    state.onRunway = world.terrain.isRunway(state.position.x, state.position.z);
    const clearance = state.onRunway ? 0.8 : PHYSICS.groundClearance;

    if (state.position.y <= world.terrain.seaLevel + PHYSICS.waterClearance) {
      const waterImpact = Math.max(0, state.verticalSpeed);
      events.push({
        type: 'crash',
        position: state.position.clone(),
        impact: waterImpact + state.speed * 0.25,
        surface: 'water',
        verticalSpeed: waterImpact,
      });
      state.position.y = world.terrain.seaLevel + PHYSICS.waterClearance;
    } else if (state.position.y <= groundY + clearance) {
      const verticalSpeed = Math.max(0, state.verticalSpeed);
      const impact = verticalSpeed * 3.5 + Math.max(0, state.speed - 30) * 0.35;
      state.position.y = groundY + clearance;
      events.push({
        type: state.onRunway ? 'touchdown' : 'crash',
        position: state.position.clone(),
        impact,
        verticalSpeed,
        speed: state.speed,
        pitchDeg: state.pitchDeg,
        rollDeg: state.rollDeg,
        heading: state.heading,
        offsetFromCenter: state.position.x,
        onRunway: state.onRunway,
        surface: state.onRunway ? 'runway' : 'terrain',
      });
    }

    if (state.health <= 0) {
      events.push({
        type: 'crash',
        position: state.position.clone(),
        impact: 35,
        surface: 'overstress',
        verticalSpeed: 0,
      });
      state.health = 0;
    }

    return events;
  }

  return { state, update, setStart, applyOrientation };
}

export function flightReadout(physicsState) {
  return {
    altitudeAgl: Math.round(physicsState.altitudeAgl),
    altitudeMsl: Math.round(physicsState.altitudeMsl),
    speed: Math.round(physicsState.speed),
    heading: Math.round(physicsState.heading),
    fuel: physicsState.fuel,
    health: physicsState.health,
    throttle: physicsState.throttle,
    pitch: physicsState.pitchDeg,
    roll: physicsState.rollDeg,
    verticalSpeed: physicsState.verticalSpeed,
    totalDistance: physicsState.totalDistance,
    stalled: physicsState.stalled,
    gLoad: physicsState.gLoad,
  };
}
