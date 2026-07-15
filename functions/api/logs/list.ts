import { successResponse, errorResponse } from '../../common/response';
import { withErrorHandler } from '../../common/error';
import { handleOptions, withCors } from '../../common/cors';
import { getAuthUserId } from '../../common/jwt';

export const onRequestOptions = (context: any) => handleOptions(context.request, context.env);

export const onRequestGet = withErrorHandler(async (context: any) => {
  const { request, env } = context;
  const userId = await getAuthUserId(request, env);
  
  if (!userId) {
    return withCors(errorResponse('未授权访问', 401, 'UNAUTHORIZED'), request, env);
  }

  const url = new URL(request.url);
  const startDate = url.searchParams.get('startDate');
  const endDate = url.searchParams.get('endDate');

  let query = 'SELECT * FROM activity_logs WHERE user_id = ?';
  const params: any[] = [userId];

  if (startDate) {
    query += ' AND created_at >= ?';
    params.push(startDate);
  }
  if (endDate) {
    query += ' AND created_at <= ?';
    params.push(endDate);
  }

  query += ' ORDER BY created_at DESC';

  const { results } = await env.DB.prepare(query).bind(...params).all();

  return withCors(successResponse(results), request, env);
});
