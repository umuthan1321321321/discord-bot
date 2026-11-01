const { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits } = require('discord.js');
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

// Ayarlar ve Hafızalar
const kufurEngelDurumu = new Map();
const hosgeldinDurumu = new Map();
const sayacDurumu = new Map();
const merhabaDurumu = new Map();

// Genişletilmiş Küfür/Argo Listesi
const kufurListesi = [
    "amk", "aq", "orospu", "oç", "sik", "sikerim", "anan", "piç", "kahpe", 
    "göt", "yarrak", "amcık", "orospi", "o.ç", "siktir", "sikik", "ananı", 
    "sg", "ibne", "yarak", "orospuçocuğu"
];

function kufurKontrolEt(metin) {
    const temizMetin = metin.toLowerCase().replace(/[^a-zçğİıöşü]/g, '');
    return kufurListesi.some(kufur => temizMetin.includes(kufur));
}

client.once('ready', () => {
    console.log(`Bot başarıyla giriş yaptı: ${client.user.tag}`);
});

// --- Yeni Üye Katıldığında ---
client.on('guildMemberAdd', async member => {
    const guild = member.guild;
    
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
        await member.roles.add(kayitsizRol).catch(err => console.error("Rol verme hatası:", err));
    }

    if (hosgeldinDurumu.get(guild.id)) {
        const hedefKanalID = '1564306973841821788';
        const kanal = guild.channels.cache.get(hedefKanalID);
        const sohbetKanali = guild.channels.cache.find(c => c.name.includes('sohbet') && c.type === ChannelType.GuildText);
        const sohbetEtiket = sohbetKanali ? `<#${sohbetKanali.id}>` : '#sohbet';

        if (kanal) {
            kanal.send(`Selam ${member} Aramıza hoşgeldin sohbet etmeye başla! ${sohbetEtiket}`).catch(err => console.error("Hoş geldin mesajı atılamadı:", err));
        }
    }

    if (sayacDurumu.get(guild.id)) {
        const sayacKanalID = '1566455836862054570';
        const sayacKanal = guild.channels.cache.get(sayacKanalID);
        if (sayacKanal) {
            sayacKanal.send(`Hoş geldin, seninle beraber ${guild.memberCount} kişiyiz!`).catch(err => console.error("Sayaç mesajı atılamadı:", err));
        }
    }
});

