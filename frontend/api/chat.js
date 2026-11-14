// Vercel Serverless Function — مساعد SPHEREx الطيفي
// المفتاح يُقرأ من متغيّر البيئة GEMINI_API_KEY ولا يُرسل للمتصفح أبداً.
const MODEL = "gemini-2.5-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const SYSTEM_INSTRUCTION = `أنت مساعد علمي داخل تطبيق "Blink Sphere — SPHEREx Spectral Lab" (هاكاثون NASA Space Apps).
مهمتك: تفسير طيف بكسل واحد من مكعب SPHEREx التجريبي، وربطه بالجليد (H2O 3.0µm، CO2 4.27µm، CO 4.67µm) وبدرجة الشذوذ الطيفي.

قواعد صارمة:
- البيانات اصطناعية (synthetic) للعرض فقط. اذكر ذلك عند أي سؤال عن "الاكتشاف" أو "الحقيقة العلمية".
- القائمة هي "مرشحون للمراجعة" وليست اكتشافات مؤكدة.
- لا تخترع أرقاماً غير موجودة في السياق المرفق.
- اشرح بلغة المستخدم: إن سأل بالعربية أجب بالعربية، وإن سأل بالإنجليزية أجب بالإنجليزية.
- الحقل ui_language في السياق يحدد لغة الواجهة الحالية: التزم بها إذا كان السؤال قصيراً أو غامضاً.
- كن مختصراً: 3–6 أسطر، واذكر الأرقام (τ، نسبة التشابه، درجة الشذوذ) عند فائدتها.
- إن كانت البيانات غير كافية، قل ما هو المطلوب بدقة.`;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "missing_api_key", message: "GEMINI_API_KEY غير مضبوط على السيرفر." });
    return;
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = null;
    }
  }
  if (!body || typeof body !== "object") {
    res.status(400).json({ error: "invalid_body" });
    return;
  }

  const question = String(body.question || "").trim().slice(0, 1200);
  if (!question) {
    res.status(400).json({ error: "empty_question" });
    return;
  }

  const ctx = body.context && typeof body.context === "object" ? body.context : {};
  const history = Array.isArray(body.history) ? body.history.slice(-6) : [];

  const contents = [];
  for (const turn of history) {
    const role = turn && turn.role === "model" ? "model" : "user";
    const text = String(turn && turn.text || "").slice(0, 1200);
    if (text) contents.push({ role, parts: [{ text }] });
  }
  contents.push({
    role: "user",
    parts: [{ text: `سياق البكسل (JSON):\n${JSON.stringify(ctx)}\n\nسؤال المستخدم: ${question}` }],
  });

  try {
    const upstream = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        contents,
        generationConfig: { temperature: 0.4, maxOutputTokens: 900, thinkingConfig: { thinkingBudget: 0 } },
      }),
    });

    const data = await upstream.json().catch(() => null);

    if (!upstream.ok) {
      const detail = data && data.error && data.error.message ? data.error.message : "upstream_error";
      res.status(upstream.status).json({ error: "gemini_error", message: String(detail).slice(0, 300) });
      return;
    }

    const parts = data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts;
    const answer = Array.isArray(parts)
      ? parts.map((p) => (p && typeof p.text === "string" ? p.text : "")).join("").trim()
      : "";

    if (!answer) {
      res.status(502).json({ error: "empty_answer" });
      return;
    }

    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({ answer });
  } catch (err) {
    res.status(502).json({ error: "request_failed", message: String(err && err.message || err).slice(0, 300) });
  }
}
