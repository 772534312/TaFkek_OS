import https from 'https';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const { prompt } = req.body;
        const apiKey = process.env.GEMINI_API_KEY;

        const postData = JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            systemInstruction: {
                parts: [{ text: "أنت محاكي الأكواد السلوكي والمنطقي الصارم (Senior Code Behaviour Simulator). وظيفتك عدم فحص الصياغة فقط، بل تتبع المنطق ذهنياً خطوة بخطوة. ابحث عن الأخطاء الدقيقة الخفية كالحلقات التي لا تنتهي (مثال: عدم الخروج عند القيمة 0)، استهلاك الذاكرة، وخلل التدفق. اعرض تحليلك في كتل برمجية منظمة وجداول تبين المدخلات والمخرجات." }]
            }
        });

        const options = {
            hostname: 'generativelanguage.googleapis.com',
            port: 443,
            path: `/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`,
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) }
        };

        const run = () => new Promise((res, rej) => {
            const r = https.request(options, response => {
                let b = ''; response.on('data', c => b += c); response.on('end', () => res(JSON.parse(b)));
            });
            r.on('error', rej); r.write(postData); r.end();
        });

        const data = await run();
        return res.status(200).json({ result: data.candidates[0].content.parts[0].text, source: 'Tafkek Loop-Destroyer Core' });
    } catch (e) { return res.status(500).json({ error: e.message }); }
}
