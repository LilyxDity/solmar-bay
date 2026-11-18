// Keyboard and mouse input. Held keys are read every frame; one-shot presses
// (interact, reload, punch, pause, dialogue advance) are queued as bit flags
// and taken once by the loop, so a press between two frames is never lost.
// Mouse look works with pointer lock, or by dragging when lock is unavailable.
export const ACTION_INTERACT = 1; // E: enter/exit car, start mission, advance dialogue
export const ACTION_RELOAD = 2; // R
export const ACTION_PUNCH = 4; // F
export const ACTION_PAUSE = 8; // Esc / P
export const ACTION_HORN = 16; // H
export const ACTION_FIRE = 32; // mouse click (held fire is read separately)

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let lookDX = 0;
  let lookDY = 0;
  let mouseDown = false;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let locked = false;
  // When pointer lock engages, the browser warps the cursor to the centre of
  // the screen and fires a mousemove carrying that jump as movementX/Y. That
  // one event is not the player looking — drop it, or the camera spins ~80°
  // the moment Play is clicked.
  let dropNextMove = false;

  function onKeyDown(event) {
    if (event.code === 'Escape') {
      if (!event.repeat) actions |= ACTION_PAUSE;
      return;
    }
    keys.add(event.code);
    if (event.repeat) return;
    if (event.code === 'KeyE') actions |= ACTION_INTERACT;
    else if (event.code === 'KeyR') actions |= ACTION_RELOAD;
    else if (event.code === 'KeyF') actions |= ACTION_PUNCH;
    else if (event.code === 'KeyP') actions |= ACTION_PAUSE;
    else if (event.code === 'KeyH') actions |= ACTION_HORN;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
  }
  function onKeyUp(event) {
    keys.delete(event.code);
  }
  function onMouseMove(event) {
    if (dropNextMove) {
      dropNextMove = false;
      return;
    }
    if (locked) {
      lookDX += event.movementX;
      lookDY += event.movementY;
    } else if (dragging) {
      lookDX += event.clientX - lastX;
      lookDY += event.clientY - lastY;
      lastX = event.clientX;
      lastY = event.clientY;
    }
  }
  function onMouseDown(event) {
    if (event.button === 0) {
      mouseDown = true;
      dragging = true;
      lastX = event.clientX;
      lastY = event.clientY;
      if (!event.repeat) actions |= ACTION_FIRE;
      // Clicking the game view grabs the mouse for look control.
      if (!locked && document.pointerLockElement !== canvas) {
        try { canvas.requestPointerLock(); } catch { /* drag-look still works */ }
      }
    }
  }
  function onMouseUp(event) {
    if (event.button === 0) {
      mouseDown = false;
      dragging = false;
    }
  }
  function onLockChange() {
    const nowLocked = document.pointerLockElement === canvas;
    if (nowLocked && !locked) {
      // Fresh lock: discard anything queued before it and drop the warp event.
      lookDX = 0;
      lookDY = 0;
      dropNextMove = true;
    }
    locked = nowLocked;
  }
  function onBlur() {
    keys.clear();
    mouseDown = false;
    dragging = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  window.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  document.addEventListener('pointerlockchange', onLockChange);

  return {
    /** Forward/back strafe as -1..1 pairs: {x: right, z: forward}. */
    moveAxes() {
      const x = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
      const z = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
      return { x, z };
    },
    sprint() { return keys.has('ShiftLeft') || keys.has('ShiftRight'); },
    jump() { return keys.has('Space'); },
    handbrake() { return keys.has('Space'); },
    firing() { return mouseDown; },
    /** Mouse-look deltas since the last call, in pixels. Clamped per call so
     * one spurious event (or a long frame) can never spin the camera. */
    takeLook() {
      const clamp = (v) => Math.max(-200, Math.min(200, v));
      const out = { dx: clamp(lookDX), dy: clamp(lookDY) };
      lookDX = 0;
      lookDY = 0;
      return out;
    },
    /** One-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    isLocked() { return locked; },
    releaseLock() {
      if (document.pointerLockElement) document.exitPointerLock();
    },
    /** For scripted scenes: pretend a key is held this frame. */
    press(code) { keys.add(code); },
    unpress(code) { keys.delete(code); },
  };
}
