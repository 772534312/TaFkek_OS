export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    // الواجهة سترسل: النص المطلوب، وصيغة الملف (مثل image/jpeg أو application/pdf)، والملف مشفر كـ base64
    const { prompt, mimeType, base64Data } = req.body || {};
    if (!base64Data || !mimeType) return res.status(400).json({ error: 'Missing file data' });

    const apiKey = process.env.GEMINI_API_KEY;
    const userPrompt = prompt || "قم بقراءة هذا المستند أو الصورة بدقة واشرح محتوياته بالتفصيل باللغة العربية.";

    try {
        // نستخدم الرابط المستقر v1 الذي اكتشفناه في الفحص لمنع أعطال الـ 404
        const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [
                            { text: userPrompt },
                            {
                                inlineData: {
                                    mimeType: mimeType,
                                    data: base64Data
                                }
                            }
                        ]
                    }
                ]
            })
        });

        const data = await response.json();
        const outputText = data.candidates?.[0]?.content?.parts?.[0]?.text;

        return res.status(200).json({ success: true, analysis: outputText });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

