import https from 'https';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const { prompt, model } = req.body;
        const apiKey = process.env.GEMINI_API_KEY;
        let targetModel = model || "gemini-2.5-flash";

        const postData = JSON.stringify({
            contents: [{ parts: [{ text: `قم بتحليل وتفكيك البنية المستندية للنص التالي واستخراج المفاهيم وهيكلتها:\n\n${prompt}` }] }]
        });

        const options = {
            hostname: 'generativelanguage.googleapis.com',
            port: 443,
            path: `/v1beta/models/${targetModel}:generateContent?key=${apiKey}`,
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) }
        };

        const reqPromise = () => {
            return new Promise((resolve, reject) => {
                const request = https.request(options, response => {
                    let body = '';
                    response.on('data', chunk => body += chunk);
                    response.on('end', () => resolve({ status: response.statusCode, data: JSON.parse(body) }));
                });
                request.on('error', reject);
                request.write(postData);
                request.end();
            });
        };

        const result = await reqPromise();
        const output = result.data.candidates?.[0]?.content?.parts?.[0]?.text || "لم يتم استخراج نص معالجة.";

        return res.status(200).json({ result: output, source: `Document Analyzer Engine (${targetModel.toUpperCase()})` });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
}
