// ==========================================
// 1️⃣ محرك Gemini Vision (مع التبديل الذكي للإصدارات)
// ==========================================
async function callGemini(prompt, history = [], mediaParts = [], apiKey) {
    const key = apiKey || process.env.GEMINI_API_KEY;
    if (!key) throw new Error("مفتاح GEMINI_API_KEY غير متوفر في متغيرات البيئة.");

    // أسماء النماذج مرتبة حسب الأحدث والأكثر استقراراً
    const geminiModels = [
        "gemini-2.0-flash",
        "gemini-1.5-flash-latest",
        "gemini-1.5-flash"
    ];

    let parts = [];

    // تنقية وتجهيز بيانات الصور المرفقة
    if (mediaParts && Array.isArray(mediaParts) && mediaParts.length > 0) {
        mediaParts.forEach(m => {
            if (m.inlineData && m.inlineData.data) {
                const cleanBase64 = m.inlineData.data.replace(/^data:image\/\w+;base64,/, '');
                parts.push({
                    inlineData: {
                        mimeType: m.inlineData.mimeType || 'image/jpeg',
                        data: cleanBase64
                    }
                });
            } else if (m.base64Data || m.base64) {
                const rawData = m.base64Data || m.base64;
                const cleanBase64 = rawData.replace(/^data:image\/\w+;base64,/, '');
                parts.push({
                    inlineData: {
                        mimeType: m.mimeType || 'image/jpeg',
                        data: cleanBase64
                    }
                });
            }
        });
    }

    parts.push({ text: prompt || "قم بتحليل المحتوى المرفق بالتفصيل." });

    const contents = history.map(h => ({
        role: h.role === 'assistant' || h.role === 'model' ? 'model' : 'user',
        parts: [{ text: h.content || h.parts?.[0]?.text || '' }]
    })).filter(c => c.parts[0].text);

    contents.push({ role: 'user', parts });

    let lastError = null;

    // تجربة النماذج بالتتابع لحل مشكلة 404 وضمان الاستقرار
    for (const modelName of geminiModels) {
        try {
            const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${key}`;
            
            const response = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ contents })
            });

            if (response.status === 429 || response.status === 403) {
                throw new Error(`QUOTA_EXHAUSTED: تجاوزت الحد المسموح لـ Gemini (${response.status})`);
            }

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Gemini [${modelName}] Error [${response.status}]: ${errText}`);
            }

            const data = await response.json();
            const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (resultText) return resultText;

        } catch (err) {
            console.warn(`⚠️ فشل نموذج Gemini (${modelName}):`, err.message);
            lastError = err;
            if (err.message.includes("QUOTA_EXHAUSTED")) break;
        }
    }

    throw lastError || new Error("تعذر الوصول لجميع إصدارات Gemini Vision.");
}

// ==========================================
// 2️⃣ محرك Groq / OpenAI (كخيار بديل/سريع)
// ==========================================
async function callGroq(prompt, history = [], apiKey) {
    const key = apiKey || process.env.GROQ_API_KEY;
    if (!key) throw new Error("مفتاح GROQ_API_KEY غير متوفر.");

    const messages = history.map(h => ({
        role: h.role === 'model' ? 'assistant' : h.role,
        content: h.content || h.parts?.[0]?.text || ''
    })).filter(m => m.content);

    messages.push({ role: 'user', content: prompt });

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${key}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: messages,
            temperature: 0.7
        })
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Groq Error [${response.status}]: ${errText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "لم يتم استلام رد من Groq.";
}

// ==========================================
// 3️⃣ الـ API Handler الرئيسي (Serverless Function)
// ==========================================
export default async function handler(req, res) {
    // إعدادات CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { prompt, history = [], mediaParts = [], preferredEngine = 'auto' } = req.body;

        const hasImages = mediaParts && mediaParts.length > 0;
        let logs = [];
        let finalResponse = null;

        // إذا كان هناك صور، يجب استخدام Gemini Vision أولاً
        if (hasImages || preferredEngine === 'gemini') {
            try {
                logs.push("محاولة معالجة الطلب عبر محرك Gemini Vision...");
                finalResponse = await callGemini(prompt, history, mediaParts);
            } catch (geminiErr) {
                logs.push(`❌ خطأ Gemini: ${geminiErr.message}`);
                
                // التبديل إلى Groq إذا كان الطلب نصياً أو إذا فشل Gemini
                if (!hasImages && process.env.GROQ_API_KEY) {
                    logs.push("🔄 التحويل التلقائي (Fallback) إلى محرك Groq...");
                    finalResponse = await callGroq(prompt, history);
                } else {
                    throw geminiErr;
                }
            }
        } else {
            // المعالجة النصية بأسلوب Auto/Groq
            try {
                if (process.env.GROQ_API_KEY) {
                    logs.push("معالجة الطلب النصي عبر Groq...");
                    finalResponse = await callGroq(prompt, history);
                } else {
                    logs.push("Groq غير متوفر، استخدام Gemini...");
                    finalResponse = await callGemini(prompt, history, mediaParts);
                }
            } catch (err) {
                logs.push(`❌ خطأ المحرك الأول: ${err.message}`);
                logs.push("🔄 تجربة Gemini كخيار احتياطي...");
                finalResponse = await callGemini(prompt, history, mediaParts);
            }
        }

        return res.status(200).json({
            success: true,
            text: finalResponse,
            logs: logs
        });

    } catch (error) {
        console.error("API Handler Failure:", error);
        return res.status(500).json({
            error: "تعذر معالجة الطلب حالياً عبر جميع المحركات المتاحة.",
            details: error.message
        });
    }
}
