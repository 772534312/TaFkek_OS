import { GoogleGenAI } from '@google/genai';

export default async function handler(req, res) {
    // 1. تأمين وحماية نقطة النهاية (Security Controls)
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

        // 2. استدعاء المحرك مع هندسة أوامر متقدمة (Advanced Prompt Engineering)
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `قم بتفكيك الفكرة التالية تفكيكاً استراتيجياً وعملياً: "${idea}"`,
            config: {
                responseMimeType: "application/json",
                // حقن نظام التوجيه الصارم للمحرك
                systemInstruction: "أنت خبير تفكيك نظم ومحلل استراتيجي من الطراز الأول. مهمتك هي أخذ أي فكرة وتحليلها إلى خطوات عملية قابلة للتنفيذ فوراً. يجب أن تكون ردودك دائماً بصيغة JSON مطابقة تماماً للهيكل المطلوب، وأن تكون واقعية وبعيدة عن الإنشاء النظري.",
                // تحديد هيكل البيانات الصارم لضمان أعلى جودة تفاعلية
                responseSchema: {
                    type: "OBJECT",
                    properties: {
                        steps: {
                            type: "ARRAY",
                            items: {
                                type: "OBJECT",
                                properties: {
                                    id: { type: "STRING" },
                                    title: { type: "STRING" },
                                    description: { type: "STRING" },
                                    priority: { type: "STRING", enum: ["عاجلة جداً", "استراتيجية", "مؤجلة"] },
                                    difficulty: { type: "INTEGER", description: "مستوى الصعوبة من 1 إلى 5" },
                                    estimated_time: { type: "STRING", description: "الوقت المتوقع للإنجاز" },
                                    checklist: {
                                        type: "ARRAY",
                                        items: { type: "STRING" },
                                        description: "3 مهام فرعية صغيرة جداً لتنفيذ هذه الخطوة الرئيسية"
                                    }
                                },
                                required: ["id", "title", "description", "priority", "difficulty", "estimated_time", "checklist"]
                            }
                        }
                    },
                    required: ["steps"]
                }
            }
        });

        // 3. معالجة وتمرير البيانات النظيفة للواجهة الأمامية
        const data = JSON.parse(response.text);
        return res.status(200).json(data);

    } catch (error) {
        console.error("سجل الأخطاء الفني:", error);
        return res.status(500).json({ error: 'فشلت معالجة الإشارة الإدراكية: ' + error.message });
    }
}

