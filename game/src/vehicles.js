// Cars: a boxy low-poly factory (sedan, sports, truck, taxi, police), arcade
// driving physics (accelerate, brake, steer, handbrake drift), and enter/exit.
// Every car is a THREE.Group with a `userData.car` state record.
import * as THREE from 'three';
import { CAR_TYPES } from './config.js';

const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10);
const wheelMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
const glassMat = new THREE.MeshLambertMaterial({ color: 0x9ac8e0 });
const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff6c8 });
const tailMat = new THREE.MeshBasicMaterial({ color: 0xd8232a });
const sirenRed = new THREE.MeshBasicMaterial({ color: 0xff2222 });
const sirenBlue = new THREE.MeshBasicMaterial({ color: 0x2255ff });

export function createCarMesh(type, color) {
  const spec = CAR_TYPES[type];
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const body = new THREE.Mesh(new THREE.BoxGeometry(spec.width, spec.height, spec.length), bodyMat);
  body.position.y = 0.55 + spec.height / 2 - 0.25;
  body.castShadow = true;
  group.add(body);
  // Cabin
  const cabinLen = type === 'truck' ? spec.length * 0.28 : spec.length * 0.5;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(spec.width * 0.85, 0.62, cabinLen), type === 'truck' ? bodyMat : glassMat);
  cabin.position.set(0, 0.55 + spec.height + 0.06, type === 'truck' ? spec.length * 0.3 : -spec.length * 0.05);
  cabin.castShadow = true;
  group.add(cabin);
  if (type === 'truck') {
    // Cargo bed walls
    const bed = new THREE.Mesh(new THREE.BoxGeometry(spec.width * 0.95, 0.7, spec.length * 0.6), new THREE.MeshLambertMaterial({ color: 0x3a3f44 }));
    bed.position.set(0, 0.55 + spec.height + 0.1, -spec.length * 0.18);
    group.add(bed);
  }
  // Wheels
  const wheels = [];
  const wx = spec.width / 2 - 0.05;
  const wz = spec.length / 2 - 0.7;
  for (const [x, z] of [[-wx, wz], [wx, wz], [-wx, -wz], [wx, -wz]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.36, z);
    w.castShadow = true;
    group.add(w);
    wheels.push(w);
  }
  // Headlights and taillights
  for (const sx of [-1, 1]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), lightMat);
    hl.position.set(sx * (spec.width / 2 - 0.35), 0.75, spec.length / 2 + 0.02);
    group.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), tailMat);
    tl.position.set(sx * (spec.width / 2 - 0.35), 0.75, -spec.length / 2 - 0.02);
    group.add(tl);
  }
  if (type === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.3), new THREE.MeshBasicMaterial({ color: 0xfff2a0 }));
    sign.position.set(0, 0.55 + spec.height + 0.7, 0);
    group.add(sign);
  }
  let sirens = null;
  if (type === 'police') {
    // White doors band + light bar
    const band = new THREE.Mesh(new THREE.BoxGeometry(spec.width + 0.04, 0.4, spec.length * 0.55), new THREE.MeshLambertMaterial({ color: 0xf0f0f0 }));
    band.position.set(0, 0.72, 0);
    group.add(band);
    const bar = new THREE.Group();
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.3), sirenRed);
    r.position.x = -0.3;
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.3), sirenBlue);
    b.position.x = 0.3;
    bar.add(r, b);
    bar.position.set(0, 0.55 + spec.height + 0.68, -0.1);
    group.add(bar);
    sirens = { red: r, blue: b };
  }
  group.userData.wheels = wheels;
  group.userData.sirens = sirens;
  return group;
}

export function createCar(scene, type, x, z, heading, color) {
  const spec = CAR_TYPES[type];
  const mesh = createCarMesh(type, color ?? spec.colors[0]);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  scene.add(mesh);
  const car = {
    type,
    spec,
    mesh,
    heading, // radians; forward = (sin, cos) in xz
    speed: 0, // m/s, signed (negative = reversing)
    steer: 0, // current steering angle, smoothed
    health: 100,
    driver: null, // 'player' | 'traffic' | 'police' | 'parked' | null
    ai: null, // traffic/police brain state
    smoke: 0, // damage smoke 0..1
    sirenPhase: Math.random() * 10,
    id: Math.random().toString(36).slice(2, 8),
  };
  mesh.userData.car = car;
  return car;
}

export function forwardOf(car) {
  return { x: Math.sin(car.heading), z: Math.cos(car.heading) };
}

