import https from 'https';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const { prompt, mediaParts, model } = req.body;
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            return res.status(500).json({ result: "⚠️ مفتاح GEMINI_API_KEY غير معرف في البيئة." });
        }

        // استخدام gemini-2.5-flash أو gemini-1.5-flash-latest لمنع خطأ الموديل غير الموجود
        let targetModel = model || "gemini-2.5-flash";

        // تجهيز الأجزاء (Parts)
        const parts = [];

        // إضافة النص
        if (prompt && prompt.trim() !== '') {
            parts.push({ text: prompt });
        } else {
            parts.push({ text: "قم بتحليل هذه الصورة وتفسير محتوياتها بالتفصيل." });
        }

       // الميمات المسموحة والمدمجة مباشرة في Gemini API
        const supportedMimeTypes = [
            'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
            'application/pdf', 'text/plain', 'text/csv', 'text/html'
        ];

        // إضافة الصور والملفات المرفقة
        if (mediaParts && Array.isArray(mediaParts)) {
            for (const item of mediaParts) {
                if (item.inlineData && item.inlineData.data) {
                    const mime = item.inlineData.mimeType || "image/jpeg";

                    // التحقق من توافق صيغة الملف
                    if (!supportedMimeTypes.includes(mime)) {
                        return res.status(200).json({ 
                            result: `⚠️ الصيغة المرفقة (${mime}) غير مدعومة مباشرة.\n\n💡 **نصيحة:** يرجى تحويل ملف PowerPoint إلى **PDF** أو تحويل الشرائح إلى **صور (PNG/JPG)** ثم إعادة رفعها لتفكيكها وتحليلها.` 
                        });
                    }

                    parts.push({
                        inline_data: {
                            mime_type: mime,
                            data: item.inlineData.data
                        }
                    });
                }
            }
        }

        const postData = JSON.stringify({
            contents: [{ parts: parts }],
            systemInstruction: {
                parts: [{ text: "أنت محرك التفكيك والتحليل الفوري لـ Tafkek OS. قم بتحليل النصوص والصور المرفقة بدقة فائقة وشرحها باللغة العربية." }]
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

        const reqPromise = () => {
            return new Promise((resolve, reject) => {
                const request = https.request(options, response => {
                    let body = '';
                    response.on('data', chunk => body += chunk);
                    response.on('end', () => {
                        try {
                            resolve({ status: response.statusCode, data: JSON.parse(body) });
                        } catch (err) {
                            reject(new Error("فشل في استخراج البيانات من السيرفر"));
                        }
                    });
                });
                request.on('error', reject);
                request.write(postData);
                request.end();
            });
        };

        const result = await reqPromise();

        // في حالة وجود خطأ من جوجل API
        if (result.status !== 200 || result.data.error) {
            const errDetails = result.data.error?.message || `كود الاستجابة ${result.status}`;
            return res.status(200).json({ result: `⚠️ خطأ من سيرفر جوجل: ${errDetails}` });
        }

        // استخراج النص بمرونة من كافة الأجزاء المرجعة
        const candidateParts = result.data.candidates?.[0]?.content?.parts || [];
        let outputText = "";

        candidateParts.forEach(p => {
            if (p.text) outputText += p.text + "\n";
        });

        if (!outputText.trim()) {
            outputText = "لم يتم الحصول على تحليل نصي من النموذج، يرجى إعادة المحاولة بصورة أوضح.";
        }

        return res.status(200).json({ 
            result: outputText.trim(), 
            source: `Tafkek Vision Engine (${targetModel.toUpperCase()})` 
        });

    } catch (e) {
        console.error("Deconstruct API Error:", e);
        return res.status(200).json({ result: `⚠️ حدث خطأ في النظام: ${e.message}` });
    }
}
