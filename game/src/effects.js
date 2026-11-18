// Juice: muzzle flashes, tire smoke, collision sparks, damage smoke and
// skid marks. All cheap sprites and point sprites pooled at boot — no
// allocations in the hot loop.
import * as THREE from 'three';

function makeGlowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(255,220,120,0.8)');
  grad.addColorStop(1, 'rgba(255,160,40,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

function makeSmokeTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(32, 32, 4, 32, 32, 30);
  grad.addColorStop(0, 'rgba(200,200,200,0.55)');
  grad.addColorStop(1, 'rgba(180,180,180,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

export function createEffects(scene) {
  const glowTex = makeGlowTexture();
  const smokeTex = makeSmokeTexture();
  const particles = [];
  const POOL = 120;
  for (let i = 0; i < POOL; i += 1) {
    const mat = new THREE.SpriteMaterial({ map: smokeTex, transparent: true, opacity: 0, depthWrite: false });
    const sprite = new THREE.Sprite(mat);
    sprite.visible = false;
    scene.add(sprite);
    particles.push({ sprite, life: 0, maxLife: 1, vx: 0, vy: 0, vz: 0, grow: 0 });
  }
  let cursor = 0;

  // The muzzle flash: a bright sprite plus a point light, shown briefly.
  const flashMat = new THREE.SpriteMaterial({ map: glowTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const flash = new THREE.Sprite(flashMat);
  flash.scale.set(1.6, 1.6, 1);
  flash.visible = false;
  scene.add(flash);
  const flashLight = new THREE.PointLight(0xffc860, 0, 14);
  scene.add(flashLight);
  let flashTimer = 0;
  let holdFlash = false; // screenshot mode: keep the flash up

  function spawn(x, y, z, vx, vy, vz, life, scale, grow, color, additive) {
    const p = particles[cursor];
    cursor = (cursor + 1) % POOL;
    p.sprite.visible = true;
    p.sprite.position.set(x, y, z);
    p.sprite.material.map = additive ? glowTex : smokeTex;
    p.sprite.material.color.set(color);
    p.sprite.material.blending = additive ? THREE.AdditiveBlending : THREE.NormalBlending;
    p.sprite.scale.set(scale, scale, 1);
    p.sprite.material.opacity = 0.85;
    p.life = life;
    p.maxLife = life;
    p.vx = vx;
    p.vy = vy;
    p.vz = vz;
    p.grow = grow;
  }

  return {
    muzzleFlash(x, y, z) {
      flash.position.set(x, y, z);
      flash.visible = true;
      flashMat.opacity = 1;
      flashLight.position.set(x, y, z);
      flashLight.intensity = 30;
      flashTimer = 0.07;
    },
    setHoldFlash(value) { holdFlash = value; },
    tireSmoke(x, y, z) {
      spawn(x, y + 0.2, z, (Math.random() - 0.5) * 1.5, 1.2 + Math.random(), (Math.random() - 0.5) * 1.5, 0.9, 0.8, 1.6, 0xbbbbbb, false);
    },
    damageSmoke(x, y, z) {
      spawn(x, y + 1, z, (Math.random() - 0.5), 1.5, (Math.random() - 0.5), 1.2, 0.9, 1.8, 0x777777, false);
    },
    sparks(x, y, z, count) {
      for (let i = 0; i < (count || 10); i += 1) {
        spawn(x, y, z, (Math.random() - 0.5) * 8, Math.random() * 5, (Math.random() - 0.5) * 8, 0.35, 0.35, 0, 0xffcc44, true);
      }
    },
    update(dt) {
      if (flashTimer > 0 && !holdFlash) {
        flashTimer -= dt;
        if (flashTimer <= 0) {
          flash.visible = false;
          flashLight.intensity = 0;
        }
      }
      if (holdFlash) {
        flash.visible = true;
        flashMat.opacity = 1;
        flashLight.intensity = 30;
      }
      for (const p of particles) {
        if (p.life <= 0) continue;
        p.life -= dt;
        if (p.life <= 0) {
          p.sprite.visible = false;
          continue;
        }
        p.sprite.position.x += p.vx * dt;
        p.sprite.position.y += p.vy * dt;
        p.sprite.position.z += p.vz * dt;
        const t = 1 - p.life / p.maxLife;
        const s = p.sprite.scale.x + p.grow * dt;
        p.sprite.scale.set(s, s, 1);
        p.sprite.material.opacity = 0.85 * (1 - t);
      }
    },
  };
}
