const express = require('express');
const cors = require('cors');
const dns = require('dns');

// 1. إجبار ترتيب الـ IPv4 أولاً لحل مشكلة ENOTFOUND مع Hugging Face والخدمات الخاروجية
dns.setDefaultResultOrder('ipv4first');

const app = express();

// 2. رفع حد الحجم إلى 50MB لمعالجة ملفات الصور والوسائط الكبيرة
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors());

// 3. الترويسات الإجبارية لضمان نمط UTF-8 واستجابات JSON دائماً
app.use((req, res, next) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    next();
});

// ==========================================
// 🧠 محركات الذكاء الاصطناعي (AI Engines Integration)
// ==========================================

// أ) محرك Gemini 2.5 Flash (دعم النصوص والتحليل البصري Vision)
async function callGemini(prompt, history = [], mediaParts = [], apiKey) {
    const key = apiKey || process.env.GEMINI_API_KEY;
    if (!key) throw new Error("مفتاح GEMINI_API_KEY غير معرف في البيئة.");

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`;
    
    // بناء محتوى الأجزاء (Parts) لدعم النصوص والصور
    let parts = [{ text: prompt }];
    if (mediaParts && Array.isArray(mediaParts) && mediaParts.length > 0) {
        parts = [...mediaParts, ...parts];
    }

    // بناء سجل الذاكرة السياقية (Context Memory)
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

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini API Status [${response.status}]: ${errText}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "لم يتم إرجاع أي نص من Gemini.";
}

// ب) محرك OpenAI / GPT-4o
async function callOpenAI(prompt, history = [], apiKey) {
    const key = apiKey || process.env.OPENAI_API_KEY;
    if (!key) throw new Error("مفتاح OPENAI_API_KEY غير معرف في البيئة.");

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

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`OpenAI API Status [${response.status}]: ${errText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "استجابة فارغة من OpenAI.";
}

// ج) محرك DeepSeek V3 (النسخة السريعة والأعلى دقة للبرمجة)
async function callDeepSeek(prompt, history = [], apiKey) {
    const key = apiKey || process.env.DEEPSEEK_API_KEY;
    if (!key) throw new Error("مفتاح DEEPSEEK_API_KEY غير معرف في البيئة.");

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

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`DeepSeek API Status [${response.status}]: ${errText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "استجابة فارغة من DeepSeek.";
}

// د) محرك Hugging Face (مع المسار المصحح بالكامل)
async function callHuggingFace(prompt, apiKey) {
    const key = apiKey || process.env.HF_API_KEY;
    if (!key) throw new Error("مفتاح HF_API_KEY غير معرف في البيئة.");

    const model = "meta-llama/Meta-Llama-3-8B-Instruct";
    const response = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${key}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ inputs: prompt })
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`HF API Status [${response.status}]: ${errText}`);
    }

    const data = await response.json();
    if (Array.isArray(data) && data[0]?.generated_text) return data[0].generated_text;
    return typeof data === 'string' ? data : JSON.stringify(data);
}

// هـ) توليد الصور عبر نموذج FLUX (عند اختيار وضع إنشاء الصور)
async function generateImageFLUX(prompt, apiKey) {
    const key = apiKey || process.env.HF_API_KEY;
    const model = "black-forest-labs/FLUX.1-schnell";
    
    const response = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${key}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ inputs: prompt })
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`FLUX Generation Failed [${response.status}]: ${errText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64Image = Buffer.from(arrayBuffer).toString('base64');
    return `![Generated Image](data:image/jpeg;base64,${base64Image})`;
}

// ==========================================
// 🔀 نظام التوجيه والتعافي الذكي (Smart Router Engine)
// ==========================================
async function executeSmartRouter(prompt, history, mediaParts, optionMode) {
    // 🎨 إذا كان الطلب يتطلب توليد صور عبر FLUX
    if (optionMode === 'إنشاء صور' || optionMode === 'Clean Image Studio') {
        try {
            return await generateImageFLUX(prompt);
        } catch (err) {
            console.error("FLUX Engine Failed, Fallback to Gemini:", err.message);
        }
    }

    const engineErrors = [];

    // 1. المحاولة الأولى: Gemini 2.5 Flash (لأنه الأكثر تكاملاً مع الصور والذاكرة)
    try {
        return await callGemini(prompt, history, mediaParts);
    } catch (err) {
        console.error("1. Gemini Engine Failed:", err.message);
        engineErrors.push(`Gemini: ${err.message}`);
    }

    // 2. المحاولة الثانية: OpenAI GPT-4o
    try {
        return await callOpenAI(prompt, history);
    } catch (err) {
        console.error("2. OpenAI Engine Failed:", err.message);
        engineErrors.push(`OpenAI: ${err.message}`);
    }

    // 3. المحاولة الثالثة: DeepSeek V3
    try {
        return await callDeepSeek(prompt, history);
    } catch (err) {
        console.error("3. DeepSeek Engine Failed:", err.message);
        engineErrors.push(`DeepSeek: ${err.message}`);
    }

    // 4. المحاولة الرابعة: Hugging Face Llama-3
    try {
        return await callHuggingFace(prompt);
    } catch (err) {
        console.error("4. Hugging Face Engine Failed:", err.message);
        engineErrors.push(`Hugging Face: ${err.message}`);
    }

    // تقرير كامل بحالة الفشل إذا تعذرت جميع المحركات
    throw new Error(`تعذر الحصول على رد من جميع المحركات.\nتقرير الأخطاء المباشر:\n• ${engineErrors.join('\n• ')}`);
}

// ==========================================
// 🚀 المسار الرئيسي للخدمة (Main Express Route)
// ==========================================
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
        console.error("Process Route Exception:", error.message);
        // إرجاع الأخطاء بـ JSON بدلاً من HTML
        return res.status(200).json({
            error: error.message
        });
    }
});

// معالج الأخطاء العالمي لمنع إرجاع صفحات HTML
app.use((err, req, res, next) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(200).json({ error: `خطأ سيرفر غير متوقع: ${err.message}` });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Tafkek OS Multi-Engine Backend Engine running on port ${PORT}`);
});
