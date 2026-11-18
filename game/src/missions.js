// Missions and story: five jobs for Rico, a driver new to Solmar Bay, handed
// out by fixer Mara. Each mission is a list of steps (go to a place, get in a
// car, lose the cops, deliver on a timer, pick up crew, take down rivals).
// Steps drive the beacon, the minimap marker and the HUD objective line.
import * as THREE from 'three';
import { LANDMARKS, ROAD_WIDTH } from './config.js';
import { createCar } from './vehicles.js';

export const MISSIONS = [
  {
    id: 'first-wheels',
    name: 'First Wheels',
    reward: 500,
    start: { x: 0, z: -30 },
    intro: [
      { who: 'Mara', text: 'Rico, welcome to Solmar Bay. First rule: nobody walks here.' },
      { who: 'Mara', text: 'There is a Comet GT parked up the street. Take it. Bring it to my garage.' },
    ],
    steps: [
      { type: 'enterCar', carType: 'sports', x: 30, z: -60, label: 'Get in the Comet GT' },
      { type: 'goto', x: LANDMARKS.garage.x, z: LANDMARKS.garage.z, label: 'Drive it to Mara\'s garage', radius: 10 },
    ],
  },
  {
    id: 'getaway',
    name: 'The Getaway',
    reward: 800,
    start: { x: -60, z: -120 },
    intro: [
      { who: 'Mara', text: 'A friend needs a lift out of the north side. Pick him up — and keep it clean.' },
      { who: 'Mara', text: 'If the cops show up, lose them. Do NOT bring heat to my garage.' },
    ],
    steps: [
      { type: 'goto', x: 120, z: -60, label: 'Pick up the contact', radius: 9 },
      { type: 'heat', stars: 2, label: 'The cops are onto you!', text: 'SBPD: all units, suspect fleeing north side.' },
      { type: 'loseWanted', label: 'Lose the cops' },
    ],
  },
  {
    id: 'package-run',
    name: 'Package Run',
    reward: 700,
    start: { x: 120, z: 120 },
    intro: [
      { who: 'Mara', text: 'Three packages, three drop-offs, two and a half minutes. The clients pay for speed.' },
      { who: 'Rico', text: 'Two and a half minutes? Better not hit traffic.' },
    ],
    steps: [
      { type: 'timed', seconds: 150, label: 'Deliver all three packages' },
      { type: 'goto', x: -120, z: -120, label: 'Drop-off 1 of 3: Westside', radius: 9 },
      { type: 'goto', x: 0, z: 180, label: 'Drop-off 2 of 3: Boardwalk', radius: 9 },
      { type: 'goto', x: 180, z: 0, label: 'Drop-off 3 of 3: Eastside', radius: 9 },
    ],
  },
  {
    id: 'crew-call',
    name: 'Crew Call',
    reward: 900,
    start: { x: 0, z: 0 },
    intro: [
      { who: 'Mara', text: 'Tonight we move on the Bayfront crew. Pick up Dante and Luz first.' },
      { who: 'Mara', text: 'They are waiting on the west side and the south side. Bring them to the hideout.' },
    ],
    steps: [
      { type: 'pickup', who: 'Dante', x: -120, z: 120, label: 'Pick up Dante', radius: 9 },
      { type: 'pickup', who: 'Luz', x: 60, z: 180, label: 'Pick up Luz', radius: 9 },
      { type: 'goto', x: LANDMARKS.hideout.x, z: LANDMARKS.hideout.z, label: 'Drive the crew to the hideout', radius: 10 },
    ],
  },
  {
    id: 'bayfront-heat',
    name: 'Bayfront Heat',
    reward: 1500,
    start: { x: -120, z: 180 },
    intro: [
      { who: 'Dante', text: 'The Bayfront crew runs the docks. Five of them, all armed.' },
      { who: 'Luz', text: 'Take them down, Rico. We will cover the exits.' },
      { who: 'Mara', text: 'And when the cops come — and they will — get out of there.' },
    ],
    steps: [
      { type: 'goto', x: LANDMARKS.docks.x, z: LANDMARKS.docks.z, label: 'Reach the Bayfront docks', radius: 14 },
      { type: 'kill', count: 5, label: 'Take down the Bayfront crew', spawnAt: { x: -180, z: 170 } },
      { type: 'heat', stars: 3, label: 'SBPD is swarming the docks!', text: 'SBPD: shots fired at the docks. All units respond.' },
      { type: 'loseWanted', label: 'Escape the docks and lose the cops' },
    ],
  },
];

