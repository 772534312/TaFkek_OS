import { GoogleGenAI } from '@google/genai';

export default async function handler(req, res) {
    // تأمين التحقق من نوع الطلب
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { idea, history } = req.body;
    if (!idea) {
        return res.status(400).json({ error: 'يرجى كتابة المدخلات لبدء التفكيك الإدراكي' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'مفتاح التشغيل السري (GEMINI_API_KEY) مفقود في إعدادات السيرفر' });
    }

    // 🧠 محرك التدرج الإدراكي التلقائي لحساب عدد الجولات الحالية في السجل
    const turnCount = history ? history.length : 0;
    let depthLevel = "LEVEL_1_SIMPLE"; 
    let depthInstructions = "المستوى الحالي هو [المستوى 1: التبسيط الإدراكي]. اشرح الفكرة كأنك تشرحها لمستثمر غير تقني أو شخص مبتدئ تماماً. استخدم تشبيهات ذكية وأمثلة من الحياة اليومية. تجنب تماماً المصطلحات البرمجية المعقدة، واجعل جدول البيانات مبسطاً ومريحاً.";

    if (turnCount >= 2 && turnCount < 4) {
        depthLevel = "LEVEL_2_INTERMEDIATE"; 
        depthInstructions = "المستوى الحالي هو [المستوى 2: التخطيط التكتيكي المتوسط]. المستخدم استوعب الفكرة العامة، الآن ادخل معه في تفاصيل المكونات، العلاقات بين الأجزاء، التحديات التشغيلية، والحلول المنطقية بدون كتابة شفرات برمجية صعبة.";
    } else if (turnCount >= 4) {
        depthLevel = "LEVEL_3_ADVANCED"; 
        depthInstructions = "المستوى الحالي هو [المستوى 3: الهندسة العكسية والتفكيك الكامل]. ادخل في أدق التفاصيل الفنية، معمارية البيانات، الخوارزميات، والتقنيات المقترحة للتنفيذ الفعلي بكل عمق برمجي هندسي.";
    }

    try {
        const ai = new GoogleGenAI({ apiKey });

        // بناء سياق المحادثة التاريخي الممتد لجمناي
        let contextPrompt = "";
        if (history && history.length > 0) {
            contextPrompt = "سياق الجلسة التاريخي الممتد بينك وبين المستخدم:\n";
            history.forEach(msg => {
                contextPrompt += `- ${msg.role === 'user' ? 'المستخدم' : 'النظام'}: ${msg.text}\n`;
            });
            contextPrompt += `\n`;
        }

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash', 
            contents: `${contextPrompt}المدخل الجديد الحالي: "${idea}"\n\nتوجيهات العمق الحالية الصارمة:\n${depthInstructions}`,
            config: {
                responseMimeType: "application/json",
                systemInstruction: `أنت النواة الإدراكية لـ (تفكيك OS). وظيفتك قيادة المستخدم نحو الفهم الكامل عبر التدرج والوضوح الشديد مثل ChatGPT. لا تصدمه بمعلومات معقدة إلا إذا تقدمت الجلسة. صغ الإجابة لتكون مريحة ومفهومة جداً للقراءة وبدون حشو خطير. املأ كائن الـ JSON بدقة متناهية متوافقاً مع مستوى العمق المطلوب.`,
                responseSchema: {
                    type: "OBJECT",
                    properties: {
                        current_level: { type: "STRING", description: "يجب أن تعيد القيمة الحالية بالضبط وهي إما: LEVEL_1_SIMPLE أو LEVEL_2_INTERMEDIATE أو LEVEL_3_ADVANCED بناءً على توجيه السيرفر." },
                        executive_summary: { type: "STRING", description: "الشرح التدرجي الواضح والمفهوم للفكرة متوافقاً مع مستوى العمق الحالي." },
                        table_headers: { 
                            type: "ARRAY", 
                            items: { type: "STRING" },
                            description: "4 عناوين لأعمدة الجدول التحليلي تناسب مستوى الفهم الحالي."
                        },
                        table_rows: {
                            type: "ARRAY",
                            items: {
                                type: "OBJECT",
                                properties: {
                                    col1: { type: "STRING" },
                                    col2: { type: "STRING" },
                                    col3: { type: "STRING" },
                                    col4: { type: "STRING" }
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
                                    description: { type: "STRING", description: "خطوات تنفيذية واضحة ومباشرة تلائم مستوى العمق الحالي." }
                                },
                                required: ["id", "title", "description"]
                            }
                        },
                        interactive_questions: {
                            type: "ARRAY",
                            items: { type: "STRING" },
                            description: "3 أسئلة استدراجية ذكية تحفز المستخدم للضغط عليها من أجل الانتقال للمستوى الأعمق التالي."
                        }
                    },
                    required: ["current_level", "executive_summary", "table_headers", "table_rows", "steps", "interactive_questions"]
                }
            }
        });

        const data = JSON.parse(response.text);
        return res.status(200).json(data);

    } catch (error) {
        console.error("خطأ معالجة النواة التدريجية:", error);
        return res.status(500).json({ error: 'فشلت المعالجة الإدراكية بالنظام: ' + error.message });
    }
}

