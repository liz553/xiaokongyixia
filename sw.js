const CACHE_NAME = 'my-pwa-v1';

// 安装阶段：直接跳过 waiting 激活
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// 激活阶段：清理旧版本缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 核心网络请求拦截
self.addEventListener('fetch', (event) => {
  // 1. 忽略非 GET 请求，直接透传网络
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);

  // 2. 媒体播放资源：不纳入缓存，直接透传（无需经过缓存判断机制）
  if (url.pathname.startsWith('/api/video-proxy')) {
    return;
  }

  // 3. 所有后端 API：永久禁用缓存，强制网络优先
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // 4. 静态资源：缓存优先，后台异步更新 (Stale-While-Revalidate)
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cachedResponse = await cache.match(event.request);
      
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        // 仅缓存有效响应（状态码 200），且限制为 basic 或 cors
        if (networkResponse && networkResponse.status === 200 && (networkResponse.type === 'basic' || networkResponse.type === 'cors')) {
          cache.put(event.request, networkResponse.clone());
        }
        return networkResponse;
      }).catch((err) => {
        // 如果离线且本地没有缓存，则正常抛出异常；若有缓存则静默吞掉网络错误
        if (!cachedResponse) {
          throw err;
        }
      });

      // 命中缓存立即返回，后台继续执行 fetchPromise 更新缓存；否则等待网络响应
      return cachedResponse || fetchPromise;
    })
  );
});

// ==== Push Notifications ====
self.addEventListener('push', function(event) {
  if (!event.data) return;

  try {
    const data = event.data.json();
    let title = '空空提醒';
    let options = {
      body: '该休息一下了。',
      icon: '/icon.png',
      badge: '/icon.png',
      data: data
    };

    if (data.notifyType === 'A') {
      title = '倒计时结束';
      options.body = '本次放松已经完成。';
    } else if (data.notifyType === 'B') {
      title = '小空提醒';
      options.body = '时间到了，进来放松一下吧。';
    }

    event.waitUntil(
      self.registration.showNotification(title, options)
    );
  } catch (e) {
    console.error('Push payload parse error:', e);
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  const payload = event.notification.data || {};
  let targetUrl = '/';
  
  // You can set query params to auto-start an exercise if notifyType is B
  if (payload.notifyType === 'B' && payload.exerciseId) {
    targetUrl = '/?start_exercise=' + payload.exerciseId;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // Check if we already have a window open
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url.includes(self.registration.scope) && 'focus' in client) {
          client.postMessage({ type: 'START_EXERCISE', payload });
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
