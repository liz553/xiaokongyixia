import { successResponse, errorResponse } from '../../common/response';
import { handleOptions, withCors } from '../../common/cors';
import { generateUUID } from '../../common/crypto';

// Base64工具函数 Cloudflare原生WebCrypto可用
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
}

// 原生构建Web Push请求，无第三方依赖
async function createPushRequest(
  payload: string,
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  vapid: { subject: string; publicKey: string; privateKey: string }
) {
  const encoder = new TextEncoder();
  const payloadUint8 = encoder.encode(payload);
  const p256dh = urlBase64ToUint8Array(subscription.keys.p256dh);
  const authSecret = urlBase64ToUint8Array(subscription.keys.auth);

  const vapidPubRaw = urlBase64ToUint8Array(vapid.publicKey);
  const vapidPrivRaw = urlBase64ToUint8Array(vapid.privateKey);

  // 导入VAPID密钥对
  const vapidPub = await crypto.subtle.importKey(
    'raw',
    vapidPubRaw,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['verify']
  );
  const vapidPriv = await crypto.subtle.importKey(
    'raw',
    vapidPrivRaw,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  // 构建JWT Header+Payload
  const jwtHeader = btoa(JSON.stringify({ alg: 'ES256', typ: 'JWT' }))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const jwtPayloadObj = {
    sub: vapid.subject,
    aud: new URL(subscription.endpoint).origin,
    exp: Math.floor(Date.now() / 1000) + 43200
  };
  const jwtPayload = btoa(JSON.stringify(jwtPayloadObj))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const jwtUnsigned = `${jwtHeader}.${jwtPayload}`;
  const jwtSignatureRaw = await crypto.subtle.sign(
    { name: 'ECDSA', namedCurve: 'P-256', hash: 'SHA-256' },
    vapidPriv,
    encoder.encode(jwtUnsigned)
  );
  const signatureBytes = new Uint8Array(jwtSignatureRaw);
  const jwtSig = btoa(String.fromCharCode(...signatureBytes))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const vapidAuthHeader = `vapid t=${jwtUnsigned}.${jwtSig}, k=${vapid.publicKey}`;

  // 加密推送载荷
  const localKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey']
  );
  const localPubRaw = await crypto.subtle.exportKey('raw', localKeyPair.publicKey);
  const localPubB64 = btoa(String.fromCharCode(...new Uint8Array(localPubRaw)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  const subscriberPub = await crypto.subtle.importKey(
    'raw',
    p256dh,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    ['deriveKey']
  );
  const sharedSecret = await crypto.subtle.deriveKey(
    { name: 'ECDH', public: subscriberPub },
    localKeyPair.privateKey,
    { name: 'AES-GCM', length: 128 },
    true,
    ['encrypt']
  );

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prkInput = new Uint8Array([...authSecret, ...salt]);
  const prk = await crypto.subtle.importKey(
    'raw',
    prkInput,
    { name: 'HKDF', hash: 'SHA-256' },
    false,
    ['deriveKey']
  );
  const contentKey = await crypto.subtle.deriveKey(
    { name: 'HKDF', salt: new Uint8Array(), info: encoder.encode('Content-Encoding: aes128gcm\0') },
    prk,
    { name: 'AES-GCM', length: 128 },
    false,
    ['encrypt']
  );
  const nonce = await crypto.subtle.deriveBits(
    { name: 'HKDF', salt: new Uint8Array(), info: encoder.encode('Content-Encoding: nonce\0') },
    prk,
    96
  );

  const padding = new Uint8Array([0x00, 0x00]);
  const dataToEncrypt = new Uint8Array([...payloadUint8, ...padding]);
  const encryptedPayload = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce },
    contentKey,
    dataToEncrypt
  );
  const encryptedUint = new Uint8Array(encryptedPayload);

  // 组装标准aes128gcm格式
  const finalPayload = new Uint8Array([
    ...salt,
    0, 0, 0, encryptedUint.length - 16,
    ...encryptedUint
  ]);

  // 构建请求
  return new Request(subscription.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Length': finalPayload.length.toString(),
      'Encryption': `salt=${btoa(String.fromCharCode(...salt)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')}`,
      'Crypto-Key': `dh=${localPubB64}`,
      'Authorization': vapidAuthHeader,
      'TTL': '300'
    },
    body: finalPayload
  });
}

export const onRequestOptions = (context: any) => handleOptions(context.request, context.env);

