// SOLMAR BAY — boot and the one loop. The world advances in fixed 1/60 s
// steps; the renderer paints every animation frame. Screens: title, play,
// paused, busted/wasted. ?seed=N fixes the city. ?shot=drive|chase|street|
// mission stages that scene instead of running the loop, paints it and sets
// window.__shotReady for a screenshot.
import * as THREE from 'three';
import { CAR_TYPES, CITY_HALF, LANDMARKS, PALETTE, PLAYER_MAX_HEALTH, STEP } from './config.js';
import { createRandom } from './random.js';
import { ACTION_FIRE, ACTION_HORN, ACTION_INTERACT, ACTION_PAUSE, ACTION_PUNCH, ACTION_RELOAD, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createCity } from './city.js';
import { collideCars, createCar, driveCar, forwardOf } from './vehicles.js';
import { createTraffic } from './traffic.js';
import { createPedestrians } from './pedestrians.js';
import { createPlayer, damagePlayer, healPlayer, stepPlayer } from './player.js';
import { createCombat } from './combat.js';
import { createPolice } from './police.js';
import { createMissions, MISSIONS } from './missions.js';
import { createCamera } from './camera.js';
import { createHud } from './hud.js';
import { createMinimap } from './minimap.js';
import { createEffects } from './effects.js';
import { createSave } from './save.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const FIRE_INTERVAL = 0.28;
const ENTER_RANGE = 4.2;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

// --- Renderer, scene, sun ---
const container = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.sky);
scene.fog = new THREE.Fog(PALETTE.fog, 130, 430);

const hemi = new THREE.HemisphereLight(0xbfe3ff, 0x8a7a5a, 1.35);
scene.add(hemi);
const sun = new THREE.DirectionalLight(PALETTE.sun, 2.4);
sun.position.set(90, 140, 60);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -90;
sun.shadow.camera.right = 90;
sun.shadow.camera.top = 90;
sun.shadow.camera.bottom = -90;
sun.shadow.camera.near = 20;
sun.shadow.camera.far = 400;
sun.shadow.bias = -0.0006;
scene.add(sun);
scene.add(sun.target);

const camera3 = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
const camera = createCamera(camera3);

// --- World systems ---
const random = createRandom(seed);
const city = createCity(scene, random);
const audio = createAudio();
const input = createInput(renderer.domElement);
const hud = createHud();
const minimap = createMinimap(document.getElementById('minimap'));
const effects = createEffects(scene);
const traffic = createTraffic(scene, city, random);
const pedestrians = createPedestrians(scene, city, random);
const combat = createCombat(scene);
const police = createPolice(scene, city, random);
const player = createPlayer(scene, 0, 6);
player.heading = Math.PI;

for (let i = 0; i < 12; i += 1) traffic.spawnTrafficCar();
for (let i = 0; i < 10; i += 1) traffic.spawnParkedCar();
for (let i = 0; i < 24; i += 1) pedestrians.spawnPed();
// A sports car parked at the kerb near the first mission's marker, ready to steal.
const showcaseCar = createCar(scene, 'sports', 30, -51.4, Math.PI / 2, 0xd8232a);
showcaseCar.driver = 'parked';
traffic.parked.push(showcaseCar);

// The shared context the missions module works through.
const world = {
  player,
  police,
  combat,
  traffic,
  audio,
  hud,
  city,
  effects,
  scene,
  pedestrians,
  carSpec: (type) => CAR_TYPES[type],
  playerPos() {
    return player.car ? player.car.mesh.position : player.mesh.position;
  },
};
const save = createSave(
  () => ({
    cash: player.cash,
    missionsDone: player.missionsDone,
    garageCars: player.garageCars,
    x: player.mesh.position.x,
    z: player.mesh.position.z,
    health: player.health,
  }),
  (data) => {
    player.cash = data.cash ?? 250;
    player.missionsDone = Array.isArray(data.missionsDone) ? data.missionsDone : [];
    player.garageCars = data.garageCars ?? 0;
    player.health = data.health ?? PLAYER_MAX_HEALTH;
    if (typeof data.x === 'number' && typeof data.z === 'number') {
      player.mesh.position.set(data.x, 0, data.z);
    }
  },
);
world.save = save;
const missions = createMissions(scene, world);
world.missions = missions;

