import { successResponse, errorResponse } from '../../common/response';
import { withErrorHandler } from '../../common/error';
import { handleOptions, withCors } from '../../common/cors';
import { getAuthUserId } from '../../common/jwt';

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

  const { id } = body;
  if (!id) {
    return withCors(errorResponse('缺少ID', 400, 'INVALID_INPUT'), request, env);
  }

  await env.DB.prepare(`
    UPDATE scheduled_pushes SET status = 'cancelled' WHERE id = ? AND user_id = ?
  `).bind(id, userId).run();

  return withCors(successResponse({ success: true }), request, env);
});