// --- Komutlar ve Mesaj Yönetimi ---
client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;

    const args = message.content.trim().split(/ +/);
    const command = args.shift().toLowerCase();
    const guild = message.guild;
    const icerikKucuk = message.content.toLowerCase();

    // Önce Komutları Kontrol Et (Böylece !merhaba kapat yazıldığında bot yanlışlıkla sohbet yanıtını tetiklemez)
    
    // 1. !yardım Komutu
    if (command === '!yardım') {
        const yardimMesaji = `🤖 **Bot Komutları Menüsü**
• \`!küfür-engel aç / kapat\` - Küfür ve argo engel sistemini yönetir.
• \`!sunucuhoşgeldin aç / kapat\` - Yeni gelenlere özel kanal üzerinden hoş geldin mesajı atar.
• \`!sayaç aç / kapat\` - Yeni üye katıldığında sayaç kanalına üye sayısını bildirir.
• \`!merhaba aç / kapat\` - Selam, merhaba veya nasılsın diyenlere otomatik yanıt verir.
• \`!sunucukur\` - Temel sunucu rollerini ve odalarını otomatik kurar.
• \`!kanalizinsifirla\` - Roller silinmeden, tüm kanallardaki özel rol izinlerini sıfırlar ve sadece @everyone bırakır.
• \`!kuralkoy\` - Resmi kural metnini kutucuk içinde ve @everyone etiketiyle gönderir.
• \`!herkeserol @Rol\` - Sunucudaki herkese etiketlenen rolü toplu şekilde dağıtır.
• \`!kaydet @kullanici @Rol\` - Kullanıcının kayıtsız rolünü alıp yeni rolünü verir.
• \`!yardım\` - Bu yardım menüsünü gösterir.`;

        return message.reply(yardimMesaji);
    }

    // 2. Kanalların İzinlerini Sıfırlama Komutu (!kanalizinsifirla)
    if (command === '!kanalizinsifirla') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('Bu komut için Yönetici yetkisine sahip olmalısın.');
        }

        await message.reply('⏳ Roller silinmeden, kanalların izinleri sıfırlanıyor...');

        try {
            const channels = guild.channels.cache;
            let sayac = 0;

            for (const [id, channel] of channels) {
                try {
                    await channel.permissionOverwrites.set([
                        {
                            id: guild.id,
                            allow: channel.permissionOverwrites.cache.get(guild.id)?.allow || [],
                            deny: channel.permissionOverwrites.cache.get(guild.id)?.deny || []
                        }
                    ]);
                    sayac++;
                } catch (err) {}
            }

            await message.channel.send("✅ İşlem tamamlandı! Kanalların özel izinleri sıfırlandı ve sadece @everyone bırakıldı.");
        } catch (error) {
            console.error(error);
            await message.reply('İzinler sıfırlanırken bir hata oluştu.');
        }
    }

    // 3. Küfür Engel Sistemi (!küfür-engel aç / kapat)
    if (command === '!küfür-engel') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('Bu komutu kullanmak için Yönetici yetkisine sahip olmalısın.');
        }

        const secenek = args[0];
        if (secenek === 'aç') {
            kufurEngelDurumu.set(guild.id, true);
            return message.reply('✅ Küfür ve argo engel sistemi **açıldı**!');
        } else if (secenek === 'kapat') {
            kufurEngelDurumu.set(guild.id, false);
            return message.reply('❌ Küfür ve argo engel sistemi **kapatıldı**!');
        } else {
            return message.reply('Lütfen `!küfür-engel aç` veya `!küfür-engel kapat` şeklinde kullanın.');
        }
    }

    // 4. Sunucu Hoş Geldin Sistemi (!sunucuhoşgeldin aç / kapat)
    if (command === '!sunucuhoşgeldin') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('Bu komut için yönetici yetkisi gerekiyor.');
        }

        const secenek = args[0];
        if (secenek === 'aç') {
            hosgeldinDurumu.set(guild.id, true);
            return message.reply('✅ Sunucu hoş geldin sistemi **açıldı**!');
        } else if (secenek === 'kapat') {
            hosgeldinDurumu.set(guild.id, false);
            return message.reply('❌ Sunucu hoş geldin sistemi **kapatıldı**!');
        } else {
            return message.reply('Lütfen `!sunucuhoşgeldin aç` veya `!sunucuhoşgeldin kapat` şeklinde kullanın.');
        }
    }

    // 5. Sayaç Sistemi Komutu (!sayaç aç / kapat)
    if (command === '!sayaç') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('Bu komut için yönetici yetkisi gerekiyor.');
        }

        const secenek = args[0];
        if (secenek === 'aç') {
            sayacDurumu.set(guild.id, true);
            return message.reply('✅ Sayaç sistemi **açıldı**!');
        } else if (secenek === 'kapat') {
            sayacDurumu.set(guild.id, false);
            return message.reply('❌ Sayaç sistemi **kapatıldı**!');
        } else {
            return message.reply('Lütfen `!sayaç aç` veya `!sayaç kapat` şeklinde kullanın.');
        }
    }

    // 6. Merhaba / Selam Sistemi Komutu (!merhaba aç / kapat)
    if (command === '!merhaba') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('Bu komut için yönetici yetkisi gerekiyor.');
        }

        const secenek = args[0];
        if (secenek === 'aç') {
            merhabaDurumu.set(guild.id, true);
            return message.reply('✅ Merhaba / Selam sohbet yanıt sistemi **açıldı**!');
        } else if (secenek === 'kapat') {
            merhabaDurumu.set(guild.id, false);
            return message.reply('❌ Merhaba / Selam sohbet yanıt sistemi **kapatıldı**!');
        } else {
            return message.reply('Lütfen `!merhaba aç` veya `!merhaba kapat` şeklinde kullanın.');
        }
    }

    // 7. Sunucu Kurulum Sistemi (!sunucukur)
    if (command === '!sunucukur') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('Bu komutu kullanmak için Yönetici yetkisine sahip olmalısın.');
        }

        await message.reply('🛠️ Sunucu şablonu, roller ve odalar kuruluyor...');

        try {
            const yetkiliRol = await guild.roles.create({ name: '👑 • Yönetici', color: '#FF0000', permissions: [PermissionFlagsBits.Administrator] });
            const uyeRol = await guild.roles.create({ name: '👥 • Üye', color: '#00FF00' });
            const kayitsizRol = await guild.roles.create({ name: 'Kayıtsız', color: '#808080', permissions: [] });

            const kategori = await guild.channels.create({
                name: '📢 REGISTRATION & INFO',
                type: ChannelType.GuildCategory
            });

            await guild.channels.create({
                name: 'kayıt-odasi',
                type: ChannelType.GuildText,
                parent: kategori.id,
                permissionOverwrites: [
                    { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: kayitsizRol.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                    { id: yetkiliRol.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
                ]
            });

            await guild.channels.create({
                name: '「📃」kurallar',
                type: ChannelType.GuildText,
                parent: kategori.id
            });

            await message.channel.send('🎉 Sunucu şablonu başarıyla kuruldu!');
        } catch (error) {
            console.error(error);
            await message.channel.send('Kurulum sırasında hata oluştu. Botun yönetici yetkisini kontrol edin.');
        }
    }

    // 8. Kural Metni Gönderme (!kuralkoy)
    if (command === '!kuralkoy') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('Bu komut için yönetici yetkisi gerekiyor.');
        }

        const kuralMetni = 
