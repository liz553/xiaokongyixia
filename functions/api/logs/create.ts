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

  const { activity_type, duration_seconds, energy_change, content_text } = body;

  if (!activity_type || typeof duration_seconds !== 'number' || typeof energy_change !== 'number') {
    return withCors(errorResponse('参数不合法', 400, 'INVALID_INPUT'), request, env);
  }

  const id = generateUUID();
  const now = new Date().toISOString();

  await env.DB.prepare(
    'INSERT INTO activity_logs (id, user_id, activity_type, duration_seconds, energy_change, content_text, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  )
    .bind(id, userId, activity_type, duration_seconds, energy_change, content_text || '', now, now)
    .run();

  const newLog = {
    id,
    user_id: userId,
    activity_type,
    duration_seconds,
    energy_change,
    content_text: content_text || '',
    created_at: now,
    updated_at: now
  };

  return withCors(successResponse(newLog), request, env);
});
