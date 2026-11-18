// Traffic: AI cars that drive the road grid on the right-hand lane, turn at
// intersections, brake for the car ahead, and pull over when a police chase
// passes. Parked cars line the kerbs and are the ones the player steals.
import { CAR_TYPES, CITY_HALF, ROAD_LINES, ROAD_WIDTH } from './config.js';
import { createCar, driveCar, forwardOf } from './vehicles.js';

const TRAFFIC_TYPES = ['sedan', 'sedan', 'sedan', 'sports', 'truck', 'taxi'];
const LANE = 3.5; // right-hand lane offset from the road centre

function roadHeading(axis, dir) {
  // axis 'z': drive along z; dir +1 means heading 0 (forward = +z), -1 means PI.
  // axis 'x': drive along x; dir +1 means heading PI/2 (forward = +x).
  if (axis === 'z') return dir > 0 ? 0 : Math.PI;
  return dir > 0 ? Math.PI / 2 : -Math.PI / 2;
}

export function createTraffic(scene, city, random) {
  const cars = [];
  const parked = [];

  function spawnTrafficCar() {
    const type = random.pick(TRAFFIC_TYPES);
    const line = random.pick(ROAD_LINES);
    const axis = random.chance(0.5) ? 'z' : 'x';
    const dir = random.pick([-1, 1]);
    const t = random.range(-CITY_HALF + 30, CITY_HALF - 30);
    // Right-hand lane: offset is on the right of the direction of travel.
    const off = axis === 'z' ? -LANE * dir : LANE * dir;
    const x = axis === 'z' ? line + off : t;
    const z = axis === 'z' ? t : line + off;
    const car = createCar(scene, type, x, z, roadHeading(axis, dir), random.pick(CAR_TYPES[type].colors));
    car.driver = 'traffic';
    car.speed = random.range(7, 11);
    car.ai = { axis, dir, line, cruise: car.speed, wait: 0, turnAt: null };
    cars.push(car);
    return car;
  }

  function spawnParkedCar(nearX, nearZ) {
    const type = random.pick(TRAFFIC_TYPES);
    let x;
    let z;
    let heading;
    if (nearX !== undefined) {
      // Parked along the nearest road, just off the lane.
      const road = city.nearestRoad(nearX, nearZ);
      const along = random.range(-20, 20);
      if (road.axis === 'x') {
        x = road.line + ROAD_WIDTH / 2 + 1.6;
        z = nearZ + along;
        heading = random.chance(0.5) ? 0 : Math.PI;
      } else {
        x = nearX + along;
        z = road.line + ROAD_WIDTH / 2 + 1.6;
        heading = random.chance(0.5) ? Math.PI / 2 : -Math.PI / 2;
      }
    } else {
      const p = city.randomRoadPoint();
      x = p.x;
      z = p.z;
      heading = p.axis === 'z' ? 0 : Math.PI / 2;
      // Nudge to the kerb.
      if (p.axis === 'z') x += 2.2;
      else z += 2.2;
    }
    const car = createCar(scene, type, x, z, heading, random.pick(CAR_TYPES[type].colors));
    car.driver = 'parked';
    parked.push(car);
    return car;
  }

  function nearestIntersection(pos, axis, dir) {
    // Next road crossing ahead of the car, along its axis.
    const coord = axis === 'z' ? pos.z : pos.x;
    let best = null;
    for (const line of ROAD_LINES) {
      const d = (line - coord) * dir;
      if (d > 2 && (best === null || d < best)) best = d;
    }
    return best === null ? Infinity : best;
  }

  function steerToward(car, targetHeading, dt) {
    let diff = targetHeading - car.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return Math.max(-1, Math.min(1, diff * 2.2));
  }

  function update(dt, playerCar, allCars, onCrash) {
    for (const car of cars) {
      const ai = car.ai;
      if (!ai) continue;
      // Brake for the vehicle ahead (player or traffic) in the same lane.
      const fwd = forwardOf(car);
      let blocked = false;
      for (const other of allCars) {
        if (other === car) continue;
        const dx = other.mesh.position.x - car.mesh.position.x;
        const dz = other.mesh.position.z - car.mesh.position.z;
        const ahead = dx * fwd.x + dz * fwd.z;
        const side = Math.abs(dx * fwd.z - dz * fwd.x);
        if (ahead > 0 && ahead < 9 && side < 2.6) { blocked = true; break; }
      }
      // Decide a turn at the next intersection.
      const toCrossing = nearestIntersection(car.mesh.position, ai.axis, ai.dir);
      if (ai.turnAt === null && toCrossing < 6) {
        ai.turnAt = random.chance(0.45) ? random.pick([-1, 1]) : 0;
      }
      let throttle = blocked ? -1 : 0.55;
      let steer = 0;
      if (ai.turnAt !== null && ai.turnAt !== 0 && toCrossing < 5) {
        // Turn 90 degrees onto the crossing road.
        const newAxis = ai.axis === 'z' ? 'x' : 'z';
        const newDir = ai.axis === 'z' ? ai.turnAt * ai.dir : -ai.turnAt * ai.dir;
        const target = roadHeading(newAxis, newDir);
        steer = steerToward(car, target, dt);
        throttle = 0.4;
        let diff = target - car.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        if (Math.abs(diff) < 0.15) {
          ai.axis = newAxis;
          ai.dir = newDir;
          ai.line = newAxis === 'z' ? car.mesh.position.x : car.mesh.position.z;
          ai.turnAt = null;
        }
      } else if (ai.turnAt === 0 && toCrossing < 2) {
        ai.turnAt = null;
      }
      // Stay glued to the lane centre: gentle correction toward the road line.
      const lineCoord = ai.axis === 'z' ? car.mesh.position.x : car.mesh.position.z;
      const want = ai.line + (ai.axis === 'z' ? -LANE * ai.dir : LANE * ai.dir);
      const laneErr = want - lineCoord;
      if (ai.turnAt === null) steer += Math.max(-0.4, Math.min(0.4, laneErr * 0.12));
      // Cruise control: ease toward cruise speed.
      if (!blocked && car.speed > ai.cruise) throttle = 0;
      driveCar(car, dt, throttle, Math.max(-1, Math.min(1, steer)), false, city, onCrash);
      // Respawn far-away cars near the player so the streets stay busy.
      if (playerCar) {
        const d = Math.hypot(car.mesh.position.x - playerCar.mesh.position.x, car.mesh.position.z - playerCar.mesh.position.z);
        if (d > 260) {
          const p = city.randomRoadPoint();
          car.mesh.position.set(p.x, 0, p.z);
          car.heading = p.axis === 'z' ? 0 : Math.PI / 2;
          car.speed = ai.cruise;
        }
      }
    }
  }

  return {
    cars,
    parked,
    spawnTrafficCar,
    spawnParkedCar,
    update,
    removeCar(car) {
      const i = cars.indexOf(car);
      if (i >= 0) cars.splice(i, 1);
      const j = parked.indexOf(car);
      if (j >= 0) parked.splice(j, 1);
    },
  };
}
