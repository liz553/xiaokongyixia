import { successResponse, errorResponse } from '../../common/response';
import { handleOptions, withCors } from '../../common/cors';

export const onRequestOptions = (context: any) => handleOptions(context.request, context.env);

export const onRequestGet = async (context: any) => {
  const { request, env } = context;
  
  try {
    await env.DB.batch([
      env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS push_subscriptions (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          endpoint TEXT NOT NULL UNIQUE,
          p256dh TEXT NOT NULL,
          auth TEXT NOT NULL,
          created_at TEXT NOT NULL
        )
      `),
      env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS reminders (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          time TEXT NOT NULL,
          exercise_id TEXT NOT NULL,
          enabled INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL
        )
      `),
      env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS scheduled_pushes (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          notify_type TEXT NOT NULL,
          target_time INTEGER NOT NULL,
          payload TEXT,
          status TEXT DEFAULT 'pending',
          created_at TEXT NOT NULL
        )
      `)
    ]);
    return withCors(successResponse({ success: true }), request, env);
  } catch (e: any) {
    return withCors(errorResponse(e.message, 500, 'DB_INIT_ERROR'), request, env);
  }
};