// --- Game state ---
let screen = 'title'; // title | play | paused | end
let elapsed = 0;
let fireCooldown = 0;
let lastLookTime = 0;
let endKind = null; // 'busted' | 'wasted'
let titleAngle = 0;

function allCars() {
  const list = [...traffic.cars, ...traffic.parked, ...police.copCars];
  if (player.car && !list.includes(player.car)) list.push(player.car);
  return list;
}

function nearestCar(range) {
  const p = player.mesh.position;
  let best = null;
  let bestD = range;
  for (const car of allCars()) {
    const d = Math.hypot(car.mesh.position.x - p.x, car.mesh.position.z - p.z);
    if (d < bestD) {
      best = car;
      bestD = d;
    }
  }
  return best;
}

function enterCar(car) {
  const wasParked = car.driver === 'parked' || car.driver === 'traffic';
  if (wasParked) {
    // Stealing: a crime when a cop or a pedestrian is watching.
    const p = car.mesh.position;
    const copNear = police.copCars.some((c) => Math.hypot(c.mesh.position.x - p.x, c.mesh.position.z - p.z) < 60)
      || police.footCops.some((c) => Math.hypot(c.mesh.position.x - p.x, c.mesh.position.z - p.z) < 40);
    const pedNear = pedestrians.peds.some((pd) => pd.state !== 'down' && Math.hypot(pd.mesh.position.x - p.x, pd.mesh.position.z - p.z) < 18);
    if (copNear || pedNear) {
      police.addWanted(1);
      hud.showBanner('Car stolen!', 'Someone saw that — the SBPD is on its way');
    }
  }
  traffic.removeCar(car);
  car.driver = 'player';
  car.ai = null;
  player.car = car;
  player.mesh.visible = false;
  player.aiming = false;
  document.getElementById('car-name').textContent = car.spec.name;
  audio.click();
}

function exitCar() {
  const car = player.car;
  if (!car) return;
  player.car = null;
  car.driver = null;
  const fwd = forwardOf(car);
  const side = { x: fwd.z, z: -fwd.x };
  player.mesh.position.set(
    car.mesh.position.x + side.x * 2.2,
    0,
    car.mesh.position.z + side.z * 2.2,
  );
  player.mesh.visible = true;
  player.heading = car.heading;
  audio.click();
}

function onCrash(car, impact, x, z) {
  effects.sparks(x, 0.8, z, Math.min(20, Math.floor(impact)));
  audio.crash();
  pedestrians.scare(x, z, 22);
  if (car.driver === 'player' && impact > 12) {
    // A hard crash hurts the driver a little.
    damagePlayer(player, Math.min(20, impact - 8));
  }
}

function reportCrime(stars) {
  if (stars > 0) police.addWanted(stars);
}

function endRun(kind) {
  endKind = kind;
  screen = 'end';
  input.releaseLock();
  const fine = kind === 'busted' ? police.fines.busted : police.fines.wasted;
  player.cash = Math.max(0, player.cash - fine);
  police.clearWanted();
  if (player.car) {
    player.car.driver = null;
    player.car = null;
    player.mesh.visible = true;
  }
  hud.showEnd(
    kind === 'busted' ? 'BUSTED' : 'WASTED',
    kind === 'busted'
      ? `The SBPD caught up with you. Fine: $${fine}. You walk out of the station with your pride dented and your wallet lighter.`
      : `Solmar Bay got the better of you. Hospital bill: $${fine}. Patch up and get back out there.`,
  );
  save.saveGame();
}

