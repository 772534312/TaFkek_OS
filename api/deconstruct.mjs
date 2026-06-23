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
            contents: `قم بإجراء تفكيك استراتيجي شامل وعميق جداً للفكرة التالية: "${idea}"`,
            config: {
                responseMimeType: "application/json",
                systemInstruction: "أنت النواة الإدراكية لـ (تفكيك OS)، خبير ومحلل استراتيجي راديكالي. مهمتك هي عدم إعطاء إجابات عادية أو إنشائية. قم بتحليل الأفكار بدقة تفكيكية متناهية، وصياغة جداول مقارنة متطورة، واستخلاص ملخصات تنفيذية مركّزة، وصياغة أسئلة استرجاعية حادة لتوجيه المستخدم في نهاية التحليل لتطوير فكرته.",
                responseSchema: {
                    type: "OBJECT",
                    properties: {
                        executive_summary: { 
                            type: "STRING", 
                            description: "ملخص تنفيذي عميق ومركز يشرح الجدوى والعمق الاستراتيجي للفكرة بأسلوب احترافي." 
                        },
                        analysis_table: {
                            type: "OBJECT",
                            properties: {
                                headers: { 
                                    type: "ARRAY", 
                                    items: { type: "STRING" },
                                    description: "عناوين الأعمدة الأربعة للجدول التوضيحي (مثال: الجانب المستهدف، التحدي الجذري، الحل المفكك، الأثر الاستراتيجي)"
                                },
                                rows: {
                                    type: "ARRAY",
                                    items: {
                                        type: "ARRAY",
                                        items: { type: "STRING" }
                                    },
                                    description: "صفوف البيانات التوضيحية داخل الجدول (يجب ألا تقل عن 3 صفوف مليئة بالتحليل المعمق)"
                                }
                            },
                            required: ["headers", "rows"] // تم إصلاح القوس الزائد هنا بنجاح
                        },
                        steps: {
                            type: "ARRAY",
                            items: {
                                type: "OBJECT",
                                properties: {
                                    id: { type: "STRING" },
                                    title: { type: "STRING" },
                                    description: { type: "STRING", description: "شرح مطول، منظم، غني بالمعلومات العميقة جداً لهذه الخطوة." }
                                },
                                required: ["id", "title", "description"]
                            }
                        },
                        interactive_questions: {
                            type: "ARRAY",
                            items: { type: "STRING" },
                            description: "3 أسئلة تفاعلية ذكية وحاسمة للمستخدم لتوسيع أبعاد فكرته في المحادثة القادمة."
                        }
                    },
                    required: ["executive_summary", "analysis_table", "steps", "interactive_questions"]
                }
            }
        });

        const data = JSON.parse(response.text);
        return res.status(200).json(data);

    } catch (error) {
        console.error("سجل الأخطاء الفني:", error);
        return res.status(500).json({ error: 'فشلت معالجة الإشارة الإدراكية العميقة: ' + error.message });
    }
}

