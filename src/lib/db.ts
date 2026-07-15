import { getAuthToken, apiFetch } from './api';
import { trackEvent } from './analytics';

const DB_NAME = 'KongKongMediaDB';
const STORE_NAME = 'media';
const DB_VERSION = 1;

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function saveLargeMedia(key: string, value: string): Promise<void> {
  return getDB().then((db) => {
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(value, key);
      request.onsuccess = () => {
        localStorage.setItem('has_local_media', 'true');
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }).catch((err) => {
    console.warn('IndexedDB write failed:', err);
  });
}

export function getLargeMedia(key: string): Promise<string | null> {
  return getDB().then((db) => {
    return new Promise<string | null>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }).catch((err) => {
    console.warn('IndexedDB read failed:', err);
    return null;
  });
}

export function deleteLargeMedia(key: string): Promise<void> {
  return getDB().then((db) => {
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }).catch((err) => {
    console.warn('IndexedDB delete failed:', err);
  });
}

export async function checkVisitorQuota(newFileSize: number): Promise<boolean> {
  const db = await getDB();
  return new Promise((resolve) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => {
      const allFiles = request.result || [];
      if (allFiles.length >= 2) {
        alert('本地离线媒体存储总数已达上限（2条）。请先删除其他项目中的媒体文件。');
        trackEvent('MEDIA_QUOTA_LIMIT_TRIGGER');
        resolve(false);
        return;
      }
      
      let totalSize = 0;
      for (const fileStr of allFiles) {
        totalSize += fileStr.length * 0.75;
      }
      
      if (totalSize + newFileSize > 200 * 1024 * 1024) {
        alert('本地离线媒体存储容量已超200MB上限，无法保存。');
        trackEvent('MEDIA_QUOTA_LIMIT_TRIGGER');
        resolve(false);
        return;
      }
      
      resolve(true);
    };
    request.onerror = () => resolve(true);
  });
}

export async function checkCloudQuota(): Promise<boolean> {
  const userStateStr = localStorage.getItem('userState');
  const userState = userStateStr ? JSON.parse(userStateStr) : {};
  const role = userState?.profile?.role || 'user';
  const limit = role === 'admin' ? Infinity : (role === 'vip' ? 5 : 2);
  
  const count = parseInt(localStorage.getItem('cloud_media_count') || '0', 10);
  if (count >= limit) {
    alert(`云端已保存 ${count} 个文件，最多可保存 ${limit} 个。请先删除不需要的文件再上传。`);
    trackEvent('MEDIA_QUOTA_LIMIT_TRIGGER');
    return false;
  }
  return true;
}

export async function uploadCloudMedia(file: File, onProgress: (p: number) => void): Promise<string | null> {
  trackEvent('UPLOAD_START', { file_size: file.size, file_type: file.type });
  try {
    const initRes = await apiFetch('/api/upload/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: file.name, file_size: file.size, content_type: file.type })
    });
    if (!initRes.ok) {
      if (initRes.status === 403) {
         alert('云端配额不足，请删除旧文件后重试');
         trackEvent('MEDIA_QUOTA_LIMIT_TRIGGER');
         return null;
      }
      throw new Error('Upload init failed');
    }
    const { uploadId } = await initRes.json();
    
    const CHUNK_SIZE = 5 * 1024 * 1024;
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    
    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);
      
      const formData = new FormData();
      formData.append('uploadId', uploadId);
      formData.append('chunkIndex', i.toString());
      formData.append('chunkData', chunk);
      
      const chunkRes = await apiFetch('/api/upload/chunk', {
        method: 'POST',
        body: formData
      });
      if (!chunkRes.ok) throw new Error('Chunk upload failed');
      onProgress(Math.round(((i + 1) / totalChunks) * 100));
    }
    
    const compRes = await apiFetch('/api/upload/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uploadId, filename: file.name, file_size: file.size, content_type: file.type })
    });
    if (!compRes.ok) throw new Error('Complete failed');
    
    const { mediaId } = await compRes.json();
    trackEvent('UPLOAD_COMPLETE');
    
    const count = parseInt(localStorage.getItem('cloud_media_count') || '0', 10);
    localStorage.setItem('cloud_media_count', (count + 1).toString());
    
    return mediaId;
  } catch (e: any) {
    trackEvent('UPLOAD_FAIL', { reason: e.message });
    alert('上传失败: ' + e.message);
    return null;
  }
}

export async function deleteCloudMedia(mediaId: string) {
  try {
    const res = await apiFetch('/api/upload/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mediaId })
    });
    if (res.ok) {
      trackEvent('UPLOAD_DELETE');
      const count = parseInt(localStorage.getItem('cloud_media_count') || '0', 10);
      localStorage.setItem('cloud_media_count', Math.max(0, count - 1).toString());
    }
  } catch (e) {
    console.error('Delete failed', e);
  }
}

export async function clearAllLocalMedia() {
  const db = await getDB();
  return new Promise<void>((resolve) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const req = store.clear();
    req.onsuccess = () => {
      localStorage.removeItem('has_local_media');
      resolve();
    };
  });
}
