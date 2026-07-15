import { successResponse, errorResponse } from '../../common/response';
import { withErrorHandler } from '../../common/error';
import { handleOptions, withCors } from '../../common/cors';
import { getAuthUserId } from '../../common/jwt';
import { generateUUID } from '../../common/crypto';
import { checkUploadQuota } from '../../common/quota';

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

  const { original_filename, file_hash, total_size, content_type, media_kind, total_chunks } = body;

  // 1. 基础参数校验
  if (typeof total_size !== 'number' || total_size <= 0) {
    return withCors(errorResponse('total_size必须大于0', 400, 'INVALID_INPUT'), request, env);
  }
  if (typeof total_chunks !== 'number' || total_chunks <= 0) {
    return withCors(errorResponse('total_chunks必须大于0', 400, 'INVALID_INPUT'), request, env);
  }
  if (!original_filename || original_filename.includes('/') || original_filename.includes('\\')) {
    return withCors(errorResponse('文件名非法，不能包含路径字符', 400, 'INVALID_INPUT'), request, env);
  }
  if (media_kind !== 'video' && media_kind !== 'audio') {
    return withCors(errorResponse('media_kind参数错误，仅支持video/audio', 400, 'INVALID_INPUT'), request, env);
  }

  const user = await env.DB.prepare('SELECT role, storage_used FROM users WHERE id = ?').bind(userId).first();
  if (!user) {
    return withCors(errorResponse('用户不存在', 404, 'USER_NOT_FOUND'), request, env);
  }

  const { results: mediaFiles } = await env.DB.prepare('SELECT id FROM media_files WHERE user_id = ?').bind(userId).all();
  const currentFileCount = mediaFiles.length;
  const currentTotalStorage = user.storage_used || 0;

  // 2. 校验上传配额 (单文件大小、文件数量、总存储限制)
  const quotaCheck = checkUploadQuota(user.role, currentFileCount, currentTotalStorage, total_size);
  if (!quotaCheck.allowed) {
    return withCors(errorResponse(quotaCheck.reason || '超出配额', 403, 'QUOTA_EXCEEDED'), request, env);
  }

  // TODO: 多客户端同时init发起上传造成配额超售的并发竞争问题，后续迭代优化，本次无需处理。
  
  const uploadId = generateUUID();
  const now = new Date().toISOString();
  
  // 3. 将会话记录写入数据库，包含前端透传的 content_type
  // TODO: upload_sessions表增加expires_at过期字段，后续新增定时cron任务清理长期未完成的过期上传会话、过期临时分片；本次仅在数据表SQL和代码预留字段，不做过期自动清理逻辑。
  await env.DB.prepare(
    'INSERT INTO upload_sessions (upload_id, user_id, media_kind, original_filename, total_size, total_chunks, file_hash, content_type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(uploadId, userId, media_kind, original_filename, total_size, total_chunks, file_hash || '', content_type || '', now).run();

  return withCors(successResponse({ uploadId }), request, env);
});
