// Narrated data lesson player. Chart-agnostic: it builds the lesson shell (side panel,
// Video/Explore tabs, chapters, captions, player bar, end card), runs the storyboard
// (cues pinned to spoken words), plays narration + music, and drives Explore.
// A chart type is an ES module in charts/<type>/chart.js (interface: see
// references/chart-interface.md). Rules: references/design-rules.md.
//
// Usage (a lesson's index.html):
//   <link rel="stylesheet" href="ASSETS/engine/lesson.css">
//   <script src="https://cdnjs.cloudflare.com/ajax/libs/d3/7.9.0/d3.min.js"></script>
//   <script type="module">import { runLesson } from "ASSETS/engine/player.js"; runLesson("lesson.json", "ASSETS");</script>

const $ = id => document.getElementById(id);
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const fmtSec = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const ICON_PLAY = '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="7,4 20,12 7,20"/></svg>';
const ICON_PAUSE = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>';
const ENGINE_KEYS = new Set(["view", "pos", "clock", "nudge", "clockCallout", "spinClock"]);

function shell(lesson) {
  return `
<div class="tw">
  <aside class="tw-side">
    <div class="tw-phead">
      <div class="tw-kicker">${lesson.kicker || ""}</div>
      <h1 class="tw-title">${lesson.title}</h1>
      <div class="tw-modes" role="tablist" aria-label="Mode">
        <button class="tw-mode on" role="tab" data-mode="video">Video</button>
        <button class="tw-mode" role="tab" data-mode="explore">Explore</button>
      </div>
    </div>
    <div class="tw-body">
      <section id="side-video"><div class="tw-label">Chapters</div><div class="tw-chapters" id="chapters"></div></section>
      <section id="side-explore" hidden>
        <div class="tw-label" id="key-label">${lesson.keyLabel || "Key"}</div>
        <div class="dv-keys" id="keys"></div>
        <details class="dv-about"><summary class="tw-label">About the data</summary><ul class="dv-notes" id="notes"></ul></details>
      </section>
    </div>
    <div class="tw-detail" id="detail" aria-live="polite" hidden>
      <div class="tw-kicker" id="d-kick"></div><div class="tw-dname" id="d-name"></div><div id="d-body"></div>
      <div class="tw-dhint" id="d-hint"></div>
    </div>
  </aside>
  <main class="tw-stage in-video" id="stage">
    <div class="tw-grain"></div>
    ${lesson.badge ? `<div class="tw-badge">${lesson.badge}</div>` : ""}
    <div class="dv-top" id="top">
      <div class="dv-clock" id="clock"></div>
      <div class="dv-speed" id="speed" role="group" aria-label="Playback speed" hidden></div>
    </div>
    <div class="dv-area" id="area"><div class="dv-mount" id="mount"></div></div>
    <div class="tw-dock" id="dock" hidden>
      <div class="tw-actions" id="views"></div>
      <div class="tw-slider" id="timeSlider">
        <div class="dv-timebar"><div class="dv-scale" id="scale" aria-hidden="true"></div>
          <input type="range" class="tw-range" id="scrub" min="0" max="1000" value="0" aria-label="Position"></div>
      </div>
    </div>
    <div class="tw-player fresh" id="player">
      <div class="tw-vprompt">Press play to watch the <span id="vlen"></span> walkthrough</div>
      <div class="tw-vcap" id="vcap"></div>
      <div class="tw-vbar">
        <button class="tw-vbtn" id="vplay" aria-label="Play video"></button>
        <div class="tw-vtrack"><input type="range" class="tw-range" id="vscrub" min="0" max="1000" value="0" aria-label="Video position"><div class="tw-vticks" id="vticks" aria-hidden="true"></div></div>
        <span class="tw-vtime" id="vtime">0:00</span>
      </div>
    </div>
    <div class="dv-scrim" id="scrim" hidden></div>
    <div class="tw-endcard" id="endcard" role="dialog" aria-labelledby="end-title" hidden>
      <h2 id="end-title">${lesson.endCard?.title || "Your turn"}</h2>
      <p>${lesson.endCard?.text || "Explore the data yourself."}</p>
      <div class="tw-btns"><button class="tw-btn" id="end-explore">Explore</button></div>
      <button class="tw-replay" id="end-replay">Watch again</button>
    </div>
  </main>
</div>`;
}

