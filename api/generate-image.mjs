export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const { prompt } = req.body || {};
    if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

    try {
        // توليد رقم عشوائي (Seed) لضمان عدم تكرار الصور عند طلب نفس الوصف
        const randomSeed = Math.floor(Math.random() * 999999);
        
        // بناء رابط الصورة المباشر عالي الدقة (1024x1024) وبدون شعارات مزعجة
        const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true&seed=${randomSeed}`;

        // نرسل رابط الصورة للواجهة لتقوم بعرضه داخل علامة <img> فوراً
        return res.status(200).json({ success: true, url: imageUrl });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

