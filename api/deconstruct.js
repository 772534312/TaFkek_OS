import https from 'https';

export default async function handler(req, res) {
    // إعدادات الـ CORS لتسمح بطلبات الواجهة الأمامية
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        // 1. استقبال النص والميديا والموديل من الـ Body
        const { prompt, mediaParts, model } = req.body;
        const apiKey = process.env.GEMINI_API_KEY;

        // تحديد النموذج المناسب لرؤية الصور والبحث
        let targetModel = model || "gemini-1.5-flash";

        // 2. تجهيز مصفوفة الـ parts (دمج النص والصور)
        const parts = [];

        // إضافة النص إذا توفر، أو نص افتراضي للتحليل
        if (prompt && prompt.trim() !== '') {
            parts.push({ text: prompt });
        } else {
            parts.push({ text: "قم بتحليل هذه الصورة وتفسير محتوياتها بالتفصيل." });
        }

        // إضافة الصور المرفقة (تأتي في صيغة { inlineData: { mimeType, data } })
        if (mediaParts && Array.isArray(mediaParts)) {
            mediaParts.forEach(item => {
                if (item.inlineData) {
                    parts.push({
                        inline_data: {
                            mime_type: item.inlineData.mimeType,
                            data: item.inlineData.data
                        }
                    });
                }
            });
        }

        // 3. بناء جسم الطلب (Payload) لدعم رؤية الصور والبحث الفوري
        const postData = JSON.stringify({
            contents: [{ parts: parts }],
            tools: [{ googleSearch: {} }],
            systemInstruction: {
                parts: [{ text: "أنت محرك التفكيك والتحليل الفوري لـ Tafkek OS. قم بتحليل النصوص والصور المرفقة بدقة فائقة واستخدم البحث في الإنترنت إذا تطلب الأمر لتأكيد صحة المعلومات." }]
            }
        });

        // 4. خيارات طلب الـ HTTPS المباشر لـ Gemini REST API
        const options = {
            hostname: 'generativelanguage.googleapis.com',
            port: 443,
            path: `/v1beta/models/${targetModel}:generateContent?key=${apiKey}`,
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json', 
                'Content-Length': Buffer.byteLength(postData) 
            }
        };

        const reqPromise = () => {
            return new Promise((resolve, reject) => {
                const request = https.request(options, response => {
                    let body = '';
                    response.on('data', chunk => body += chunk);
                    response.on('end', () => {
                        try {
                            resolve({ status: response.statusCode, data: JSON.parse(body) });
                        } catch (err) {
                            reject(new Error("فشل في تحليل استجابة السيرفر"));
                        }
                    });
                });
                request.on('error', reject);
                request.write(postData);
                request.end();
            });
        };

        const result = await reqPromise();

        if (result.status !== 200) {
            throw new Error(result.data.error?.message || `خطأ من جوجل API (كود ${result.status})`);
        }

        // 5. استخراج نص الرد الناتج عن تحليل الصور والبحث
        const output = result.data.candidates?.[0]?.content?.parts?.[0]?.text || "لم يتم العثور على نتائج للتحليل.";

        return res.status(200).json({ 
            result: output, 
            source: `Tafkek Vision & Grounding Engine (${targetModel.toUpperCase()})` 
        });

    } catch (e) {
        console.error("Deconstruct API Error:", e);
        return res.status(500).json({ error: e.message });
    }
}
