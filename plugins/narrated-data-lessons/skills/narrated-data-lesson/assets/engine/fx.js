// Shared emphasis effects, drawn on a 2D canvas. Every chart uses these so narrated
// lessons look and move the same regardless of chart type. Specs come from
// references/design-rules.md §6 (soft pulses, square boxes, accent blue, ease everything).

export const ACCENT = "#0071e3";
export const easeInOut = u => (u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2);
export const approach = (v, target, dt, tau) => v + (target - v) * (1 - Math.exp(-dt / tau));
export const bump = (t0, delay, dur, now) => {
  if (t0 == null) return 0;
  const u = (now - t0 - delay) / dur;
  return u > 0 && u < 1 ? Math.sin(Math.PI * u) : 0;
};
const rgb = c => { const x = d3.color(c); return `${x.r},${x.g},${x.b}`; };

/** Square highlight box: 2px accent stroke, soft glow, faint tint. pass = "fill" | "stroke". */
export function box(ctx, [x0, y0, x1, y1], alpha, pass) {
  if (alpha < 0.01) return;
  ctx.save();
  if (pass === "fill") {
    ctx.globalAlpha = alpha * 0.07; ctx.fillStyle = ACCENT; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  } else {
    ctx.globalAlpha = alpha; ctx.strokeStyle = ACCENT; ctx.lineWidth = 2;
    ctx.shadowColor = "rgba(0, 113, 227, 0.45)"; ctx.shadowBlur = 12;
    ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
  }
  ctx.restore();
}

/**
 * Boxes that glide: one box moving between targets reads as a pointer; several boxes
 * fade in/out. Boxes shown together share one size (same height for rows, same width
 * for columns), each centred on its own target.
 */
export class BoxLayer {
  constructor() { this.boxes = []; this.key = "null"; }
  set(targets) {                      // targets: [{key, rect}] or []
    const key = JSON.stringify(targets.map(t => t.key));
    if (key === this.key) { this._update(targets); return; }
    this.key = key;
    const live = this.boxes.filter(b => b.tgt === 1);
    if (live.length === 1 && targets.length === 1) { live[0].k = targets[0].key; live[0].goal = targets[0].rect; return; }
    live.forEach(b => (b.tgt = 0));
    targets.forEach(t => this.boxes.push({ k: t.key, r: [...t.rect], goal: t.rect, a: 0, tgt: 1 }));
  }
  _update(targets) { const m = new Map(targets.map(t => [t.key, t.rect])); this.boxes.forEach(b => { if (b.tgt === 1 && m.has(b.k)) b.goal = m.get(b.k); }); }
  step(dt) {
    const live = this.boxes.filter(b => b.tgt === 1);
    if (live.length > 1) {                                   // uniform size for boxes shown together
      const hMax = Math.max(...live.map(b => b.goal[3] - b.goal[1])), wMax = Math.max(...live.map(b => b.goal[2] - b.goal[0]));
      live.forEach(b => { const [x0, y0, x1, y1] = b.goal, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2; b.goal = [cx - wMax / 2, cy - hMax / 2, cx + wMax / 2, cy + hMax / 2]; });
    }
    this.boxes.forEach(b => { b.r = b.r.map((v, i) => approach(v, b.goal[i], dt, 260)); b.a = approach(b.a, b.tgt, dt, 220); });
    this.boxes = this.boxes.filter(b => b.tgt === 1 || b.a > 0.01);
  }
  draw(ctx, pass) { this.boxes.forEach(b => box(ctx, b.r, b.a, pass)); }
  clear() { this.boxes.forEach(b => (b.tgt = 0)); this.key = "null"; }
}

/** One soft expanding ring. */
export function ring(ctx, x, y, r0, grow, alpha, color = ACCENT) {
  if (alpha < 0.01) return;
  ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x, y, r0 + grow, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
}

/** Small white tag with dark text and accent border. place: "right" | "above". No leader line for "above". */
export function tag(ctx, x, y, label, alpha, place = "right", font = "system-ui", ink = "#1d1d1f", bounds = null) {
  if (alpha < 0.01) return;
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.font = `600 12.5px ${font}`;
  const tw = ctx.measureText(label).width + 20;
  let tx = x + 30, ty = y - 26;
  if (place === "above") { tx = x - tw / 2; ty = y - 22; }
  if (bounds) tx = Math.max(bounds[0] + 4, Math.min(bounds[1] - tw - 4, tx));
  ctx.strokeStyle = ACCENT; ctx.lineWidth = 1.5;
  if (place === "right") { ctx.beginPath(); ctx.moveTo(x + 6, y - 4); ctx.lineTo(tx, ty + 11); ctx.stroke(); }
  ctx.shadowColor = "rgba(0,0,0,.12)"; ctx.shadowBlur = 10; ctx.fillStyle = "#fff"; ctx.fillRect(tx, ty - 11, tw, 24);
  ctx.shadowBlur = 0; ctx.strokeRect(tx, ty - 11, tw, 24);
  ctx.fillStyle = ink; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(label, tx + 10, ty + 1);
  ctx.restore();
}