function createBeaconMesh(color) {
  const group = new THREE.Group();
  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.1),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 }),
  );
  diamond.position.y = 4.5;
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(1.4, 1.4, 30, 12, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }),
  );
  pillar.position.y = 15;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.2, 3.0, 32),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.25;
  group.add(diamond, pillar, ring);
  group.userData.diamond = diamond;
  return group;
}

function createCrewMesh(color) {
  const group = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2a3a5a });
  const skin = new THREE.MeshLambertMaterial({ color: 0xe8b88a });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.75, 0.32), shirt);
  torso.position.y = 1.08;
  torso.castShadow = true;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.38, 0.34), skin);
  head.position.y = 1.68;
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.72, 0.24), pants);
  legL.position.set(-0.15, 0.36, 0);
  const legR = legL.clone();
  legR.position.x = 0.15;
  group.add(torso, head, legL, legR);
  return group;
}

export function createMissions(scene, game) {
  const beacon = createBeaconMesh(0xf5c518);
  beacon.visible = false;
  scene.add(beacon);
  const startBeacon = createBeaconMesh(0x7bc47f);
  startBeacon.visible = false;
  scene.add(startBeacon);

  let active = null; // {def, stepIndex, timer, kills, crewPicked}
  let dialogueQueue = [];
  let dialogueTimer = 0;
  let crewMeshes = [];
  let targetCar = null; // the specific car a step wants

  function nextMission() {
    for (const def of MISSIONS) {
      if (!game.player.missionsDone.includes(def.id)) return def;
    }
    return null;
  }

  function currentStep() {
    return active ? active.def.steps[active.stepIndex] : null;
  }

  function objectivePosition() {
    const step = currentStep();
    if (!step) return null;
    if (step.type === 'loseWanted' || step.type === 'heat') return null;
    return { x: step.x, z: step.z };
  }

  function setDialogue(lines) {
    dialogueQueue = lines.slice();
    dialogueTimer = 0;
  }

  function startMission(def) {
    active = { def, stepIndex: 0, timer: 0, kills: 0, crewPicked: 0 };
    setDialogue(def.intro);
    // Mission-specific setup for the first step.
    const step = def.steps[0];
    if (step.type === 'enterCar') {
      // Park a fresh car of the wanted type at the kerb by the step's spot.
      const road = game.city.nearestRoad(step.x, step.z);
      let x;
      let z;
      let heading;
      if (road.axis === 'x') {
        x = road.line + ROAD_WIDTH / 2 + 1.6;
        z = step.z;
        heading = Math.PI;
      } else {
        x = step.x;
        z = road.line + ROAD_WIDTH / 2 + 1.6;
        heading = Math.PI / 2;
      }
      targetCar = createCar(game.scene, step.carType, x, z, heading, 0xd8232a);
      targetCar.driver = 'parked';
      game.traffic.parked.push(targetCar);
    }
    game.audio.missionStart();
    game.hud.showBanner(def.name, `Reward $${def.reward}`);
    return active;
  }

  function advanceStep() {
    active.stepIndex += 1;
    const step = currentStep();
    if (!step) return false;
    if (step.type === 'timed') {
      active.timer = step.seconds;
      advanceStep(); // the timed wrapper carries no position; move on at once
      return true;
    }
    if (step.type === 'heat') {
      game.police.setWanted(step.stars);
      setDialogue([{ who: 'SBPD Radio', text: step.text }]);
      advanceStep();
      return true;
    }
    if (step.type === 'kill') {
      for (let i = 0; i < step.count; i += 1) {
        game.combat.spawnEnemy(step.spawnAt.x + (i - 2) * 7, step.spawnAt.z + (i % 2 === 0 ? 8 : -8));
      }
    }
    if (step.type === 'pickup') {
      const mesh = createCrewMesh(step.who === 'Dante' ? 0x3a7ac8 : 0xc85a8a);
      mesh.position.set(step.x, 0, step.z);
      scene.add(mesh);
      crewMeshes.push(mesh);
    }
    return true;
  }

  function completeMission() {
    const def = active.def;
    game.player.cash += def.reward;
    game.player.missionsDone.push(def.id);
    game.audio.cash();
    game.hud.showBanner('Mission complete', `${def.name}  ·  +$${def.reward}`);
    game.save.saveGame();
    active = null;
    targetCar = null;
    beacon.visible = false;
    return def;
  }

  function failMission(reason) {
    game.hud.showBanner('Mission failed', reason);
    game.combat.clearEnemies();
    for (const m of crewMeshes) scene.remove(m);
    crewMeshes = [];
    active = null;
    targetCar = null;
    beacon.visible = false;
  }

  // Called every frame while playing. Returns 'complete' | 'failed' | null.
  function update(dt) {
    // Spin the beacons.
    beacon.userData.diamond.rotation.y += dt * 2;
    startBeacon.userData.diamond.rotation.y += dt * 2;
    // Dialogue auto-advance.
    if (dialogueQueue.length > 0) {
      dialogueTimer += dt;
      const line = dialogueQueue[0];
      game.hud.showDialogue(line.who, line.text);
      if (dialogueTimer > 4.5) {
        dialogueQueue.shift();
        dialogueTimer = 0;
        if (dialogueQueue.length === 0) game.hud.hideDialogue();
      }
    }
    // Show the next mission's start marker when free-roaming.
    if (!active) {
      const next = nextMission();
      if (next) {
        startBeacon.visible = true;
        startBeacon.position.set(next.start.x, 0, next.start.z);
        const p = game.playerPos();
        const d = Math.hypot(p.x - next.start.x, p.z - next.start.z);
        if (d < 6) startMission(next);
      } else {
        startBeacon.visible = false;
      }
      return null;
    }
    const step = currentStep();
    const p = game.playerPos();
    // Instant steps (a timer that starts the mission, a scripted heat spike)
    // resolve at once, even when they are the first step.
    if (step.type === 'timed') {
      active.timer = step.seconds;
      advanceStep();
      return null;
    }
    if (step.type === 'heat') {
      game.police.setWanted(step.stars);
      setDialogue([{ who: 'SBPD Radio', text: step.text }]);
      advanceStep();
      return null;
    }
    // Mission timer (package run).
    if (active.timer > 0) {
      active.timer -= dt;
      if (active.timer <= 0) {
        failMission('Out of time');
        return 'failed';
      }
    }
    // Beacon follows the current objective, bobbing gently.
    const obj = objectivePosition();
    if (obj) {
      beacon.visible = true;
      beacon.position.set(obj.x, Math.sin(performance.now() / 500) * 0.3, obj.z);
    } else {
      beacon.visible = false;
    }
    if (step.type === 'goto' || step.type === 'deliver') {
      const d = Math.hypot(p.x - step.x, p.z - step.z);
      if (d < (step.radius || 9)) {
        game.audio.chime();
        if (!advanceStep()) {
          completeMission();
          return 'complete';
        }
      }
    } else if (step.type === 'enterCar') {
      if (game.player.car && game.player.car.type === step.carType) {
        game.audio.chime();
        if (!advanceStep()) {
          completeMission();
          return 'complete';
        }
      }
    } else if (step.type === 'pickup') {
      const d = Math.hypot(p.x - step.x, p.z - step.z);
      if (d < (step.radius || 9)) {
        const mesh = crewMeshes.pop();
        if (mesh) scene.remove(mesh);
        setDialogue([{ who: step.who, text: step.who === 'Dante' ? 'Let\'s roll, Rico.' : 'Took you long enough. Drive!' }]);
        game.audio.chime();
        active.crewPicked += 1;
        if (!advanceStep()) {
          completeMission();
          return 'complete';
        }
      }
    } else if (step.type === 'kill') {
      const dead = game.combat.enemies.filter((e) => e.state === 'dead').length;
      active.kills = dead;
      if (dead >= step.count) {
        game.audio.chime();
        if (!advanceStep()) {
          completeMission();
          return 'complete';
        }
      }
    } else if (step.type === 'loseWanted') {
      if (game.police.wanted === 0) {
        if (!advanceStep()) {
          completeMission();
          return 'complete';
        }
      }
    }
    return null;
  }

  function objectiveText() {
    if (!active) {
      const next = nextMission();
      return next ? `Next job: ${next.name} — head to the green marker` : 'All missions complete — Solmar Bay is yours';
    }
    const step = currentStep();
    let text = step.label;
    if (step.type === 'kill') text += ` (${active.kills}/${step.count})`;
    if (active.timer > 0) text += ` — ${Math.ceil(active.timer)}s left`;
    return text;
  }

  return {
    MISSIONS,
    get active() { return active; },
    nextMission,
    currentStep,
    objectivePosition,
    objectiveText,
    startMission,
    update,
    failMission,
    advanceDialogue() {
      if (dialogueQueue.length > 0) {
        dialogueQueue.shift();
        dialogueTimer = 0;
        if (dialogueQueue.length === 0) game.hud.hideDialogue();
      }
    },
  };
}
