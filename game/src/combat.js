// Combat: the player's pistol (raycast from the camera through the crosshair),
// the punch, and rival gang members who shoot back during missions. Hits on
// pedestrians are crimes — the caller reports them to the wanted system.
import * as THREE from 'three';

const PISTOL_DAMAGE = 34;
const PISTOL_RANGE = 120;
const PUNCH_DAMAGE = 25;
const PUNCH_RANGE = 2.6;

export function createCombat(scene) {
  const enemies = [];
  const raycaster = new THREE.Raycaster();
  const center = new THREE.Vector2(0, 0);

  function createEnemyMesh() {
    const group = new THREE.Group();
    const shirt = new THREE.MeshLambertMaterial({ color: 0x8a2a2a });
    const pants = new THREE.MeshLambertMaterial({ color: 0x1c1c22 });
    const skin = new THREE.MeshLambertMaterial({ color: 0xc88a5a });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.75, 0.32), shirt);
    torso.position.y = 1.08;
    torso.castShadow = true;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.38, 0.34), skin);
    head.position.y = 1.68;
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.72, 0.24), pants);
    legL.position.set(-0.15, 0.36, 0);
    const legR = legL.clone();
    legR.position.x = 0.15;
    // A visible gun in the right hand.
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.4), new THREE.MeshLambertMaterial({ color: 0x222222 }));
    gun.position.set(0.36, 1.1, 0.2);
    group.add(torso, head, legL, legR, gun);
    return group;
  }

  function spawnEnemy(x, z) {
    const mesh = createEnemyMesh();
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    const enemy = { mesh, health: 100, shootTimer: 1 + Math.random() * 2, state: 'alive' };
    enemies.push(enemy);
    return enemy;
  }

  function clearEnemies() {
    for (const e of enemies) scene.remove(e.mesh);
    enemies.length = 0;
  }

  // Fire the pistol. Returns {hit: 'ped'|'enemy'|'car'|'world'|null, target, point}.
  // Targets are tested as spheres (peds/enemies) and boxes (cars) — cheap and
  // good enough for an arcade shooter.
  function fire(camera, peds, cars, playerPos) {
    raycaster.setFromCamera(center, camera);
    const origin = raycaster.ray.origin;
    const dir = raycaster.ray.direction;
    let best = null;
    let bestDist = PISTOL_RANGE;
    function testSphere(cx, cy, cz, radius, kind, target) {
      const ox = cx - origin.x;
      const oy = cy - origin.y;
      const oz = cz - origin.z;
      const t = ox * dir.x + oy * dir.y + oz * dir.z;
      if (t < 0 || t > bestDist) return;
      const px = origin.x + dir.x * t;
      const py = origin.y + dir.y * t;
      const pz = origin.z + dir.z * t;
      const d2 = (px - cx) ** 2 + (py - cy) ** 2 + (pz - cz) ** 2;
      if (d2 < radius * radius) {
        bestDist = t;
        best = { hit: kind, target, point: new THREE.Vector3(px, py, pz) };
      }
    }
    for (const ped of peds) {
      if (ped.state === 'down') continue;
      const p = ped.mesh.position;
      testSphere(p.x, p.y + 1.1, p.z, 0.9, 'ped', ped);
    }
    for (const e of enemies) {
      if (e.state !== 'alive') continue;
      const p = e.mesh.position;
      testSphere(p.x, p.y + 1.1, p.z, 0.9, 'enemy', e);
    }
    for (const car of cars) {
      const p = car.mesh.position;
      // Approximate the car as a sphere at its centre.
      testSphere(p.x, p.y + 0.8, p.z, Math.max(car.spec.length, car.spec.width) * 0.55, 'car', car);
    }
    if (best) {
      if (best.hit === 'ped') {
        best.target.health -= PISTOL_DAMAGE;
        if (best.target.health <= 0) {
          best.target.state = 'down';
          best.target.mesh.rotation.x = -Math.PI / 2;
          best.target.mesh.position.y = 0.3;
        }
      } else if (best.hit === 'enemy') {
        best.target.health -= PISTOL_DAMAGE;
        if (best.target.health <= 0) {
          best.target.state = 'dead';
          best.target.mesh.rotation.x = -Math.PI / 2;
          best.target.mesh.position.y = 0.3;
        }
      } else if (best.hit === 'car') {
        best.target.health = Math.max(0, best.target.health - PISTOL_DAMAGE * 0.4);
      }
      return best;
    }
    // No hit: the bullet lands on the ground far ahead.
    const t = PISTOL_RANGE;
    return { hit: null, target: null, point: new THREE.Vector3(origin.x + dir.x * t, Math.max(0.1, origin.y + dir.y * t), origin.z + dir.z * t) };
  }

  // Punch: hits the nearest ped/enemy in front within range.
  function punch(playerPos, heading, peds) {
    const fx = Math.sin(heading);
    const fz = Math.cos(heading);
    let best = null;
    let bestD = PUNCH_RANGE;
    for (const ped of peds) {
      if (ped.state === 'down') continue;
      const dx = ped.mesh.position.x - playerPos.x;
      const dz = ped.mesh.position.z - playerPos.z;
      const d = Math.hypot(dx, dz);
      const facing = (dx * fx + dz * fz) / (d || 1);
      if (d < bestD && facing > 0.5) {
        best = ped;
        bestD = d;
      }
    }
    for (const e of enemies) {
      if (e.state !== 'alive') continue;
      const dx = e.mesh.position.x - playerPos.x;
      const dz = e.mesh.position.z - playerPos.z;
      const d = Math.hypot(dx, dz);
      const facing = (dx * fx + dz * fz) / (d || 1);
      if (d < bestD && facing > 0.5) {
        best = e;
        bestD = d;
      }
    }
    if (!best) return null;
    if (best.state !== undefined && best.mesh) {
      // Enemy (has state 'alive'/'dead')
      if (enemies.includes(best)) {
        best.health -= PUNCH_DAMAGE;
        if (best.health <= 0) {
          best.state = 'dead';
          best.mesh.rotation.x = -Math.PI / 2;
          best.mesh.position.y = 0.3;
        }
        return { hit: 'enemy', target: best };
      }
    }
    best.health -= PUNCH_DAMAGE;
    if (best.health <= 0) {
      best.state = 'down';
      best.mesh.rotation.x = -Math.PI / 2;
      best.mesh.position.y = 0.3;
    }
    return { hit: 'ped', target: best };
  }

  // Enemies strafe toward the player and shoot with poor aim. Returns the
  // damage dealt to the player this frame (0 when nobody lands a shot).
  function updateEnemies(dt, playerPos, onEnemyShot) {
    let damage = 0;
    for (const e of enemies) {
      if (e.state !== 'alive') continue;
      const p = e.mesh.position;
      const dx = playerPos.x - p.x;
      const dz = playerPos.z - p.z;
      const d = Math.hypot(dx, dz) || 1;
      // Face the player, close in until 12 m, then hold and shoot.
      e.mesh.rotation.y = Math.atan2(dx / d, dz / d);
      if (d > 12) {
        p.x += (dx / d) * 4 * dt;
        p.z += (dz / d) * 4 * dt;
      }
      e.shootTimer -= dt;
      if (e.shootTimer <= 0 && d < 45) {
        e.shootTimer = 1.1 + Math.random() * 1.2;
        if (onEnemyShot) onEnemyShot(e);
        // Poor aim: hits only sometimes, worse at range.
        if (Math.random() < Math.max(0.1, 0.45 - d * 0.008)) damage += 9;
      }
    }
    return damage;
  }

  return { enemies, spawnEnemy, clearEnemies, fire, punch, updateEnemies };
}
