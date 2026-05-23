import { GoogleGenAI } from '@google/genai';

export default async function handler(req, res) {
  // استقبال طلبات POST فقط القادمة من الواجهة الأمامية
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'الطريقة غير مسموح بها' });
  }

  const { idea } = req.body;
  if (!idea) {
    return res.status(400).json({ error: 'يرجى كتابة فكرة لتفكيكها' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'مفتاح التشغيل السري GEMINI_API_KEY مفقود في السيرفر' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `قم بتفكيك الفكرة التالية إلى خطوات عمل تفصيلية ومنطقية جداً باللغة العربية واجعل النتيجة في صيغة JSON مصفوفة فقط بدون أي كود ماركداون خارجي (No markdown fences). الهيكل المطلوب للمصفوفة كأولاد يحتوي على id و title و description فقط:
      [{"id": "ai_n1", "title": "عنوان الخطوة الأولى", "description": "شرح تفصيلي لما يجب فعله هنا"}]
      الفكرة المراد تفتيتها هي: ${idea}`,
      config: {
        responseMimeType: "application/json"
      }
    });

    const data = JSON.parse(response.text);
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: 'فشلت معالجة الإشارة الكوانتية: ' + error.message });
  }
}

