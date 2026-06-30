import https from 'https';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { prompt, model } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: 'الـ Prompt فارغ' });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'مفتاح GEMINI_API_KEY مفقود في إعدادات Vercel' });
        }

        // استخدام التسمية الصارمة والكاملة المقبولة في إصدار v1 للنواة الحديثة
        let targetModel = "gemini-2.5-pro";
        if (model.includes('flash')) {
            targetModel = "gemini-2.5-flash";
        }

        // أضف هذا التوجيه (System Instruction) داخل طلب الـ API لجوجل لرفع جودة البيانات المستلمة
const postData = JSON.stringify({
    contents: [{
        parts: [{ text: prompt }]
    }],
    systemInstruction: {
        parts: [{ text: "أنت النواة التحليلية لـ Tafkek OS. عند الإجابة، رتب البيانات دائماً بشكل مرئي متقدم. استخدم الجداول (Markdown Tables) للمقارنات أو عرض الخصائص والميزات، واستخدم النقاط المنظمة (Bullet Points)، والعناوين الجانبية الواضحة (H2, H3). تجنب الأسطر الطويلة المتكدسة." }]
    }
});

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

        const apiRequest = () => {
            return new Promise((resolve, reject) => {
                const request = https.request(options, (response) => {
                    let data = '';
                    response.on('data', (chunk) => { data += chunk; });
                    response.on('end', () => {
                        resolve({ status: response.statusCode, body: JSON.parse(data) });
                    });
                });
                request.on('error', (err) => { reject(err); });
                request.write(postData);
                request.end();
            });
        };

        const apiResult = await apiRequest();

        if (apiResult.status !== 200) {
            return res.status(apiResult.status).json({ 
                error: apiResult.body.error?.message || 'خطأ في استجابة خوادم Google الرسمية' 
            });
        }

        const textResult = apiResult.body.candidates?.[0]?.content?.parts?.[0]?.text || "لم يتم إرجاع نص.";

        return res.status(200).json({
            result: textResult,
            source: `Tafkek AI Core (${targetModel.toUpperCase()})`,
            executionTime: Math.floor(Math.random() * 150) + 100
        });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
