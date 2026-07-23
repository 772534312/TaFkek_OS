import https from 'https';

// ==========================================
// 🛠️ 1. دالة المساعدة الموحدة لطلبات HTTPS
// ==========================================
const makeHttpsRequest = (options, postData) => {
    return new Promise((resolve, reject) => {
        const request = https.request(options, response => {
            response.setEncoding('utf-8');
            let body = '';
            response.on('data', chunk => body += chunk);
            response.on('end', () => {
                try {
                    resolve({ status: response.statusCode, data: JSON.parse(body) });
                } catch (err) {
                    reject(new Error("فشل في معالجة الاستجابة من السيرفر"));
                }
            });
        });
        request.on('error', reject);
        request.write(postData, 'utf-8');
        request.end();
    });
};

// ==========================================
// 🧠 2. محرك Gemini: للترجمة الذكية وتطوير الطلب
// ==========================================
const translateAndExpandPrompt = async (arabicPrompt) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return arabicPrompt; // إذا لم يوجد مفتاح، نعود للأصل

    const instructions = `
        You are an expert AI image prompt engineer. Your task is to translate Arabic image descriptions into highly detailed, professional, and descriptive English prompts for image generation models like FLUX.
        
        Rules:
        1.  Analyze the provided Arabic text.
        2.  Translate the core concept into English.
        3.  Expand the concept by adding details about lighting (e.g., cinematic lighting, soft light), style (e.g., photorealistic, digital art, vector), camera angle, colors, and environment to make it visually stunning.
        4.  Output ONLY the expanded English prompt text. No introduction, no explanations.
        5.  If the Arabic text is too simple, enhance it significantly to ensure a high-quality output.

        Arabic Input: "${arabicPrompt}"
        Output English Prompt:
    `;

    const postData = JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: instructions }] }],
        tools: [], // لا نحتاج للبحث هنا
        systemInstruction: { parts: [{ text: "Translate and expand image prompts precisely." }] }
    });

    const options = {
        hostname: 'generativelanguage.googleapis.com',
        port: 443,
        path: `/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, // نستخدم pro للسرعة والدقة
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
    };

    try {
        const result = await makeHttpsRequest(options, postData);
        if (result.status === 200 && result.data.candidates?.[0]?.content?.parts?.[0]?.text) {
            return result.data.candidates[0].content.parts[0].text.trim();
        }
    } catch (e) {
        console.error("Gemini Translation Error:", e);
    }
    return arabicPrompt; // في حال الفشل، نعود للأصل (سنواجه جودة ضعيفة)
};

// ==========================================
// 🎨 3. محرك توليد الصور الدقيق (بعد التطوير)
// ==========================================
const generateFreeImage = (expandedEnglishPrompt) => {
    // تنظيف النص وتشفيره للرابط
    const safePrompt = encodeURIComponent(expandedEnglishPrompt.replace(/[^\w\s]/gi, ''));
    const randomSeed = Math.floor(Math.random() * 999999);
    
    // نموذج Flux المباشر الذي سيعطي الآن جودة خارقة بالإنجليزية
    const imageUrl = `https://image.pollinations.ai/prompt/${safePrompt}?width=1024&height=1024&seed=${randomSeed}&model=flux&nologo=true`;

    return `![Tafkek Expanded Image](${imageUrl})\n\n*(وصف الصورة الذكي الذي تم استخدامه: ${expandedEnglishPrompt})*\n\n`;
};

// ==========================================
// 🧠 4. محرك Gemini النصي (باقي الطلبات)
// ==========================================
const tryGeminiText = async (prompt, history = [], mediaParts = []) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return { error: "Missing Key" };

    const contents = [];
    if (history && Array.isArray(history)) {
        history.forEach(msg => {
            contents.push({ role: msg.role === 'user' ? 'user' : 'model', parts: [{ text: msg.content }] });
        });
    }

    const currentParts = [{ text: prompt }];
    // ... (جزء الوسائط المعتاد كما هو في كودك) ...

    contents.push({ role: 'user', parts: currentParts });

    const postData = JSON.stringify({
        contents: contents,
        systemInstruction: { parts: [{ text: "أنت نظام Tafkek OS الذكي المتكامل. أجب بدقة وفصاحة، واستخدم التنسيق الأنيق المعتمد على Markdown." }] }
    });

    const options = {
        hostname: 'generativelanguage.googleapis.com',
        port: 443,
        path: `/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
    };

    const result = await makeHttpsRequest(options, postData);
    if (result.status === 200 && result.data.candidates?.[0]?.content?.parts?.[0]?.text) {
        return { result: result.data.candidates[0].content.parts[0].text.trim(), source: "Gemini Pro Text" };
    }
    return { error: result.data?.error?.message || `Gemini Error Status ${result.status}` };
};

// ... (تستطيع إبقاء tryChatGPT و tryDeepSeek كما هما لاستخدامهما في Fallback للنص) ...

// ==========================================
// 🎯 5. المعالج الرئيسي الذكي (Smart Handler)
// ==========================================
export default async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const { prompt, history, mediaParts } = req.body;
        const userPrompt = prompt || "قم بتحليل هذا الطلب.";

        // 🔍 1. الفحص الشامل لطلبات الصور
        const imageKeywords = ["صورة", "صوره", "صور", "ارسم", "أنشئ", "انشئ", "صمم", "توليد", "شعار", "draw", "image", "generate", "picture", "logo"];
        const isImageRequest = userPrompt && imageKeywords.some(kw => userPrompt.toLowerCase().includes(kw));

        if (isImageRequest) {
            // أ. ترجمة وتطوير الطلب العربي أولاً عبر Gemini
            const expandedPrompt = await translateAndExpandPrompt(userPrompt);
            
            // ب. توليد الصورة بالوصف الإنجليزي الجديد
            const imageMarkdown = generateFreeImage(expandedPrompt);
            
            // ج. إرسال الصورة فوراً للواجهة
            return res.status(200).json({ 
                result: imageMarkdown, 
                source: "Tafkek Smart Vision Engine (FLUX Expanded by Gemini)"
            });
        }

        // 🎯 2. المعالجة النصية (كما هي في كودك الحالي مع استبدال tryGemini بدالة tryGeminiText)
        const response = await tryGeminiText(userPrompt, history, mediaParts);

        if (response.result) {
            return res.status(200).json({ 
                result: response.result.trim().replace(/\uFFFD/g, ''), 
                source: `Tafkek Router -> ${response.source}`
            });
        } else {
            return res.status(200).json({ result: `⚠️ حدث خطأ: ${response.error}` });
        }

    } catch (e) {
        console.error("Handler Error:", e);
        return res.status(500).json({ error: e.message });
    }
}
