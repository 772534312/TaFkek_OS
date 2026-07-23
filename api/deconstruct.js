const express = require('express');
const cors = require('cors');
const dns = require('dns');

// 1. حل مشكلة الـ DNS (ENOTFOUND) لضمان أسبقية IPv4 عند الاتصال بـ Hugging Face والخدمات الخارجية
dns.setDefaultResultOrder('ipv4first');

const app = express();

// 2. إعدادات حجم البيانات والـ CORS (لدعم الصور والملفات الكبيرة عبر Base64)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors());

// 3. الترويسات الإجبارية لمنع استلام HTML وتضمين استجابات JSON دائماً
app.use((req, res, next) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    next();
});

// ==========================================
// محركات الذكاء الاصطناعي (AI Engines Handlers)
// ==========================================

// أ) محرك Hugging Face (مع تصحيح الـ URL الكامل والتعامل الآمن)
async function callHuggingFace(prompt, apiKey) {
    // التأكد من وجود البروتوكول https://
    const model = "meta-llama/Meta-Llama-3-8B-Instruct"; 
    const response = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey || process.env.HF_API_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ inputs: prompt })
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`HF API [Status ${response.status}]: ${errText}`);
    }

    const data = await response.json();
    if (Array.isArray(data) && data[0]?.generated_text) {
        return data[0].generated_text;
    }
    return typeof data === 'string' ? data : JSON.stringify(data);
}

// ب) محرك Gemini Vision & Text
async function callGemini(prompt, history, mediaParts, apiKey) {
    const key = apiKey || process.env.GEMINI_API_KEY;
    if (!key) throw new Error("مفتاح Gemini API غير متوفر في البيئة.");

    // دعم الاستجابة للنصوص أو الصور المرفقة
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`;
    
    let parts = [{ text: prompt }];
    if (mediaParts && Array.isArray(mediaParts) && mediaParts.length > 0) {
        parts = [...mediaParts, ...parts];
    }

    const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts }] })
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini API [Status ${response.status}]: ${errText}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "لم يتم الحصول على نص من Gemini.";
}

// ج) محرك OpenAI / DeepSeek (Fallback)
async function callOpenAIStyle(prompt, apiKey, baseURL, model) {
    const response = await fetch(`${baseURL}/chat/completions`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: model,
            messages: [{ role: "user", content: prompt }]
        })
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Engine [${model}] Status ${response.status}: ${errText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "استجابة فارغة.";
}

// ==========================================
// نظام التوجيه والتعافي التلقائي (Smart Router)
// ==========================================
async function executeSmartRouter(prompt, history, mediaParts, optionMode) {
    const engineErrors = [];

    // 1. المحاولة الأولى: Gemini (يدعم الصور والتحليل المتقدم)
    try {
        return await callGemini(prompt, history, mediaParts);
    } catch (err) {
        console.error("Gemini Fallback Triggered:", err.message);
        engineErrors.push(`Gemini Error: ${err.message}`);
    }

    // 2. المحاولة الثانية: Hugging Face
    try {
        return await callHuggingFace(prompt);
    } catch (err) {
        console.error("HuggingFace Fallback Triggered:", err.message);
        engineErrors.push(`Hugging Face Error: ${err.message}`);
    }

    // 3. المحاولة الثالثة: DeepSeek / Backup Engine
    try {
        if (process.env.DEEPSEEK_API_KEY) {
            return await callOpenAIStyle(prompt, process.env.DEEPSEEK_API_KEY, "https://api.deepseek.com/v1", "deepseek-chat");
        }
    } catch (err) {
        console.error("DeepSeek Fallback Triggered:", err.message);
        engineErrors.push(`DeepSeek Error: ${err.message}`);
    }

    // إذا فشلت جميع المحركات، نعيد تقريراً شاملاً بالأسباب لتسريع التصحيح
    throw new Error(`تعذر الحصول على رد من جميع المحركات.\nالتفاصيل التفصيلية للأخطاء:\n• ${engineErrors.join('\n• ')}`);
}

// ==========================================
// المسار الرئيسي للـ API
// ==========================================
app.post('/api/process', async (req, res) => {
    try {
        const { prompt, history, mediaParts, optionMode } = req.body;

        if (!prompt && (!mediaParts || mediaParts.length === 0)) {
            return res.status(200).json({ error: "يرجى تقديم نص أو رفع صورة للمعالجة." });
        }

        const resultText = await executeSmartRouter(
            prompt || "قم بتحليل المحتوى المرفق",
            history || [],
            mediaParts || [],
            optionMode
        );

        return res.status(200).json({
            success: true,
            result: resultText
        });

    } catch (error) {
        console.error("Final Processing Exception:", error.message);
        return res.status(200).json({
            error: error.message
        });
    }
});

// معالج الأخطاء الشامل لمنع تسريب صفحات HTML
app.use((err, req, res, next) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(200).json({ error: `خطأ في الخادم الداخلي: ${err.message}` });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Tafkek OS Engine running on port ${PORT}`));
