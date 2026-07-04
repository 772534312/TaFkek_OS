import https from 'https';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const { prompt, model } = req.body;
        const apiKey = process.env.GEMINI_API_KEY;
        // نضمن استخدام أحدث إصدار مستقر يدعم التوثيق الذكي
        let targetModel = model || "gemini-2.5-flash";

        const postData = JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            // تفعيل ميزة البحث الفوري الحي لربط النظام بالإنترنت
            tools: [{ googleSearch: {} }],
            systemInstruction: {
                parts: [{ text: "أنت محرك التوثيق الفوري لـ Tafkek OS. ابحث في الإنترنت ووفر إجابات دقيقة ومحدثة مع تضمين روابط المصادر الحية في نهاية إجابتك لتأكيد صحة المعلومات." }]
            }
        });

        const options = {
            hostname: 'generativelanguage.googleapis.com',
            port: 443,
            path: `/v1beta/models/${targetModel}:generateContent?key=${apiKey}`,
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) }
        };

        const reqPromise = () => {
            return new Promise((resolve, reject) => {
                const request = https.request(options, response => {
                    let body = '';
                    response.on('data', chunk => body += chunk);
                    response.on('end', () => resolve({ status: response.statusCode, data: JSON.parse(body) }));
                });
                request.on('error', reject);
                request.write(postData);
                request.end();
            });
        };

        const result = await reqPromise();
        
        // استخراج النص مع روابط التوثيق المرجعية (Grounding Metadata) إن وجدت
        const output = result.data.candidates?.[0]?.content?.parts?.[0]?.text || "لم يتم العثور على نتائج حية.";

        return res.status(200).json({ 
            result: output, 
            source: `Tafkek Grounding Engine (${targetModel.toUpperCase()})` 
        });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
}
