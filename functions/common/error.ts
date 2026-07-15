import { errorResponse } from './response';

export function withErrorHandler(handler: (context: any) => Promise<Response>) {
  return async (context: any) => {
    try {
      return await handler(context);
    } catch (err: any) {
      console.error('Unhandled Exception in Pages Function:', err);
      // 统一异常输出，生产环境隐藏具体错误堆栈
      return errorResponse('Internal Server Error', 500, 'INTERNAL_ERROR');
    }
  };
}
