// Smart Tourism Review AI — qurilmaning o'zida ishlaydigan tahlil moduli.
// Natijalar "yakuniy haqiqat" emas, ma'lumotlarga asoslangan ehtimoliy indikator.
(function () {
  const POS = ["toza", "shinam", "xushmuomala", "ajoyib", "a'lo", "zo'r", "mazali", "yaxshi", "chiroyli", "qulay",
    "go'zal", "professional", "malakali", "foydali", "mehribon", "tavsiya", "xursand", "rahmat", "keng", "iliq",
    "arzon", "tinch", "osoyishta", "yuqori", "parhezbop", "yaxshilandi", "yordam"];
  const NEG = ["iflos", "kir", "yomon", "qimmat", "sekin", "ishlamadi", "ishlamaydi", "eski", "qo'pol", "sovuq",
    "yopiq", "shovqinli", "kichkina", "singan", "aldov", "yo'q", "berilmadi", "javob bermadi", "qiyin", "uzun",
    "kutdik", "tozalanmagan", "almashtirilmagan", "arzimaydi", "past", "pullik", "issiq", "oddiy", "kam", "emas"];
  const NEGATORS = ["emas", "yo'q"];

  const TOPICS = {
    "Tozalik": ["toza", "iflos", "kir", "axlat", "choyshab", "tozalan", "tozalik"],
    "Ovqat": ["ovqat", "nonushta", "taom", "oshxona", "restoran", "mazali", "parhez"],
    "Xizmat": ["xizmat", "bron", "administrator", "muolaja", "wi-fi", "navbat", "spa", "konditsioner"],
    "Xodimlar": ["xodim", "shifokor", "muomala", "egalari", "xushmuomala", "qo'pol", "professional", "administrator"],
    "Narx/Sifat": ["narx", "qimmat", "arzon", "pullik", "arzimaydi", "sifat"],
    "Joylashuv": ["joylashuv", "yo'l", "markaz", "yaqin", "manzara", "tabiat", "havo", "qirg'oq"],
    "Xona": ["xona", "hammom", "shale", "ta'mir", "uy"],
    "Basseyn": ["basseyn", "plyaj", "suv"],
    "Xavfsizlik": ["xavfsiz", "qorovul", "xavf"]
  };

  function norm(t) { return (t || "").toLowerCase().replace(/[‘’ʻʼ`]/g, "'"); }
  function words(t) { return norm(t).split(/[^a-z'ʻ0-9-]+/).filter(Boolean); }

  function sentiment(text, rating) {
    const t = norm(text); let s = 0, hits = 0;
    POS.forEach(w => { if (t.includes(w)) { s += 1; hits++; } });
    NEG.forEach(w => { if (t.includes(w)) { s -= 1.2; hits++; } });
    // "... emas" kabi inkorlar ijobiy so'zni bekor qiladi
    if (/(ko'rsatilgandek|mos|deyilgandek) emas/.test(t)) s -= 1;
    if (rating) s += (rating - 3) * 0.8;
    const score = Math.max(-1, Math.min(1, s / Math.max(2, hits + 1)));
    const label = score > 0.15 ? "positive" : score < -0.15 ? "negative" : "neutral";
    const confidence = Math.min(0.97, 0.55 + hits * 0.08);
    return { label, score: +score.toFixed(2), confidence: +confidence.toFixed(2) };
  }

  // Har bir mavzu uchun shu mavzuga tegishli gap bo'lagining sentimenti
  function topics(text) {
    const parts = norm(text).split(/[.,!?;]+|\blekin\b|\bammo\b/).filter(p => p.trim());
    const out = [];
    Object.entries(TOPICS).forEach(([topic, keys]) => {
      const rel = parts.filter(p => keys.some(k => p.includes(k)));
      if (rel.length) {
        const sc = rel.map(p => sentiment(p).score).reduce((a, b) => a + b, 0) / rel.length;
        out.push({ topic, score: +sc.toFixed(2) });
      }
    });
    if (!out.length) out.push({ topic: "Boshqa", score: sentiment(text).score });
    return out;
  }

  function jaccard(a, b) {
    const A = new Set(words(a)), B = new Set(words(b));
    if (!A.size || !B.size) return 0;
    let i = 0; A.forEach(x => { if (B.has(x)) i++; });
    return i / (A.size + B.size - i);
  }

  // Shubhali sharh indikatori: o'xshash matn, qisqa vaqtda ko'p sharh, haddan tashqari baho, takror so'zlar, "!" ko'pligi
  function fakeRisk(review, all) {
    let risk = 0; const reasons = [];
    const others = all.filter(r => r !== review);
    const maxSim = others.reduce((m, r) => Math.max(m, jaccard(r.text, review.text)), 0);
    if (maxSim > 0.5) { risk += 45 * maxSim; reasons.push("Boshqa sharhga juda o'xshash matn"); }
    const sameDay = others.filter(r => r.date === review.date).length;
    if (sameDay >= 2) { risk += 20; reasons.push("Bir kunda ko'p sharh"); }
    const w = words(review.text);
    const uniq = new Set(w).size / Math.max(1, w.length);
    if (w.length > 4 && uniq < 0.75) { risk += 15; reasons.push("Takrorlanuvchi so'zlar"); }
    if ((review.text.match(/!/g) || []).length >= 2) { risk += 8; reasons.push("Haddan tashqari hissiy uslub"); }
    if (w.length < 5) { risk += 10; reasons.push("Juda qisqa sharh"); }
    if (review.rating === 5 && !/[,.]/.test(review.text.slice(0, -1))) { risk += 7; }
    const s = sentiment(review.text, null);
    if ((review.rating >= 4 && s.label === "negative") || (review.rating <= 2 && s.label === "positive")) {
      risk += 12; reasons.push("Baho va matn mos emas");
    }
    return { probability: Math.min(95, Math.round(risk)), reasons };
  }

  function analyzeReviews(reviews) {
    return reviews.map(r => {
      const s = sentiment(r.text, r.rating);
      const f = fakeRisk(r, reviews);
      return Object.assign({}, r, { sentiment: s.label, sentimentScore: s.score, confidence: s.confidence,
        topics: topics(r.text), fake: f.probability, fakeReasons: f.reasons });
    });
  }

  const toPct = s => Math.round((s + 1) * 50); // -1..1 -> 0..100

  // Trust Score (TZ 14.4): og'irliklangan o'rtacha
  const WEIGHTS = { reliability: 25, service: 20, cleanliness: 15, staff: 10, food: 10, price: 10, adMatch: 10 };
  const TOPIC_MAP = { service: "Xizmat", cleanliness: "Tozalik", staff: "Xodimlar", food: "Ovqat", price: "Narx/Sifat" };

  function analyzeResort(resort, rawReviews, imageScore) {
    const reviews = analyzeReviews(rawReviews);
    const trusted = reviews.filter(r => r.fake < 50);
    const metrics = {}; const insufficient = [];
    metrics.reliability = reviews.length ? Math.round(100 - reviews.reduce((a, r) => a + r.fake, 0) / reviews.length) : null;
    Object.entries(TOPIC_MAP).forEach(([k, topic]) => {
      const vals = []; trusted.forEach(r => r.topics.forEach(t => { if (t.topic === topic) vals.push(t.score); }));
      if (vals.length) metrics[k] = toPct(vals.reduce((a, b) => a + b, 0) / vals.length);
      else { metrics[k] = null; insufficient.push(k); }
    });
    // Reklama–real moslik: reklamadagi va'dalar sharhlarda tasdiqlanadimi + rasm tahlili
    const adTopics = topics(resort.adText).map(t => t.topic);
    const adVals = [];
    trusted.forEach(r => r.topics.forEach(t => { if (adTopics.includes(t.topic)) adVals.push(t.score); }));
    const reklamaFlags = trusted.filter(r => /reklama|ko'rsatilgandek|deyilgan|aldov/.test(norm(r.text))).length;
    let adMatch = adVals.length ? toPct(adVals.reduce((a, b) => a + b, 0) / adVals.length) - reklamaFlags * 8 : null;
    if (imageScore != null) adMatch = adMatch == null ? imageScore : Math.round(adMatch * 0.5 + imageScore * 0.5);
    metrics.adMatch = adMatch == null ? null : Math.max(0, Math.min(100, adMatch));
    if (metrics.adMatch == null) insufficient.push("adMatch");

    let sum = 0, wsum = 0;
    Object.entries(WEIGHTS).forEach(([k, w]) => { if (metrics[k] != null) { sum += metrics[k] * w; wsum += w; } });
    let overall = wsum ? Math.round(sum / wsum) : null;
    const confidence = Math.min(1, reviews.length / 20) * (wsum / 100);

    // Asosiy muammolar: eng ko'p salbiy uchraydigan mavzular
    const neg = {}, pos = {};
    trusted.forEach(r => r.topics.forEach(t => {
      if (t.score < -0.1) neg[t.topic] = (neg[t.topic] || 0) + 1;
      if (t.score > 0.1) pos[t.topic] = (pos[t.topic] || 0) + 1;
    }));
    const problems = Object.entries(neg).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([topic, count]) => ({ topic, count }));
    const strengths = Object.entries(pos).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([topic, count]) => ({ topic, count }));
    const suspicious = reviews.filter(r => r.fake >= 50).length;

    return { resortId: resort.id, reviews, metrics, overall, confidence: +confidence.toFixed(2), insufficient,
      problems, strengths, suspicious, summary: summarize(resort, reviews, overall, problems, strengths, suspicious, metrics),
      analyzedAt: new Date().toISOString() };
  }

  function summarize(resort, reviews, overall, problems, strengths, suspicious, m) {
    if (!reviews.length) return "Ma'lumot yetarli emas: bu maskan uchun hali sharhlar yo'q.";
    const posN = reviews.filter(r => r.sentiment === "positive").length;
    const s = [];
    s.push(`${resort.name} bo'yicha ${reviews.length} ta sharh tahlil qilindi, ulardan ${Math.round(posN / reviews.length * 100)}% ijobiy.`);
    if (strengths.length) s.push(`Mijozlar eng ko'p ${strengths.slice(0, 3).map(x => x.topic.toLowerCase()).join(", ")} jihatlarini maqtashgan.`);
    if (problems.length) s.push(`Eng ko'p uchraydigan muammolar: ${problems.slice(0, 3).map(x => x.topic.toLowerCase()).join(", ")}.`);
    if (suspicious) s.push(`${suspicious} ta sharh shubhali deb belgilandi va bahoga kamroq ta'sir qildi.`);
    if (m.adMatch != null) s.push(m.adMatch >= 70 ? "Reklama va real tajriba asosan mos keladi." :
      m.adMatch >= 50 ? "Reklamadagi va'dalar qisman tasdiqlanadi." : "Reklama va real tajriba o'rtasida sezilarli tafovut bor.");
    s.push(overall >= 75 ? "Umumiy xulosa: ishonchli tanlov." : overall >= 55 ? "Umumiy xulosa: o'rtacha, kamchiliklarni hisobga oling." : "Umumiy xulosa: tanlashdan oldin yaxshilab o'ylab ko'ring.");
    return s.join(" ");
  }

  // ---------- Rasm tahlili (reklama vs real) ----------
  function imageStats(img) {
    const c = document.createElement("canvas"); const W = 96, H = 96; c.width = W; c.height = H;
    const g = c.getContext("2d"); g.drawImage(img, 0, 0, W, H);
    const d = g.getImageData(0, 0, W, H).data;
    const hist = new Array(64).fill(0); let lum = 0, sat = 0, edge = 0; const L = [];
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], gg = d[i + 1], b = d[i + 2];
      hist[(r >> 6) * 16 + (gg >> 6) * 4 + (b >> 6)]++;
      const l = 0.299 * r + 0.587 * gg + 0.114 * b; L.push(l); lum += l;
      const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b); sat += mx ? (mx - mn) / mx : 0;
    }
    for (let y = 1; y < H; y++) for (let x = 1; x < W; x++) edge += Math.abs(L[y * W + x] - L[y * W + x - 1]) + Math.abs(L[y * W + x] - L[(y - 1) * W + x]);
    const n = W * H;
    // 4x4 grid bo'yicha struktura (joylashuv o'xshashligi)
    const grid = [];
    for (let gy = 0; gy < 4; gy++) for (let gx = 0; gx < 4; gx++) {
      let s = 0; for (let y = gy * 24; y < gy * 24 + 24; y++) for (let x = gx * 24; x < gx * 24 + 24; x++) s += L[y * W + x];
      grid.push(s / 576);
    }
    return { hist: hist.map(h => h / n), lum: lum / n, sat: sat / n, edge: edge / n, grid };
  }

  function compareImages(adImg, realImg) {
    const a = imageStats(adImg), b = imageStats(realImg);
    let inter = 0; for (let i = 0; i < 64; i++) inter += Math.min(a.hist[i], b.hist[i]);
    const gm = a.grid.reduce((s, v) => s + v, 0) / 16, gn = b.grid.reduce((s, v) => s + v, 0) / 16;
    let num = 0, da = 0, db = 0;
    for (let i = 0; i < 16; i++) { num += (a.grid[i] - gm) * (b.grid[i] - gn); da += (a.grid[i] - gm) ** 2; db += (b.grid[i] - gn) ** 2; }
    const struct = da && db ? (num / Math.sqrt(da * db) + 1) / 2 : 0.5;
    const lumSim = 1 - Math.min(1, Math.abs(a.lum - b.lum) / 128);
    const satSim = 1 - Math.min(1, Math.abs(a.sat - b.sat) / 0.5);
    const score = Math.round((inter * 0.35 + struct * 0.3 + lumSim * 0.2 + satSim * 0.15) * 100);
    const diffs = [];
    if (a.lum - b.lum > 20) diffs.push("Reklama rasmi ancha yorug'roq — real joy qorong'iroq ko'rinadi.");
    if (b.lum - a.lum > 20) diffs.push("Real rasm yorug'roq, reklama rasmi qorong'i tushirilgan.");
    if (a.sat - b.sat > 0.12) diffs.push("Reklamada ranglar to'yintirilgan (filtr/retush ehtimoli).");
    if (b.sat - a.sat > 0.12) diffs.push("Real rasmda ranglar yorqinroq.");
    if (a.edge > b.edge * 1.5) diffs.push("Real rasm xira yoki detallar kam — taqqoslash aniqligi past.");
    if (b.edge > a.edge * 1.5) diffs.push("Real rasmda detallar (buyumlar, notekisliklar) ko'proq — reklama silliqlangan bo'lishi mumkin.");
    if (struct < 0.55) diffs.push("Kompozitsiya farq qiladi: rasmlar boshqa joy yoki burchakdan olingan bo'lishi mumkin.");
    if (inter < 0.5) diffs.push("Rang palitrasi keskin farq qiladi (interyer/holat o'zgargan bo'lishi mumkin).");
    if (!diffs.length) diffs.push("Sezilarli vizual farq topilmadi.");
    return { score, diffs, details: { color: Math.round(inter * 100), structure: Math.round(struct * 100),
      light: Math.round(lumSim * 100), saturation: Math.round(satSim * 100) } };
  }

  window.AI = { sentiment, topics, fakeRisk, analyzeReviews, analyzeResort, compareImages, WEIGHTS };
})();
