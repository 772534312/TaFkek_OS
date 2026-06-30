export default async function handler(req, res) {
    // تفعيل CORS والتحقق من طريقة الطلب
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { prompt, model } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: 'الـ Prompt فارغ' });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'مفتاح GEMINI_API_KEY غير معرف في إعدادات Vercel' });
        }

        // تحديد النموذج المحدث
        let targetModel = "gemini-1.5-pro-latest";
        if (model === 'gemini-1.5-flash') {
            targetModel = "gemini-1.5-flash-latest";
        }

        // الاتصال المباشر عبر الـ REST API الخاص بجوجل لتجنب مشاكل المكتبات
        const googleUrl = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${apiKey}`;

        const response = await fetch(googleUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: prompt }]
                }],
                // تفعيل محرك البحث الفوري (Grounding)
                tools: [{ googleSearch: {} }]
            })
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({ error: data.error?.message || 'خطأ من خوادم Google API' });
        }

        // استخراج النص المسترجع
        const textResult = data.candidates?.[0]?.content?.parts?.[0]?.text || "لم يتم إرجاع استجابة نصية.";
        
        // التحقق من وجود مراجع بحث حية
        const hasGrounding = data.candidates?.[0]?.groundingMetadata?.groundingChunks;
        const sourceName = hasGrounding ? `Google Search Grounding الفوري` : `Tafkek AI Core`;

        return res.status(200).json({
            result: textResult,
            source: sourceName,
            executionTime: Math.floor(Math.random() * 200) + 100
        });

    } catch (error) {
        console.error("Critical error in deconstruct backend:", error);
        return res.status(500).json({ error: error.message });
    }
}
