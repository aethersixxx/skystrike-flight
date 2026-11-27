import { COLORS } from './config.js';

const THREE = globalThis.THREE;

function standard(color, roughness = 0.42, metalness = 0.35) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

export function createAircraft(scene, seed = 1) {
  const group = new THREE.Group();
  group.name = 'skystrike';

  const fuselageGeo = new THREE.CylinderGeometry(0.56, 0.42, 4.6, 10, 1);
  fuselageGeo.rotateX(Math.PI / 2);
  const fuselage = new THREE.Mesh(fuselageGeo, standard(0x6e5b52));
  fuselage.castShadow = false;
  group.add(fuselage);

  const cowlGeo = new THREE.CylinderGeometry(0.6, 0.44, 0.8, 12, 1);
  cowlGeo.rotateX(Math.PI / 2);
  const cowl = new THREE.Mesh(cowlGeo, standard(0x9b4038, 0.5, 0.28));
  cowl.position.z = 2.15;
  group.add(cowl);

  const canopyGeo = new THREE.SphereGeometry(0.42, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.48);
  const canopy = new THREE.Mesh(canopyGeo, new THREE.MeshStandardMaterial({
    color: 0x1f2b3a,
    roughness: 0.18,
    metalness: 0.1,
  }));
  canopy.position.set(0, 0.58, 0.58);
  canopy.scale.set(0.8, 1, 1.7);
  group.add(canopy);

  const spineGeo = new THREE.BoxGeometry(0.34, 0.16, 2.1);
  const spine = new THREE.Mesh(spineGeo, standard(0x4f4340));
  spine.position.set(0, 0.4, -0.35);
  group.add(spine);

  const wingGeo = new THREE.BoxGeometry(7.8, 0.16, 1.85);
  const wing = new THREE.Mesh(wingGeo, standard(0x7e8f7a));
  wing.position.set(0, 0.05, -0.15);
  wing.rotation.z = -0.03;
  group.add(wing);

  const leftAileronGeo = new THREE.BoxGeometry(1.75, 0.1, 0.62);
  const leftAileron = new THREE.Mesh(leftAileronGeo, standard(0x9a463f));
  leftAileron.position.set(-3.05, -0.02, -0.72);
  leftAileron.userData.baseRotation = 0;
  group.add(leftAileron);

  const rightAileron = new THREE.Mesh(leftAileronGeo, standard(0x9a463f));
  rightAileron.position.set(3.05, -0.02, -0.72);
  rightAileron.userData.baseRotation = 0;
  group.add(rightAileron);

  const tailGeo = new THREE.BoxGeometry(3.0, 0.13, 1.15);
  const tail = new THREE.Mesh(tailGeo, standard(0x7e8f7a));
  tail.position.set(0, 0.16, -2.24);
  group.add(tail);

  const elevatorGeo = new THREE.BoxGeometry(1.1, 0.09, 0.55);
  const leftElevator = new THREE.Mesh(elevatorGeo, standard(0x9a463f));
  leftElevator.position.set(-1.4, 0.18, -2.58);
  group.add(leftElevator);
  const rightElevator = new THREE.Mesh(elevatorGeo, standard(0x9a463f));
  rightElevator.position.set(1.4, 0.18, -2.58);
  group.add(rightElevator);

  const finGeo = new THREE.BoxGeometry(0.16, 1.05, 1.25);
  const fin = new THREE.Mesh(finGeo, standard(0x8f4b3f));
  fin.position.set(0, 0.82, -2.24);
  fin.rotation.x = -0.16;
  group.add(fin);

  const rudderGeo = new THREE.BoxGeometry(0.1, 0.82, 0.45);
  const rudder = new THREE.Mesh(rudderGeo, standard(0x9a463f));
  rudder.position.set(0, 0.86, -2.65);
  group.add(rudder);

  const propellerGroup = new THREE.Group();
  propellerGroup.position.set(0, 0, 2.55);
  const bladeGeo = new THREE.BoxGeometry(0.17, 2.35, 0.08);
  const bladeMaterial = standard(0x2b2727, 0.55, 0.06);
  const bladeA = new THREE.Mesh(bladeGeo, bladeMaterial);
  bladeA.rotation.z = Math.PI / 2;
  propellerGroup.add(bladeA);
  const bladeB = new THREE.Mesh(bladeGeo, bladeMaterial);
  bladeB.rotation.z = Math.PI;
  propellerGroup.add(bladeB);
  const hubGeo = new THREE.SphereGeometry(0.25, 10, 8);
  const hub = new THREE.Mesh(hubGeo, standard(0x3b3538, 0.6, 0.2));
  propellerGroup.add(hub);
  group.add(propellerGroup);

  for (const x of [-4.15, 4.15]) {
    const navGeo = new THREE.SphereGeometry(0.14, 8, 6);
    const nav = new THREE.Mesh(navGeo, new THREE.MeshBasicMaterial({
      color: x < 0 ? COLORS.hudRed : COLORS.hud,
    }));
    nav.position.set(x, 0.1, -0.35);
    group.add(nav);
  }

  scene.add(group);

  const control = {
    leftAileron,
    rightAileron,
    leftElevator,
    rightElevator,
    rudder,
  };

  function update(dt, commands, physics) {
    const speed = physics?.speed ?? 55;
    const propellerSpeed = 38 + Math.max(0, speed) * 1.35;
    propellerGroup.rotation.z += propellerSpeed * Math.min(dt, 0.05);

    const aileron = commands.roll * 0.42;
    leftAileron.rotation.x = -aileron;
    rightAileron.rotation.x = aileron;
    const elevator = commands.pitch * -0.5;
    leftElevator.rotation.x = elevator;
    rightElevator.rotation.x = elevator;
    rudder.rotation.y = commands.yaw * 0.5;
  }

  return {
    group,
    propeller: propellerGroup,
    control,
    update,
  };
}
