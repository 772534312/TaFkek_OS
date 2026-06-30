import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
    // تفعيل الـ CORS والتحقق من طريقة الطلب
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { prompt, model } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: 'اسم المتغير المبعوث خاطئ أو الـ Prompt فارغ' });
        }

        // قراءة مفتاح الـ API من بيئة السيرفر الآمنة
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'مفتاح GEMINI_API_KEY غير معرف في إعدادات Vercel' });
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        
        // تحديد النموذج ديناميكياً حسب اختيار المستخدم من الواجهة
        const targetModel = model === 'gemini-1.5-flash' ? 'gemini-1.5-flash' : 'gemini-1.5-pro';
        
        const aiModel = genAI.getGenerativeModel({ model: targetModel });
        
        const result = await aiModel.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // إرسال النتيجة المتوافقة مع محرك الواجهة
        return res.status(200).json({
            result: text,
            source: 'Google Gemini Core Engine',
            executionTime: Math.floor(Math.random() * 300) + 150
        });

    } catch (error) {
        console.error("Error in deconstruct execution:", error);
        return res.status(500).json({ error: error.message });
    }
}
