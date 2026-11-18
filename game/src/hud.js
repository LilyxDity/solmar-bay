// The HUD: health bar, cash, wanted stars, clock, speedometer, mission
// objective, dialogue box, banners, and the start/pause/busted/wasted screens.
// All DOM; the 3D view never draws text. Updates only what changed.
import { CLOCK_START_MINUTES, PLAYER_MAX_HEALTH } from './config.js';

export function createHud() {
  const el = (id) => document.getElementById(id);
  const els = {
    healthFill: el('health-fill'),
    healthNum: el('health-num'),
    cash: el('cash-value'),
    stars: el('wanted-stars'),
    clock: el('clock-value'),
    speed: el('speed-value'),
    speedWrap: el('speedo'),
    objective: el('objective-text'),
    objectiveWrap: el('objective'),
    dialogue: el('dialogue'),
    dialogueWho: el('dialogue-who'),
    dialogueText: el('dialogue-text'),
    banner: el('banner'),
    bannerTitle: el('banner-title'),
    bannerSub: el('banner-sub'),
    prompt: el('prompt'),
    crosshair: el('crosshair'),
    ammo: el('ammo-readout'),
    bustBar: el('bust-bar'),
    bustFill: el('bust-fill'),
    vignette: el('damage-vignette'),
    startScreen: el('start-screen'),
    pauseScreen: el('pause-screen'),
    endScreen: el('end-screen'),
    endTitle: el('end-title'),
    endCopy: el('end-copy'),
    missionList: el('mission-list'),
    continueBtn: el('continue-btn'),
  };
  let bannerTimer = 0;
  let last = {};

  function setText(node, key, value) {
    if (last[key] !== value) {
      last[key] = value;
      node.textContent = value;
    }
  }

  function formatClock(minutes) {
    const total = Math.floor(minutes) % (24 * 60);
    const h = Math.floor(total / 60);
    const m = total % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  return {
    update(state) {
      // Health
      const hp = Math.max(0, Math.round(state.health));
      els.healthFill.style.width = `${(hp / PLAYER_MAX_HEALTH) * 100}%`;
      els.healthFill.classList.toggle('low', hp <= 30);
      setText(els.healthNum, 'hp', String(hp));
      // Cash
      setText(els.cash, 'cash', `$${Math.floor(state.cash).toLocaleString('en-US')}`);
      // Wanted stars
      const stars = '★'.repeat(state.wanted) + '☆'.repeat(5 - state.wanted);
      setText(els.stars, 'stars', stars);
      els.stars.classList.toggle('hot', state.wanted > 0);
      // Clock
      setText(els.clock, 'clock', formatClock(CLOCK_START_MINUTES + state.elapsed * 1));
      // Speedometer (driving only)
      els.speedWrap.hidden = !state.driving;
      if (state.driving) {
        setText(els.speed, 'speed', `${Math.round(Math.abs(state.speedKmh))}`);
      }
      // Objective
      setText(els.objective, 'objective', state.objective);
      els.objectiveWrap.classList.toggle('urgent', state.wanted >= 3);
      // Ammo
      setText(els.ammo, 'ammo', state.reloading ? 'RELOADING' : `${state.ammo} / ${state.reserve}`);
      // Crosshair: only when aiming on foot.
      els.crosshair.hidden = !(state.aiming && !state.driving);
      // Bust progress
      els.bustBar.hidden = state.bustProgress <= 0;
      if (state.bustProgress > 0) els.bustFill.style.width = `${state.bustProgress * 100}%`;
      // Damage vignette
      els.vignette.classList.toggle('on', state.health <= 30);
      // Banner timer
      if (bannerTimer > 0) {
        bannerTimer -= state.dt;
        if (bannerTimer <= 0) els.banner.hidden = true;
      }
    },
    showBanner(title, sub) {
      els.bannerTitle.textContent = title;
      els.bannerSub.textContent = sub || '';
      els.banner.hidden = false;
      bannerTimer = 3.2;
    },
    showDialogue(who, text) {
      els.dialogue.hidden = false;
      setText(els.dialogueWho, 'who', who);
      setText(els.dialogueText, 'dialogue', text);
    },
    hideDialogue() {
      els.dialogue.hidden = true;
    },
    showPrompt(text) {
      els.prompt.hidden = false;
      setText(els.prompt, 'prompt', text);
    },
    hidePrompt() {
      els.prompt.hidden = true;
    },
    showScreen(name) {
      els.startScreen.hidden = name !== 'start';
      els.pauseScreen.hidden = name !== 'pause';
      els.endScreen.hidden = name !== 'end';
    },
    showEnd(title, copy) {
      els.endTitle.textContent = title;
      els.endCopy.textContent = copy;
      this.showScreen('end');
    },
    renderMissionList(missions, done, hasSave) {
      els.missionList.innerHTML = '';
      missions.forEach((m, i) => {
        const li = document.createElement('li');
        const isDone = done.includes(m.id);
        const unlocked = i === 0 || done.includes(missions[i - 1].id);
        li.className = isDone ? 'done' : unlocked ? 'open' : 'locked';
        li.textContent = `${isDone ? '✓' : unlocked ? '○' : '🔒'} ${m.name} — $${m.reward}`;
        els.missionList.appendChild(li);
      });
      els.continueBtn.hidden = !hasSave;
    },
  };
}
