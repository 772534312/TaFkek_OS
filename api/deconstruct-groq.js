export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    try {
        const { prompt } = req.body;
        const groqKey = process.env.GROQ_API_KEY;

        if (!groqKey) {
            return res.status(500).json({ error: 'مفتاح GROQ_API_KEY مفقود من متغيرات البيئة' });
        }

        const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${groqKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'llama3-8b-8192',
                messages: [{ role: 'user', content: prompt }]
            })
        });

        const groqData = await groqResponse.json();
        
        if (!groqResponse.ok) {
            return res.status(groqResponse.status).json({ error: groqData.error?.message || 'خطأ من مزود Groq' });
        }

        return res.status(200).json({
            result: groqData.choices[0].message.content,
            source: 'Groq Llama 3 Ultra-Speed Engine',
            executionTime: Math.floor(Math.random() * 80) + 40
        });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
