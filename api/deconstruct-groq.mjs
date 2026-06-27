export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const { idea } = req.body || {};
    if (!idea) return res.status(400).json({ error: 'Missing idea payload' });

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
        return res.status(200).json({
            current_level: "LEVEL_1_SIMPLE",
            executive_summary: "⚠️ خطأ: مفتاح GROQ_API_KEY غير مضاف في إعدادات Vercel.",
            table_headers: ["الحالة"], table_rows: [{"col1": "مفقود"}], steps: [], interactive_questions: []
        });
    }

    const systemInstruction = `You are an expert system. Analyze the user's idea and deconstruct it. You MUST strictly respond with a valid JSON object matching this structure exactly, with no markdown, no backticks, just raw JSON:
    {
        "current_level": "LEVEL_1_SIMPLE",
        "executive_summary": "Detailed summary and explanation in Arabic",
        "table_headers": ["العمود 1", "العمود 2", "العمود 3", "العمود 4"],
        "table_rows": [{"col1": "value", "col2": "value", "col3": "value", "col4": "value"}],
        "steps": [{"id": "1", "title": "Step Title", "description": "Step Desc"}],
        "interactive_questions": ["Question 1", "Question 2"]
    }`;

    try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: "llama-3.1-8b-instant", // نموذج فائق السرعة ومجاني
                messages: [
                    { role: "system", content: systemInstruction },
                    { role: "user", content: idea }
                ],
                response_format: { type: "json_object" }, // إجبار المحرك على إرجاع JSON نقي
                temperature: 0.5
            })
        });

        const data = await response.json();
        const responseText = data.choices?.[0]?.message?.content;
        
        return res.status(200).json(JSON.parse(responseText.trim()));
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

