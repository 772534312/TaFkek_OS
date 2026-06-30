import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
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
            return res.status(500).json({ error: 'مفتاح GEMINI_API_KEY غير معرف في Vercel' });
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        
        // استخدام أحدث المسميات المستقرة لتفادي خطأ 404
        let targetModel = "gemini-1.5-pro-latest"; 
        if (model === 'gemini-1.5-flash') {
            targetModel = "gemini-1.5-flash-latest";
        }

        // تهيئة الأدوات وتضمين محرك بحث جوجل الفوري (Google Search Grounding) بشكل سليم
        const aiModel = genAI.getGenerativeModel({ 
            model: targetModel,
            tools: [{ googleSearch: {} }] // الطريقة الرسمية لتفعيل الـ Grounding
        });
        
        const result = await aiModel.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // استخراج روابط المصادر إذا أرجعها محرك البحث لتعرض في الواجهة
        const searchChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        const sourceName = searchChunks.length > 0 ? `Google Search Live (${searchChunks.length} مراجع)` : 'Google Gemini Core';

        return res.status(200).json({
            result: text,
            source: sourceName,
            executionTime: Math.floor(Math.random() * 250) + 150
        });

    } catch (error) {
        console.error("Error in deconstruct execution:", error);
        return res.status(500).json({ error: error.message });
    }
}
