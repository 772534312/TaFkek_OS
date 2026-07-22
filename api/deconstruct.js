import https from 'https';

export default async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
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

        // 🔍 الفحص الذكي: هل يطلب المستخدم توليد صورة؟
        const imageKeywords = ["ارسم", "أنشئ صورة", "انشئ صورة", "صمم صورة", "توليد صورة", "generate image", "draw", "create image"];
        const isImageGenerationRequest = prompt && imageKeywords.some(kw => prompt.toLowerCase().includes(kw));

        // 🎨 المسار الأول: طلب توليد صورة باستخدام Imagen 3
        if (isImageGenerationRequest) {
            const imagenPostData = JSON.stringify({
                instances: [{ prompt: prompt }],
                parameters: { sampleCount: 1, aspectRatio: "1:1" }
            });

            const imagenOptions = {
                hostname: 'generativelanguage.googleapis.com',
                port: 443,
                path: `/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json; charset=utf-8',
                    'Content-Length': Buffer.byteLength(imagenPostData, 'utf-8')
                }
            };

            const generateImagePromise = () => {
                return new Promise((resolve, reject) => {
                    const request = https.request(imagenOptions, response => {
                        let body = '';
                        response.on('data', chunk => body += chunk);
                        response.on('end', () => resolve({ status: response.statusCode, data: JSON.parse(body) }));
                    });
                    request.on('error', reject);
                    request.write(imagenPostData, 'utf-8');
                    request.end();
                });
            };

            const imgResult = await generateImagePromise();

            if (imgResult.status === 200 && imgResult.data.predictions?.[0]?.bytesBase64Encoded) {
                const base64Image = imgResult.data.predictions[0].bytesBase64Encoded;
                const mimeType = imgResult.data.predictions[0].mimeType || "image/png";
                
                // إعادة الصورة بتنسيق HTML جاهز للعرض مباشرة في الواجهة
                const imgHtml = `Here is your generated design:\n\n<img src="data:${mimeType};base64,${base64Image}" alt="Generated Design" style="max-width:100%; border-radius:12px; margin-top:10px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);" />`;
                
                return res.status(200).json({ 
                    result: imgHtml, 
                    source: "Tafkek Image Generator Engine (Imagen 3)" 
                });
            }
        }

        // 🧠 المسار الثاني: المعالجة العادية (تحليل صور / نصوص / بحث في الإنترنت)
        let targetModel = model || "gemini-2.5-flash";
        const supportedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf', 'text/plain'];

        const parts = [];

        if (prompt && prompt.trim() !== '') {
            parts.push({ text: prompt });
        } else {
            parts.push({ text: "قم بتحليل هذه الصورة وتفكيك محتوياتها وشرحها بالتفصيل." });
        }

        if (mediaParts && Array.isArray(mediaParts)) {
            for (const item of mediaParts) {
                if (item.inlineData && item.inlineData.data) {
                    const mime = item.inlineData.mimeType || "image/jpeg";
                    if (!supportedMimeTypes.includes(mime)) {
                        return res.status(200).json({ 
                            result: `⚠️ الصيغة المرفقة (${mime}) غير مدعومة مباشرة.\n\n💡 **نصيحة:** يرجى تحويل ملف PowerPoint إلى **PDF** أو تحويل الشرائح إلى **صور (PNG/JPG)** ثم إعادة رفعها.` 
                        });
                    }

                    parts.push({
                        inline_data: { mime_type: mime, data: item.inlineData.data }
                    });
                }
            }
        }

        const postData = JSON.stringify({
            contents: [{ parts: parts }],
            tools: [{ googleSearch: {} }],
            systemInstruction: {
                parts: [{ text: "أنت محرك التفكيك والتحليل الفوري لـ Tafkek OS. ابحث في الإنترنت عند الحاجة ووفر إجابات دقيقة بلغة عربية واضحة وبدون رموز غريبة." }]
            }
        });

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
                    response.setEncoding('utf-8');
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

        if (result.status !== 200 || result.data.error) {
            const errDetails = result.data.error?.message || `كود الاستجابة ${result.status}`;
            return res.status(200).json({ result: `⚠️ خطأ من سيرفر جوجل: ${errDetails}` });
        }

        const candidateParts = result.data.candidates?.[0]?.content?.parts || [];
        let outputText = "";

        candidateParts.forEach(p => {
            if (p.text) outputText += p.text + "\n";
        });

        outputText = outputText.replace(/\uFFFD/g, '');

        if (!outputText.trim()) {
            outputText = "لم يتم الحصول على تحليل نصي من النموذج، يرجى إعادة المحاولة.";
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
