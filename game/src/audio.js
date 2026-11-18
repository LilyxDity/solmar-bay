// All sound is synthesized with WebAudio — no audio files. Engine hum, sirens,
// gunshots, a pickup chime and UI clicks. The context starts on the first user
// gesture (browsers block audio before one); in headless shot mode it stays silent.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;
  let muted = false;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    gain.gain.setValueAtTime(vol || 0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain).connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noiseBurst(dur, vol, filterFreq) {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq || 1200;
    const gain = ctx.createGain();
    gain.gain.value = vol || 0.4;
    src.connect(filter).connect(gain).connect(master);
    src.start(t);
  }

  return {
    /** Call from a user gesture (click/keypress) to unlock audio. */
    unlock() { ensure(); },
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = value ? 0 : 0.5;
    },
    click() { blip(660, 0.07, 'square', 0.08); },
    chime() { blip(880, 0.12, 'sine', 0.2); setTimeout(() => blip(1318, 0.18, 'sine', 0.18), 90); },
    cash() { blip(988, 0.09, 'triangle', 0.22); setTimeout(() => blip(1319, 0.14, 'triangle', 0.22), 80); },
    gunshot() { noiseBurst(0.14, 0.5, 900); blip(180, 0.1, 'square', 0.25, 60); },
    punch() { noiseBurst(0.08, 0.3, 500); },
    crash() { noiseBurst(0.25, 0.5, 700); blip(90, 0.2, 'sawtooth', 0.2, 40); },
    horn() { blip(392, 0.18, 'square', 0.12); blip(494, 0.18, 'square', 0.1); },
    denied() { blip(220, 0.12, 'square', 0.12, 160); },
    missionStart() { blip(523, 0.12, 'triangle', 0.2); setTimeout(() => blip(784, 0.16, 'triangle', 0.2), 110); },
    /** Continuous engine hum; call every frame with speed 0..1. */
    engine(speed01, on) {
      if (!ctx || muted) return;
      if (!on) {
        if (engineGain) engineGain.gain.value = 0;
        return;
      }
      if (!engineOsc) {
        engineOsc = ctx.createOscillator();
        engineOsc.type = 'sawtooth';
        engineGain = ctx.createGain();
        engineGain.gain.value = 0;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 400;
        engineOsc.connect(filter).connect(engineGain).connect(master);
        engineOsc.start();
      }
      engineOsc.frequency.value = 55 + speed01 * 130;
      engineGain.gain.value = 0.05 + speed01 * 0.05;
    },
    /** Two-tone police siren; call every frame with whether any cop is near. */
    siren(on, dt) {
      if (!ctx || muted) return;
      if (!on) {
        if (sirenGain) sirenGain.gain.value = 0;
        return;
      }
      if (!sirenOsc) {
        sirenOsc = ctx.createOscillator();
        sirenOsc.type = 'triangle';
        sirenGain = ctx.createGain();
        sirenGain.gain.value = 0;
        sirenOsc.connect(sirenGain).connect(master);
        sirenOsc.start();
      }
      sirenTimer += dt;
      sirenOsc.frequency.value = Math.floor(sirenTimer * 2) % 2 === 0 ? 750 : 950;
      sirenGain.gain.value = 0.06;
    },
  };
}
