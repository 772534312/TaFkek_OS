<script>
    // 1. تعريف الذاكرة المحلية
    let chatHistory = [];

    async function sendMessageToTafkek(userText, mediaData = null) {
        // إضافة سؤال المستخدم للذاكرة
        chatHistory.push({ role: 'user', content: userText });

        const response = await fetch('/api/deconstruct', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt: userText,
                history: chatHistory.slice(-6), // إرسال آخر 6 رسائل فقط للحفاظ على السرعة والذاكرة
                mediaParts: mediaData
            })
        });

        const data = await response.json();
        
        if (data.result) {
            // إضافة رد النظام للذاكرة
            chatHistory.push({ role: 'assistant', content: data.result });
            
            // عرض الرد في الشاشة
            renderMessage(data.result, data.source);
        }
    }
</script>