function respawn() {
  const spot = endKind === 'busted' ? LANDMARKS.policeStation : LANDMARKS.hospital;
  player.mesh.position.set(spot.x + 4, 0, spot.z + 4);
  player.health = PLAYER_MAX_HEALTH;
  player.ammo = 12;
  player.reserve = 60;
  camera.snapTo(player.mesh.position);
  hud.showScreen('play');
  screen = 'play';
  save.saveGame();
}

// --- One fixed simulation step ---
function stepWorld(dt) {
  elapsed += dt;
  const look = input.takeLook();
  if (look.dx !== 0 || look.dy !== 0) {
    camera.addLook(look.dx, look.dy);
    lastLookTime = elapsed;
  }
  const actions = input.takeActions();
  if (actions & ACTION_PAUSE && screen === 'play') {
    screen = 'paused';
    input.releaseLock();
    hud.showScreen('pause');
    return;
  }
  if (actions & ACTION_INTERACT) {
    if (missions.active) missions.advanceDialogue();
    if (player.car) exitCar();
    else {
      const car = nearestCar(ENTER_RANGE);
      if (car) enterCar(car);
    }
  }
  if (actions & ACTION_RELOAD && !player.car && player.ammo < 12 && player.reserve > 0 && player.reloading <= 0) {
    player.reloading = 1.2;
    audio.click();
  }
  if (actions & ACTION_HORN && player.car) audio.horn();
  if (actions & ACTION_PUNCH && !player.car) {
    const hit = combat.punch(player.mesh.position, player.heading, pedestrians.peds);
    audio.punch();
    if (hit && hit.hit === 'ped') {
      pedestrians.scare(player.mesh.position.x, player.mesh.position.z, 25);
      reportCrime(1);
    }
  }

  // Aiming and shooting (on foot only).
  player.aiming = !player.car && input.isLocked();
  if (player.aiming) player.aimYaw = camera.yaw;
  fireCooldown -= dt;
  if (player.aiming && input.firing() && fireCooldown <= 0 && player.reloading <= 0) {
    if (player.ammo <= 0) {
      audio.denied();
      fireCooldown = 0.3;
    } else {
      player.ammo -= 1;
      fireCooldown = FIRE_INTERVAL;
      const p = player.mesh.position;
      const fwd = { x: Math.sin(player.aimYaw), z: Math.cos(player.aimYaw) };
      const muzzle = { x: p.x + fwd.x * 0.9, y: 1.45, z: p.z + fwd.z * 0.9 };
      effects.muzzleFlash(muzzle.x, muzzle.y, muzzle.z);
      audio.gunshot();
      pedestrians.scare(p.x, p.z, 30);
      const result = combat.fire(camera3, pedestrians.peds, allCars(), p);
      if (result.hit === 'ped') {
        reportCrime(1);
        if (result.target.state === 'down') reportCrime(1);
      }
      if (result.hit) effects.sparks(result.point.x, result.point.y, result.point.z, 5);
      else if (police.anyCopNear(p)) reportCrime(1);
    }
  }

  // Player movement: drive or walk.
  const axes = input.moveAxes();
  if (player.car) {
    const throttle = axes.z;
    const steer = -axes.x; // D turns right: steering is negative around Y here
    driveCar(player.car, dt, throttle, steer, input.handbrake(), city, onCrash);
    if (input.handbrake() && Math.abs(player.car.speed) > 8) {
      const p = player.car.mesh.position;
      effects.tireSmoke(p.x, 0, p.z);
    }
    if (player.car.smoke > 0.25 && Math.random() < dt * 8) {
      const p = player.car.mesh.position;
      effects.damageSmoke(p.x, 0, p.z);
    }
    if (player.car.health <= 0) {
      // The car dies: the player climbs out of the wreck.
      hud.showBanner('Wrecked!', 'That car is done. Find another ride.');
      exitCar();
    }
    // Running over pedestrians is a crime.
    for (const ped of pedestrians.peds) {
      if (ped.state === 'down') continue;
      const cp = player.car.mesh.position;
      const d = Math.hypot(ped.mesh.position.x - cp.x, ped.mesh.position.z - cp.z);
      if (d < 2.2 && Math.abs(player.car.speed) > 3) {
        ped.state = 'down';
        ped.health = 0;
        ped.mesh.rotation.x = -Math.PI / 2;
        ped.mesh.position.y = 0.3;
        pedestrians.scare(cp.x, cp.z, 25);
        reportCrime(1);
      }
    }
    // Camera eases behind the car when the mouse has been still.
    if (elapsed - lastLookTime > 2.5) {
      let diff = player.car.heading - camera.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      camera.setYaw(camera.yaw + diff * Math.min(1, dt * 1.2));
    }
  } else {
    stepPlayer(player, dt, axes, input.sprint(), input.jump(), camera.yaw, city);
  }

  // The rest of the world.
  traffic.update(dt, player.car, allCars(), onCrash);
  pedestrians.update(dt, world.playerPos());
  const cars = allCars();
  for (let i = 0; i < cars.length; i += 1) {
    for (let j = i + 1; j < cars.length; j += 1) {
      if (collideCars(cars[i], cars[j])) {
        const mx = (cars[i].mesh.position.x + cars[j].mesh.position.x) / 2;
        const mz = (cars[i].mesh.position.z + cars[j].mesh.position.z) / 2;
        effects.sparks(mx, 0.8, mz, 8);
        audio.crash();
      }
    }
  }
  const playerSpeed = player.car ? Math.abs(player.car.speed) : (player.moving ? (input.sprint() ? 11 : 6.5) : 0);
  const policeResult = police.update(dt, world.playerPos(), playerSpeed, !!player.car, city, onCrash);
  if (policeResult === 'busted') {
    endRun('busted');
    return;
  }
  // Enemy fire.
  const dmg = combat.updateEnemies(dt, world.playerPos(), (enemy) => {
    const p = enemy.mesh.position;
    effects.muzzleFlash(p.x, 1.4, p.z);
    audio.gunshot();
  });
  if (dmg > 0 && damagePlayer(player, dmg)) {
    endRun('wasted');
    return;
  }
  if (player.health <= 0) {
    endRun('wasted');
    return;
  }
  missions.update(dt);
  effects.update(dt);
  save.update(dt);
  audio.engine(player.car ? Math.abs(player.car.speed) / player.car.spec.topSpeed : 0, !!player.car);
  audio.siren(police.wanted > 0 && police.anyCopNear(world.playerPos()), dt);
}

