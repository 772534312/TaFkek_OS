import https from 'https';

export default async function handler(req, res) {
    // 1. فرض ترميز UTF-8 وإعدادات الـ CORS
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const { prompt, mediaParts, model } = req.body;
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            return res.status(500).json({ result: "⚠️ مفتاح GEMINI_API_KEY غير معرف في بيئة العمل (Environment Variables)." });
        }

        // استخدام النموذج المستقر الأحدث للتفكيك ورؤية الصور
        let targetModel = model || "gemini-2.5-flash";

        // قائمة الصيغ المدعومة مباشرة في Gemini API
        const supportedMimeTypes = [
            'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
            'application/pdf', 'text/plain', 'text/csv', 'text/html'
        ];

        // 2. تجهيز مصفوفة الـ Parts
        const parts = [];

        // إضافة النص (سؤال المستخدم أو أمر افتراضي)
        if (prompt && prompt.trim() !== '') {
            parts.push({ text: prompt });
        } else {
            parts.push({ text: "قم بتحليل هذه الصورة وتفكيك محتوياتها وشرحها بالتفصيل." });
        }

        // إضافة الصور والملفات المرفقة مع التحقق من الصيغة
        if (mediaParts && Array.isArray(mediaParts)) {
            for (const item of mediaParts) {
                if (item.inlineData && item.inlineData.data) {
                    const mime = item.inlineData.mimeType || "image/jpeg";

                    // التحقق من توافق نوع الملف (مثل منع ملفات PowerPoint المباشرة)
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

        // 3. بناء الـ Payload وتفعيل محرك البحث والتعليمات
        const postData = JSON.stringify({
            contents: [{ parts: parts }],
            tools: [{ googleSearch: {} }], // تفعيل البحث الفوري في الإنترنت
            systemInstruction: {
                parts: [{ 
                    text: "أنت محرك التفكيك والتحليل الفوري لـ Tafkek OS. ابحث في الإنترنت عند الحاجة ووفر إجابات دقيقة ومحدثة بلغة عربية واضحة وبدون استخدام أشكال هندسية أو رموز غريبة." 
                }]
            }
        });

        // 4. خيارات طلب الـ HTTPS
        const options = {
            hostname: 'generativelanguage.googleapis.com',
            port: 443,
            path: `/v1beta/models/${targetModel}:generateContent?key=${apiKey}`,
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json; charset=utf-8', 
                'Content-Length': Buffer.byteLength(postData, 'utf-8') 
            }
        };

        const reqPromise = () => {
            return new Promise((resolve, reject) => {
                const request = https.request(options, response => {
                    response.setEncoding('utf-8'); // ضمان قراءة الاستجابة بـ UTF-8
                    let body = '';
                    response.on('data', chunk => body += chunk);
                    response.on('end', () => {
                        try {
                            resolve({ status: response.statusCode, data: JSON.parse(body) });
                        } catch (err) {
                            reject(new Error("فشل في معالجة استجابة السيرفر"));
                        }
                    });
                });
                request.on('error', reject);
                request.write(postData, 'utf-8');
                request.end();
            });
        };

        const result = await reqPromise();

        // 5. الاستجابة في حالة وجود خطأ من سيرفر جوجل
        if (result.status !== 200 || result.data.error) {
            const errDetails = result.data.error?.message || `كود الاستجابة ${result.status}`;
            return res.status(200).json({ result: `⚠️ خطأ من سيرفر جوجل: ${errDetails}` });
        }

        // 6. استخراج كافة النصوص الناتجة وتنظيف الرموز التالفة
        const candidateParts = result.data.candidates?.[0]?.content?.parts || [];
        let outputText = "";

        candidateParts.forEach(p => {
            if (p.text) outputText += p.text + "\n";
        });

        // تنظيف أي رمز تالف متبقي
        outputText = outputText.replace(/\uFFFD/g, '');

        if (!outputText.trim()) {
            outputText = "لم يتم الحصول على تحليل نصي من النموذج، يرجى إعادة المحاولة بصورة أو ملف أوضح.";
        }

        return res.status(200).json({ 
            result: outputText.trim(), 
            source: `Tafkek Grounding & Vision Engine (${targetModel.toUpperCase()})` 
        });

    } catch (e) {
        console.error("Deconstruct API Error:", e);
        return res.status(200).json({ result: `⚠️ حدث خطأ في النظام: ${e.message}` });
    }
}
