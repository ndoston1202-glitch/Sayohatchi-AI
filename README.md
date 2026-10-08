# Sayohatchi AI — Smart Tourism Review AI (MVP)

Milliy AI Xakaton 2026, 22-muammo: dam olish maskanlarida reklama va real xizmat sifati o'rtasidagi tafovutni AI yordamida aniqlash.

**APK:** [`Sayohatchi-AI.apk`](Sayohatchi-AI.apk) — Android 7.0+ (API 24). Internet talab qilinmaydi: tahlil qurilmaning o'zida bajariladi.

## 3 ta rol
| Rol | Imkoniyatlar |
|---|---|
| 🧳 **Mijoz** | Qidiruv, xarita, Trust Score, sharh yozish, **sayohatlar tarixi** (qayerga borgan, qancha sarflagan — xaritada), qiziqishlar, **AI sayohat rejasi**: byudjet, kunlar, kishilar va shahar bo'yicha qayerga borish mumkinligi va xarajat tafsiloti |
| 🏨 **Tashkilot** | Tashkilot profili (nomi, STIR, telefon), o'z maskanlarini qo'shish/tahrirlash (narx, ovqat, yo'nalishlar, reklama matni va rasmi, xaritada joylashuv), sharhlarga javob berish, Trust Score va AI maslahatlari, ko'rishlar statistikasi |
| 💻 **Dasturchi** | **Analitika**: noyob tashrifchilar, sessiyalar, kunlik grafik, web/ilova ulushi, rollar, sahifalar, ko'p ko'rilgan maskanlar, soatlik faollik, qidiruvlar, "kimlar kirdi" lentasi. **AI sifati**: xatolik darajasi (maqsad ≤ 1%), tizim xatolari, anomaliyalar, foydalanuvchi 👍/👎 bahosi, hodisalar jurnali, AI o'z-o'zini tekshirish. Foydalanuvchilar, tashkilotlarni tasdiqlash, sharh moderatsiyasi |

Mehmonlar ham ro'yxatdan o'tmasdan qidirish, ko'rish va sharh yozishlari mumkin.

## Imkoniyatlar
- Yashil "tabiat" dizayni: animatsiyali tog'/quyosh/bulut sahnasi, kartochkalar paydo bo'lishi, raqamlar sanalishi, halqa va chiziqlar to'lishi, AI xulosasi "yozilishi", tugma to'lqin effekti
- Xarita (Leaflet): barcha maskanlar Trust Score rangida, filtr, bosh sahifada va maskan sahifasida mini-xarita
- Sharhlar tahlili: sentiment, mavzular, shubhali sharh indikatori, eng ko'p uchraydigan 3–5 muammo
- 7 ko'rsatkichli Trust Score (TZ 14.4 og'irliklari), "Ma'lumot yetarli emas" holati
- "Reklama vs Real" rasm taqqoslash

> AI natijalari yakuniy haqiqat emas — ma'lumotlarga asoslangan ehtimoliy tahlil va tavsiya.

## Ishlash rejimlari
- **Server bilan** (tavsiya): barcha foydalanuvchilar ma'lumoti va analitika umumiy, parollar serverda PBKDF2 bilan saqlanadi.
- **Oflayn**: server topilmasa ilova ma'lumotlarni qurilmada saqlaydi (demo uchun). Oflayn dasturchi kodi: `dev2026`.

## Serverga o'rnatish
**Docker (eng oson):**
```bash
docker build -t sayohatchi .
docker run -d --restart=always -p 8000:8000 -v sayohatchi-data:/data \
  -e SECRET_KEY="$(openssl rand -hex 32)" -e DEV_CODE="o'zingizning-kodingiz" sayohatchi
```
So'ng `deploy/nginx.conf` dagi domenni o'zgartirib nginx'ga qo'ying va `certbot --nginx -d domen.uz` bilan HTTPS yoqing.

**Dockersiz (VPS):**
```bash
sudo mkdir -p /opt/sayohatchi && sudo cp -r server web /opt/sayohatchi/ && cd /opt/sayohatchi
python3 -m venv venv && venv/bin/pip install -r server/requirements.txt
sudo cp deploy/sayohatchi.service /etc/systemd/system/   # SECRET_KEY va DEV_CODE ni o'zgartiring
sudo systemctl enable --now sayohatchi
```

**APK'ni serverga ulash:** `API_URL=https://domen.uz ./build_apk.sh` — ilova shu serverdan ma'lumot oladi va analitikaga "📱 ilova" sifatida yoziladi.

## API
`POST /api/v1/auth/register|login`, `GET /api/v1/state`, `PUT|DELETE /api/v1/docs/{resorts|reviews|orgs|visits}/{id}`, `POST /api/v1/events` (analitika va AI jurnali), `GET /api/v1/analytics` (faqat dasturchi), `GET /api/v1/health`.

## Tuzilma
- `web/` — ilova: `app.js` (ekranlar, rollar, analitika), `ai.js` (tahlil), `data.js` (demo ma'lumot), `vendor/leaflet`
- `server/main.py` — FastAPI backend (SQLite)
- `android/` — WebView qobig'i; `build_apk.sh` — Gradle'siz yig'ish
- `deploy/` — nginx va systemd sozlamalari

## Keyingi bosqich
PostgreSQL, LLM/Vision API (Claude), Next.js frontend, push-bildirishnomalar.
