// Pedestrians: low-poly people who stroll the sidewalks, cross at corners,
// and flee screaming from gunshots, crashes and speeding cars. A fleeing ped
// runs away from the scare and calms down after a few seconds.
import * as THREE from 'three';
import { CITY_HALF, ROAD_LINES, ROAD_WIDTH } from './config.js';

const SHIRTS = [0xd85a5a, 0x5a8ad8, 0x5ad88a, 0xd8c85a, 0xb05ad8, 0x5ad8d0, 0xe8e8e8, 0x3a3f44];
const PANTS = [0x2a3a5a, 0x3a3a3a, 0x5a4a3a, 0x2a4a2a];
const SKINS = [0xe8b88a, 0xc88a5a, 0x8a5a3a, 0xf0c8a0];

function createPedMesh(random) {
  const group = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: random.pick(SHIRTS) });
  const pants = new THREE.MeshLambertMaterial({ color: random.pick(PANTS) });
  const skin = new THREE.MeshLambertMaterial({ color: random.pick(SKINS) });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.28), shirt);
  torso.position.y = 1.05;
  torso.castShadow = true;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.36, 0.32), skin);
  head.position.y = 1.62;
  head.castShadow = true;
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.22), pants);
  legL.position.set(-0.14, 0.35, 0);
  const legR = legL.clone();
  legR.position.x = 0.14;
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.6, 0.16), shirt);
  armL.position.set(-0.34, 1.05, 0);
  const armR = armL.clone();
  armR.position.x = 0.34;
  group.add(torso, head, legL, legR, armL, armR);
  group.userData.limbs = { legL, legR, armL, armR };
  return group;
}

export function createPedestrians(scene, city, random) {
  const peds = [];
  const SIDE = ROAD_WIDTH / 2 + 2.2; // sidewalk offset from a road centre

  function spawnPed(nearX, nearZ) {
    const mesh = createPedMesh(random);
    let x;
    let z;
    let axis;
    let dir;
    if (nearX !== undefined) {
      const road = city.nearestRoad(nearX, nearZ);
      axis = road.axis === 'x' ? 'z' : 'x';
      dir = random.pick([-1, 1]);
      if (axis === 'z') {
        x = road.line + SIDE * random.pick([-1, 1]);
        z = nearZ + random.range(-25, 25);
      } else {
        x = nearX + random.range(-25, 25);
        z = road.line + SIDE * random.pick([-1, 1]);
      }
    } else {
      const line = random.pick(ROAD_LINES);
      axis = random.chance(0.5) ? 'z' : 'x';
      dir = random.pick([-1, 1]);
      const t = random.range(-CITY_HALF + 20, CITY_HALF - 20);
      const off = SIDE * random.pick([-1, 1]);
      x = axis === 'z' ? line + off : t;
      z = axis === 'z' ? t : line + off;
    }
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    const ped = {
      mesh,
      axis,
      dir,
      line: axis === 'z' ? x : z,
      speed: random.range(1.2, 2.0),
      state: 'walk', // walk | flee | down
      fleeFrom: null,
      fleeTimer: 0,
      walkPhase: random.range(0, Math.PI * 2),
      health: 100,
    };
    mesh.rotation.y = axis === 'z' ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    peds.push(ped);
    return ped;
  }

  function scare(x, z, radius) {
    for (const ped of peds) {
      if (ped.state === 'down') continue;
      const d = Math.hypot(ped.mesh.position.x - x, ped.mesh.position.z - z);
      if (d < radius) {
        ped.state = 'flee';
        ped.fleeFrom = { x, z };
        ped.fleeTimer = 4 + Math.random() * 3;
      }
    }
  }

  function update(dt, playerPos) {
    for (const ped of peds) {
      if (ped.state === 'down') continue;
      const pos = ped.mesh.position;
      let heading = ped.mesh.rotation.y;
      let speed = ped.speed;
      if (ped.state === 'flee') {
        ped.fleeTimer -= dt;
        const dx = pos.x - ped.fleeFrom.x;
        const dz = pos.z - ped.fleeFrom.z;
        const d = Math.hypot(dx, dz) || 1;
        const targetHeading = Math.atan2(dx / d, dz / d);
        let diff = targetHeading - heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        heading += Math.max(-4 * dt, Math.min(4 * dt, diff));
        speed = 6.5;
        if (ped.fleeTimer <= 0) {
          ped.state = 'walk';
          // Resume walking along the nearest sidewalk.
          const road = city.nearestRoad(pos.x, pos.z);
          ped.axis = road.axis === 'x' ? 'z' : 'x';
          ped.dir = random.pick([-1, 1]);
        }
      } else {
        // Stroll along the sidewalk; turn around at the city edge or at random corners.
        const coord = ped.axis === 'z' ? pos.z : pos.x;
        if (Math.abs(coord) > CITY_HALF - 10) ped.dir *= -1;
        else if (random.chance(dt * 0.03)) ped.dir *= -1;
        heading = ped.axis === 'z' ? (ped.dir > 0 ? 0 : Math.PI) : (ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
      }
      ped.mesh.rotation.y = heading;
      const nx = pos.x + Math.sin(heading) * speed * dt;
      const nz = pos.z + Math.cos(heading) * speed * dt;
      const resolved = city.collideCircle(nx, nz, 0.5);
      const clamped = city.clampToCity(resolved.x, resolved.z, 0.5);
      pos.x = clamped.x;
      pos.z = clamped.z;
      // Walk-cycle swing.
      ped.walkPhase += dt * speed * 2.2;
      const swing = Math.sin(ped.walkPhase) * 0.5;
      const limbs = ped.mesh.userData.limbs;
      limbs.legL.rotation.x = swing;
      limbs.legR.rotation.x = -swing;
      limbs.armL.rotation.x = -swing * 0.8;
      limbs.armR.rotation.x = swing * 0.8;
      // Keep the crowd near the player: recycle distant peds.
      if (playerPos) {
        const d = Math.hypot(pos.x - playerPos.x, pos.z - playerPos.z);
        if (d > 240 && ped.state === 'walk') {
          const line = random.pick(ROAD_LINES);
          const axis = random.chance(0.5) ? 'z' : 'x';
          const off = SIDE * random.pick([-1, 1]);
          const t = playerPos[axis === 'z' ? 'z' : 'x'] + random.range(-90, 90);
          pos.x = axis === 'z' ? line + off : t;
          pos.z = axis === 'z' ? t : line + off;
          ped.axis = axis;
          ped.dir = random.pick([-1, 1]);
        }
      }
    }
  }

  return { peds, spawnPed, scare, update };
}
