# Blink Sphere

ويب أب علمي تفاعلي لاستكشاف بيانات تلسكوب **SPHEREx** التابع لناسا (102 قناة طيفية، 0.75–5.0 ميكرون، مسح كامل للسماء).

## الحالة الحالية
الواجهة تعمل على **بيان اصطناعي (Synthetic / Demo data)** للتطوير والاختبار الفوري. يتميز بوضوح في الواجهة بـ `badge-synthetic`. الربط بالبيان الحقيقي من **NASA/IPAC IRSA** عبر `astroquery` + خدمات SIA/TAP هو الخطوة التالية.

## هيكل المشروع
```
.
├── backend/                  # FastAPI (باك إند خفيف)
│   ├── app/main.py           # نقاط نهاية API
│   └── requirements.txt
├── scripts/
│   └── prepare_data.py       # يولّد المكعب الاصطناعي + النتائج المحسوبة مسبقاً
├── frontend/public/data/     # المكعب الثنائي + ملفات JSON المحسوبة (تُنشر مع الموقع)
│   ├── cube.bin              # Float32 (ny, nx, nwave)
│   ├── metadata.json         # أطوال الموجة + الإحداثيات
│   ├── reference_spectra.json
│   ├── ice_maps.json
│   └── precomputed.json      # anomaly map + flags
├── frontend/api/chat.js      # Serverless: مساعد Gemini (المفتاح في env فقط)
├── frontend/                 # Vite + React + TS + Tailwind
│   ├── src/
│   │   ├── App.tsx           # الغلاف + التنقل + تبديل اللغة
│   │   ├── components/LangContext.tsx
│   │   ├── components/CanvasViewer.tsx   # الأداة 1: RGB Synthesizer
│   │   ├── components/SpectrumPanel.tsx  # الأداة 2: البصمة الطيفية
│   │   ├── components/SpectralAssistant.tsx # مساعد AI للبكسل المختار
│   │   └── pages/            # Home, Explorer, Candidates, Mission, About
│   └── package.json
└── README.md
```

## الأدوات المنفذة (الأولوية 1–3)
1. **Spectral RGB Synthesizer** — عارض كانفاس، 3 قنوات من 102، presets (ميثان/ماء/جليد)، تمديد percentiles/asinh، السطوع، وضع النسبة (ratio).
2. **Spectral Fingerprint Matcher** — انقر على بكسل → طيف Plotly → cosine similarity مقابل مكتبة مرجعية → أفضل 3 تطابقات.
3. **Ice Hunter Map** — عمق الامتصاص τ عند 3.0 (H₂O)، 4.27 (CO₂)، 4.67 (CO) µm مع خط أساس خطي، خريطة حرارية تفاعلية + عتامة + أسطورة.

## متطلبات النظام
- Python 3.10+ مع pip
- Node.js 18+ مع npm

## التشغيل (الأمر الواحد للباك إند + الواجهة)

### 1. الباك إند (بايثون)
```powershell
# من جذر المشروع
pip install -r backend/requirements.txt
python scripts/prepare_data.py
cd backend && uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

أو سكريبت واحد (إنشاء):
```powershell
.\start_backend.ps1   # يُثبّت التبعيات، يُحضّر البيانات، ويُشغّل uvicorn
```

### 2. الواجهة الأمامية
```powershell
cd frontend
npm install
npm run dev   # يعمل على http://localhost:5173
```

### 3. افتح المتصفح
```
http://localhost:5173
```
الباك إند FastAPI (اختياري) يُوفّر API على `http://127.0.0.1:8000`. الواجهة لا تحتاجه: تقرأ البيانات من `/data/` مباشرة، و`/api` أثناء التطوير يمرّر إلى دالة Vercel المنشورة للمساعد الطيفي.

## نقاط نهاية API رئيسية
- `GET /health` — حالة التحميل
- `GET /metadata` — أبعاد المكعب + أطوال الموجة
- `GET /data/cube.bin` — المكعب الثنائي (Float32)
- `GET /spectrum/{x}/{y}` — طيف بكسل واحد
- `GET /ice/{h2o|co2|co}` — خريطة عمق الجليد
- `GET /anomalies` — خريطة الشذوذ + قائمة المرشحين
- `GET /reference-spectra` — أطياف مرجعية
- `POST /match` — مطابقة طيف مع المرجعيات

## أمانة العلم (Synthetic vs Real)
| الجزء | المصدر | الحالة |
|------|--------|--------|
| المكعب الطيفي | `scripts/prepare_data.py` | **اصطناعي** (نجوم، أقزام بنية، مجرات، سحابة جليد) |
| أطياف المرجع | ذات السكريبت | **مبسطة/اصطناعية** (بودي أسود + خطوط امتصاص) |
| نتائج anomaly/ice/flags | محسوبة مسبقاً على المكعب الاصطناعي | **مشتقة من بيان اصطناعي** |

> لا يُعرض أي بيان اصطناعي على أنه قياس حقيقي. عند الربط بـ IRSA ستُظهر الوadge `حقيقي (IRSA)`.

## حدود علمية
- دقة الانزياح الأحمر من 102 قناة تقريبية ولا تغني عن التحليل الطيفي عالي الدقة.
- مطابقة البصمة تعتمد على قوالب مرجعية مبسطة.
- كشف الشذوذ (IsolationForest) يُظهر مرشحين للمراجعة البشرية، ليس تأكيداً علمياً.

## النشر (Deploy) — الوضع الحالي: static على Vercel
- الرابط: https://blinksphere.vercel.app
- البناء: `cd frontend; npm run build` → `dist` (يحتوي `dist/data/` كاملاً).
- النشر: `cd frontend; npx vercel --prod --yes`
- `frontend/vercel.json` يستخدم `{ "handle": "filesystem" }` أولاً ثم fallback إلى `/index.html`، حتى تُخدم `/data/*` و `/api/*` كملفات حقيقية.
- الباك إند FastAPI أصبح **اختيارياً**؛ الواجهة لا تنادي `localhost:8000` إطلاقاً.

## المساعد الطيفي (Gemini) — إعداد المفتاح
المفتاح **لا يُخزَّن في الكود ولا في Git**، بل في متغيّر بيئة على Vercel:

```powershell
cd frontend
# ضع مفتاح Google AI Studio مرة واحدة (لن يُطبع ولن يُحفظ في المستودع)
"<YOUR_GEMINI_KEY>" | npx vercel env add GEMINI_API_KEY production
npx vercel --prod --yes
```

- الدالة: `frontend/api/chat.js` (Vercel Serverless، Node ESM) تنادي `gemini-2.5-flash` عبر `x-goog-api-key`.
- الفرونت ينادي `POST /api/chat` فقط، ويُرجع نص الإجابة. لا يوجد أي مفتاح في الحزمة (تم التحقق من `dist/assets`).
- أثناء التطوير المحلي، `vite.config.ts` يمرّر `/api` إلى الموقع المنشور (المفتاح يبقى على السيرفر فقط).

## التطوير التالي (إن وجد وقت)
الأدوات 4–7: Weird Object Radar مكتمل جزئياً (قائمة المرشحين)، Crowd Micro-Tasks (الصفحة Mission)، Redshift Estimator، Spectrum Sonification.
