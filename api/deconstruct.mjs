import { GoogleGenAI } from '@google/genai';

// دالة مساعدة لعمل تأخير بسيط بين محاولات إعادة الاتصال
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { idea, history } = req.body;
    if (!idea) {
        return res.status(400).json({ error: 'Missing idea payload' });
    }

    // التأكد من وجود مفتاح الـ API
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'SaaS Core Error: GEMINI_API_KEY is missing in environment.' });
    }

    const ai = new GoogleGenAI({ apiKey: apiKey });

    // مصفوفة المحركات: يبدأ بالأساسي، وإذا فشل يحول للاحتياطي فوراً
    const modelsToTry = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
    let lastError = null;

    // لولب فحص المحركات وإعادة المحاولة الذكية
    for (const modelName of modelsToTry) {
        let attempts = 3; // عدد محاولات إعادة الطلب لكل نموذج في حال الازدحام
        
        while (attempts > 0) {
            try {
                // صياغة البرومبت الهندسي للنظام
                const systemInstruction = `You are the core engine of Tafkek OS... (ضع هنا تعليمات الموجه الخاصة بنظامك)`;

                const response = await ai.models.generateContent({
                    model: modelName,
                    contents: idea,
                    config: {
                        systemInstruction: systemInstruction,
                        responseMimeType: "application/json",
                        temperature: 0.7
                    }
                });

                // إذا نجحت الاستجابة، أرسلها فوراً للمستخدم واقطع اللولب
                const responseText = response.text();
                return res.status(200).json(JSON.parse(responseText));

            } catch (error) {
                lastError = error;
                // إذا كان الخطأ بسبب الازدحام (503)، انتظر قوفاً وأعد المحاولة
                if (error.status === 503 || (error.message && error.message.includes('demand'))) {
                    attempts--;
                    await delay(500); // الانتظار لنصف ثانية قبل إعادة المحاولة تلقائياً
                } else {
                    // إذا كان الخطأ شيئاً آخر غير الازدحام، انتقل للموديل التالي فوراً
                    break; 
                }
            }
        }
    }

    // إذا جرب كل المحاولات وكل الموديلات وفشل (حالة انهيار كامل لسيرفرات جوجل)
    return res.status(503).json({ 
        error: "جمیع محركات الذكاء الاصطناعي مزدحمة حالياً.", 
        details: lastError?.message 
    });
}

