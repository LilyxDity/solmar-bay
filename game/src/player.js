// The player on foot: a low-poly character that runs, sprints and jumps with
// camera-relative controls, and keeps the health, cash and car state the rest
// of the game reads. Driving lives in vehicles.js; this file is feet only.
import * as THREE from 'three';
import { GRAVITY, PLAYER_JUMP, PLAYER_MAX_HEALTH, PLAYER_RADIUS, PLAYER_SPRINT, PLAYER_WALK } from './config.js';

export function createPlayerMesh() {
  const group = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0x2e8a6a });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2a3a5a });
  const skin = new THREE.MeshLambertMaterial({ color: 0xe8b88a });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.75, 0.32), jacket);
  torso.position.y = 1.08;
  torso.castShadow = true;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.38, 0.34), skin);
  head.position.y = 1.68;
  head.castShadow = true;
  // Cap, so the player reads at a glance in screenshots.
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.38), new THREE.MeshLambertMaterial({ color: 0xd8232a }));
  cap.position.y = 1.92;
  const brim = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 0.22), cap.material);
  brim.position.set(0, 1.88, 0.26);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.72, 0.24), pants);
  legL.position.set(-0.15, 0.36, 0);
  const legR = legL.clone();
  legR.position.x = 0.15;
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.62, 0.18), jacket);
  armL.position.set(-0.37, 1.08, 0);
  const armR = armL.clone();
  armR.position.x = 0.37;
  group.add(torso, head, cap, brim, legL, legR, armL, armR);
  group.userData.limbs = { legL, legR, armL, armR };
  return group;
}

export function createPlayer(scene, x, z) {
  const mesh = createPlayerMesh();
  mesh.position.set(x, 0, z);
  scene.add(mesh);
  return {
    mesh,
    health: PLAYER_MAX_HEALTH,
    cash: 250,
    heading: 0, // facing, radians
    vy: 0, // vertical velocity for jumps
    grounded: true,
    walkPhase: 0,
    moving: false,
    car: null, // the car being driven, or null on foot
    ammo: 12,
    reserve: 60,
    reloading: 0,
    garageCars: 0,
    missionsDone: [],
    aimYaw: 0, // camera yaw the player faces while aiming
    aiming: false,
  };
}

// One on-foot step. axes are camera-relative: z = forward, x = strafe right.
// cameraYaw is the camera's yaw; the player turns toward the move direction.
export function stepPlayer(player, dt, axes, sprinting, jumping, cameraYaw, city) {
  const speed = sprinting ? PLAYER_SPRINT : PLAYER_WALK;
  const sin = Math.sin(cameraYaw);
  const cos = Math.cos(cameraYaw);
  // The camera looks along (sin yaw, cos yaw); W moves that way, D strafes right of it.
  const fwdX = sin;
  const fwdZ = cos;
  const rightX = -cos;
  const rightZ = sin;
  let mx = fwdX * axes.z + rightX * axes.x;
  let mz = fwdZ * axes.z + rightZ * axes.x;
  const len = Math.hypot(mx, mz);
  player.moving = len > 0.1;
  if (player.moving) {
    mx /= len;
    mz /= len;
    const targetHeading = Math.atan2(mx, mz);
    let diff = targetHeading - player.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    player.heading += Math.max(-10 * dt, Math.min(10 * dt, diff));
    const pos = player.mesh.position;
    const nx = pos.x + mx * speed * dt;
    const nz = pos.z + mz * speed * dt;
    const resolved = city.collideCircle(nx, nz, PLAYER_RADIUS);
    const clamped = city.clampToCity(resolved.x, resolved.z, PLAYER_RADIUS);
    pos.x = clamped.x;
    pos.z = clamped.z;
    player.walkPhase += dt * speed * 1.6;
  }
  // Jump and gravity
  if (jumping && player.grounded) {
    player.vy = PLAYER_JUMP;
    player.grounded = false;
  }
  if (!player.grounded) {
    player.vy -= GRAVITY * dt;
    player.mesh.position.y += player.vy * dt;
    if (player.mesh.position.y <= 0) {
      player.mesh.position.y = 0;
      player.vy = 0;
      player.grounded = true;
    }
  }
  player.mesh.rotation.y = player.aiming ? player.aimYaw : player.heading;
  // Walk cycle
  const swing = player.moving ? Math.sin(player.walkPhase) * 0.55 : 0;
  const limbs = player.mesh.userData.limbs;
  limbs.legL.rotation.x = swing;
  limbs.legR.rotation.x = -swing;
  limbs.armL.rotation.x = player.aiming ? -1.2 : -swing * 0.8;
  limbs.armR.rotation.x = player.aiming ? -1.2 : swing * 0.8;
  // Reload timer
  if (player.reloading > 0) {
    player.reloading -= dt;
    if (player.reloading <= 0) {
      const need = 12 - player.ammo;
      const take = Math.min(need, player.reserve);
      player.ammo += take;
      player.reserve -= take;
    }
  }
}

export function damagePlayer(player, amount) {
  player.health = Math.max(0, player.health - amount);
  return player.health <= 0;
}

export function healPlayer(player, amount) {
  player.health = Math.min(PLAYER_MAX_HEALTH, player.health + amount);
}