export async function runLesson(lessonUrl, assetsBase) {
  const nc = { cache: "no-cache" };
  const lesson = await fetch(lessonUrl, nc).then(r => r.json());
  document.title = lesson.title;
  document.body.insertAdjacentHTML("afterbegin", shell(lesson));
  const [data, story, mod] = await Promise.all([
    fetch(lesson.data, nc).then(r => r.json()),
    fetch(lesson.storyboard, nc).then(r => r.json()),
    import(new URL(`${assetsBase}/charts/${lesson.chart}/chart.js`, document.baseURI).href),
  ]);
  if (mod.styles) document.head.insertAdjacentHTML("beforeend", `<style>${mod.styles}</style>`);

  // ── detail box (bottom of the side panel) ──
  const idle = lesson.detailIdle || { kicker: "", title: "Hover over the chart", body: "Hover over anything on the chart to see the details." };
  const api = {
    css, font: css("--tw-font"), ink: css("--tw-ink"), muted: css("--tw-muted"), faint: css("--tw-faint"),
    detail({ kicker = "", title = "", color = "", body = "" }) {
      $("d-kick").textContent = kicker; $("d-name").textContent = title; $("d-name").style.color = color || "";
      $("detail").style.borderLeftColor = color || ""; $("d-body").innerHTML = body;
    },
    resetDetail() { api.detail({ kicker: idle.kicker, title: idle.title, body: `<p class="tw-ddesc">${idle.body}</p>` }); },
    get mode() { return mode; },
  };
  $("d-hint").textContent = lesson.detailHint || "";
  api.resetDetail();

  const chart = await mod.createChart({ mount: $("mount"), data, lesson, api });
  const P = chart.pos;                                   // null when the chart has no time axis
  if (!P) { $("top").hidden = true; $("timeSlider").hidden = true; }

  // ── side panel: key + notes ──
  const legend = chart.legend ? chart.legend() : [];
  $("keys").innerHTML = legend.map(k => `<button class="dv-key" data-id="${k.id}"><span class="tw-dot" style="--hue:${k.color}"></span>${k.label}</button>`).join("");
  document.querySelectorAll(".dv-key").forEach(el => {
    const k = legend.find(x => x.id === el.dataset.id);
    const show = () => { document.querySelectorAll(".dv-key").forEach(x => x.classList.toggle("on", x === el)); api.detail({ kicker: lesson.keyLabel || "Key", title: k.label, color: k.titleColor || k.color, body: `<p class="tw-ddesc">${k.desc || ""}</p>` }); chart.hoverKey?.(k.id); };
    const hide = () => { el.classList.remove("on"); api.resetDetail(); chart.hoverKey?.(null); };
    el.addEventListener("mouseenter", show); el.addEventListener("focus", show);
    el.addEventListener("mouseleave", hide); el.addEventListener("blur", hide);
  });
  (lesson.notes || []).forEach(t => $("notes").insertAdjacentHTML("beforeend", `<li>${t}</li>`));
  (lesson.sources || []).forEach(s => $("notes").insertAdjacentHTML("beforeend", `<li>Source: <a href="${s.url}" target="_blank" rel="noopener">${s.label}</a></li>`));

  // ── views (e.g. "Simulation" / "Hours by age") ──
  let view = chart.views?.[0]?.id || null;
  function setView(v) {
    if (!chart.views || !v) return;
    view = v; chart.setView(v);
    document.querySelectorAll(".tw-action[data-view]").forEach(b => b.classList.toggle("on", b.dataset.view === v));
    const timed = chart.views.find(x => x.id === v)?.usesPos !== false;
    if (P) { $("top").style.visibility = timed ? "visible" : "hidden"; $("timeSlider").style.visibility = timed ? "visible" : "hidden"; }
  }
  if (chart.views && chart.views.length > 1) {
    $("views").innerHTML = chart.views.map(v => `<button class="tw-action" data-view="${v.id}">${v.icon || ""}${v.label}</button>`).join("");
    document.querySelectorAll(".tw-action[data-view]").forEach(b => (b.onclick = () => setView(b.dataset.view)));
  }

  // ── position (time axis) ──
  let pos = P ? (P.start ?? P.min) : 0, speed = P ? (P.defaultSpeed ?? P.speeds?.[1]?.value ?? 1) : 0;
  const span = P ? P.max - P.min : 1;
  if (P) {
    $("speed").innerHTML = [{ label: "Pause", value: 0 }, ...(P.speeds || [])].map(s => `<button data-s="${s.value}"${s.value === speed ? ' class="on"' : ""}>${s.label}</button>`).join("");
    document.querySelectorAll("#speed button").forEach(b => (b.onclick = () => { speed = +b.dataset.s; document.querySelectorAll("#speed button").forEach(x => x.classList.toggle("on", x === b)); }));
    $("scale").innerHTML = (P.ticks || []).map(t => { const x = `${(t.v - P.min) / span * 100}%`; return `<i class="${t.major ? "major" : ""}" style="left:${x}"></i>` + (t.label ? `<span data-v="${t.v}" style="left:${x}">${t.label}</span>` : ""); }).join("");
    $("scrub").oninput = e => { pos = P.min + (+e.target.value / 1000) * span; chart.setPos(pos, { jump: true }); };
  }
  const scaleLabels = [...document.querySelectorAll("#scale span")];
  let lastNow = null;
  function markScale(p) {
    if (!scaleLabels.length) return;
    const near = scaleLabels.reduce((b, el) => (Math.abs(+el.dataset.v - p) < Math.abs(+b.dataset.v - p) ? el : b));
    const step = span / Math.max(1, scaleLabels.length);
    const pick = Math.abs(+near.dataset.v - p) <= step / 2 ? near : null;
    if (pick !== lastNow) { lastNow?.classList.remove("now"); pick?.classList.add("now"); lastNow = pick; }
  }

  // ── modes ──
  let mode = "video";
  function setMode(m) {
    const from = mode; mode = m;
    document.querySelectorAll(".tw-mode").forEach(b => { b.classList.toggle("on", b.dataset.mode === m); if (b.dataset.mode === m) b.classList.remove("nudge"); });
    $("side-video").hidden = m !== "video"; $("side-explore").hidden = m !== "explore"; $("detail").hidden = m !== "explore";
    $("player").hidden = m !== "video"; $("dock").hidden = m === "video"; $("speed").hidden = m === "video" || !P;
    $("stage").classList.toggle("in-video", m === "video");
    $("endcard").hidden = true; $("scrim").hidden = true;
    setTimeout(() => chart.resize?.(), 320);
    if (m !== "video") {
      audio.pause(); music.pause(); musicTail = null; vPlaying = false; syncPlayBtn(); chart.clear?.();
      if (m === "explore" && from === "video" && P) {     // Explore starts the day/timeline over
        pos = lesson.explore?.startPos ?? P.min; chart.setPos(pos, { jump: true, snap: true });
        if (!speed) speed = P.defaultSpeed ?? 1;
        document.querySelectorAll("#speed button").forEach(x => x.classList.toggle("on", +x.dataset.s === speed));
      }
      if (m === "explore" && lesson.explore?.view) setView(lesson.explore.view);
    } else seek(audio.currentTime || 0);
  }
  document.querySelectorAll(".tw-mode").forEach(b => (b.onclick = () => setMode(b.dataset.mode)));

  // ── narration + music (loaded as blobs so seeking works on any host) ──
  const scenes = story.scenes, TOTAL = story.duration;
  const audio = new Audio(); audio.preload = "auto";
  let virtualT = 0, virtStart = 0, hasAudio = !!lesson.narration;   // silent preview clock = real elapsed time
  if (hasAudio) fetch(lesson.narration, nc).then(r => (r.ok ? r.blob() : Promise.reject())).then(b => { audio.src = URL.createObjectURL(b); }).catch(() => { hasAudio = false; });
  const MUSIC_VOL = lesson.musicVolume ?? 0.045, MUSIC_IN = 1.5, MUSIC_HOLD = 1.5, MUSIC_FADE = 4;
  const music = new Audio(); music.loop = true; music.volume = 0; music.preload = "auto";
  if (lesson.music) fetch(lesson.music, nc).then(r => r.blob()).then(b => { music.src = URL.createObjectURL(b); }).catch(() => {});
  let musicTail = null;
  const syncMusic = t => { if (music.duration) music.currentTime = t % music.duration; };
  function stepMusic(now) {
    if (!lesson.music) return;
    if (musicTail != null) {
      const s = (now - musicTail) / 1000, u = Math.max(0, Math.min(1, (s - MUSIC_HOLD) / MUSIC_FADE));
      music.volume = MUSIC_VOL * (1 - u * u * (3 - 2 * u));
      if (u >= 1) { music.pause(); musicTail = null; }
    } else if (vPlaying) music.volume = MUSIC_VOL * Math.max(0, Math.min(1, vt() / MUSIC_IN));
  }

  let vPlaying = false, sceneI = -1, beatI = -1, ended = false, endAt = 0;
  const vt = () => { if (!hasAudio && vPlaying) virtualT = (performance.now() - virtStart) / 1000; return Math.min(hasAudio ? audio.currentTime : virtualT, TOTAL); };
  const narrationOver = () => (hasAudio ? audio.ended : virtualT >= TOTAL - 1.5);
  $("vlen").textContent = fmtSec(TOTAL);
  $("vticks").innerHTML = scenes.slice(1).map(s => `<i style="left:${s.start / TOTAL * 100}%"></i>`).join("");
  $("chapters").innerHTML = scenes.map((s, i) => `<button class="tw-chap" data-i="${i}"><span class="tw-chap-dot"></span><span class="tw-chap-body"><span class="tw-chap-title">${s.title}</span><span class="tw-chap-time">${fmtSec(s.start)}</span></span></button>`).join("");
  document.querySelectorAll(".tw-chap").forEach(b => (b.onclick = () => { const t = scenes[+b.dataset.i].start + 0.01; setTime(t); seek(t); play(); }));
  const termHue = {};
  Object.entries(story.terms || {}).forEach(([id, phrases]) => phrases.forEach(p => (termHue[p] = chart.color?.(id) || lesson.termColors?.[id] || css("--tw-accent"))));
  const norm = w => w.toLowerCase().replace(/[^a-z\-']/g, "");
  function setTime(t) { if (hasAudio) audio.currentTime = Math.min(t, audio.duration || t); else { virtualT = t; virtStart = performance.now() - t * 1000; } }
  function syncPlayBtn() { $("vplay").innerHTML = vPlaying ? ICON_PAUSE : ICON_PLAY; $("vplay").setAttribute("aria-label", vPlaying ? "Pause video" : "Play video"); }
  function play() {
    if (ended) { ended = false; setTime(0); seek(0); }
    $("player").classList.remove("fresh"); $("endcard").hidden = true; $("scrim").hidden = true;
    if (!$("vcap").innerHTML) renderCaption(sceneI);
    if (!hasAudio) virtStart = performance.now() - virtualT * 1000;
    vPlaying = true; syncPlayBtn();
    if (hasAudio && audio.currentTime < (audio.duration || Infinity) - 0.05) audio.play().catch(() => {});
    if (lesson.music) { musicTail = null; syncMusic(vt()); music.play().catch(() => {}); }
  }
  function pause() { vt(); vPlaying = false; audio.pause(); if (musicTail == null) music.pause(); syncPlayBtn(); }
  $("vplay").onclick = () => (vPlaying ? pause() : play());
  $("vscrub").oninput = e => { const t = e.target.value / 1000 * TOTAL; setTime(t); seek(t); $("player").classList.remove("fresh"); };
  syncPlayBtn();

  // position keyframes ("pos" or legacy "clock" cues): a pure function of video time
  const KEYS = [];
  scenes.forEach(s => {
    const k = c => c.pos ?? c.clock;
    if (k(s.cue) != null) KEYS.push({ t: s.start, m: k(s.cue) });
    s.beats.forEach(b => { if (k(b.cue) != null) KEYS.push({ t: b.t, m: k(b.cue) }); });
  });
  KEYS.sort((a, b) => a.t - b.t);
  const FAST = span / 48;                                     // faster than this = a "jump ahead"
  function posAt(t) {
    if (!KEYS.length) return P ? (P.start ?? P.min) : 0;
    if (t <= KEYS[0].t) return KEYS[0].m;
    for (let i = 1; i < KEYS.length; i++) {
      const a = KEYS[i - 1], b = KEYS[i];
      if (t <= b.t) {
        let u = b.t > a.t ? (t - a.t) / (b.t - a.t) : 1;
        if (Math.abs(b.m - a.m) / Math.max(b.t - a.t, 0.01) > FAST) u = u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2;
        return a.m + (b.m - a.m) * u;
      }
    }
    return KEYS.at(-1).m;
  }
  function settledAt(t) {          // during a fast jump the data holds, then moves once (charts that opt in)
    if (!P || !P.holdOnJumps) return posAt(t);
    for (let i = 1; i < KEYS.length; i++) {
      const a = KEYS[i - 1], b = KEYS[i];
      if (t > a.t && t < b.t && Math.abs(b.m - a.m) / Math.max(b.t - a.t, 0.01) > FAST) return a.m;
    }
    return posAt(t);
  }

  // engine-level effects
  const fx = { spin: null };
  const SPIN_MS = 1500;
  function applyCue(c, natural) {
    if ("view" in c) setView(c.view);
    if (c.nudge && natural) { const b = document.querySelector(`.tw-mode[data-mode="${c.nudge}"]`); if (b) { b.classList.remove("nudge"); void b.offsetWidth; b.classList.add("nudge"); } }
    if (c.clockCallout && natural) { const el = $("clock"); el.classList.remove("attn"); void el.offsetWidth; el.classList.add("attn"); setTimeout(() => el.classList.remove("attn"), 2400); }
    if (c.spinClock && natural) fx.spin = performance.now();
    const own = {}; Object.keys(c).forEach(k => { if (!ENGINE_KEYS.has(k)) own[k] = c[k]; });
    chart.apply?.(own, { natural });
  }
  function renderCaption(i) {
    const cap = $("vcap");
    if (i < 0) { cap.innerHTML = ""; return; }
    const words = scenes[i].words, hue = new Array(words.length).fill(null);
    Object.entries(termHue).forEach(([phrase, c]) => {
      const p = phrase.split(" ");
      for (let k = 0; k + p.length <= words.length; k++)
        if (p.every((w, j) => norm(words[k + j].w).replace(/'s$/, "") === w)) for (let j = 0; j < p.length; j++) hue[k + j] = c;
    });
    cap.innerHTML = words.map((w, k) => `<span data-t="${w.t}"${hue[k] ? ` class="term" style="--hue:${hue[k]}"` : ""}>${w.w}</span>`).join(" ");
    cap.classList.remove("enter"); void cap.offsetWidth; cap.classList.add("enter");
  }
  const sceneAt = t => { let i = 0; scenes.forEach((s, k) => { if (s.start <= t) i = k; }); return i; };
  function seek(t) {
    musicTail = null; syncMusic(t); if (!vPlaying) music.pause();
    const si = sceneAt(t);
    const merged = { ...(chart.cueDefaults || {}) };
    let carriedView = chart.views?.[0]?.id;
    scenes.forEach((s, i) => {
      if (i > si) return;
      const cues = [s.cue, ...s.beats.filter(b => i < si || b.t <= t).map(b => b.cue)];
      cues.forEach(c => { if ("view" in c) carriedView = c.view; if (i === si) Object.assign(merged, c); });
    });
    delete merged.pos; delete merged.clock; delete merged.nudge; delete merged.clockCallout; delete merged.spinClock;
    if (carriedView) merged.view = carriedView;
    if (P) { pos = settledAt(t); chart.setPos(pos, { jump: true, display: posAt(t) }); }
    fx.spin = null; $("clock").classList.remove("spinning");
    applyCue(merged, false);
    sceneI = si; beatI = scenes[si].beats.filter(b => b.t <= t).length - 1;
    ended = false; $("endcard").hidden = true; $("scrim").hidden = true;
    renderCaption(t > 0 || vPlaying ? si : -1);
    document.querySelectorAll(".tw-chap").forEach((b, i) => { b.classList.toggle("on", i === sceneI); b.classList.toggle("seen", i < sceneI); });
  }
  function tickVideo(dt) {
    const t = vt();
    if (vPlaying && narrationOver() && !ended) {
      if (!endAt) { endAt = performance.now(); if (lesson.music && musicTail == null) musicTail = endAt; }
      if (performance.now() - endAt > 1500) { ended = true; pause(); $("endcard").hidden = false; $("scrim").hidden = false; endAt = 0; }
    }
    const si = sceneAt(t);
    if (si !== sceneI) {
      if (si === sceneI + 1) {
        sceneI = si; beatI = -1; applyCue(scenes[si].cue, true); renderCaption(si);
        document.querySelectorAll(".tw-chap").forEach((b, i) => { b.classList.toggle("on", i === sceneI); b.classList.toggle("seen", i < sceneI); });
      } else seek(t);
    }
    const sc = scenes[sceneI];
    while (beatI + 1 < sc.beats.length && sc.beats[beatI + 1].t <= t) { beatI++; applyCue(sc.beats[beatI].cue, true); }
    document.querySelectorAll("#vcap span").forEach(s => s.classList.toggle("said", +s.dataset.t <= t + 0.02));
    $("vscrub").value = t / TOTAL * 1000; $("vscrub").style.setProperty("--fill", (t / TOTAL * 100) + "%");
    $("vtime").textContent = `${fmtSec(t)} / ${fmtSec(TOTAL)}`;
  }
  $("end-explore").onclick = () => setMode("explore");
  $("end-replay").onclick = () => { setTime(0); seek(0); play(); };

  // ── main loop ──
  let last = performance.now(), display = pos;
  function frame(now) {
    const dt = Math.min(now - last, 100); last = now;
    if (mode === "video") {
      tickVideo(dt);
      if (P) {
        const t = vt(), target = settledAt(t);
        display = posAt(t);
        if (fx.spin != null) {
          const u = (now - fx.spin) / SPIN_MS;
          if (u < 1) { const e = u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2; display = P.min + (e * span) % span; $("clock").classList.add("spinning"); }
          else { fx.spin = null; $("clock").classList.remove("spinning"); }
        }
        if (target !== pos) { chart.setPos(target, { jump: target < pos - span / 2880 }); pos = target; }
      }
    } else if (P && speed && (chart.views?.find(v => v.id === view)?.usesPos !== false)) {
      pos += speed * dt / 1000;
      if (pos >= P.max) { pos = P.loop === false ? P.max : P.min; chart.setPos(pos, { jump: true }); if (P.loop === false) speed = 0; }
      else chart.setPos(pos, {});
      display = pos;
    } else display = pos;
    if (P && mode !== "video") { $("scrub").value = (pos - P.min) / span * 1000; $("scrub").style.setProperty("--fill", ((pos - P.min) / span * 100) + "%"); markScale(pos); }
    stepMusic(now);
    chart.frame(dt, now);
    if (P) $("clock").textContent = P.format(display);
    requestAnimationFrame(frame);
  }
  window.addEventListener("resize", () => chart.resize?.());
  if (chart.views) setView(view);
  seek(0);
  requestAnimationFrame(frame);
  return { chart, lesson };
}
