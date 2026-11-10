// Dot timeline: one dot per person, moving between states through a day (or any timeline).
// Grid form: columns = groups being compared, rows = states. Ported from the approved
// "Who we spend our day with" lesson; every behavior there is preserved (see
// references/design-rules.md §3, §6). Data format: dot-timeline/v1.
import * as fx from "../../engine/fx.js";
import { createChart as createLines } from "../line-reveal/chart.js";

const GOLDEN = Math.PI * (3 - Math.sqrt(5));

export async function createChart({ mount, data, lesson, api }) {
  const cfg = lesson.chartConfig || {};
  const states = data.states, G = data.groups.length;
  const sIdx = Object.fromEntries(states.map((s, i) => [s.id, i]));
  const label = Object.fromEntries(states.map(s => [s.id, s.label]));
  const ROWS = cfg.rows || states.map(s => s.id);                     // top → bottom
  const ROW_WEIGHT = cfg.rowWeight || {};
  const colorOf = id => (cfg.colors && cfg.colors[id]) || "#999";
  const stateColor = states.map(s => colorOf(s.id));
  const stateEdge = stateColor.map(c => d3.color(c).darker(0.9).formatHex());
  const grey = new Set(cfg.grey || []);
  const labelHue = Object.fromEntries(ROWS.map(id => [id, grey.has(id) ? d3.color(colorOf(id)).darker(1.2).formatHex() : colorOf(id)]));
  // Phones get half the dots (a full group won't fit side by side at a readable size).
  const DOTS = Math.round((cfg.dots || 200) * (window.innerWidth < 600 ? 0.5 : 1)), R_BASE = cfg.dotRadius || 2.6, DIM = 0.07;
  let R = R_BASE;   // shrinks only when the screen is too narrow for full-size clusters
  // Pre-rendered dots (fill + darker rim) per colour at screen resolution: 1,400 vector
  // circles a frame is slow in some browsers (Safari). Looks the same as the vector dots.
  let sprites = null;
  function makeSprites(dpr) {
    const mk = (rad, lw, rimA) => stateColor.map((col, i) => {
      const size = Math.ceil(2 * (rad + lw) + 2), c = document.createElement("canvas");
      c.width = c.height = Math.round(size * dpr);
      const g = c.getContext("2d"); g.scale(dpr, dpr);
      g.beginPath(); g.arc(size / 2, size / 2, rad, 0, Math.PI * 2); g.fillStyle = col; g.fill();
      g.globalAlpha = rimA; g.lineWidth = lw; g.strokeStyle = stateEdge[i]; g.stroke();
      return { c, size, half: size / 2 };
    });
    sprites = { dpr, R, base: mk(R, 0.8, 0.45), focus: mk(R + 0.7 * R / R_BASE, 1.3, 1) };
  }
  let SP = (2 * R + 1.1) * 0.56;
  const STAT = cfg.headerStat;                                          // {state, suffix}
  const SOCIAL = cfg.social || [];
  const start = cfg.clockStart ?? 240;                                  // minutes after midnight at pos 0 (4:00am)

  // ── layers: dot grid (canvas) + optional summary line chart ──
  const simLayer = document.createElement("div"); simLayer.style.cssText = "position:absolute;inset:0;transition:opacity .45s ease";
  const canvas = document.createElement("canvas"); simLayer.append(canvas); mount.append(simLayer);
  let lines = null, lineLayer = null;
  if (cfg.summary) {
    lineLayer = document.createElement("div"); lineLayer.style.cssText = "position:absolute;inset:0;opacity:0;pointer-events:none;transition:opacity .45s ease";
    mount.append(lineLayer);
    const sdata = await fetch(cfg.summary.data, { cache: "no-cache" }).then(r => r.json());
    lines = await createLines({ mount: lineLayer, data: sdata, lesson: { chartConfig: { reveal: false, ...(cfg.summary.config || {}) } }, api });
  }

  let ctx, W = 0, H = 0, colW = 0, colX = [], rowY = {}, rowTop = {}, rowH = {}, rowBottom = 0;
  let LABEL_X = 16, LABEL_W = 126, HEAD_H = 62, compact = false, mid = false;
  const FOOT = 14;
  const nodes = [];
  data.groups.forEach((g, gi) => g.people.slice(0, DOTS).forEach(seq => nodes.push({ g: gi, seq, p: 0, state: seq[0], a: 1, b: 0 })));
  let minute = 0;
  const cells = new Map();
  const cellOf = (g, s) => { const k = g * 100 + s; if (!cells.has(k)) cells.set(k, []); return cells.get(k); };
  const stateAt = (n, m) => { while (n.seq[2 * n.p + 1] <= m && 2 * n.p + 3 < n.seq.length) n.p++; return n.seq[2 * n.p]; };
  function setTarget(n) { const r = SP * Math.sqrt(n.slot + 0.5), a = n.slot * GOLDEN; n.tx = colX[n.g] + r * Math.cos(a); n.ty = rowY[states[n.state].id] + r * Math.sin(a); }
  function leave(n) { const c = cellOf(n.g, n.state), last = c.pop(); if (last !== n) { last.slot = n.slot; c[n.slot] = last; setTarget(last); } }
  function enter(n, s) { n.state = s; const c = cellOf(n.g, s); n.slot = c.length; c.push(n); setTarget(n); }
  function rebuild() { cells.clear(); nodes.forEach(n => { n.p = 0; enter(n, stateAt(n, minute)); }); }
  function updateStates() { nodes.forEach(n => { const s = stateAt(n, minute); if (s !== n.state) { leave(n); enter(n, s); } }); }

  function layout() {
    ({ ctx, W, H } = fx.fitCanvas(canvas));
    if (!W || !H) return;
    // Narrow screens: tighter label column, and dots/clusters scale down just enough that a
    // full cluster fits its column (no sideways scrolling). Wide screens: scale 1, unchanged.
    compact = W < 560; mid = !compact && W < 800;
    LABEL_W = compact ? 82 : mid ? 112 : 126; LABEL_X = compact ? 6 : mid ? 10 : 16; HEAD_H = compact ? 48 : 62;
    const fullCluster = 2 * ((2 * R_BASE + 1.1) * 0.56 * Math.sqrt(DOTS) + R_BASE);
    const scale = Math.min(1, (W - LABEL_W) / G / (fullCluster + (compact || mid ? 6 : 0)));
    R = R_BASE * scale; SP = (2 * R + 1.1 * scale) * 0.56;
    const unit = (H - HEAD_H - FOOT) / ROWS.reduce((s, id) => s + (ROW_WEIGHT[id] || 1), 0);
    let y = HEAD_H;
    ROWS.forEach(id => { const h = unit * (ROW_WEIGHT[id] || 1); rowTop[id] = y; rowH[id] = h; rowY[id] = y + h / 2; y += h; });
    rowBottom = y; colW = (W - LABEL_W) / G;
    colX = d3.range(G).map(g => LABEL_W + (g + 0.5) * colW);
    if (cells.size) nodes.forEach(setTarget);
  }
  layout(); rebuild(); nodes.forEach(n => { n.x = n.tx; n.y = n.ty; });

  // ── narration state ──
  let focus = null, outline = false, pulseOn = false, pulseA = 0, pulseNode = null;
  let grandOn = false, grandA = 0, grandNode = null, connectN = 0, connA = 0, breatheOn = false, breatheA = 0;
  let arcs = [], together = [], togetherT0 = 0, view = "sim";
  const fxT = { rows: null, cols: null };
  const lit = new Set(), boxes = new fx.BoxLayer();
  const labelT = Object.fromEntries(ROWS.map(id => [id, 0]));
  const inFocus = n => !focus || ((!focus.rows || focus.rows.includes(states[n.state].id)) && (!focus.cols || focus.cols.includes(n.g)));
  const cellNodes = (c, st) => nodes.filter(n => n.g === c && n.state === st);

  function boxTargets() {
    if (!outline || !focus || (!focus.rows && !focus.cols)) return [];
    const runs = [];
    (focus.cols ? [...focus.cols].sort((a, b) => a - b) : []).forEach(c => { const r = runs.at(-1); if (r && c === r[1] + 1) r[1] = c; else runs.push([c, c]); });
    const rows = focus.rows ? focus.rows : [null], cols = runs.length ? runs : [null];
    return rows.flatMap(r => cols.map(c => ({ key: `${r}|${c}`, rect: rectOf(r, c) })));
  }
  function rectOf(row, cols) {
    let x0 = cols ? LABEL_W + cols[0] * colW + 4 : 4, x1 = cols ? LABEL_W + (cols[1] + 1) * colW - 4 : W - 4;
    let y0 = row ? rowTop[row] + 3 : 4, y1 = row ? rowTop[row] + rowH[row] - 3 : rowBottom + FOOT - 4;
    let top = y0, bot = y1; const gap = R + 9;
    nodes.forEach(n => {
      if (row && states[n.state].id !== row) return;
      if (cols && (n.g < cols[0] || n.g > cols[1])) return;
      top = Math.min(top, n.ty - gap); bot = Math.max(bot, n.ty + gap);
    });
    if (row) { const cy = rowY[row], half = Math.max(cy - top, bot - cy, (y1 - y0) / 2); y0 = cy - half; y1 = cy + half; }
    else { y0 = Math.min(y0, top); y1 = Math.max(y1, bot); }
    return [Math.max(2, x0), Math.max(2, y0), Math.min(W - 2, x1), Math.min(H - 2, y1)];
  }
  function pickPulse() {
    const mid = Math.floor(G / 2), st = sIdx[cfg.pulseState || ROWS.at(-2)];
    const pool = nodes.filter(n => n.state === st).sort((a, b) => Math.abs(a.g - mid) - Math.abs(b.g - mid) || a.slot - b.slot);
    return pool[0] || nodes[0];
  }
  const ARC_MS = 1100;
  function pickConnect(c) {
    const st = sIdx[c.state || cfg.pulseState || "alone"], toG = c.toGroup ?? G - 1;
    const old = cellNodes(toG, st);
    grandNode = old.length ? old.reduce((m, n) => (n.tx - n.ty * 0.35 < m.tx - m.ty * 0.35 ? n : m)) : nodes.find(n => n.g === toG);
    arcs = (c.fromGroups || [3, 1, 0]).map(g => { const pool = cellNodes(g, st); return { node: pool.length ? pool.reduce((m, n) => (n.tx + n.ty * 0.35 > m.tx + m.ty * 0.35 ? n : m)) : nodes.find(n => n.g === g), t0: null }; });
  }
  let connectCfg = {};

  // ── Explore hover: one person's day ──
  let hovered = null;
  canvas.addEventListener("mousemove", e => {
    if (api.mode !== "explore") return;
    const r = canvas.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
    let best = 64, hit = null;
    nodes.forEach(n => { const d = (n.x - mx) ** 2 + (n.y - my) ** 2; if (d < best) { best = d; hit = n; } });
    canvas.style.cursor = hit ? "pointer" : "default";
    if (!hit || hit === hovered) return;
    hovered = hit;
    const tot = {};
    for (let k = 0, s0 = 0; k < hit.seq.length; k += 2) { const id = states[hit.seq[k]].id; tot[id] = (tot[id] || 0) + hit.seq[k + 1] - s0; s0 = hit.seq[k + 1]; }
    const now = states[hit.state].id;
    api.detail({ kicker: `${cfg.personLabel || "One person's day"} · ${data.groups[hit.g].label || data.groups[hit.g].id}`, title: `Right now: ${label[now]}`, color: "",
      body: ROWS.filter(id => tot[id]).sort((a, b) => tot[b] - tot[a]).map(id => `<div class="drow"><span><span class="sw" style="background:${colorOf(id)}"></span>${label[id]}</span><b>${(tot[id] / 60).toFixed(1)}h</b></div>`).join("") });
  });
  canvas.addEventListener("mouseleave", () => { hovered = null; api.resetDetail(); });

  // ── per-frame ──
  function frame(dt, now) {
    const k = 1 - Math.exp(-dt / 420), ka = 1 - Math.exp(-dt / 280);
    nodes.forEach(n => {
      n.x += (n.tx - n.x) * k; n.y += (n.ty - n.y) * k;
      n.a += ((pulseOn ? (n === pulseNode ? 1 : 0.22) : (lit.has(n) || inFocus(n) ? 1 : DIM)) - n.a) * ka;
      n.b += ((focus && !pulseOn && inFocus(n) ? 1 : 0) - n.b) * ka;
    });
    boxes.set(boxTargets()); boxes.step(dt);
    ROWS.forEach(id => { labelT[id] = fx.approach(labelT[id], focus && focus.rows && focus.rows.includes(id) ? 1 : 0, dt, 250); });
    pulseA = fx.approach(pulseA, pulseOn ? 1 : 0, dt, pulseOn ? 300 : 90);   // exits faster than entrances
    grandA += ((grandOn ? 1 : 0) - grandA) * (grandOn ? 1 - Math.exp(-dt / 300) : 1 - Math.exp(-dt / 70));
    connA += ((connectN > 0 ? 1 : 0) - connA) * (connectN > 0 ? 1 - Math.exp(-dt / 300) : 1 - Math.exp(-dt / 70));
    breatheA = fx.approach(breatheA, breatheOn ? 1 : 0, dt, 300);
    if (connA < 0.01 && !connectN) arcs.forEach(a => (a.t0 = null));
    lit.clear();
    if ((grandOn || connectN) && grandNode) { lit.add(grandNode); arcs.forEach(a => { if (a.t0 != null && a.node) lit.add(a.node); }); }
    if (view === "sim") draw(now);
    if (lines) lines.frame(dt, now);
  }
  function draw(now) {
    ctx.clearRect(0, 0, W, H);
    const counts = d3.range(G).map(() => new Array(states.length).fill(0));
    nodes.forEach(n => counts[n.g][n.state]++);
    ctx.textBaseline = "middle";
    ROWS.forEach((id, i) => {
      const on = !focus || !focus.rows || focus.rows.includes(id);
      const cb = fx.bump(fxT.rows, i * 170, 900, now), t = Math.max(labelT[id], cb), base = on ? api.muted : api.faint;
      if (cb > 0.01) { const c = d3.color(labelHue[id]); ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},${0.13 * cb})`; ctx.fillRect(2, rowTop[id] + 2, W - 4, rowH[id] - 4); }
      const words = label[id].toUpperCase().split(" & ");
      const lh = compact ? 10 : mid ? 12 : 13, fs = compact ? 7.5 : mid ? 9.5 : 10.5;
      ctx.font = `700 ${(fs * (1 + 0.22 * cb)).toFixed(2)}px ${api.font}`; ctx.textAlign = "left";
      words.forEach((w, kk) => fx.crossText(ctx, kk ? "& " + w : w, LABEL_X, rowY[id] + (kk - (words.length - 1) / 2) * lh, base, labelHue[id], t));
      if (i) { ctx.fillStyle = "rgba(0,0,0,0.05)"; ctx.fillRect(LABEL_W - 10, rowTop[id], W - LABEL_W + 4, 1); }
    });
    ctx.textAlign = "center";
    data.groups.forEach((g, gi) => {
      const on = !focus || !focus.cols || focus.cols.includes(gi);
      const hy = compact ? 18 : 24, sy = compact ? 33 : 42;
      ctx.font = `700 ${compact ? 10 : 13.5}px ${api.font}`;
      const sw = fx.bump(fxT.cols, gi * 200, 850, now), base = on ? 1 : 0.35;
      ctx.globalAlpha = base * (1 - sw); ctx.fillStyle = api.ink; ctx.fillText(g.id, colX[gi], hy - 3 * sw);
      if (sw > 0.01) { ctx.globalAlpha = sw; ctx.fillStyle = fx.ACCENT; ctx.fillText(g.id, colX[gi], hy - 3 * sw); }
      ctx.globalAlpha = base;
      if (STAT) {   // phones: just the number per column, the "% alone" label once at the left
        const pct = Math.round(counts[gi][sIdx[STAT.state]] / DOTS * 100);
        ctx.font = `500 ${compact ? 9.5 : 11.5}px ${api.font}`; ctx.fillStyle = colorOf(STAT.state);
        ctx.fillText(compact ? `${pct}%` : `${pct}% ${STAT.suffix}`, colX[gi], sy);
      }
    });
    if (STAT && compact) {
      ctx.globalAlpha = 1; ctx.textAlign = "left"; ctx.font = `500 9.5px ${api.font}`; ctx.fillStyle = colorOf(STAT.state);
      ctx.fillText(`% ${STAT.suffix}`, LABEL_X, 33); ctx.textAlign = "center";
    }
    ctx.globalAlpha = 1;
    boxes.draw(ctx, "fill");
    if (breatheA > 0.01 && cfg.breatheState) {
      const st = sIdx[cfg.breatheState];
      for (let gi = 0; gi < G; gi++) {
        const c = cells.get(gi * 100 + st); if (!c || !c.length) continue;
        const cx = d3.mean(c, n => n.x), cy = d3.mean(c, n => n.y), r0 = SP * Math.sqrt(c.length) + R, ph = 0.5 + 0.5 * Math.sin(now / 420 - gi * 0.9);
        fx.halo(ctx, cx, cy, r0, colorOf(cfg.breatheState), breatheA * (0.55 + 0.45 * ph) * 0.58, 6 + 10 * ph);
      }
    }
    together.forEach(h => {
      const u = (now - togetherT0 - h.delay) / 1100; if (u < 0 || u > 1) return;
      const c = cells.get(h.g * 100 + h.s); if (!c || !c.length) return;
      fx.halo(ctx, d3.mean(c, n => n.x), d3.mean(c, n => n.y), SP * Math.sqrt(c.length) + R, stateColor[h.s], Math.sin(Math.PI * u), 12 * u);
    });
    const dpr = window.devicePixelRatio || 1;
    if (!sprites || sprites.dpr !== dpr || sprites.R !== R) makeSprites(dpr);
    nodes.forEach(n => {
      ctx.globalAlpha = n.a;
      if (n !== hovered && (n.b < 0.02 || n.b > 0.98)) {   // common case: a ready-made sprite, snapped to device pixels
        const sp = (n.b > 0.98 ? sprites.focus : sprites.base)[n.state];
        ctx.drawImage(sp.c, Math.round((n.x - sp.half) * dpr) / dpr, Math.round((n.y - sp.half) * dpr) / dpr, sp.size, sp.size);
        return;
      }
      const rad = n === hovered ? R + 2 : R + 0.7 * (R / R_BASE) * n.b;
      ctx.beginPath(); ctx.arc(n.x, n.y, rad, 0, Math.PI * 2); ctx.fillStyle = stateColor[n.state]; ctx.fill();
      ctx.lineWidth = 0.8 + 0.5 * n.b; ctx.strokeStyle = stateEdge[n.state]; ctx.globalAlpha = n.a * (0.45 + 0.55 * n.b); ctx.stroke();
      if (n === hovered) { ctx.globalAlpha = 1; ctx.lineWidth = 2; ctx.strokeStyle = api.ink; ctx.stroke(); }
    });
    ctx.globalAlpha = 1;
    boxes.draw(ctx, "stroke");
    // connection arcs into the focused person
    if (grandNode) {
      const g = grandNode;
      arcs.forEach(a => {
        if (a.t0 == null || !a.node) return;
        const s0 = a.node, age = now - a.t0, u = fx.easeInOut(Math.max(0, Math.min(1, age / ARC_MS)));
        fx.arc(ctx, s0.x, s0.y, g.x, g.y, u, connA, 0, 1);
        ctx.save(); ctx.globalAlpha = connA; ctx.fillStyle = stateColor[s0.state]; ctx.beginPath(); ctx.arc(s0.x, s0.y, R + 1.4, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore();
        if (age < 700) fx.ring(ctx, s0.x, s0.y, R + 2, (age / 700) * 12, connA * (1 - age / 700) * 0.8);
        if (u >= 1) { const since = age - ARC_MS; if (since < 800) fx.ring(ctx, g.x, g.y, R + 3, (since / 800) * 18, connA * (1 - since / 800) * 0.9); }
      });
      if (grandA > 0.01) {
        const mates = cellNodes(g.g, g.state), top = Math.min(...mates.map(n => n.y)) - R, cx = d3.mean(mates, n => n.x);
        fx.beacon(ctx, g.x, g.y, R, stateColor[g.state], grandA, now, null);
        fx.tag(ctx, cx, top - 2, connectCfg.label || "", grandA, "above", api.font, api.ink, [0, W]);
      } else if (connA > 0.01) {
        ctx.save(); ctx.globalAlpha = connA; ctx.fillStyle = stateColor[g.state]; ctx.beginPath(); ctx.arc(g.x, g.y, R + 1.6, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
      }
    }
    if (pulseNode) fx.beacon(ctx, pulseNode.x, pulseNode.y, R, stateColor[pulseNode.state], pulseA, now, cfg.pulseLabel || "1 person", "right", api.font, api.ink);
  }

  function setView(v) {
    view = v;
    simLayer.style.opacity = v === "sim" ? 1 : 0; simLayer.style.pointerEvents = v === "sim" ? "" : "none";
    if (lineLayer) { lineLayer.style.opacity = v === "chart" ? 1 : 0; lineLayer.style.pointerEvents = v === "chart" ? "" : "none"; }
    if (v === "sim") layout(); else lines?.resize();
  }

  const fmtClock = p => { const t = (start + Math.floor(p)) % 1440, h = Math.floor(t / 60), mm = t % 60; return `${(h % 12) || 12}:${String(mm).padStart(2, "0")}${h < 12 ? "am" : "pm"}`; };
  const hourLabel = h => { const c = (Math.floor(start / 60) + h) % 24; return `${(c % 12) || 12}${c < 12 ? "am" : "pm"}`.replace("12am", "midnight").replace("12pm", "noon"); };

  return {
    pos: {
      min: 0, max: 1440, start: 0, loop: true, holdOnJumps: true, format: fmtClock,
      speeds: [{ label: "Slow", value: 4 }, { label: "Medium", value: 10 }, { label: "Fast", value: 30 }], defaultSpeed: 10,
      ticks: d3.range(25).map(h => ({ v: h * 60, major: h % 3 === 2, label: h % 3 === 2 ? hourLabel(h) : "" })),
    },
    views: [{ id: "sim", label: cfg.simLabel || "Simulation", icon: '<svg viewBox="0 0 12 12"><circle cx="3" cy="3" r="2" fill="currentColor"/><circle cx="9" cy="3" r="2" fill="currentColor"/><circle cx="3" cy="9" r="2" fill="currentColor"/><circle cx="9" cy="9" r="2" fill="currentColor"/></svg>' },
      ...(lines ? [{ id: "chart", label: cfg.summary.label || "Summary", usesPos: false, icon: '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6"><polyline points="1,10 4,6 7,7 11,2"/></svg>' }] : [])],
    setView,
    cueDefaults: { focus: null, outline: false, pulse: false, connect: 0, grand: false, breathe: false, chartFocus: null, chartMark: null },
    setPos(p, o = {}) {
      const m = Math.max(0, Math.min(1439.9, p));
      if (o.jump || m < minute - 0.5) { minute = m; rebuild(); if (o.snap) nodes.forEach(n => { n.x = n.tx; n.y = n.ty; }); }
      else if (m !== minute) { minute = m; updateStates(); }
    },
    apply(c, { natural }) {
      if ("focus" in c) focus = c.focus;
      if ("outline" in c) outline = c.outline;
      if ("pulse" in c) { if (c.pulse && !pulseOn) pulseNode = pickPulse(); pulseOn = c.pulse; }
      if ("grand" in c) { if (c.grand && !grandOn) { connectCfg = { label: cfg.connectLabel, ...(cfg.connect || {}) }; pickConnect(connectCfg); } grandOn = c.grand; }
      if ("connect" in c) {
        if (c.connect && !grandNode) { connectCfg = { label: cfg.connectLabel, ...(cfg.connect || {}) }; pickConnect(connectCfg); }
        const t = performance.now();
        arcs.forEach((a, i) => { if (i < c.connect && a.t0 == null) a.t0 = natural ? t : t - ARC_MS * 2; if (i >= c.connect && c.connect > 0) a.t0 = null; });
        connectN = c.connect; if (!c.connect && !natural) connA = 0;
      }
      if ("breathe" in c) breatheOn = c.breathe;
      if (c.together && natural) {
        togetherT0 = performance.now(); together = [];
        for (let gi = 0; gi < G; gi++) SOCIAL.forEach((id, ri) => { const cc = cells.get(gi * 100 + sIdx[id]); if (cc && cc.length >= 3) together.push({ g: gi, s: sIdx[id], delay: gi * 150 + ri * 60 + Math.random() * 120 }); });
      }
      if (natural && c.rowCascade) fxT.rows = performance.now();
      if (natural && c.colSweep) fxT.cols = performance.now();
      if (!natural) { fxT.rows = fxT.cols = null; }
      if (lines && ("chartFocus" in c || "chartMark" in c)) {
        const sf = "chartFocus" in c ? c.chartFocus : undefined;
        if (sf !== undefined) lines.apply({ focus: sf ? { series: [sf] } : null });
        if ("chartMark" in c) lines.apply({ marks: (c.chartMark || []).map(x => ({ series: c.chartFocus || cfg.summary.markSeries, x })) });
      }
    },
    clear() { focus = null; outline = false; pulseOn = false; grandOn = false; connectN = 0; breatheOn = false; lines?.clear(); },
    frame, resize() { layout(); lines?.resize(); },
    legend: () => [...ROWS].reverse().map(id => ({ id, label: label[id], color: colorOf(id), titleColor: labelHue[id], desc: (cfg.groupInfo || {})[id] || "" })),
    color: colorOf,
  };
}
