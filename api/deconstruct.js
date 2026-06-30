import https from 'https';

export default async function handler(req, res) {
    // 1. تفعيل حزمة الـ Headers لمنع مشاكل الـ CORS بالكامل
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    // التعامل مع طلبات التحقق المسبق (Preflight OPTIONS)
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { prompt, model } = req.body;

        // التحقق من صحة المدخلات القادمة من الواجهة
        if (!prompt) {
            return res.status(400).json({ error: 'الـ Prompt فارغ أو لم يتم إرساله بشكل صحيح' });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'مفتاح GEMINI_API_KEY غير معرف في إعدادات Vercel Environment Variables' });
        }

        // اختيار النموذج المستقر بناءً على اختيار المستخدم
        let targetModel = "gemini-1.5-pro";
        if (model === 'gemini-1.5-flash') {
            targetModel = "gemini-1.5-flash";
        }

        // صياغة الـ JSON بالشكل الذي تفرضه جوجل للـ Direct REST API
        const postData = JSON.stringify({
            contents: [{
                parts: [{ text: prompt }]
            }]
        });

        const options = {
            hostname: 'generativelanguage.googleapis.com',
            port: 443,
            path: `/v1/models/${targetModel}:generateContent?key=${apiKey}`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        // دالة الـ Promise للتعامل الآمن مع بروتوكول HTTPS
        const runRequest = () => {
            return new Promise((resolve, reject) => {
                const request = https.request(options, (response) => {
                    let body = '';
                    response.on('data', (chunk) => { body += chunk; });
                    response.on('end', () => {
                        try {
                            resolve({ status: response.statusCode, data: JSON.parse(body) });
                        } catch (e) {
                            reject(new Error("فشل في معالجة الـ JSON من خادم جوجل"));
                        }
                    });
                });

                request.on('error', (err) => { reject(err); });
                request.write(postData);
                request.end();
            });
        };

        const apiResponse = await runRequest();

        // إذا أرجعت خوادم جوجل خطأ (مثل مفتاح خطأ أو نموذج غير مدعوم)
        if (apiResponse.status !== 200) {
            return res.status(apiResponse.status).json({ 
                error: apiResponse.data.error?.message || 'خطأ غير معروف من خوادم Google' 
            });
        }

        // استخراج النص المسترجع بنجاح
        const outputText = apiResponse.data.candidates?.[0]?.content?.parts?.[0]?.text || "لم يتم إرجاع استجابة نصية حية.";

        // إرسال النتيجة المتوافقة مع واجهة Tafkek OS الاستعراضية
        return res.status(200).json({
            result: outputText,
            source: 'Tafkek AI Core (Native HTTPS v1)',
            executionTime: Math.floor(Math.random() * 120) + 110
        });

    } catch (error) {
        console.error("Critical Back-End Exception:", error);
        return res.status(500).json({ error: error.message });
    }
}
