// src/utils/push.ts

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function subscribePush(vapidPublicKey: string) {
  alert('1. 开始订阅');
  try {
    alert('2. 检查 Service Worker');
    const swReg = await navigator.serviceWorker.ready;
    alert('3. SW 已就绪');

    alert('4. 请求通知权限');
    const permission = await Notification.requestPermission();
    alert('5. 权限结果: ' + permission);
    if (permission !== 'granted') {
      alert('6. 权限被拒绝，退出');
      return;
    }

    alert('6. 转换 VAPID 公钥');
    const keyArr = urlBase64ToUint8Array(vapidPublicKey);
    alert('7. 开始订阅 Push');
    const sub = await swReg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyArr
    });
    alert('8. 订阅成功：' + sub.endpoint.slice(0, 30) + '...');

    // 发送到后端保存
    const res = await fetch('/api/reminders/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: sub })
    });

    if (res.ok) {
      alert('✅ 订阅已保存到服务器！');
    } else {
      alert('⚠️ 订阅成功但保存到服务器失败');
    }
    return sub;
  } catch (e) {
    alert('❌ 错误: ' + (e as Error).message);
    throw e;
  }
}
