import { successResponse, errorResponse } from '../../common/response';
import { handleOptions, withCors } from '../../common/cors';
import { generateUUID } from '../../common/crypto';

export const onRequestOptions = (context: any) => handleOptions(context.request, context.env);

export const onRequestGet = async (context: any) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const token = url.searchParams.get('token');

  // 鉴权
  if (token !== env.REMINDER_CRON_TOKEN) {
    return withCors(errorResponse('Forbidden', 403, 'FORBIDDEN'), request, env);
  }

  const now = new Date();
  const nowUnix = Math.floor(now.getTime());
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const currentTimeStr = `${hours}:${minutes}`;

  try {
    // 仅查询，不处理推送发送
    const pendingPushes = await env.DB.prepare(`
      SELECT s.id FROM scheduled_pushes s
      JOIN push_subscriptions p ON s.user_id = p.user_id
      WHERE s.status = 'pending' AND s.target_time <= ?
    `).bind(nowUnix).all();

    const activeReminders = await env.DB.prepare(`
      SELECT r.id FROM reminders r
      JOIN push_subscriptions p ON r.user_id = p.user_id
      WHERE r.time = ? AND r.enabled = 1
    `).bind(currentTimeStr).all();

    const pendingMissChecks = await env.DB.prepare(`
      SELECT id FROM scheduled_pushes
      WHERE notify_type = 'MISS_CHECK' AND status = 'pending' AND target_time <= ?
    `).bind(nowUnix).all();

    return withCors(successResponse({
      pendingPushCount: pendingPushes.results.length,
      reminderCount: activeReminders.results.length,
      missCheckCount: pendingMissChecks.results.length
    }), request, env);

  } catch (e: any) {
    return withCors(errorResponse(String(e.message), 500, 'DB_ERROR'), request, env);
  }
};
