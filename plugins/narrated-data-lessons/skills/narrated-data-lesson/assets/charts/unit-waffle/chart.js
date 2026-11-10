// Unit / waffle chart: each panel is a grid of units (default 10×10 = 100), coloured by
// category so "23 out of 100" is visible at a glance. Optional frames (years, stages)
// let the units recolour smoothly as time passes. The narrator can focus categories or
// panels, box a panel, and pulse a unit with a tag. Explore: hover a unit for its
// panel's numbers, legend highlights a category, scrub frames.
// Data format: unit-waffle/v1 (references/data-formats.md).
import * as fx from "../../engine/fx.js";

export async function createChart({ mount, data, lesson, api }) {
  const cfg = lesson.chartConfig || {};
  const canvas = document.createElement("canvas"); mount.append(canvas);
  let ctx, W, H;
  const cats = data.categories, cIdx = Object.fromEntries(cats.map((c, i) => [c.id, i]));
  const frames = data.frames, F = frames.length, panels = frames[0].panels.map(p => ({ id: p.id, label: p.label }));
  const N = data.unitsPerPanel || 100, COLS = data.columns || 10, ROWS_ = Math.ceil(N / COLS);
  const units = panels.flatMap((p, pi) => d3.range(N).map(k => ({ p: pi, k, cat: -1, from: -1, mix: 1, a: 1, x: 0, y: 0 })));
  let pos = 0, focus = null, keyHi = null, beaconOn = null, beaconA = 0, lastBeacon = null, outline = false, hovered = null;
  let geo = { size: 10, gap: 2, panelW: 0, ox: [], oy: 0 };
  const boxes = new fx.BoxLayer();

  // whole-unit counts per category for a share map (largest remainder; always sums to N)
  function counts(shares) {
    const raw = cats.map(c => (shares[c.id] || 0) * N), base = raw.map(Math.floor);
    let left = N - d3.sum(base);
    raw.map((v, i) => [v - base[i], i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (left > 0) { base[i]++; left--; } });
    return base;
  }
  function sharesAt(pi, p) {
    const i = Math.max(0, Math.min(F - 1, Math.floor(p))), j = Math.min(F - 1, i + 1), u = Math.max(0, Math.min(1, p - i));
    const a = frames[i].panels[pi].shares, b = frames[j].panels[pi].shares, out = {};
    cats.forEach(c => (out[c.id] = (a[c.id] || 0) + ((b[c.id] || 0) - (a[c.id] || 0)) * u));
    return out;
  }
  function assign() {
    panels.forEach((p, pi) => {
      const cnt = counts(sharesAt(pi, pos)); let k = 0;
      cnt.forEach((n, ci) => { for (let z = 0; z < n; z++, k++) { const u = units[pi * N + k]; if (u.cat !== ci) { u.from = u.cat; u.cat = ci; u.mix = u.from < 0 ? 1 : 0; } } });
      for (; k < N; k++) { const u = units[pi * N + k]; if (u.cat !== -1) { u.from = u.cat; u.cat = -1; u.mix = 0; } }
    });
  }
  function layout() {
    ({ ctx, W, H } = fx.fitCanvas(canvas));
    const P = panels.length, top = 92, bottom = 24, side = 24;
    const avW = (W - side * 2) / P - 28, avH = H - top - bottom;
    const size = Math.max(4, Math.min((avW - (COLS - 1) * 2) / COLS, (avH - (ROWS_ - 1) * 2) / ROWS_, 26));
    const gap = Math.max(1.5, size * 0.16), panelW = COLS * size + (COLS - 1) * gap, panelH = ROWS_ * size + (ROWS_ - 1) * gap;
    const totalW = P * panelW + (P - 1) * 28, x0 = (W - totalW) / 2;
    geo = { size, gap, panelW, panelH, ox: panels.map((_, i) => x0 + i * (panelW + 28)), oy: top + (avH - panelH) / 2 };
    units.forEach(u => { const r = Math.floor(u.k / COLS), c = u.k % COLS; u.x = geo.ox[u.p] + c * (size + gap); u.y = geo.oy + (ROWS_ - 1 - r) * (size + gap); });
  }
  layout(); assign();

  const inFocus = u => !focus || ((!focus.categories || (u.cat >= 0 && focus.categories.includes(cats[u.cat].id))) && (!focus.panels || focus.panels.includes(panels[u.p].id)));
  canvas.addEventListener("mousemove", e => {
    if (api.mode !== "explore") return;
    const r = canvas.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
    hovered = units.find(u => mx >= u.x && mx <= u.x + geo.size && my >= u.y && my <= u.y + geo.size) || null;
    if (!hovered) { api.resetDetail(); return; }
    const sh = sharesAt(hovered.p, pos), cnt = counts(sh);
    api.detail({ kicker: frames[Math.round(Math.min(F - 1, pos))].label || "", title: panels[hovered.p].label, color: "",
      body: cats.map((c, i) => `<div class="drow"><span><span class="sw" style="background:${c.color}"></span>${c.label}</span><b>${cnt[i]} of ${N}</b></div>`).join("") });
  });
  canvas.addEventListener("mouseleave", () => { hovered = null; api.resetDetail(); });

  function frame(dt, now) {
    units.forEach(u => {
      u.mix = fx.approach(u.mix, 1, dt, 260);
      const on = keyHi ? u.cat >= 0 && cats[u.cat].id === keyHi : inFocus(u);
      u.a = fx.approach(u.a, on ? 1 : 0.14, dt, 280);
    });
    beaconA = fx.approach(beaconA, beaconOn ? 1 : 0, dt, beaconOn ? 300 : 90);
    boxes.set(outline && focus && focus.panels ? focus.panels.map(id => { const i = panels.findIndex(p => p.id === id); return { key: id, rect: [geo.ox[i] - 12, geo.oy - 50, geo.ox[i] + geo.panelW + 12, geo.oy + geo.panelH + 12] }; }) : []);
    boxes.step(dt);
    draw(now);
  }
  function draw(now) {
    ctx.clearRect(0, 0, W, H);
    if (data.title) { ctx.font = `600 18px ${api.font}`; ctx.fillStyle = api.ink; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.fillText(data.title, 24, 26); }
    if (data.unitLabel) { ctx.font = `12px ${api.font}`; ctx.fillStyle = api.muted; ctx.textAlign = "left"; ctx.fillText(data.unitLabel, 24, 46); }
    boxes.draw(ctx, "fill");
    panels.forEach((p, pi) => {
      const on = !focus || !focus.panels || focus.panels.includes(p.id);
      ctx.globalAlpha = on ? 1 : 0.35; ctx.font = `700 14px ${api.font}`; ctx.fillStyle = api.ink; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
      ctx.fillText(p.label, geo.ox[pi] + geo.panelW / 2, geo.oy - 26);
      if (focus && focus.categories && focus.categories.length === 1) {       // the narrated number, in the category colour
        const ci = cIdx[focus.categories[0]], n = counts(sharesAt(pi, pos))[ci];
        ctx.font = `600 12.5px ${api.font}`; ctx.fillStyle = cats[ci].color; ctx.fillText(`${n} of ${N}`, geo.ox[pi] + geo.panelW / 2, geo.oy - 9);
      }
      ctx.globalAlpha = 1;
    });
    const s = geo.size, rr = Math.min(3, s * 0.18);
    units.forEach(u => {
      const col = u.cat >= 0 ? cats[u.cat].color : "#e8e8ed", prev = u.from >= 0 ? cats[u.from].color : "#e8e8ed";
      ctx.globalAlpha = u.a;
      if (u.mix < 0.99) { ctx.fillStyle = prev; roundRect(ctx, u.x, u.y, s, s, rr); ctx.globalAlpha = u.a * u.mix; }
      ctx.fillStyle = col; roundRect(ctx, u.x, u.y, s, s, rr);
      if (u === hovered) { ctx.globalAlpha = 1; ctx.strokeStyle = api.ink; ctx.lineWidth = 2; ctx.strokeRect(u.x, u.y, s, s); }
    });
    ctx.globalAlpha = 1;
    boxes.draw(ctx, "stroke");
    const b = beaconOn || lastBeacon;
    if (b && beaconA > 0.01) {
      const pi = panels.findIndex(p => p.id === b.panel), ci = cIdx[b.category];
      const u = units.find(z => z.p === pi && z.cat === ci);
      if (u) fx.beacon(ctx, u.x + s / 2, u.y + s / 2, s / 2, cats[ci].color, beaconA, now, b.label, "above", api.font, api.ink, [0, W]);
    }
  }
  function roundRect(c, x, y, w, h, r) { c.beginPath(); c.roundRect ? c.roundRect(x, y, w, h, r) : c.rect(x, y, w, h); c.fill(); }

  return {
    pos: F > 1 ? { min: 0, max: F - 1, start: 0, loop: false, format: p => frames[Math.round(p)].label,
      speeds: [{ label: "Slow", value: 0.25 }, { label: "Medium", value: 0.6 }, { label: "Fast", value: 1.5 }], defaultSpeed: 0.6,
      ticks: frames.map((f, i) => ({ v: i, label: f.label, major: true })) } : null,
    cueDefaults: { focus: null, beacon: null, outline: false },
    setPos(p) { const q = Math.max(0, Math.min(F - 1, p)); if (q !== pos) { pos = q; assign(); } },
    apply(c) {
      if ("focus" in c) focus = c.focus;
      if ("outline" in c) outline = c.outline;
      if ("beacon" in c) { if (c.beacon) lastBeacon = c.beacon; beaconOn = c.beacon; }
    },
    clear() { focus = null; beaconOn = null; outline = false; },
    frame, resize() { layout(); },
    legend: () => cats.map(c => ({ id: c.id, label: c.label, color: c.color, desc: c.desc || "" })),
    hoverKey(id) { keyHi = id; },
    color: id => cats.find(c => c.id === id)?.color,
  };
}
