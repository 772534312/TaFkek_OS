import https from 'https';

// 🎨 دالة توليد الصور المجانية السريعة (Pollinations - Flux Engine)
const generateFreeImage = (prompt) => {
    const cleanPrompt = encodeURIComponent(prompt.trim());
    const seed = Math.floor(Math.random() * 1000000);
    const imageUrl = `https://pollinations.ai/p/${cleanPrompt}?width=1024&height=1024&model=flux&seed=${seed}&nologo=true`;
    
    return `\n\n![Generated Image](${imageUrl})\n\n`;
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
// محرك Gemini 2.5 Flash مع الذاكرة
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
        systemInstruction: {
            parts: [{ text: "أنت نظام Tafkek OS الذكي. لديك ذاكرة للمحادثة الحالية من خلال السجل المرفق معك، أجب بدقة وفصاحة واستخدم تنسيق Markdown." }]
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
    return { error: result.data?.error?.message || "Gemini Error" };
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

        // 🔍 1. الفحص الذكي للصور (تحسين الكشف)
        const imageKeywords = ["صورة", "صوره", "صور", "ارسم", "أنشئ", "انشئ", "صمم", "توليد", "شعار", "draw", "image", "generate", "picture"];
        const isImageRequest = userPrompt && imageKeywords.some(kw => userPrompt.toLowerCase().includes(kw));

        let imageMarkdown = "";
        if (isImageRequest) {
            imageMarkdown = generateFreeImage(userPrompt);
        }

        // 🧠 2. جلب الرد النصي مع الذاكرة
        const textResponse = await tryGemini(userPrompt, history, mediaParts);

        if (textResponse.result) {
            // دمج الصورة مع النص إن وجدت
            const finalCombinedOutput = imageMarkdown ? `${imageMarkdown}\n${textResponse.result}` : textResponse.result;
            
            return res.status(200).json({ 
                result: finalCombinedOutput.trim(), 
                source: `Tafkek Smart Engine -> ${textResponse.source}`
            });
        } else {
            return res.status(200).json({ 
                result: imageMarkdown ? `${imageMarkdown}\n⚠️ تعذر جلب الرد النصي.` : `⚠️ حدث خطأ: ${textResponse.error}`
            });
        }

    } catch (e) {
        console.error("Handler Error:", e);
        return res.status(500).json({ error: e.message });
    }
}
