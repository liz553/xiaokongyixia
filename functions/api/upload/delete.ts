import { successResponse, errorResponse } from '../../common/response';
import { withErrorHandler } from '../../common/error';
import { handleOptions, withCors } from '../../common/cors';
import { getAuthUserId } from '../../common/jwt';

interface Env {
  DB: D1Database;
  BUCKET: R2Bucket;
}

type HandlerContext = {
  request: Request;
  env: Env;
  waitUntil(promise: Promise<unknown>): void;
};

export const onRequestOptions = (context: HandlerContext) => handleOptions(context.request, context.env);

export const onRequestPost = withErrorHandler(async (context: HandlerContext) => {
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

  const { uploadId } = body;
  if (!uploadId) {
    return withCors(errorResponse('缺少uploadId参数', 400, 'MISSING_PARAMS'), request, env);
  }

  // 查询会话+权限校验
  const session = await env.DB.prepare('SELECT user_id FROM upload_sessions WHERE upload_id = ?')
    .bind(uploadId)
    .first();
    
  if (!session) {
    return withCors(errorResponse('上传会话不存在', 404, 'SESSION_NOT_FOUND'), request, env);
  }
  if (session.user_id !== userId) {
    return withCors(errorResponse('无权访问该会话', 403, 'FORBIDDEN'), request, env);
  }

  // 先删除数据库会话记录
  await env.DB.prepare('DELETE FROM upload_sessions WHERE upload_id = ?')
    .bind(uploadId)
    .run();

  const prefix = `uploads/temp/${uploadId}/`;

  // 使用waitUntil后台清理分片，不阻塞HTTP响应
  context.waitUntil((async () => {
    try {
      let cursor: string | undefined;
      const allKeys: string[] = [];
      // 分页列出真实存在的分片，不再依靠total_chunks循环生成key（修复DOS风险）
      while (true) {
        const listResult = await env.BUCKET.list({ prefix, cursor });
        allKeys.push(...listResult.objects.map(item => item.key));
        if (!listResult.truncated) break;
        cursor = listResult.cursor;
      }

      // R2单次delete最大1000条，自动分批删除
      const BATCH_SIZE = 1000;
      for (let i = 0; i < allKeys.length; i += BATCH_SIZE) {
        const batch = allKeys.slice(i, i + BATCH_SIZE);
        await env.BUCKET.delete(batch);
      }
    } catch (err) {
      console.error('主动废弃上传会话，清理临时分片异常 uploadId=', uploadId, err);
      // 清理失败依赖定时Cron任务兜底清除僵尸文件
    }
  })());

  return withCors(successResponse(null, '上传会话已废弃并开始后台清理'), request, env);
});
