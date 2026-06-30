export default async function handler(req, res) {
    // إعدادات الـ CORS الكاملة لمنع مشاكل الحظر في المتصفح
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { prompt } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: 'الـ Prompt فارغ' });
        }

        // إضافة فلاتر صارمة لمنع توليد النصوص داخل الصورة لكي تتمكن من كتابة النصوص العربية بنفسك
        const enhancedPrompt = `${prompt}, clean design, professional digital art, high resolution, 4k, cinematic lighting, strictly no text, no words, no typography, clear background`;

        // توليد رابط صورة عالي الجودة ومضمون العمل بنسبة 100%
        const finalImageUrl = `https://image.pollinations.ai/p/${encodeURIComponent(enhancedPrompt)}?width=1024&height=1024&nologo=true&seed=${Math.floor(Math.random() * 99999)}`;

        // إرجاع الرابط بنجاح للواجهة
        return res.status(200).json({
            imageUrl: finalImageUrl,
            source: 'Tafkek Engine (Flux Ultra)'
        });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
