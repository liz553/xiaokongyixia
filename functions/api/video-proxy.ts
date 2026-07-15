import { errorResponse } from '../common/response';
import { withErrorHandler } from '../common/error';
import { handleOptions, withCors } from '../common/cors';
import { verifyJWT } from '../common/jwt';

interface Env {
  DB: D1Database;
  BUCKET: R2Bucket;
  JWT_SECRET: string;
}

type HandlerContext = {
  request: Request;
  env: Env;
};

export const onRequestOptions = (context: HandlerContext) => handleOptions(context.request, context.env);

export const onRequestGet = withErrorHandler(async (context: HandlerContext) => {
  const { request, env } = context;

  const url = new URL(request.url);
  const fileId = url.searchParams.get('id');
  
  // 视频/音频标签的 src 属性通常无法直接发送 Authorization Header，支持从 query 获取 token 进行鉴权
  let token = url.searchParams.get('token');
  
  if (!token) {
    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }
  }

  if (!token) {
    return withCors(errorResponse('未授权访问', 401, 'UNAUTHORIZED'), request, env);
  }

  // 1. JWT 鉴权
  const payload = await verifyJWT(token, env.JWT_SECRET);
  if (!payload || !payload.userId) {
    return withCors(errorResponse('无效的令牌或已过期', 401, 'INVALID_TOKEN'), request, env);
  }
  const userId = payload.userId;

  if (!fileId) {
    return withCors(errorResponse('缺少id参数', 400, 'MISSING_PARAMS'), request, env);
  }

  // 2. 查询文件记录并进行越权校验 (确保数据归属)
  const fileRecord = await env.DB.prepare('SELECT user_id, r2_key, content_type FROM media_files WHERE id = ?')
    .bind(fileId)
    .first();
    
  if (!fileRecord) {
    return withCors(errorResponse('文件不存在', 404, 'FILE_NOT_FOUND'), request, env);
  }
  if (fileRecord.user_id !== userId) {
    return withCors(errorResponse('无权访问该文件', 403, 'FORBIDDEN'), request, env);
  }

  const r2Key = fileRecord.r2_key as string;
  
  // 3. 读取 R2 对象，透传 request.headers 以支持 Range 请求，使视频可以拖拽进度
  const r2Obj = await env.BUCKET.get(r2Key, {
    range: request.headers,
    onlyIf: request.headers,
  });

  if (r2Obj === null) {
    return withCors(errorResponse('存储桶中未找到该媒体文件', 404, 'R2_OBJECT_NOT_FOUND'), request, env);
  }

  const headers = new Headers();
  r2Obj.writeHttpMetadata(headers);
  headers.set('etag', r2Obj.httpEtag);
  headers.set('Accept-Ranges', 'bytes');

  // 优先使用数据库中存储的 content_type
  if (fileRecord.content_type) {
    headers.set('Content-Type', fileRecord.content_type as string);
  }

  // 4. 组装 Range 相关的响应 Header
  if ('range' in r2Obj && r2Obj.range) {
    headers.set(
      'Content-Range',
      `bytes ${r2Obj.range.offset}-${r2Obj.range.offset + r2Obj.range.length - 1}/${r2Obj.size}`
    );
  }

  const status = r2Obj.body ? (request.headers.get('Range') !== null ? 206 : 200) : 304;

  const response = new Response(r2Obj.body, {
    status,
    headers
  });

  // 添加跨域 Header 支持前端正常读取播放
  return withCors(response, request, env);
});
