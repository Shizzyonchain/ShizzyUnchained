export type BubbleBody = { id: number; x: number; y: number; vx: number; vy: number; r: number; targetR: number; pocket?: { corner: number; progress: number }; returning?: number };
export type BubbleShape = { id: number; size: number };
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const random = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

export function confineBubble(b: BubbleBody, width: number, height: number) {
  const r = Math.min(b.r, width / 2, height / 2);
  if (b.x < r + 2 || b.x > width - r - 2) b.vx *= -.65;
  if (b.y < r + 2 || b.y > height - r - 2) b.vy *= -.65;
  b.x = clamp(b.x, r + 2, width - r - 2);
  b.y = clamp(b.y, r + 2, height - r - 2);
}

/** Spatial hashing bounds the collision work; each neighboring pair is handled once. */
export function stepBubbles(bodies: BubbleBody[], width: number, height: number, dt = 1, clock = 0, drifting = true, pinned: number | null = null) {
  const active = bodies.filter(body => !body.pocket);
  dt = clamp(dt, .1, 2);
  for (const b of active) {
    b.r += (b.targetR - b.r) * .12 * dt;
    if (b.id !== pinned) {
      if (drifting) {
        b.vx += Math.sin(clock * .0004 + b.id * 2.4) * .004 * dt;
        b.vy += Math.cos(clock * .00037 + b.id * 1.7) * .004 * dt;
      }
      b.vx = clamp(b.vx * Math.pow(.993, dt), -4, 4);
      b.vy = clamp(b.vy * Math.pow(.993, dt), -4, 4);
      b.x += b.vx * dt; b.y += b.vy * dt;
    }
    confineBubble(b, width, height);
  }
  const cell = Math.max(32, ...active.map(b => b.r * 2 + 3));
  // Two relaxation passes keep dragged bubbles from sitting on their neighbors.
  for (let pass = 0; pass < 2; pass++) {
    const grid = new Map<string, number[]>();
    active.forEach((b, i) => { const key = `${Math.floor(b.x / cell)},${Math.floor(b.y / cell)}`; const ids = grid.get(key) || []; ids.push(i); grid.set(key, ids); });
    active.forEach((a, i) => {
      const gx = Math.floor(a.x / cell), gy = Math.floor(a.y / cell);
      for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) for (const j of grid.get(`${gx + ox},${gy + oy}`) || []) {
        if (j <= i) continue;
        const b = active[j]; let dx = b.x - a.x, dy = b.y - a.y;
        const gap = a.r + b.r + 2; let distance = Math.hypot(dx, dy);
        if (distance >= gap) continue;
        if (distance < .001) { dx = Math.cos(a.id * 2.4); dy = Math.sin(a.id * 2.4); distance = 1; }
        const nx = dx / distance, ny = dy / distance;
        const wa = a.id === pinned ? 0 : 1 / (a.r * a.r), wb = b.id === pinned ? 0 : 1 / (b.r * b.r), total = wa + wb;
        if (!total) continue;
        const push = (gap - distance) * .85;
        a.x -= nx * push * wa / total; a.y -= ny * push * wa / total;
        b.x += nx * push * wb / total; b.y += ny * push * wb / total;
        const speed = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (speed < 0) {
          const impulse = -speed * 1.45 / total;
          if (wa) { a.vx -= impulse * nx * wa; a.vy -= impulse * ny * wa; }
          if (wb) { b.vx += impulse * nx * wb; b.vy += impulse * ny * wb; }
        }
      }
    });
    active.forEach(b => confineBubble(b, width, height));
  }
}

