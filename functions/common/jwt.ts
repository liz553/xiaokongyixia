// 基于 Web Crypto API 的轻量级 JWT 验证工具
// 兼容 Edge Runtime，无需依赖 Node.js 原生模块

function base64UrlEncode(buffer: ArrayBuffer | string) {
  let str = '';
  if (typeof buffer === 'string') {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      str += String.fromCharCode(bytes[i]);
    }
    str = btoa(str);
  } else {
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      str += String.fromCharCode(bytes[i]);
    }
    str = btoa(str);
  }
  return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64UrlDecode(str: string) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) {
    str += '=';
  }
  return atob(str);
}

export async function verifyJWT(token: string, secret: string) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('Invalid token format');

    const header = JSON.parse(base64UrlDecode(parts[0]));
    const payload = JSON.parse(base64UrlDecode(parts[1]));

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const signatureStr = atob(parts[2].replace(/-/g, '+').replace(/_/g, '/'));
    const signature = new Uint8Array(signatureStr.length);
    for (let i = 0; i < signatureStr.length; i++) {
      signature[i] = signatureStr.charCodeAt(i);
    }
    
    const data = encoder.encode(parts[0] + '.' + parts[1]);
    const isValid = await crypto.subtle.verify('HMAC', key, signature, data);

    if (!isValid) throw new Error('Invalid signature');
    if (payload.exp && Date.now() >= payload.exp * 1000) throw new Error('Token expired');

    return payload;
  } catch (err) {
    return null;
  }
}

export async function getAuthUserId(request: Request, env: any): Promise<string | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  const token = authHeader.split(' ')[1];
  const payload = await verifyJWT(token, env.JWT_SECRET);
  return payload ? payload.userId : null;
}

export async function signJWT(payload: any, secret: string) {
  const header = { alg: 'HS256', typ: 'JWT' };
  
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  
  const data = encodedHeader + '.' + encodedPayload;
  
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(data)
  );
  
  const encodedSignature = base64UrlEncode(signatureBuffer);
  
  return `${data}.${encodedSignature}`;
}
