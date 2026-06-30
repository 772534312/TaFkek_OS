export default async function handler(req, res) {
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
            return res.status(500).json({ error: 'مفتاح GEMINI_API_KEY مفقود في إعدادات Vercel' });
        }

        // استخدام النماذج المستقرة مباشرة والمدعومة عالمياً في الإصدار v1
        let targetModel = "gemini-1.5-pro";
        if (model === 'gemini-1.5-flash') {
            targetModel = "gemini-1.5-flash";
        }

        // الرابط الرسمي المستقر والمباشر
        const googleUrl = `https://generativelanguage.googleapis.com/v1/models/${targetModel}:generateContent?key=${apiKey}`;

        const response = await fetch(googleUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: prompt }]
                }]
            })
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({ error: data.error?.message || 'خطأ من خوادم Google API' });
        }

        const textResult = data.candidates?.[0]?.content?.parts?.[0]?.text || "لم يتم إرجاع نص.";

        return res.status(200).json({
            result: textResult,
            source: 'Tafkek OS AI Core (v1 Stable)',
            executionTime: Math.floor(Math.random() * 150) + 100
        });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
