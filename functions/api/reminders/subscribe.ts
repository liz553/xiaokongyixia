import { successResponse, errorResponse } from '../../common/response';
import { withErrorHandler } from '../../common/error';
import { handleOptions, withCors } from '../../common/cors';
import { getAuthUserId } from '../../common/jwt';
import { generateUUID } from '../../common/crypto';

export const onRequestOptions = (context: any) => handleOptions(context.request, context.env);

export const onRequestPost = withErrorHandler(async (context: any) => {
  const { request, env } = context;
  const userId = await getAuthUserId(request, env);
  
  if (!userId) {
    return withCors(errorResponse('未授权访问', 401, 'UNAUTHORIZED'), request, env);
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return withCors(errorResponse('无效的请求体', 400, 'INVALID_BODY'), request, env);
  }

  const { subscription } = body;
  if (!subscription || !subscription.endpoint || !subscription.keys) {
    return withCors(errorResponse('缺少订阅信息', 400, 'INVALID_INPUT'), request, env);
  }

  const { endpoint, keys: { p256dh, auth } } = subscription;

  const now = new Date().toISOString();
  const id = generateUUID();

  // Upsert using endpoint
  await env.DB.prepare(`
    INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(endpoint) DO UPDATE SET user_id=excluded.user_id, p256dh=excluded.p256dh, auth=excluded.auth
  `).bind(id, userId, endpoint, p256dh, auth, now).run();

  return withCors(successResponse({ success: true }), request, env);
});
