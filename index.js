const {
    Client,
    GatewayIntentBits,
    ChannelType,
    PermissionFlagsBits,
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
    SlashCommandBuilder,
    ActivityType
} = require('discord.js');
const { joinVoiceChannel, getVoiceConnection } = require('@discordjs/voice');
const express = require('express');
const fs = require('fs');
const path = require('path');

// ==========================================
// 🌐 1. WEB SUNUCUSU (7/24 UPTIME & DURUM PANELİ)
// ==========================================
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="tr">
        <head>
            <meta charset="UTF-8">
            <title>Bot Durum Paneli</title>
            <style>
                body { background: #0f172a; color: #f8fafc; font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
                .card { background: #1e293b; padding: 2rem 3rem; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); text-align: center; border: 1px solid #334155; }
                .status { color: #22c55e; font-weight: bold; font-size: 1.2rem; }
            </style>
        </head>
        <body>
            <div class="card">
                <h1>🚀 Discord Bot Aktif!</h1>
                <p class="status">● Sistem 7/24 Sorunsuz Çalışıyor</p>
            </div>
        </body>
        </html>
    `);
});

app.listen(port, () => {
    console.log(`[WEB] Sunucu ${port} portunda aktif edildi.`);
});

// ==========================================
// 💾 2. KALICI VERİTABANI SİSTEMİ (JSON)
// ==========================================
const dbDosyasi = path.join(__dirname, 'settings.json');

function veritabaniOku() {
    try {
        if (!fs.existsSync(dbDosyasi)) {
            fs.writeFileSync(dbDosyasi, JSON.stringify({}, null, 2));
            return {};
        }
        return JSON.parse(fs.readFileSync(dbDosyasi, 'utf8'));
    } catch (e) {
        console.error('[DB] Veritabanı okuma hatası:', e);
        return {};
    }
}

function veritabaniYaz(veri) {
    try {
        fs.writeFileSync(dbDosyasi, JSON.stringify(veri, null, 2));
    } catch (e) {
        console.error('[DB] Veritabanı yazma hatası:', e);
    }
}

function sunucuAyarAl(guildId) {
    const db = veritabaniOku();
    if (!db[guildId]) {
        db[guildId] = {
            kufurEngel: false,
            hosgeldinAktif: false,
            hosgeldinKanalId: '1564306973841821788', // Varsayılan kanal ID
            sesKanalId: null
        };
        veritabaniYaz(db);
    }
    return db[guildId];
}

function sunucuAyarGuncelle(guildId, yeniAyarlar) {
    const db = veritabaniOku();
    db[guildId] = { ...sunucuAyarAl(guildId), ...yeniAyarlar };
    veritabaniYaz(db);
    return db[guildId];
}

// ==========================================
// 🤖 3. BOT İSTEMCİSİ VE TASARIM SABİTLERİ
// ==========================================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates
    ]
});

const RENKLER = {
    ANA: 0x5865F2,      // Discord Blurple
    BASARILI: 0x2ECC71, // Zümrüt Yeşili
    HATA: 0xE74C3C,     // Mercan Kırmızısı
    UYARI: 0xF1C40F,    // Altın Sarısı
    BILGI: 0x3498DB     // Gök Mavisi
};

function embedOlustur({ baslik, aciklama, renk = RENKLER.ANA, alanlar = [], footer = null, thumbnail = null }) {
    const embed = new EmbedBuilder()
        .setColor(renk)
        .setTimestamp();

    if (baslik) embed.setTitle(baslik);
    if (aciklama) embed.setDescription(aciklama);
    if (alanlar.length > 0) embed.addFields(alanlar);
    if (thumbnail) embed.setThumbnail(thumbnail);
    embed.setFooter({
        text: footer || `${client.user ? client.user.username : 'Moderasyon'} • Kaliteli Yönetim Sistemi`,
        iconURL: client.user ? client.user.displayAvatarURL() : undefined
    });

    return embed;
}

// Gelişmiş Küfür ve Argo Filtresi
const kufurListesi = [
    "amk", "aq", "orospu", "oç", "sik", "sikerim", "anan", "piç", "kahpe",
    "göt", "yarrak", "amcık", "orospi", "o.ç", "siktir", "sikik", "ananı",
    "sg", "ibne", "yarak", "orospuçocuğu", "pezevenk", "gavat", "yavşak"
];

function kufurKontrolEt(metin) {
    const kucukMetin = metin.toLowerCase();
    // Kelime bazlı ve birleşik yazı kontrolü
    const kelimeler = kucukMetin.replace(/[^a-zçğıöşü0-9\s]/g, '').split(/\s+/);
    const tekrarTemizlenmis = kucukMetin.replace(/(.)\1+/g, '$1').replace(/[^a-zçğıöşü]/g, '');

    if (kelimeler.some(kelime => kufurListesi.includes(kelime))) return true;
    const agirKufurler = ["orospu", "sikerim", "siktir", "yarrak", "amcık", "kahpe", "pezevenk"];
    return agirKufurler.some(kufur => tekrarTemizlenmis.includes(kufur));
}

// ==========================================
// ⚡ 4. SLASH KOMUT TANIMLARI (/yardim vb.)
// ==========================================
const slashKomutlari = [
    new SlashCommandBuilder()
        .setName('yardim')
        .setDescription('📖 Botun tüm komutlarını ve etkileşimli yardım menüsünü gösterir.'),

    new SlashCommandBuilder()
        .setName('kufur-engel')
        .setDescription('🛡️ Küfür ve argo engelleme sistemini açar veya kapatır.')
        .addStringOption(opt =>
            opt.setName('durum')
                .setDescription('Sistem durumu')
                .setRequired(true)
                .addChoices({ name: '🟢 Aç', value: 'aç' }, { name: '🔴 Kapat', value: 'kapat' })
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
        .setName('hosgeldin')
        .setDescription('👋 Hoş geldin mesaj sistemini ve kanalını ayarlar.')
        .addStringOption(opt =>
            opt.setName('durum')
                .setDescription('Sistem durumu')
                .setRequired(true)
                .addChoices({ name: '🟢 Aç', value: 'aç' }, { name: '🔴 Kapat', value: 'kapat' })
        )
        .addChannelOption(opt =>
            opt.setName('kanal')
                .setDescription('Mesajların gönderileceği kanal (Boş bırakılırsa varsayılan kanal kullanılır)')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
        .setName('kaydet')
        .setDescription('✨ Üyeyi kayıt eder, kayıtsız rolünü alır ve yeni rol/isim verir.')
        .addUserOption(opt => opt.setName('uye').setDescription('Kaydedilecek üye').setRequired(true))
        .addRoleOption(opt => opt.setName('rol').setDescription('Verilecek rol').setRequired(false))
        .addStringOption(opt => opt.setName('isim').setDescription('Üyenin yeni sunucu ismi (İsteğe bağlı)').setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

    new SlashCommandBuilder()
        .setName('herkeserol')
        .setDescription('🎭 Sunucudaki tüm bot olmayan üyelere belirtilen rolü dağıtır.')
        .addRoleOption(opt => opt.setName('rol').setDescription('Dağıtılacak rol').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
        .setName('kuralkoy')
        .setDescription('📜 Bulunulan kanala profesyonel sunucu kuralları tablosunu gönderir.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
        .setName('sunucukur')
        .setDescription('🏗️ Sunucu için gerekli temel rolleri, kategorileri ve odaları otomatik kurar.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
        .setName('ses')
        .setDescription('🔊 Botu ses kanalına bağlar veya çıkarır.')
        .addStringOption(opt =>
            opt.setName('islem')
                .setDescription('Yapılacak işlem')
                .setRequired(true)
                .addChoices({ name: '🔊 Ses Kanalına Gir', value: 'gir' }, { name: '🛑 Ses Kanalından Çık', value: 'cik' })
        )
        .addChannelOption(opt =>
            opt.setName('kanal')
                .setDescription('Girilecek ses kanalı')
                .addChannelTypes(ChannelType.GuildVoice)
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
        .setName('temizle')
        .setDescription('🧹 Sohbet kanalında belirtilen miktarda mesajı siler (1-100).')
        .addIntegerOption(opt =>
            opt.setName('miktar')
                .setDescription('Silinecek mesaj sayısı (1-100)')
                .setMinValue(1)
                .setMaxValue(100)
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    new SlashCommandBuilder()
        .setName('sunucu-bilgi')
        .setDescription('📊 Sunucunun detaylı istatistiklerini ve sistem durumlarını gösterir.')
].map(cmd => cmd.toJSON());

// ==========================================
// 🚀 5. BOT HAZIR OLDUĞUNDA (READY EVENT)
// ==========================================
client.once('ready', async () => {
    console.log(`✅ [BOT] Giriş yapıldı: ${client.user.tag}`);

    client.user.setPresence({
        activities: [{ name: '/yardim | !yardım • 7/24 Aktif 🛡️', type: ActivityType.Watching }],
        status: 'online'
    });

    try {
        await client.application.commands.set(slashKomutlari);
        console.log('⚡ [SLASH] Tüm /komutlar başarıyla yüklendi!');
    } catch (error) {
        console.error('❌ [SLASH] Komut yükleme hatası:', error);
    }

    // Daha önce sabitlenmiş ses kanallarına otomatik bağlan
    const db = veritabaniOku();
    for (const [guildId, ayar] of Object.entries(db)) {
        if (ayar.sesKanalId) {
            const guild = client.guilds.cache.get(guildId);
            const kanal = guild?.channels.cache.get(ayar.sesKanalId);
            if (guild && kanal && kanal.type === ChannelType.GuildVoice) {
                try {
                    joinVoiceChannel({
                        channelId: kanal.id,
                        guildId: guild.id,
                        adapterCreator: guild.voiceAdapterCreator,
                        selfDeaf: false,
                        selfMute: true
                    });
                } catch (e) {
                    console.error(`[SES] ${guild.name} ses kanalına yeniden bağlanılamadı.`);
                }
            }
        }
    }
});

// ==========================================
// 👋 6. YENİ ÜYE KATILIM SİSTEMİ (OTOROL & HOŞ GELDİN)
// ==========================================
client.on('guildMemberAdd', async member => {
    const guild = member.guild;
    const ayar = sunucuAyarAl(guild.id);

    // 1. Otomatik Kayıtsız Rolü
    let kayitsizRol = guild.roles.cache.find(r => r.name === 'Kayıtsız');
    if (!kayitsizRol) {
        try {
            kayitsizRol = await guild.roles.create({
                name: 'Kayıtsız',
                color: '#808080',
                permissions: [],
                reason: 'Otomatik Kayıtsız Rolü Sistemi'
            });
        } catch (e) {
            console.error('[OTOROL] Kayıtsız rolü oluşturulamadı:', e);
        }
    }

    if (kayitsizRol) {
        await member.roles.add(kayitsizRol).catch(err => console.error('[OTOROL] Rol verme hatası:', err));
    }

    // 2. Zengin Hoş Geldin Kartı
    if (ayar.hosgeldinAktif) {
        const kanal = guild.channels.cache.get(ayar.hosgeldinKanalId);
        const sohbetKanali = guild.channels.cache.find(c => c.name.includes('sohbet') && c.type === ChannelType.GuildText);
        const kurallarKanali = guild.channels.cache.find(c => c.name.includes('kural') && c.type === ChannelType.GuildText);

        const sohbetEtiket = sohbetKanali ? `<#${sohbetKanali.id}>` : '`#sohbet`';
        const kurallarEtiket = kurallarKanali ? `<#${kurallarKanali.id}>` : '`#kurallar`';

        if (kanal) {
            const hosgeldinEmbed = embedOlustur({
                baslik: `🎉 Aramıza Hoş Geldin, ${member.user.username}!`,
                aciklama: `Selam ${member}! **${guild.name}** sunucusuna hoş geldin.\nSeninle birlikte **${guild.memberCount}** kişilik dev bir aile olduk! 🚀\n\n👉 Kuralları okumak için: ${kurallarEtiket}\n💬 Sohbete katılmak için: ${sohbetEtiket}`,
                renk: RENKLER.BASARILI,
                thumbnail: member.user.displayAvatarURL({ dynamic: true, size: 256 }),
                alanlar: [
                    { name: '👤 Kullanıcı', value: `${member.user.tag}\n(\`${member.id}\`)`, inline: true },
                    { name: '📅 Hesap Kuruluşu', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
                    { name: '🎭 Verilen Rol', value: kayitsizRol ? `${kayitsizRol}` : '`Kayıtsız`', inline: true }
                ]
            });

            kanal.send({ content: `Selam ${member}, aramıza hoş geldin! Sohbet etmeye başla: ${sohbetEtiket}`, embeds: [hosgeldinEmbed] })
                .catch(err => console.error('[HOŞGELDİN] Mesaj gönderilemedi:', err));
        }
    }
});

// ==========================================
// 📖 7. YARDIM MENÜSÜ OLUŞTURUCU (/yardim & !yardım)
// ==========================================
function yardimMenusuOlustur(guild) {
    const ayar = sunucuAyarAl(guild.id);

    const anaEmbed = embedOlustur({
        baslik: `✨ ${guild.name} • Gelişmiş Komut ve Yardım Merkezi`,
        aciklama: `Merhaba! Botumuz hem modern **Slash (\`/\`)** komutlarını hem de klasik **Prefix (\`!\`)** komutlarını desteklemektedir.\n\nAşağıdaki **açılır menüyü** kullanarak kategoriler arasında geçiş yapabilir ve komutların detaylı kullanımlarını inceleyebilirsiniz.`,
        renk: RENKLER.ANA,
        thumbnail: guild.iconURL({ dynamic: true }),
        alanlar: [
            {
                name: '🛡️ Sistem Durum Özeti',
                value: `> **Küfür Engel:** ${ayar.kufurEngel ? '🟢 `Aktif`' : '🔴 `Kapalı`'}\n> **Hoş Geldin Sistemi:** ${ayar.hosgeldinAktif ? `🟢 \`Aktif\` (<#${ayar.hosgeldinKanalId}>)` : '🔴 `Kapalı`'}\n> **Ses Sabitleme:** ${ayar.sesKanalId ? `🔊 <#${ayar.sesKanalId}>` : '🔇 `Bağlı Değil`'}`
            },
            {
                name: '📌 Hızlı Komut Özeti',
                value: '`/yardim` • `/kaydet` • `/kufur-engel` • `/hosgeldin` • `/herkeserol` • `/sunucukur` • `/kuralkoy` • `/ses` • `/temizle` • `/sunucu-bilgi`'
            }
        ]
    });

    const menuSatiri = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('yardim_kategori_sec')
            .setPlaceholder('📂 İncelemek istediğiniz komut kategorisini seçin...')
            .addOptions([
                { label: 'Ana Sayfa & Sistem Özeti', description: 'Genel görünüm ve aktif sistem durumları', value: 'ana_sayfa', emoji: '🏠' },
                { label: 'Moderasyon & Güvenlik', description: 'Küfür engel, mesaj temizleme ve kural komutları', value: 'moderasyon', emoji: '🛡️' },
                { label: 'Kayıt & Rol Yönetimi', description: 'Üye kaydetme, otorol ve toplu rol dağıtma', value: 'kayit', emoji: '🎭' },
                { label: 'Sunucu & Ses Sistemleri', description: 'Otomatik sunucu kurulumu, ses sabitleme ve bilgi', value: 'sunucu', emoji: '⚙️' }
            ])
    );

    return { embeds: [anaEmbed], components: [menuSatiri] };
}

// ==========================================
// 🛠️ 8. ORTAK KOMUT İŞLEYİCİ FONKSİYONLAR
// ==========================================
async function kuralGonder(kanal) {
    const kuralEmbed = embedOlustur({
        baslik: `📜 ${kanal.guild.name} • Resmi Sunucu Kuralları`,
        aciklama: `Sunucumuzda huzurlu, saygılı ve eğlenceli bir ortam sağlamak için aşağıdaki kurallara uymak zorunludur:`,
        renk: RENKLER.UYARI,
        thumbnail: kanal.guild.iconURL({ dynamic: true }),
        alanlar: [
            { name: '1️⃣ Dini, Milli ve Ailevi Değerler', value: 'ALLAH\'a, Peygambere, dine, aileye yönelik aşırı kaçan küfürler ve zorbalıklar **kesinlikle yasaktır**.' },
            { name: '2️⃣ Karşılıklı Saygı ve Eşitlik', value: 'Rolünüzün üstündeki ve altındaki tüm üyelere eşit ve saygılı davranmak zorunludur.' },
            { name: '3️⃣ +18 İçerik ve Rahatsızlık Yasağı', value: '+18 paylaşımlar, üyeleri/kızları rahatsız eden davranışlar ve kadın düşmanlığı kesinlikle yasaktır.' },
            { name: '4️⃣ Ceza ve Uyarı Sistemi', value: 'Dini değerlere hakaret **kalıcı ban** sebebidir. Diğer kural ihlallerinde uyarı verilir; **3. uyarıda** üye banlanır. Kötü niyetli tekrar tespitinde uyarı hakkına bakılmaksızın ban uygulanır.' },
            { name: '5️⃣ Sohbet Ortamı', value: 'Saygı ve sevgi çerçevesinde güzelce muhabbet edebilirsiniz. Abartıya kaçmayacak şekilde samimi sohbet serbesttir. Şimdiden iyi eğlenceler! 🎉' }
        ]
    });

    await kanal.send({ content: '||@everyone||', embeds: [kuralEmbed] });
}

async function sunucuKurulumuYap(guild, yanitFonksiyonu) {
    let yetkiliRol = guild.roles.cache.find(r => r.name === '👑 • Yönetici');
    if (!yetkiliRol) {
        yetkiliRol = await guild.roles.create({ name: '👑 • Yönetici', color: '#E74C3C', permissions: [PermissionFlagsBits.Administrator] });
    }

    let uyeRol = guild.roles.cache.find(r => r.name === '👥 • Üye');
    if (!uyeRol) {
        uyeRol = await guild.roles.create({ name: '👥 • Üye', color: '#2ECC71' });
    }

    let kayitsizRol = guild.roles.cache.find(r => r.name === 'Kayıtsız');
    if (!kayitsizRol) {
        kayitsizRol = await guild.roles.create({ name: 'Kayıtsız', color: '#95A5A6', permissions: [] });
    }

    // 1. Kayıt & Bilgi Kategorisi
    const kayitKategori = await guild.channels.create({
        name: '📢 • KAYIT & BİLGİ',
        type: ChannelType.GuildCategory
    });

    await guild.channels.create({
        name: '「🚪」kayıt-odası',
        type: ChannelType.GuildText,
        parent: kayitKategori.id,
        permissionOverwrites: [
            { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
            { id: kayitsizRol.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
            { id: yetkiliRol.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
        ]
    });

    const kurallarKanali = await guild.channels.create({
        name: '「📃」kurallar',
        type: ChannelType.GuildText,
        parent: kayitKategori.id,
        permissionOverwrites: [
            { id: guild.id, allow: [PermissionFlagsBits.ViewChannel], deny: [PermissionFlagsBits.SendMessages] }
        ]
    });

    await guild.channels.create({
        name: '「📢」duyurular',
        type: ChannelType.GuildText,
        parent: kayitKategori.id,
        permissionOverwrites: [
            { id: guild.id, allow: [PermissionFlagsBits.ViewChannel], deny: [PermissionFlagsBits.SendMessages] }
        ]
    });

    // 2. Genel Sohbet Kategorisi
    const sohbetKategori = await guild.channels.create({
        name: '💬 • GENEL SOHBET',
        type: ChannelType.GuildCategory
    });

    await guild.channels.create({
        name: '「💬」sohbet',
        type: ChannelType.GuildText,
        parent: sohbetKategori.id,
        permissionOverwrites: [
            { id: kayitsizRol.id, deny: [PermissionFlagsBits.ViewChannel] }
        ]
    });

    await guild.channels.create({
        name: '「🤖」bot-komut',
        type: ChannelType.GuildText,
        parent: sohbetKategori.id,
        permissionOverwrites: [
            { id: kayitsizRol.id, deny: [PermissionFlagsBits.ViewChannel] }
        ]
    });

    await guild.channels.create({
        name: '🔊 • Genel Ses',
        type: ChannelType.GuildVoice,
        parent: sohbetKategori.id
    });

    // Kurallar kanalına otomatik kuralları gönder
    await kuralGonder(kurallarKanali).catch(() => {});

    const basariEmbed = embedOlustur({
        baslik: '🎉 Sunucu Şablonu Başarıyla Kuruldu!',
        aciklama: 'Roller, kategoriler, metin ve ses kanalları izinleriyle birlikte oluşturuldu ve kurallar otomatik olarak yayınlandı.',
        renk: RENKLER.BASARILI,
        alanlar: [
            { name: '🎭 Roller', value: `${yetkiliRol}\n${uyeRol}\n${kayitsizRol}`, inline: true },
            { name: '📂 Kategoriler', value: '`📢 • KAYIT & BİLGİ`\n`💬 • GENEL SOHBET`', inline: true }
        ]
    });

    await yanitFonksiyonu(basariEmbed);
}

// ==========================================
// ⚡ 9. SLASH KOMUT & MENÜ ETKİLEŞİMLERİ
// ==========================================
client.on('interactionCreate', async interaction => {
    if (!interaction.guild) return;

    // A) Yardım Menüsü Kategori Seçimi
    if (interaction.isStringSelectMenu() && interaction.customId === 'yardim_kategori_sec') {
        const secim = interaction.values[0];

        if (secim === 'ana_sayfa') {
            const menu = yardimMenusuOlustur(interaction.guild);
            return interaction.update(menu);
        }

        const kategoriler = {
            moderasyon: {
                baslik: '🛡️ Moderasyon & Güvenlik Komutları',
                renk: RENKLER.UYARI,
                alanlar: [
                    { name: '🚫 `/kufur-engel [aç/kapat]` veya `!küfür-engel [aç/kapat]`', value: 'Sunucuda küfür ve argo kullanımını otomatik siler ve kullanıcıyı uyarır.' },
                    { name: '🧹 `/temizle [1-100]` veya `!sil [1-100]`', value: 'Sohbet kanalında belirtilen sayıda mesajı tek seferde temizler.' },
                    { name: '📜 `/kuralkoy` veya `!kuralkoy`', value: 'Bulunulan kanala şık bir tasarımla sunucu kurallarını gönderir.' }
                ]
            },
            kayit: {
                baslik: '🎭 Kayıt & Rol Yönetimi Komutları',
                renk: RENKLER.BASARILI,
                alanlar: [
                    { name: '✨ `/kaydet [@üye] [@rol] [isim]` veya `!kaydet @üye @rol İsim`', value: 'Üyeden `Kayıtsız` rolünü alır, belirtilen rolü verir ve isteğe bağlı olarak ismini günceller.' },
                    { name: '👋 `/hosgeldin [aç/kapat] [#kanal]` veya `!sunucuhoşgeldin [aç/kapat] [#kanal]`', value: 'Yeni katılan üyelere hoş geldin kartı gönderme sistemini ayarlar.' },
                    { name: '🎭 `/herkeserol [@rol]` veya `!herkeserol @rol`', value: 'Sunucudaki tüm üyelere (botlar hariç) seçilen rolü topluca dağıtır.' }
                ]
            },
            sunucu: {
                baslik: '⚙️ Sunucu & Ses Sistemleri Komutları',
                renk: RENKLER.BILGI,
                alanlar: [
                    { name: '🏗️ `/sunucukur` veya `!sunucukur`', value: 'Yönetici, Üye, Kayıtsız rollerini ve kayıt/sohbet/kural odalarını izinleriyle otomatik kurar.' },
                    { name: '🔊 `/ses [gir/cik] [#kanal]` veya `!sesegir #kanal` / `!sestençık`', value: 'Botu belirttiğiniz ses kanalına 7/24 sabitler veya sesten çıkarır.' },
                    { name: '📊 `/sunucu-bilgi` veya `!sunucubilgi`', value: 'Sunucunun üye, kanal, rol ve güvenlik istatistiklerini gösterir.' }
                ]
            }
        };

        const secilen = kategoriler[secim];
        if (secilen) {
            const kategoriEmbed = embedOlustur({
                baslik: secilen.baslik,
                aciklama: 'Komutları ister **`/` (Slash)** olarak ister **`!` (Ünlem)** ile kullanabilirsiniz:',
                renk: secilen.renk,
                alanlar: secilen.alanlar
            });
            return interaction.update({ embeds: [kategoriEmbed] });
        }
    }

    // B) Slash Komutları
    if (!interaction.isChatInputCommand()) return;
    const { commandName, guild } = interaction;

    if (commandName === 'yardim') {
        const menu = yardimMenusuOlustur(guild);
        return interaction.reply(menu);
    }

    if (commandName === 'kufur-engel') {
        const durum = interaction.options.getString('durum') === 'aç';
        sunucuAyarGuncelle(guild.id, { kufurEngel: durum });

        return interaction.reply({
            embeds: [embedOlustur({
                baslik: durum ? '🛡️ Küfür Engel Sistemi Aktif!' : '🔓 Küfür Engel Sistemi Kapatıldı!',
                aciklama: durum
                    ? 'Artık sunucuda yazılan küfür ve argo mesajlar otomatik olarak silinecek ve kullanıcı uyarılacaktır.'
                    : 'Küfür ve argo filtreleme sistemi devre dışı bırakıldı.',
                renk: durum ? RENKLER.BASARILI : RENKLER.HATA
            })]
        });
    }

    if (commandName === 'hosgeldin') {
        const durum = interaction.options.getString('durum') === 'aç';
        const secilenKanal = interaction.options.getChannel('kanal');
        const mevcutAyar = sunucuAyarAl(guild.id);
        const hedefKanalId = secilenKanal ? secilenKanal.id : mevcutAyar.hosgeldinKanalId;

        sunucuAyarGuncelle(guild.id, { hosgeldinAktif: durum, hosgeldinKanalId: hedefKanalId });

        return interaction.reply({
            embeds: [embedOlustur({
                baslik: durum ? '👋 Hoş Geldin Sistemi Aktif!' : '🔕 Hoş Geldin Sistemi Kapatıldı!',
                aciklama: durum
                    ? `Yeni katılan üyelere otomatik **Kayıtsız** rolü verilecek ve <#${hedefKanalId}> kanalına karşılama kartı gönderilecektir.`
                    : 'Hoş geldin mesaj sistemi devre dışı bırakıldı.',
                renk: durum ? RENKLER.BASARILI : RENKLER.HATA
            })]
        });
    }

    if (commandName === 'kaydet') {
        const hedefUye = interaction.options.getMember('uye');
        const verilecekRol = interaction.options.getRole('rol') || guild.roles.cache.find(r => r.name.includes('Üye'));
        const yeniIsim = interaction.options.getString('isim');

        if (!hedefUye) {
            return interaction.reply({ embeds: [embedOlustur({ baslik: '❌ Hata', aciklama: 'Kullanıcı sunucuda bulunamadı.', renk: RENKLER.HATA })], ephemeral: true });
        }

        try {
            const kayitsizRol = guild.roles.cache.find(r => r.name === 'Kayıtsız');
            if (kayitsizRol && hedefUye.roles.cache.has(kayitsizRol.id)) {
                await hedefUye.roles.remove(kayitsizRol);
            }
            if (verilecekRol) await hedefUye.roles.add(verilecekRol);
            if (yeniIsim) await hedefUye.setNickname(yeniIsim).catch(() => {});

            return interaction.reply({
                embeds: [embedOlustur({
                    baslik: '✨ Kayıt İşlemi Tamamlandı!',
                    aciklama: `${hedefUye} başarıyla sunucumuza kaydedildi!`,
                    renk: RENKLER.BASARILI,
                    thumbnail: hedefUye.user.displayAvatarURL({ dynamic: true }),
                    alanlar: [
                        { name: '👤 Kaydedilen Üye', value: `${hedefUye}`, inline: true },
                        { name: '🎭 Verilen Rol', value: verilecekRol ? `${verilecekRol}` : '`Sadece Kayıtsız Alındı`', inline: true },
                        { name: '👮 Kayıt Eden Yetkili', value: `${interaction.user}`, inline: true }
                    ]
                })]
            });
        } catch (err) {
            return interaction.reply({ embeds: [embedOlustur({ baslik: '❌ Yetki Hatası', aciklama: 'Botun rolü, işlem yapılmak istenen kullanıcının veya rolün altında kalıyor.', renk: RENKLER.HATA })], ephemeral: true });
        }
    }

    if (commandName === 'herkeserol') {
        const hedefRol = interaction.options.getRole('rol');
        await interaction.reply({
            embeds: [embedOlustur({
                baslik: '⏳ Toplu Rol Dağıtımı Başladı...',
                aciklama: `Sunucudaki tüm üyelere ${hedefRol} rolü dağıtılıyor. Lütfen bekleyin...`,
                renk: RENKLER.UYARI
            })]
        });

        try {
            await guild.members.fetch();
            let sayac = 0;
            for (const [, member] of guild.members.cache) {
                if (!member.user.bot && !member.roles.cache.has(hedefRol.id)) {
                    await member.roles.add(hedefRol).catch(() => {});
                    sayac++;
                }
            }

            await interaction.editReply({
                embeds: [embedOlustur({
                    baslik: '✅ Rol Dağıtımı Tamamlandı!',
                    aciklama: `Toplam **${sayac}** üyeye başarıyla ${hedefRol} rolü verildi.`,
                    renk: RENKLER.BASARILI
                })]
            });
        } catch (e) {
            await interaction.editReply({ embeds: [embedOlustur({ baslik: '❌ Hata', aciklama: 'Roller dağıtılırken bir hata oluştu.', renk: RENKLER.HATA })] });
        }
    }

    if (commandName === 'kuralkoy') {
        await interaction.reply({ content: '✅ Kurallar tablosu başarıyla gönderildi!', ephemeral: true });
        await kuralGonder(interaction.channel);
    }

    if (commandName === 'sunucukur') {
        await interaction.reply({
            embeds: [embedOlustur({ baslik: '🛠️ Sunucu Kuruluyor...', aciklama: 'Roller, kategoriler ve odalar oluşturuluyor, lütfen bekleyin...', renk: RENKLER.UYARI })]
        });
        try {
            await sunucuKurulumuYap(guild, async (embed) => {
                await interaction.editReply({ embeds: [embed] });
            });
        } catch (e) {
            await interaction.editReply({ embeds: [embedOlustur({ baslik: '❌ Kurulum Hatası', aciklama: 'Kurulum sırasında hata oluştu. Botun Yönetici yetkisini kontrol edin.', renk: RENKLER.HATA })] });
        }
    }

    if (commandName === 'ses') {
        const islem = interaction.options.getString('islem');
        if (islem === 'gir') {
            const kanal = interaction.options.getChannel('kanal') || interaction.member.voice.channel;
            if (!kanal || kanal.type !== ChannelType.GuildVoice) {
                return interaction.reply({ embeds: [embedOlustur({ baslik: '❌ Hata', aciklama: 'Lütfen bir ses kanalı seçin veya önce bir ses kanalına girin!', renk: RENKLER.HATA })], ephemeral: true });
            }

            joinVoiceChannel({
                channelId: kanal.id,
                guildId: guild.id,
                adapterCreator: guild.voiceAdapterCreator,
                selfDeaf: false,
                selfMute: true
            });
            sunucuAyarGuncelle(guild.id, { sesKanalId: kanal.id });

            return interaction.reply({
                embeds: [embedOlustur({
                    baslik: '🔊 Ses Kanalına Sabitlendi!',
                    aciklama: `Bot başarıyla **${kanal.name}** ses kanalına bağlandı ve 7/24 sabitlendi.`,
                    renk: RENKLER.BASARILI
                })]
            });
        } else {
            const conn = getVoiceConnection(guild.id);
            if (conn) conn.destroy();
            sunucuAyarGuncelle(guild.id, { sesKanalId: null });

            return interaction.reply({
                embeds: [embedOlustur({ baslik: '🛑 Sesten Çıkıldı', aciklama: 'Bot ses kanalından ayrıldı.', renk: RENKLER.HATA })]
            });
        }
    }

    if (commandName === 'temizle') {
        const miktar = interaction.options.getInteger('miktar');
        const silinen = await interaction.channel.bulkDelete(miktar, true).catch(() => null);
        if (!silinen) {
            return interaction.reply({ embeds: [embedOlustur({ baslik: '❌ Hata', aciklama: '14 günden eski mesajlar silinemez veya yetkim yetersiz.', renk: RENKLER.HATA })], ephemeral: true });
        }
        return interaction.reply({
            embeds: [embedOlustur({ baslik: '🧹 Sohbet Temizlendi!', aciklama: `Bu kanalda toplam **${silinen.size}** adet mesaj başarıyla silindi.`, renk: RENKLER.BASARILI })],
            ephemeral: true
        });
    }

    if (commandName === 'sunucu-bilgi') {
        const ayar = sunucuAyarAl(guild.id);
        return interaction.reply({
            embeds: [embedOlustur({
                baslik: `📊 ${guild.name} • Sunucu İstatistikleri`,
                renk: RENKLER.BILGI,
                thumbnail: guild.iconURL({ dynamic: true }),
                alanlar: [
                    { name: '👑 Sunucu Sahibi', value: `<@${guild.ownerId}>`, inline: true },
                    { name: '👥 Toplam Üye', value: `\`${guild.memberCount}\` Kişi`, inline: true },
                    { name: '🎭 Rol Sayısı', value: `\`${guild.roles.cache.size}\` Rol`, inline: true },
                    { name: '💬 Kanal Sayısı', value: `\`${guild.channels.cache.size}\` Kanal`, inline: true },
                    { name: '🛡️ Küfür Engel', value: ayar.kufurEngel ? '🟢 `Açık`' : '🔴 `Kapalı`', inline: true },
                    { name: '👋 Hoş Geldin', value: ayar.hosgeldinAktif ? '🟢 `Açık`' : '🔴 `Kapalı`', inline: true }
                ]
            })]
        });
    }
});

