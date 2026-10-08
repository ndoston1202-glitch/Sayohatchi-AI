// Sayohatchi AI — Smart Tourism Review AI MVP
// 3 rol: Mijoz (sayohatchi), Tashkilot (maskan egasi), Dasturchi (analitika va AI sifati)
(function () {
  const KEY = "sayohatchi_v2";
  const $ = s => document.querySelector(s);
  const $$ = s => document.querySelectorAll(s);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const som = n => Math.round(n).toLocaleString("ru-RU").replace(/,/g, " ") + " so'm";
  const uid = p => (p || "") + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const PLATFORM = /[?&]app=1/.test(location.search) || /; wv\)/.test(navigator.userAgent) ? "app" : "web";
  const API = (window.SAYOHATCHI_API || "").replace(/\/$/, "");
  const APP_VERSION = "2.2.0";
  // Ilova ichidagi "Nima yangi" — oflayn ham ko'rinadi
  const CHANGELOG = [
    { v: "2.2.0", notes: ["🗺 O'zbekiston xaritasi: viloyatni bosing — undagi maskanlar chiqadi", "Maskanni bosing — «Batafsil» tugmasi", "Xarita internetsiz ham ishlaydi", "Barcha qurilmalarga moslashuvchan dizayn"] },
    { v: "2.1.0", notes: ["4 xil hisob: Sayohatchi, Tashkilot, Analitik va Admin", "Admin paneli: bloklash, rol berish, tashkilotlarni tasdiqlash", "🔔 Qo'ng'iroqcha: bildirishnomalar va yangilanishlar"] },
    { v: "2.0.0", notes: ["Yashil tabiat dizayni va animatsiyalar", "Xarita", "Byudjet bo'yicha AI sayohat rejasi", "Analitika va AI sifati monitoringi"] }
  ];
  const ROLE_NAMES = { client: "Sayohatchi", org: "Tashkilot", analyst: "Analitik", admin: "Admin", guest: "Mehmon" };
  const OFFLINE_CODES = { analyst: "analitik2026", admin: "admin2026" }; // faqat oflayn demo; serverda ANALYST_CODE / ADMIN_CODE

  // ---------- Holat ----------
  function seed() {
    let id = 1;
    return {
      resorts: DEMO_RESORTS.map(r => Object.assign({ trust: null, createdAt: "2026-01-01" }, r)),
      reviews: DEMO_REVIEWS.map(([resortId, author, rating, text, date]) => ({ id: id++, resortId, author, rating, text, date, source: "demo", hidden: false })),
      orgs: [], visits: [], users: [], analyses: {}, jobs: [], saved: [], user: null, token: null,
      events: [], aiLogs: [], outbox: { events: [], aiLogs: [] }, visitor: uid("v"), profile: {}
    };
  }
  let S;
  try { S = JSON.parse(localStorage.getItem(KEY)) || seed(); } catch (e) { S = seed(); }
  ["orgs", "visits", "users", "events", "aiLogs", "saved", "jobs"].forEach(k => S[k] = S[k] || []);
  S.outbox = S.outbox || { events: [], aiLogs: [] }; S.profile = S.profile || {}; S.visitor = S.visitor || uid("v"); S.analyses = S.analyses || {};
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { S.events = S.events.slice(-500); try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e2) {} } };
  let online = false; // backend mavjudmi

  const resort = id => S.resorts.find(r => String(r.id) === String(id));
  const reviewsOf = id => S.reviews.filter(r => String(r.resortId) === String(id) && !r.hidden);
  const role = () => S.user ? S.user.role : "guest";
  const myOrg = () => S.user && S.orgs.find(o => o.owner === S.user.id);

  function toast(m) { const t = $("#toast"); t.textContent = m; t.classList.add("on"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("on"), 2400); }
  const color = v => v == null ? "#9fb3a6" : v >= 75 ? "#16a34a" : v >= 55 ? "#d99a00" : "#dc4a3d";
  const cls = v => v == null ? "n" : v >= 75 ? "g" : v >= 55 ? "y" : "r";

  // ---------- Backend bilan aloqa ----------
  async function api(path, opts) {
    opts = opts || {};
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), opts.timeout || 6000);
    try {
      const res = await fetch(API + path, { method: opts.method || "GET", signal: ctl.signal,
        headers: Object.assign({ "Content-Type": "application/json" }, S.token ? { Authorization: "Bearer " + S.token } : {}),
        body: opts.body ? JSON.stringify(opts.body) : undefined });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || ("Xatolik " + res.status));
      return data;
    } finally { clearTimeout(t); }
  }
  const stripDoc = (col, d) => col === "resorts" ? Object.assign({}, d, { trust: undefined }) : d;
  // Hujjatni saqlash: lokal + (onlayn bo'lsa) serverga
  function persist(col, doc) {
    const list = S[col]; const i = list.findIndex(x => String(x.id) === String(doc.id));
    i >= 0 ? list[i] = doc : list.push(doc); save();
    if (online) api(`/api/v1/docs/${col}/${encodeURIComponent(doc.id)}`, { method: "PUT", body: stripDoc(col, doc) }).catch(e => toast("Server: " + e.message));
  }
  function removeDoc(col, id) {
    S[col] = S[col].filter(x => String(x.id) !== String(id)); save();
    if (online) api(`/api/v1/docs/${col}/${encodeURIComponent(id)}`, { method: "DELETE" }).catch(e => toast("Server: " + e.message));
  }
  async function syncFromServer() {
    try {
      let st = await api("/api/v1/state", { timeout: 4000 });
      if (!st.resorts.length) {
        const sd = seed();
        await api("/api/v1/seed", { method: "POST", body: { resorts: sd.resorts.map(r => stripDoc("resorts", r)), reviews: sd.reviews } });
        st = await api("/api/v1/state");
      }
      online = true;
      ["resorts", "reviews", "orgs", "visits"].forEach(k => S[k] = st[k]);
      S.analyses = {}; S.resorts.forEach(r => analysis(r.id)); save(); render(); flush();
    } catch (e) { online = false; }
  }

  // ---------- Analitika ----------
  const SESSION = (() => { try { let s = sessionStorage.getItem("sy_s"); if (!s) { s = uid("s"); sessionStorage.setItem("sy_s", s); } return s; } catch (e) { return uid("s"); } })();
  function track(type, page, meta) {
    const e = { ts: Date.now(), visitor: S.visitor, user: S.user ? S.user.id : "", userName: S.user ? S.user.name : "",
      role: role(), platform: PLATFORM, type, page: page || "", meta: Object.assign({ session: SESSION, name: S.user ? S.user.name : "" }, meta || {}) };
    S.events.push(e); if (S.events.length > 3000) S.events = S.events.slice(-3000);
    S.outbox.events.push(e); if (S.outbox.events.length > 1000) S.outbox.events = S.outbox.events.slice(-1000);
    save();
  }
  function aiLog(kind, resortId, detail) {
    const l = Object.assign({ ts: Date.now(), kind, resortId: resortId == null ? "" : String(resortId), user: S.user ? S.user.id : "", platform: PLATFORM }, detail || {});
    S.aiLogs.push(l); if (S.aiLogs.length > 2000) S.aiLogs = S.aiLogs.slice(-2000);
    S.outbox.aiLogs.push(l); save();
  }
  let flushing = null; // bir vaqtda faqat bitta yuborish — aks holda bir xil hodisa ikki marta ketadi
  function flush() { if (!flushing) flushing = doFlush().finally(() => { flushing = null; }); return flushing; }
  async function doFlush() {
    if (!online || (!S.outbox.events.length && !S.outbox.aiLogs.length)) return;
    const batch = { events: S.outbox.events.slice(0, 200), aiLogs: S.outbox.aiLogs.slice(0, 100) };
    try { await api("/api/v1/events", { method: "POST", body: batch }); S.outbox.events.splice(0, batch.events.length); S.outbox.aiLogs.splice(0, batch.aiLogs.length); save(); } catch (e) {}
  }
  setInterval(flush, 15000);
  document.addEventListener("visibilitychange", () => document.hidden && flush());
  window.addEventListener("error", e => aiLog("jsError", null, { message: String(e.message).slice(0, 300), source: (e.filename || "").split("/").pop() + ":" + e.lineno }));

  // ---------- AI tahlil (job navbati) ----------
  function validate(a) {
    // Natijani tekshirish: diapazondan chiqqan yoki NaN qiymat — AI anomaliyasi
    const bad = Object.entries(a.metrics || {}).filter(([, v]) => v != null && (isNaN(v) || v < 0 || v > 100)).map(([k]) => k);
    if (a.overall != null && (isNaN(a.overall) || a.overall < 0 || a.overall > 100)) bad.push("overall");
    return bad;
  }
  function computeAnalysis(id) {
    const r = resort(id); const prev = S.analyses[id];
    const t0 = performance.now();
    const a = AI.analyzeResort(r, reviewsOf(id), prev ? prev.imageScore : null);
    a.ms = Math.round(performance.now() - t0);
    a.imageScore = prev ? prev.imageScore : null; a.imageResult = prev ? prev.imageResult : null;
    const bad = validate(a);
    if (bad.length) { aiLog("anomaly", id, { fields: bad }); a.overall = a.overall == null || isNaN(a.overall) ? null : Math.max(0, Math.min(100, a.overall)); }
    S.analyses[id] = a; r.trust = a.overall;
    return a;
  }
  function runAnalysis(id, cb) {
    const job = { id: uid("j"), resortId: id, status: "running", progress: 0, error: null, startedAt: new Date().toISOString(), finishedAt: null };
    S.jobs.unshift(job); S.jobs = S.jobs.slice(0, 40);
    const step = () => {
      job.progress += 20;
      if (job.progress < 100) { setTimeout(step, 110); cb && cb(job); return; }
      try {
        const a = computeAnalysis(id); job.status = "done";
        aiLog("run", id, { ms: a.ms, reviews: a.reviews.length, overall: a.overall });
      } catch (e) { job.status = "error"; job.error = String(e); aiLog("error", id, { message: String(e).slice(0, 300) }); }
      job.finishedAt = new Date().toISOString(); save(); cb && cb(job, true);
    };
    setTimeout(step, 110);
  }
  function analysis(id) {
    if (!S.analyses[id]) {
      try { computeAnalysis(id); } catch (e) {
        aiLog("error", id, { message: String(e).slice(0, 300) });
        S.analyses[id] = { reviews: [], metrics: {}, overall: null, problems: [], strengths: [], suspicious: 0, summary: "AI tahlilida xatolik yuz berdi. Dasturchilar xabardor qilindi.", confidence: 0 };
      }
      save();
    }
    return S.analyses[id];
  }
  S.resorts.forEach(r => analysis(r.id));

  // ---------- UI bloklari ----------
  function ring(v, size) {
    size = size || 84; const R = size / 2 - 7, C = 2 * Math.PI * R, p = v == null ? 0 : v / 100;
    return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${R}" fill="none" stroke="#e8f1ea" stroke-width="8"/>
      <circle class="arc" data-dash="${C * p} ${C}" cx="${size / 2}" cy="${size / 2}" r="${R}" fill="none" stroke="${color(v)}" stroke-width="8" stroke-linecap="round" stroke-dasharray="0 ${C}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
      <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" font-size="${size / 3.4}" font-weight="800" fill="#10241a" ${v == null ? "" : `data-count="${v}"`}>${v == null ? "—" : 0}</text></svg>`;
  }
  const METRICS = [["reliability", "Sharh ishonchliligi"], ["service", "Xizmat sifati"], ["cleanliness", "Tozalik"], ["staff", "Xodimlar"],
    ["food", "Ovqat"], ["price", "Narx/Sifat"], ["adMatch", "Reklama–real mosligi"]];
  const metricRow = (label, v, w) => `<div class="metric"><div class="row between"><span>${label} <span class="mut">${w ? w + "%" : ""}</span></span>
    <b style="color:${color(v)}">${v == null ? "Ma'lumot yetarli emas" : v}</b></div><div class="bar"><i data-w="${Math.min(100, v || 0)}" style="background:${color(v)}"></i></div></div>`;
  const countRow = (label, v, max) => `<div class="metric"><div class="row between"><span>${esc(label)}</span><b>${v}</b></div><div class="bar"><i data-w="${Math.round(v / Math.max(1, max) * 100)}" style="background:#16a34a"></i></div></div>`;
  const sentBadge = s => s === "positive" ? `<span class="badge g">Ijobiy</span>` : s === "negative" ? `<span class="badge r">Salbiy</span>` : `<span class="badge n">Neytral</span>`;
  const field = (id, label, val, type, extra) => `<label class="fl"><span>${label}</span><input id="${id}" type="${type || "text"}" value="${esc(val == null ? "" : val)}" ${extra || ""}></label>`;
  const chipsOf = (id, list, on) => `<div class="chips" id="${id}">${list.map(i => `<button class="chip ${(on || []).includes(i) ? "on" : ""}" data-i="${esc(i)}">${esc(i)}</button>`).join("")}</div>`;
  const chipVals = id => [...$$(`#${id} .chip.on`)].map(b => b.dataset.i);
  const bindChips = id => $$(`#${id} .chip`).forEach(b => b.onclick = () => b.classList.toggle("on"));

  function resortCard(r) {
    const a = analysis(r.id); const prob = a.problems[0];
    return `<div class="card res reveal" data-go="resort/${r.id}"><div class="thumb">${r.emoji || "🏞️"}<b style="background:${color(r.trust)}">${r.trust == null ? "—" : r.trust}</b></div>
      <div style="flex:1;min-width:0"><h3>${esc(r.name)}</h3><div class="mut">${esc(r.region)}, ${esc(r.district)}</div>
      <div class="mut" style="margin-top:4px">⭐ ${(+r.rating || 0).toFixed(1)} · ${reviewsOf(r.id).length} sharh${r.price ? ` · ${som(r.price)}/kecha` : ""}${prob ? ` · <span style="color:var(--bad)">${esc(prob.topic)}</span>` : ""}</div></div></div>`;
  }

  // Tog'lar, quyosh, bulut va barglar bilan animatsiyali sahna
  function scene(leaves) {
    let l = "";
    for (let i = 0; i < (leaves || 0); i++) l += `<span class="leaf" style="left:${8 + i * 17}%;top:${-10 + (i % 3) * 8}px;animation-duration:${7 + i * 1.7}s;animation-delay:${i * 1.3}s">${["🍃", "🌿", "🍂"][i % 3]}</span>`;
    return `<div class="sun"></div><div class="cloud" style="top:34px;animation-duration:38s"></div><div class="cloud" style="top:74px;animation-duration:55s;animation-delay:-20s;transform:scale(.7)"></div>${l}
      <div class="scene"><svg viewBox="0 0 400 120" preserveAspectRatio="none">
      <path d="M0 80 L60 40 L110 70 L170 20 L230 72 L290 34 L350 66 L400 44 V120 H0Z" fill="#ffffff" opacity=".10"/>
      <path d="M0 96 L50 68 L100 88 L150 56 L210 92 L270 62 L330 90 L400 70 V120 H0Z" fill="#ffffff" opacity=".16"/>
      <path d="M0 120 V104 Q100 84 200 102 T400 98 V120Z" fill="#f3f8f4"/></svg></div>`;
  }
  const hdr = (icon, title, sub) => `<header class="slim">${scene(2)}<div class="brand"><span class="logo">${icon}</span> ${title}</div>${sub ? `<div class="hero-sub" style="margin:10px 0 0">${sub}</div>` : ""}</header>`;
  const cabHdr = (icon, title, name, sub) => `<header class="slim">${scene(3)}<div class="brand"><span class="logo">${icon}</span> ${title}</div><h1 style="margin:12px 0 2px">${esc(name)}</h1><div style="opacity:.85;font-size:13px">${sub}</div></header>`;

  // Ekran chizilgandan keyin animatsiyalar
  function animate(root) {
    root.querySelectorAll(".reveal").forEach((el, i) => el.style.animationDelay = Math.min(i * 60, 600) + "ms");
    requestAnimationFrame(() => setTimeout(() => {
      root.querySelectorAll(".bar i[data-w]").forEach(i => i.style.width = i.dataset.w + "%");
      root.querySelectorAll(".arc[data-dash]").forEach(c => c.setAttribute("stroke-dasharray", c.dataset.dash));
      root.querySelectorAll("[data-h]").forEach(el => el.style.height = el.dataset.h + "%");
      root.querySelectorAll("[data-count]").forEach(el => {
        const to = +el.dataset.count, t0 = performance.now();
        const tick = t => { const k = Math.min(1, (t - t0) / 1100); el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(tick); };
        requestAnimationFrame(tick);
      });
      root.querySelectorAll("[data-type]").forEach(el => {
        const txt = el.dataset.type; let i = 0; el.textContent = ""; el.classList.add("typing");
        const step = () => { i += 3; el.textContent = txt.slice(0, i); if (i < txt.length) setTimeout(step, 14); else el.classList.remove("typing"); };
        step();
      });
    }, 60));
  }
  document.addEventListener("click", e => {
    const b = e.target.closest(".btn"); if (!b) return;
    const r = b.getBoundingClientRect(), d = Math.max(r.width, r.height), s = document.createElement("span");
    s.className = "rip"; s.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px`;
    b.appendChild(s); setTimeout(() => s.remove(), 650);
  });

  // ---------- Xarita: O'zbekiston viloyatlari (internetsiz ishlaydi) ----------
  let maps = [];
  const REGIONS = (window.UZ_REGIONS && UZ_REGIONS.features) || [];
  const pinIcon = (bg, txt, delay) => L.divIcon({ className: "pin-wrap", iconSize: [42, 42], iconAnchor: [21, 42], popupAnchor: [0, -38],
    html: `<div class="pin" style="background:${bg};animation-delay:${delay || 0}ms"><span>${txt}</span></div>` });
  // Nuqta qaysi viloyatda ekanini aniqlash (ray casting)
  function inRing(x, y, ring) { let ins = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) ins = !ins; } return ins; }
  function regionAt(lat, lng) {
    for (const f of REGIONS) { const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
      if (polys.some(p => inRing(lng, lat, p[0]))) return f.properties.name; }
    return null;
  }
  const regionOf = r => (r.lat != null && regionAt(+r.lat, +r.lng)) || r.region || "—";
  const resortsIn = name => S.resorts.filter(r => regionOf(r) === name);
  const UZ_BOUNDS = [[37.1, 55.9], [45.6, 73.2]];

  function popupHtml(r) {
    return `<div class="pop"><div class="pop-h"><span class="pop-e">${r.emoji || "🏞️"}</span><div><b>${esc(r.name)}</b><div class="mut">📍 ${esc(r.district)}</div></div></div>
      <div class="chips" style="margin:8px 0"><span class="badge ${cls(r.trust)}">Trust ${r.trust == null ? "—" : r.trust}</span><span class="badge n">⭐ ${(+r.rating || 0).toFixed(1)}</span>${r.price ? `<span class="badge n">${som(r.price)}</span>` : ""}</div>
      <button class="btn full" data-go="resort/${r.id}">Batafsil →</button></div>`;
  }
  // opts: mini (kichik, harakatsiz), tiles (ko'cha xaritasi — joy tanlash uchun), center/zoom, regions (viloyatlarni chizish)
  function makeMap(el, list, opts) {
    if (!el) return null;
    if (!window.L) { el.innerHTML = `<div class="offline">Xarita kutubxonasi yuklanmadi.</div>`; return null; }
    const m = L.map(el, { zoomControl: !opts.mini, attributionControl: !!opts.tiles, scrollWheelZoom: !opts.mini, dragging: !opts.mini,
      doubleClickZoom: !opts.mini, touchZoom: !opts.mini, boxZoom: false, keyboard: !opts.mini, zoomSnap: 0.25, zoomAnimation: !opts.mini, tap: !opts.mini });
    if (opts.tiles) {
      let failed = 0;
      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", { maxZoom: 18, subdomains: "abcd", attribution: "&copy; OpenStreetMap, &copy; CARTO" }).addTo(m)
        .on("tileerror", () => { if (++failed === 3) { const n = document.createElement("div"); n.className = "offline"; n.textContent = "🌐 Ko'cha xaritasi uchun internet kerak — viloyat chegaralari bo'yicha belgilang."; el.appendChild(n); } });
    } else el.classList.add("nomap-bg");
    const geo = L.geoJSON(window.UZ_REGIONS || { type: "FeatureCollection", features: [] }, {
      interactive: !!opts.onRegion,
      style: f => opts.regionStyle ? opts.regionStyle(f) : { color: "#ffffff", weight: 1.2, fillColor: "#86efac", fillOpacity: opts.tiles ? 0.12 : 0.85 }
    }).addTo(m);
    if (opts.onRegion) geo.eachLayer(l => {
      l.on("click", () => opts.onRegion(l.feature.properties.name, l));
      l.on("mouseover", () => { if (!l._sel) l.setStyle({ fillOpacity: 1, weight: 2.5 }); });
      l.on("mouseout", () => geo.resetStyle(l));
    });
    const pts = [];
    list.forEach((r, i) => {
      if (r.lat == null || r.lng == null) return;
      const mk = L.marker([r.lat, r.lng], { icon: pinIcon(color(r.trust), r.trust == null ? "—" : r.trust, i * 90), interactive: !opts.mini }).addTo(m);
      if (!opts.mini) mk.bindPopup(popupHtml(r), { maxWidth: 260, minWidth: 210, autoPanPadding: [20, 70] });
      pts.push([r.lat, r.lng]);
    });
    const fit = () => {
      if (opts.center) m.setView(opts.center, opts.zoom || 7, { animate: false });
      else if (opts.fitAll || !pts.length) m.fitBounds(UZ_BOUNDS, { padding: [8, 8], animate: false });
      else if (pts.length === 1) m.setView(pts[0], opts.mini ? 9 : 11, { animate: false });
      else m.fitBounds(pts, { padding: [40, 40], animate: false, maxZoom: 10 });
    };
    fit(); m._geo = geo; m._refit = fit;
    maps.push(m);
    // Konteyner o'lchami o'zgarsa (telefon burilishi, oyna) — qayta moslash
    setTimeout(() => { if (maps.includes(m)) { m.invalidateSize({ animate: false }); m._refit(); } }, 200);
    return m;
  }
  window.addEventListener("resize", () => { clearTimeout(window._rz); window._rz = setTimeout(() => maps.forEach(m => { try { m.invalidateSize({ animate: false }); m._refit && m._refit(); } catch (e) {} }), 150); });
  // Popup ichidagi "Batafsil" tugmasi
  document.addEventListener("click", e => { const a = e.target.closest(".leaflet-popup [data-go]"); if (a) { e.preventDefault(); go(a.dataset.go); } });

  // ---------- Ekranlar ----------
  const views = {};

  views.home = () => {
    const top = S.resorts.slice().sort((a, b) => (b.trust || 0) - (a.trust || 0)).slice(0, 4);
    const grads = ["#065f46,#10b981", "#0e7490,#22d3ee", "#166534,#84cc16", "#14532d,#4ade80"];
    const sus = S.resorts.reduce((s, r) => s + analysis(r.id).suspicious, 0);
    return `<header>${scene(5)}<div class="brand"><span class="logo">🧭</span> Sayohatchi AI</div>
      <h1>Tabiat qo'ynida dam oling — <em>AI tekshirgan</em> maskanlarda</h1><div class="hero-sub">Reklamaga emas, real mijozlar tajribasiga ishoning.</div>
      <form class="search" id="hs"><input id="hq" placeholder="🔍 Maskan nomi yoki hudud"><button class="btn">Tekshirish</button></form></header>
      <main><div class="stats-hero">
        <div class="card reveal"><b data-count="${S.resorts.length}">0</b><span class="mut">maskan</span></div>
        <div class="card reveal"><b data-count="${S.reviews.length}">0</b><span class="mut">sharh tahlili</span></div>
        <div class="card reveal"><b data-count="${sus}">0</b><span class="mut">shubhali sharh</span></div></div>
      ${installHtml()}<div class="card reveal plan-cta" data-go="plan"><div class="ic">🎒</div><div style="flex:1"><h3>Byudjetingizga mos sayohat</h3>
        <div class="mut">Summani kiriting — AI qayerga borish mumkinligini hisoblab beradi</div></div><span class="go">→</span></div>
      <div class="sec-title">🌿 Eng ishonchli maskanlar <a data-go="search/">Barchasi →</a></div>
      <div class="carousel">${top.map((r, i) => `<div class="feat reveal" data-go="resort/${r.id}" style="background:linear-gradient(150deg,${grads[i % 4]})">
        <span class="big">${r.emoji || "🏞️"}</span><span class="sc">★ ${r.trust == null ? "—" : r.trust}</span><h3>${esc(r.name)}</h3><div style="opacity:.85;font-size:13px">📍 ${esc(r.district)}</div></div>`).join("")}</div>
      <div class="sec-title">🗺️ Xaritada <a data-go="map">To'liq xarita →</a></div>
      <div class="minimap reveal" id="hmap" data-go="map" role="link" aria-label="To'liq xaritani ochish"></div>
      <div class="sec-title">✨ Platforma kimlar uchun?</div><div class="how">
      <div class="card reveal"><div class="ic">🧳</div><div><h3>Mijozlar</h3><div class="mut">Ishonchli maskanlarni toping, sayohatlaringizni yozib boring va byudjet bo'yicha AI tavsiyasini oling.</div></div></div>
      <div class="card reveal"><div class="ic">🏨</div><div><h3>Tashkilotlar</h3><div class="mut">Maskaningizni qo'shing, ma'lumotlarni yangilang, sharhlarga javob bering va Trust Score'ingizni kuzating.</div></div></div>
      <div class="card reveal"><div class="ic">🛡️</div><div><h3>Ishonch</h3><div class="mut">AI shubhali sharhlarni belgilaydi, reklama va real rasmni solishtiradi — 0–100 oralig'ida yagona baho.</div></div></div></div>
      <p class="mut" style="text-align:center;margin-top:18px">AI natijalari yakuniy haqiqat emas, ehtimoliy tahlil va tavsiya.</p></main>`;
  };
  views.home.bind = () => { $("#hs").onsubmit = e => { e.preventDefault(); go("search/" + encodeURIComponent($("#hq").value)); }; makeMap($("#hmap"), S.resorts, { mini: true, fitAll: true }); };

  // To'liq xarita: viloyat bosiladi → o'sha viloyat maskanlari, maskan bosiladi → "Batafsil"
  let mapRegion = null;
  const shortName = n => n.replace(" viloyati", "").replace(" Respublikasi", "");
  views.map = () => {
    const counts = {}; S.resorts.forEach(r => { const k = regionOf(r); counts[k] = (counts[k] || 0) + 1; });
    const list = mapRegion ? resortsIn(mapRegion).sort((a, b) => (b.trust || 0) - (a.trust || 0)) : [];
    const names = REGIONS.map(f => f.properties.name).sort((a, b) => a.localeCompare(b));
    return `${hdr("🗺️", "O'zbekiston xaritasi", mapRegion ? "" : "Viloyatni bosing — undagi dam olish maskanlari ko'rinadi")}
    <main><div class="map-bar">${mapRegion ? `<button class="btn sec" id="mall">← Butun O'zbekiston</button>` : ""}
      <select id="mreg" aria-label="Viloyatni tanlang"><option value="">🗺 Viloyatni tanlang</option>${names.map(n => `<option ${n === mapRegion ? "selected" : ""} value="${esc(n)}">${esc(shortName(n))}${counts[n] ? ` (${counts[n]})` : ""}</option>`).join("")}</select></div>
      <div class="map-wrap"><div id="map" class="${mapRegion ? "region" : "country"}"></div>${mapRegion ? `<div class="map-title"><b>${esc(mapRegion)}</b><span>${list.length} ta maskan</span></div>` : `<div class="map-legend"><span><i style="background:#bbf7d0"></i>0</span><span><i style="background:#4ade80"></i>1–2</span><span><i style="background:#16a34a"></i>3+</span> maskan</div>`}</div>
      ${mapRegion ? (list.length ? `<div class="sec-title">📍 ${esc(shortName(mapRegion))}dagi maskanlar</div><div class="grid2 map-list">${list.map(resortCard).join("")}</div>`
        : `<div class="card mut reveal" style="text-align:center">🌱 Bu hududda hozircha maskan yo'q. Tashkilotlar o'z maskanini qo'shishi mumkin.</div>`) : ""}</main>`;
  };
  views.map.bind = () => {
    const counts = {}; S.resorts.forEach(r => { const k = regionOf(r); counts[k] = (counts[k] || 0) + 1; });
    const fillFor = n => { const c = counts[n] || 0; return c >= 3 ? "#16a34a" : c >= 1 ? "#4ade80" : "#bbf7d0"; };
    const list = mapRegion ? resortsIn(mapRegion) : [];
    const pick = name => { mapRegion = name; track("map_region", "map", { region: name, count: (counts[name] || 0) }); render(); };
    const m = makeMap($("#map"), list, {
      fitAll: !mapRegion,
      onRegion: (name) => pick(name === mapRegion ? null : name),
      regionStyle: f => { const n = f.properties.name, sel = n === mapRegion;
        return mapRegion ? { color: sel ? "#0f5132" : "#ffffff", weight: sel ? 3 : 1, fillColor: sel ? "#dcfce7" : "#e5e7eb", fillOpacity: sel ? 0.9 : 0.6 }
          : { color: "#ffffff", weight: 1.5, fillColor: fillFor(n), fillOpacity: 0.9 }; }
    });
    if (m) {
      // Viloyat nomi va maskanlar soni yorlig'i
      if (!mapRegion) m._geo.eachLayer(l => { const n = l.feature.properties.name, c = counts[n] || 0, bb = l.getBounds();
        if (!c && bb.getNorth() - bb.getSouth() < 0.6) return; // juda kichik hudud (Toshkent shahri) — yorliq boshqasini yopmasin
        L.marker(l.getBounds().getCenter(), { interactive: false, icon: L.divIcon({ className: "rlabel-wrap", iconSize: null,
          html: `<div class="rlabel ${c ? "has" : ""}">${esc(shortName(n))}${c ? `<b>${c}</b>` : ""}</div>` }) }).addTo(m); });
      if (mapRegion) {
        m._geo.eachLayer(l => { if (l.feature.properties.name === mapRegion) { l._sel = true; l.bringToFront(); } });
        // Viloyatga moslash; maskanlar ustma-ust tushsa — ular ajralib ko'rinadigan darajada yaqinlashtirish
        m._refit = () => {
          m._geo.eachLayer(l => { if (l._sel) m.fitBounds(l.getBounds(), { padding: [24, 24], animate: false }); });
          const pts = list.filter(r => r.lat != null).map(r => m.latLngToContainerPoint([r.lat, r.lng]));
          const close = pts.some((p, i) => pts.some((q, j) => j > i && p.distanceTo(q) < 46));
          if (close) m.fitBounds(list.map(r => [r.lat, r.lng]), { padding: [60, 60], maxZoom: 12, animate: false });
        };
        m._refit();
      }
    }
    $("#mreg").onchange = e => pick(e.target.value || null);
    if ($("#mall")) $("#mall").onclick = () => pick(null);
  };

  views.search = (q) => {
    q = decodeURIComponent(q || "");
    const regions = [...new Set(S.resorts.map(r => r.region))];
    return `<header class="slim">${scene(2)}<div class="brand"><span class="logo">🔎</span> Qidiruv</div><form class="search" id="ss" style="margin-top:14px"><input id="sq" value="${esc(q)}" placeholder="Nomi, viloyat, tuman yoki yo'nalish"><button class="btn">Izlash</button></form></header>
      <main><div class="row" style="margin-bottom:12px"><select id="sr"><option value="">Barcha viloyatlar</option>${regions.map(r => `<option>${esc(r)}</option>`).join("")}</select>
      <select id="so"><option value="trust">Trust Score bo'yicha</option><option value="rating">Reyting bo'yicha</option><option value="price">Arzonroq</option><option value="name">Nomi bo'yicha</option></select></div><div id="results"></div></main>`;
  };
  views.search.bind = () => {
    let tmr;
    const draw = () => {
      const q = $("#sq").value.toLowerCase().trim(), reg = $("#sr").value, so = $("#so").value;
      const list = S.resorts.filter(r => (!reg || r.region === reg) && (!q || [r.name, r.region, r.district, r.address, (r.tags || []).join(" ")].join(" ").toLowerCase().includes(q)));
      list.sort((a, b) => so === "name" ? a.name.localeCompare(b.name) : so === "rating" ? b.rating - a.rating : so === "price" ? (a.price || 1e12) - (b.price || 1e12) : (b.trust || 0) - (a.trust || 0));
      const res = $("#results");
      res.innerHTML = list.length ? `<div class="mut" style="margin-bottom:8px">${list.length} ta natija</div>` + list.map(resortCard).join("") : `<div class="card mut">🌵 Hech narsa topilmadi.</div>`;
      animate(res);
      clearTimeout(tmr); if (q) tmr = setTimeout(() => track("search", "search", { q, results: list.length }), 1200);
    };
    $("#ss").onsubmit = e => { e.preventDefault(); draw(); };
    $("#sq").oninput = draw; $("#sr").onchange = draw; $("#so").onchange = draw; draw();
  };

  // ---------- Maskan sahifasi ----------
  let resortTab = "ai";
  views.resort = (id) => {
    const r = resort(id); if (!r) return `${hdr("🏞️", "Topilmadi")}<main><div class="card">Maskan topilmadi yoki o'chirilgan.</div></main>`;
    const a = analysis(id); const saved = S.saved.includes(String(r.id));
    const org = S.orgs.find(o => o.owner === r.owner);
    const fb = S.aiLogs.filter(l => l.kind === "feedback" && l.resortId === String(id) && l.visitor === S.visitor).pop();
    const tabs = [["ai", "AI tahlil"], ["info", "Ma'lumot"], ["reviews", "Sharhlar"], ["image", "Reklama vs Real"], ["add", "Sharh qo'shish"]];
    let body = "";
    if (resortTab === "ai") {
      body = `<div class="split"><div><div class="card ai-glow reveal"><h2>🤖 AI xulosasi</h2><p style="margin:0;line-height:1.6" data-type="${esc(a.summary)}">${esc(a.summary)}</p>
        <p class="mut">Ishonch darajasi: ${Math.round((a.confidence || 0) * 100)}%${a.confidence < 0.6 ? " — ma'lumot kam, natija taxminiy" : ""}</p>
        <div class="feedback"><span class="mut">AI xulosasi to'g'rimi?</span><button class="fbtn ${fb && fb.ok ? "on" : ""}" data-fb="1">👍</button><button class="fbtn ${fb && !fb.ok ? "on bad" : ""}" data-fb="0">👎</button></div>
        <button class="btn sec full" id="reanalyze">🔄 AI tahlilini yangilash</button><div class="prog" style="margin-top:8px;display:none" id="pg"><i style="width:0"></i></div></div>
        <div class="card reveal"><h2>📊 7 ta asosiy ko'rsatkich</h2>${METRICS.map(([k, l]) => metricRow(l, a.metrics[k], AI.WEIGHTS[k])).join("")}</div>
        </div><div><div class="minimap reveal" id="rmap"></div><div class="card reveal"><h2>⚠️ Eng ko'p uchraydigan muammolar</h2>${a.problems.length ? a.problems.map(p => `<div class="row between rev"><span>${esc(p.topic)}</span><span class="badge r">${p.count} ta sharhda</span></div>`).join("") : `<div class="mut">Jiddiy muammo aniqlanmadi.</div>`}</div>
        <div class="card reveal"><h2>✅ Kuchli tomonlar</h2><div class="chips">${a.strengths.map(p => `<span class="badge g">${esc(p.topic)} · ${p.count}</span>`).join("") || `<span class="mut">Ma'lumot yetarli emas</span>`}</div></div>
        <div class="card reveal"><h2>📣 Reklama matni</h2><div class="mut">${esc(r.adText)}</div>${r.adImage ? `<img src="${r.adImage}" class="adimg">` : ""}</div></div></div>`;
    } else if (resortTab === "info") {
      body = `<div class="card reveal"><h2>ℹ️ Maskan haqida</h2>
        <div class="kv"><span>📍 Manzil</span><b>${esc([r.region, r.district, r.address].filter(Boolean).join(", "))}</b></div>
        ${r.price ? `<div class="kv"><span>🛏 Narx (1 kecha, xona)</span><b>${som(r.price)}</b></div>` : ""}
        ${r.food ? `<div class="kv"><span>🍽 Ovqat (1 kishi, kun)</span><b>${som(r.food)}</b></div>` : ""}
        ${r.phone ? `<div class="kv"><span>📞 Telefon</span><b><a href="tel:${esc(r.phone)}">${esc(r.phone)}</a></b></div>` : ""}
        ${(r.tags || []).length ? `<div class="kv"><span>🏷 Yo'nalish</span><div class="chips">${r.tags.map(t => `<span class="badge g">${esc(t)}</span>`).join("")}</div></div>` : ""}
        ${r.description ? `<p style="line-height:1.6">${esc(r.description)}</p>` : ""}</div>
        ${org ? `<div class="card reveal"><h2>🏢 Tashkilot</h2><b>${esc(org.name)}</b>${org.verified ? ` <span class="badge g">✔ Tasdiqlangan</span>` : ""}<div class="mut">${esc(org.about || "")}</div>
          ${org.phone ? `<div class="mut" style="margin-top:6px">📞 ${esc(org.phone)}</div>` : ""}</div>` : `<div class="note">Ma'lumotlar platforma tomonidan kiritilgan.</div>`}`;
    } else if (resortTab === "reviews") {
      const sus = a.reviews.filter(x => x.fake >= 50).length;
      body = `<div class="card reveal"><div class="row between"><h2>💬 Sharhlar (${a.reviews.length})</h2>${sus ? `<span class="badge y">${sus} shubhali</span>` : ""}</div>
        ${a.reviews.slice().sort((x, y) => String(y.date).localeCompare(String(x.date))).map(v => `<div class="rev"><div class="row between"><div class="row"><span class="avatar">${esc((v.author || "?")[0])}</span><b>${esc(v.author)}</b></div><span style="color:#f5b301">${"★".repeat(v.rating)}<span style="color:#d6e2da">${"★".repeat(5 - v.rating)}</span></span></div>
          <div style="margin:6px 0">${esc(v.text)}</div>
          <div class="chips">${sentBadge(v.sentiment)}${v.topics.map(t => `<span class="badge ${t.score > 0.1 ? "g" : t.score < -0.1 ? "r" : "n"}">${esc(t.topic)}</span>`).join("")}
          <span class="badge ${v.fake >= 50 ? "r" : v.fake >= 25 ? "y" : "g"}">Shubha: ${v.fake}%</span></div>
          ${v.fakeReasons.length && v.fake >= 25 ? `<div class="mut" style="margin-top:4px">ⓘ ${esc(v.fakeReasons.join("; "))}</div>` : ""}
          ${v.orgReply ? `<div class="reply"><b>🏢 Tashkilot javobi:</b> ${esc(v.orgReply)}</div>` : ""}
          <div class="mut" style="margin-top:4px">${esc(v.date)} · ${v.source === "user" ? "foydalanuvchi" : "admin/ochiq manba"}</div></div>`).join("") || `<div class="mut">Hali sharh yo'q.</div>`}</div>
        <div class="note">Shubha ko'rsatkichi "soxta" degan hukm emas — faqat tekshiruv indikatori.</div>`;
    } else if (resortTab === "image") {
      const ir = a.imageResult;
      body = `<div class="card reveal"><h2>📷 Reklama vs Real</h2><div class="mut" style="margin-bottom:10px">Reklama rasmi va o'zingiz (yoki boshqa mijoz) olgan real rasmni yuklang.</div>
        <div class="imgs"><label class="imgbox" id="b1">${r.adImage ? `<span class="lbl">Reklama</span><img src="${r.adImage}">` : `<span class="plus">📣</span><span>Reklama rasmi</span>`}<input type="file" accept="image/*" id="f1"></label>
        <label class="imgbox" id="b2"><span class="plus">📸</span><span>Real rasm</span><input type="file" accept="image/*" id="f2"></label></div>
        <button class="btn full" style="margin-top:10px" id="cmp">Tahlil qilish</button></div>
        <div id="cmpres">${ir ? imgResult(ir) : ""}</div>
        <div class="note">Natija faqat ko'rinadigan farqlarga asoslangan indikator; ekspert yoki sud xulosasi emas.</div>`;
    } else {
      body = `<div class="card reveal"><h2>✍️ Sharh qoldirish</h2>${S.user ? "" : `<div class="note" style="margin-bottom:10px">Ismingiz ko'rinishi uchun Profil bo'limida kiring (ixtiyoriy).</div>`}
        <div class="stars" id="stars">${[1, 2, 3, 4, 5].map(i => `<button data-s="${i}">★</button>`).join("")}</div>
        <textarea id="rt" placeholder="Tajribangiz: tozalik, ovqat, xodimlar, narx..." maxlength="1000"></textarea>
        <input type="date" id="rd" style="margin-top:8px" value="${new Date().toISOString().slice(0, 10)}">
        ${role() === "client" ? `<label class="chk"><input type="checkbox" id="rvisit" checked> Sayohatlarim tarixiga qo'shish</label>` : ""}
        <button class="btn full" style="margin-top:10px" id="rsend">Yuborish</button></div>`;
    }
    return `<header>${scene(3)}<button class="back" data-back>‹ Orqaga</button><div class="row between"><div style="min-width:0"><h1 style="margin:4px 0">${r.emoji || ""} ${esc(r.name)}</h1>
      <div style="opacity:.85;font-size:13px">📍 ${esc(r.region)}, ${esc(r.district)} · ⭐ ${(+r.rating || 0).toFixed(1)}</div></div>
      <div class="score-box">${ring(r.trust, 92)}</div></div>
      <div class="row between" style="margin-top:10px"><span style="font-size:13px;opacity:.9">AI Trust Score</span><button class="save ${saved ? "on" : ""}" id="sv"><span class="heart">${saved ? "♥" : "♡"}</span> ${saved ? "Saqlangan" : "Saqlash"}</button></div></header>
      <main><div class="tabs">${tabs.map(([k, l]) => `<button class="${k === resortTab ? "on" : ""}" data-tab="${k}">${l}</button>`).join("")}</div>${body}</main>`;
  };
  function imgResult(ir) {
    return `<div class="card reveal"><div class="row"><div>${ring(ir.score)}</div><div><h2 style="margin:0">Moslik: ${ir.score}%</h2>
      <div class="mut">${ir.score >= 70 ? "Reklama realga yaqin" : ir.score >= 50 ? "Qisman mos" : "Sezilarli tafovut"}</div></div></div>
      ${[["Rang", ir.details.color], ["Kompozitsiya", ir.details.structure], ["Yorug'lik", ir.details.light], ["To'yinganlik", ir.details.saturation]].map(([l, v]) => metricRow(l, v)).join("")}
      <h3 style="margin-top:10px">Aniqlangan farqlar</h3>${ir.diffs.map(d => `<div class="rev">• ${esc(d)}</div>`).join("")}</div>`;
  }
  // Rasmni tekshirish va kichraytirish (saqlash hajmini kamaytirish uchun)
  function readImage(file, maxSide) {
    return new Promise((ok, bad) => {
      if (!file) return bad(new Error("Fayl tanlanmadi"));
      if (!/^image\/(png|jpe?g|webp|gif)$/.test(file.type)) return bad(new Error("Faqat PNG, JPG yoki WEBP rasm"));
      if (file.size > 10 * 1024 * 1024) return bad(new Error("Rasm hajmi 10 MB dan oshmasin"));
      const rd = new FileReader();
      rd.onload = () => { const im = new Image(); im.onload = () => {
        const k = Math.min(1, (maxSide || 900) / Math.max(im.width, im.height)), c = document.createElement("canvas");
        c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
        const url = c.toDataURL("image/jpeg", 0.82); const out = new Image(); out.onload = () => ok({ img: out, url }); out.src = url;
      }; im.onerror = () => bad(new Error("Rasmni o'qib bo'lmadi")); im.src = rd.result; };
      rd.readAsDataURL(file);
    });
  }
  views.resort.bind = (id) => {
    if (!resort(id)) return;
    track("view_resort", "resort", { resortId: String(id), tab: resortTab });
    $$("[data-tab]").forEach(b => b.onclick = () => { resortTab = b.dataset.tab; render(); });
    if ($("#rmap")) makeMap($("#rmap"), [resort(id)], { mini: true });
    $("#sv").onclick = () => { const k = String(id), i = S.saved.indexOf(k); i >= 0 ? S.saved.splice(i, 1) : S.saved.push(k); if (i < 0) track("save", "resort", { resortId: k }); save(); render(); };
    $$("[data-fb]").forEach(b => b.onclick = () => {
      const ok = b.dataset.fb === "1";
      S.aiLogs = S.aiLogs.filter(l => !(l.kind === "feedback" && l.resortId === String(id) && l.visitor === S.visitor));
      const note = ok ? "" : (prompt("AI nimada xato qildi? (ixtiyoriy)") || "");
      aiLog("feedback", id, { ok, note: note.slice(0, 300), visitor: S.visitor, overall: resort(id).trust });
      toast(ok ? "Rahmat! Fikringiz AI sifatini oshiradi" : "Rahmat! Dasturchilar xatoni ko'rib chiqadi"); render();
    });
    if ($("#reanalyze")) $("#reanalyze").onclick = () => {
      $("#pg").style.display = "block"; $(".ai-glow p").classList.add("pulse");
      runAnalysis(id, (job, done) => { const p = $("#pg i"); if (p) p.style.width = job.progress + "%"; if (done) { toast(job.status === "done" ? "Tahlil yangilandi" : "Xatolik: " + job.error); render(); } });
    };
    if ($("#f1")) {
      const imgs = {}; const r = resort(id);
      if (r.adImage) { const im = new Image(); im.onload = () => imgs.ad = im; im.src = r.adImage; }
      const load = (inp, box, key) => inp.onchange = () => readImage(inp.files[0], 600).then(({ img, url }) => {
        imgs[key] = img; $(box).innerHTML = `<span class="lbl">${key === "ad" ? "Reklama" : "Real"}</span><img src="${url}">`; $(box).appendChild(inp);
      }).catch(e => toast(e.message));
      load($("#f1"), "#b1", "ad"); load($("#f2"), "#b2", "real");
      $("#cmp").onclick = () => {
        if (!imgs.ad || !imgs.real) return toast("Ikkala rasmni ham yuklang");
        let res;
        try { res = AI.compareImages(imgs.ad, imgs.real); } catch (e) { aiLog("error", id, { module: "image", message: String(e).slice(0, 300) }); return toast("Rasm tahlilida xatolik"); }
        const a = analysis(id); a.imageResult = res; a.imageScore = res.score; save();
        aiLog("run", id, { module: "image", score: res.score }); track("image_compare", "resort", { resortId: String(id), score: res.score });
        $("#cmpres").innerHTML = imgResult(res); animate($("#cmpres"));
        runAnalysis(id, (j, done) => { if (done) toast("Trust Score rasm tahlili bilan yangilandi"); });
      };
    }
    if ($("#stars")) {
      let stars = 0;
      $$("#stars button").forEach(b => b.onclick = () => { stars = +b.dataset.s; $$("#stars button").forEach(x => x.classList.toggle("on", +x.dataset.s <= stars)); });
      $("#rsend").onclick = () => {
        const text = $("#rt").value.trim();
        if (!stars) return toast("Baho tanlang"); if (text.length < 10) return toast("Sharh kamida 10 belgi bo'lsin");
        persist("reviews", { id: uid("r"), resortId: id, author: S.user ? S.user.name : "Mehmon", userId: S.user ? S.user.id : "", rating: stars, text, date: $("#rd").value, source: "user", hidden: false });
        if ($("#rvisit") && $("#rvisit").checked) persist("visits", { id: uid("t"), userId: S.user.id, resortId: id, date: $("#rd").value, spent: 0, rating: stars, people: 1 });
        track("review", "resort", { resortId: String(id), rating: stars });
        resortTab = "reviews"; toast("Sharh qo'shildi, AI tahlil qilmoqda...");
        runAnalysis(id, (j, done) => done && render());
      };
    }
  };

  // ---------- AI sayohat rejalashtiruvchi (byudjet bo'yicha) ----------
  const dist = (a, b) => { const R = 6371, t = Math.PI / 180, dLa = (b[0] - a[0]) * t, dLo = (b[1] - a[1]) * t;
    const h = Math.sin(dLa / 2) ** 2 + Math.cos(a[0] * t) * Math.cos(b[0] * t) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)) * 1.25; }; // yo'l to'g'ri chiziqdan ~25% uzun
  function planTrip(p) {
    const from = CITIES[p.city] || CITIES["Toshkent"]; const nights = Math.max(1, p.days - 1); const rooms = Math.ceil(p.people / 2);
    const visited = S.visits.filter(v => S.user && v.userId === S.user.id);
    const list = S.resorts.filter(r => r.price && r.lat != null).map(r => {
      const km = dist(from, [r.lat, r.lng]);
      // Borish-qaytish: ~450 so'm/km kishi boshiga (avtobus/taksi o'rtachasi), uzoq masofaga poyezd/samolyot qo'shimchasi
      const transport = Math.round(km * 2 * 450 * p.people + (km > 450 ? 250000 * p.people : 0));
      const stay = r.price * nights * rooms, food = (r.food || 100000) * p.days * p.people, extra = Math.round((stay + food) * 0.1);
      const total = transport + stay + food + extra;
      const tags = r.tags || [];
      const match = p.interests.length ? p.interests.filter(i => tags.includes(i)).length / p.interests.length : 0.5;
      const been = visited.filter(v => String(v.resortId) === String(r.id));
      const novelty = been.length ? (Math.max(...been.map(v => v.rating || 3)) >= 4 ? 0.6 : 0.1) : 1;
      const fitsBudget = total <= p.budget;
      const comfort = fitsBudget ? 1 - Math.max(0, total / p.budget - 0.6) : Math.max(0, 1 - (total - p.budget) / p.budget * 2);
      const score = Math.round(((r.trust || 50) / 100 * 0.45 + match * 0.25 + comfort * 0.2 + novelty * 0.1) * 100);
      const why = [];
      if ((r.trust || 0) >= 70) why.push(`yuqori Trust Score (${r.trust})`);
      if (match >= 0.5 && p.interests.length) why.push(`qiziqishlaringizga mos: ${tags.filter(t => p.interests.includes(t)).join(", ")}`);
      if (fitsBudget) why.push(`byudjetdan ${som(p.budget - total)} qoladi`);
      if (been.length) why.push(novelty > 0.5 ? "avval borgansiz va yoqqan" : "avval borgansiz — yangi joy afzal");
      const prob = analysis(r.id).problems[0];
      return { r, km: Math.round(km), transport, stay, food, extra, total, fitsBudget, score, why, warn: prob ? `Sharhlarda ko'p tilga olingan muammo — ${prob.topic.toLowerCase()}` : "" };
    }).sort((a, b) => (b.fitsBudget - a.fitsBudget) || b.score - a.score);
    return { list, nights, rooms };
  }
  let lastPlan = null;
  views.plan = () => {
    const p = S.profile.plan || { budget: 3000000, days: 3, people: 2, city: S.profile.city || "Toshkent", interests: S.profile.interests || ["tabiat"] };
    return `${hdr("🎒", "AI sayohat rejasi", "Byudjetingizni kiriting — AI qayerga va qancha xarajat bilan borish mumkinligini hisoblaydi.")}
      <main><div class="card reveal"><div class="grid-form">
        ${field("pb", "💰 Byudjet (so'm)", p.budget, "number", 'min="100000" step="100000"')}
        ${field("pd", "📅 Necha kun", p.days, "number", 'min="1" max="30"')}
        ${field("pp", "👥 Necha kishi", p.people, "number", 'min="1" max="20"')}
        <label class="fl"><span>🚩 Qayerdan</span><select id="pc">${Object.keys(CITIES).map(c => `<option ${c === p.city ? "selected" : ""}>${c}</option>`).join("")}</select></label></div>
        <div class="mut" style="margin:10px 0 6px">Qiziqishlar</div>${chipsOf("pint", INTERESTS, p.interests)}
        <button class="btn full" style="margin-top:14px" id="pgo">✨ AI tavsiyasini olish</button></div>
        <div id="pres"></div></main>`;
  };
  function planHtml(p, out) {
    const ok = out.list.filter(x => x.fitsBudget);
    let head;
    if (ok.length) head = `<div class="card ai-glow reveal"><h2>🤖 AI tavsiyasi</h2><p style="line-height:1.6" data-type="${esc(`${som(p.budget)} byudjet bilan ${p.people} kishi ${p.days} kunga ${ok.length} ta maskanga borish mumkin. Eng yaxshi variant — ${ok[0].r.name}: taxminiy xarajat ${som(ok[0].total)}${ok[0].why.length ? ", " + ok[0].why.join(", ") : ""}.`)}"></p></div>`;
    else { const c = out.list.slice().sort((a, b) => a.total - b.total)[0];
      head = `<div class="card reveal"><h2>🤖 AI tavsiyasi</h2><p>Afsuski, ${som(p.budget)} byudjet ${p.days} kunlik sayohat uchun yetmaydi.${c ? ` Eng arzon variant — ${esc(c.r.name)}: ${som(c.total)}. Kunlar yoki kishilar sonini kamaytirib ko'ring.` : ""}</p></div>`; }
    return head + out.list.slice(0, 6).map((x, i) => `<div class="card reveal plan-item ${x.fitsBudget ? "" : "over"}" data-go="resort/${x.r.id}">
      <div class="row between"><div class="row"><span class="rank">${i + 1}</span><div><h3>${x.r.emoji || ""} ${esc(x.r.name)}</h3><div class="mut">📍 ${esc(x.r.district)} · ${x.km} km · Trust ${x.r.trust == null ? "—" : x.r.trust}</div></div></div>
      <span class="badge ${x.fitsBudget ? "g" : "r"}">${x.fitsBudget ? "Byudjetga mos" : "Byudjetdan oshadi"}</span></div>
      <div class="cost"><div><span>🚌 Yo'l</span><b>${som(x.transport)}</b></div><div><span>🛏 Turar joy (${out.nights} kecha, ${out.rooms} xona)</span><b>${som(x.stay)}</b></div>
        <div><span>🍽 Ovqat</span><b>${som(x.food)}</b></div><div><span>🎟 Boshqa (10%)</span><b>${som(x.extra)}</b></div></div>
      <div class="row between" style="margin-top:8px"><b style="font-size:17px;color:var(--pri)">Jami: ${som(x.total)}</b><span class="badge n">Moslik ${x.score}%</span></div>
      ${x.why.length ? `<div class="mut" style="margin-top:6px">✔ ${esc(x.why.join(" · "))}</div>` : ""}${x.warn ? `<div class="mut" style="color:#a16207;margin-top:4px">⚠ ${esc(x.warn)}</div>` : ""}</div>`).join("") +
      `<div class="note">Narxlar taxminiy: maskan ma'lumotlari va o'rtacha transport narxlari asosida hisoblangan.</div>`;
  }
  views.plan.bind = () => {
    bindChips("pint");
    $("#pgo").onclick = () => {
      const p = { budget: +$("#pb").value || 0, days: Math.max(1, +$("#pd").value || 1), people: Math.max(1, +$("#pp").value || 1), city: $("#pc").value, interests: chipVals("pint") };
      if (p.budget < 100000) return toast("Byudjetni kiriting");
      S.profile.plan = p; save();
      let out; try { out = planTrip(p); } catch (e) { aiLog("error", null, { module: "planner", message: String(e).slice(0, 300) }); return toast("AI tavsiyasida xatolik"); }
      const fits = out.list.filter(x => x.fitsBudget).length;
      aiLog("run", null, { module: "planner", results: fits });
      track("plan", "plan", { budget: p.budget, days: p.days, people: p.people, city: p.city, fits });
      lastPlan = { p, out }; const el = $("#pres"); el.innerHTML = planHtml(p, out); animate(el); el.scrollIntoView({ behavior: "smooth" });
    };
    if (lastPlan) { const el = $("#pres"); el.innerHTML = planHtml(lastPlan.p, lastPlan.out); }
  };

  // ---------- Profil / Kirish ----------
  let authRole = "client", authMode = "login";
  async function sha(s) {
    try { const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join(""); }
    catch (e) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return "x" + h; }
  }
  views.profile = () => {
    if (!S.user) {
      const roles = [["client", "🧳", "Sayohatchi", "Dam oluvchi"], ["org", "🏨", "Tashkilot", "Maskan egasi"], ["analyst", "📈", "Analitik", "Statistika"], ["admin", "🛡️", "Admin", "Boshqaruv"]];
      return `${hdr("👤", "Kirish")}<main><div class="card reveal"><h2>Kim sifatida kirasiz?</h2>
        <div class="roles">${roles.map(([k, ic, t, d]) => `<button class="role ${authRole === k ? "on" : ""}" data-role="${k}"><span>${ic}</span><b>${t}</b><small>${d}</small></button>`).join("")}</div>
        <div class="tabs" style="box-shadow:none;background:#f3f8f4;margin-top:14px"><button class="${authMode === "login" ? "on" : ""}" data-am="login">Kirish</button><button class="${authMode === "reg" ? "on" : ""}" data-am="reg">Ro'yxatdan o'tish</button></div>
        ${authMode === "reg" ? field("an", authRole === "org" ? "Mas'ul shaxs ismi" : "Ism", "") : ""}
        ${field("ae", "Email", "", "email")}${field("ap", "Parol (kamida 6 belgi)", "", "password")}
        ${authMode === "reg" && OFFLINE_CODES[authRole] ? field("adc", ROLE_NAMES[authRole] + " kirish kodi", "", "password") : ""}
        <button class="btn full" style="margin-top:12px" id="ago">${authMode === "login" ? "Kirish" : "Ro'yxatdan o'tish"}</button>
        <p class="mut">${online ? "🟢 Server bilan ulangan" : "⚪ Oflayn rejim: ma'lumotlar shu qurilmada saqlanadi"}${OFFLINE_CODES[authRole] && !online && authMode === "reg" ? ` · Demo kod: ${OFFLINE_CODES[authRole]}` : ""}</p></div>
        ${S.saved.length ? `<div class="sec-title">💚 Saqlanganlar</div>${S.resorts.filter(r => S.saved.includes(String(r.id))).map(resortCard).join("")}` : ""}</main>`;
    }
    if (role() === "org") return orgCabinet();
    if (role() === "analyst" || role() === "admin") return devPanel();
    return clientCabinet();
  };
  views.profile.bind = () => {
    $$("[data-role]").forEach(b => b.onclick = () => { authRole = b.dataset.role; render(); });
    $$("[data-am]").forEach(b => b.onclick = () => { authMode = b.dataset.am; render(); });
    if ($("#ago")) $("#ago").onclick = async () => {
      const email = $("#ae").value.trim().toLowerCase(), pw = $("#ap").value, name = $("#an") ? $("#an").value.trim() : "";
      if (!/^\S+@\S+\.\S+$/.test(email)) return toast("Email noto'g'ri"); if (pw.length < 6) return toast("Parol kamida 6 belgi");
      if (authMode === "reg" && name.length < 2) return toast("Ismni kiriting");
      try {
        if (online) {
          const res = await api(`/api/v1/auth/${authMode === "login" ? "login" : "register"}`, { method: "POST", body: { email, password: pw, name, role: authRole, code: $("#adc") ? $("#adc").value : "" } });
          S.token = res.token; S.user = res.user;
        } else {
          const h = await sha(email + ":" + pw);
          if (authMode === "login") {
            const u = S.users.find(x => x.email === email && x.pw === h); if (!u) return toast("Email yoki parol noto'g'ri");
            if (u.blocked) return toast("Hisobingiz bloklangan. Admin bilan bog'laning");
            S.user = { id: u.id, name: u.name, email: u.email, role: u.role };
          } else {
            if (S.users.some(x => x.email === email)) return toast("Bu email bilan ro'yxatdan o'tilgan");
            if (OFFLINE_CODES[authRole] && $("#adc").value !== OFFLINE_CODES[authRole]) return toast("Kirish kodi noto'g'ri");
            const u = { id: uid("u"), name, email, pw: h, role: authRole, created: Date.now() }; S.users.push(u);
            S.user = { id: u.id, name, email, role: authRole };
          }
        }
        devTab = null; orgTab = "dash"; devData = null; // har bir rol o'z bosh bo'limidan boshlaydi
        track(authMode === "login" ? "login" : "register", "profile", { role: S.user.role });
        save(); toast(`Xush kelibsiz, ${S.user.name}!`); if (online) syncFromServer(); render();
      } catch (e) { toast(e.message); }
    };
    if ($("#plogout")) $("#plogout").onclick = () => { track("logout", "profile"); S.user = null; S.token = null; devData = null; save(); render(); };
    const b = role() === "org" ? orgBind : (role() === "analyst" || role() === "admin") ? devBind : role() === "client" ? clientBind : null;
    b && b();
  };

  // ---------- Mijoz kabineti ----------
  function clientCabinet() {
    const mine = S.visits.filter(v => v.userId === S.user.id).sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const spent = mine.reduce((s, v) => s + (+v.spent || 0), 0);
    const regions = new Set(mine.map(v => resort(v.resortId) && resort(v.resortId).region).filter(Boolean));
    const pr = S.profile;
    return `${cabHdr("🧳", "Sayohatchi kabineti", S.user.name, `${esc(S.user.email)} · ${online ? "🟢 onlayn" : "oflayn"}`)}
      <main><div class="stats-hero"><div class="card reveal"><b data-count="${mine.length}">0</b><span class="mut">sayohat</span></div>
        <div class="card reveal"><b data-count="${regions.size}">0</b><span class="mut">viloyat</span></div>
        <div class="card reveal"><b style="font-size:15px">${som(spent)}</b><span class="mut">sarflangan</span></div></div>
      <div class="card reveal plan-cta" data-go="plan"><div class="ic">🎒</div><div style="flex:1"><h3>AI sayohat rejasi</h3><div class="mut">Byudjetingizga mos keyingi manzilni toping</div></div><span class="go">→</span></div>
      <div class="card reveal"><h2>🗺️ Qayerlarga borganman</h2><div class="minimap" id="vmap" style="box-shadow:none"></div>
        ${mine.map(v => { const r = resort(v.resortId); return `<div class="rev row between"><div><b>${r ? (r.emoji || "") + " " + esc(r.name) : "O'chirilgan maskan"}</b>
          <div class="mut">${esc(v.date)} · ${v.people || 1} kishi${v.spent ? " · " + som(v.spent) : ""}${v.rating ? " · " + "★".repeat(v.rating) : ""}</div></div>
          <button class="icon-btn" data-delvisit="${v.id}" aria-label="O'chirish">✕</button></div>`; }).join("") || `<div class="mut">Hali sayohat qo'shilmagan.</div>`}
        <details class="add"><summary class="btn sec full">＋ Sayohat qo'shish</summary><div style="margin-top:10px">
          <label class="fl"><span>Maskan</span><select id="vr">${S.resorts.map(r => `<option value="${r.id}">${esc(r.name)}</option>`).join("")}</select></label>
          <div class="grid-form">${field("vd", "Sana", new Date().toISOString().slice(0, 10), "date")}${field("vs", "Sarflangan (so'm)", "", "number", 'min="0"')}
          ${field("vp", "Kishilar", 1, "number", 'min="1"')}<label class="fl"><span>Baho</span><select id="vg">${[5, 4, 3, 2, 1].map(i => `<option value="${i}">${"★".repeat(i)}</option>`).join("")}</select></label></div>
          <button class="btn full" id="vadd" style="margin-top:8px">Saqlash</button></div></details></div>
      <div class="card reveal"><h2>⚙️ Mening ma'lumotlarim</h2>
        <label class="fl"><span>Yashash shahri</span><select id="pcity">${Object.keys(CITIES).map(c => `<option ${c === (pr.city || "Toshkent") ? "selected" : ""}>${c}</option>`).join("")}</select></label>
        ${field("pphone", "Telefon", pr.phone || "", "tel")}
        <div class="mut" style="margin:8px 0 6px">Qiziqishlarim</div>${chipsOf("pints", INTERESTS, pr.interests)}
        <button class="btn sec full" style="margin-top:12px" id="psave">Saqlash</button></div>
      ${S.saved.length ? `<div class="sec-title">💚 Saqlanganlar</div>${S.resorts.filter(r => S.saved.includes(String(r.id))).map(resortCard).join("")}` : ""}
      <button class="btn bad full" id="plogout" style="margin-top:6px">Chiqish</button></main>`;
  }
  function clientBind() {
    const mine = S.visits.filter(v => v.userId === S.user.id);
    const been = S.resorts.filter(r => mine.some(v => String(v.resortId) === String(r.id)));
    makeMap($("#vmap"), been, { mini: true, center: been.length ? null : [41.0, 66.0], zoom: 5 });
    bindChips("pints");
    $("#psave").onclick = () => { S.profile.city = $("#pcity").value; S.profile.phone = $("#pphone").value.trim(); S.profile.interests = chipVals("pints");
      S.profile.plan = null; save(); toast("Ma'lumotlar saqlandi"); };
    $("#vadd").onclick = () => {
      persist("visits", { id: uid("t"), userId: S.user.id, resortId: $("#vr").value, date: $("#vd").value, spent: +$("#vs").value || 0, people: +$("#vp").value || 1, rating: +$("#vg").value });
      track("visit_add", "profile"); toast("Sayohat qo'shildi"); render();
    };
    $$("[data-delvisit]").forEach(b => b.onclick = () => { removeDoc("visits", b.dataset.delvisit); render(); });
  }

  // ---------- Tashkilot kabineti ----------
  let orgTab = "dash", editing = null;
  function orgCabinet() {
    const org = myOrg();
    const mine = S.resorts.filter(r => r.owner === S.user.id);
    const tabs = [["dash", "📊 Statistika"], ["resorts", "🏨 Maskanlarim"], ["reviews", "💬 Sharhlar"], ["org", "🏢 Tashkilot"]];
    if (!org) orgTab = "org";
    let body = "";
    if (orgTab === "org") {
      const o = org || {};
      body = `<div class="card reveal"><h2>🏢 Tashkilot ma'lumotlari</h2>${org ? "" : `<div class="note" style="margin-bottom:10px">Boshlash uchun tashkilotingizni ro'yxatdan o'tkazing.</div>`}
        ${field("on", "Tashkilot nomi", o.name)}${field("oinn", "STIR (INN)", o.inn, "text", 'inputmode="numeric" maxlength="9"')}
        ${field("ophone", "Telefon", o.phone, "tel")}${field("oaddr", "Manzil", o.address)}${field("oweb", "Veb-sayt / Telegram", o.web)}
        <label class="fl"><span>Tashkilot haqida</span><textarea id="oabout" maxlength="800">${esc(o.about || "")}</textarea></label>
        <button class="btn full" id="osave" style="margin-top:8px">Saqlash</button></div>`;
    } else if (orgTab === "dash") {
      const mineIds = mine.map(r => String(r.id));
      const ev = (devData ? devData.events : S.events).filter(e => mineIds.includes((e.meta || {}).resortId));
      const nViews = ev.filter(e => e.type === "view_resort").length, nSaves = ev.filter(e => e.type === "save").length;
      const revs = S.reviews.filter(v => mineIds.includes(String(v.resortId)));
      const avgT = mine.length ? Math.round(mine.reduce((s, r) => s + (r.trust || 0), 0) / mine.length) : 0;
      body = `<div class="stat"><div class="card reveal"><b data-count="${mine.length}">0</b><span class="mut">maskan</span></div><div class="card reveal"><b data-count="${avgT}">0</b><span class="mut">o'rtacha Trust Score</span></div>
        <div class="card reveal"><b data-count="${nViews}">0</b><span class="mut">ko'rishlar</span></div><div class="card reveal"><b data-count="${nSaves}">0</b><span class="mut">saqlashlar</span></div>
        <div class="card reveal"><b data-count="${revs.length}">0</b><span class="mut">sharhlar</span></div><div class="card reveal"><b data-count="${revs.filter(v => !v.orgReply).length}">0</b><span class="mut">javobsiz sharh</span></div></div>
        ${mine.map(r => { const a = analysis(r.id); return `<div class="card reveal"><div class="row between"><h3>${r.emoji || ""} ${esc(r.name)}</h3><span class="badge ${cls(r.trust)}">${r.trust == null ? "—" : r.trust}</span></div>
          ${METRICS.map(([k, l]) => metricRow(l, a.metrics[k])).join("")}
          ${a.problems.length ? `<div class="note" style="margin-top:8px">💡 AI maslahati: mijozlar ko'proq <b>${esc(a.problems.slice(0, 2).map(p => p.topic.toLowerCase()).join(" va "))}</b> bo'yicha shikoyat qilmoqda. Shu yo'nalishni yaxshilash Trust Score'ni oshiradi.</div>` : ""}</div>`; }).join("") ||
          `<div class="card mut reveal">Hali maskan qo'shilmagan. "Maskanlarim" bo'limida qo'shing.</div>`}
        <div class="mut">Statistika: ${online ? "server ma'lumotlari" : "shu qurilmadagi faollik"} asosida.</div>`;
    } else if (orgTab === "resorts") {
      body = resortsManager(mine);
    } else {
      const mineIds = mine.map(r => String(r.id));
      const revs = S.reviews.filter(v => mineIds.includes(String(v.resortId))).sort((a, b) => String(b.date).localeCompare(String(a.date)));
      body = revs.map(v => { const a = analysis(v.resortId).reviews.find(x => String(x.id) === String(v.id)) || {};
        return `<div class="card reveal"><div class="row between"><b>${esc(resort(v.resortId).name)}</b><span style="color:#f5b301">${"★".repeat(v.rating)}</span></div>
        <div class="mut">${esc(v.author)} · ${esc(v.date)}</div><div style="margin:6px 0">${esc(v.text)}</div><div class="chips">${a.sentiment ? sentBadge(a.sentiment) : ""}${a.fake >= 50 ? `<span class="badge r">Shubhali ${a.fake}%</span>` : ""}</div>
        <textarea data-reply="${v.id}" placeholder="Mijozga javob yozing..." style="min-height:60px;margin-top:8px" maxlength="600">${esc(v.orgReply || "")}</textarea>
        <button class="btn sec" data-sendreply="${v.id}" style="margin-top:6px">${v.orgReply ? "Javobni yangilash" : "Javob berish"}</button></div>`; }).join("") || `<div class="card mut">Maskanlaringizga hali sharh yozilmagan.</div>`;
    }
    return `${cabHdr("🏨", "Tashkilot kabineti", org ? org.name : S.user.name, `${esc(S.user.email)}${org && org.verified ? " · ✔ Tasdiqlangan" : ""}`)}
      <main><div class="tabs">${tabs.map(([k, l]) => `<button class="${k === orgTab ? "on" : ""}" data-otab="${k}">${l}</button>`).join("")}</div>${body}
      <button class="btn bad full" id="plogout" style="margin-top:6px">Chiqish</button></main>`;
  }
  // Maskan qo'shish/tahrirlash formasi — tashkilot (o'z maskanlari) va admin (barcha maskanlar) uchun
  function resortsManager(list) {
      const r = editing ? (resort(editing) || {}) : {};
      return `<div class="card reveal"><h2>${editing ? "✏️ Maskanni tahrirlash" : "＋ Yangi maskan qo'shish"}</h2>
        ${field("rn", "Nomi", r.name)}<div class="grid-form">${field("rreg", "Viloyat", r.region)}${field("rdis", "Tuman", r.district)}</div>
        ${field("raddr", "Manzil", r.address)}<div class="grid-form">${field("rpr", "Narx (1 kecha, so'm)", r.price, "number", 'min="0"')}${field("rfd", "Ovqat (1 kishi/kun)", r.food, "number", 'min="0"')}
        ${field("rph", "Telefon", r.phone, "tel")}${field("remo", "Belgi (emoji)", r.emoji || "🏞️", "text", 'maxlength="4"')}</div>
        <div class="mut" style="margin:8px 0 6px">Yo'nalishlar</div>${chipsOf("rtags", INTERESTS, r.tags)}
        <label class="fl"><span>Reklama matni (va'dalaringiz)</span><textarea id="rad" maxlength="600">${esc(r.adText || "")}</textarea></label>
        <label class="fl"><span>Batafsil tavsif</span><textarea id="rdesc" maxlength="1500">${esc(r.description || "")}</textarea></label>
        <div class="mut" style="margin:8px 0 6px">📍 Joylashuv — xaritaga bosing</div><div class="minimap" id="pickmap" style="height:240px"></div>
        <div class="mut" id="coords">${r.lat != null ? `${(+r.lat).toFixed(4)}, ${(+r.lng).toFixed(4)}` : "Tanlanmagan"}</div>
        <div class="mut" style="margin:10px 0 6px">📣 Reklama rasmi</div><label class="imgbox" id="radbox" style="max-width:220px">${r.adImage ? `<img src="${r.adImage}">` : `<span class="plus">🖼</span><span>Rasm yuklash</span>`}<input type="file" accept="image/*" id="radimg"></label>
        <div class="row" style="margin-top:12px"><button class="btn" id="rsave" style="flex:1">${editing ? "Saqlash" : "Qo'shish"}</button>${editing ? `<button class="btn sec" id="rcancel">Bekor qilish</button>` : ""}</div></div>
        ${list.map(x => `<div class="card reveal"><div class="row between"><b>${x.emoji || ""} ${esc(x.name)}</b><span class="badge ${cls(x.trust)}">${x.trust == null ? "—" : x.trust}</span></div>
          <div class="mut">${esc(x.region)} · ${reviewsOf(x.id).length} sharh${x.price ? " · " + som(x.price) : ""}</div>
          <div class="row" style="margin-top:8px;flex-wrap:wrap"><button class="btn sec" data-go="resort/${x.id}">Ko'rish</button><button class="btn sec" data-ed="${x.id}">Tahrirlash</button><button class="btn bad" data-dl="${x.id}">O'chirish</button></div></div>`).join("")}`;
  }
  function orgBind() {
    $$("[data-otab]").forEach(b => b.onclick = () => { orgTab = b.dataset.otab; editing = null; render(); });
    if ($("#osave")) $("#osave").onclick = () => {
      const name = $("#on").value.trim(); if (name.length < 2) return toast("Tashkilot nomini kiriting");
      const inn = $("#oinn").value.trim(); if (inn && !/^\d{9}$/.test(inn)) return toast("STIR 9 ta raqamdan iborat bo'lishi kerak");
      const isNew = !myOrg();
      const o = Object.assign({}, myOrg() || { id: uid("o"), owner: S.user.id, verified: false, created: Date.now() },
        { name, inn, phone: $("#ophone").value.trim(), address: $("#oaddr").value.trim(), web: $("#oweb").value.trim(), about: $("#oabout").value.trim() });
      persist("orgs", o); track("org_save", "org"); toast("Tashkilot ma'lumotlari saqlandi"); orgTab = isNew ? "resorts" : "org"; render();
    };
    resortsManagerBind();
    $$("[data-sendreply]").forEach(b => b.onclick = () => {
      const v = S.reviews.find(x => String(x.id) === b.dataset.sendreply); const t = document.querySelector(`[data-reply="${b.dataset.sendreply}"]`).value.trim();
      persist("reviews", Object.assign({}, v, { orgReply: t })); track("org_reply", "org"); toast("Javob yuborildi");
    });
  }
  function resortsManagerBind() {
    if ($("#pickmap")) {
      const r = editing ? resort(editing) : null; let pos = r && r.lat != null ? [+r.lat, +r.lng] : null, img = r ? r.adImage : null, mk = null;
      const m = makeMap($("#pickmap"), [], { tiles: true, center: pos || [41.3, 64.5], zoom: pos ? 11 : 5.5 });
      const setPos = ll => { pos = [ll.lat, ll.lng]; $("#coords").textContent = `${ll.lat.toFixed(4)}, ${ll.lng.toFixed(4)}`;
        if (mk) mk.setLatLng(ll); else mk = L.marker(ll, { icon: pinIcon("#16a34a", "📍") }).addTo(m); };
      if (m) { if (pos) setPos({ lat: pos[0], lng: pos[1] }); m.on("click", e => setPos(e.latlng)); }
      bindChips("rtags");
      $("#radimg").onchange = () => readImage($("#radimg").files[0], 800).then(({ url }) => { img = url; $("#radbox").innerHTML = `<img src="${url}">`; $("#radbox").appendChild($("#radimg")); }).catch(e => toast(e.message));
      $("#rsave").onclick = () => {
        const name = $("#rn").value.trim(); if (name.length < 2) return toast("Maskan nomini kiriting");
        if (!pos) return toast("Xaritada joylashuvni belgilang");
        const base = r || { id: uid("m"), owner: S.user.id, rating: 0, createdAt: new Date().toISOString() };
        const doc = Object.assign({}, base, { name, region: $("#rreg").value.trim() || "—", district: $("#rdis").value.trim() || "—", address: $("#raddr").value.trim(),
          price: +$("#rpr").value || 0, food: +$("#rfd").value || 0, phone: $("#rph").value.trim(), emoji: $("#remo").value.trim() || "🏞️",
          tags: chipVals("rtags"), adText: $("#rad").value.trim(), description: $("#rdesc").value.trim(), lat: pos[0], lng: pos[1], adImage: img || null });
        persist("resorts", doc); delete S.analyses[doc.id]; analysis(doc.id); save();
        track(r ? "resort_edit" : "resort_add", role(), { resortId: String(doc.id) }); toast(r ? "O'zgarishlar saqlandi" : "Maskan qo'shildi va AI tahlil qilindi");
        editing = null; render();
      };
      if ($("#rcancel")) $("#rcancel").onclick = () => { editing = null; render(); };
    }
    $$("[data-ed]").forEach(b => b.onclick = () => { editing = b.dataset.ed; render(); window.scrollTo(0, 0); });
    $$("[data-dl]").forEach(b => b.onclick = () => { if (!confirm("Maskan va uning sharhlari o'chirilsinmi?")) return; deleteResort(b.dataset.dl); render(); });
  }
  function deleteResort(id) {
    S.reviews = S.reviews.filter(v => String(v.resortId) !== String(id));
    removeDoc("resorts", id); delete S.analyses[id]; S.saved = S.saved.filter(x => x !== String(id)); save();
  }

  // ---------- Dasturchi paneli: analitika, AI sifati, foydalanuvchilar, moderatsiya ----------
  let devTab = null, devData = null, devRange = 14;
  const devSource = () => devData || { events: S.events, aiLogs: S.aiLogs, users: S.users.map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role, created: u.created, blocked: u.blocked })), local: true };
  function barChart(rows, h) {
    const max = Math.max(1, ...rows.map(r => r.v));
    return `<div class="chart" style="height:${h || 140}px">${rows.map(r => `<div class="col" title="${esc(r.l)}: ${r.v}"><span class="v">${r.v || ""}</span>
      <i data-h="${Math.round(r.v / max * 100)}"></i><span class="l">${esc(r.l)}</span></div>`).join("")}</div>`;
  }
  function split(items) {
    const tot = items.reduce((s, x) => s + x.v, 0) || 1;
    return `<div class="splitbar">${items.map(x => `<i style="width:${x.v / tot * 100}%;background:${x.c}"></i>`).join("")}</div>
      <div class="chips" style="margin-top:8px">${items.map(x => `<span class="badge n"><span class="dot" style="background:${x.c}"></span>${esc(x.l)}: ${x.v} (${Math.round(x.v / tot * 100)}%)</span>`).join("")}</div>`;
  }
  const ago = ts => { const s = (Date.now() - ts) / 1000; return s < 60 ? "hozir" : s < 3600 ? Math.round(s / 60) + " daq oldin" : s < 86400 ? Math.round(s / 3600) + " soat oldin" : Math.round(s / 86400) + " kun oldin"; };
  const PAGE_NAMES = { home: "Bosh sahifa", search: "Qidiruv", map: "Xarita", plan: "AI reja", resort: "Maskan", profile: "Profil/Kabinet" };
  const rangeChips = () => `<div class="map-chips">${[[1, "24 soat"], [7, "7 kun"], [14, "14 kun"], [30, "30 kun"], [90, "90 kun"]].map(([d, l]) => `<button class="${devRange === d ? "on" : ""}" data-range="${d}">${l}</button>`).join("")}</div>`;
  function eventName(e) {
    const r = (e.meta || {}).resortId; const rn = r && resort(r) ? resort(r).name : "";
    return ({ page_view: "ochdi: " + (PAGE_NAMES[e.page] || e.page), view_resort: "ko'rdi: " + rn, search: "qidirdi: " + ((e.meta || {}).q || ""), review: "sharh yozdi: " + rn,
      plan: "AI reja oldi", save: "saqladi: " + rn, login: "tizimga kirdi", register: "ro'yxatdan o'tdi", logout: "chiqdi", image_compare: "rasm tahlili: " + rn,
      session_start: "ilovani ochdi", visit_add: "sayohat qo'shdi", org_save: "tashkilot ma'lumotini yangiladi", resort_add: "maskan qo'shdi", resort_edit: "maskanni tahrirladi", org_reply: "sharhga javob berdi" })[e.type] || e.type;
  }
  function devPanel() {
    const src = devSource();
    const isAdmin = role() === "admin";
    const tabs = isAdmin ? [["dash", "🛡️ Boshqaruv"], ["users", "👥 Foydalanuvchilar"], ["resorts", "🏨 Maskanlar"], ["mod", "🛠 Sharhlar"], ["analytics", "📈 Analitika"], ["ai", "🤖 AI sifati"]]
      : [["analytics", "📈 Analitika"], ["ai", "🤖 AI sifati"]];
    if (!tabs.some(t => t[0] === devTab)) devTab = tabs[0][0];
    const from = Date.now() - devRange * 86400000;
    const ev = src.events.filter(e => e.ts >= from);
    let body = "";
    if (devTab === "dash") {
      const us = src.users || [];
      const pending = S.orgs.filter(o => !o.verified);
      const sus = S.resorts.reduce((a, r) => a + analysis(r.id).suspicious, 0);
      const logs = src.aiLogs.filter(l => l.ts >= from), runs = logs.filter(l => l.kind === "run").length;
      const bad = logs.filter(l => l.kind === "error" || l.kind === "anomaly" || (l.kind === "feedback" && !l.ok)).length;
      const rate = +(bad / Math.max(1, runs + bad) * 100).toFixed(2);
      const cnt = r => us.filter(u => u.role === r).length;
      body = `<div class="stat stat4"><div class="card reveal"><b data-count="${us.length}">0</b><span class="mut">hisoblar</span></div>
        <div class="card reveal"><b data-count="${S.resorts.length}">0</b><span class="mut">maskanlar</span></div>
        <div class="card reveal"><b data-count="${S.reviews.length}">0</b><span class="mut">sharhlar</span></div>
        <div class="card reveal"><b data-count="${new Set(ev.map(e => e.visitor)).size}">0</b><span class="mut">tashrifchi (${devRange} kun)</span></div></div>
        <div class="card reveal"><h2>👥 Hisoblar turlari</h2>${split([{ l: "Sayohatchi", v: cnt("client"), c: "#16a34a" }, { l: "Tashkilot", v: cnt("org"), c: "#0ea5e9" }, { l: "Analitik", v: cnt("analyst"), c: "#f59e0b" }, { l: "Admin", v: cnt("admin"), c: "#a855f7" }])}</div>
        <div class="grid2"><div class="card reveal"><h2>⏳ Tasdiqlash kutayotgan tashkilotlar</h2>${pending.map(o => `<div class="kv"><span><b>${esc(o.name)}</b> <span class="mut">STIR: ${esc(o.inn || "—")}</span></span>
          <button class="btn" data-verify="${o.id}" style="padding:6px 12px">Tasdiqlash</button></div>`).join("") || `<div class="mut">Hammasi tasdiqlangan ✅</div>`}</div>
        <div class="card reveal"><h2>🚦 Tizim holati</h2><div class="kv"><span>AI xatolik darajasi</span><span class="badge ${rate <= 1 ? "g" : "r"}">${rate}%</span></div>
          <div class="kv"><span>Shubhali sharhlar</span><span class="badge ${sus ? "y" : "g"}">${sus}</span></div>
          <div class="kv"><span>Bloklangan hisoblar</span><b>${us.filter(u => u.blocked).length}</b></div>
          <div class="kv"><span>Server</span><span class="badge ${online ? "g" : "n"}">${online ? "ulangan" : "oflayn"}</span></div></div></div>`;
    } else if (devTab === "resorts") {
      body = resortsManager(S.resorts.slice().sort((a, b) => (a.trust || 0) - (b.trust || 0)));
    } else if (devTab === "analytics") {
      const pv = ev.filter(e => e.type === "page_view");
      const sessions = new Set(ev.map(e => (e.meta || {}).session || e.visitor));
      const visitors = new Set(ev.map(e => e.visitor));
      const act24 = new Set(src.events.filter(e => e.ts > Date.now() - 86400000).map(e => e.visitor));
      const nd = Math.min(devRange, 14), dayRows = [];
      for (let i = nd - 1; i >= 0; i--) { const d = new Date(Date.now() - i * 86400000), ds = d.toDateString();
        dayRows.push({ l: d.getDate() + "." + String(d.getMonth() + 1).padStart(2, "0"), v: new Set(ev.filter(e => new Date(e.ts).toDateString() === ds).map(e => e.visitor)).size }); }
      const plat = { web: new Set(), app: new Set() }; ev.forEach(e => (plat[e.platform] || plat.web).add(e.visitor));
      const roles = {}; ev.forEach(e => { (roles[e.role] = roles[e.role] || new Set()).add(e.visitor); });
      const pages = {}; pv.forEach(e => pages[e.page] = (pages[e.page] || 0) + 1);
      const rv = {}; ev.filter(e => e.type === "view_resort").forEach(e => { const k = (e.meta || {}).resortId; rv[k] = (rv[k] || 0) + 1; });
      const searches = {}; ev.filter(e => e.type === "search").forEach(e => { const q = String((e.meta || {}).q || "").toLowerCase(); searches[q] = (searches[q] || 0) + 1; });
      const hours = new Array(24).fill(0); ev.forEach(e => hours[new Date(e.ts).getHours()]++);
      const n = t => ev.filter(e => e.type === t).length;
      const pmax = Math.max(1, ...Object.values(pages)), rmax = Math.max(1, ...Object.values(rv));
      body = `${rangeChips()}
        <div class="stat stat4"><div class="card reveal"><b data-count="${visitors.size}">0</b><span class="mut">noyob tashrifchi</span></div>
        <div class="card reveal"><b data-count="${sessions.size}">0</b><span class="mut">sessiya</span></div>
        <div class="card reveal"><b data-count="${pv.length}">0</b><span class="mut">sahifa ko'rish</span></div>
        <div class="card reveal"><b data-count="${act24.size}">0</b><span class="mut">faol (24 soat)</span></div></div>
        <div class="card reveal"><h2>📅 Kunlik tashrifchilar</h2>${barChart(dayRows)}</div>
        <div class="grid2"><div class="card reveal"><h2>📱 Platforma</h2>${split([{ l: "Web sayt", v: plat.web.size, c: "#16a34a" }, { l: "Mobil ilova", v: plat.app.size, c: "#0ea5e9" }])}</div>
        <div class="card reveal"><h2>👥 Rollar</h2>${split(Object.entries(roles).map(([k, s], i) => ({ l: ROLE_NAMES[k] || k, v: s.size, c: ["#16a34a", "#0ea5e9", "#f59e0b", "#a855f7"][i % 4] })))}</div></div>
        <div class="card reveal"><h2>🎯 Asosiy harakatlar</h2><div class="stat stat4" style="margin:0">
          <div class="card"><b>${n("plan")}</b><span class="mut">AI reja</span></div><div class="card"><b>${n("review")}</b><span class="mut">sharh</span></div>
          <div class="card"><b>${n("image_compare")}</b><span class="mut">rasm tahlili</span></div><div class="card"><b>${n("register")}</b><span class="mut">ro'yxatdan o'tish</span></div></div></div>
        <div class="grid2"><div class="card reveal"><h2>📄 Sahifalar</h2>${Object.entries(pages).sort((a, b) => b[1] - a[1]).map(([k, v]) => countRow(PAGE_NAMES[k] || k, v, pmax)).join("") || `<div class="mut">Ma'lumot yo'q</div>`}</div>
        <div class="card reveal"><h2>🏨 Ko'p ko'rilgan maskanlar</h2>${Object.entries(rv).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => countRow(resort(k) ? resort(k).name : "#" + k, v, rmax)).join("") || `<div class="mut">Ma'lumot yo'q</div>`}</div></div>
        <div class="grid2"><div class="card reveal"><h2>🕐 Soatlar bo'yicha faollik</h2>${barChart(hours.map((v, i) => ({ l: i % 3 ? "" : String(i), v })), 110)}</div>
        <div class="card reveal"><h2>🔎 Qidiruv so'rovlari</h2>${Object.entries(searches).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `<div class="kv"><span>"${esc(k)}"</span><b>${v}</b></div>`).join("") || `<div class="mut">Ma'lumot yo'q</div>`}</div></div>
        <div class="card reveal"><h2>🟢 Oxirgi faollik — kimlar kirdi</h2><div class="feed">${src.events.slice().sort((a, b) => b.ts - a.ts).slice(0, 30).map(e => `<div class="kv"><span>
          <span class="badge ${e.platform === "app" ? "y" : "g"}">${e.platform === "app" ? "📱 ilova" : "🌐 web"}</span> <b>${esc(e.userName || (e.meta || {}).name || "Mehmon #" + String(e.visitor).slice(-4))}</b>
          <span class="mut">(${ROLE_NAMES[e.role] || e.role}) — ${esc(eventName(e))}</span></span><span class="mut nowrap">${ago(e.ts)}</span></div>`).join("") || `<div class="mut">Hali faollik yo'q</div>`}</div></div>`;
    } else if (devTab === "ai") {
      const logs = src.aiLogs.filter(l => l.ts >= from);
      const runs = logs.filter(l => l.kind === "run").length, errs = logs.filter(l => l.kind === "error"), anom = logs.filter(l => l.kind === "anomaly");
      const fb = logs.filter(l => l.kind === "feedback"), neg = fb.filter(l => !l.ok), js = logs.filter(l => l.kind === "jsError");
      const rate = +((errs.length + anom.length + neg.length) / Math.max(1, runs + errs.length + fb.length) * 100).toFixed(2);
      const sysRate = +((errs.length + anom.length) / Math.max(1, runs + errs.length) * 100).toFixed(2);
      const acc = fb.length ? Math.round((fb.length - neg.length) / fb.length * 100) : null;
      const byRes = {}; neg.concat(errs, anom).forEach(l => { byRes[l.resortId] = (byRes[l.resortId] || 0) + 1; });
      const inc = errs.concat(anom, neg, js).sort((a, b) => b.ts - a.ts).slice(0, 40);
      const rc = rate <= 1 ? "#16a34a" : rate <= 5 ? "#d99a00" : "#dc4a3d";
      body = `${rangeChips()}
        <div class="card reveal ai-glow"><div class="row" style="gap:16px;flex-wrap:wrap"><div>${ring(Math.max(0, Math.round(100 - rate)), 110)}</div><div style="flex:1;min-width:200px">
          <h2 style="margin:0 0 6px">AI xatolik darajasi: <span style="color:${rc}">${rate}%</span></h2>
          <div class="mut">Maqsad: ≤ 1%. Hisob: (tizim xatolari + anomaliyalar + "👎" baholar) / jami AI natijalari. Halqa — AI aniqligi.</div>
          <div class="bar" style="margin-top:10px"><i data-w="${Math.min(100, rate * 10)}" style="background:${rc}"></i></div>
          <div class="mut" style="display:flex;justify-content:space-between;font-size:11px"><span>0%</span><span>1% maqsad</span><span>10%+</span></div>
          ${rate > 1 ? `<div class="note warn" style="margin-top:8px">⚠ Xatolik 1% dan yuqori — quyidagi hodisalarni ko'rib chiqing.</div>` : `<div class="note" style="margin-top:8px">✅ AI sifati me'yorda.</div>`}</div></div></div>
        <div class="stat stat4"><div class="card reveal"><b data-count="${runs}">0</b><span class="mut">AI tahlillar</span></div>
          <div class="card reveal"><b style="color:var(--bad)" data-count="${errs.length}">0</b><span class="mut">tizim xatolari (${sysRate}%)</span></div>
          <div class="card reveal"><b data-count="${anom.length}">0</b><span class="mut">anomaliyalar</span></div>
          <div class="card reveal"><b>${acc == null ? "—" : acc + "%"}</b><span class="mut">foydalanuvchi bahosi (${fb.length})</span></div></div>
        <div class="grid2"><div class="card reveal"><h2>👍 / 👎 Foydalanuvchi fikri</h2>${split([{ l: "To'g'ri", v: fb.length - neg.length, c: "#16a34a" }, { l: "Noto'g'ri", v: neg.length, c: "#dc4a3d" }])}</div>
        <div class="card reveal"><h2>🏨 Muammoli maskanlar</h2>${Object.entries(byRes).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `<div class="kv"><span>${esc(resort(k) ? resort(k).name : k ? "#" + k : "Umumiy (reja / rasm)")}</span><span class="badge r">${v}</span></div>`).join("") || `<div class="mut">Yo'q</div>`}</div></div>
        <div class="card reveal"><h2>🚨 Hodisalar jurnali</h2><div class="feed">${inc.map(l => `<div class="rev"><div class="row between"><span class="badge ${l.kind === "feedback" ? "y" : "r"}">${{ error: "Xatolik", anomaly: "Anomaliya", feedback: "👎 Noto'g'ri", jsError: "JS xato" }[l.kind]}</span><span class="mut">${ago(l.ts)} · ${l.platform === "app" ? "📱" : "🌐"}</span></div>
          <div style="margin-top:4px"><b>${esc(resort(l.resortId) ? resort(l.resortId).name : l.module || "")}</b> ${esc(l.message || l.note || (l.fields ? "Noto'g'ri qiymat: " + l.fields.join(", ") : ""))}${l.source ? ` <span class="mut">(${esc(l.source)})</span>` : ""}</div></div>`).join("") || `<div class="mut">Hodisa yo'q 🎉</div>`}</div>
          <button class="btn sec full" id="selftest" style="margin-top:10px">🧪 AI o'z-o'zini tekshirish (barcha maskanlar)</button></div>`;
    } else if (devTab === "users") {
      const us = (src.users || []).slice().sort((a, b) => (b.created || 0) - (a.created || 0));
      const lastSeen = {}; src.events.forEach(e => { if (e.user) lastSeen[e.user] = Math.max(lastSeen[e.user] || 0, e.ts); });
      const cnt = r => us.filter(u => u.role === r).length;
      body = `<div class="stat stat4"><div class="card reveal"><b>${us.length}</b><span class="mut">jami</span></div><div class="card reveal"><b>${cnt("client")}</b><span class="mut">sayohatchi</span></div>
        <div class="card reveal"><b>${cnt("org")}</b><span class="mut">tashkilot</span></div><div class="card reveal"><b>${cnt("analyst") + cnt("admin")}</b><span class="mut">analitik / admin</span></div></div>
        <div class="card reveal"><h2>👥 Ro'yxatdan o'tganlar</h2>${us.map(u => `<div class="kv user-row"><span><b>${esc(u.name)}</b>${u.blocked ? ` <span class="badge r">bloklangan</span>` : ""} <span class="mut">${esc(u.email)}</span><br>
          <span class="mut">${lastSeen[u.id] ? "oxirgi faollik: " + ago(lastSeen[u.id]) : "faollik yo'q"}</span></span>
          ${u.id === S.user.id ? `<span class="badge g">Siz · ${ROLE_NAMES[u.role]}</span>` : `<span class="row"><select data-urole="${u.id}" style="width:auto;padding:6px 8px">${Object.keys(ROLE_NAMES).filter(k => k !== "guest").map(k => `<option value="${k}" ${k === u.role ? "selected" : ""}>${ROLE_NAMES[k]}</option>`).join("")}</select>
          <button class="btn ${u.blocked ? "sec" : "bad"}" data-ublock="${u.id}" style="padding:6px 10px">${u.blocked ? "Ochish" : "Bloklash"}</button></span>`}</div>`).join("") || `<div class="mut">Hali yo'q</div>`}</div>
        <div class="card reveal"><h2>🏢 Tashkilotlar</h2>${S.orgs.map(o => `<div class="kv"><span><b>${esc(o.name)}</b> <span class="mut">STIR: ${esc(o.inn || "—")}</span></span>
          <button class="btn ${o.verified ? "sec" : ""}" data-verify="${o.id}" style="padding:6px 12px">${o.verified ? "✔ Tasdiqlangan" : "Tasdiqlash"}</button></div>`).join("") || `<div class="mut">Hali yo'q</div>`}</div>`;
    } else {
      const all = S.resorts.flatMap(r => analysis(r.id).reviews.map(v => Object.assign({ rname: r.name }, v))).sort((a, b) => b.fake - a.fake).slice(0, 40);
      const hidden = S.reviews.filter(r => r.hidden);
      body = `<div class="row" style="margin-bottom:12px;flex-wrap:wrap"><button class="btn" id="runall">Barcha maskanlarni qayta tahlil qilish</button>${online ? "" : `<button class="btn bad" id="reset">Demo ma'lumotlarni tiklash</button>`}</div>
        <div class="card reveal"><h2>⚙️ AI navbati</h2>${S.jobs.slice(0, 8).map(j => `<div class="kv"><span>${esc(resort(j.resortId) ? resort(j.resortId).name : "#" + j.resortId)}</span>
          <span class="badge ${j.status === "done" ? "g" : j.status === "error" ? "r" : "y"}">${j.status === "done" ? "Bajarildi" : j.status === "error" ? "Xatolik" : j.progress + "%"}</span></div>`).join("") || `<div class="mut">Bo'sh</div>`}</div>
        <div class="note" style="margin-bottom:10px">Shubha ehtimoli bo'yicha saralangan. Yashirilgan sharh tahlildan chiqariladi.</div>
        ${all.map(v => `<div class="card"><div class="row between"><b>${esc(v.rname)}</b><span class="badge ${v.fake >= 50 ? "r" : v.fake >= 25 ? "y" : "g"}">${v.fake}%</span></div>
        <div class="mut">${esc(v.author)} · ${v.rating}★ · ${esc(v.date)}</div><div style="margin:6px 0">${esc(v.text)}</div>
        ${v.fakeReasons.length ? `<div class="mut">ⓘ ${esc(v.fakeReasons.join("; "))}</div>` : ""}<button class="btn bad" style="margin-top:6px;padding:6px 10px" data-hide="${v.id}">Yashirish</button></div>`).join("")}
        ${hidden.length ? `<div class="sec-title">Yashirilganlar</div>` + hidden.map(v => `<div class="card"><div>${esc(v.text)}</div><button class="btn sec" style="margin-top:6px;padding:6px 10px" data-unhide="${v.id}">Qaytarish</button></div>`).join("") : ""}`;
    }
    return `${cabHdr(isAdmin ? "🛡️" : "📈", isAdmin ? "Admin paneli" : "Analitik paneli", S.user.name, src.local ? "⚪ Lokal ma'lumot (faqat shu qurilma). Barcha foydalanuvchilar uchun serverga ulaning." : "🟢 Server: barcha foydalanuvchilar ma'lumoti")}
      <main><div class="tabs">${tabs.map(([k, l]) => `<button class="${k === devTab ? "on" : ""}" data-dtab="${k}">${l}</button>`).join("")}</div>${body}
      <button class="btn bad full" id="plogout" style="margin-top:6px">Chiqish</button></main>`;
  }
  function devBind() {
    $$("[data-dtab]").forEach(b => b.onclick = () => { devTab = b.dataset.dtab; render(); });
    $$("[data-range]").forEach(b => b.onclick = () => { devRange = +b.dataset.range; render(); });
    if (online && !devData) flush().then(() => api("/api/v1/analytics")).then(d => { devData = d; render(); }).catch(e => toast("Analitika: " + e.message));
    const rerender = (j, d) => d && render();
    if ($("#selftest")) $("#selftest").onclick = () => {
      let bad = 0;
      S.resorts.forEach(r => { try { delete S.analyses[r.id]; const a = computeAnalysis(r.id); aiLog("run", r.id, { selftest: true }); if (validate(a).length) bad++; }
        catch (e) { bad++; aiLog("error", r.id, { message: String(e).slice(0, 300), selftest: true }); } });
      save(); devData = null; toast(bad ? `${bad} ta maskanda muammo topildi` : "Barcha AI testlari muvaffaqiyatli ✅"); render();
    };
    if ($("#runall")) $("#runall").onclick = () => { S.resorts.forEach(r => runAnalysis(r.id, rerender)); toast("Tahlil navbatga qo'yildi"); };
    if ($("#reset")) $("#reset").onclick = () => { if (!confirm("Barcha lokal o'zgarishlar o'chadi. Davom etasizmi?")) return;
      const keep = { user: S.user, users: S.users, events: S.events, aiLogs: S.aiLogs, visitor: S.visitor };
      S = Object.assign(seed(), keep); S.resorts.forEach(r => analysis(r.id)); save(); render(); };
    const setHidden = (id, h) => { const rv = S.reviews.find(x => String(x.id) === String(id)); persist("reviews", Object.assign({}, rv, { hidden: h })); runAnalysis(rv.resortId, rerender); };
    $$("[data-hide]").forEach(b => b.onclick = () => setHidden(b.dataset.hide, true));
    $$("[data-unhide]").forEach(b => b.onclick = () => setHidden(b.dataset.unhide, false));
    $$("[data-verify]").forEach(b => b.onclick = () => { const o = S.orgs.find(x => x.id === b.dataset.verify); persist("orgs", Object.assign({}, o, { verified: !o.verified })); toast(o.verified ? "Tasdiq bekor qilindi" : "Tashkilot tasdiqlandi"); render(); });
    if ($("#pickmap") || $("[data-ed]")) resortsManagerBind();
    // Admin: foydalanuvchi rolini o'zgartirish va bloklash
    const updUser = async (id, patch) => {
      try {
        if (online) { await api(`/api/v1/users/${id}`, { method: "PUT", body: patch }); devData = null; }
        else { const u = S.users.find(x => x.id === id); Object.assign(u, patch); save(); }
        track("user_update", "admin", patch); toast("Saqlandi"); render();
      } catch (e) { toast(e.message); }
    };
    $$("[data-urole]").forEach(s => s.onchange = () => updUser(s.dataset.urole, { role: s.value }));
    $$("[data-ublock]").forEach(b => b.onclick = () => { const u = devSource().users.find(x => x.id === b.dataset.ublock); updUser(u.id, { blocked: !u.blocked }); });
  }

  // ---------- 🔔 Bildirishnomalar va yangilanishlar ----------
  let latest = null; // serverdagi so'nggi versiya
  const newer = (a, b) => { const x = String(a).split(".").map(Number), y = String(b).split(".").map(Number);
    for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); } return false; };
  // Yangi versiyani tekshirish: avval server, keyin saytning o'zidagi version.json, keyin GitHub Pages
  async function checkUpdate() {
    const tryJson = async url => { const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 5000);
      try { const r = await fetch(url + (url.includes("?") ? "&" : "?") + "t=" + Date.now(), { signal: ctl.signal, cache: "no-store" });
        if (!r.ok) throw 0; const d = await r.json(); d._base = url; return d; } finally { clearTimeout(t); } };
    const sources = [];
    if (online) sources.push(API + "/api/v1/version");
    if (/^https?:/.test(location.protocol)) sources.push(new URL("version.json", location.href).href);
    if (window.SAYOHATCHI_UPDATE_URL) sources.push(window.SAYOHATCHI_UPDATE_URL);
    for (const u of sources) { try { latest = await tryJson(u); break; } catch (e) {} }
    if (swReg) swReg.update().catch(() => {});
    drawBell();
  }
  function notifications() {
    const n = [];
    if (latest && newer(latest.version, APP_VERSION))
      n.push({ id: "upd-" + latest.version, icon: "🚀", title: `Yangi versiya: ${latest.version}`, text: (latest.notes || []).join(" · "), action: "update", important: true });
    if (S.seenVersion !== APP_VERSION) {
      const c = CHANGELOG.find(x => x.v === APP_VERSION);
      n.push({ id: "new-" + APP_VERSION, icon: "✨", title: `Nima yangi (v${APP_VERSION})`, text: c ? c.notes.join(" · ") : "" });
    }
    const r = role();
    if (r === "client") S.reviews.filter(v => v.userId === S.user.id && v.orgReply).forEach(v =>
      n.push({ id: "rep-" + v.id + "-" + v.orgReply.length, icon: "💬", title: `${resort(v.resortId) ? resort(v.resortId).name : "Maskan"} javob berdi`, text: v.orgReply, go: "resort/" + v.resortId }));
    if (r === "org") {
      const mine = S.resorts.filter(x => x.owner === S.user.id).map(x => String(x.id));
      S.reviews.filter(v => mine.includes(String(v.resortId)) && !v.orgReply && !v.hidden).forEach(v =>
        n.push({ id: "rev-" + v.id, icon: v.rating <= 2 ? "⚠️" : "⭐", title: `Yangi sharh: ${resort(v.resortId).name}`, text: `${v.author} (${v.rating}★): ${v.text}`, go: "profile", tab: "reviews" }));
      const o = myOrg(); if (o && o.verified) n.push({ id: "ver-" + o.id, icon: "✅", title: "Tashkilotingiz tasdiqlandi", text: "Endi maskanlaringizda \"Tasdiqlangan\" belgisi ko'rinadi." });
    }
    if (r === "admin") S.orgs.filter(o => !o.verified).forEach(o => n.push({ id: "org-" + o.id, icon: "🏢", title: "Tashkilot tasdiqlashni kutmoqda", text: o.name, go: "profile", tab: "dash" }));
    if (r === "admin" || r === "analyst") {
      const day = S.aiLogs.filter(l => l.ts > Date.now() - 86400000), runs = day.filter(l => l.kind === "run").length;
      const bad = day.filter(l => l.kind === "error" || l.kind === "anomaly" || (l.kind === "feedback" && !l.ok)).length;
      const rate = bad / Math.max(1, runs + bad) * 100;
      if (bad && rate > 1) n.push({ id: "ai-" + new Date().toDateString() + "-" + bad, icon: "🚨", title: `AI xatolik darajasi ${rate.toFixed(1)}%`, text: `Oxirgi 24 soatda ${bad} ta hodisa. Maqsad ≤ 1%.`, go: "profile", tab: "ai", important: true });
    }
    const read = S.readNotif || [];
    return n.map(x => Object.assign(x, { unread: !read.includes(x.id) }));
  }
  function drawBell() {
    const b = $("#bell"); if (!b) return;
    const k = notifications().filter(x => x.unread).length;
    b.querySelector(".count").textContent = k > 9 ? "9+" : k;
    b.classList.toggle("has", k > 0);
  }
  function openBell() {
    const list = notifications();
    const box = document.createElement("div"); box.className = "sheet-wrap";
    box.innerHTML = `<div class="sheet"><div class="row between"><h2 style="margin:0">🔔 Bildirishnomalar</h2><button class="icon-btn" data-close aria-label="Yopish">✕</button></div>
      <div class="mut" style="margin:4px 0 12px">Ilova versiyasi: v${APP_VERSION}${latest ? ` · serverdagi: v${esc(latest.version)}` : online ? "" : " · oflayn"}</div>
      ${list.map(x => `<div class="notif ${x.unread ? "unread" : ""} ${x.important ? "imp" : ""}" data-nid="${esc(x.id)}"><span class="ni">${x.icon}</span><div style="flex:1;min-width:0"><b>${esc(x.title)}</b>
        <div class="mut">${esc(x.text)}</div>${x.action === "update" ? `<button class="btn" data-update style="margin-top:8px">⬇️ Hozir yangilash</button>` : ""}</div></div>`).join("") || `<div class="mut" style="text-align:center;padding:24px">Yangi xabar yo'q 🌿</div>`}
      <button class="btn sec full" data-check style="margin-top:10px">🔄 Yangilanishni tekshirish</button></div>`;
    document.body.appendChild(box); requestAnimationFrame(() => box.classList.add("on"));
    const close = () => { box.classList.remove("on"); setTimeout(() => box.remove(), 300); };
    // Ochilganda hammasi o'qilgan deb belgilanadi
    S.readNotif = [...new Set((S.readNotif || []).concat(list.map(x => x.id)))].slice(-300); S.seenVersion = APP_VERSION; save(); drawBell();
    box.onclick = e => {
      if (e.target === box || e.target.closest("[data-close]")) return close();
      if (e.target.closest("[data-update]")) return doUpdate();
      if (e.target.closest("[data-check]")) { toast("Tekshirilmoqda..."); return checkUpdate().then(() => { close(); setTimeout(openBell, 320); if (!latest) toast("Server bilan aloqa yo'q"); }); }
      const it = e.target.closest("[data-nid]"); const x = it && list.find(n => n.id === it.dataset.nid);
      if (x && x.go) { if (x.tab) { orgTab = x.tab; devTab = x.tab; } close(); go(x.go); }
    };
    track("bell_open", current.split("/")[0], { count: list.length });
  }
  function doUpdate() {
    track("update_click", "bell", { from: APP_VERSION, to: latest && latest.version });
    if (PLATFORM === "app") {
      // Ilova: yangi APK yuklab olinadi (Android o'rnatishni so'raydi)
      let url = null;
      try { url = latest && latest.apk ? new URL(latest.apk, /\/api\/v1\/version/.test(latest._base) ? (API || location.origin) + "/" : latest._base).href : null; } catch (e) {}
      if (!url || !/^https?:/.test(url)) return toast("Yangilanish manzili topilmadi");
      toast("Yangi versiya yuklanmoqda..."); location.href = url;
    } else {
      // Web: yangi fayllarni qayta yuklash
      // Web: service worker yangi fayllarni oladi, keyin sahifa qayta yuklanadi
      toast("Yangilanmoqda...");
      const reload = () => location.replace(location.pathname + "?v=" + encodeURIComponent(latest ? latest.version : Date.now()));
      (swReg ? swReg.update().catch(() => {}) : Promise.resolve()).then(() => caches && caches.keys ? caches.keys().then(k => Promise.all(k.map(x => caches.delete(x)))) : 0).catch(() => {}).then(() => setTimeout(reload, 300));
    }
  }
  // ---------- Web ilovani o'rnatish (PWA) ----------
  let swReg = null, installEvt = null;
  if ("serviceWorker" in navigator && /^https?:/.test(location.protocol) && PLATFORM === "web")
    navigator.serviceWorker.register("sw.js").then(r => { swReg = r; }).catch(() => {});
  const standalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); installEvt = e; render(); });
  window.addEventListener("appinstalled", () => { installEvt = null; track("pwa_installed", "home"); toast("Ilova o'rnatildi! Endi bosh ekrandan oching"); render(); });
  function installHtml() {
    if (PLATFORM !== "web" || standalone()) return "";
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (!installEvt && !ios) return "";
    return `<div class="card reveal install"><div class="ic">📲</div><div style="flex:1"><h3>Ilova sifatida o'rnating</h3>
      <div class="mut">${ios ? "Safari'da «Ulashish» → «Bosh ekranga qo'shish» ni bosing" : "Bosh ekrandan bir bosishda oching, internetsiz ham ishlaydi"}</div></div>
      ${installEvt ? `<button class="btn" id="pwa">O'rnatish</button>` : ""}</div>`;
  }
  document.addEventListener("click", e => { if (e.target.closest("#pwa") && installEvt) { installEvt.prompt(); installEvt.userChoice.then(c => { track("pwa_prompt", "home", { outcome: c.outcome }); installEvt = null; render(); }); } });

  const bell = document.createElement("button"); bell.id = "bell"; bell.setAttribute("aria-label", "Bildirishnomalar");
  bell.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg><span class="count">0</span>`;
  bell.onclick = openBell; document.body.appendChild(bell);
  setInterval(checkUpdate, 10 * 60 * 1000);

  // ---------- Router ----------
  const ICONS = {
    home: '<path d="M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-5-5"/>',
    map: '<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>',
    plan: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    profile: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>'
  };
  const navLabel = () => S.user ? { client: "Kabinet", org: "Tashkilot", analyst: "Analitika", admin: "Admin" }[S.user.role] : "Profil";
  const NAV = () => [["home", "Bosh sahifa"], ["search", "Qidiruv"], ["map", "Xarita"], ["plan", "AI reja"], ["profile", navLabel()]];
  const hist = [];
  let current = "home";
  function go(route, noPush) {
    if (!noPush && current !== route) hist.push(current);
    current = route; if (!route.startsWith("resort/")) resortTab = "ai"; render(true); window.scrollTo(0, 0);
  }
  window.goBack = function () { if (hist.length) { current = hist.pop(); render(true); return true; } if (current !== "home") { current = "home"; render(true); return true; } return false; };
  function render(isNav) {
    const [name, arg] = current.split(/\/(.*)/s);
    const v = views[name] || views.home;
    maps.forEach(m => { try { m.remove(); } catch (e) {} }); maps = [];
    const app = $("#app"); app.innerHTML = `<div class="${isNav ? "page" : ""}">${v(arg)}</div>`;
    try { v.bind && v.bind(arg); } catch (e) { console.error(e); aiLog("jsError", null, { message: String(e).slice(0, 300), source: "bind:" + name }); }
    animate(app);
    $("#nav").innerHTML = NAV().map(([k, l]) => `<button class="${name === k ? "on" : ""}" data-nav="${k}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[k]}</svg>${l}</button>`).join("");
    $$("[data-nav]").forEach(el => el.onclick = () => go(el.dataset.nav));
    $$("[data-back]").forEach(el => el.onclick = () => window.goBack());
    if (isNav) track("page_view", name);
    drawBell();
  }
  // data-go elementlari keyin qayta chizilishi mumkin, shuning uchun delegatsiya
  $("#app").addEventListener("click", e => { const el = e.target.closest("[data-go]"); if (el) { e.preventDefault(); go(el.dataset.go); } });
  track("session_start", "home", { lang: navigator.language, screen: screen.width + "x" + screen.height });
  render(true);
  syncFromServer().then(checkUpdate);
})();
