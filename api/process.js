import express from 'express';
import cors from 'cors';
import dns from 'dns';

dns.setDefaultResultOrder('ipv4first');

const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors());

app.use((req, res, next) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    next();
});

// =======================================================
// 🧠 محركات الذكاء الاصطناعي مع فحص نفاد الحصة (Quota Detection)
// =======================================================

// 1. محرك Gemini (Gemini 2.5 Flash / Pro)
async function callGemini(prompt, history = [], mediaParts = [], apiKey) {
    const key = apiKey || process.env.GEMINI_API_KEY;
    if (!key) throw new Error("مفتاح GEMINI_API_KEY غير متوفر.");

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`;
    
    let parts = [{ text: prompt }];
    if (mediaParts && Array.isArray(mediaParts) && mediaParts.length > 0) {
        const formattedMedia = mediaParts.map(m => {
            if (m.inlineData) return m;
            if (m.base64 && m.mimeType) {
                return {
                    inlineData: {
                        data: m.base64.replace(/^data:image\/\w+;base64,/, ''),
                        mimeType: m.mimeType
                    }
                };
            }
            return null;
        }).filter(Boolean);
        parts = [...formattedMedia, ...parts];
    }

    const contents = history.map(h => ({
        role: h.role === 'assistant' || h.role === 'model' ? 'model' : 'user',
        parts: [{ text: h.content }]
    }));
    contents.push({ role: 'user', parts });

    const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents })
    });

    if (response.status === 429 || response.status === 403) {
        throw new Error(`QUOTA_EXHAUSTED: انتهت خطة Gemini المجانية أو تم تجاوز الحد المسموح (${response.status})`);
    }

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini Error [${response.status}]: ${errText}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "استجابة فارغة من Gemini.";
}

// 2. محرك DeepSeek V3 / R1
async function callDeepSeek(prompt, history = [], apiKey) {
    const key = apiKey || process.env.DEEPSEEK_API_KEY;
    if (!key) throw new Error("مفتاح DEEPSEEK_API_KEY غير متوفر.");

    const messages = history.map(h => ({
        role: h.role === 'assistant' ? 'assistant' : 'user',
        content: h.content
    }));
    messages.push({ role: "user", content: prompt });

    const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${key}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: "deepseek-chat",
            messages: messages
        })
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

// 3. محرك OpenAI / ChatGPT (GPT-4o)
async function callOpenAI(prompt, history = [], apiKey) {
    const key = apiKey || process.env.OPENAI_API_KEY;
    if (!key) throw new Error("مفتاح OPENAI_API_KEY غير متوفر.");

    const messages = history.map(h => ({
        role: h.role === 'assistant' ? 'assistant' : 'user',
        content: h.content
    }));
    messages.push({ role: "user", content: prompt });

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${key}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: "gpt-4o",
            messages: messages
        })
    });

    if (response.status === 429 || response.status === 401) {
        throw new Error(`QUOTA_EXHAUSTED: انتهى رصيد/خطة OpenAI GPT-4o (${response.status})`);
    }

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`OpenAI Error [${response.status}]: ${errText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "استجابة فارغة من OpenAI.";
}

// 4. محرك Groq الفائق (Llama 3 70B - نموذج إضافي سريح ومجاني)
async function callGroq(prompt, history = [], apiKey) {
    const key = apiKey || process.env.GROQ_API_KEY;
    if (!key) throw new Error("مفتاح GROQ_API_KEY غير متوفر.");

    const messages = history.map(h => ({
        role: h.role === 'assistant' ? 'assistant' : 'user',
        content: h.content
    }));
    messages.push({ role: "user", content: prompt });

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${key}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: messages
        })
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

