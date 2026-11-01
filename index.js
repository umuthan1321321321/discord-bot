const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
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
    intents: [GatewayIntentBits.Guilds]
});

client.once('ready', async () => {
    console.log(`Başarıyla giriş yapıldı: ${client.user.tag}`);

    // Slash komutunu Discord'a kaydediyoruz
    const commands = [
        new SlashCommandBuilder().setName('ping').setDescription('Botun gecikme süresini gösterir.')
    ].map(command => command.toJSON());

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    try {
        console.log('Slash komutları yükleniyor...');
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands },
        );
        console.log('Slash komutları başarıyla yüklendi!');
    } catch (error) {
        console.error(error);
    }
});

// Slash komut çalıştırma ve "Uygulama yanıt vermedi" hatasını önleme
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'ping') {
        // Discord'a zaman aşımına uğramaması için "düşünüyor" sinyali gönderir
        await interaction.deferReply();

        // Botun gecikme süresini hesaplıyoruz
        const ping = Date.now() - interaction.createdTimestamp;

        // Yanıtı gönderiyoruz
        await interaction.editReply(`Pong! 🏓 Gecikme süresi: ${ping}ms`);
    }
});

client.login(process.env.DISCORD_TOKEN);