// ==========================================
// 💬 10. PREFIX (!) KOMUTLARI VE KÜFÜR ENGEL
// ==========================================
client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;

    const guild = message.guild;
    const ayar = sunucuAyarAl(guild.id);

    // 1. Küfür & Argo Kontrolü (Yöneticiler muaf)
    if (ayar.kufurEngel && !message.member.permissions.has(PermissionFlagsBits.Administrator)) {
        if (kufurKontrolEt(message.content)) {
            try {
                await message.delete();
                const uyariEmbed = embedOlustur({
                    baslik: '🚫 Küfür ve Argo Engellendi!',
                    aciklama: `${message.author}, bu sunucuda küfür ve argo kelimeler kullanmak yasaktır! Lütfen üslubunuza dikkat edin.`,
                    renk: RENKLER.HATA
                });
                const uyariMesaji = await message.channel.send({ embeds: [uyariEmbed] });
                setTimeout(() => uyariMesaji.delete().catch(() => {}), 4000);
                return;
            } catch (e) {
                console.error('[KÜFÜR ENGEL] Mesaj silinemedi:', e);
            }
        }
    }

    if (!message.content.startsWith('!')) return;

    const args = message.content.trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // !yardım / !yardim
    if (command === '!yardım' || command === '!yardim') {
        const menu = yardimMenusuOlustur(guild);
        return message.reply(menu);
    }

    // !küfür-engel aç / kapat
    if (command === '!küfür-engel' || command === '!kufur-engel') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply({ embeds: [embedOlustur({ baslik: '❌ Yetki Yetersiz', aciklama: 'Bu komutu kullanmak için **Yönetici** yetkisine sahip olmalısın.', renk: RENKLER.HATA })] });
        }
        const secenek = args[0]?.toLowerCase();
        if (secenek !== 'aç' && secenek !== 'kapat') {
            return message.reply({ embeds: [embedOlustur({ baslik: 'ℹ️ Doğru Kullanım', aciklama: 'Lütfen `!küfür-engel aç` veya `!küfür-engel kapat` şeklinde kullanın.', renk: RENKLER.BILGI })] });
        }
        const durum = secenek === 'aç';
        sunucuAyarGuncelle(guild.id, { kufurEngel: durum });
        return message.reply({
            embeds: [embedOlustur({
                baslik: durum ? '✅ Küfür Engel Sistemi Açıldı!' : '❌ Küfür Engel Sistemi Kapatıldı!',
                aciklama: durum ? 'Küfür ve argo filtresi aktif edildi.' : 'Küfür ve argo filtresi devre dışı bırakıldı.',
                renk: durum ? RENKLER.BASARILI : RENKLER.HATA
            })]
        });
    }

    // !sunucuhoşgeldin aç / kapat [#kanal]
    if (command === '!sunucuhoşgeldin' || command === '!hosgeldin') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply({ embeds: [embedOlustur({ baslik: '❌ Yetki Yetersiz', aciklama: 'Bu komut için **Yönetici** yetkisi gerekiyor.', renk: RENKLER.HATA })] });
        }
        const secenek = args[0]?.toLowerCase();
        if (secenek !== 'aç' && secenek !== 'kapat') {
            return message.reply({ embeds: [embedOlustur({ baslik: 'ℹ️ Doğru Kullanım', aciklama: 'Lütfen `!sunucuhoşgeldin aç #kanal` veya `!sunucuhoşgeldin kapat` şeklinde kullanın.', renk: RENKLER.BILGI })] });
        }
        const durum = secenek === 'aç';
        const etiketlenenKanal = message.mentions.channels.first();
        const hedefKanalId = etiketlenenKanal ? etiketlenenKanal.id : ayar.hosgeldinKanalId;

        sunucuAyarGuncelle(guild.id, { hosgeldinAktif: durum, hosgeldinKanalId: hedefKanalId });
        return message.reply({
            embeds: [embedOlustur({
                baslik: durum ? '✅ Hoş Geldin Sistemi Açıldı!' : '❌ Hoş Geldin Sistemi Kapatıldı!',
                aciklama: durum ? `Hoş geldin mesajları <#${hedefKanalId}> kanalına gönderilecek.` : 'Hoş geldin sistemi kapatıldı.',
                renk: durum ? RENKLER.BASARILI : RENKLER.HATA
            })]
        });
    }

    // !sunucukur
    if (command === '!sunucukur') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply({ embeds: [embedOlustur({ baslik: '❌ Yetki Yetersiz', aciklama: 'Bu komut için **Yönetici** yetkisi gerekiyor.', renk: RENKLER.HATA })] });
        }
        const bekleMesaj = await message.reply({ embeds: [embedOlustur({ baslik: '🛠️ Sunucu Kuruluyor...', aciklama: 'Şablon, roller ve odalar hazırlanıyor...', renk: RENKLER.UYARI })] });
        try {
            await sunucuKurulumuYap(guild, async (embed) => {
                await bekleMesaj.edit({ embeds: [embed] });
            });
        } catch (e) {
            await bekleMesaj.edit({ embeds: [embedOlustur({ baslik: '❌ Hata', aciklama: 'Kurulum sırasında bir hata oluştu.', renk: RENKLER.HATA })] });
        }
    }

    // !kuralkoy
    if (command === '!kuralkoy') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply({ embeds: [embedOlustur({ baslik: '❌ Yetki Yetersiz', aciklama: 'Bu komut için **Yönetici** yetkisi gerekiyor.', renk: RENKLER.HATA })] });
        }
        await message.delete().catch(() => {});
        await kuralGonder(message.channel);
    }

    // !herkeserol @Rol
    if (command === '!herkeserol') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply({ embeds: [embedOlustur({ baslik: '❌ Yetki Yetersiz', aciklama: 'Bu komut için **Yönetici** yetkisi gerekiyor.', renk: RENKLER.HATA })] });
        }
        const hedefRol = message.mentions.roles.first();
        if (!hedefRol) {
            return message.reply({ embeds: [embedOlustur({ baslik: 'ℹ️ Doğru Kullanım', aciklama: 'Lütfen dağıtılacak rolü etiketleyin: `!herkeserol @Üye`', renk: RENKLER.BILGI })] });
        }

        const bilgiMesaj = await message.reply({ embeds: [embedOlustur({ baslik: '⏳ Rol Dağıtımı Başladı...', aciklama: `Herkese ${hedefRol} rolü veriliyor, lütfen bekleyin...`, renk: RENKLER.UYARI })] });
        try {
            await guild.members.fetch();
            let sayac = 0;
            for (const [, member] of guild.members.cache) {
                if (!member.user.bot && !member.roles.cache.has(hedefRol.id)) {
                    await member.roles.add(hedefRol).catch(() => {});
                    sayac++;
                }
            }
            await bilgiMesaj.edit({ embeds: [embedOlustur({ baslik: '✅ İşlem Tamamlandı!', aciklama: `Toplam **${sayac}** üyeye ${hedefRol} rolü verildi.`, renk: RENKLER.BASARILI })] });
        } catch (e) {
            await bilgiMesaj.edit({ embeds: [embedOlustur({ baslik: '❌ Hata', aciklama: 'Roller dağıtılırken hata oluştu.', renk: RENKLER.HATA })] });
        }
    }

    // !kaydet @kullanici @Rol [İsim]
    if (command === '!kaydet') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
            return message.reply({ embeds: [embedOlustur({ baslik: '❌ Yetki Yetersiz', aciklama: 'Bu komutu kullanmak için **Rolleri Yönet** yetkisine sahip olmalısın.', renk: RENKLER.HATA })] });
        }
        const hedefUye = message.mentions.members.first();
        const verilecekRol = message.mentions.roles.first() || guild.roles.cache.find(r => r.name.includes('Üye'));
        const yeniIsim = args.filter(a => !a.startsWith('<@')).join(' ');

        if (!hedefUye) {
            return message.reply({ embeds: [embedOlustur({ baslik: 'ℹ️ Doğru Kullanım', aciklama: 'Örnek kullanım: `!kaydet @kullanici @Üye Ahmet | 20`', renk: RENKLER.BILGI })] });
        }

        try {
            const kayitsizRol = guild.roles.cache.find(r => r.name === 'Kayıtsız');
            if (kayitsizRol && hedefUye.roles.cache.has(kayitsizRol.id)) {
                await hedefUye.roles.remove(kayitsizRol);
            }
            if (verilecekRol) await hedefUye.roles.add(verilecekRol);
            if (yeniIsim) await hedefUye.setNickname(yeniIsim).catch(() => {});

            await message.reply({
                embeds: [embedOlustur({
                    baslik: '✨ Üye Başarıyla Kaydedildi!',
                    aciklama: `${hedefUye} kaydı tamamlandı${verilecekRol ? ` ve ${verilecekRol} rolü verildi` : ''}!`,
                    renk: RENKLER.BASARILI,
                    thumbnail: hedefUye.user.displayAvatarURL({ dynamic: true })
                })]
            });
        } catch (e) {
            await message.reply({ embeds: [embedOlustur({ baslik: '❌ Hata', aciklama: 'Kayıt sırasında yetki hatası oluştu.', renk: RENKLER.HATA })] });
        }
    }

    // !sesegir #kanal / !sestençık
    if (command === '!sesegir') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply({ embeds: [embedOlustur({ baslik: '❌ Yetki Yetersiz', aciklama: 'Bu komut için **Yönetici** yetkisi gerekiyor.', renk: RENKLER.HATA })] });
        }
        const sesKanali = message.mentions.channels.first() || guild.channels.cache.get(args[0]) || message.member.voice.channel;
        if (!sesKanali || sesKanali.type !== ChannelType.GuildVoice) {
            return message.reply({ embeds: [embedOlustur({ baslik: 'ℹ️ Doğru Kullanım', aciklama: 'Bir ses kanalı etiketleyin, ID yazın veya bir ses kanalına girip `!sesegir` yazın.', renk: RENKLER.BILGI })] });
        }

        joinVoiceChannel({
            channelId: sesKanali.id,
            guildId: guild.id,
            adapterCreator: guild.voiceAdapterCreator,
            selfDeaf: false,
            selfMute: true
        });
        sunucuAyarGuncelle(guild.id, { sesKanalId: sesKanali.id });
        return message.reply({ embeds: [embedOlustur({ baslik: '🔊 Ses Kanalına Bağlanıldı!', aciklama: `Başarıyla **${sesKanali.name}** kanalına giriş yapıldı ve sabitlendi.`, renk: RENKLER.BASARILI })] });
    }

    if (command === '!sestençık' || command === '!sestencik') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply({ embeds: [embedOlustur({ baslik: '❌ Yetki Yetersiz', aciklama: 'Bu komut için **Yönetici** yetkisi gerekiyor.', renk: RENKLER.HATA })] });
        }
        const conn = getVoiceConnection(guild.id);
        if (conn) conn.destroy();
        sunucuAyarGuncelle(guild.id, { sesKanalId: null });
        return message.reply({ embeds: [embedOlustur({ baslik: '🛑 Sesten Çıkış Yapıldı', aciklama: 'Bot ses kanalından ayrıldı.', renk: RENKLER.HATA })] });
    }

    // !sil [miktar]
    if (command === '!sil' || command === '!temizle') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
            return message.reply({ embeds: [embedOlustur({ baslik: '❌ Yetki Yetersiz', aciklama: 'Mesajları Yönet yetkiniz yok.', renk: RENKLER.HATA })] });
        }
        const miktar = parseInt(args[0]);
        if (isNaN(miktar) || miktar < 1 || miktar > 100) {
            return message.reply({ embeds: [embedOlustur({ baslik: 'ℹ️ Doğru Kullanım', aciklama: 'Lütfen 1 ile 100 arasında bir sayı girin: `!sil 25`', renk: RENKLER.BILGI })] });
        }
        const silinen = await message.channel.bulkDelete(miktar, true).catch(() => null);
        if (silinen) {
            const bilgi = await message.channel.send({ embeds: [embedOlustur({ baslik: '🧹 Sohbet Temizlendi!', aciklama: `**${silinen.size}** adet mesaj silindi.`, renk: RENKLER.BASARILI })] });
            setTimeout(() => bilgi.delete().catch(() => {}), 3500);
        }
    }

    // !sunucubilgi
    if (command === '!sunucubilgi') {
        return message.reply({
            embeds: [embedOlustur({
                baslik: `📊 ${guild.name} • Sunucu İstatistikleri`,
                renk: RENKLER.BILGI,
                thumbnail: guild.iconURL({ dynamic: true }),
                alanlar: [
                    { name: '👑 Sahip', value: `<@${guild.ownerId}>`, inline: true },
                    { name: '👥 Üye Sayısı', value: `\`${guild.memberCount}\``, inline: true },
                    { name: '🎭 Rol Sayısı', value: `\`${guild.roles.cache.size}\``, inline: true }
                ]
            })]
        });
    }
});

// ==========================================
// 🛡️ 11. ANTI-CRASH (ÇÖKME ÖNLEYİCİ KORUMA)
// ==========================================
process.on('unhandledRejection', error => console.error('[ANTI-CRASH] Yakalanmayan Hata:', error));
process.on('uncaughtException', error => console.error('[ANTI-CRASH] Kritik İstisna:', error));

client.login(process.env.DISCORD_TOKEN);
