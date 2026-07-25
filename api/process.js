// =======================================================
// 🧠 Tafkek OS Core Engine - Multi-LLM Fallback & Vision
// =======================================================

// 1️⃣ محرك Gemini Vision (الرئيسي للصور والنصوص)
async function callGemini(prompt, history = [], mediaParts = [], apiKey) {
    const key = apiKey || process.env.GEMINI_API_KEY;
    if (!key) throw new Error("مفتاح GEMINI_API_KEY غير متوفر في متغيرات البيئة.");

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`;
    let parts = [];

    // معالجة وتنظيف بيانات الصور المرفقة
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

    const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents })
    });

    if (response.status === 429 || response.status === 403) {
        throw new Error(`QUOTA_EXHAUSTED: تجاوزت الحد المسموح أو استنفذت حصة Gemini (${response.status})`);
    }

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini Vision Error [${response.status}]: ${errText}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "لم يتم الحصول على استجابة نصية من النموذج.";
}

// 2️⃣ محرك DeepSeek V3 (احتياطي للتحليل والنصوص)
async function callDeepSeek(prompt, history = [], apiKey) {
    const key = apiKey || process.env.DEEPSEEK_API_KEY;
    if (!key) throw new Error("مفتاح DEEPSEEK_API_KEY غير متوفر.");

    const messages = history.map(h => ({
        role: h.role === 'assistant' ? 'assistant' : 'user',
        content: h.content || h.parts?.[0]?.text || ''
    }));
    messages.push({ role: "user", content: prompt });

    const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${key}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ model: "deepseek-chat", messages })
    });

    if (response.status === 429 || response.status === 402) {
        throw new Error(`QUOTA_EXHAUSTED: انتهى رصيد/خطة DeepSeek (${response.status})`);
    }

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`DeepSeek Error [${response.status}]: ${errText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "استجابة فارغة من DeepSeek.";
}

// 3️⃣ محرك OpenAI GPT-4o
async function callOpenAI(prompt, history = [], apiKey) {
    const key = apiKey || process.env.OPENAI_API_KEY;
    if (!key) throw new Error("مفتاح OPENAI_API_KEY غير متوفر.");

    const messages = history.map(h => ({
        role: h.role === 'assistant' ? 'assistant' : 'user',
        content: h.content || h.parts?.[0]?.text || ''
    }));
    messages.push({ role: "user", content: prompt });

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${key}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ model: "gpt-4o", messages })
    });

    if (response.status === 429 || response.status === 401) {
        throw new Error(`QUOTA_EXHAUSTED: انتهى رصيد OpenAI GPT-4o (${response.status})`);
    }

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`OpenAI Error [${response.status}]: ${errText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "استجابة فارغة من OpenAI.";
}

// 4️⃣ محرك Groq (Llama-3.3 70B السريع)
async function callGroq(prompt, history = [], apiKey) {
    const key = apiKey || process.env.GROQ_API_KEY;
    if (!key) throw new Error("مفتاح GROQ_API_KEY غير متوفر.");

    const messages = history.map(h => ({
        role: h.role === 'assistant' ? 'assistant' : 'user',
        content: h.content || h.parts?.[0]?.text || ''
    }));
    messages.push({ role: "user", content: prompt });

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${key}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ model: "llama-3.3-70b-versatile", messages })
    });

    if (response.status === 429) {
        throw new Error(`QUOTA_EXHAUSTED: انتهت حصة Groq المجانية (${response.status})`);
    }

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Groq Error [${response.status}]: ${errText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "استجابة فارغة من Groq.";
}

// 🎨 استوديو التصاميم والنظافة البصرية (Pollinations Engine)
async function generateOrEditImage(prompt, mediaParts = []) {
    let finalPrompt = prompt || "clean visual presentation design";

    if (mediaParts && mediaParts.length > 0) {
        try {
            const imageAnalysis = await callGemini(
                "Describe this image briefly in detailed English keywords for clean image generation.",
                [],
                mediaParts
            );
            finalPrompt = `${imageAnalysis}, modified with: ${prompt}`;
        } catch (e) {
            console.warn("استمرار التوليد بالاعتماد على الوصف النصي فقط.");
        }
    }

    const enhancedPrompt = `${finalPrompt}, clean design, professional art, high resolution 4k, strictly no text, no visual noise, blank background where appropriate`;
    const seed = Math.floor(Math.random() * 999999);
    const imageUrl = `https://image.pollinations.ai/p/${encodeURIComponent(enhancedPrompt)}?width=1024&height=1024&nologo=true&seed=${seed}`;

    return `![Generated Image](${imageUrl})\n\n**رابط الصورة المباشر:** [تحميل الصورة عالية الدقة](${imageUrl})`;
}

// =======================================================
// 🔀 الموجه الذكي (Router & Fallback Pipeline)
// =======================================================
async function executeSmartRouter(prompt, history, mediaParts, optionMode) {
    const mode = (optionMode || '').toString().toLowerCase();
    const hasImages = mediaParts && mediaParts.length > 0;

    const isImageGenerationMode = 
        mode.includes('صورة') || 
        mode.includes('صور') || 
        mode.includes('image') || 
        mode.includes(' flux') || 
        mode.includes('توليد') || 
        mode.includes('تصميم');

    if (isImageGenerationMode) {
        return await generateOrEditImage(prompt, mediaParts);
    }

    const logs = [];

    // 1️⃣ المحاولة الأولى: Gemini Vision
    try {
        return await callGemini(prompt, history, mediaParts);
    } catch (err) {
        console.warn("⚠️ فشل Gemini، التوجيه للنموذج التالي:", err.message);
        logs.push(`Gemini: ${err.message}`);
    }

    if (hasImages) {
        throw new Error(`❌ تعذر تحليل الصورة عبر محرك Vision حالياً.\nالسجل: ${logs.join(', ')}`);
    }

    // 2️⃣ المحاولة الثانية: DeepSeek
    try {
        return await callDeepSeek(prompt, history);
    } catch (err) {
        console.warn("⚠️ فشل DeepSeek:", err.message);
        logs.push(`DeepSeek: ${err.message}`);
    }

    // 3️⃣ المحاولة الثالثة: OpenAI
    try {
        return await callOpenAI(prompt, history);
    } catch (err) {
        console.warn("⚠️ فشل OpenAI:", err.message);
        logs.push(`OpenAI: ${err.message}`);
    }

    // 4️⃣ المحاولة الرابعة: Groq
    try {
        return await callGroq(prompt, history);
    } catch (err) {
        console.warn("⚠️ فشل Groq:", err.message);
        logs.push(`Groq: ${err.message}`);
    }

    throw new Error(`❌ فشلت كافة المحركات المتاحة لمعالجة الطلب:\n${logs.join('\n')}`);
}

// =======================================================
// 🚀 Vercel Endpoint Handler
// =======================================================
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    try {
        const { prompt, history, mediaParts, optionMode } = req.body || {};

        if (!prompt && (!mediaParts || mediaParts.length === 0)) {
            return res.status(400).json({ error: "يرجى كتابة نص أو إرفاق ملف للبدء." });
        }

        const resultText = await executeSmartRouter(
            prompt || "قم بتحليل المحتوى المرفق واقتراح المطلوب.",
            history || [],
            mediaParts || [],
            optionMode
        );

        return res.status(200).json({
            success: true,
            result: resultText
        });

    } catch (error) {
        console.error("Server API Error:", error.message);
        return res.status(500).json({ error: error.message });
    }
}
