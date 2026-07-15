import { successResponse, errorResponse } from '../../common/response';
import { withErrorHandler } from '../../common/error';
import { handleOptions, withCors } from '../../common/cors';
import { signJWT } from '../../common/jwt';
import { hashPassword } from '../../common/crypto';

export const onRequestOptions = (context: any) => handleOptions(context.request, context.env);

export const onRequestPost = withErrorHandler(async (context: any) => {
  const { request, env } = context;
  
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return withCors(errorResponse('无效的请求体', 400, 'INVALID_BODY'), request, env);
  }

  const { email, password } = body;

  if (!email || !password) {
    return withCors(errorResponse('邮箱或密码格式不正确', 400, 'INVALID_INPUT'), request, env);
  }

  const user = await env.DB.prepare('SELECT id, email, password_hash, salt, role FROM users WHERE email = ?')
    .bind(email)
    .first();

  if (!user) {
    // 防止探测
    return withCors(errorResponse('邮箱或密码错误', 401, 'INVALID_CREDENTIALS'), request, env);
  }

  const passwordHash = await hashPassword(password, user.salt as string);

  if (passwordHash !== user.password_hash) {
    return withCors(errorResponse('邮箱或密码错误', 401, 'INVALID_CREDENTIALS'), request, env);
  }

  const token = await signJWT(
    { userId: user.id, role: user.role, exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60 },
    env.JWT_SECRET
  );

  return withCors(
    successResponse({ 
      token, 
      user: { id: user.id, email: user.email, role: user.role } 
    }), 
    request, 
    env
  );
});
