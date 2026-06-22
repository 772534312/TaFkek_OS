import { GoogleGenAI } from '@google/genai';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'الطريقة غير مسموح بها' });
    }

    const { idea } = req.body;
    if (!idea) {
        return res.status(400).json({ error: 'يرجى كتابة الفكرة لتفكيكها' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'مفتاح التشغيل السري مفقود في السيرفر' });
    }

    try {
        const ai = new GoogleGenAI({ apiKey });

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash', 
            contents: `قم بتفكيك الفكرة التالية إلى خطوات عمل تفصيلية ومنطقية جداً باللغة العربية: "${idea}"`,
            config: {
                responseMimeType: "application/json",
                systemInstruction: "أنت خبير تفكيك نظم ومحلل استراتيجي من الطراز الأول. مهمتك هي أخذ أي فكرة وتحليلها إلى خطوات عملية متتالية. يجب أن تعيد النتيجة دائماً على شكل مصفوفة JSON مباشرة تحتوي على معرف وعنوان ووصف لكل خطوة، دون أي غلاف خارجي.",
                // تعديل الهيكل ليكون مصفوفة مباشرة تطابق برمجة الواجهة الأمامية تماماً
                responseSchema: {
                    type: "ARRAY",
                    items: {
                        type: "OBJECT",
                        properties: {
                            id: { type: "STRING" },
                            title: { type: "STRING" },
                            description: { type: "STRING" }
                        },
                        required: ["id", "title", "description"]
                    }
                }
            }
        });

        const data = JSON.parse(response.text);
        return res.status(200).json(data);

    } catch (error) {
        console.error("سجل الأخطاء الفني:", error);
        return res.status(500).json({ error: 'فشلت معالجة الإشارة الإدراكية: ' + error.message });
    }
}

