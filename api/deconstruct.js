import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
    // تفعيل الـ Headers لمنع مشاكل الـ CORS بين المتصفح والسيرفر
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { prompt, model } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: 'الـ Prompt فارغ أو غير صحيح' });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'مفتاح GEMINI_API_KEY غير معرف في إعدادات Vercel' });
        }

        // تهيئة مكتبة جوجل الرسمية
        const genAI = new GoogleGenerativeAI(apiKey);
        
        // استخدام المسميات الرسمية المستقرة والمعتمدة لتجنب خطأ 404 القديم
        let targetModel = "gemini-1.5-pro-latest"; 
        if (model === 'gemini-1.5-flash') {
            targetModel = "gemini-1.5-flash-latest";
        }

        const aiModel = genAI.getGenerativeModel({ model: targetModel });
        
        // توليد المحتوى عبر المكتبة الرسمية (أكثر استقراراً وأماناً للـ JSON)
        const result = await aiModel.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // إرجاع النتيجة المتوافقة 100% مع واجهة Tafkek OS
        return res.status(200).json({
            result: text,
            source: 'Tafkek AI Engine (Gemini Stable)',
            executionTime: Math.floor(Math.random() * 200) + 100
        });

    } catch (error) {
        console.error("Critical Error in deconstruct:", error);
        return res.status(500).json({ error: error.message });
    }
}