// 5. محرك Hugging Face (نموذج احتياطي إضافي)
async function callHuggingFace(prompt, apiKey) {
    const key = apiKey || process.env.HF_API_KEY;
    if (!key) throw new Error("مفتاح HF_API_KEY غير متوفر.");

    const response = await fetch("https://api-inference.huggingface.co/models/meta-llama/Meta-Llama-3-8B-Instruct", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${key}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ inputs: prompt })
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Hugging Face Error [${response.status}]: ${errText}`);
    }

    const data = await response.json();
    if (Array.isArray(data) && data[0]?.generated_text) return data[0].generated_text;
    return typeof data === 'string' ? data : JSON.stringify(data);
}

// 🎨 توليد الصور وتعديلها عبر FLUX
async function generateOrEditImage(prompt, mediaParts = []) {
    let finalPrompt = prompt;

    if (mediaParts && mediaParts.length > 0) {
        try {
            const imageAnalysis = await callGemini(
                "Describe this image briefly in detailed English keywords for an image generator prompt.",
                [],
                mediaParts
            );
            finalPrompt = `${imageAnalysis}, modified with: ${prompt}`;
        } catch (e) {
            console.warn("استمرار توليد الصورة بالاعتماد على الوصف النصي المباشر.");
        }
    }

    const enhancedPrompt = `${finalPrompt}, clean design, highly detailed, professional art, high resolution 4k, strictly no text, no visual noise, accurate geometry`;
    const seed = Math.floor(Math.random() * 999999);
    const imageUrl = `https://image.pollinations.ai/p/${encodeURIComponent(enhancedPrompt)}?width=1024&height=1024&nologo=true&seed=${seed}`;

    return `![Generated Image](${imageUrl})\n\n**الرابط المباشر للصورة:** [تحميل الصورة](${imageUrl})`;
}

// =======================================================
// 🔀 الموجه المتسلسل التلقائي عند نفاد الخطط المجانية (Multi-LLM Fallback Engine)
// =======================================================
async function executeSmartRouter(prompt, history, mediaParts, optionMode) {
    // إذا كان الخيار توليد أو تعديل صور
    if (optionMode === 'إنشاء صور' || optionMode === 'Clean Image Studio' || optionMode === 'استوديو توليد وتعديل الصور الذكي') {
        return await generateOrEditImage(prompt, mediaParts);
    }

    const engineChainLogs = [];

    // 1️⃣ المستوى الأول: Gemini 2.5 Flash
    try {
        const res = await callGemini(prompt, history, mediaParts);
        return res;
    } catch (err) {
        console.warn("⚠️ فشل Gemini، التبديل إلى النموذج التالي:", err.message);
        engineChainLogs.push(`1. Gemini Exceeded/Failed: ${err.message}`);
    }

    // 2️⃣ المستوى الثاني: DeepSeek V3 / R1
    try {
        const res = await callDeepSeek(prompt, history);
        return res;
    } catch (err) {
        console.warn("⚠️ فشل DeepSeek، التبديل إلى النموذج التالي:", err.message);
        engineChainLogs.push(`2. DeepSeek Exceeded/Failed: ${err.message}`);
    }

    // 3️⃣ المستوى الثالث: OpenAI GPT-4o
    try {
        const res = await callOpenAI(prompt, history);
        return res;
    } catch (err) {
        console.warn("⚠️ فشل OpenAI، التبديل إلى النموذج التالي:", err.message);
        engineChainLogs.push(`3. OpenAI Exceeded/Failed: ${err.message}`);
    }

    // 4️⃣ المستوى الرابع: Groq Llama-3.3 70B (نموذج مجاني وفائق السرعة)
    try {
        const res = await callGroq(prompt, history);
        return res;
    } catch (err) {
        console.warn("⚠️ فشل Groq، التبديل إلى النموذج الاحتياطي الخارجي:", err.message);
        engineChainLogs.push(`4. Groq Exceeded/Failed: ${err.message}`);
    }

    // 5️⃣ المستوى الخامس: Hugging Face Llama-3
    try {
        const res = await callHuggingFace(prompt);
        return res;
    } catch (err) {
        engineChainLogs.push(`5. Hugging Face Exceeded/Failed: ${err.message}`);
    }

    // إذا نفذت جميع المفاتيح والخطط المجانية
    throw new Error(`❌ تعذر معالجة الطلب. تم استهلاك كافة الخطط المجانية في جميع النماذج المتاحة.\nسجل المحاولات:\n• ${engineChainLogs.join('\n• ')}`);
}

// Express Route
app.post('/api/process', async (req, res) => {
    try {
        const { prompt, history, mediaParts, optionMode } = req.body;

        if (!prompt && (!mediaParts || mediaParts.length === 0)) {
            return res.status(200).json({ error: "يرجى كتابة نص أو رفع صورة لتبدأ المعالجة." });
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
        return res.status(200).json({ error: error.message });
    }
});

app.use((err, req, res, next) => {
    res.status(200).json({ error: `خطأ سيرفر غير متوقع: ${err.message}` });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Tafkek OS Multi-LLM Engine listening on port ${PORT}`);
});
