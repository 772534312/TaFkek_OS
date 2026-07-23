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
// 🎨 2. خوارزمية DALL-E 3 الخرافية لتوليد صور واقعية 100%
// ==========================================
const generateDallE3Image = async (userPrompt) => {
    const apiKey = process.env.OPENAI_API_KEY;
    
    // إذا لم يتوفر المفتاح، يتم الانتقال تلقائياً لمحرك احتياطي عالي الجودة
    if (!apiKey) {
        const safePrompt = encodeURIComponent(userPrompt);
        return `![Generated Image](https://image.pollinations.ai/prompt/${safePrompt}?width=1024&height=1024&model=flux-realism&nologo=true)\n\n`;
    }

    const postData = JSON.stringify({
        model: "dall-e-3",
        prompt: `Create a highly realistic, photorealistic image based on this description: ${userPrompt}. Focus on realistic textures, lighting, zero artifacts, accurate anatomy, and precise physical reflections.`,
        n: 1,
        size: "1024x1024",
        quality: "hd" // إعداد الجودة العالية HD
    });

    const options = {
        hostname: 'api.openai.com',
        port: 443,
        path: '/v1/images/generations',
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        }
    };

    try {
        const result = await makeHttpsRequest(options, postData);
        if (result.status === 200 && result.data.data?.[0]?.url) {
            const imageUrl = result.data.data[0].url;
            return `![Tafkek Ultra Realistic Image](${imageUrl})\n\n`;
        } else {
            console.error("DALL-E 3 Error:", result.data);
        }
    } catch (e) {
        console.error("DALL-E 3 Engine Exception:", e);
    }

    // Fallback في حال وجود مشكلة في الرصيد أو السيرفر
    const safePrompt = encodeURIComponent(userPrompt);
    return `![Generated Image](https://image.pollinations.ai/prompt/${safePrompt}?width=1024&height=1024&model=flux&nologo=true)\n\n`;
};

// ==========================================
// 🧠 3. محرك Gemini 2.5 Flash النصي
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
            parts: [{ text: "أنت نظام Tafkek OS الذكي المتكامل. إذا طلب المستخدم صورة، اعلم أن محرك DALL-E 3 سيولدها تلقائياً، فلا تقل أنك لا تستطيع إنشاء الصور." }]
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
// 💻 4. محرك OpenAI ChatGPT (GPT-4o)
// ==========================================
const tryChatGPT = async (prompt, history = [], mediaParts = []) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return { error: "Missing Key" };

    const messages = [
        { role: "system", content: "أنت نظام Tafkek OS الذكي والمتخصص في حل الأكواد والتحليل المنطقي." }
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
// 🚀 5. محرك DeepSeek Chat
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
// 🎯 6. المعالج الرئيسي الذكي (Handler)
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

        const imageKeywords = ["صورة", "صوره", "صور", "ارسم", "أنشئ", "انشئ", "صمم", "توليد", "شعار", "draw", "image", "generate", "picture", "logo"];
        const isImageRequest = userPrompt && imageKeywords.some(kw => userPrompt.toLowerCase().includes(kw));

        let imageMarkdown = "";
        if (isImageRequest) {
            // استخدام DALL-E 3 المباشر للواقعية القصوى
            imageMarkdown = await generateDallE3Image(userPrompt);
        }

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
                    ? `${imageMarkdown}\n⚠️ تم توليد الصورة، لكن تعذر جلب الرد النصي.` 
                    : `⚠️ تعذر الحصول على رد من جميع المحركات.`
            });
        }

    } catch (e) {
        console.error("Handler Error:", e);
        return res.status(500).json({ error: e.message });
    }
}
