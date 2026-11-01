const { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits } = require('discord.js');
const { joinVoiceChannel, getVoiceConnection } = require('@discordjs/voice');
const express = require('express');

// --- Web Sunucusu (UptimeRobot İçin) ---
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Discord botum 7/24 aktif ve çalışıyor! 🚀');
});

app.listen(port, () => {
    console.log(`Web sunucusu ${port} portunda çalışıyor.`);
});

// --- Bot İstemcisi ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates
    ]
});

// Sunucu bazlı küfür engel durumu hafızası
const kufurEngelDurumu = new Map();
const kufurListesi = [
    // Buraya istenen küfürler eklenebilir (örnek olması için temel küfürler konulabilir)
   "Allah",  "amk", "aq", "orospu", "oç", "sik", "anan", "piç", "kahpe", "mal", "salak", "ananı"
];

client.once('ready', () => {
    console.log(`Bot başarıyla giriş yaptı: ${client.user.tag}`);
});

// --- Yeni Üye Katıldığında "Kayıtsız" Rolü ve Özel Kanal Ayarı ---
client.on('guildMemberAdd', async member => {
    const guild = member.guild;
    
    // "Kayıtsız" rolünü bul veya yoksa oluştur
    let kayitsizRol = guild.roles.cache.find(r => r.name === 'Kayıtsız');
    if (!kayitsizRol) {
        try {
            kayitsizRol = await guild.roles.create({
                name: 'Kayıtsız',
                color: '#808080',
                permissions: []
            });
        } catch (e) {
            console.error("Kayıtsız rolü oluşturulamadı:", e);
        }
    }

    if (kayitsizRol) {
        await member.roles.add(kayitsizRol).catch(console.error);
    }
});

