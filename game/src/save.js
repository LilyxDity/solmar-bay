// Save and load: cash, completed missions, garage count and the player's
// position, in localStorage. Saves on mission completion and every 30 seconds;
// loading never throws (a corrupt save just starts fresh).
import { SAVE_KEY } from './config.js';

export function createSave(getState, applyState) {
  let timer = 0;
  function saveGame() {
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(getState()));
    } catch {
      // Storage can be off: the save then lasts this visit only.
    }
  }
  function loadGame() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (!data || typeof data !== 'object') return false;
      applyState(data);
      return true;
    } catch {
      return false;
    }
  }
  function hasSave() {
    try {
      return !!window.localStorage.getItem(SAVE_KEY);
    } catch {
      return false;
    }
  }
  function clearSave() {
    try {
      window.localStorage.removeItem(SAVE_KEY);
    } catch { /* ignore */ }
  }
  function update(dt) {
    timer += dt;
    if (timer >= 30) {
      timer = 0;
      saveGame();
    }
  }
  return { saveGame, loadGame, hasSave, clearSave, update };
}