export const onRequestGet = async (context: any) => {
  const { request, env } = context;
  
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  
  if (token !== env.REMINDER_CRON_TOKEN) {
    return withCors(errorResponse('Forbidden', 403, 'FORBIDDEN'), request, env);
  }

  const vapidConfig = {
    subject: 'mailto:admin@example.com',
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY
  };

  const now = new Date();
  const nowUnix = Math.floor(now.getTime());
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const currentTimeStr = `${hours}:${minutes}`;

  try {
    const pushesToSend: any[] = [];
    const deleteSubIds: string[] = [];
    const updatePushIds: string[] = [];

    // 1. 查询定时待推送
    const pendingPushes = await env.DB.prepare(`
      SELECT s.*, p.id as sub_id, p.endpoint, p.p256dh, p.auth 
      FROM scheduled_pushes s
      JOIN push_subscriptions p ON s.user_id = p.user_id
      WHERE s.status = 'pending' AND s.target_time <= ?
    `).bind(nowUnix).all();

    for (const push of pendingPushes.results) {
      updatePushIds.push(push.id);
      let payloadObj = { notifyType: push.notify_type };
      if (push.payload) {
        try {
          payloadObj = { ...payloadObj, ...JSON.parse(push.payload) };
        } catch(e) {}
      }
      pushesToSend.push({
        subId: push.sub_id,
        pushId: push.id,
        endpoint: push.endpoint,
        keys: { p256dh: push.p256dh, auth: push.auth },
        payload: JSON.stringify(payloadObj)
      });
    }

    // 2. 查询当前时间提醒
    const activeReminders = await env.DB.prepare(`
      SELECT r.*, p.id as sub_id, p.endpoint, p.p256dh, p.auth
      FROM reminders r
      JOIN push_subscriptions p ON r.user_id = p.user_id
      WHERE r.time = ? AND r.enabled = 1
    `).bind(currentTimeStr).all();

    const newMissChecks: any[] = [];
    for (const rem of activeReminders.results) {
      pushesToSend.push({
        subId: rem.sub_id,
        remId: rem.id,
        endpoint: rem.endpoint,
        keys: { p256dh: rem.p256dh, auth: rem.auth },
        payload: JSON.stringify({ notifyType: 'B', exerciseId: rem.exercise_id })
      });
      newMissChecks.push(
        env.DB.prepare(`INSERT INTO scheduled_pushes (id, user_id, notify_type, target_time, payload, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
          .bind(generateUUID(), rem.user_id, 'MISS_CHECK', nowUnix + 30 * 60, JSON.stringify({ timeSentUnix: nowUnix }), 'pending', now.toISOString())
      );
    }
    if (newMissChecks.length > 0) {
      await env.DB.batch(newMissChecks);
    }

    // 3. 30分钟遗漏检测任务
    const pendingMissChecks = await env.DB.prepare(`
      SELECT * FROM scheduled_pushes
      WHERE notify_type = 'MISS_CHECK' AND status = 'pending' AND target_time <= ?
    `).bind(nowUnix).all();

    const insertLogs: any[] = [];
    const updateMissIds: string[] = [];
    
    for (const check of pendingMissChecks.results) {
      updateMissIds.push(check.id);
      
      const payload = JSON.parse(check.payload || '{}');
      const timeSentUnix = payload.timeSentUnix || (nowUnix - 30 * 60);
      const timeSentIso = new Date(timeSentUnix * 1000).toISOString();
      
      const userLogs = await env.DB.prepare(`
        SELECT id FROM activity_logs 
        WHERE user_id = ? AND created_at >= ?
      `).bind(check.user_id, timeSentIso).first();
      
      if (!userLogs) {
        const newLogId = generateUUID();
        const currIso = new Date().toISOString();
        insertLogs.push(
          env.DB.prepare(`
            INSERT INTO activity_logs (id, user_id, activity_type, duration_seconds, energy_change, content_text, created_at, updated_at) 
            VALUES (?, ?, '继续忙碌', 0, 0, '继续忙碌', ?, ?)
          `).bind(newLogId, check.user_id, currIso, currIso)
        );
      }
    }
    
    if (updateMissIds.length > 0) {
      const placeholders = updateMissIds.map(() => '?').join(',');
      await env.DB.prepare(`UPDATE scheduled_pushes SET status = 'processed' WHERE id IN (${placeholders})`).bind(...updateMissIds).run();
    }
    if (insertLogs.length > 0) {
      await env.DB.batch(insertLogs);
    }

    // 逐条发送推送，单条失败隔离，不会全局崩溃
    let sentCount = 0;
    for (const push of pushesToSend) {
      try {
        const req = await createPushRequest(push.payload, {
          endpoint: push.endpoint,
          keys: push.keys
        }, vapidConfig);
        const res = await fetch(req);
        if (res.ok) sentCount++;
        if (res.status === 410 || res.status === 404) {
          deleteSubIds.push(push.subId);
        }
      } catch (e) {
        continue;
      }
    }

    // 更新数据库推送状态
    if (updatePushIds.length > 0) {
      const placeholders = updatePushIds.map(() => '?').join(',');
      await env.DB.prepare(`UPDATE scheduled_pushes SET status = 'sent' WHERE id IN (${placeholders})`).bind(...updatePushIds).run();
    }
    
    if (deleteSubIds.length > 0) {
      const uniqueDeleteIds = [...new Set(deleteSubIds)];
      const placeholders = uniqueDeleteIds.map(() => '?').join(',');
      await env.DB.prepare(`DELETE FROM push_subscriptions WHERE id IN (${placeholders})`).bind(...uniqueDeleteIds).run();
    }

    return withCors(successResponse({ sent: sentCount, totalTask: pushesToSend.length }), request, env);
  } catch (e: any) {
    return withCors(errorResponse(String(e?.message || e), 500, 'CRON_ERROR'), request, env);
  }
};
