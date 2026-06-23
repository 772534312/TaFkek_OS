export default async function handler(req, res) {
    // 1. استقبال طلبات POST فقط
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { idea, history } = req.body || {};
    if (!idea) {
        return res.status(400).json({ error: 'Missing idea payload' });
    }

    // 2. التحقق من وجود مفتاح الـ API
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(200).json({
            current_level: "LEVEL_1_SIMPLE",
            executive_summary: "⚠️ خطأ في الإعدادات: مفتاح الـ GEMINI_API_KEY غير مضاف في متغيرات البيئة (Environment Variables) داخل موقع Vercel.",
            table_headers: ["الحالة"],
            table_rows: [{"col1": "مفتاح مفقود", "col2": "يرجى إضافة المفتاح السري في إعدادات Vercel ثم عمل Redeploy."}],
            steps: [],
            interactive_questions: []
        });
    }

    // 3. مصفوفة المحركات السحابية المتاحة (الأساسي ثم الاحتياطي المستقر)
    const modelsToTry = ['gemini-2.5-flash', 'gemini-1.5-flash'];

    // توجيهات النظام الصارمة لإجبار جمناي على إرجاعโครงสร้าง JSON نقي ومحدد
    const systemInstruction = `You are the core expert system of TAFKEEK OS. Analyze the user's idea and deconstruct it. You MUST strictly respond with a valid JSON object matching this structure exactly, with no markdown formatting outside the JSON, no backticks, just raw JSON:
    {
        "current_level": "LEVEL_1_SIMPLE",
        "executive_summary": "Detailed summary and explanation in Arabic",
        "table_headers": ["العمود 1", "العمود 2", "العمود 3", "العمود 4"],
        "table_rows": [{"col1": "value", "col2": "value", "col3": "value", "col4": "value"}],
        "steps": [{"id": "1", "title": "Step Title", "description": "Step Desc"}],
        "interactive_questions": ["Question 1", "Question 2"]
    }`;

    for (const modelName of modelsToTry) {
        try {
            // الاتصال المباشر بـ API جوجل بدون مكتبات وسيطة
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
            
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: idea }] }],
                    systemInstruction: { parts: [{ text: systemInstruction }] },
                    generationConfig: {
                        responseMimeType: "application/json",
                        temperature: 0.6
                    }
                })
            });

            // إذا واجه هذا الموديل خطأ (مثل 503)، ننتقل فوراً للموديل التالي في اللوب
            if (!response.ok) {
                console.warn(`المحرك ${modelName} مستقطع أو مزدحم حالياً. جاري التحويل...`);
                continue;
            }

            const data = await response.json();
            
            // استخراج النص المسترجع من الهيكل الرسمي لردود جوجل
            let responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!responseText) continue;

            // تنظيف النص من أي علامات اقتباس زائدة قد يضعها السيرفر
            responseText = responseText.trim();
            if (responseText.startsWith("```json")) {
                responseText = responseText.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
            } else if (responseText.startsWith("```")) {
                responseText = responseText.replace(/^```\s*/i, "").replace(/```$/, "").trim();
            }

            const parsedData = JSON.parse(responseText);
            
            // إرسال النتيجة الناجحة فوراً وإنهاء العملية
            return res.status(200).json(parsedData);

        } catch (error) {
            console.error(`عطل عابر في الاتصال بالموديل ${modelName}:`, error);
            // الاستمرار في اللوب وتجربة المحرك الآخر
        }
    }

    // 🛡️ صمام الأمان الأخير (حالة الازدحام المطلق لجميع سيرفرات جوجل مجتمعة):
    // بدلاً من إرجاع كود 500، نرسل رد كود 200 يحتوي على شرح تفاعلي لطيف ويهبط داخل مربعات الموقع بسلاسة
    return res.status(200).json({
        current_level: "LEVEL_1_SIMPLE",
        executive_summary: `⏳ سيرفرات الذكاء الاصطناعي التابعة لجوجل عالمياً تواجه ضغطاً مكثفاً جداً الآن (High Demand).

لحماية نظامك من الانهيار، قام درع Tafkek OS بحظر الخطأ 500 وتأمين الواجهة. 

💡 كل ما عليك فعله هو الانتظار 5 ثوانٍ فقط، ثم اضغط على زر "معالجة وتفكيك" مرة أخرى ليمر طلبك بسلام عبر عنق الزجاجة العالمي.`,
        table_headers: ["حالة الاتصال السحابي", "الآلية الأمنية النشطة"],
        table_rows: [
            {
                "col1": "ازدحام مؤقت (503)",
                "col2": "تم صد العطل وتأمين ثبات واجهات موقعك بنجاح دون انكسار البرمجية."
            }
        ],
        steps: [
            {
                "id": "⌛",
                "title": "أعد المحاولة الآن",
                "description": "اضغط على زر التفكيك مجدداً لإرسال طلبك في الطابور المحدث."
            }
        ],
        interactive_questions: []
    });
}

ر
