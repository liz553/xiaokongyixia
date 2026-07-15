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

  const url = new URL(request.url);
  const uploadId = url.searchParams.get('uploadId');
  
  if (!uploadId) {
    return withCors(errorResponse('缺少uploadId参数', 400, 'MISSING_PARAMS'), request, env);
  }

  // 查询上传会话
  const session = await env.DB.prepare('SELECT * FROM upload_sessions WHERE upload_id = ?')
    .bind(uploadId)
    .first();
    
  if (!session) {
    return withCors(errorResponse('上传会话不存在', 404, 'SESSION_NOT_FOUND'), request, env);
  }
  
  // 归属权校验，禁止跨用户读取
  if (session.user_id !== userId) {
    return withCors(errorResponse('无权访问该会话', 403, 'FORBIDDEN'), request, env);
  }

  const prefix = `uploads/temp/${uploadId}/`;
  const chunkKeys = new Set<number>();
  let cursor: string | undefined;
  
  // R2分页遍历分片，严格匹配纯数字分片文件名，防止恶意文件名干扰统计
  while (true) {
    const listResult = await env.BUCKET.list({ prefix, cursor });
    const chunkReg = new RegExp(`^${prefix}(\\d+)$`);

    for (const obj of listResult.objects) {
      const match = obj.key.match(chunkReg);
      if (match) {
        const index = parseInt(match[1], 10);
        chunkKeys.add(index);
      }
    }

    if (!listResult.truncated) break;
    cursor = listResult.cursor;
  }

  const uploadedChunks = Array.from(chunkKeys).sort((a, b) => a - b);
  const totalChunks = Number(session.total_chunks) || 0;
  const progress = totalChunks > 0 ? (uploadedChunks.length / totalChunks) : 0;

  return withCors(successResponse({
    upload_id: session.upload_id,
    original_filename: session.original_filename,
    media_kind: session.media_kind,
    total_size: session.total_size,
    total_chunks: totalChunks,
    progress: Number(progress.toFixed(4)),
    uploaded_chunks: uploadedChunks
  }), request, env);
});
