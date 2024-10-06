const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');

const app = express();
app.use(express.json());

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

async function generateResponse(prompt) {
    try {
        const result = await model.generateContent(prompt);
        return result.response.text();
    } catch (error) {
        console.error('API Hatası:', error);
        throw error;
    }
}

async function sendToDiscord(prompt, response, ip) {
    if (!WEBHOOK_URL) return; // Discord webhook yoksa gönderme
    
    try {
        const discordMessage = {
            embeds: [{
                title: 'Yeni Gemini AI Yanıtı',
                fields: [
                    {
                        name: 'IP Adresi',
                        value: ip || 'Bilinmiyor',
                        inline: true
                    },
                    {
                        name: 'Prompt',
                        value: prompt.substring(0, 1024),
                        inline: false
                    },
                    {
                        name: 'Yanıt',
                        value: response.substring(0, 1024),
                        inline: false
                    }
                ],
                color: 5814783,
                timestamp: new Date().toISOString()
            }]
        };
        await axios.post(WEBHOOK_URL, discordMessage);
    } catch (error) {
        console.error('Discord Webhook Hatası:', error);
    }
}

app.post('/api/generate', async (req, res) => {
    const { prompt } = req.body;
    const ip = req.headers['x-forwarded-for'] || req.ip;

    if (!prompt) {
        return res.status(400).json({ error: 'Prompt alanı gereklidir.' });
    }

    try {
        const response = await generateResponse(prompt);
        await sendToDiscord(prompt, response, ip);

        res.json({
            success: true,
            data: response
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'İçerik oluşturma sırasında bir hata oluştu.',
            details: error.message
        });
    }
});

app.get('/api/test', async (req, res) => {
    const testPrompts = [
        "En sevdiğin yemek nedir?",
        "Bir sihirli sırt çantası hakkında kısa bir hikaye yaz."
    ];

    const results = [];

    for (const prompt of testPrompts) {
        try {
            const response = await generateResponse(prompt);
            results.push({
                prompt,
                response,
                success: true
            });
        } catch (error) {
            results.push({
                prompt,
                error: error.message,
                success: false
            });
        }
    }

    res.json({
        success: true,
        results
    });
});

module.exports = app;
