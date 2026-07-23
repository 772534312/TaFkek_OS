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
// 🎨 2. مترجم وتطوير طلبات الصور الذكي
// ==========================================
const translateAndExpandPrompt = async (arabicPrompt) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return arabicPrompt;

    const instructions = `
You are an expert AI image prompt engineer. Your task is to convert the user's image request into a highly detailed, high-quality, professional English prompt for FLUX/SDXL image models.

Rules:
1. Translate the Arabic description to English accurately.
2. Expand it with professional details (lighting, resolution, style, colors, environment, camera perspective).
3. Do NOT include words like "draw", "generate", or "create".
4. Output ONLY the refined English prompt text. No introductory or extra commentary.

User Request: "${arabicPrompt}"
`;

    const postData = JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: instructions }] }]
    });

    const options = {
        hostname: 'generativelanguage.googleapis.com',
        port: 443,
        path: `/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
    };

    try {
        const result = await makeHttpsRequest(options, postData);
        if (result.status === 200 && result.data.candidates?.[0]?.content?.parts?.[0]?.text) {
            return result.data.candidates[0].content.parts[0].text.trim();
        }
    } catch (e) {
        console.error("Image Prompt Expansion Error:", e);
    }
    
    // في حال تعثر الترجمة يتم تنظيف النص العربي وإرساله
    return arabicPrompt.replace(/(ارسم|انشئ|أنشئ|صمم|توليد|صورة|صوره|صور|شعار|لي|draw|image|generate|picture|logo)/gi, '').trim();
};

// ==========================================
// 🖼️ 3. محرك توليد الصور المباشر
// ==========================================
const generateFreeImage = (expandedPrompt) => {
    const safePrompt = encodeURIComponent(expandedPrompt);
    const randomSeed = Math.floor(Math.random() * 999999);
    
    const imageUrl = `https://image.pollinations.ai/prompt/${safePrompt}?width=1024&height=1024&seed=${randomSeed}&model=flux&nologo=true`;

    return `![Tafkek Generated Image](${imageUrl})\n\n`;
};

