// Demo ma'lumotlar: maskanlar va sharhlar (MVP uchun admin tomonidan kiritilgan deb hisoblanadi)
window.DEMO_RESORTS = [
  { id: 1, name: "Chimyon Tog' Resort", region: "Toshkent viloyati", district: "Bo'stonliq", address: "Chimyon qishlog'i", rating: 4.6,
    adText: "Tog' bag'rida 5 yulduzli dam olish: toza havo, isitiladigan basseyn, yangi ta'mirlangan xonalar va milliy taomlar." },
  { id: 2, name: "Charvak Lazur Hotel", region: "Toshkent viloyati", district: "Bo'stonliq", address: "Charvak suv ombori qirg'og'i", rating: 4.2,
    adText: "Charvak qirg'og'idagi premium mehmonxona: shaxsiy plyaj, keng xonalar, xalqaro oshxona." },
  { id: 3, name: "Zomin Sanatoriyasi", region: "Jizzax viloyati", district: "Zomin", address: "Zomin milliy bog'i", rating: 4.4,
    adText: "Archazorlar orasida sog'lomlashtirish markazi: shifobaxsh muolajalar, parhez taomlar, tinch muhit." },
  { id: 4, name: "Amirsoy Mountain Resort", region: "Toshkent viloyati", district: "Bo'stonliq", address: "Amirsoy", rating: 4.7,
    adText: "Zamonaviy tog'-chang'i kurorti: shale uylari, SPA, restoranlar va professional xodimlar." },
  { id: 5, name: "Buxoro Oasis Guest House", region: "Buxoro viloyati", district: "Buxoro shahri", address: "Eski shahar", rating: 3.9,
    adText: "Tarixiy markazda milliy uslubdagi mehmonxona: hovli, nonushta kiritilgan, arzon narx." },
  { id: 6, name: "Beldersoy Dam Olish Uyi", region: "Toshkent viloyati", district: "Bo'stonliq", address: "Beldersoy", rating: 3.6,
    adText: "Oilaviy dam olish uchun ideal: katta basseyn, bolalar maydonchasi, mazali ovqatlar." }
];

window.DEMO_REVIEWS = [
  // 1 Chimyon
  [1, "Aziza", 5, "Xonalar juda toza va shinam, xodimlar xushmuomala. Basseyn ajoyib, iliq ekan.", "2026-08-02"],
  [1, "Bobur", 4, "Ovqat mazali, lekin narxi biroz qimmat. Manzara zo'r.", "2026-08-10"],
  [1, "Dilnoza", 2, "Xonada konditsioner ishlamadi, administrator javob bermadi. Xizmat sekin.", "2026-08-15"],
  [1, "Jasur", 5, "Hammasi a'lo! Oila bilan juda yaxshi dam oldik, bolalar xursand.", "2026-08-20"],
  [1, "Malika", 4, "Joylashuvi qulay, havo toza. Nonushta oddiy, xilma-xillik kam.", "2026-09-01"],
  [1, "Sardor", 3, "Reklamada xonalar yangi deyilgan, aslida ta'mir eski. Lekin toza.", "2026-09-05"],
  // 2 Charvak
  [2, "Kamola", 2, "Plyaj iflos edi, axlat yig'ilmagan. Narx sifatga mos emas, qimmat.", "2026-07-12"],
  [2, "Otabek", 3, "Xonalar keng, lekin hammom eski va kir. Xodimlar yaxshi.", "2026-07-20"],
  [2, "Nodir", 1, "Juda yomon xizmat. Bron qilingan xona berilmadi, qo'pol muomala.", "2026-07-25"],
  [2, "Gulnora", 4, "Manzara chiroyli, ovqat mazali. Wi-Fi ishlamaydi.", "2026-08-03"],
  [2, "Ulug'bek", 5, "Zo'r joy zo'r joy eng zo'r mehmonxona! Hammaga tavsiya qilaman!", "2026-08-04"],
  [2, "Ulug'bek K", 5, "Zo'r joy zo'r joy eng zo'r mehmonxona! Hammaga tavsiya qilaman!!", "2026-08-04"],
  [2, "Shahzod", 5, "Eng zo'r mehmonxona, hammaga tavsiya qilaman, zo'r joy!", "2026-08-04"],
  [2, "Madina", 2, "Basseyn yopiq edi, reklamada ko'rsatilgandek emas. Ovqat sovuq.", "2026-08-18"],
  // 3 Zomin
  [3, "Rustam", 5, "Muolajalar foydali, shifokorlar malakali. Havo juda toza.", "2026-06-11"],
  [3, "Feruza", 4, "Ovqat parhezbop va mazali. Xonalar oddiy, lekin toza.", "2026-06-25"],
  [3, "Akmal", 4, "Tinch va osoyishta joy. Narxi o'rtacha, sifatiga mos.", "2026-07-09"],
  [3, "Zarina", 3, "Yo'l yomon, yetib borish qiyin. Xodimlar yordam berishdi.", "2026-07-30"],
  [3, "Sherzod", 5, "Ajoyib tabiat, archazor, sog'lig'im yaxshilandi. Rahmat xodimlarga!", "2026-08-22"],
  // 4 Amirsoy
  [4, "Laylo", 5, "Shale uylari juda chiroyli va toza. Xizmat yuqori darajada.", "2026-01-15"],
  [4, "Timur", 4, "Chang'i yo'llari zo'r, lekin narxlar juda qimmat.", "2026-02-02"],
  [4, "Nigora", 5, "SPA ajoyib, xodimlar professional, restoran ovqatlari mazali.", "2026-02-20"],
  [4, "Eldor", 3, "Navbatlar uzun, ko'tarilish uchun ko'p kutdik. Xavfsizlik yaxshi.", "2026-03-01"],
  [4, "Sevara", 4, "Manzara go'zal, xonalar shinam. Parkovka pullik, qimmat.", "2026-08-12"],
  // 5 Buxoro
  [5, "Anvar", 4, "Hovli chiroyli, milliy uslub. Nonushta mazali, narxi arzon.", "2026-05-03"],
  [5, "Mohira", 3, "Xona kichkina va shovqinli. Joylashuvi juda qulay, markazda.", "2026-05-19"],
  [5, "Doniyor", 2, "Hammom kir, choyshablar almashtirilmagan. Xodim qo'pol edi.", "2026-06-07"],
  [5, "Shoira", 4, "Egalari mehribon, xizmat yaxshi. Tarixiy joylarga yaqin.", "2026-06-21"],
  // 6 Beldersoy
  [6, "Ikrom", 2, "Basseyn suvi iflos, tozalanmagan. Bolalar maydonchasi singan.", "2026-07-05"],
  [6, "Lola", 3, "Ovqat o'rtacha, xona issiq, konditsioner yo'q.", "2026-07-14"],
  [6, "Javohir", 1, "Reklamada katta basseyn deyilgan, aslida kichkina va eski. Aldov.", "2026-07-22"],
  [6, "Munisa", 4, "Tabiat zo'r, havo toza, xodimlar yaxshi. Narxi arzon.", "2026-08-01"],
  [6, "Hasan", 2, "Xizmat yomon, tozalik past. Narxiga arzimaydi.", "2026-08-09"]
];
