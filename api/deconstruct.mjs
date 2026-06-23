export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { idea, history } = req.body || {};
    if (!idea) {
        return res.status(400).json({ error: 'Missing idea payload' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(200).json({
            current_level: "LEVEL_1_SIMPLE",
            executive_summary: "⚠️ خطأ: مفتاح الـ GEMINI_API_KEY غير مضاف في إعدادات Vercel.",
            table_headers: ["الحالة"],
            table_rows: [{"col1": "مفتاح مفقود", "col2": "يرجى إضافة المفتاح السري في Vercel."}],
            steps: [],
            interactive_questions: []
        });
    }

    const modelsToTry = ['gemini-2.5-flash', 'gemini-1.5-flash'];
    
    // مصفوفة لتجميع الأخطاء الحقيقية وعرضها للمستخدم عند الفشل دائمًا
    let debugErrors = [];

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

            const responseTextRaw = await response.text();

            // إذا رفضت جوجل الطلب، نقوم بتخزين نص الرفض الصريح القادم منها
            if (!response.ok) {
                debugErrors.push(`[${modelName}]: كود ${response.status} - ${responseTextRaw}`);
                continue;
            }

            const data = JSON.parse(responseTextRaw);
            let responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!responseText) {
                debugErrors.push(`[${modelName}]: استجابة فارغة بدون نصوص تفكيك.`);
                continue;
            }

            responseText = responseText.trim();
            if (responseText.startsWith("```json")) {
                responseText = responseText.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
            } else if (responseText.startsWith("```")) {
                responseText = responseText.replace(/^```\s*/i, "").replace(/```$/, "").trim();
            }

            const parsedData = JSON.parse(responseText);
            return res.status(200).json(parsedData);

        } catch (error) {
            debugErrors.push(`[${modelName} انهيار]: ${error.message}`);
        }
    }

    // 🔍 طباعة الأخطاء الحقيقية داخل مربعات الموقع وجداوله بدلاً من الرسالة العامة
    return res.status(200).json({
        current_level: "LEVEL_1_SIMPLE",
        executive_summary: "🔍 تم تفعيل نظام تشخيص الأعطال الذكي لـ Tafkek OS.\n\nالسيرفر مستقر ويعمل بنجاح، ولكن سيرفرات Google ترفض تمرير فكرتك لسبب فني صريح ومكتوب في الجدول بالأسفل الآون. اقرأ الرسالة لمعرفة السبب.",
        table_headers: ["المحاولة", "الرسالة الفنية الحقيقية القادمة من سيرفر Google"],
        table_rows: debugErrors.map((err, index) => ({
            "col1": `محرك رقم ${index + 1}`,
            "col2": err.substring(0, 300) // عرض أول 300 حرف من الخطأ لمنع تشويه الواجهة
        })),
        steps: [
            {
                "id": "🛠️",
                "title": "خطوة الإصلاح",
                "description": "انظر للخطأ في الجدول؛ إذا كان يحتوي على API_KEY_INVALID فالمفتاح خاطئ تماماً ويجب تغييره."
            }
        ],
        interactive_questions: []
    });
}

