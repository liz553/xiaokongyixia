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

  const { reminders } = body;
  if (!Array.isArray(reminders)) {
    return withCors(errorResponse('无效的数据格式', 400, 'INVALID_INPUT'), request, env);
  }

  const now = new Date().toISOString();
  
  // Delete old ones
  const statements = [
    env.DB.prepare('DELETE FROM reminders WHERE user_id = ?').bind(userId)
  ];

  // Insert new ones
  for (const r of reminders) {
    const id = generateUUID();
    statements.push(
      env.DB.prepare(
        'INSERT INTO reminders (id, user_id, time, exercise_id, enabled, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(id, userId, r.time, r.exerciseId, r.enabled ? 1 : 0, now)
    );
  }

  await env.DB.batch(statements);

  return withCors(successResponse({ success: true }), request, env);
});
