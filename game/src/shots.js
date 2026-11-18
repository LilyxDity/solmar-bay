// The screenshot scenes behind ?shot=drive|chase|street|mission. Each one sets
// up a real game state (a car, a wanted level, a mission, traffic and peds),
// then plays the real rules forward for a fixed number of steps with scripted
// input, so the frame is what a short game really looks like and the same seed
// always gives the same frame. First by name is the cover (1-drive).
import { STEP } from './config.js';
import { createCar } from './vehicles.js';

// Drive the player car forward for `seconds` at full throttle.
function driveForward(ctx, seconds) {
  const input = ctx.input;
  input.press('KeyW');
  for (let i = 0; i < seconds / STEP; i += 1) ctx.stepWorld(STEP);
  input.unpress('KeyW');
}

// Let the world idle (traffic and peds move) for `seconds`.
function idle(ctx, seconds) {
  for (let i = 0; i < seconds / STEP; i += 1) ctx.stepWorld(STEP);
}

function putPlayerInCar(ctx, type, x, z, heading, color) {
  const car = createCar(ctx.scene, type, x, z, heading, color);
  car.driver = 'player';
  car.speed = 0;
  ctx.player.car = car;
  ctx.player.mesh.visible = false;
  ctx.player.mesh.position.set(x, 0, z);
  return car;
}

function resetPlayer(ctx, x, z, heading) {
  const p = ctx.player;
  if (p.car) {
    p.car.driver = null;
    p.car = null;
  }
  p.mesh.visible = true;
  p.mesh.position.set(x, 0, z);
  p.heading = heading;
  p.health = 100;
  p.ammo = 12;
  p.reserve = 60;
  p.cash = 1250;
  ctx.police.clearWanted();
  ctx.combat.clearEnemies();
}

// 1-drive (cover): driving a red Comet GT through downtown, traffic and peds
// around, HUD + minimap + mission objective on screen.
function stageDrive(ctx) {
  resetPlayer(ctx, 0, 0, Math.PI);
  const car = putPlayerInCar(ctx, 'sports', 3.5, 70, Math.PI, 0xd8232a);
  car.speed = 24;
  // Traffic ahead on the same road and peds on the sidewalks, so the street
  // reads as alive in the frame.
  for (const z of [30, -5, -40]) {
    const t = createCar(ctx.scene, 'sedan', 3.5, z, Math.PI, 0x8a97a3);
    t.driver = 'traffic';
    t.speed = 10;
    t.ai = { axis: 'z', dir: -1, line: 0, cruise: 10, wait: 0, turnAt: null };
    ctx.traffic.cars.push(t);
  }
  for (let i = 0; i < 6; i += 1) {
    ctx.pedestrians.spawnPed(9.2, 15 - i * 12);
    ctx.pedestrians.spawnPed(-9.2, 8 - i * 12);
  }
  // Mission 1 in progress: drive the Comet GT to the garage.
  ctx.missions.startMission(ctx.missions.MISSIONS[0]);
  ctx.missions.active.stepIndex = 1; // past the "get in" step
  ctx.camera.setYaw(Math.PI);
  ctx.camera.setPitch(0.32);
  ctx.camera.snapTo(car.mesh.position);
  driveForward(ctx, 1.6);
}

// 2-chase: a 3-star police chase — cop cars behind, sirens flashing, the
// "lose the cops" objective on the HUD.
function stageChase(ctx) {
  resetPlayer(ctx, 0, 0, Math.PI);
  const car = putPlayerInCar(ctx, 'sports', 3.5, 50, Math.PI, 0xf5c518);
  car.speed = 30;
  // Mission 2 at its "lose the cops" step.
  ctx.missions.startMission(ctx.missions.MISSIONS[1]);
  ctx.missions.active.stepIndex = 2;
  ctx.police.setWanted(3);
  // Three cop cars in pursuit, close behind.
  for (let i = 0; i < 3; i += 1) {
    const cop = createCar(ctx.scene, 'police', 3.5 + (i - 1) * 4, 58 + i * 7, Math.PI);
    cop.driver = 'police';
    cop.speed = 28;
    ctx.police.copCars.push(cop);
  }
  // The camera sits ahead of the car looking back, so the pursuing cop cars
  // are in the frame behind it (a chase cam behind the car would hide them).
  ctx.camera.setYaw(0);
  ctx.camera.setPitch(0.3);
  ctx.camera.snapTo(car.mesh.position);
  driveForward(ctx, 2.2);
}

// 3-street: on foot at a busy intersection near the plaza, pedestrians and
// traffic passing, the green mission marker ahead.
function stageStreet(ctx) {
  resetPlayer(ctx, 6, -8, Math.PI);
  // A crowd around the player.
  for (let i = 0; i < 10; i += 1) {
    ctx.pedestrians.spawnPed(6 + (i % 5) * 6 - 12, -8 + Math.floor(i / 5) * 14 - 7);
  }
  ctx.camera.setYaw(Math.PI);
  ctx.camera.setPitch(0.18);
  ctx.camera.snapTo(ctx.player.mesh.position);
  idle(ctx, 1.2);
}

// 4-mission: the Bayfront Heat shootout — the player aiming at rival gang
// members in the open dock yard, objective and kill count on the HUD. The
// player stands east of the yard facing west, so the camera behind them has
// open ground (not the warehouse wall) and the crew is in the open.
function stageMission(ctx) {
  resetPlayer(ctx, -155, 172, -1.47);
  ctx.player.aiming = true;
  ctx.player.aimYaw = -1.47;
  ctx.missions.startMission(ctx.missions.MISSIONS[4]);
  // Jump to the kill step and spawn the crew across the open yard.
  ctx.missions.active.stepIndex = 1;
  const step = ctx.missions.currentStep();
  for (let i = 0; i < step.count; i += 1) {
    ctx.combat.spawnEnemy(step.spawnAt.x + (i - 2) * 7, step.spawnAt.z + (i % 2 === 0 ? 5 : -5));
  }
  // One enemy already down, one mid-fire: the fight reads at a glance.
  const enemies = ctx.combat.enemies;
  if (enemies[0]) {
    enemies[0].state = 'dead';
    enemies[0].mesh.rotation.x = -Math.PI / 2;
    enemies[0].mesh.position.y = 0.3;
    ctx.missions.active.kills = 1;
  }
  ctx.player.cash = 2400;
  ctx.camera.setYaw(-1.47);
  ctx.camera.setPitch(0.3);
  ctx.camera.snapTo(ctx.player.mesh.position);
  // Freeze a muzzle flash for the frame.
  const p = ctx.player.mesh.position;
  ctx.effects.muzzleFlash(p.x + Math.sin(ctx.player.aimYaw) * 1.2, 1.45, p.z + Math.cos(ctx.player.aimYaw) * 1.2);
  ctx.effects.setHoldFlash(true);
  idle(ctx, 0.4);
  // stepWorld clears aiming without pointer lock; re-assert it so the
  // crosshair shows in the frame.
  ctx.player.aiming = true;
}

export function stageShot(name, world, hooks) {
  const ctx = {
    ...world,
    ...hooks,
    input: hooks.input,
    scene: hooks.scene,
  };
  if (name === 'chase') stageChase(ctx);
  else if (name === 'street') stageStreet(ctx);
  else if (name === 'mission') stageMission(ctx);
  else stageDrive(ctx);
}
