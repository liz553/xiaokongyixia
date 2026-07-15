import { successResponse, errorResponse } from '../../common/response';
import { withErrorHandler } from '../../common/error';
import { handleOptions, withCors } from '../../common/cors';
import { getAuthUserId } from '../../common/jwt';

export const onRequestOptions = (context: any) => handleOptions(context.request, context.env);

export const onRequestPost = withErrorHandler(async (context: any) => {
  const { request, env } = context;
  const userId = await getAuthUserId(request, env);
  
  if (!userId) {
    return withCors(errorResponse('未授权访问', 401, 'UNAUTHORIZED'), request, env);
  }

  // 获取formData
  let formData;
  try {
    formData = await request.formData();
  } catch (e) {
    return withCors(errorResponse('无效的请求体格式', 400, 'INVALID_BODY'), request, env);
  }

  const uploadId = formData.get('uploadId');
  const chunkIndexStr = formData.get('chunkIndex');
  const file = formData.get('file');

  if (!uploadId || !chunkIndexStr || !file) {
    return withCors(errorResponse('缺少必要参数', 400, 'MISSING_PARAMS'), request, env);
  }

  // 1. 增加 chunkIndex 完整校验逻辑
  const chunkIndex = parseInt(chunkIndexStr as string, 10);
  if (isNaN(chunkIndex)) {
    return withCors(errorResponse('chunkIndex非法，必须为数字', 400, 'INVALID_INDEX'), request, env);
  }

  const session = await env.DB.prepare('SELECT user_id, total_chunks FROM upload_sessions WHERE upload_id = ?').bind(uploadId).first();
  if (!session) {
    return withCors(errorResponse('上传会话不存在', 404, 'SESSION_NOT_FOUND'), request, env);
  }
  if (session.user_id !== userId) {
    return withCors(errorResponse('无权访问该会话', 403, 'FORBIDDEN'), request, env);
  }
  if (chunkIndex < 0 || chunkIndex >= session.total_chunks) {
    return withCors(errorResponse('chunkIndex超出范围', 400, 'INDEX_OUT_OF_BOUNDS'), request, env);
  }

  // TODO: 分片重复上传幂等校验（同一uploadId+chunkIndex重复提交覆盖），后续优化。
  
  const tempPath = `uploads/temp/${uploadId}/${chunkIndex}`;
  
  // 2. 将 FormData 获取的 File 对象转换为 ReadableStream 后上传，兼容 Workers 环境
  const stream = (file as File).stream();
  await env.BUCKET.put(tempPath, stream);

  return withCors(successResponse({ chunkIndex, uploaded: true }), request, env);
});
