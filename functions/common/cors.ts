export function getCorsHeaders(request: Request, env: any) {
  const origin = request.headers.get('Origin');
  let allowedOrigin = '';
  
  if (origin && env.CORS_WHITELIST) {
    const whitelist = env.CORS_WHITELIST.split(',').map((url: string) => url.trim());
    if (whitelist.includes(origin)) {
      allowedOrigin = origin;
    }
  }

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

export function handleOptions(request: Request, env: any) {
  const headers = getCorsHeaders(request, env);
  if (!headers['Access-Control-Allow-Origin']) {
    return new Response(null, { status: 403 });
  }
  return new Response(null, { headers, status: 204 });
}

export function withCors(response: Response, request: Request, env: any) {
  const headers = getCorsHeaders(request, env);
  const newResponse = new Response(response.body, response);
  Object.keys(headers).forEach(key => {
    if (headers[key as keyof typeof headers]) {
      newResponse.headers.set(key, headers[key as keyof typeof headers]);
    }
  });
  return newResponse;
}
