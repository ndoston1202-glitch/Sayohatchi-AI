// Sayohatchi AI — mobil ilova (Smart Tourism Review AI MVP)
(function () {
  const KEY = "sayohatchi_v1";
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ---------- Holat (localStorage) ----------
  function seed() {
    let id = 1;
    return {
      resorts: DEMO_RESORTS.map(r => Object.assign({ trust: null, createdAt: "2026-01-01" }, r)),
      reviews: DEMO_REVIEWS.map(([resortId, author, rating, text, date]) => ({ id: id++, resortId, author, rating, text, date, source: "demo", hidden: false })),
      analyses: {}, jobs: [], saved: [], user: null, nextId: id, nextResortId: 100
    };
  }
  let S;
  try { S = JSON.parse(localStorage.getItem(KEY)) || seed(); } catch (e) { S = seed(); }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };

  const resort = id => S.resorts.find(r => r.id === +id);
  const reviewsOf = id => S.reviews.filter(r => r.resortId === +id && !r.hidden);
  const isAdmin = () => S.user && S.user.role === "admin";

  function toast(m) { const t = $("#toast"); t.textContent = m; t.classList.add("on"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("on"), 2200); }
  const color = v => v == null ? "#9aa0b4" : v >= 75 ? "#1f9d55" : v >= 55 ? "#e0a100" : "#d64545";
  const cls = v => v == null ? "n" : v >= 75 ? "g" : v >= 55 ? "y" : "r";

  // ---------- Tahlil (navbat bilan ishlaydigan job) ----------
  function runAnalysis(id, cb) {
    const job = { id: Date.now() + Math.random(), resortId: +id, status: "running", progress: 0, error: null, startedAt: new Date().toISOString(), finishedAt: null };
    S.jobs.unshift(job); S.jobs = S.jobs.slice(0, 30);
    const step = () => {
      job.progress += 20;
      if (job.progress < 100) { setTimeout(step, 120); cb && cb(job); return; }
      try {
        const r = resort(id); const prev = S.analyses[id];
        const a = AI.analyzeResort(r, reviewsOf(id), prev ? prev.imageScore : null);
        a.imageScore = prev ? prev.imageScore : null; a.imageResult = prev ? prev.imageResult : null;
        S.analyses[id] = a; r.trust = a.overall;
        job.status = "done";
      } catch (e) { job.status = "error"; job.error = String(e); }
      job.finishedAt = new Date().toISOString(); save(); cb && cb(job, true);
    };
    setTimeout(step, 120);
  }
  function analysis(id) {
    if (!S.analyses[id]) { const r = resort(id); const a = AI.analyzeResort(r, reviewsOf(id), null); S.analyses[id] = a; r.trust = a.overall; save(); }
    return S.analyses[id];
  }
  S.resorts.forEach(r => analysis(r.id));

  // ---------- UI bloklari ----------
  function ring(v, size) {
    size = size || 84; const R = size / 2 - 7, C = 2 * Math.PI * R, p = v == null ? 0 : v / 100;
    return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${R}" fill="none" stroke="#eceef5" stroke-width="8"/>
      <circle cx="${size / 2}" cy="${size / 2}" r="${R}" fill="none" stroke="${color(v)}" stroke-width="8" stroke-linecap="round" stroke-dasharray="${C * p} ${C}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
      <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" font-size="${size / 3.4}" font-weight="800" fill="#1d1d2b">${v == null ? "—" : v}</text></svg>`;
  }
  const METRICS = [["reliability", "Sharh ishonchliligi"], ["service", "Xizmat sifati"], ["cleanliness", "Tozalik"], ["staff", "Xodimlar"],
    ["food", "Ovqat"], ["price", "Narx/Sifat"], ["adMatch", "Reklama–real mosligi"]];
  const metricRow = (label, v, w) => `<div class="metric"><div class="row between"><span>${label} <span class="mut">${w ? w + "%" : ""}</span></span>
    <b style="color:${color(v)}">${v == null ? "Ma'lumot yetarli emas" : v}</b></div><div class="bar"><i style="width:${v || 0}%;background:${color(v)}"></i></div></div>`;
  const sentBadge = s => s === "positive" ? `<span class="badge g">Ijobiy</span>` : s === "negative" ? `<span class="badge r">Salbiy</span>` : `<span class="badge n">Neytral</span>`;

  function resortCard(r) {
    const a = analysis(r.id); const prob = a.problems[0];
    return `<div class="card res" data-go="resort/${r.id}"><div class="sc" style="background:${color(r.trust)}">${r.trust == null ? "—" : r.trust}</div>
      <div style="flex:1;min-width:0"><h3>${esc(r.name)}</h3><div class="mut">${esc(r.region)}, ${esc(r.district)}</div>
      <div class="mut" style="margin-top:4px">⭐ ${r.rating.toFixed(1)} · ${reviewsOf(r.id).length} sharh${prob ? ` · <span style="color:var(--bad)">Muammo: ${esc(prob.topic)}</span>` : ""}</div></div></div>`;
  }

  // ---------- Ekranlar ----------
  const views = {};

  views.home = () => {
    const top = S.resorts.slice().sort((a, b) => (b.trust || 0) - (a.trust || 0)).slice(0, 4);
    return `<header><div class="brand">🧭 Sayohatchi AI</div><h1>Dam olish maskanini tanlashdan oldin AI orqali tekshiring</h1>
      <form class="search" id="hs"><input id="hq" placeholder="Maskan nomi yoki hudud"><button class="btn">Tekshirish</button></form></header>
      <main><h2>Trust Score qanday ishlaydi?</h2><div class="info3">
      <div class="card"><h3>📝 1. Sharhlar tahlili</h3><div class="mut">AI har bir sharhning kayfiyati va mavzusini (tozalik, ovqat, xizmat...) aniqlaydi.</div></div>
      <div class="card"><h3>🛡️ 2. Shubhali sharhlar</h3><div class="mut">Takroriy, bir xil yoki reklama xarakteridagi sharhlar belgilanib, bahoga kam ta'sir qiladi.</div></div>
      <div class="card"><h3>📷 3. Reklama vs Real</h3><div class="mut">Reklama rasmi va mijoz rasmini solishtirib, 0–100 oralig'ida yagona ishonch bahosini beradi.</div></div></div>
      <h2 style="margin-top:16px">Mashhur maskanlar</h2>${top.map(resortCard).join("")}
      <p class="mut" style="text-align:center">AI natijalari yakuniy haqiqat emas, ehtimoliy tahlil va tavsiya.</p></main>`;
  };
  views.home.bind = () => $("#hs").onsubmit = e => { e.preventDefault(); go("search/" + encodeURIComponent($("#hq").value)); };

  views.search = (q) => {
    q = decodeURIComponent(q || "");
    const regions = [...new Set(S.resorts.map(r => r.region))];
    return `<header><div class="brand">🔎 Qidiruv</div><form class="search" id="ss" style="margin-top:12px"><input id="sq" value="${esc(q)}" placeholder="Nomi, viloyat yoki tuman"><button class="btn">Izlash</button></form></header>
      <main><div class="row" style="margin-bottom:12px"><select id="sr"><option value="">Barcha viloyatlar</option>${regions.map(r => `<option>${esc(r)}</option>`).join("")}</select>
      <select id="so"><option value="trust">Trust Score bo'yicha</option><option value="rating">Reyting bo'yicha</option><option value="name">Nomi bo'yicha</option></select></div><div id="results"></div></main>`;
  };
  views.search.bind = () => {
    const render = () => {
      const q = $("#sq").value.toLowerCase().trim(), reg = $("#sr").value, so = $("#so").value;
      let list = S.resorts.filter(r => (!reg || r.region === reg) && (!q || [r.name, r.region, r.district, r.address].join(" ").toLowerCase().includes(q)));
      list.sort((a, b) => so === "name" ? a.name.localeCompare(b.name) : so === "rating" ? b.rating - a.rating : (b.trust || 0) - (a.trust || 0));
      $("#results").innerHTML = list.length ? `<div class="mut" style="margin-bottom:8px">${list.length} ta natija</div>` + list.map(resortCard).join("") : `<div class="card mut">Hech narsa topilmadi.</div>`;
    };
    $("#ss").onsubmit = e => { e.preventDefault(); render(); };
    $("#sq").oninput = render; $("#sr").onchange = render; $("#so").onchange = render; render();
  };

  let resortTab = "ai";
  views.resort = (id) => {
    const r = resort(id); if (!r) return `<main>Topilmadi</main>`;
    const a = analysis(id); const saved = S.saved.includes(r.id);
    const tabs = [["ai", "AI tahlil"], ["reviews", "Sharhlar"], ["image", "Reklama vs Real"], ["add", "Sharh qo'shish"]];
    let body = "";
    if (resortTab === "ai") {
      body = `<div class="card"><h2>🤖 AI xulosasi</h2><p style="margin:0;line-height:1.5">${esc(a.summary)}</p>
        <p class="mut">Ishonch darajasi: ${Math.round(a.confidence * 100)}%${a.confidence < 0.6 ? " — ma'lumot kam, natija taxminiy" : ""}</p>
        <button class="btn sec full" id="reanalyze">🔄 AI tahlilini yangilash</button><div class="prog" style="margin-top:8px;display:none" id="pg"><i style="width:0"></i></div></div>
        <div class="card"><h2>📊 7 ta asosiy ko'rsatkich</h2>${METRICS.map(([k, l]) => metricRow(l, a.metrics[k], AI.WEIGHTS[k])).join("")}</div>
        <div class="card"><h2>⚠️ Eng ko'p uchraydigan muammolar</h2>${a.problems.length ? a.problems.map(p => `<div class="row between rev"><span>${esc(p.topic)}</span><span class="badge r">${p.count} ta sharhda</span></div>`).join("") : `<div class="mut">Jiddiy muammo aniqlanmadi.</div>`}</div>
        <div class="card"><h2>✅ Kuchli tomonlar</h2><div class="chips">${a.strengths.map(p => `<span class="badge g">${esc(p.topic)} · ${p.count}</span>`).join("") || `<span class="mut">Ma'lumot yetarli emas</span>`}</div></div>
        <div class="card"><h2>📣 Reklama matni</h2><div class="mut">${esc(r.adText)}</div></div>`;
    } else if (resortTab === "reviews") {
      const sus = a.reviews.filter(x => x.fake >= 50).length;
      body = `<div class="card"><div class="row between"><h2>Sharhlar (${a.reviews.length})</h2>${sus ? `<span class="badge y">${sus} shubhali</span>` : ""}</div>
        ${a.reviews.slice().sort((x, y) => y.date.localeCompare(x.date)).map(v => `<div class="rev"><div class="row between"><b>${esc(v.author)}</b><span>${"★".repeat(v.rating)}<span style="color:#ccc">${"★".repeat(5 - v.rating)}</span></span></div>
          <div style="margin:6px 0">${esc(v.text)}</div>
          <div class="chips">${sentBadge(v.sentiment)}${v.topics.map(t => `<span class="badge ${t.score > 0.1 ? "g" : t.score < -0.1 ? "r" : "n"}">${esc(t.topic)}</span>`).join("")}
          <span class="badge ${v.fake >= 50 ? "r" : v.fake >= 25 ? "y" : "g"}">Shubha: ${v.fake}%</span></div>
          ${v.fakeReasons.length && v.fake >= 25 ? `<div class="mut" style="margin-top:4px">ⓘ ${esc(v.fakeReasons.join("; "))}</div>` : ""}
          <div class="mut" style="margin-top:4px">${esc(v.date)} · ${v.source === "user" ? "foydalanuvchi" : "admin/ochiq manba"}</div></div>`).join("") || `<div class="mut">Hali sharh yo'q.</div>`}</div>
        <div class="note">Shubha ko'rsatkichi "soxta" degan hukm emas — faqat tekshiruv indikatori.</div>`;
    } else if (resortTab === "image") {
      const ir = a.imageResult;
      body = `<div class="card"><h2>📷 Reklama vs Real</h2><div class="mut" style="margin-bottom:10px">Reklama rasmi va o'zingiz (yoki boshqa mijoz) olgan real rasmni yuklang.</div>
        <div class="imgs"><label class="imgbox" id="b1"><span>＋ Reklama rasmi</span><input type="file" accept="image/*" id="f1"></label>
        <label class="imgbox" id="b2"><span>＋ Real rasm</span><input type="file" accept="image/*" id="f2"></label></div>
        <button class="btn full" style="margin-top:10px" id="cmp">Tahlil qilish</button></div>
        <div id="cmpres">${ir ? imgResult(ir) : ""}</div>
        <div class="note">Natija faqat ko'rinadigan farqlarga asoslangan indikator; ekspert yoki sud xulosasi emas.</div>`;
    } else {
      body = `<div class="card"><h2>✍️ Sharh qoldirish</h2>${S.user ? "" : `<div class="note" style="margin-bottom:10px">Ismingiz ko'rinishi uchun Profil bo'limida kiring (ixtiyoriy).</div>`}
        <div class="stars" id="stars">${[1, 2, 3, 4, 5].map(i => `<button data-s="${i}">★</button>`).join("")}</div>
        <textarea id="rt" placeholder="Tajribangiz: tozalik, ovqat, xodimlar, narx..." maxlength="1000"></textarea>
        <input type="date" id="rd" style="margin-top:8px" value="${new Date().toISOString().slice(0, 10)}">
        <button class="btn full" style="margin-top:10px" id="rsend">Yuborish</button></div>`;
    }
    return `<header><button class="back" data-back>‹ Orqaga</button><div class="row between"><div style="min-width:0"><h1 style="margin:4px 0">${esc(r.name)}</h1>
      <div style="opacity:.85;font-size:13px">📍 ${esc(r.region)}, ${esc(r.district)} · ⭐ ${r.rating.toFixed(1)}</div></div>
      <div style="background:#fff;border-radius:50%">${ring(r.trust)}</div></div>
      <div class="row between" style="margin-top:10px"><span style="font-size:13px;opacity:.9">AI Trust Score</span><button class="save" id="sv">${saved ? "♥ Saqlangan" : "♡ Saqlash"}</button></div></header>
      <main><div class="tabs">${tabs.map(([k, l]) => `<button class="${k === resortTab ? "on" : ""}" data-tab="${k}">${l}</button>`).join("")}</div>${body}</main>`;
  };
  function imgResult(ir) {
    return `<div class="card"><div class="row"><div>${ring(ir.score)}</div><div><h2 style="margin:0">Moslik: ${ir.score}%</h2>
      <div class="mut">${ir.score >= 70 ? "Reklama realga yaqin" : ir.score >= 50 ? "Qisman mos" : "Sezilarli tafovut"}</div></div></div>
      ${[["Rang", ir.details.color], ["Kompozitsiya", ir.details.structure], ["Yorug'lik", ir.details.light], ["To'yinganlik", ir.details.saturation]].map(([l, v]) => metricRow(l, v)).join("")}
      <h3 style="margin-top:10px">Aniqlangan farqlar</h3>${ir.diffs.map(d => `<div class="rev">• ${esc(d)}</div>`).join("")}</div>`;
  }
  views.resort.bind = (id) => {
    document.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => { resortTab = b.dataset.tab; render(); });
    $("#sv").onclick = () => { const i = S.saved.indexOf(+id); i >= 0 ? S.saved.splice(i, 1) : S.saved.push(+id); save(); render(); };
    if ($("#reanalyze")) $("#reanalyze").onclick = () => {
      $("#pg").style.display = "block";
      runAnalysis(id, (job, done) => { const p = $("#pg i"); if (p) p.style.width = job.progress + "%"; if (done) { toast(job.status === "done" ? "Tahlil yangilandi" : "Xatolik: " + job.error); render(); } });
    };
    if ($("#f1")) {
      const imgs = {};
      const load = (inp, box, key) => inp.onchange = () => {
        const f = inp.files[0]; if (!f) return;
        if (!/^image\//.test(f.type)) return toast("Faqat rasm fayllari");
        if (f.size > 10 * 1024 * 1024) return toast("Rasm hajmi 10 MB dan oshmasin");
        const rd = new FileReader(); rd.onload = () => { const im = new Image(); im.onload = () => { imgs[key] = im; }; im.src = rd.result;
          $(box).innerHTML = `<img src="${rd.result}">`; $(box).appendChild(inp); }; rd.readAsDataURL(f);
      };
      load($("#f1"), "#b1", "ad"); load($("#f2"), "#b2", "real");
      $("#cmp").onclick = () => {
        if (!imgs.ad || !imgs.real) return toast("Ikkala rasmni ham yuklang");
        const res = AI.compareImages(imgs.ad, imgs.real); const a = analysis(id);
        a.imageResult = res; a.imageScore = res.score; save();
        $("#cmpres").innerHTML = imgResult(res);
        runAnalysis(id, (j, done) => { if (done) { toast("Trust Score rasm tahlili bilan yangilandi"); } });
      };
    }
    if ($("#stars")) {
      let stars = 0;
      document.querySelectorAll("#stars button").forEach(b => b.onclick = () => { stars = +b.dataset.s; document.querySelectorAll("#stars button").forEach(x => x.classList.toggle("on", +x.dataset.s <= stars)); });
      $("#rsend").onclick = () => {
        const text = $("#rt").value.trim();
        if (!stars) return toast("Baho tanlang"); if (text.length < 10) return toast("Sharh kamida 10 belgi bo'lsin");
        S.reviews.push({ id: S.nextId++, resortId: +id, author: S.user ? S.user.name : "Mehmon", rating: stars, text, date: $("#rd").value, source: "user", hidden: false });
        save(); resortTab = "reviews"; toast("Sharh qo'shildi, AI tahlil qilmoqda...");
        runAnalysis(id, (j, done) => done && render());
      };
    }
  };

  views.saved = () => {
    const list = S.resorts.filter(r => S.saved.includes(r.id));
    return `<header><div class="brand">♥ Saqlanganlar</div></header><main>${list.map(resortCard).join("") || `<div class="card mut">Hali saqlangan maskan yo'q. Maskan sahifasida "Saqlash" tugmasini bosing.</div>`}</main>`;
  };

  views.profile = () => {
    if (!S.user) return `<header><div class="brand">👤 Profil</div></header><main><div class="card"><h2>Kirish</h2>
      <input id="pn" placeholder="Ismingiz" style="margin-bottom:8px"><input id="pe" type="email" placeholder="Email" style="margin-bottom:8px">
      <button class="btn full" id="plogin">Kirish / Ro'yxatdan o'tish</button>
      <p class="mut">Admin sifatida kirish uchun ismni <b>admin</b> deb yozing.</p></div></main>`;
    const mine = S.reviews.filter(r => r.source === "user" && r.author === S.user.name);
    return `<header><div class="brand">👤 Profil</div><h1>${esc(S.user.name)}</h1><div style="opacity:.85">${esc(S.user.email || "")} · ${S.user.role === "admin" ? "Administrator" : "Foydalanuvchi"}</div></header>
      <main>${isAdmin() ? `<button class="btn full" data-go="admin" style="margin-bottom:12px">🛠 Admin panel</button>` : ""}
      <div class="card"><h2>Mening sharhlarim (${mine.length})</h2>${mine.map(r => `<div class="rev"><b>${esc(resort(r.resortId) ? resort(r.resortId).name : "")}</b> · ${"★".repeat(r.rating)}<div>${esc(r.text)}</div>
      <button class="btn bad" style="margin-top:6px;padding:6px 10px" data-delrev="${r.id}">O'chirish</button></div>`).join("") || `<div class="mut">Hali sharh yozmagansiz.</div>`}</div>
      <button class="btn sec full" id="plogout">Chiqish</button>
      <p class="mut" style="text-align:center;margin-top:16px">Sayohatchi AI · MVP v1.0<br>Milliy AI Xakaton 2026 — 22-muammo</p></main>`;
  };
  views.profile.bind = () => {
    if ($("#plogin")) $("#plogin").onclick = () => {
      const name = $("#pn").value.trim(); if (name.length < 2) return toast("Ismni kiriting");
      S.user = { name, email: $("#pe").value.trim(), role: name.toLowerCase() === "admin" ? "admin" : "user" }; save(); render();
    };
    if ($("#plogout")) $("#plogout").onclick = () => { S.user = null; save(); render(); };
    document.querySelectorAll("[data-delrev]").forEach(b => b.onclick = () => {
      const rv = S.reviews.find(x => x.id === +b.dataset.delrev); S.reviews = S.reviews.filter(x => x !== rv); save();
      runAnalysis(rv.resortId, (j, d) => d && render()); toast("Sharh va unga bog'liq tahlil yangilandi");
    });
  };

  let adminTab = "dash";
  views.admin = () => {
    if (!isAdmin()) return `<main><div class="card">Faqat administrator uchun.</div></main>`;
    const tabs = [["dash", "Dashboard"], ["resorts", "Maskanlar"], ["reviews", "Sharhlar"], ["jobs", "AI Jobs"]];
    let body = "";
    if (adminTab === "dash") {
      const allA = S.resorts.map(r => analysis(r.id));
      const sus = allA.reduce((s, a) => s + a.suspicious, 0);
      body = `<div class="stat"><div class="card"><b>${S.resorts.length}</b><span class="mut">Maskanlar</span></div><div class="card"><b>${S.reviews.length}</b><span class="mut">Sharhlar</span></div>
        <div class="card"><b>${Object.keys(S.analyses).length}</b><span class="mut">AI tahlillar</span></div><div class="card"><b style="color:var(--bad)">${sus}</b><span class="mut">Shubhali sharhlar</span></div>
        <div class="card"><b>${S.jobs.filter(j => j.status === "error").length}</b><span class="mut">Xatolar</span></div><div class="card"><b>${S.reviews.filter(r => r.source === "user").length}</b><span class="mut">Foydalanuvchi sharhlari</span></div></div>
        <button class="btn full" style="margin-top:12px" id="runall">Barcha maskanlar uchun tahlilni ishga tushirish</button>
        <button class="btn bad full" style="margin-top:8px" id="reset">Demo ma'lumotlarni tiklash</button>`;
    } else if (adminTab === "resorts") {
      body = `<div class="card"><h2>Yangi maskan qo'shish</h2><input id="an" placeholder="Nomi" style="margin-bottom:8px"><input id="ar" placeholder="Viloyat" style="margin-bottom:8px">
        <input id="ad" placeholder="Tuman" style="margin-bottom:8px"><input id="aa" placeholder="Manzil" style="margin-bottom:8px"><input id="ag" type="number" step="0.1" min="1" max="5" placeholder="Reyting (1–5)" style="margin-bottom:8px">
        <textarea id="at" placeholder="Reklama matni (va'dalar)"></textarea><button class="btn full" style="margin-top:8px" id="aadd">Qo'shish</button></div>
        ${S.resorts.map(r => `<div class="card"><div class="row between"><b>${esc(r.name)}</b><span class="badge ${cls(r.trust)}">${r.trust == null ? "—" : r.trust}</span></div>
          <div class="mut">${esc(r.region)} · ${reviewsOf(r.id).length} sharh</div><div class="row" style="margin-top:8px">
          <button class="btn sec" data-an="${r.id}">Tahlil</button><button class="btn sec" data-ed="${r.id}">Tahrirlash</button><button class="btn bad" data-dl="${r.id}">O'chirish</button></div></div>`).join("")}`;
    } else if (adminTab === "reviews") {
      const all = S.resorts.flatMap(r => analysis(r.id).reviews.map(v => Object.assign({ rname: r.name }, v))).sort((a, b) => b.fake - a.fake);
      const hidden = S.reviews.filter(r => r.hidden);
      body = `<div class="note" style="margin-bottom:10px">Shubha ehtimoli bo'yicha saralangan. Moderatsiya: yashirish sharhni tahlildan chiqaradi.</div>
        ${all.map(v => `<div class="card"><div class="row between"><b>${esc(v.rname)}</b><span class="badge ${v.fake >= 50 ? "r" : v.fake >= 25 ? "y" : "g"}">${v.fake}%</span></div>
        <div class="mut">${esc(v.author)} · ${v.rating}★ · ${esc(v.date)}</div><div style="margin:6px 0">${esc(v.text)}</div>
        ${v.fakeReasons.length ? `<div class="mut">ⓘ ${esc(v.fakeReasons.join("; "))}</div>` : ""}<button class="btn bad" style="margin-top:6px;padding:6px 10px" data-hide="${v.id}">Yashirish</button></div>`).join("")}
        ${hidden.length ? `<h2>Yashirilganlar</h2>` + hidden.map(v => `<div class="card"><div>${esc(v.text)}</div><button class="btn sec" style="margin-top:6px;padding:6px 10px" data-unhide="${v.id}">Qaytarish</button></div>`).join("") : ""}`;
    } else {
      body = S.jobs.map(j => `<div class="card"><div class="row between"><b>${esc(resort(j.resortId) ? resort(j.resortId).name : "#" + j.resortId)}</b>
        <span class="badge ${j.status === "done" ? "g" : j.status === "error" ? "r" : "y"}">${j.status === "done" ? "Bajarildi" : j.status === "error" ? "Xatolik" : "Navbatda"}</span></div>
        <div class="prog" style="margin:8px 0"><i style="width:${j.progress}%"></i></div><div class="mut">${new Date(j.startedAt).toLocaleString()}${j.error ? " · " + esc(j.error) : ""}</div></div>`).join("") || `<div class="card mut">Hali AI vazifalari yo'q.</div>`;
    }
    return `<header><button class="back" data-back>‹ Orqaga</button><div class="brand">🛠 Admin panel</div></header>
      <main><div class="tabs">${tabs.map(([k, l]) => `<button class="${k === adminTab ? "on" : ""}" data-atab="${k}">${l}</button>`).join("")}</div>${body}</main>`;
  };
  views.admin.bind = () => {
    document.querySelectorAll("[data-atab]").forEach(b => b.onclick = () => { adminTab = b.dataset.atab; render(); });
    const rerender = (j, d) => d && render();
    if ($("#runall")) $("#runall").onclick = () => { S.resorts.forEach(r => runAnalysis(r.id, rerender)); toast("Tahlil navbatga qo'yildi"); };
    if ($("#reset")) $("#reset").onclick = () => { if (confirm("Barcha o'zgarishlar o'chadi. Davom etasizmi?")) { const u = S.user; S = seed(); S.user = u; S.resorts.forEach(r => analysis(r.id)); save(); render(); } };
    if ($("#aadd")) $("#aadd").onclick = () => {
      const name = $("#an").value.trim(); if (!name) return toast("Nomini kiriting");
      const r = { id: S.nextResortId++, name, region: $("#ar").value.trim() || "—", district: $("#ad").value.trim() || "—", address: $("#aa").value.trim(),
        rating: Math.min(5, Math.max(1, parseFloat($("#ag").value) || 4)), adText: $("#at").value.trim(), trust: null, createdAt: new Date().toISOString() };
      S.resorts.push(r); analysis(r.id); save(); toast("Maskan qo'shildi"); render();
    };
    document.querySelectorAll("[data-an]").forEach(b => b.onclick = () => { runAnalysis(b.dataset.an, rerender); toast("Tahlil boshlandi"); });
    document.querySelectorAll("[data-dl]").forEach(b => b.onclick = () => {
      if (!confirm("Maskan va uning sharhlari o'chirilsinmi?")) return;
      const id = +b.dataset.dl; S.resorts = S.resorts.filter(r => r.id !== id); S.reviews = S.reviews.filter(r => r.resortId !== id);
      delete S.analyses[id]; S.saved = S.saved.filter(x => x !== id); save(); render();
    });
    document.querySelectorAll("[data-ed]").forEach(b => b.onclick = () => {
      const r = resort(b.dataset.ed); const n = prompt("Nomi", r.name); if (n == null) return;
      const t = prompt("Reklama matni", r.adText); r.name = n.trim() || r.name; if (t != null) r.adText = t; save(); runAnalysis(r.id, rerender);
    });
    const setHidden = (id, h) => { const rv = S.reviews.find(x => x.id === +id); rv.hidden = h; save(); runAnalysis(rv.resortId, rerender); };
    document.querySelectorAll("[data-hide]").forEach(b => b.onclick = () => setHidden(b.dataset.hide, true));
    document.querySelectorAll("[data-unhide]").forEach(b => b.onclick = () => setHidden(b.dataset.unhide, false));
  };

  // ---------- Router ----------
  const ICONS = {
    home: '<path d="M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-5-5"/>',
    saved: '<path d="M12 21s-8-5.5-8-11a5 5 0 0 1 8-4 5 5 0 0 1 8 4c0 5.5-8 11-8 11z"/>',
    profile: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>'
  };
  const NAV = [["home", "Bosh sahifa"], ["search", "Qidiruv"], ["saved", "Saqlangan"], ["profile", "Profil"]];
  const history = [];
  let current = "home";
  function go(route, noPush) {
    if (!noPush && current !== route) history.push(current);
    current = route; if (!route.startsWith("resort/")) resortTab = "ai"; render(); window.scrollTo(0, 0);
  }
  window.goBack = function () { if (history.length) { current = history.pop(); render(); return true; } if (current !== "home") { current = "home"; render(); return true; } return false; };
  function render() {
    const [name, arg] = current.split(/\/(.*)/s);
    const v = views[name] || views.home;
    $("#app").innerHTML = v(arg);
    v.bind && v.bind(arg);
    document.querySelectorAll("[data-back]").forEach(el => el.onclick = () => window.goBack());
    $("#nav").innerHTML = NAV.map(([k, l]) => `<button class="${name === k ? "on" : ""}" data-nav="${k}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[k]}</svg>${l}</button>`).join("");
    document.querySelectorAll("[data-nav]").forEach(el => el.onclick = () => go(el.dataset.nav));
  }
  // data-go elementlari keyin qayta chizilishi mumkin (masalan, qidiruv natijalari), shuning uchun delegatsiya
  $("#app").addEventListener("click", e => { const el = e.target.closest("[data-go]"); if (el) go(el.dataset.go); });
  render();
})();
