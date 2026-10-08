# Sayohatchi AI — Smart Tourism Review AI (MVP)

Milliy AI Xakaton 2026, 22-muammo: dam olish maskanlarida reklama va real xizmat sifati o'rtasidagi tafovutni AI yordamida aniqlash.

**APK:** [`Sayohatchi-AI.apk`](Sayohatchi-AI.apk) — Android 7.0+ (API 24). Internet talab qilinmaydi: tahlil qurilmaning o'zida bajariladi.

## Imkoniyatlar
- Maskan qidiruvi (nomi, viloyat, tuman) va saralash
- Maskan sahifasi: AI Trust Score (0–100), AI xulosasi, 7 ta ko'rsatkich (TZ 14.4 og'irliklari bilan)
- Sharhlar tahlili: sentiment, mavzular (tozalik, ovqat, xizmat, xodimlar, narx/sifat...), shubhali sharh indikatori
- Eng ko'p uchraydigan 3–5 muammo va kuchli tomonlar
- "Reklama vs Real" rasm taqqoslash (rang, kompozitsiya, yorug'lik, to'yinganlik) — natija Trust Score'ga qo'shiladi
- Sharh qo'shish, saqlanganlar, profil
- Admin panel (Profil'da ismni `admin` deb kiriting): dashboard, maskan qo'shish/tahrirlash/o'chirish, sharh moderatsiyasi, AI job navbati
- Ma'lumot yetarli bo'lmasa "Ma'lumot yetarli emas" va past ishonch darajasi ko'rsatiladi

> AI natijalari yakuniy haqiqat emas — ma'lumotlarga asoslangan ehtimoliy tahlil va tavsiya.

## Tuzilma
- `web/` — ilova (HTML/JS): `ai.js` tahlil moduli, `app.js` ekranlar, `data.js` demo ma'lumotlar (6 maskan, 33 sharh)
- `android/` — WebView qobig'i (`MainActivity.java`), manifest, resurslar
- `build_apk.sh` — Gradle'siz yig'ish (aapt2 + javac + dx + apksig)

Brauzerda sinash: `web/index.html` ni oching.

## Keyingi bosqich (TZ bo'yicha)
Next.js veb-versiya, FastAPI + PostgreSQL backend, LLM/Vision API, cloud deploy.