export function layoutBubbles(shapes: BubbleShape[], width: number, height: number, previous: BubbleBody[] = [], seed = 0): BubbleBody[] {
  if (width < 40 || height < 40 || !shapes.length) return [];
  const safeSize = (size: number) => Number.isFinite(size) && size > 0 ? size : 48;
  const area = shapes.reduce((sum, b) => sum + Math.PI * (safeSize(b.size) / 2) ** 2, 0);
  const scale = Math.min(1.4, Math.sqrt(width * height * .44 / Math.max(1, area)));
  const old = new Map(previous.map(b => [b.id, b]));
  const result = shapes.map(shape => {
    const radius = clamp(safeSize(shape.size) * scale / 2, 15, Math.min(width, height) * .22);
    const prior = old.get(shape.id);
    if (prior) { prior.targetR = radius; if (!prior.pocket) confineBubble(prior, width, height); return prior; }
    return { id: shape.id, x: radius + 3 + random(shape.id + seed * 137) * (width - 2 * radius - 6), y: radius + 3 + random(shape.id * 7 + seed * 173) * (height - 2 * radius - 6), vx: 0, vy: 0, r: radius, targetR: radius };
  });
  if (!previous.length) {
    for (let i = 0; i < 260; i++) stepBubbles(result, width, height, 1, 0, false);
    for (const b of result) { b.vx = (random(b.id * 3) - .5) * .3; b.vy = (random(b.id * 9) - .5) * .3; }
  }
  return result;
}


export function poolPockets(width: number, height: number) {
  const r = clamp(Math.min(width, height) * .055, 28, 48), offset = r * .8;
  return [{ x: offset, y: offset, r }, { x: width - offset, y: offset, r }, { x: offset, y: height - offset, r }, { x: width - offset, y: height - offset, r }];
}

/** Pocket effects only change presentation/physics. Every subnet returns intact. */
export function stepPoolPockets(bodies: BubbleBody[], width: number, height: number, dt: number, clock: number, enabled = true, pinned: number | null = null) {
  const pockets = poolPockets(width, height);
  for (const b of bodies) {
    if (b.returning) b.returning = Math.max(0, b.returning - dt / 24);
    if (b.pocket) {
      const target = pockets[b.pocket.corner];
      b.pocket.progress = Math.min(1, b.pocket.progress + dt / 42);
      b.x += (target.x - b.x) * Math.min(1, .16 * dt); b.y += (target.y - b.y) * Math.min(1, .16 * dt);
      if (b.pocket.progress >= 1) {
        // Choose clear cloth away from the pockets for a gentle return.
        let best = { x: width / 2, y: height / 2, score: -Infinity };
        for (let attempt = 0; attempt < 64; attempt++) {
          const seed = b.id * 31 + attempt * 7 + clock * .001;
          const x = b.r + 4 + random(seed) * Math.max(0, width - 2 * b.r - 8);
          const y = b.r + 4 + random(seed + 93) * Math.max(0, height - 2 * b.r - 8);
          if (pockets.some(p => Math.hypot(x - p.x, y - p.y) < p.r + b.r + 8)) continue;
          const score = Math.min(...bodies.filter(other => other.id !== b.id && !other.pocket).map(other => Math.hypot(x - other.x, y - other.y) - b.r - other.r), 1000);
          if (score > best.score) best = { x, y, score };
        }
        b.x = best.x; b.y = best.y; b.vx = (random(b.id + clock) - .5) * .4; b.vy = (random(b.id * 3 + clock) - .5) * .4;
        delete b.pocket; b.returning = 1; confineBubble(b, width, height);
      }
      continue;
    }
    if (!enabled || b.id === pinned || b.returning) continue;
    for (let corner = 0; corner < pockets.length; corner++) {
      const p = pockets[corner], dx = b.x - p.x, dy = b.y - p.y, distance = Math.hypot(dx, dy);
      if (b.r <= p.r - 4) {
        if (distance <= p.r * .55) {
          b.pocket = { corner, progress: 0 }; b.vx = 0; b.vy = 0; break;
        }
        if (distance < p.r + b.r * .35 && distance > 0) {
          b.vx -= dx / distance * .055 * dt; b.vy -= dy / distance * .055 * dt;
        }
      } else {
        const rim = b.r + p.r * .72;
        if (distance < rim && distance > 0) {
          const nx = dx / distance, ny = dy / distance;
          b.x = p.x + nx * rim; b.y = p.y + ny * rim;
          const approach = b.vx * nx + b.vy * ny;
          if (approach < 0) { b.vx -= 1.7 * approach * nx; b.vy -= 1.7 * approach * ny; }
          confineBubble(b, width, height);
        }
      }
    }
  }
}
