// ==========================================
// 1️⃣ محرك Gemini Vision (مع التبديل الذكي للإصدارات)
// ==========================================
async function callGemini(prompt, history = [], mediaParts = [], apiKey) {
    const key = apiKey || process.env.GEMINI_API_KEY;
    if (!key) throw new Error("مفتاح GEMINI_API_KEY غير متاح في متغيرات البيئة.");

    const geminiModels = [
        "gemini-2.0-flash",
        "gemini-1.5-flash-latest",
        "gemini-1.5-flash"
    ];

    let parts = [];

    if (mediaParts && Array.isArray(mediaParts) && mediaParts.length > 0) {
        mediaParts.forEach(m => {
            const rawData = m.inlineData?.data || m.base64Data || m.base64;
            if (rawData) {
                const cleanBase64 = rawData.replace(/^data:image\/\w+;base64,/, '');
                parts.push({
                    inlineData: {
                        mimeType: m.mimeType || m.inlineData?.mimeType || 'image/jpeg',
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

    for (const modelName of geminiModels) {
        try {
            const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${key}`;
            
            const response = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ contents })
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`[${modelName}] St:${response.status} - ${errText}`);
            }

            const data = await response.json();
            const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (resultText) return resultText;

        } catch (err) {
            console.warn(`⚠️ فشل نموذج ${modelName}:`, err.message);
            lastError = err;
        }
    }

    throw lastError || new Error("تعذر الوصول لجميع إصدارات Gemini Vision.");
}

// ==========================================
// 2️⃣ محرك Groq (كخيار بديل/سريع للنصوص)
// ==========================================
async function callGroq(prompt, history = [], apiKey) {
    const key = apiKey || process.env.GROQ_API_KEY;
    if (!key) throw new Error("مفتاح GROQ_API_KEY غير متاح.");

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
// 3️⃣ الـ API Handler الرئيسي
// ==========================================
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    let logs = [];

    try {
        const { prompt, history = [], mediaParts = [] } = req.body;
        const hasImages = mediaParts && mediaParts.length > 0;
        let finalResponse = null;

        if (hasImages) {
            logs.push("بدء معالجة الصور عبر Gemini Vision...");
            finalResponse = await callGemini(prompt, history, mediaParts);
        } else {
            logs.push("بدء معالجة طلب نصي...");
            if (process.env.GROQ_API_KEY) {
                try {
                    finalResponse = await callGroq(prompt, history);
                } catch (gErr) {
                    logs.push(`فشل Groq: ${gErr.message}، جاري تجربة Gemini...`);
                    finalResponse = await callGemini(prompt, history, mediaParts);
                }
            } else {
                finalResponse = await callGemini(prompt, history, mediaParts);
            }
        }

        return res.status(200).json({
            success: true,
            text: finalResponse,
            logs: logs
        });

    } catch (error) {
        console.error("API Error Details:", error);
        return res.status(500).json({
            error: "تعذر معالجة الطلب حالياً عبر المحركات المتاحة.",
            message: error.message,
            logs: logs
        });
    }
}