// --- Frame: step the world, move the camera and sun, paint the HUD ---
function renderFrame(dt) {
  const target = player.car ? player.car.mesh.position : player.mesh.position;
  const speed01 = player.car ? Math.abs(player.car.speed) / player.car.spec.topSpeed : 0;
  camera.update(dt, target, !!player.car, speed01, city);
  // The sun's shadow camera follows the player.
  sun.position.set(target.x + 90, 140, target.z + 60);
  sun.target.position.set(target.x, 0, target.z);
  sun.target.updateMatrixWorld();
  renderer.render(scene, camera3);
  // HUD + minimap
  const obj = missions.objectivePosition();
  const next = missions.active ? null : missions.nextMission();
  hud.update({
    health: player.health,
    cash: player.cash,
    wanted: police.wanted,
    elapsed,
    driving: !!player.car,
    speedKmh: player.car ? Math.abs(player.car.speed) * 3.6 : 0,
    objective: missions.objectiveText(),
    ammo: player.ammo,
    reserve: player.reserve,
    reloading: player.reloading > 0,
    aiming: player.aiming,
    bustProgress: police.bustProgress / 1.6,
    dt,
  });
  minimap.draw({
    player: { x: target.x, z: target.z, heading: player.car ? player.car.heading : player.heading },
    objective: obj,
    nextStart: next ? next.start : null,
    cops: [...police.copCars.map((c) => c.mesh.position), ...police.footCops.map((c) => c.mesh.position)],
  });
  // Context prompt: enter the nearest car.
  if (screen === 'play' && !player.car) {
    const car = nearestCar(ENTER_RANGE);
    if (car) hud.showPrompt(`Press <kbd>E</kbd> to ${car.driver === 'parked' || car.driver === 'traffic' ? 'steal' : 'enter'} the ${car.spec.name}`);
    else hud.hidePrompt();
  } else {
    hud.hidePrompt();
  }
}

