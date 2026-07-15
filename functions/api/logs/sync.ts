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

  let logs: any[];
  try {
    const body = await request.json();
    if (!Array.isArray(body)) {
      return withCors(errorResponse('请求体必须是数组', 400, 'INVALID_BODY'), request, env);
    }
    logs = body;
  } catch (e) {
    return withCors(errorResponse('无效的请求体', 400, 'INVALID_BODY'), request, env);
    
  }

  if (logs.length === 0) {
    return withCors(successResponse({ synced: 0 }), request, env);
  }

  // 简单去重逻辑，通过判断同时间、同类型、同时长、同能量的记录是否已存在
  const validDates = logs.map(l => l.created_at).filter(d => typeof d === 'string' && d.length > 0);
  const minDate = validDates.length > 0 ? validDates.sort()[0] : null;
  
  let existingLogs = [];
  if (minDate) {
    const { results } = await env.DB.prepare(
      'SELECT activity_type, duration_seconds, energy_change, created_at FROM activity_logs WHERE user_id = ? AND created_at >= ?'
    ).bind(userId, minDate).all();
    existingLogs = results;
  }

  const existingSet = new Set(
    existingLogs.map((l: any) => `${l.activity_type}_${l.duration_seconds}_${l.energy_change}_${l.created_at}`)
  );

  const statements = [];
  const nowStr = new Date().toISOString();
  let syncedCount = 0;

  for (const log of logs) {
    const { activity_type, duration_seconds, energy_change, content_text, created_at } = log;
    
    if (!activity_type || typeof duration_seconds !== 'number' || typeof energy_change !== 'number') {
      continue;
    }
    
    const recordTime = created_at || nowStr;
    const key = `${activity_type}_${duration_seconds}_${energy_change}_${recordTime}`;
    
    if (!existingSet.has(key)) {
      const id = generateUUID();
      statements.push(
        env.DB.prepare(
          'INSERT INTO activity_logs (id, user_id, activity_type, duration_seconds, energy_change, content_text, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        ).bind(id, userId, activity_type, duration_seconds, energy_change, content_text || '', recordTime, recordTime)
      );
      existingSet.add(key);
      syncedCount++;
    }
  }

  if (statements.length > 0) {
    await env.DB.batch(statements);
  }

  return withCors(successResponse({ synced: syncedCount }), request, env);
});
