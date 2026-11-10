// Moving scatter: each bubble is an entity (country, school, group…) placed by two
// measures (x, y) and sized by a third, sliding smoothly as time passes. The narrator can
// focus entities or groups, draw an entity's trail, and pulse one with a tag.
// Explore: play/scrub time, hover a bubble for its values, legend highlights a group.
// Data format: moving-scatter/v1 (references/data-formats.md).
import * as fx from "../../engine/fx.js";

export async function createChart({ mount, data, lesson, api }) {
  const cfg = lesson.chartConfig || {};
  const canvas = document.createElement("canvas"); mount.append(canvas);
  let ctx, W, H;
  const T = data.time.values, X = data.x, Y = data.y, Sz = data.size || null;
  const groups = data.groups, gColor = Object.fromEntries(groups.map(g => [g.id, g.color]));
  const ents = data.entities.map(e => ({ ...e, a: 1, b: 0, trail: 0, x: 0, y: 0, r: 4 }));
  const m = { t: 52, r: 36, b: 52, l: 64 };
  let t = T[0], focus = null, keyHi = null, trails = new Set(), beaconOn = null, beaconA = 0, hovered = null;
  const boxes = new fx.BoxLayer();
  const sx = v => { const lo = X.log ? Math.log10(X.min) : X.min, hi = X.log ? Math.log10(X.max) : X.max; return m.l + ((X.log ? Math.log10(v) : v) - lo) / (hi - lo) * (W - m.l - m.r); };
  const sy = v => { const lo = Y.log ? Math.log10(Y.min) : Y.min, hi = Y.log ? Math.log10(Y.max) : Y.max; return H - m.b - ((Y.log ? Math.log10(v) : v) - lo) / (hi - lo) * (H - m.t - m.b); };
  const rOf = s => (Sz && s != null ? 3 + Math.sqrt(s / Sz.max) * (cfg.maxRadius || 34) : cfg.dotRadius || 7);
  function valAt(e, tt) {                                   // interpolate between the two nearest years with data
    const keys = T.filter(y => e.values[y]);
    if (!keys.length) return null;
    if (tt <= keys[0]) return e.values[keys[0]];
    for (let i = 1; i < keys.length; i++) if (tt <= keys[i]) {
      const a = e.values[keys[i - 1]], b = e.values[keys[i]], u = (tt - keys[i - 1]) / (keys[i] - keys[i - 1]);
      const lerp = (p, q, log) => (log && p > 0 && q > 0 ? 10 ** (Math.log10(p) + (Math.log10(q) - Math.log10(p)) * u) : p + (q - p) * u);
      return [lerp(a[0], b[0], X.log), lerp(a[1], b[1], Y.log), a[2] != null ? lerp(a[2], b[2]) : null];
    }
    return e.values[keys.at(-1)];
  }
  function resize() { ({ ctx, W, H } = fx.fitCanvas(canvas)); }
  resize();
  const inFocus = e => !focus || (focus.entities && focus.entities.includes(e.id)) || (focus.groups && focus.groups.includes(e.group));

  canvas.addEventListener("mousemove", ev => {
    if (api.mode !== "explore") return;
    const r = canvas.getBoundingClientRect(), mx = ev.clientX - r.left, my = ev.clientY - r.top;
    let best = null, bd = Infinity;
    ents.forEach(e => { const d = Math.hypot(e.x - mx, e.y - my); if (d < e.r + 4 && d < bd) { bd = d; best = e; } });
    hovered = best;
    if (!best) { api.resetDetail(); return; }
    const v = valAt(best, t), fmt = (ax, val) => `${(+val).toLocaleString(undefined, { maximumFractionDigits: ax.decimals ?? 1 })}${ax.unit || ""}`;
    api.detail({ kicker: groups.find(g => g.id === best.group)?.label || "", title: best.label, color: gColor[best.group],
      body: `<div class="drow"><span>${X.label}</span><b>${fmt(X, v[0])}</b></div><div class="drow"><span>${Y.label}</span><b>${fmt(Y, v[1])}</b></div>${Sz && v[2] != null ? `<div class="drow"><span>${Sz.label}</span><b>${fmt(Sz, v[2])}</b></div>` : ""}` });
  });
  canvas.addEventListener("mouseleave", () => { hovered = null; api.resetDetail(); });

  function frame(dt, now) {
    ents.forEach(e => {
      const v = valAt(e, t);
      if (!v) { e.vis = false; return; }
      e.vis = true;
      const tx = sx(v[0]), ty = sy(v[1]), tr = rOf(v[2]);
      if (!e.init) { e.x = tx; e.y = ty; e.r = tr; e.init = true; }
      e.x = fx.approach(e.x, tx, dt, 120); e.y = fx.approach(e.y, ty, dt, 120); e.r = fx.approach(e.r, tr, dt, 120);
      const on = keyHi ? e.group === keyHi : inFocus(e);
      e.a = fx.approach(e.a, on ? 1 : 0.1, dt, 300);
      e.b = fx.approach(e.b, focus && inFocus(e) ? 1 : 0, dt, 280);
      e.trail = fx.approach(e.trail, trails.has(e.id) ? 1 : 0, dt, 300);
    });
    beaconA = fx.approach(beaconA, beaconOn ? 1 : 0, dt, beaconOn ? 300 : 90);
    boxes.set(cfg.outlineFocus && focus && focus.entities ? focus.entities.map(id => { const e = ents.find(z => z.id === id); return e && e.vis ? { key: id, rect: [e.x - e.r - 10, e.y - e.r - 10, e.x + e.r + 10, e.y + e.r + 10] } : null; }).filter(Boolean) : []);
    boxes.step(dt);
    draw(now);
  }
  function draw(now) {
    ctx.clearRect(0, 0, W, H);
    // big faint year behind the chart: the current time is the backdrop
    ctx.save(); ctx.font = `700 ${Math.round(Math.min(W, H) * 0.22)}px ${api.font}`; ctx.fillStyle = "rgba(0,0,0,0.045)"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(data.time.format ? data.time.format.replace("{v}", Math.floor(t)) : Math.floor(t), (m.l + W - m.r) / 2, (m.t + H - m.b) / 2); ctx.restore();
    if (data.title) { ctx.font = `600 18px ${api.font}`; ctx.fillStyle = api.ink; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.fillText(data.title, m.l - 40, 26); }
    // axes
    ctx.font = `12px ${api.font}`; ctx.fillStyle = api.faint; ctx.strokeStyle = "rgba(0,0,0,.08)"; ctx.lineWidth = 1;
    axisTicks(X).forEach(v => { const x = sx(v); ctx.beginPath(); ctx.moveTo(x, m.t); ctx.lineTo(x, H - m.b); ctx.stroke(); ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText(tickLabel(X, v), x, H - m.b + 8); });
    axisTicks(Y).forEach(v => { const y = sy(v); ctx.beginPath(); ctx.moveTo(m.l, y); ctx.lineTo(W - m.r, y); ctx.stroke(); ctx.textAlign = "right"; ctx.textBaseline = "middle"; ctx.fillText(tickLabel(Y, v), m.l - 8, y); });
    ctx.fillStyle = api.muted; ctx.font = `600 12px ${api.font}`;
    ctx.textAlign = "right"; ctx.textBaseline = "alphabetic"; ctx.fillText(X.label, W - m.r, H - 14);
    ctx.save(); ctx.translate(18, m.t); ctx.rotate(-Math.PI / 2); ctx.textAlign = "right"; ctx.fillText(Y.label, 0, 0); ctx.restore();
    boxes.draw(ctx, "fill");
    // trails (path through the years so far)
    ents.forEach(e => {
      if (e.trail < 0.01) return;
      ctx.save(); ctx.globalAlpha = e.trail * 0.7; ctx.strokeStyle = gColor[e.group]; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]); ctx.beginPath();
      let first = true;
      T.filter(y => y <= t && e.values[y]).forEach(y => { const [vx, vy] = e.values[y]; first ? ctx.moveTo(sx(vx), sy(vy)) : ctx.lineTo(sx(vx), sy(vy)); first = false; });
      ctx.lineTo(e.x, e.y); ctx.stroke(); ctx.restore();
    });
    // bubbles: biggest first so small ones stay visible; crisp darker rim
    [...ents].filter(e => e.vis).sort((a, b) => b.r - a.r).forEach(e => {
      const c = gColor[e.group];
      ctx.globalAlpha = e.a * 0.85; ctx.fillStyle = c; ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 0.8 * e.b, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = e.a; ctx.strokeStyle = e === hovered ? api.ink : d3.color(c).darker(0.9); ctx.lineWidth = e === hovered ? 2 : 0.8 + 0.6 * e.b; ctx.stroke();
    });
    ctx.globalAlpha = 1;
    // labels for focused entities (or always-labelled ones)
    ents.filter(e => e.vis && ((focus && focus.entities && focus.entities.includes(e.id)) || (cfg.alwaysLabel || []).includes(e.id))).forEach(e => {
      ctx.font = `600 12px ${api.font}`; ctx.fillStyle = api.ink; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.globalAlpha = Math.max(e.b, 0.6);
      ctx.fillText(e.label, e.x + e.r + 6, e.y); ctx.globalAlpha = 1;
    });
    boxes.draw(ctx, "stroke");
    if (beaconOn || beaconA > 0.01) {
      const e = ents.find(z => z.id === (beaconOn?.entity || lastBeacon?.entity));
      if (e && e.vis) fx.beacon(ctx, e.x, e.y, e.r, gColor[e.group], beaconA, now, (beaconOn || lastBeacon).label, "above", api.font, api.ink, [0, W]);
    }
  }
  let lastBeacon = null;
  const span = T.at(-1) - T[0];
  return {
    pos: { min: T[0], max: T.at(-1), start: T[0], loop: false, format: v => (data.time.format || "{v}").replace("{v}", Math.floor(v)),
      speeds: cfg.speeds || [{ label: "Slow", value: span / 60 }, { label: "Medium", value: span / 25 }, { label: "Fast", value: span / 10 }],
      defaultSpeed: cfg.defaultSpeed ?? span / 25,
      ticks: T.filter((y, i) => i % Math.max(1, Math.round(T.length / 8)) === 0 || i === T.length - 1).map(y => ({ v: y, label: String(y), major: true })) },
    cueDefaults: { focus: null, trail: null, beacon: null },
    setPos(p) { t = p; },
    apply(c) {
      if ("focus" in c) focus = c.focus;
      if ("trail" in c) trails = new Set(c.trail || []);
      if ("beacon" in c) { if (c.beacon) lastBeacon = c.beacon; beaconOn = c.beacon; }
    },
    clear() { focus = null; trails = new Set(); beaconOn = null; },
    frame, resize,
    legend: () => groups.map(g => ({ id: g.id, label: g.label, color: g.color, desc: g.desc || "" })),
    hoverKey(id) { keyHi = id; },
    color: id => gColor[id] || ents.find(e => e.id === id && gColor[e.group]) && gColor[ents.find(e => e.id === id).group],
  };
}

function axisTicks(A) {
  if (A.ticks) return A.ticks;
  if (A.log) { const out = []; for (let p = Math.floor(Math.log10(A.min)); p <= Math.ceil(Math.log10(A.max)); p++) [1, 2, 5].forEach(k => { const v = k * 10 ** p; if (v >= A.min && v <= A.max) out.push(v); }); return out; }
  const raw = (A.max - A.min) / 6, p = 10 ** Math.floor(Math.log10(raw)), n = raw / p, step = (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * p;
  return d3.range(Math.ceil(A.min / step) * step, A.max + 1e-9, step);
}
function tickLabel(A, v) { const s = v >= 1000 ? (v >= 1e6 ? `${+(v / 1e6).toFixed(1)}M` : `${+(v / 1e3).toFixed(1)}k`) : `${+(+v).toFixed(2)}`; return `${A.prefix || ""}${s}${A.unit || ""}`; }
