import { successResponse, errorResponse } from '../../common/response';
import { withErrorHandler } from '../../common/error';
import { handleOptions, withCors } from '../../common/cors';
import { signJWT } from '../../common/jwt';
import { hashPassword, generateSalt, generateUUID } from '../../common/crypto';

export const onRequestOptions = (context: any) => handleOptions(context.request, context.env);

export const onRequestPost = withErrorHandler(async (context: any) => {
  const { request, env } = context;
  
  if (env.ALLOW_PUBLIC_REGISTER === 'false') {
    return withCors(errorResponse('注册已关闭', 403, 'REGISTER_DISABLED'), request, env);
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return withCors(errorResponse('无效的请求体', 400, 'INVALID_BODY'), request, env);
  }

  const { email, password } = body;

  if (!email || !password || password.length < 6) {
    return withCors(errorResponse('邮箱或密码格式不正确，密码至少6位', 400, 'INVALID_INPUT'), request, env);
  }

  // 校验邮箱是否已存在
  const existingUser = await env.DB.prepare('SELECT id FROM users WHERE email = ?')
    .bind(email)
    .first();

  if (existingUser) {
    return withCors(errorResponse('邮箱已被注册', 400, 'EMAIL_EXISTS'), request, env);
  }

  const userId = generateUUID();
  const salt = generateSalt();
  const passwordHash = await hashPassword(password, salt);
  const now = new Date().toISOString();

  await env.DB.prepare(
    'INSERT INTO users (id, email, password_hash, salt, role, storage_used, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  )
    .bind(userId, email, passwordHash, salt, 'user', 0, now, now)
    .run();

  const token = await signJWT(
    { userId, role: 'user', exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60 },
    env.JWT_SECRET
  );

  return withCors(successResponse({ token, user: { id: userId, email, role: 'user' } }), request, env);
});