// --- Mesaj ve Komut Yönetimi ---
client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;

    const args = message.content.trim().split(/ +/);
    const command = args.shift().toLowerCase();
    const guild = message.guild;

    // 1. Küfür Engel Sistemi (!küfür-engel aç / kapat)
    if (command === '!küfür-engel') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('Bu komutu kullanmak için Yönetici yetkisine sahip olmalısın.');
        }

        const secenek = args[0];
        if (secenek === 'aç') {
            kufurEngelDurumu.set(guild.id, true);
            return message.reply('✅ Küfür engel sistemi **açıldı**!');
        } else if (secenek === 'kapat') {
            kufurEngelDurumu.set(guild.id, false);
            return message.reply('❌ Küfür engel sistemi **kapatıldı**!');
        } else {
            return message.reply('Lütfen `!küfür-engel aç` veya `!küfür-engel kapat` şeklinde kullanın.');
        }
    }

    // Küfür Kontrolü
    if (kufurEngelDurumu.get(guild.id)) {
        const icerik = message.content.toLowerCase();
        const kufurVarMi = kufurListesi.some(kufur => icerik.includes(kufur));
        if (kufurVarMi) {
            try {
                await message.delete();
                const uyari = await message.channel.send(`${message.author}, bu sunucuda küfür etmek yasak! 🚫`);
                setTimeout(() => uyari.delete().catch(() => {}), 4000);
                return;
            } catch (e) {
                console.error("Mesaj silinemedi:", e);
            }
        }
    }

    // 2. Sunucu Kurulum Sistemi (!sunucukur)
    if (command === '!sunucukur') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('Bu komutu kullanmak için Yönetici yetkisine sahip olmalısın.');
        }

        await message.reply('🛠️ Sunucu şablonu ve roller kuruluyor, lütfen bekleyin...');

        try {
            // Mevcut kanalları ve rolleri temizleme opsiyonel (güvenlik için sadece temel yapı oluşturulur)
            // Rolleri Oluştur
            const yetkiliRol = await guild.roles.create({ name: '👑 • Yönetici', color: '#FF0000', permissions: [PermissionFlagsBits.Administrator] });
            const uyeRol = await guild.roles.create({ name: '👥 • Üye', color: '#00FF00' });
            const kayitsizRol = await guild.roles.create({ name: 'Kayıtsız', color: '#808080', permissions: [] });

            // Kategoriler ve Kanallar
            const kategori = await guild.channels.create({
                name: '📢 REGISTRATION & INFO',
                type: ChannelType.GuildCategory
            });

            // Kayıtsız özel odası (Sadece kayıtsızlar ve yöneticiler görebilir)
            await guild.channels.create({
                name: 'kayıt-odasi',
                type: ChannelType.GuildText,
                parent: kategori.id,
                permissionOverwrites: [
                    {
                        id: guild.id, // Herkes
                        deny: [PermissionFlagsBits.ViewChannel]
                    },
                    {
                        id: kayitsizRol.id, // Kayıtsızlar görebilir
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
                    },
                    {
                        id: yetkiliRol.id, // Yöneticiler görebilir
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
                    }
                ]
            });

            await message.channel.send('🎉 Sunucu şablonu, roller ve kayıtsız odası başarıyla kuruldu!');
        } catch (error) {
            console.error(error);
            await message.channel.send('Sunucu kurulurken bir hata oluştu. Botun yetkilerini kontrol edin.');
        }
    }

    // 3. Kayıt Sistemi (!kaydet @kullanici @rol)
    if (command === '!kaydet') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
            return message.reply('Bu komutu kullanmak için yetkin yok.');
        }

        const hedefUye = message.mentions.members.first();
        const verilecekRol = message.mentions.roles.first();

        if (!hedefUye) {
            return message.reply('Lütfen kaydedilecek kişiyi etiketleyin. Örn: `!kaydet @kullanici @Uye`');
        }

        try {
            // Kayıtsız rolünü al
            const kayitsizRol = guild.roles.cache.find(r => r.name === 'Kayıtsız');
            if (kayitsizRol && hedefUye.roles.cache.has(kayitsizRol.id)) {
                await hedefUye.roles.remove(kayitsizRol);
            }

            // Belirtilen yeni rolü ver
            if (verilecekRol) {
                await hedefUye.roles.add(verilecekRol);
                await message.channel.send(`✨ ${hedefUye} başarıyla kaydedildi ve ${verilecekRol.name} rolü verildi!`);
            } else {
                await message.channel.send(`✨ ${hedefUye} kaydedildi (Rol belirtilmediği için sadece kayıtsız rolü alındı).`);
            }
        } catch (error) {
            console.error(error);
            await message.reply('Kayıt işlemi sırasında bir hata oluştu.');
        }
    }

    // 4. Ses Kanalında Sabit Kalma Sistemi (!sesegir #kanal / !sestençık)
    if (command === '!sesegir') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('Bu komut için yönetici yetkisi gerekiyor.');
        }

        const sesKanalı = message.mentions.channels.first() || guild.channels.cache.get(args[0]);

        if (!sesKanalı || sesKanalı.type !== ChannelType.GuildVoice) {
            return message.reply('Lütfen geçerli bir ses kanalı etiketleyin veya ID yazın. Örn: `!sesegir #SesKanalı`');
        }

        try {
            joinVoiceChannel({
                channelId: sesKanalı.id,
                guildId: guild.id,
                adapterCreator: guild.voiceAdapterCreator,
                selfDeaf: false,
                selfMute: true
            });
            await message.reply(`🔊 Başarıyla **${sesKanalı.name}** ses kanalına giriş yapıldı ve komut gelene kadar sabitlendi!`);
        } catch (error) {
            console.error(error);
            await message.reply('Ses kanalına bağlanırken bir hata oluştu.');
        }
    }

    if (command === '!sestençık') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('Bu komut için yönetici yetkisi gerekiyor.');
        }

        const connection = getVoiceConnection(guild.id);
        if (connection) {
            connection.destroy();
            await message.reply('🛑 Ses kanalından çıkış yapıldı.');
        } else {
            await message.reply('Bot zaten herhangi bir ses kanalında değil.');
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
