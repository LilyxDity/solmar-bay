// The wanted system: stars 0–5, police cars that chase and ram, foot officers
// who run the player down and bust them, and the heat that cools when the
// player breaks line of sight. Busted or wasted ends the run and respawns.
import * as THREE from 'three';
import { BUSTED_FINE, WANTED_DECAY_SECONDS, WANTED_MAX, WASTED_FINE } from './config.js';
import { createCar, driveCar, forwardOf } from './vehicles.js';

export function createPolice(scene, city, random) {
  const copCars = [];
  const footCops = [];
  let wanted = 0;
  let unseenTimer = 0;
  let bustProgress = 0;

  function createFootCopMesh() {
    const group = new THREE.Group();
    const uniform = new THREE.MeshLambertMaterial({ color: 0x1c2f4a });
    const skin = new THREE.MeshLambertMaterial({ color: 0xe8b88a });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.75, 0.32), uniform);
    torso.position.y = 1.08;
    torso.castShadow = true;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.38, 0.34), skin);
    head.position.y = 1.68;
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.38), new THREE.MeshLambertMaterial({ color: 0x101418 }));
    cap.position.y = 1.92;
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.72, 0.24), uniform);
    legL.position.set(-0.15, 0.36, 0);
    const legR = legL.clone();
    legR.position.x = 0.15;
    group.add(torso, head, cap, legL, legR);
    group.userData.limbs = { legL, legR };
    return group;
  }

  function spawnCopCar(nearX, nearZ) {
    const p = city.randomRoadPoint();
    // Spawn on a road near the player but not on top of them.
    let x = p.x;
    let z = p.z;
    let tries = 0;
    while (Math.hypot(x - nearX, z - nearZ) < 35 && tries < 12) {
      const q = city.randomRoadPoint();
      x = q.x;
      z = q.z;
      tries += 1;
    }
    const car = createCar(scene, 'police', x, z, random.range(0, Math.PI * 2));
    car.driver = 'police';
    car.speed = 10;
    copCars.push(car);
    return car;
  }

  function spawnFootCop(nearX, nearZ) {
    const mesh = createFootCopMesh();
    const angle = random.range(0, Math.PI * 2);
    const dist = random.range(12, 25);
    mesh.position.set(nearX + Math.sin(angle) * dist, 0, nearZ + Math.cos(angle) * dist);
    scene.add(mesh);
    const cop = { mesh, walkPhase: 0, speed: 7.5 };
    footCops.push(cop);
    return cop;
  }

  function removeAllCops() {
    for (const c of copCars) scene.remove(c.mesh);
    copCars.length = 0;
    for (const c of footCops) scene.remove(c.mesh);
    footCops.length = 0;
  }

  function addWanted(stars) {
    wanted = Math.min(WANTED_MAX, wanted + stars);
    unseenTimer = 0;
    return wanted;
  }

  function setWanted(stars) {
    wanted = Math.max(0, Math.min(WANTED_MAX, stars));
    unseenTimer = 0;
    return wanted;
  }

  function clearWanted() {
    wanted = 0;
    unseenTimer = 0;
    bustProgress = 0;
    removeAllCops();
  }

  // Is any cop close enough to see the player? (Buildings don't block sight
  // here — a generous approximation that keeps chases tense.)
  function anyCopNear(playerPos) {
    for (const c of copCars) {
      if (Math.hypot(c.mesh.position.x - playerPos.x, c.mesh.position.z - playerPos.z) < 70) return true;
    }
    for (const c of footCops) {
      if (Math.hypot(c.mesh.position.x - playerPos.x, c.mesh.position.z - playerPos.z) < 45) return true;
    }
    return false;
  }

  // One step. Returns 'busted' when the bust completes, else null.
  // playerPos is the player's position (in or out of a car); playerSpeed is
  // how fast they're moving (a fast player can't be busted).
  function update(dt, playerPos, playerSpeed, inCar, city, onCrash) {
    // Match the force to the wanted level.
    const wantCars = wanted === 0 ? 0 : Math.min(1 + Math.floor((wanted - 1) / 2), 3);
    const wantFoot = wanted === 0 ? 0 : Math.min(wanted, 4);
    while (copCars.length < wantCars) spawnCopCar(playerPos.x, playerPos.z);
    while (footCops.length < wantFoot) spawnFootCop(playerPos.x, playerPos.z);
    while (copCars.length > wantCars) {
      const c = copCars.pop();
      scene.remove(c.mesh);
    }
    while (footCops.length > wantFoot) {
      const c = footCops.pop();
      scene.remove(c.mesh);
    }

    // Wanted decays when no cop can see the player.
    if (wanted > 0) {
      if (anyCopNear(playerPos)) unseenTimer = 0;
      else {
        unseenTimer += dt;
        if (unseenTimer >= WANTED_DECAY_SECONDS) {
          wanted -= 1;
          unseenTimer = 0;
        }
      }
    }

    // Cop cars: chase the player and ram.
    for (const car of copCars) {
      const p = car.mesh.position;
      const dx = playerPos.x - p.x;
      const dz = playerPos.z - p.z;
      const dist = Math.hypot(dx, dz) || 1;
      const targetHeading = Math.atan2(dx / dist, dz / dist);
      let diff = targetHeading - car.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const steer = Math.max(-1, Math.min(1, diff * 2.5));
      // Ram: full throttle, brake only when very close and slow.
      const throttle = dist > 6 || car.speed < 4 ? 1 : 0.2;
      driveCar(car, dt, throttle, steer, false, city, onCrash);
      // A cop that gets hopelessly stuck respawns near the player.
      if (dist > 200) {
        const q = city.randomRoadPoint();
        car.mesh.position.set(q.x, 0, q.z);
        car.speed = 15;
      }
    }

    // Foot cops: run at the player; touching a slow player busts them.
    let busted = false;
    for (const cop of footCops) {
      const p = cop.mesh.position;
      const dx = playerPos.x - p.x;
      const dz = playerPos.z - p.z;
      const d = Math.hypot(dx, dz) || 1;
      cop.mesh.rotation.y = Math.atan2(dx / d, dz / d);
      if (d > 1.6) {
        const nx = p.x + (dx / d) * cop.speed * dt;
        const nz = p.z + (dz / d) * cop.speed * dt;
        const resolved = city.collideCircle(nx, nz, 0.6);
        p.x = resolved.x;
        p.z = resolved.z;
        cop.walkPhase += dt * 9;
        const swing = Math.sin(cop.walkPhase) * 0.6;
        cop.mesh.userData.limbs.legL.rotation.x = swing;
        cop.mesh.userData.limbs.legR.rotation.x = -swing;
      }
      if (d < 2.2 && !inCar && playerSpeed < 3) {
        bustProgress += dt;
        if (bustProgress >= 1.6) busted = true;
      }
    }
    if (!footCops.some((c) => Math.hypot(c.mesh.position.x - playerPos.x, c.mesh.position.z - playerPos.z) < 2.2)) {
      bustProgress = Math.max(0, bustProgress - dt * 2);
    }
    return busted ? 'busted' : null;
  }

  return {
    get wanted() { return wanted; },
    get bustProgress() { return bustProgress; },
    copCars,
    footCops,
    addWanted,
    setWanted,
    clearWanted,
    anyCopNear,
    update,
    fines: { busted: BUSTED_FINE, wasted: WASTED_FINE },
  };
}
