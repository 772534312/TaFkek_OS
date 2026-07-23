import https from 'https';

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
// 1. محرك Gemini (يدعم البحث والملفات والذاكرة)
// ==========================================
const tryGemini = async (prompt, history = [], mediaParts = []) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return { error: "Missing Key" };

    const contents = [];

    // إضافة الذاكرة السابقة (History)
    if (history && Array.isArray(history)) {
        history.forEach(msg => {
            contents.push({
                role: msg.role === 'user' ? 'user' : 'model',
                parts: [{ text: msg.content }]
            });
        });
    }

    // إضافة الرسالة الحالية
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
        return { result: output, source: "Gemini 2.5 Flash (Grounding Supported)" };
    }
    return { error: result.data?.error?.message || "Gemini Error", status: result.status };
};

// ==========================================
// 2. محرك ChatGPT (GPT-4o للبرمجة والمنطق)
// ==========================================
const tryChatGPT = async (prompt, history = [], mediaParts = []) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return { error: "Missing Key" };

    const messages = [
        { role: "system", content: "أنت محرك Tafkek OS المطور برمجياً. قدم حلولاً برمجية دقيقة مع تنسيق الأكواد والشرح الواضح." }
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
    return { error: result.data?.error?.message || "OpenAI Error", status: result.status };
};

// ==========================================
// 3. المعالج الأساسي وموجه المهام (Smart Router)
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

        // 🎯 التوجيه الذكي (Smart Routing Logic)
        const codeKeywords = ["code", "function", "javascript", "python", "c++", "bug", "error", "كود", "برمجة", "دالة", "خطأ"];
        const isCodingTask = codeKeywords.some(kw => userPrompt.toLowerCase().includes(kw));

        let priorityList = [];

        if (isCodingTask && process.env.OPENAI_API_KEY) {
            // للطلبات البرمجية: إعطاء الأولوية لـ ChatGPT ثم Gemini
            priorityList = [
                { name: "ChatGPT", func: () => tryChatGPT(userPrompt, history, mediaParts) },
                { name: "Gemini", func: () => tryGemini(userPrompt, history, mediaParts) }
            ];
        } else {
            // للطلبات العامة والبحث الحفاظ على Gemini كأولوية
            priorityList = [
                { name: "Gemini", func: () => tryGemini(userPrompt, history, mediaParts) },
                { name: "ChatGPT", func: () => tryChatGPT(userPrompt, history, mediaParts) }
            ];
        }

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
                source: `Tafkek Smart Router -> ${finalResponse.source}`
            });
        } else {
            return res.status(200).json({ 
                result: `⚠️ تعذر الحصول على رد من المحركات الحالية.\n التفاصيل:\n- ${errors.join('\n- ')}`
            });
        }

    } catch (e) {
        console.error("Routing Error:", e);
        return res.status(500).json({ error: e.message });
    }
}
