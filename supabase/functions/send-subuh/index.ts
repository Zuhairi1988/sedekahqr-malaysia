import { createClient } from 'npm:@supabase/supabase-js@2.112.2';
import webpush from 'npm:web-push@3.6.7';

type Subscription = {
  subscription_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  zone: string;
  last_sent_date: string | null;
};

const malaysiaTimeZone = 'Asia/Kuala_Lumpur';
const siteUrl = 'https://zuhairi1988.github.io/sedekahqr-malaysia/#direktori';

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' }
});

const toMinutes = (value: string) => {
  const [hours, minutes] = value.slice(0, 5).split(':').map(Number);
  return (hours * 60) + minutes;
};

const chunks = <T>(items: T[], size: number) => {
  const output: T[][] = [];
  for (let index = 0; index < items.length; index += size) output.push(items.slice(index, index + size));
  return output;
};

Deno.serve(async (request) => {
  if (request.method !== 'POST') return jsonResponse({ error: 'Kaedah tidak dibenarkan.' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
  const vapidContact = Deno.env.get('VAPID_CONTACT') || 'mailto:admin@sedekahqr.my';
  if (!supabaseUrl || !serviceRoleKey || !vapidPublicKey || !vapidPrivateKey) {
    return jsonResponse({ error: 'Konfigurasi server tidak lengkap.' }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const cronSecret = request.headers.get('x-cron-secret') || '';
  const { data: cronAuthorized, error: cronAuthError } = await supabase
    .rpc('verify_subuh_cron_secret', { candidate: cronSecret });
  if (cronAuthError || cronAuthorized !== true) {
    return jsonResponse({ error: 'Tidak dibenarkan.' }, 401);
  }

  const now = new Date();
  const dateKey = new Intl.DateTimeFormat('en-CA', {
    timeZone: malaysiaTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now);
  const currentTime = new Intl.DateTimeFormat('en-GB', {
    timeZone: malaysiaTimeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).format(now);
  const currentMinutes = toMinutes(currentTime);

  if (currentMinutes < 240 || currentMinutes > 420) {
    return jsonResponse({ ok: true, message: 'Di luar tetingkap Subuh.', sent: 0 });
  }

  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('subscription_id, endpoint, p256dh, auth, zone, last_sent_date')
    .eq('enabled', true)
    .or(`last_sent_date.is.null,last_sent_date.neq.${dateKey}`);

  if (error) return jsonResponse({ error: 'Langganan tidak dapat dimuatkan.' }, 500);
  const subscriptions = (data || []) as Subscription[];
  if (!subscriptions.length) return jsonResponse({ ok: true, message: 'Tiada langganan belum dihantar.', sent: 0 });

  const prayerTimes = new Map<string, string>();
  const zones = [...new Set(subscriptions.map((item) => item.zone))];
  await Promise.all(zones.map(async (zone) => {
    try {
      const endpoint = `https://www.e-solat.gov.my/index.php?r=esolatApi/takwimsolat&period=today&zone=${encodeURIComponent(zone)}`;
      const response = await fetch(endpoint, { headers: { Accept: 'application/json' } });
      if (!response.ok) return;
      const payload = await response.json();
      const fajr = payload.prayerTime?.[0]?.fajr;
      if (fajr) prayerTimes.set(zone, String(fajr).slice(0, 5));
    } catch {
      console.error(`Waktu Subuh ${zone} tidak dapat dimuatkan.`);
    }
  }));

  const due = subscriptions.filter((item) => {
    const fajr = prayerTimes.get(item.zone);
    if (!fajr) return false;
    const difference = currentMinutes - toMinutes(fajr);
    return difference >= 0 && difference <= 12;
  });
  if (!due.length) return jsonResponse({ ok: true, message: `Tiada penghantaran pada ${currentTime}.`, sent: 0 });

  const reflections = [
    {
      title: 'Renungan Kebaikan',
      text: 'Berlumba-lumbalah dalam melakukan kebaikan.',
      source: 'Al-Baqarah 2:148',
      prompt: 'Pilih satu kebaikan untuk dilakukan hari ini.'
    },
    {
      title: 'Renungan Syukur',
      text: 'Jika kamu bersyukur, nescaya Allah menambah nikmat kepadamu.',
      source: 'Ibrahim 14:7',
      prompt: 'Sebut satu nikmat yang anda syukuri pagi ini.'
    },
    {
      title: 'Sabar dan Solat',
      text: 'Mintalah pertolongan dengan sabar dan solat; Allah bersama orang yang sabar.',
      source: 'Al-Baqarah 2:153',
      prompt: 'Hadapi urusan hari ini dengan tenang dan jaga solat.'
    },
    {
      title: 'Berbuat Baik kepada Ibu Bapa',
      text: 'Berbuat baiklah kepada ibu bapa dan berbicaralah kepada mereka dengan mulia.',
      source: "Al-Isra' 17:23",
      prompt: 'Doakan mereka dan hubungi mereka apabila berkesempatan.'
    },
    {
      title: 'Renungan Tawakal',
      text: 'Sesiapa yang bertawakal kepada Allah, maka Allah mencukupkan keperluannya.',
      source: 'At-Talaq 65:3',
      prompt: 'Usahakan yang terbaik, kemudian serahkan hasilnya kepada Allah.'
    },
    {
      title: 'Doa Menuntut Ilmu',
      text: 'Wahai Tuhanku, tambahkanlah ilmuku.',
      source: 'Taha 20:114',
      prompt: 'Pelajari satu perkara yang bermanfaat hari ini.'
    },
    {
      title: 'Doa Dunia dan Akhirat',
      text: 'Ya Tuhan kami, berilah kebaikan di dunia dan kebaikan di akhirat.',
      source: 'Al-Baqarah 2:201',
      prompt: 'Mulakan pagi dengan doa dan pengharapan yang baik.'
    },
    {
      title: 'Jaga Solat',
      text: 'Sesungguhnya solat mencegah perbuatan keji dan mungkar.',
      source: 'Al-Ankabut 29:45',
      prompt: 'Jadikan solat panduan untuk tindakan hari ini.'
    },
    {
      title: 'Persaudaraan',
      text: 'Orang beriman itu bersaudara; damaikanlah antara saudaramu.',
      source: 'Al-Hujurat 49:10',
      prompt: 'Jernihkan satu hubungan dengan kata-kata yang baik.'
    },
    {
      title: 'Dekati Al-Quran',
      text: 'Sebaik-baik kamu ialah yang mempelajari Al-Quran dan mengajarkannya.',
      source: 'Sahih al-Bukhari 5027',
      prompt: 'Luangkan beberapa minit bersama Al-Quran hari ini.'
    },
    {
      title: 'Jaga Pertuturan',
      text: 'Berkatalah yang baik atau diam.',
      source: 'Sahih al-Bukhari 6018',
      prompt: 'Pilih perkataan yang menenangkan dan memberi manfaat.'
    },
    {
      title: 'Mukmin yang Kuat',
      text: 'Berusahalah mendapatkan perkara yang bermanfaat dan mohon pertolongan Allah.',
      source: 'Sahih Muslim 2664',
      prompt: 'Ambil satu langkah yang bermanfaat pagi ini.'
    },
    {
      title: 'Kebaikan Kecil',
      text: 'Jangan meremehkan sesuatu kebaikan, walaupun bertemu saudaramu dengan wajah ceria.',
      source: 'Sahih Muslim 2626',
      prompt: 'Sebarkan salam, senyuman dan layanan yang baik.'
    },
    {
      title: 'Renungan Infak',
      text: 'Apa sahaja yang kamu infakkan, Allah akan menggantikannya.',
      source: "Saba' 34:39",
      prompt: 'Jika berkemampuan, kongsikan sedikit rezeki hari ini.'
    }
  ];
  const dayIndex = Math.floor(Date.UTC(
    Number(dateKey.slice(0, 4)),
    Number(dateKey.slice(5, 7)) - 1,
    Number(dateKey.slice(8, 10))
  ) / 86400000);
  const reflection = reflections[dayIndex % reflections.length];
  const notification = JSON.stringify({
    title: reflection.title,
    body: `${reflection.text} (${reflection.source}) ${reflection.prompt}`,
    date: dateKey,
    url: siteUrl
  });

  webpush.setVapidDetails(vapidContact, vapidPublicKey, vapidPrivateKey);
  const sentIds: string[] = [];
  const invalidIds: string[] = [];
  let failed = 0;

  for (const batch of chunks(due, 25)) {
    await Promise.all(batch.map(async (item) => {
      try {
        await webpush.sendNotification({
          endpoint: item.endpoint,
          keys: { p256dh: item.p256dh, auth: item.auth }
        }, notification, { TTL: 3600, urgency: 'normal' });
        sentIds.push(item.subscription_id);
      } catch (sendError) {
        const statusCode = Number((sendError as { statusCode?: number }).statusCode || 0);
        if (statusCode === 404 || statusCode === 410) invalidIds.push(item.subscription_id);
        else failed += 1;
        console.error(`Push ${item.subscription_id} gagal: HTTP ${statusCode || 'unknown'}`);
      }
    }));
  }

  for (const batch of chunks(sentIds, 100)) {
    const { error: updateError } = await supabase
      .from('push_subscriptions')
      .update({ last_sent_date: dateKey })
      .in('subscription_id', batch);
    if (updateError) console.error('Tarikh penghantaran tidak dapat dikemas kini.');
  }

  for (const batch of chunks(invalidIds, 100)) {
    const { error: deleteError } = await supabase
      .from('push_subscriptions')
      .delete()
      .in('subscription_id', batch);
    if (deleteError) console.error('Langganan tamat tidak dapat dipadamkan.');
  }

  return jsonResponse({ ok: true, sent: sentIds.length, failed, removed: invalidIds.length });
});
