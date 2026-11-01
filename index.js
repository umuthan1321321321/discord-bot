const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');

// --- 1. Kısım: Web Sunucusu (UptimeRobot için şart) ---
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Discord botum 7/24 aktif ve çalışıyor! 🚀');
});

app.listen(port, () => {
    console.log(`Web sunucusu ${port} portunda çalışıyor.`);
});

// --- 2. Kısım: Discord Bot Kodları ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.once('ready', () => {
    console.log(`Başarıyla giriş yapıldı: ${client.user.tag}`);
});

// Örnek komut
client.on('messageCreate', message => {
    if (message.author.bot) return;
    
    if (message.content === '!ping') {
        message.reply('Pong! 🏓 Bot sorunsuz çalışıyor.');
    }
});

// Token'ınızı güvenliğe almak için Environment Variable (Render Environment) kullanacağız
client.login(process.env.DISCORD_TOKEN);