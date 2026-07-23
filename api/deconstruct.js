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
        if (postData) request.write(postData, 'utf-8');
        request.end();
    });
};

// ==========================================
// 🎨 2. مترجم وتطوير طلبات الصور الذكي
// ==========================================
const translateAndExpandPrompt = async (arabicPrompt, isEditing = false) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return arabicPrompt;

    const instructions = isEditing 
        ? `You are an AI image editing assistant. The user wants to MODIFY an existing image. Translate their Arabic modification request into a clear English instruction focusing ONLY on the specific changes requested. Keep it concise. Request: "${arabicPrompt}"`
        : `You are an expert AI image prompt engineer. Translate the user's image request into a highly detailed, photo-realistic, cinematic English prompt for FLUX. Output ONLY the detailed English prompt text. Request: "${arabicPrompt}"`;

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
    
    return arabicPrompt.replace(/(ارسم|انشئ|أنشئ|صمم|توليد|صورة|صوره|صور|شعار|لي|عدل|غير|اضف|احذف|draw|image|generate|edit|modify)/gi, '').trim();
};

// ==========================================
// 🖼️ 3. محرك الصور الذكي (يقبل Text-to-Image و Image-to-Image)
// ==========================================
const generateSmartImage = (expandedPrompt, base64Image = null) => {
    const safePrompt = encodeURIComponent(expandedPrompt);
    const seed = 42; // تثبيت البذرة للحفاظ على التناسق البصري

    // أ. إذا وجد صورة مرفوعة -> نستخدم تقنية Image-to-Image / Reference
    if (base64Image) {
        // نمرر الصورة كمرجع بصري مع تحديد قوة التعديل (strength)
        const imageRef = encodeURIComponent(`data:image/jpeg;base64,${base64Image}`);
        const imageUrl = `https://image.pollinations.ai/prompt/${safePrompt}?width=1024&height=1024&model=flux&seed=${seed}&image=${imageRef}&nologo=true`;
        return `![Edited Image](${imageUrl})\n\n*(تم التعديل بناءً على الصورة المرفوعة)*\n\n`;
    }

    // ب. توليد صورة جديدة من الصفر
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
            parts: [{ text: "أنت نظام Tafkek OS الذكي المتكامل. إذا طلب المستخدم صورة أو تعديل صورة، اعلم أن محرك الصور المدمج يتكفل بذلك تلقائياً." }]
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
        { role: "system", content: "أنت نظام Tafkek OS الذكي ومتخصص في حل الأكواد والتحليل المنطقي." }
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
// 🎯 7. المعالج الرئيسي الذكي (Handler)
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

        // 🔍 1. البحث عن صورة مرفوعة في الطلب الحالي (Base64)
        let inputBase64Image = null;
        if (mediaParts && Array.isArray(mediaParts) && mediaParts.length > 0) {
            const imgPart = mediaParts.find(p => p.inlineData && p.inlineData.mimeType.startsWith('image/'));
            if (imgPart) {
                inputBase64Image = imgPart.inlineData.data;
            }
        }

        // 🔍 2. اكتشاف كلمات التعديل وتوليد الصور
        const imageKeywords = ["صورة", "صوره", "صور", "ارسم", "أنشئ", "انشئ", "صمم", "توليد", "شعار", "عدل", "غير", "اضف", "احذف", "draw", "image", "generate", "picture", "logo", "edit", "modify"];
        const isImageRequest = userPrompt && imageKeywords.some(kw => userPrompt.toLowerCase().includes(kw));

        let imageMarkdown = "";
        if (isImageRequest || inputBase64Image) {
            const isEditing = !!inputBase64Image;
            const expandedPrompt = await translateAndExpandPrompt(userPrompt, isEditing);
            imageMarkdown = generateSmartImage(expandedPrompt, inputBase64Image);
        }

        // 🎯 3. التوجيه الذكي للمحركات النصية
        const codeKeywords = ["code", "function", "javascript", "python", "c++", "c#", "bug", "error", "كود", "برمجة", "دالة", "خطأ", "حل مشكلة", "تطبيق"];
        const isCodingTask = codeKeywords.some(kw => userPrompt.toLowerCase().includes(kw));

        let priorityList = isCodingTask ? [
            { name: "ChatGPT", func: () => tryChatGPT(userPrompt, history, mediaParts) },
            { name: "DeepSeek", func: () => tryDeepSeek(userPrompt, history) },
            { name: "Gemini", func: () => tryGemini(userPrompt, history, mediaParts) }
        ] : [
            { name: "Gemini", func: () => tryGemini(userPrompt, history, mediaParts) },
            { name: "ChatGPT", func: () => tryChatGPT(userPrompt, history, mediaParts) },
            { name: "DeepSeek", func: () => tryDeepSeek(userPrompt, history) }
        ];

        // 🔄 4. التنفيذ والتعافي
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

        if (finalTextResult) {
            const combinedOutput = imageMarkdown 
                ? `${imageMarkdown}${finalTextResult.result}` 
                : finalTextResult.result;

            return res.status(200).json({ 
                result: combinedOutput.trim().replace(/\uFFFD/g, ''), 
                source: `Tafkek Router -> ${finalTextResult.source}`
            });
        } else {
            return res.status(200).json({ 
                result: imageMarkdown 
                    ? `${imageMarkdown}\n⚠️ تم التعديل/التوليد بنجاح، لكن تعذر جلب الرد النصي.` 
                    : `⚠️ تعذر الحصول على رد من جميع المحركات.`
            });
        }

    } catch (e) {
        console.error("Handler Error:", e);
        return res.status(500).json({ error: e.message });
    }
}
