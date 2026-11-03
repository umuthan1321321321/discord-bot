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

// Ayarlar ve Hafızalar
const kufurEngelDurumu = new Map();
const reklamEngelDurumu = new Map();
const hosgeldinDurumu = new Map();
const sayacDurumu = new Map();
const merhabaDurumu = new Map();

// Küfür/Argo Listesi ("sik" kelimesi eklendi, ancak akıllı filtre "bisiklet" gibi kelimeleri korur)
const kufurListesi = [
    "amk", "aq", "orospu", "oç", "sik", "sikerim", "anan", "piç", "kahpe", 
    "göt", "yarrak", "amcık", "orospi", "o.ç", "siktir", "sikik", "ananı", 
    "sg", "ibne", "yarak", "orospuçocuğu"
];

function kufurKontrolEt(metin) {
    const temizMetin = metin.toLowerCase();
    const kelimeler = temizMetin.replace(/[^a-zçğİıöşü\s]/g, '').split(/\s+/);
    
    return kelimeler.some(kelime => {
        // "bisiklet", "sıkıntı", "sikke" gibi masum kelimeleri kesinlikle engelleme
        if (kelime === "bisiklet" || kelime === "bisikletler" || kelime.includes("sıkıntı") || kelime.includes("sikke")) {
            return false;
        }
        // Küfür listesindeki kelimelerle tam veya içeren eşleşme kontrolü
        return kufurListesi.some(kufur => kelime === kufur || (kelime.includes(kufur) && kufur.length > 2));
    });
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
        const sohbetKanali = guild.channels.cache.find(c => c.name.includes('sohbet') && c.type === ChannelType.GuildText);
        const sohbetEtiket = sohbetKanali ? `<#${sohbetKanali.id}>` : '#sohbet';

        if (sayacKanal) {
            sayacKanal.send(`Hoş geldin ${member} seninle beraber ${guild.memberCount} kişiyiz! Hadi durma sohbete ${sohbetEtiket}`).catch(err => console.error("Sayaç mesajı atılamadı:", err));
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

    // 1. !yardım Komutu
    if (command === '!yardım') {
        const yardimMesaji = `🤖 **Bot Komutları Menüsü**
• \`!küfür-engel aç / kapat\` - Küfür ve argo engel sistemini yönetir.
• \`!reklamengel aç / kapat\` - Sunucu davet linklerini ve web sitelerini engeller.
• \`!sunucuhoşgeldin aç / kapat\` - Yeni gelenlere özel kanal üzerinden hoş geldin mesajı atar.
• \`!sayaç aç / kapat\` - Yeni üye katıldığında sayaç kanalına üye sayısını ve sohbet etiketini bildirir.
• \`!merhaba aç / kapat\` - Selam, merhaba veya nasılsın diyenlere otomatik yanıt verir.
• \`!sunucukur\` - Temel sunucu rollerini ve odalarını otomatik kurar.
• \`!kanalizinsifirla\` - Roller silinmeden, tüm kanallardaki özel rol izinlerini sıfırlar ve sadece @everyone bırakır.
• \`!kuralkoy\` - Resmi kural metnini kutucuk içinde ve @everyone etiketiyle gönderir.
• \`!herkeserol @Rol\` - Sunucudaki herkese etiketlenen rolü toplu şekilde dağıtır.
• \`!kaydet @kullanici @Rol\` - Kullanıcının kayıtsız rolünü alır, yeni rolünü ve @Üye rolünü verir.
• \`!roldeğiş @kullanici @rol\` - Kullanıcının mevcut rolünü değiştirerek yeni rolü verir.
• \`!ban @kullanici [sebep]\` - Kullanıcıyı sunucudan kalıcı olarak yasaklar.
• \`!kick @kullanici [sebep]\` - Kullanıcıyı sunucudan atar.
• \`!mute @kullanici [dakika] [sebep]\` - Kullanıcıyı metin kanallarında susturur.
• \`!temizle [1-100]\` - Kanaldaki belirtilen miktardaki mesajı toplu siler.
• \`!üyebilgi @kullanici\` - Kullanıcının sunucuya katılım tarihini ve süresini gösterir.
• \`!sesegir #kanal\` - Botun belirtilen ses kanalında sabit kalmasını sağlar.
• \`!sestençık\` - Botu ses kanalından çıkarır.
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
            return message.reply('Bu komut için Yönetici yetkisine sahip olmalısın.');
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

    // 4. Reklam Engel Sistemi (!reklamengel aç / kapat)
    if (command === '!reklamengel') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('Bu komut için Yönetici yetkisine sahip olmalısın.');
        }

        const secenek = args[0];
        if (secenek === 'aç') {
            reklamEngelDurumu.set(guild.id, true);
            return message.reply('✅ Reklam engel sistemi **açıldı**!');
        } else if (secenek === 'kapat') {
            reklamEngelDurumu.set(guild.id, false);
            return message.reply('❌ Reklam engel sistemi **kapatıldı**!');
        } else {
            return message.reply('Lütfen `!reklamengel aç` veya `!reklamengel kapat` şeklinde kullanın.');
        }
    }

    // 5. Sunucu Hoş Geldin Sistemi (!sunucuhoşgeldin aç / kapat)
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

    // 6. Sayaç Sistemi Komutu (!sayaç aç / kapat)
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

    // 7. Merhaba / Selam Sistemi Komutu (!merhaba aç / kapat)
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

    // 8. Sunucu Kurulum Sistemi (!sunucukur)
    if (command === '!sunucukur') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('Bu komutu kullanmak için Yönetici yetkisine sahip olmalısın.');
        }

        await message.reply('🛠️ Sunucu şablonu, roller ve odalar kuruluyor...');

        try {
            const yetkiliRol = await guild.roles.create({ name: '👑 • Yönetici', color: '#FF0000', permissions: [PermissionFlagsBits.Administrator] });
            const uyeRol = await guild.roles.create({ name: 'Üye', color: '#00FF00' });
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

    // 9. Kural Metni Gönderme (!kuralkoy)
    if (command === '!kuralkoy') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('Bu komut için yönetici yetkisi gerekiyor.');
        }

        const kuralMetni = 
`1. ALLAH' A, Peygambere, dine, aileye, aşırı kaçan küfürler ve zorbalıklar kesinlikle yasaktır.
2. Rolünüzün üstündeki insanlara ve altındaki insanlara eşit davranmak zorundadır.
3. +18 paylaşım, kızları rahatsız eden paylaşımlar ve kadın düşmanlığı yasak.
4. Emir ve kurallara uymayanlar din konusunda kalıcı ban onun dışında uyarı alır 3. Uyarıda kişi banlanır. Fakat bunu fırsat bilip aynı hatayı yaptığı tespit edilirse kaç uyarı hakkı kalırsa kalsın banlanacaktır.
5. Kurallara uymak zorundadır saygı ve sevgi çerçevesinde güzelce muhabbet edin abartı olmayacak şekilde küfürde edebilirsiniz, Şimdiden eğlenceler.`;

        await message.channel.send(`\`\`\`text\n${kuralMetni}\n\`\`\`\n@everyone`);
        await message.delete().catch(() => {});
    }

    // 10. Herkese Rol Verme Sistemi (!herkeserol @Rol)
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

    // 11. Kayıt Sistemi (!kaydet @kullanici @Rol)
    if (command === '!kaydet') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
            return message.reply('Bu komutu kullanmak için yetkin yok.');
        }

        const hedefUye = message.mentions.members.first();
        const verilecekRol = message.mentions.roles.first();

        if (!hedefUye) {
            return message.reply('Lütfen kaydedilecek kişiyi etiketleyin. Örn: `!kaydet @kullanici @Rol`');
        }

        try {
            const kayitsizRol = guild.roles.cache.find(r => r.name === 'Kayıtsız');
            if (kayitsizRol && hedefUye.roles.cache.has(kayitsizRol.id)) {
                await hedefUye.roles.remove(kayitsizRol);
            }

            if (verilecekRol) {
                await hedefUye.roles.add(verilecekRol);
            }

            const uyeRol = guild.roles.cache.find(r => r.name === 'Üye');
            if (uyeRol) {
                await hedefUye.roles.add(uyeRol);
            }

            await message.channel.send(`✨ ${hedefUye} başarıyla kaydedildi!`);

            const hedefKanalID = '1564305393880928328';
            const ozelKanal = guild.channels.cache.get(hedefKanalID);
            if (ozelKanal) {
                await ozelKanal.send(`Hoş geldin ${hedefUye} nasılsın?`);
            }

        } catch (error) {
            console.error(error);
            await message.reply('Kayıt işlemi sırasında bir hata oluştu.');
        }
    }

    // 12. Rol Değiş Sistemi (!roldeğiş @kullanici @rol)
    if (command === '!roldeğiş') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
            return message.reply('Bu komutu kullanmak için yetkin yok.');
        }

        const hedefUye = message.mentions.members.first();
        const yeniRol = message.mentions.roles.first();

        if (!hedefUye || !yeniRol) {
            return message.reply('Lütfen kullanıcıyı ve verilecek yeni rolü etiketleyin. Örn: `!roldeğiş @kullanici @rol`');
        }

        try {
            await hedefUye.roles.add(yeniRol);
            await message.channel.send(`✅ ${hedefUye} adlı kullanıcıya başarıyla ${yeniRol} rolü eklendi!`);
        } catch (error) {
            console.error(error);
            await message.reply('Rol değiştirilirken bir hata oluştu.');
        }
    }

    // 13. Ban Sistemi (!ban @kullanici sebep)
    if (command === '!ban') {
        if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
            return message.reply('Bu komut için Üyeleri Yasakla yetkisine sahip olmalısın.');
        }

        const hedefUye = message.mentions.members.first();
        const sebep = args.slice(1).join(' ') || 'Belirtilmedi';

        if (!hedefUye) {
            return message.reply('Lütfen banlanacak kullanıcıyı etiketleyin. Örn: `!ban @kullanici küfür`');
        }

        try {
            await hedefUye.ban({ reason: sebep });
            await message.channel.send(`🔨 **${hedefUye.user.tag}** sunucudan yasaklandı! Sebep: *${sebep}*`);
        } catch (error) {
            console.error(error);
            await message.reply('Kullanıcı banlanırken bir hata oluştu (Botun yetkisi yetersiz olabilir).');
        }
    }

    // 14. Kick Sistemi (!kick @kullanici sebep)
    if (command === '!kick') {
        if (!message.member.permissions.has(PermissionFlagsBits.KickMembers)) {
            return message.reply('Bu komut için Üyeleri At yetkisine sahip olmalısın.');
        }

        const hedefUye = message.mentions.members.first();
        const sebep = args.slice(1).join(' ') || 'Belirtilmedi';

        if (!hedefUye) {
            return message.reply('Lütfen atılacak kullanıcıyı etiketleyin. Örn: `!kick @kullanici`');
        }

        try {
            await hedefUye.kick(sebep);
            await message.channel.send(`👢 **${hedefUye.user.tag}** sunucudan atıldı! Sebep: *${sebep}*`);
        } catch (error) {
            console.error(error);
            await message.reply('Kullanıcı atılırken bir hata oluştu.');
        }
    }

    // 15. Mute Sistemi (!mute @kullanici dakika)
    if (command === '!mute') {
        if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
            return message.reply('Bu komut için Üyeleri Zaman Aşımına Uğrat yetkin yok.');
        }

        const hedefUye = message.mentions.members.first();
        const dakika = parseInt(args[1]) || 5;

        if (!hedefUye) {
            return message.reply('Lütfen susturulacak kullanıcıyı etiketleyin. Örn: `!mute @kullanici 10`');
        }

        try {
            await hedefUye.timeout(dakika * 60 * 1000, 'Mute komutu kullanıldı.');
            await message.channel.send(`🔇 **${hedefUye}** adlı kullanıcı ${dakika} dakika süreyle susturuldu.`);
        } catch (error) {
            console.error(error);
            await message.reply('Kullanıcı susturulurken hata oluştu.');
        }
    }

    // 16. Mesaj Temizleme Sistemi (!temizle 50)
    if (command === '!temizle') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
            return message.reply('Bu komut için Mesajları Yönet yetkisine sahip olmalısın.');
        }

        const miktar = parseInt(args[0]);
        if (!miktar || miktar < 1 || miktar > 100) {
            return message.reply('Lütfen 1 ile 100 arasında bir sayı belirtin. Örn: `!temizle 50`');
        }

        try {
            await message.channel.bulkDelete(miktar, true);
            const bilgi = await message.channel.send(`🧹 Başarıyla **${miktar}** adet mesaj silindi.`);
            setTimeout(() => bilgi.delete().catch(() => {}), 3000);
        } catch (error) {
            console.error(error);
            await message.reply('Mesajlar silinirken bir hata oluştu (14 günden eski mesajlar silinemez).');
        }
    }

  
    if (command === '!üyebilgi') {
        const hedefUye = message.mentions.members.first() || message.member;
        
        const katilimTarihi = hedefUye.joinedAt;
        const gunFarki = Math.floor((Date.now() - katilimTarihi.getTime()) / (1000 * 60 * 60 * 24));
        
        const tarihFormatli = `${String(katilimTarihi.getDate()).padStart(2, '0')}/${String(katilimTarihi.getMonth() + 1).padStart(2, '0')}/${katilimTarihi.getFullYear()} - ${String(katilimTarihi.getHours()).padStart(2, '0')}:${String(katilimTarihi.getMinutes()).padStart(2, '0')}`;

        await message.channel.send(`📌 ${hedefUye} Kullanıcısı şu saatte: **${tarihFormatli}** sunucuya katıldı, **${gunFarki}** gündür sunucuda. Onu aramızda görmekten mutluyuz!`);
    }

    // 18. Ses Kanalı Sabitleme (!sesegir #kanal / !sestençık)
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
            await message.reply(`🔊 Başarıyla **${sesKanalı.name}** ses kanalına giriş yapıldı ve sabitlendi!`);
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

    // --- Otomatik Sohbet Filtreleme ve Yanıt Sistemleri ---

    // 1. Reklam Engel Sistemi (Eğer açıksa)
    if (reklamEngelDurumu.get(guild.id)) {
        if (message.content.includes('discord.gg/') || message.content.includes('https://') || message.content.includes('http://')) {
            try {
                await message.delete();
                const uyari = await message.channel.send(`${message.author}, bu sunucuda reklam yapmak yasak! 🚫`);
                setTimeout(() => uyari.delete().catch(() => {}), 4000);
                return;
            } catch (e) {
                console.error("Reklam mesajı silinemedi:", e);
            }
        }
    }

    // 2. Küfür Engel Kontrolü (Eğer açıksa)
    if (kufurEngelDurumu.get(guild.id)) {
        if (kufurKontrolEt(message.content)) {
            try {
                await message.delete();
                const uyari = await message.channel.send(`${message.author}, bu sunucuda küfür ve argo kullanmak yasak! 🚫`);
                setTimeout(() => uyari.delete().catch(() => {}), 4000);
                return;
            } catch (e) {
                console.error("Küfür mesajı silinemedi:", e);
            }
        }
    }

    // 3. Merhaba / Selam Sohbet Yanıt Sistemi (Eğer açıksa)
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
