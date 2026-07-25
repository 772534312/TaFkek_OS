// ==========================================
// 1️⃣ محرك Gemini Vision (مع معالجة 429 و 404 والتبديل الذكي)
// ==========================================
async function callGemini(prompt, history = [], mediaParts = [], apiKey) {
    const key = apiKey || process.env.GEMINI_API_KEY;
    if (!key) throw new Error("مفتاح GEMINI_API_KEY غير متاح في متغيرات البيئة.");

    // النماذج المعتمدة والمتاحة حالياً
    const geminiModels = [
        "gemini-2.0-flash",
        "gemini-2.0-flash-lite-preview-02-05",
        "gemini-1.5-pro"
    ];

    let parts = [];

    // تنظيف وتنقية بيانات الصور
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

            if (response.status === 429) {
                throw new Error("QUOTA_LIMIT_429: تم تجاوز حد الاستخدام المجاني لـ Gemini.");
            }

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

            // إذا استنفدت الحصة، يتوقف عن محاولة نفس المفتاح لتفعيل التبديل إلى Groq
            if (err.message.includes("QUOTA_LIMIT_429")) {
                break;
            }
        }
    }

    throw lastError || new Error("تعذر الوصول لجميع إصدارات Gemini Vision.");
}

// ==========================================
// 2️⃣ محرك Groq (للإجابات النصية والاحتياطية)
// ==========================================
async function callGroq(prompt, history = [], apiKey) {
    const key = apiKey || process.env.GROQ_API_KEY;
    if (!key) throw new Error("مفتاح GROQ_API_KEY غير متاح في متغيرات البيئة.");

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

    let logs = [];

    try {
        const { prompt, history = [], mediaParts = [] } = req.body;
        const hasImages = mediaParts && mediaParts.length > 0;
        let finalResponse = null;

        if (hasImages) {
            try {
                logs.push("بدء معالجة الطلب عبر Gemini Vision...");
                finalResponse = await callGemini(prompt, history, mediaParts);
            } catch (geminiErr) {
                logs.push(`❌ فشل محرك Gemini: ${geminiErr.message}`);
                
                // التبديل إلى Groq في حال فشل Gemini (حتى مع وجود صور)
                if (process.env.GROQ_API_KEY) {
                    logs.push("🔄 التحويل التلقائي (Fallback) إلى Groq لمعالجة النص...");
                    const fallbackPrompt = prompt 
                        ? `${prompt}\n\n(ملاحظة: تعذر تحليل الصورة حالياً بسبب قيود حصة محرك الرؤية، وتم إجابة السؤال بناءً على النص فقط).`
                        : "قم بالإجابة بناءً على السياق المتاح (تعذر تحليل الصورة المرفقة حالياً بسبب ضغط الخدمة).";
                    
                    finalResponse = await callGroq(fallbackPrompt, history);
                } else {
                    throw geminiErr;
                }
            }
        } else {
            // المعالجة النصية
            logs.push("بدء معالجة طلب نصي...");
            if (process.env.GROQ_API_KEY) {
                try {
                    finalResponse = await callGroq(prompt, history);
                } catch (gErr) {
                    logs.push(`فشل Groq: ${gErr.message}، جاري التجربة عبر Gemini...`);
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
        console.error("API Handler Failure:", error);
        return res.status(500).json({
            error: "تعذر معالجة الطلب حالياً عبر جميع المحركات المتاحة.",
            message: error.message,
            logs: logs
        });
    }
}