// ==========================================
// 🧠 4. محرك Gemini 2.5 Flash النصي
// ==========================================
const tryGemini = async (prompt, history = [], mediaParts = []) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return { error: "Missing Key" };

    const contents = [];

    if (history && Array.isArray(history)) {
        history.forEach(msg => {
            contents.push({
                role: msg.role === 'user' ? 'user' : 'model',
                parts: [{ text: msg.content }]
            });
        });
    }

    const currentParts = [{ text: prompt }];
    if (mediaParts && Array.isArray(mediaParts)) {
        mediaParts.forEach(item => {
            if (item.inlineData) {
                currentParts.push({ 
                    inline_data: { mime_type: item.inlineData.mimeType, data: item.inlineData.data } 
                });
            }
        });
    }

    contents.push({ role: 'user', parts: currentParts });

    const postData = JSON.stringify({
        contents: contents,
        tools: [{ googleSearch: {} }],
        systemInstruction: {
            parts: [{ text: "أنت نظام Tafkek OS الذكي المتكامل. إذا طلب المستخدم صورة، اعلم أن محرك الصور المدمج سيولدها تلقائياً، فلا تقل أنك لا تستطيع إنشاء الصور. قم بالإجابة على باقي الأجزاء النصية والبرمجية من الطلب بدقة وتنسيق Markdown." }]
        }
    });

    const options = {
        hostname: 'generativelanguage.googleapis.com',
        port: 443,
        path: `/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
    };

    const result = await makeHttpsRequest(options, postData);
    if (result.status === 200 && result.data.candidates?.[0]?.content?.parts) {
        let output = "";
        result.data.candidates[0].content.parts.forEach(p => { if (p.text) output += p.text; });
        return { result: output, source: "Gemini 2.5 Flash" };
    }
    if (result.status === 429) return { error: "Quota Exceeded (429)" };
    return { error: result.data?.error?.message || `Gemini Error Status ${result.status}` };
};

// ==========================================
// 💻 5. محرك OpenAI ChatGPT (GPT-4o)
// ==========================================
const tryChatGPT = async (prompt, history = [], mediaParts = []) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return { error: "Missing Key" };

    const messages = [
        { role: "system", content: "أنت نظام Tafkek OS الذكي والمتخصص في حل الأكواد والتحليل المنطقي. إذا طلب المستخدم صورة، قم بإجابة الأجزاء البرمجية والنصية فقط بأسلوب متناسق." }
    ];

    if (history && Array.isArray(history)) {
        history.forEach(msg => {
            messages.push({
                role: msg.role === 'user' ? 'user' : 'assistant',
                content: msg.content
            });
        });
    }

    const currentContent = [{ type: "text", text: prompt }];
    if (mediaParts && Array.isArray(mediaParts)) {
        mediaParts.forEach(item => {
            if (item.inlineData) {
                currentContent.push({
                    type: "image_url",
                    image_url: { url: `data:${item.inlineData.mimeType};base64,${item.inlineData.data}` }
                });
            }
        });
    }

    messages.push({ role: "user", content: currentContent });

    const postData = JSON.stringify({ model: "gpt-4o", messages: messages });
    const options = {
        hostname: 'api.openai.com',
        port: 443,
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json; charset=utf-8'
        }
    };

    const result = await makeHttpsRequest(options, postData);
    if (result.status === 200 && result.data.choices?.[0]?.message?.content) {
        return { result: result.data.choices[0].message.content, source: "ChatGPT (GPT-4o Engine)" };
    }
    if (result.status === 429) return { error: "Quota Exceeded (429)" };
    return { error: result.data?.error?.message || `ChatGPT Error Status ${result.status}` };
};

// ==========================================
// 🚀 6. محرك DeepSeek Chat
// ==========================================
const tryDeepSeek = async (prompt, history = []) => {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) return { error: "Missing Key" };

    const messages = [
        { role: "system", content: "أنت نظام Tafkek OS الذكي والمتخصص في البرمجة والحلول التقنية السريعة." }
    ];

    if (history && Array.isArray(history)) {
        history.forEach(msg => {
            messages.push({
                role: msg.role === 'user' ? 'user' : 'assistant',
                content: msg.content
            });
        });
    }

    messages.push({ role: "user", content: prompt });

    const postData = JSON.stringify({ model: "deepseek-chat", messages: messages });
    const options = {
        hostname: 'api.deepseek.com',
        port: 443,
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json; charset=utf-8'
        }
    };

    const result = await makeHttpsRequest(options, postData);
    if (result.status === 200 && result.data.choices?.[0]?.message?.content) {
        return { result: result.data.choices[0].message.content, source: "DeepSeek Chat Engine" };
    }
    if (result.status === 429) return { error: "Quota Exceeded (429)" };
    return { error: result.data?.error?.message || `DeepSeek Error Status ${result.status}` };
};

// ==========================================
// 🎯 7. المعالج الرئيسي الذكي وموجه المهام (Handler)
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

        let imageMarkdown = "";
        if (isImageRequest) {
            // ترجمة وتطوير الوصف عبر Gemini أولاً
            const expandedPrompt = await translateAndExpandPrompt(userPrompt);
            imageMarkdown = generateFreeImage(expandedPrompt);
        }

        // 🎯 2. التوجيه الذكي للمحركات النصية
        const codeKeywords = ["code", "function", "javascript", "python", "c++", "c#", "bug", "error", "كود", "برمجة", "دالة", "خطأ", "حل مشكلة", "تطبيق"];
        const isCodingTask = codeKeywords.some(kw => userPrompt.toLowerCase().includes(kw));

        let priorityList = [];

        if (isCodingTask) {
            priorityList = [
                { name: "ChatGPT", func: () => tryChatGPT(userPrompt, history, mediaParts) },
                { name: "DeepSeek", func: () => tryDeepSeek(userPrompt, history) },
                { name: "Gemini", func: () => tryGemini(userPrompt, history, mediaParts) }
            ];
        } else {
            priorityList = [
                { name: "Gemini", func: () => tryGemini(userPrompt, history, mediaParts) },
                { name: "ChatGPT", func: () => tryChatGPT(userPrompt, history, mediaParts) },
                { name: "DeepSeek", func: () => tryDeepSeek(userPrompt, history) }
            ];
        }

        // 🔄 3. التنفيذ الذكي مع التعافي (Fallback)
        let finalTextResult = null;
        let errors = [];

        for (const model of priorityList) {
            try {
                const response = await model.func();
                if (response.result) {
                    finalTextResult = response;
                    break;
                } else {
                    errors.push(`${model.name}: ${response.error}`);
                }
            } catch (e) {
                errors.push(`${model.name}: ${e.message}`);
            }
        }

        // 📤 4. تجميع وإرسال النتيجة النهائية
        if (finalTextResult) {
            const combinedOutput = imageMarkdown 
                ? `${imageMarkdown}${finalTextResult.result}` 
                : finalTextResult.result;

            return res.status(200).json({ 
                result: combinedOutput.trim().replace(/\uFFFD/g, ''), 
                source: `Tafkek Router -> ${finalTextResult.source}`
            });
        } else {
            if (imageMarkdown) {
                return res.status(200).json({
                    result: `${imageMarkdown}\n⚠️ تم توليد الصورة بنجاح، لكن تعذر جلب الرد النصي.\n التفاصيل:\n- ${errors.join('\n- ')}`,
                    source: "Tafkek Image Engine Only"
                });
            }

            return res.status(200).json({ 
                result: `⚠️ تعذر الحصول على رد من جميع المحركات.\n التفاصيل:\n- ${errors.join('\n- ')}`
            });
        }

    } catch (e) {
        console.error("Handler Error:", e);
        return res.status(500).json({ error: e.message });
    }
}
