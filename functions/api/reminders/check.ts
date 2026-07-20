export async function onRequestGet({ env }) {
  return Response.json({
    公钥存在: !!env.VAPID_PUBLIC_KEY,
    私钥存在: !!env.VAPID_PRIVATE_KEY,
    公钥长度: env.VAPID_PUBLIC_KEY?.length || 0,
    私钥长度: env.VAPID_PRIVATE_KEY?.length || 0
  })
}
