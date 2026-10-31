import { GoogleGenAI } from '@google/genai';

const responseSchema = {
  type: 'object',
  properties: {
    scenes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          part: {
            type: 'integer',
            description: 'رقم الجزء (1، 2، 3...)'
          },
          title: {
            type: 'string',
            description: 'عنوان مقترح وجذاب لهذا الجزء'
          },
          visualScene: {
            type: 'string',
            description: 'وصف تفصيلي للمشهد البصري المناسب لهذا الجزء'
          },
          script: {
            type: 'string',
            description: 'نص السيناريو الكامل للجزء (ما سيُقال أو يُعرض)'
          }
        },
        required: ['part', 'title', 'visualScene', 'script']
      }
    }
  },
  required: ['scenes']
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'الطريقة غير مسموحة. استخدم POST فقط.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY غير موجود في متغيرات البيئة.');
    return res.status(500).json({ error: 'خطأ في إعداد الخادم: مفتاح API غير متوفر.' });
  }

  const { article, style } = req.body || {};

  if (!article || typeof article !== 'string' || article.trim().length < 10) {
    return res.status(400).json({ error: 'الرجاء تقديم مقال صالح (10 أحرف على الأقل).' });
  }

  const allowedStyles = ['كوميدي', 'قصصي', 'تشويقي'];
  if (!style || !allowedStyles.includes(style)) {
    return res.status(400).json({ error: 'الأسلوب غير صالح. اختر: كوميدي، قصصي، أو تشويقي.' });
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
أنت كاتب سيناريوهات محترف لفيديوهات Shorts / Reels / TikTok.
مهمتك: تحويل المقال التالي إلى سلسلة من السيناريوهات القصيرة المتسلسلة.

الأسلوب المطلوب: "${style}".
المقال:
"""
` + article + `
"""

الشروط:
- قسّم المحتوى إلى أجزاء متسلسلة (كل جزء لا يتجاوز 30-60 ثانية عند القراءة).
- لكل جزء: رقم الجزء، عنوان جذاب، وصف المشهد البصري (ما يظهر على الشاشة)، ونص السيناريو.
- التزم بالأسلوب المطلوب في كل الأجزاء.
- أعد النتيجة بصيغة JSON منظمة وفق المخطط المحدد.
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: responseSchema,
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error('لم يتم استلام نص من Gemini.');
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (parseErr) {
      console.error('فشل تحليل JSON:', parseErr);
      throw new Error('استجابة الذكاء الاصطناعي ليست JSON صالحاً.');
    }

    if (!parsed.scenes || !Array.isArray(parsed.scenes)) {
      throw new Error('بنية الاستجابة غير متوقعة (scenes مفقود).');
    }

    return res.status(200).json(parsed);

  } catch (err) {
    console.error('خطأ في معالجة الطلب:', err);
    const message = err.message || 'حدث خطأ أثناء الاتصال بالذكاء الاصطناعي.';
    return res.status(500).json({ error: message });
  }
}
