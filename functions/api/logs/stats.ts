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
  let startDate = url.searchParams.get('startDate');
  let endDate = url.searchParams.get('endDate');

  // 如果 startDate 和 endDate 都不传，默认查询今日 00:00:00 至今
  if (!startDate && !endDate) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    startDate = today.toISOString();
  }

  let condition = 'user_id = ?';
  const params: any[] = [userId];

  if (startDate) {
    condition += ' AND created_at >= ?';
    params.push(startDate);
  }
  if (endDate) {
    condition += ' AND created_at <= ?';
    params.push(endDate);
  }

  const totalQuery = `SELECT SUM(duration_seconds) as total_duration, SUM(energy_change) as total_energy FROM activity_logs WHERE ${condition}`;
  const groupQuery = `SELECT activity_type, SUM(duration_seconds) as sum_duration, SUM(energy_change) as sum_energy, COUNT(id) as count FROM activity_logs WHERE ${condition} GROUP BY activity_type`;

  const [totalResult, groupResult] = await env.DB.batch([
    env.DB.prepare(totalQuery).bind(...params),
    env.DB.prepare(groupQuery).bind(...params)
  ]);

  const totalRow = totalResult.results[0] || {};
  
  const responseData = {
    total_duration: Number(totalRow.total_duration) || 0,
    total_energy: Number(totalRow.total_energy) || 0,
    activity_group: groupResult.results.map((row: any) => ({
      activity_type: row.activity_type,
      sum_duration: Number(row.sum_duration) || 0,
      sum_energy: Number(row.sum_energy) || 0,
      count: Number(row.count) || 0
    }))
  };

  return withCors(successResponse(responseData), request, env);
});
