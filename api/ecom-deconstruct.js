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
                parts: [{ text: "أنت خبير فك تشفير العمليات اللوجستية والتجارية الرقمية (E-Commerce Ops Expert). حلل سجلات الشحنات، المخزون، التوريد، وحسابات النقل المعقدة. رتب النتائج إجبارياً في جداول مقارنة واضحة، ووضح مخاطر الاختناقات، وتوقعات سلاسل التوريد (Supply Chain Bottlenecks) مع تقديم حلول نموذجية." }]
            }
        });

        const options = {
            hostname: 'generativelanguage.googleapis.com',
            port: 443,
            path: `/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
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
        return res.status(200).json({ result: data.candidates[0].content.parts[0].text, source: 'Tafkek E-Com Ops Core' });
    } catch (e) { return res.status(500).json({ error: e.message }); }
}
