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
            contents: `قم بتفكيك الفكرة التالية تفكيكاً استراتيجياً وعملياً بالكامل: "${idea}"`,
            config: {
                responseMimeType: "application/json",
                systemInstruction: "أنت خبير تفكيك نظم ومحلل استراتيجي من الطراز الأول. مهمتك هي أخذ أي فكرة وتحليلها إلى خطوات عملية. يجب أن تعيد النتيجة دائماً على شكل مصفوفة JSON مباشرة تحتوي على تفاصيل غنية جداً وعملية لكل خطوة.",
                // هنا التكتيك الذكي: مصفوفة مباشرة لكنها غنية بالبيانات الداخلية!
                responseSchema: {
                    type: "ARRAY",
                    items: {
                        type: "OBJECT",
                        properties: {
                            id: { type: "STRING" },
                            title: { type: "STRING" },
                            description: { type: "STRING" },
                            priority: { type: "STRING", enum: ["عاجلة جداً", "استراتيجية", "مؤجلة"] },
                            difficulty: { type: "INTEGER", description: "مستوى الصعوبة من 1 إلى 5" },
                            estimated_time: { type: "STRING", description: "الوقت المتوقع لإنجاز الخطوة" },
                            checklist: {
                                type: "ARRAY",
                                items: { type: "STRING" },
                                description: "3 مهام فرعية تنفيذية دقيقة جداً لهذه الخطوة"
                            }
                        },
                        required: ["id", "title", "description", "priority", "difficulty", "estimated_time", "checklist"]
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

