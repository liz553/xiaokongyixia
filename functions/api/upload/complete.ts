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

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return withCors(errorResponse('无效的请求体', 400, 'INVALID_BODY'), request, env);
  }

  const { uploadId } = body;
  if (!uploadId) {
    return withCors(errorResponse('缺少uploadId', 400, 'MISSING_PARAMS'), request, env);
  }

  const session = await env.DB.prepare('SELECT * FROM upload_sessions WHERE upload_id = ?').bind(uploadId).first();
  if (!session) {
    return withCors(errorResponse('上传会话不存在', 404, 'SESSION_NOT_FOUND'), request, env);
  }
  if (session.user_id !== userId) {
    return withCors(errorResponse('无权访问该会话', 403, 'FORBIDDEN'), request, env);
  }

  const totalChunks = session.total_chunks;
  const prefix = `uploads/temp/${uploadId}/`;

  // 1. 增加分页循环逻辑读取全部分片，避免单次 list 达到上限
  const chunkKeys = new Set<number>();
  let cursor: string | undefined = undefined;
  
  while (true) {
    const listResult = await env.BUCKET.list({ prefix, cursor });
    for (const obj of listResult.objects) {
      const indexStr = obj.key.replace(prefix, '');
      const index = parseInt(indexStr, 10);
      if (!isNaN(index)) {
        chunkKeys.add(index);
      }
    }
    if (listResult.truncated) {
      cursor = listResult.cursor;
    } else {
      break;
    }
  }

  // 2. 修复分片完整性校验：提取所有分片索引，校验 0 ~ total_chunks-1 全部存在
  for (let i = 0; i < totalChunks; i++) {
    if (!chunkKeys.has(i)) {
      return withCors(errorResponse(`分片缺失: 缺少 chunkIndex ${i}`, 400, 'MISSING_CHUNK'), request, env);
    }
  }

  // 3. 实现基于临时分片流式合并文件，废弃所有 R2 MultipartUpload 逻辑
  // TODO: 架构风险备注：大文件流式合并存在WorkersCPU时长限制，后期频繁出现合并超时故障时，需要迁移至Durable Objects或异步后台任务处理；第一版维持当前同步合并方案不变。
  const fileUuid = generateUUID();
  const originalFilenameHash = session.file_hash || 'nohash'; 
  
  // 提取原始文件扩展名拼接最终路径：uploads/{user_id}/{uuid}_{original_filename_hash}.ext
  const extMatch = session.original_filename.match(/\.[0-9a-z]+$/i);
  const ext = extMatch ? extMatch[0] : '';
  const finalKey = `uploads/${userId}/${fileUuid}_${originalFilenameHash}${ext}`;

  // 优先使用会话保存的 content_type，没有则降级兜底
  const mimeType = session.content_type || 'application/octet-stream';

  const { readable, writable } = new TransformStream();
  
  const mergeChunks = async () => {
    const writer = writable.getWriter();
    try {
      for (let i = 0; i < totalChunks; i++) {
        const chunkObj = await env.BUCKET.get(`${prefix}${i}`);
        if (chunkObj && chunkObj.body) {
          const reader = chunkObj.body.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            await writer.write(value);
          }
          reader.releaseLock();
        }
      }
      await writer.close();
    } catch (err) {
      await writer.abort(err);
      // TODO: complete流程异常回滚清理：合并中途报错时，清理已经生成的不完整正式文件，后续迭代补充。
      throw err;
    }
  };

  const mergePromise = mergeChunks();
  
  // 流水线直写 R2 正式存储桶
  await env.BUCKET.put(finalKey, readable, {
    httpMetadata: { contentType: mimeType }
  });
  
  // 等待合并流水线操作成功结束
  await mergePromise;

  const now = new Date().toISOString();
  
  // 4. 将媒体记录插入、额度更新和会话清理逻辑，封装在同一个 D1 事务 (batch) 内执行
  await env.DB.batch([
    env.DB.prepare(
      'INSERT INTO media_files (id, user_id, original_filename, r2_key, file_size, content_type, media_kind, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(fileUuid, userId, session.original_filename, finalKey, session.total_size, mimeType, session.media_kind, now, now),
    env.DB.prepare(
      'UPDATE users SET storage_used = storage_used + ?, updated_at = ? WHERE id = ?'
    ).bind(session.total_size, now, userId),
    env.DB.prepare(
      'DELETE FROM upload_sessions WHERE upload_id = ?'
    ).bind(uploadId)
  ]);

  // 后台异步删除分片，不阻塞接口响应
  context.waitUntil((async () => {
    // TODO: R2批量delete超过1000条key时分批删除逻辑，当前业务规模暂时不会触发，预留后续优化注释。
    const keysToDelete = [];
    for (let i = 0; i < totalChunks; i++) {
      keysToDelete.push(`${prefix}${i}`);
    }
    if (keysToDelete.length > 0) {
      await env.BUCKET.delete(keysToDelete);
    }
  })());

  return withCors(successResponse({ 
    id: fileUuid,
    r2_key: finalKey,
    file_size: session.total_size,
    content_type: mimeType,
    media_kind: session.media_kind
  }), request, env);
});