// Arcade drive step. throttle -1..1, steerInput -1..1, handbrake bool.
// city.collideCircle resolves building hits; onCrash is called on hard impacts.
export function driveCar(car, dt, throttle, steerInput, handbrake, city, onCrash) {
  const spec = car.spec;
  const targetSteer = steerInput * (car.speed >= 0 ? 1 : -1);
  car.steer += (targetSteer - car.steer) * Math.min(1, dt * 8);
  // Steering authority fades at high speed so the car stays controllable.
  const speedFactor = 1 / (1 + Math.abs(car.speed) * 0.045);
  const turnRate = car.steer * spec.turn * speedFactor * (handbrake ? 1.5 : 1);
  car.heading += turnRate * Math.min(1, Math.abs(car.speed) / 4) * dt * Math.sign(car.speed || 1);

  if (throttle > 0) car.speed += spec.accel * throttle * dt * (1 - Math.max(0, car.speed) / spec.topSpeed);
  else if (throttle < 0) {
    if (car.speed > 0.5) car.speed += spec.brake * throttle * dt; // braking
    else car.speed += spec.accel * 0.6 * throttle * dt; // reversing (cap below)
  }
  // Drag and rolling resistance
  car.speed -= car.speed * (handbrake ? 1.4 : 0.35) * dt;
  if (Math.abs(car.speed) < 0.05 && throttle === 0) car.speed = 0;
  car.speed = Math.max(-spec.topSpeed * 0.35, Math.min(spec.topSpeed, car.speed));

  const fwd = forwardOf(car);
  let nx = car.mesh.position.x + fwd.x * car.speed * dt;
  let nz = car.mesh.position.z + fwd.z * car.speed * dt;
  // Buildings: push out and kill speed on impact.
  const radius = Math.max(spec.length, spec.width) / 2;
  const resolved = city.collideCircle(nx, nz, radius * 0.85);
  if (resolved.hit) {
    const impact = Math.abs(car.speed);
    nx = resolved.x;
    nz = resolved.z;
    if (impact > 6) {
      car.health = Math.max(0, car.health - impact * 0.9);
      car.smoke = Math.min(1, car.smoke + impact * 0.02);
      if (onCrash) onCrash(car, impact, nx, nz);
    }
    car.speed *= -0.25; // bounce back a little
  }
  const clamped = city.clampToCity(nx, nz, radius);
  if (clamped.x !== nx || clamped.z !== nz) {
    car.speed *= 0.4;
    nx = clamped.x;
    nz = clamped.z;
  }
  car.mesh.position.x = nx;
  car.mesh.position.z = nz;
  car.mesh.rotation.y = car.heading;
  // Wheels spin and front wheels steer.
  const spin = (car.speed * dt) / 0.36;
  car.mesh.userData.wheels.forEach((w, i) => {
    w.rotation.x += spin;
    if (i < 2) w.rotation.y = car.steer * 0.4;
  });
  // Siren strobe
  if (car.mesh.userData.sirens) {
    car.sirenPhase += dt * 9;
    const on = Math.sin(car.sirenPhase) > 0;
    car.mesh.userData.sirens.red.visible = on;
    car.mesh.userData.sirens.blue.visible = !on;
  }
  return car.speed;
}

// Circle-vs-circle push between two cars; returns true on a hard hit.
export function collideCars(a, b) {
  const ax = a.mesh.position.x;
  const az = a.mesh.position.z;
  const bx = b.mesh.position.x;
  const bz = b.mesh.position.z;
  const dx = bx - ax;
  const dz = bz - az;
  const ra = Math.max(a.spec.length, a.spec.width) / 2;
  const rb = Math.max(b.spec.length, b.spec.width) / 2;
  const min = (ra + rb) * 0.72;
  const d2 = dx * dx + dz * dz;
  if (d2 >= min * min || d2 < 1e-6) return false;
  const d = Math.sqrt(d2);
  const push = (min - d) / 2;
  const nx = dx / d;
  const nz = dz / d;
  a.mesh.position.x -= nx * push;
  a.mesh.position.z -= nz * push;
  b.mesh.position.x += nx * push;
  b.mesh.position.z += nz * push;
  const rel = Math.abs(a.speed - b.speed);
  if (rel > 5) {
    a.speed *= 0.55;
    b.speed *= 0.55;
    a.health = Math.max(0, a.health - rel * 0.5);
    b.health = Math.max(0, b.health - rel * 0.5);
    return true;
  }
  const avg = (a.speed + b.speed) / 2;
  a.speed = avg * 0.8;
  b.speed = avg * 0.8;
  return false;
}
