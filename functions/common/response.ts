export function successResponse(data: any = null, message: string = 'Success', status: number = 200) {
  return new Response(JSON.stringify({
    success: true,
    message,
    data
  }), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export function errorResponse(message: string = 'Error', status: number = 400, code: string = 'ERROR') {
  return new Response(JSON.stringify({
    success: false,
    message,
    code
  }), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