/** Beacon: a mark that pulses (two staggered soft rings + gentle swell) with an optional tag. */
export function beacon(ctx, x, y, r, fill, alpha, now, label, place = "right", font, ink, bounds) {
  if (alpha < 0.01) return;
  const period = 1400;
  for (let k = 0; k < 2; k++) { const ph = ((now + k * period / 2) % period) / period; ring(ctx, x, y, r + 3, ph * 22, alpha * (1 - ph) * 0.9); }
  const grow = 1 + 0.35 * (0.5 + 0.5 * Math.sin(now / 220));
  ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = fill;
  ctx.beginPath(); ctx.arc(x, y, (r + 1.5) * grow, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
  if (label) tag(ctx, x, y, label, alpha, place, font, ink, bounds);
}

/** Soft radial halo behind a cluster (used for waves and cascades). */
export function halo(ctx, cx, cy, r0, color, alpha, spread = 12) {
  if (alpha < 0.01) return;
  const c = rgb(color), rr = r0 + 6 + spread, g = ctx.createRadialGradient(cx, cy, r0 * 0.5, cx, cy, rr);
  g.addColorStop(0, `rgba(${c},0)`); g.addColorStop(0.6, `rgba(${c},${0.38 * alpha})`); g.addColorStop(1, `rgba(${c},0)`);
  ctx.save(); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.fill(); ctx.restore();
}

/**
 * Connection arc from (sx,sy) to (gx,gy): quadratic curve dipping below (dip>0) or above,
 * drawn up to progress u (0..1, already eased) with a glowing tip while travelling.
 */
export function arc(ctx, sx, sy, gx, gy, u, alpha, glow = 0, dip = 1) {
  if (alpha < 0.01 || u <= 0) return;
  const dx = Math.abs(gx - sx), cx = (gx + sx) / 2, cy = (dip > 0 ? Math.max(gy, sy) : Math.min(gy, sy)) + dip * (34 + dx * 0.1);
  const pt = v => [(1 - v) ** 2 * sx + 2 * (1 - v) * v * cx + v * v * gx, (1 - v) ** 2 * sy + 2 * (1 - v) * v * cy + v * v * gy];
  ctx.save(); ctx.lineCap = "round"; ctx.strokeStyle = ACCENT; ctx.globalAlpha = alpha * (0.8 + 0.2 * glow);
  ctx.lineWidth = 2 + 1.2 * glow; ctx.shadowColor = "rgba(0, 113, 227, 0.5)"; ctx.shadowBlur = 3 + 12 * glow;
  ctx.beginPath(); const steps = 60, end = Math.max(1, Math.round(steps * u));
  for (let i = 0; i <= end; i++) { const [x, y] = pt(i / steps); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
  ctx.stroke(); ctx.shadowBlur = 0;
  if (u < 1) {
    const [hx, hy] = pt(u);
    ctx.globalAlpha = alpha; ctx.fillStyle = "#fff"; ctx.shadowColor = "rgba(0, 113, 227, 0.9)"; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(hx, hy, 3.6, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0; ctx.strokeStyle = ACCENT; ctx.lineWidth = 1.5; ctx.stroke();
  }
  ctx.restore();
}

/** Crossfade text between two colours by alpha (never blend colours; constant weight). */
export function crossText(ctx, text, x, y, base, hue, t) {
  if (t < 0.99) { ctx.globalAlpha = 1 - t; ctx.fillStyle = base; ctx.fillText(text, x, y); }
  if (t > 0.01) { ctx.globalAlpha = t; ctx.fillStyle = hue; ctx.fillText(text, x, y); }
  ctx.globalAlpha = 1;
}

/** HiDPI canvas setup; returns {ctx, W, H}. */
export function fitCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1, W = canvas.clientWidth, H = canvas.clientHeight;
  canvas.width = Math.max(1, W * dpr); canvas.height = Math.max(1, H * dpr);
  const ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, W, H };
}
