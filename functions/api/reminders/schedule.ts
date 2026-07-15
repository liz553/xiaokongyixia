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

  const { notify_type, target_time, payload } = body;
  
  if (!notify_type || typeof target_time !== 'number') {
    return withCors(errorResponse('缺少必要参数', 400, 'INVALID_INPUT'), request, env);
  }

  const now = new Date().toISOString();
  const id = generateUUID();

  await env.DB.prepare(`
    INSERT INTO scheduled_pushes (id, user_id, notify_type, target_time, payload, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(id, userId, notify_type, target_time, payload ? JSON.stringify(payload) : null, 'pending', now).run();

  return withCors(successResponse({ id }), request, env);
});
