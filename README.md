# Sayohatchi AI — Smart Tourism Review AI (MVP)

Milliy AI Xakaton 2026, 22-muammo: dam olish maskanlarida reklama va real xizmat sifati o'rtasidagi tafovutni AI yordamida aniqlash.

**APK:** [`Sayohatchi-AI.apk`](Sayohatchi-AI.apk) — Android 7.0+ (API 24). Internet talab qilinmaydi: tahlil qurilmaning o'zida bajariladi.

## 4 xil hisob
| Hisob | Imkoniyatlar |
|---|---|
| 🧳 **Sayohatchi** | Qidiruv, xarita, Trust Score, sharh yozish, **sayohatlar tarixi** (qayerga borgan, qancha sarflagan — xaritada), qiziqishlar, **AI sayohat rejasi** (byudjet, kun, kishi, shahar bo'yicha qayerga borish mumkin va xarajat tafsiloti) |
| 🏨 **Tashkilot** (dam olish maskani) | Tashkilot profili (nomi, STIR, telefon), o'z maskanlarini qo'shish/tahrirlash (narx, yo'nalish, reklama matni va rasmi, xaritada joylashuv), sharhlarga javob, Trust Score va AI maslahatlari |
| 📈 **Analitik** | Analitika (tashrifchilar, sessiyalar, web/ilova, rollar, sahifalar, "kimlar kirdi") va **AI sifati** (xatolik darajasi, maqsad ≤ 1%, hodisalar jurnali). Faqat ko'radi, o'zgartira olmaydi |
| 🛡️ **Admin** | Hammasi + foydalanuvchilarni **bloklash**, **rolini o'zgartirish**, tashkilotlarni **tasdiqlash**, barcha maskanlarni tahrirlash/o'chirish, sharh moderatsiyasi |

Analitik va Admin sifatida ro'yxatdan o'tish uchun maxfiy kod kerak (`ANALYST_CODE`, `ADMIN_CODE`). Oflayn demo kodlari: `analitik2026`, `admin2026`.
Mehmonlar ro'yxatdan o'tmasdan qidirish, ko'rish va sharh yozishlari mumkin.

## 🔔 Bildirishnomalar va yangilanish
Har bir ekranda o'ng yuqorida qo'ng'iroqcha bor:
- **Yangi versiya** — serverdagi versiya ilovadagidan yangi bo'lsa ko'rinadi. "Hozir yangilash": web'da sahifa yangilanadi, ilovada yangi APK yuklab olinadi.
- **Nima yangi** — yangilanishdan keyin o'zgarishlar ro'yxati.
- Rolga qarab: sayohatchiga — tashkilot javobi; tashkilotga — yangi sharhlar, tasdiqlanish; adminga — tasdiq kutayotgan tashkilotlar; analitik/adminga — AI xatoligi 1% dan oshsa ogohlantirish.

**Yangi versiya chiqarish:** `web/app.js` dagi `APP_VERSION` va `android/AndroidManifest.xml` dagi versiyani oshiring → `API_URL=https://domen.uz ./build_apk.sh` → APK'ni `Sayohatchi-AI.apk` va `download/` ga qo'ying → `web/version.json` da `version` va `notes` ni yangilang → push. Barcha foydalanuvchilarning qo'ng'iroqchasida yangilanish chiqadi.

## Imkoniyatlar
- Yashil "tabiat" dizayni: animatsiyali tog'/quyosh/bulut sahnasi, kartochkalar paydo bo'lishi, raqamlar sanalishi, halqa va chiziqlar to'lishi, AI xulosasi "yozilishi", tugma to'lqin effekti
- Xarita (Leaflet): barcha maskanlar Trust Score rangida, filtr, bosh sahifada va maskan sahifasida mini-xarita
- Sharhlar tahlili: sentiment, mavzular, shubhali sharh indikatori, eng ko'p uchraydigan 3–5 muammo
- 7 ko'rsatkichli Trust Score (TZ 14.4 og'irliklari), "Ma'lumot yetarli emas" holati
- "Reklama vs Real" rasm taqqoslash

> AI natijalari yakuniy haqiqat emas — ma'lumotlarga asoslangan ehtimoliy tahlil va tavsiya.

## 🌐 Web versiya (GitHub Pages)
Sayt manzili: **https://ndoston1202-glitch.github.io/sayohatchi-ai/**
- `main` ga har push qilinganda `.github/workflows/pages.yml` saytni avtomatik yangilaydi.
- Sayt **ilova sifatida o'rnatiladi** (PWA): bosh sahifadagi "📲 O'rnatish" tugmasi yoki brauzer menyusi orqali. Internetsiz ham ochiladi.
- 🔔 qo'ng'iroqcha `web/version.json` ni tekshiradi: versiya oshirilsa, barcha foydalanuvchilarda "Yangi versiya" chiqadi.
- Pages'da backend yo'q — ma'lumotlar har bir foydalanuvchi brauzerida saqlanadi. Umumiy baza va analitika uchun serverga o'rnating (pastda).

## Ishlash rejimlari
- **Server bilan** (tavsiya): barcha foydalanuvchilar ma'lumoti va analitika umumiy, parollar serverda PBKDF2 bilan saqlanadi.
- **Oflayn**: server topilmasa ilova ma'lumotlarni qurilmada saqlaydi (demo uchun). Oflayn dasturchi kodi: `dev2026`.

## Serverga o'rnatish
**Docker (eng oson):**
```bash
docker build -t sayohatchi .
docker run -d --restart=always -p 8000:8000 -v sayohatchi-data:/data \
  -e SECRET_KEY="$(openssl rand -hex 32)" -e ADMIN_CODE="admin-kodi" -e ANALYST_CODE="analitik-kodi" \\
  -v "$PWD/download:/app/download" sayohatchi
```
So'ng `deploy/nginx.conf` dagi domenni o'zgartirib nginx'ga qo'ying va `certbot --nginx -d domen.uz` bilan HTTPS yoqing.

**Dockersiz (VPS):**
```bash
sudo mkdir -p /opt/sayohatchi && sudo cp -r server web download /opt/sayohatchi/ && cd /opt/sayohatchi
python3 -m venv venv && venv/bin/pip install -r server/requirements.txt
sudo cp deploy/sayohatchi.service /etc/systemd/system/   # SECRET_KEY, ADMIN_CODE, ANALYST_CODE ni o'zgartiring
sudo systemctl enable --now sayohatchi
```

**APK'ni serverga ulash:** `API_URL=https://domen.uz ./build_apk.sh` — ilova shu serverdan ma'lumot oladi va analitikaga "📱 ilova" sifatida yoziladi.

## API
`POST /api/v1/auth/register|login`, `GET /api/v1/state`, `PUT|DELETE /api/v1/docs/{resorts|reviews|orgs|visits}/{id}`, `POST /api/v1/events` (analitika va AI jurnali), `GET /api/v1/analytics` (analitik/admin), `PUT /api/v1/users/{id}` (admin: bloklash, rol), `GET /api/v1/version` (yangilanish), `/download/…` (APK), `GET /api/v1/health`.

## Tuzilma
- `web/` — ilova: `app.js` (ekranlar, rollar, analitika), `ai.js` (tahlil), `data.js` (demo ma'lumot), `vendor/leaflet`
- `server/main.py` — FastAPI backend (SQLite)
- `android/` — WebView qobig'i; `build_apk.sh` — Gradle'siz yig'ish
- `deploy/` — nginx va systemd sozlamalari

## Keyingi bosqich
PostgreSQL, LLM/Vision API (Claude), Next.js frontend, push-bildirishnomalar.
