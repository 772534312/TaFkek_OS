import { GoogleGenAI } from '@google/genai';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // استقبال الفكرة الحالية مع الذاكرة التاريخية للجلسة
    const { idea, history } = req.body;
    if (!idea) {
        return res.status(400).json({ error: 'يرجى كتابة المدخلات البدء التفكيك' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'مفتاح التشغيل السري مفقود في السيرفر' });
    }

    try {
        const ai = new GoogleGenAI({ apiKey });

        // بناء سياق المحادثة التاريخي لتغذية النموذج به (ميزة ChatGPT)
        let contextPrompt = "";
        if (history && history.length > 0) {
            contextPrompt = "سياق النقاش التاريخي الممتد في الجلسة الحالية:\n";
            history.forEach(msg => {
                contextPrompt += `- ${msg.role === 'user' ? 'المستخدم' : 'النظام'}: ${msg.text}\n`;
            });
            contextPrompt += `\nالمطلوب الآن معالجة المدخل الجديد بناءً على هذا السياق والتاريخ أعلاه:\n`;
        }

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash', 
            contents: `${contextPrompt} المدخل الحالي للتفكيك: "${idea}"`,
            config: {
                responseMimeType: "application/json",
                systemInstruction: "أنت النواة الإدراكية الخارقة لـ (تفكيك OS). تجمع بين عمق التفكير المنطقي لـ ChatGPT وسرعة التوليد الهيكلية لـ Gemini. مهمتك هي تفكيك مدخلات المستخدم هندسياً واستراتيجياً. صغ الإجابة بنصوص مكثفة، غنية بالمعلومات الفنية، وبدون حشو لتجنب بطء الخادم الفيدرالي. املأ الجدول بـ 3 صفوف ذكية، والخطوات بـ 3 مراحل عملية حاسمة.",
                responseSchema: {
                    type: "OBJECT",
                    properties: {
                        executive_summary: { type: "STRING", description: "تحليل استراتيجي وتنفيذي عميق جداً للمدخل الحالي سياق الجلسة." },
                        table_headers: { 
                            type: "ARRAY", 
                            items: { type: "STRING" },
                            description: "4 عناوين لأعمدة مصفوفة التحليل العميقة"
                        },
                        table_rows: {
                            type: "ARRAY",
                            items: {
                                type: "OBJECT",
                                properties: {
                                    col1: { type: "STRING", description: "المكون التقني/الاستراتيجي" },
                                    col2: { type: "STRING", description: "التحدي أو الثغرة" },
                                    col3: { type: "STRING", description: "الهندسة العكسية والحل" },
                                    col4: { type: "STRING", description: "مؤشر النجاح أو الأثر" }
                                },
                                required: ["col1", "col2", "col3", "col4"]
                            }
                        },
                        steps: {
                            type: "ARRAY",
                            items: {
                                type: "OBJECT",
                                properties: {
                                    id: { type: "STRING" },
                                    title: { type: "STRING" },
                                    description: { type: "STRING", description: "شرح تقني دقيق ومباشر لتنفيذ الخطوة." }
                                },
                                required: ["id", "title", "description"]
                            }
                        },
                        interactive_questions: {
                            type: "ARRAY",
                            items: { type: "STRING" },
                            description: "3 أسئلة استرجاعية فائقة الذكاء لدفع المستخدم لتطوير النظام في الرد القادم."
                        }
                    },
                    required: ["executive_summary", "table_headers", "table_rows", "steps", "interactive_questions"]
                }
            }
        });

        const data = JSON.parse(response.text);
        return res.status(200).json(data);

    } catch (error) {
        console.error("خطأ فني في محرك التفكيك:", error);
        return res.status(500).json({ error: 'فشلت النواة في معالجة الإشارة الرقمية: ' + error.message });
    }
}

