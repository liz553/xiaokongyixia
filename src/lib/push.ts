import { apiFetch } from './api';

export const urlBase64ToUint8Array = (base64String: string) => {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

export const subscribeToPush = async () => {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push not supported');
    return null;
  }

  const registration = await navigator.serviceWorker.ready;
  
  // Public key should come from env. For local dev we mock it, or get it from server?
  // We can provide an endpoint to fetch public key, or hardcode the env var.
  // Using an endpoint is better if we don't want to expose it in client build, 
  // but it's safe to expose public key. Let's assume it's in process.env.VITE_VAPID_PUBLIC_KEY
  const vapidPublicKey = (import.meta as any).env.VITE_VAPID_PUBLIC_KEY || 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuB-5ZpX29yViEuiBIa-Ib9-Sk'; 

  try {
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
    });

    // Send to backend
    await apiFetch('/api/reminders/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription })
    });

    return subscription;
  } catch (err) {
    console.error('Failed to subscribe the user: ', err);
    return null;
  }
};
