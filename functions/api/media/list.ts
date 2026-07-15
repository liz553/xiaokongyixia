// /functions/api/media/list.ts
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
};

export const onRequestOptions = (context: HandlerContext) => handleOptions(context.request, context.env);

export const onRequestGet = withErrorHandler(async (context: HandlerContext) => {
  const { request, env } = context;
  const userId = await getAuthUserId(request, env);
  
  if (!userId) {
    return withCors(errorResponse('未授权访问', 401, 'UNAUTHORIZED'), request, env);
  }

  // 查询当前用户的媒体文件，严格限制数据归属，按创建时间倒序排列
  const { results } = await env.DB.prepare(
    'SELECT id, original_filename as filename, file_size, content_type as mime_type, created_at FROM media_files WHERE user_id = ? ORDER BY created_at DESC'
  ).bind(userId).all();

  // 强制转换数值，对齐项目统一规范
  const formattedResults = results.map((row: any) => ({
    id: row.id,
    filename: row.filename,
    file_size: Number(row.file_size) || 0,
    mime_type: row.mime_type,
    created_at: row.created_at
  }));

  return withCors(successResponse(formattedResults), request, env);
});
