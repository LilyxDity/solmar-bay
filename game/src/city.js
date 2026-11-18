// Solmar Bay itself: a procedural grid city — roads, blocks of varied buildings,
// sidewalks, palms, streetlights, a beach and boardwalk, the docks — plus the
// collision list every mover queries. Built once from a seeded random, so the
// same seed always builds the same city.
import * as THREE from 'three';
import { BEACH_Z, BLOCK, CITY_HALF, DOWNTOWN_R, PALETTE, ROAD_LINES, ROAD_WIDTH, WATER_Z } from './config.js';

const HALF_ROAD = ROAD_WIDTH / 2;

// A canvas texture of lit windows, repeated up a building's sides.
function makeWindowTexture(random, litRatio) {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  // A light wall colour: the material colour multiplies this, so a dark base
  // would turn every building into a black monolith.
  ctx.fillStyle = '#b8c4cc';
  ctx.fillRect(0, 0, 64, 128);
  for (let y = 6; y < 120; y += 14) {
    for (let x = 6; x < 58; x += 12) {
      const lit = random.next() < litRatio;
      ctx.fillStyle = lit ? '#ffd98a' : '#4a6a8a';
      ctx.fillRect(x, y, 8, 9);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeFacadeMaterial(color, windowTex, repeatX, repeatY) {
  const tex = windowTex.clone();
  tex.needsUpdate = true;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  const side = new THREE.MeshLambertMaterial({ color, map: tex });
  const top = new THREE.MeshLambertMaterial({ color: 0x8a8072 });
  // Box face order: +x, -x, +y, -y, +z, -z — sides windowed, top and bottom plain.
  return [side, side, top, top, side, side];
}

export function createCity(scene, random) {
  const colliders = []; // {minX, maxX, minZ, maxZ} — buildings and big props
  const group = new THREE.Group();
  scene.add(group);

  const windowTex = makeWindowTexture(random, 0.22);

  // --- Ground: asphalt everywhere, blocks raised on sidewalk slabs ---
  const groundMat = new THREE.MeshLambertMaterial({ color: PALETTE.asphalt });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(CITY_HALF * 2 + 120, CITY_HALF * 2 + 160), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 20);
  ground.receiveShadow = true;
  group.add(ground);

  // Sand and sea along the south edge.
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY_HALF * 2 + 120, WATER_Z - BEACH_Z + 8),
    new THREE.MeshLambertMaterial({ color: PALETTE.sand }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.05, (BEACH_Z + WATER_Z) / 2);
  sand.receiveShadow = true;
  group.add(sand);
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY_HALF * 2 + 200, 140),
    new THREE.MeshPhongMaterial({ color: PALETTE.water, transparent: true, opacity: 0.85, shininess: 120 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0.02, WATER_Z + 70);
  group.add(water);

  // Boardwalk strip between the last road and the sand.
  const boardwalk = new THREE.Mesh(
    new THREE.BoxGeometry(CITY_HALF * 2 + 40, 0.4, 10),
    new THREE.MeshLambertMaterial({ color: 0xa97c50 }),
  );
  boardwalk.position.set(0, 0.2, BEACH_Z - 6);
  boardwalk.receiveShadow = true;
  group.add(boardwalk);

  // --- Lane dashes and crosswalks, instanced (one draw call each) ---
  const dashGeo = new THREE.PlaneGeometry(0.5, 3);
  const dashMat = new THREE.MeshBasicMaterial({ color: PALETTE.laneMark });
  const dashPositions = [];
  for (const line of ROAD_LINES) {
    for (let t = -CITY_HALF; t < CITY_HALF; t += 12) {
      dashPositions.push({ x: line, z: t, rot: 0 });
      dashPositions.push({ x: t, z: line, rot: Math.PI / 2 });
    }
  }
  const dashes = new THREE.InstancedMesh(dashGeo, dashMat, dashPositions.length);
  {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const s = new THREE.Vector3(1, 1, 1);
    dashPositions.forEach((p, i) => {
      e.set(-Math.PI / 2, 0, p.rot);
      q.setFromEuler(e);
      m.compose(new THREE.Vector3(p.x, 0.06, p.z), q, s);
      dashes.setMatrixAt(i, m);
    });
  }
  group.add(dashes);

  // --- Blocks: slabs, buildings, parks ---
  const slabMat = new THREE.MeshLambertMaterial({ color: PALETTE.sidewalk });
  const grassMat = new THREE.MeshLambertMaterial({ color: PALETTE.grass });
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const slabGeo = new THREE.BoxGeometry(BLOCK - ROAD_WIDTH, 0.3, BLOCK - ROAD_WIDTH);
  const blockCenters = [];
  for (let ix = 0; ix < ROAD_LINES.length - 1; ix += 1) {
    for (let iz = 0; iz < ROAD_LINES.length - 1; iz += 1) {
      blockCenters.push({
        x: (ROAD_LINES[ix] + ROAD_LINES[ix + 1]) / 2,
        z: (ROAD_LINES[iz] + ROAD_LINES[iz + 1]) / 2,
      });
    }
  }
  const parkSpots = [];
  for (const b of blockCenters) {
    const distCenter = Math.hypot(b.x, b.z);
    const isDowntown = distCenter < DOWNTOWN_R;
    const isPark = !isDowntown && random.chance(0.16);
    const slab = new THREE.Mesh(slabGeo, isPark ? grassMat : slabMat);
    slab.position.set(b.x, 0.15, b.z);
    slab.receiveShadow = true;
    group.add(slab);
    if (isPark) {
      parkSpots.push(b);
      continue;
    }
    if (isDowntown) {
      // One glass tower per downtown block.
      const w = random.range(18, 26);
      const h = random.range(34, 78);
      const d = random.range(18, 26);
      const color = random.pick(PALETTE.glass);
      const mesh = new THREE.Mesh(boxGeo, makeFacadeMaterial(color, windowTex, Math.max(1, Math.round(w / 6)), Math.max(2, Math.round(h / 7))));
      mesh.scale.set(w, h, d);
      mesh.position.set(b.x, h / 2 + 0.3, b.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      colliders.push({ minX: b.x - w / 2, maxX: b.x + w / 2, minZ: b.z - d / 2, maxZ: b.z + d / 2 });
      // Rooftop box, for a skyline that isn't flat.
      if (random.chance(0.6)) {
        const roof = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0x6a6258 }));
        roof.scale.set(w * 0.35, random.range(2, 5), d * 0.35);
        roof.position.set(b.x + random.range(-3, 3), h + 0.3 + roof.scale.y / 2, b.z + random.range(-3, 3));
        roof.castShadow = true;
        group.add(roof);
      }
    } else if (distCenter < 170) {
      // Mid-rise shops and apartments: two or three per block.
      const count = random.int(2, 3);
      for (let i = 0; i < count; i += 1) {
        const w = random.range(10, 16);
        const h = random.range(7, 18);
        const d = random.range(10, 16);
        const ox = (i - (count - 1) / 2) * 15;
        const oz = random.chance(0.5) ? -9 : 9;
        const color = random.pick(PALETTE.building);
        const mesh = new THREE.Mesh(boxGeo, makeFacadeMaterial(color, windowTex, Math.max(1, Math.round(w / 6)), Math.max(1, Math.round(h / 7))));
        mesh.scale.set(w, h, d);
        mesh.position.set(b.x + ox, h / 2 + 0.3, b.z + oz);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
        colliders.push({ minX: b.x + ox - w / 2, maxX: b.x + ox + w / 2, minZ: b.z + oz - d / 2, maxZ: b.z + oz + d / 2 });
      }
    } else {
      // Outer houses: small, low, pastel.
      const count = random.int(2, 4);
      for (let i = 0; i < count; i += 1) {
        const w = random.range(8, 12);
        const h = random.range(4, 7);
        const d = random.range(8, 12);
        const ox = random.range(-13, 13);
        const oz = random.range(-13, 13);
        const color = random.pick(PALETTE.building);
        const mesh = new THREE.Mesh(boxGeo, makeFacadeMaterial(color, windowTex, 2, 1));
        mesh.scale.set(w, h, d);
        mesh.position.set(b.x + ox, h / 2 + 0.3, b.z + oz);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
        colliders.push({ minX: b.x + ox - w / 2, maxX: b.x + ox + w / 2, minZ: b.z + oz - d / 2, maxZ: b.z + oz + d / 2 });
      }
    }
  }

  // --- Palms: instanced trunks and crowns, along the beach and main streets ---
  const palmSpots = [];
  for (let x = -CITY_HALF; x <= CITY_HALF; x += 9) {
    palmSpots.push({ x: x + random.range(-1, 1), z: BEACH_Z - 12 });
    if (random.chance(0.5)) palmSpots.push({ x: x + random.range(-1, 1), z: BEACH_Z + 8 });
  }
  for (const line of [-60, 0, 60]) {
    for (let t = -180; t <= 180; t += 30) {
      palmSpots.push({ x: line + HALF_ROAD + 3, z: t });
      palmSpots.push({ x: t, z: line + HALF_ROAD + 3 });
    }
  }
  for (const p of parkSpots) {
    for (let i = 0; i < 5; i += 1) palmSpots.push({ x: p.x + random.range(-18, 18), z: p.z + random.range(-18, 18) });
  }
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.34, 6, 6);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5a38 });
  // A wide, flat crown reads as a palm canopy; a tall cone reads as a pine.
  const crownGeo = new THREE.ConeGeometry(3.0, 1.4, 8);
  const crownMat = new THREE.MeshLambertMaterial({ color: 0x3f8a3a });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, palmSpots.length);
  const crowns = new THREE.InstancedMesh(crownGeo, crownMat, palmSpots.length);
  {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const s = new THREE.Vector3(1, 1, 1);
    palmSpots.forEach((p, i) => {
      const lean = random.range(-0.12, 0.12);
      const scale = random.range(0.85, 1.3);
      e.set(lean, random.range(0, Math.PI * 2), lean * 0.5);
      q.setFromEuler(e);
      s.set(scale, scale, scale);
      m.compose(new THREE.Vector3(p.x, 3 * scale, p.z), q, s);
      trunks.setMatrixAt(i, m);
      m.compose(new THREE.Vector3(p.x + lean * 6, 6.4 * scale, p.z), q, s);
      crowns.setMatrixAt(i, m);
    });
    trunks.castShadow = true;
    crowns.castShadow = true;
  }
  group.add(trunks);
  group.add(crowns);

  // --- Streetlights: instanced poles and heads along every road ---
  const lightSpots = [];
  for (const line of ROAD_LINES) {
    for (let t = -CITY_HALF + 15; t < CITY_HALF; t += 30) {
      lightSpots.push({ x: line + HALF_ROAD + 1.5, z: t });
      lightSpots.push({ x: t, z: line + HALF_ROAD + 1.5 });
    }
  }
  const poleGeo = new THREE.CylinderGeometry(0.12, 0.16, 7, 5);
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x4a4f54 });
  const headGeo = new THREE.BoxGeometry(1.6, 0.25, 0.5);
  const headMat = new THREE.MeshLambertMaterial({ color: 0x2c2f33, emissive: 0x443311 });
  const poles = new THREE.InstancedMesh(poleGeo, poleMat, lightSpots.length);
  const heads = new THREE.InstancedMesh(headGeo, headMat, lightSpots.length);
  {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3(1, 1, 1);
    lightSpots.forEach((p, i) => {
      m.compose(new THREE.Vector3(p.x, 3.5, p.z), q, s);
      poles.setMatrixAt(i, m);
      m.compose(new THREE.Vector3(p.x, 7, p.z), q, s);
      heads.setMatrixAt(i, m);
    });
    poles.castShadow = true;
  }
  group.add(poles);
  group.add(heads);

  // --- Beach umbrellas ---
  const umbrellaSpots = [];
  for (let x = -180; x <= 180; x += 18) {
    if (random.chance(0.7)) umbrellaSpots.push({ x: x + random.range(-4, 4), z: BEACH_Z + random.range(6, 26) });
  }
  const umbPoleGeo = new THREE.CylinderGeometry(0.08, 0.08, 2.6, 5);
  const umbTopGeo = new THREE.ConeGeometry(2.0, 0.9, 8);
  const umbPoleMat = new THREE.MeshLambertMaterial({ color: 0xd8d8d8 });
  const umbTopMat = new THREE.MeshLambertMaterial({ color: 0xe85a5a });
  const umbPoles = new THREE.InstancedMesh(umbPoleGeo, umbPoleMat, umbrellaSpots.length);
  const umbTops = new THREE.InstancedMesh(umbTopGeo, umbTopMat, umbrellaSpots.length);
  {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3(1, 1, 1);
    umbrellaSpots.forEach((p, i) => {
      m.compose(new THREE.Vector3(p.x, 1.3, p.z), q, s);
      umbPoles.setMatrixAt(i, m);
      m.compose(new THREE.Vector3(p.x, 2.8, p.z), q, s);
      umbTops.setMatrixAt(i, m);
    });
  }
  group.add(umbPoles);
  group.add(umbTops);

  // --- The docks (south-west): warehouse, containers, crates, piers ---
  const dockX = -180;
  const dockZ = 175;
  const warehouse = new THREE.Mesh(boxGeo, makeFacadeMaterial(0xb0a89a, windowTex, 4, 2));
  warehouse.scale.set(30, 10, 16);
  warehouse.position.set(dockX + 15, 5.3, dockZ - 20);
  warehouse.castShadow = true;
  warehouse.receiveShadow = true;
  group.add(warehouse);
  colliders.push({ minX: dockX, maxX: dockX + 30, minZ: dockZ - 28, maxZ: dockZ - 12 });
  const containerColors = [0xc84a3a, 0x3a7ac8, 0x4a9a5a, 0xc8a03a];
  for (let i = 0; i < 10; i += 1) {
    const c = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: containerColors[i % 4] }));
    const w = 6;
    const h = 2.6;
    const d = 2.6;
    const cx = dockX - 10 + (i % 5) * 7;
    const cz = dockZ + 5 + Math.floor(i / 5) * 5;
    c.scale.set(w, h, d);
    c.position.set(cx, h / 2 + 0.3, cz);
    c.castShadow = true;
    group.add(c);
    colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
  }
  for (let i = 0; i < 3; i += 1) {
    const pier = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0x8a6a44 }));
    pier.scale.set(4, 0.6, 30);
    pier.position.set(dockX - 25 + i * 14, 0.4, WATER_Z + 8);
    pier.receiveShadow = true;
    group.add(pier);
  }

  // --- Collision and road helpers ---
  function collideCircle(x, z, r) {
    let nx = x;
    let nz = z;
    let hit = false;
    for (const c of colliders) {
      const cx = Math.max(c.minX, Math.min(nx, c.maxX));
      const cz = Math.max(c.minZ, Math.min(nz, c.maxZ));
      const dx = nx - cx;
      const dz = nz - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        hit = true;
        if (d2 > 1e-6) {
          const d = Math.sqrt(d2);
          nx = cx + (dx / d) * r;
          nz = cz + (dz / d) * r;
        } else {
          // Centre inside the box: push out along the smallest penetration.
          const pl = nx - (c.minX - r);
          const pr = (c.maxX + r) - nx;
          const pt = nz - (c.minZ - r);
          const pb = (c.maxZ + r) - nz;
          const m = Math.min(pl, pr, pt, pb);
          if (m === pl) nx = c.minX - r;
          else if (m === pr) nx = c.maxX + r;
          else if (m === pt) nz = c.minZ - r;
          else nz = c.maxZ + r;
        }
      }
    }
    return { x: nx, z: nz, hit };
  }

  function clampToCity(x, z, r) {
    return {
      x: Math.max(-CITY_HALF + r, Math.min(CITY_HALF - r, x)),
      z: Math.max(-CITY_HALF + r, Math.min(WATER_Z - 2 - r, z)),
    };
  }

  // Nearest road line to a point, and whether the point is on a road.
  function nearestRoad(x, z) {
    let best = null;
    for (const line of ROAD_LINES) {
      const dx = Math.abs(x - line);
      const dz = Math.abs(z - line);
      if (!best || dx < best.dist) best = { axis: 'x', line, dist: dx };
      if (!best || dz < best.dist) best = { axis: 'z', line, dist: dz };
    }
    return best;
  }

  function isOnRoad(x, z) {
    const r = nearestRoad(x, z);
    return r.dist < HALF_ROAD;
  }

  // A random point on a road (for spawning traffic / parked cars).
  function randomRoadPoint(laneOffset) {
    const line = random.pick(ROAD_LINES);
    const t = random.range(-CITY_HALF + 20, CITY_HALF - 20);
    const off = laneOffset ?? random.pick([-3.5, 3.5]);
    if (random.chance(0.5)) return { x: line + off, z: t, axis: 'z' };
    return { x: t, z: line + off, axis: 'x' };
  }

  return { group, colliders, collideCircle, clampToCity, nearestRoad, isOnRoad, randomRoadPoint, blockCenters, parkSpots };
}