`1. ALLAH' A, Peygambere, dine, aileye, aşırı kaçan küfürler ve zorbalıklar kesinlikle yasaktır.
2. Rolünüzün üstündeki insanlara ve altındaki insanlara eşit davranmak zorundasınız.
3. +18 paylaşım, kızları rahatsız eden paylaşımlar ve kadın düşmanlığı yasak.
4. Emir ve kurallara uymayanlar din konusunda kalıcı ban onun dışında uyarı alır 3. Uyarıda kişi banlanır. Fakat bunu fırsat bilip aynı hatayı yaptığı tespit edilirse kaç uyarı hakkı kalırsa kalsın banlanacaktır.
5. Kurallara uymak zorundadır saygı ve sevgi çerçevesinde güzelce muhabbet edin abartı olmayacak şekilde küfürde edebilirsiniz, Şimdiden eğlenceler.`;

        await message.channel.send(`\`\`\`text\n${kuralMetni}\n\`\`\`\n@everyone`);
        await message.delete().catch(() => {});
    }

    // 9. Herkese Rol Verme Sistemi (!herkeserol @Rol)
    if (command === '!herkeserol') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('Bu komut için Yönetici yetkisine sahip olmalısın.');
        }

        const hedefRol = message.mentions.roles.first();
        if (!hedefRol) {
            return message.reply('Lütfen herkese vermek istediğin rolü etiketle. Örn: `!herkeserol @Üye`');
        }

        await message.reply(`⏳ Sunucudaki herkese **${hedefRol.name}** rolü dağıtılmaya başlandı, lütfen bekleyin...`);

        try {
            await guild.members.fetch();
            let sayac = 0;

            for (const [id, member] of guild.members.cache) {
                if (!member.user.bot && !member.roles.cache.has(hedefRol.id)) {
                    await member.roles.add(hedefRol).catch(() => {});
                    sayac++;
                }
            }

            await message.channel.send(`✅ İşlem tamamlandı! Toplam **${sayac}** üyeye ${hedefRol} rolü verildi.`);
        } catch (error) {
            console.error(error);
            await message.reply('Roller dağıtılırken bir hata oluştu.');
        }
    }

    // 10. Kayıt Sistemi (!kaydet @kullanici @Rol)
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
            const kayitsizRol = guild.roles.cache.find(r => r.name === 'Kayıtsız');
            if (kayitsizRol && hedefUye.roles.cache.has(kayitsizRol.id)) {
                await hedefUye.roles.remove(kayitsizRol);
            }

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

    // --- Otomatik Sohbet Yanıt Sistemleri (Sadece sistemler AÇIKsa çalışır) ---

    // Küfür Engel Kontrolü
    if (kufurEngelDurumu.get(guild.id)) {
        if (kufurKontrolEt(message.content)) {
            try {
                await message.delete();
                const uyari = await message.channel.send(`${message.author}, bu sunucuda küfür ve argo kullanmak yasak! 🚫`);
                setTimeout(() => uyari.delete().catch(() => {}), 4000);
                return;
            } catch (e) {
                console.error("Mesaj silinemedi:", e);
            }
        }
    }

    // Merhaba / Selam Sohbet Yanıt Sistemi
    if (merhabaDurumu.get(guild.id)) {
        if (icerikKucuk.includes('selamün aleyküm') || icerikKucuk.includes('selamun aleykum') || icerikKucuk.includes('selamun aleyküm')) {
            return message.reply(`Aleyküm Selam ${message.author}!`);
        } else if (icerikKucuk.includes('selam') || icerikKucuk.includes('slm')) {
            return message.reply(`Aleyküm Selam ${message.author}!`);
        } else if (icerikKucuk.includes('merhaba') || icerikKucuk.includes('mrb')) {
            return message.reply(`Merhaba ${message.author}!`);
        } else if (icerikKucuk.includes('nasılsın') || icerikKucuk.includes('nasılsınız') || icerikKucuk.includes('naber')) {
            return message.reply(`Allah'a şükür sen ${message.author}?`);
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
