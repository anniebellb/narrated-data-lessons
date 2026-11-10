// Line reveal: one or more lines over a continuous x (years, ages…). In the video the
// lines draw themselves as time passes (pos = x reached so far); the narrator can focus
// series and mark points (soft pulse, label clear of the rings). Explore: scrub x, hover
// for values, legend highlights a series.
// Data format: line-reveal/v1 (references/data-formats.md).
import { ring, approach, crossText, fitCanvas } from "../../engine/fx.js";

export async function createChart({ mount, data, lesson, api }) {
  const cfg = lesson.chartConfig || {};
  const canvas = document.createElement("canvas"); mount.append(canvas);
  let ctx, W, H;
  const X = data.x, Y = data.y, S = data.series;
  const reveal = cfg.reveal !== false;                       // lines draw progressively with pos
  const m = { t: 52, r: 118, b: 36, l: 48 };
  const st = Object.fromEntries(S.map(s => [s.id, { a: 1, t: 0 }]));   // a = opacity, t = label colour
  let focus = null, marks = [], hoverX = null, keyHi = null, posX = reveal ? X.min : X.max;
  const fmtX = v => (X.lastLabel && v >= X.max ? X.lastLabel : (X.format || "{v}").replace("{v}", Math.round(v)));
  const fmtY = v => `${(+v).toFixed(Y.decimals ?? 1)}${Y.unit || ""}`;
  const xs = v => m.l + (v - X.min) / (X.max - X.min) * (W - m.l - m.r);
  const ys = v => H - m.b - (v - Y.min) / (Y.max - Y.min) * (H - m.t - m.b);
  const valueAt = (s, x) => {
    const p = s.points; if (x <= p[0][0]) return p[0][1];
    for (let i = 1; i < p.length; i++) if (x <= p[i][0]) { const [x0, y0] = p[i - 1], [x1, y1] = p[i]; return y0 + (y1 - y0) * (x - x0) / (x1 - x0); }
    return p.at(-1)[1];
  };
  function resize() { ({ ctx, W, H } = fitCanvas(canvas)); }
  resize();

  canvas.addEventListener("mousemove", e => {
    if (api.mode !== "explore") return;
    const r = canvas.getBoundingClientRect(), x = X.min + (e.clientX - r.left - m.l) / (W - m.l - m.r) * (X.max - X.min);
    if (x < X.min || x > Math.min(X.max, posX)) { hoverX = null; api.resetDetail(); return; }
    hoverX = Math.round(x);
    const rows = S.map(s => ({ s, v: valueAt(s, hoverX) })).sort((a, b) => b.v - a.v)
      .map(({ s, v }) => `<div class="drow"><span><span class="sw" style="background:${s.color}"></span>${s.label}</span><b>${fmtY(v)}</b></div>`).join("");
    api.detail({ kicker: X.label, title: fmtX(hoverX), body: rows });
  });
  canvas.addEventListener("mouseleave", () => { hoverX = null; api.resetDetail(); });

  function frame(dt, now) {
    S.forEach(s => {
      const on = keyHi ? s.id === keyHi : (!focus || focus.includes(s.id));
      st[s.id].a = approach(st[s.id].a, on ? 1 : 0.15, dt, 350);
      st[s.id].t = approach(st[s.id].t, focus && focus.includes(s.id) ? 1 : 0, dt, 250);
    });
    marks.forEach(mk => (mk.a = approach(mk.a, mk.tgt, dt, 300)));
    marks = marks.filter(mk => mk.tgt || mk.a > 0.01);
    draw(now);
  }
  function draw(now) {
    ctx.clearRect(0, 0, W, H);
    ctx.font = `600 18px ${api.font}`; ctx.fillStyle = api.ink; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    if (data.title) ctx.fillText(data.title, m.l - 36, 26);
    // grid + axes
    ctx.font = `12px ${api.font}`; ctx.fillStyle = api.faint; ctx.strokeStyle = "rgba(0,0,0,.08)"; ctx.lineWidth = 1;
    const yStep = Y.tickEvery || niceStep(Y.max - Y.min, 5);
    for (let v = Y.min; v <= Y.max + 1e-9; v += yStep) {
      const y = ys(v); ctx.beginPath(); ctx.moveTo(m.l, y); ctx.lineTo(W - m.r, y); ctx.stroke();
      ctx.textAlign = "right"; ctx.textBaseline = "middle"; ctx.fillText(`${+v.toFixed(2)}${Y.unit || ""}`, m.l - 8, y);
    }
    const xStep = X.tickEvery || niceStep(X.max - X.min, 10);
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    for (let v = Math.ceil(X.min / xStep) * xStep; v <= X.max + 1e-9; v += xStep) ctx.fillText(fmtX(v), xs(v), H - m.b + 8);
    if (X.label) { ctx.textAlign = "right"; ctx.fillText(X.label, W - m.r, H - 16); }
    // lines, drawn up to posX
    const upto = Math.min(X.max, posX);
    S.forEach(s => {
      ctx.save(); ctx.globalAlpha = st[s.id].a; ctx.strokeStyle = s.color; ctx.lineWidth = s.emphasis ? 3 : 2; ctx.lineJoin = ctx.lineCap = "round";
      ctx.beginPath(); let started = false;
      for (const [x, y] of s.points) { if (x > upto) break; started ? ctx.lineTo(xs(x), ys(y)) : (ctx.moveTo(xs(x), ys(y)), (started = true)); }
      if (upto < X.max) ctx.lineTo(xs(upto), ys(valueAt(s, upto)));
      ctx.stroke(); ctx.restore();
    });
    // end labels (nudged apart), crossfading to the series colour when narrated
    const ends = S.map(s => ({ s, y: ys(valueAt(s, upto)) })).sort((a, b) => a.y - b.y);
    ends.forEach((e, i) => { if (i && e.y - ends[i - 1].y < 14) e.y = ends[i - 1].y + 14; });
    ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ends.forEach(e => {
      ctx.save(); ctx.globalAlpha = Math.max(0.25, st[e.s.id].a);
      ctx.font = `${e.s.emphasis ? 700 : 500} 12px ${api.font}`;
      crossText(ctx, e.s.label, xs(upto) + 8, e.y, api.ink, e.s.color, st[e.s.id].t);
      ctx.restore();
    });
    // narrated marks: dot + soft pulse + label held clear of the rings
    marks.forEach(mk => {
      const s = S.find(z => z.id === mk.series); if (!s) return;
      const x = xs(mk.x), y = ys(valueAt(s, mk.x)), period = 2000;
      for (let k = 0; k < 2; k++) { const ph = ((now + k * period / 2) % period) / period; ring(ctx, x, y, 6, ph * 9, mk.a * 0.45 * (1 - ph)); }
      ctx.save(); ctx.globalAlpha = mk.a; ctx.fillStyle = s.color; ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.font = `600 13px ${api.font}`; ctx.fillStyle = api.ink; ctx.textBaseline = "alphabetic";
      ctx.textAlign = mk.x > X.max - (X.max - X.min) * 0.12 ? "right" : "center";
      const tpl = cfg.markLabel || "{y} at {x}";
      ctx.fillText(mk.label || tpl.replace("{y}", (+valueAt(s, mk.x)).toFixed(Y.decimals ?? 1)).replace("{x}", fmtX(mk.x)), x, y - 24); ctx.restore();
    });
    // explore hover crosshair
    if (hoverX != null) {
      const x = xs(hoverX); ctx.save(); ctx.strokeStyle = api.faint; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(x, m.t); ctx.lineTo(x, H - m.b); ctx.stroke(); ctx.setLineDash([]);
      S.forEach(s => { ctx.fillStyle = s.color; ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, ys(valueAt(s, hoverX)), 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); });
      ctx.restore();
    }
  }

  const span = X.max - X.min;
  return {
    pos: reveal ? {
      min: X.min, max: X.max, start: X.min, loop: false,
      format: v => fmtX(v),
      speeds: cfg.speeds || [{ label: "Slow", value: span / 40 }, { label: "Medium", value: span / 16 }, { label: "Fast", value: span / 6 }],
      defaultSpeed: cfg.defaultSpeed ?? span / 16,
      ticks: d3.range(X.min, X.max + 1e-9, X.tickEvery || niceStep(span, 10)).map((v, i) => ({ v, label: fmtX(v), major: true })),
    } : null,
    cueDefaults: { focus: null, marks: null },
    setPos(p) { if (reveal) posX = p; },
    apply(c) {
      if ("focus" in c) focus = c.focus?.series || null;
      if ("marks" in c) {
        const want = (c.marks || []).map(mk => ({ ...mk, k: `${mk.series}@${mk.x}` }));
        marks.forEach(mk => { if (!want.find(w => w.k === mk.k)) mk.tgt = 0; });
        want.forEach(w => { const ex = marks.find(mk => mk.k === w.k); ex ? (ex.tgt = 1) : marks.push({ ...w, a: 0, tgt: 1 }); });
      }
    },
    clear() { focus = null; marks.forEach(mk => (mk.tgt = 0)); },
    frame, resize,
    legend: () => S.map(s => ({ id: s.id, label: s.label, color: s.color, desc: s.desc || "" })),
    hoverKey(id) { keyHi = id; },
    color: id => S.find(s => s.id === id)?.color,
    showAll() { posX = X.max; },
  };
}

function niceStep(range, target) {
  const raw = range / target, p = 10 ** Math.floor(Math.log10(raw)), n = raw / p;
  return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * p;
}
