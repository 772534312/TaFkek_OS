import https from 'https';

// 🎨 1. دالة توليد الصور المجانية السريعة (Pollinations - Flux Engine)
const generateFreeImage = (prompt) => {
    const cleanPrompt = encodeURIComponent(prompt.trim());
    const seed = Math.floor(Math.random() * 1000000);
    const imageUrl = `https://pollinations.ai/p/${cleanPrompt}?width=1024&height=1024&model=flux&seed=${seed}&nologo=true`;
    
    const imgHtml = `إليك التصميم الذي طلبته:\n\n<img src="${imageUrl}" alt="Generated Design" style="max-width:100%; border-radius:12px; margin-top:10px; box-shadow: 0 4px 15px rgba(0,0,0,0.2);" />`;
    
    return {
        result: imgHtml,
        source: "Tafkek Free Vision Engine (FLUX / Pollinations)"
    };
};

// --- دوال المساعدة لطلبات HTTPS ---
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
                    reject(new Error("فشل في معالجة الاستجابة"));
                }
            });
        });
        request.on('error', reject);
        request.write(postData, 'utf-8');
        request.end();
    });
};

// ==========================================
// 1. محرك Gemini 2.5 Flash
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
            parts: [{ text: "أنت نظام Tafkek OS الذكي المتكامل. أجب بدقة وفصاحة، واستخدم التنسيق الأنيق المعتمد على Markdown والأكواد المنظمة." }]
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
    if (result.status === 429) return { error: "Quota Exceeded" };
    return { error: result.data?.error?.message || "Gemini Error" };
};

// ==========================================
// 2. محرك OpenAI ChatGPT (GPT-4o)
// ==========================================
const tryChatGPT = async (prompt, history = [], mediaParts = []) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return { error: "Missing Key" };

    const messages = [
        { role: "system", content: "أنت نظام Tafkek OS الذكي المتكامل. أجب بدقة باستخدام Markdown والتنسيق الأنيق." }
    ];

    if (history && Array.isArray(history)) {
        history.forEach(msg => {
            messages.push({ role: msg.role === 'user' ? 'user' : 'assistant', content: msg.content });
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
        return { result: result.data.choices[0].message.content, source: "ChatGPT (GPT-4o)" };
    }
    if (result.status === 429) return { error: "Quota Exceeded" };
    return { error: result.data?.error?.message || "OpenAI Error" };
};

// ==========================================
// 3. محرك DeepSeek Chat
// ==========================================
const tryDeepSeek = async (prompt, history = []) => {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) return { error: "Missing Key" };

    const messages = [
        { role: "system", content: "أنت نظام Tafkek OS الذكي والمتخصص في البرمجة والتحليل." }
    ];

    if (history && Array.isArray(history)) {
        history.forEach(msg => {
            messages.push({ role: msg.role === 'user' ? 'user' : 'assistant', content: msg.content });
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
        return { result: result.data.choices[0].message.content, source: "DeepSeek Chat" };
    }
    if (result.status === 429) return { error: "Quota Exceeded" };
    return { error: result.data?.error?.message || "DeepSeek Error" };
};

// ==========================================
// المعالج الرئيسي الذكي (Smart Handler)
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

        // 🔍 1. الفحص الذكي للصور
        const imageKeywords = ["ارسم", "أنشئ صورة", "انشئ صورة", "صمم صورة", "توليد صورة", "generate image", "draw", "create image", "logo design", "شعار"];
        const isImageRequest = userPrompt && imageKeywords.some(kw => userPrompt.toLowerCase().includes(kw));

        if (isImageRequest) {
            const imageResponse = generateFreeImage(userPrompt);
            return res.status(200).json(imageResponse);
        }

        // 🧠 2. قائمة المحركات حسب الأولوية والتنقل الذكي (Fallback Engine)
        const priorityList = [
            { name: "Gemini", func: () => tryGemini(userPrompt, history, mediaParts) },
            { name: "ChatGPT", func: () => tryChatGPT(userPrompt, history, mediaParts) },
            { name: "DeepSeek", func: () => tryDeepSeek(userPrompt, history) }
        ];

        let finalResponse = null;
        let errors = [];

        for (const model of priorityList) {
            try {
                const response = await model.func();
                if (response.result) {
                    finalResponse = response;
                    break;
                } else {
                    errors.push(`${model.name}: ${response.error}`);
                }
            } catch (e) {
                errors.push(`${model.name}: ${e.message}`);
            }
        }

        if (finalResponse) {
            return res.status(200).json({ 
                result: finalResponse.result.trim().replace(/\uFFFD/g, ''), 
                source: `Tafkek Smart Engine -> ${finalResponse.source}`
            });
        } else {
            return res.status(200).json({ 
                result: `⚠️ تعذر الحصول على رد من المحركات الحالية.\n التفاصيل:\n- ${errors.join('\n- ')}`
            });
        }

    } catch (e) {
        console.error("Handler Error:", e);
        return res.status(500).json({ error: e.message });
    }
}
