// The 2D minimap: a canvas in the HUD's corner showing the road grid, the
// beach, the player's arrow (rotated to face their heading), the mission
// marker, police blips and a north indicator. Redrawn every frame from state.
import { BEACH_Z, CITY_HALF, ROAD_LINES, ROAD_WIDTH } from './config.js';

export function createMinimap(canvas) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const SCALE = W / (CITY_HALF * 2 + 60); // world units -> pixels

  function toMap(x, z) {
    return {
      x: W / 2 + x * SCALE,
      y: H / 2 + z * SCALE,
    };
  }

  function draw(state) {
    ctx.clearRect(0, 0, W, H);
    // Sea and sand at the bottom (south).
    ctx.fillStyle = '#2e9fc4';
    ctx.fillRect(0, toMap(0, 238).y, W, H);
    ctx.fillStyle = '#e6d29a';
    ctx.fillRect(0, toMap(0, BEACH_Z).y, W, toMap(0, 238).y - toMap(0, BEACH_Z).y);
    // City ground.
    ctx.fillStyle = '#3a3f44';
    ctx.fillRect(0, 0, W, toMap(0, BEACH_Z).y);
    // Blocks (lighter squares between roads).
    ctx.fillStyle = '#6a6258';
    for (let ix = 0; ix < ROAD_LINES.length - 1; ix += 1) {
      for (let iz = 0; iz < ROAD_LINES.length - 1; iz += 1) {
        const x0 = ROAD_LINES[ix] + ROAD_WIDTH / 2;
        const z0 = ROAD_LINES[iz] + ROAD_WIDTH / 2;
        const x1 = ROAD_LINES[ix + 1] - ROAD_WIDTH / 2;
        const z1 = ROAD_LINES[iz + 1] - ROAD_WIDTH / 2;
        const a = toMap(x0, z0);
        const b = toMap(x1, z1);
        ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
      }
    }
    // Roads are the dark gaps already; brighten the road lines slightly.
    ctx.strokeStyle = '#4a4f54';
    ctx.lineWidth = ROAD_WIDTH * SCALE;
    for (const line of ROAD_LINES) {
      const a = toMap(line, -CITY_HALF);
      const b = toMap(line, CITY_HALF);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      const c = toMap(-CITY_HALF, line);
      const d = toMap(CITY_HALF, line);
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(d.x, d.y);
      ctx.stroke();
    }
    // Mission marker: pulsing yellow diamond.
    if (state.objective) {
      const p = toMap(state.objective.x, state.objective.z);
      const pulse = 1 + Math.sin(performance.now() / 250) * 0.25;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = '#f5c518';
      const s = 5 * pulse;
      ctx.fillRect(-s, -s, s * 2, s * 2);
      ctx.restore();
    }
    // Next-mission start marker (green) when free-roaming.
    if (state.nextStart) {
      const p = toMap(state.nextStart.x, state.nextStart.z);
      ctx.fillStyle = '#7bc47f';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Police blips: flashing red/blue.
    const flash = Math.floor(performance.now() / 300) % 2 === 0;
    ctx.fillStyle = flash ? '#ff3333' : '#3388ff';
    for (const cop of state.cops) {
      const p = toMap(cop.x, cop.z);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Player arrow, rotated to the heading. The arrow is drawn pointing up
    // (north, -z); a heading of 0 faces south (+z), so the rotation is PI - heading.
    const pp = toMap(state.player.x, state.player.z);
    ctx.save();
    ctx.translate(pp.x, pp.y);
    ctx.rotate(Math.PI - state.player.heading);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#222222';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(6, 7);
    ctx.lineTo(0, 3);
    ctx.lineTo(-6, 7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    // North indicator.
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('N', W / 2, 16);
  }

  return { draw };
}