function runShot(name) {
  document.getElementById('hud').style.display = 'block';
  hud.showScreen('play');
  screen = 'play';
  stageShot(name, world, { camera, renderer, camera3, stepWorld, renderFrame, input, scene });
  // The staging steps move the player without rendering, so the smoothed
  // camera lags behind: snap it to the final spot. The big dt on the paint
  // frames settles the camera and lets the mission banner expire, so the
  // frame shows the world, not the overlay.
  camera.snapTo(world.playerPos());
  let painted = 0;
  function paint() {
    renderFrame(1.2);
    painted += 1;
    if (painted < 3) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  let accumulator = 0;
  let last = performance.now();
  hud.renderMissionList(MISSIONS, player.missionsDone, save.hasSave());

  document.getElementById('play-btn').addEventListener('click', () => {
    audio.unlock();
    audio.click();
    hud.showScreen('play');
    document.getElementById('hud').style.display = 'block';
    screen = 'play';
    camera.snapTo(player.mesh.position);
    try { renderer.domElement.requestPointerLock(); } catch { /* drag-look fallback */ }
  });
  document.getElementById('continue-btn').addEventListener('click', () => {
    audio.unlock();
    save.loadGame();
    hud.renderMissionList(MISSIONS, player.missionsDone, save.hasSave());
    hud.showScreen('play');
    document.getElementById('hud').style.display = 'block';
    screen = 'play';
    camera.snapTo(player.mesh.position);
    healPlayer(player, 0);
  });
  document.getElementById('resume-btn').addEventListener('click', () => {
    audio.click();
    hud.showScreen('play');
    screen = 'play';
    try { renderer.domElement.requestPointerLock(); } catch { /* ignore */ }
  });
  document.getElementById('restart-btn').addEventListener('click', () => {
    save.clearSave();
    window.location.reload();
  });
  document.getElementById('respawn-btn').addEventListener('click', () => {
    audio.click();
    respawn();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === 'play') {
      screen = 'paused';
      hud.showScreen('pause');
    }
  });
  window.addEventListener('resize', () => {
    camera3.aspect = window.innerWidth / window.innerHeight;
    camera3.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    if (screen === 'title') {
      // Attract mode: the city lives behind the title, camera orbiting the plaza.
      titleAngle += dt * 0.08;
      const cx = Math.sin(titleAngle) * 42;
      const cz = Math.cos(titleAngle) * 42;
      camera3.position.set(cx, 26, cz);
      camera3.lookAt(0, 2, 0);
      traffic.update(dt, null, allCars(), onCrash);
      pedestrians.update(dt, { x: 0, z: 0 });
      effects.update(dt);
      renderer.render(scene, camera3);
      return;
    }
    if (screen === 'play') {
      accumulator += dt;
      while (accumulator >= STEP && screen === 'play') {
        stepWorld(STEP);
        accumulator -= STEP;
      }
      if (screen === 'play') renderFrame(dt);
      else if (screen === 'end') renderer.render(scene, camera3);
    } else if (screen === 'paused' || screen === 'end') {
      renderer.render(scene, camera3);
    }
  }
  document.getElementById('hud').style.display = 'none';
  camera.snapTo(player.mesh.position);
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();

// Exposed for the play-test harness (not part of the game): the world state.
window.__solmar = { player, police, missions, traffic, pedestrians, combat, get screen() { return screen; } };
