const MB = 1024 * 1024;
const GB = 1024 * MB;

export type UserRole = 'user' | 'vip' | 'admin';

interface QuotaRule {
  maxFileSize: number;
  maxFileCount: number;
  maxTotalStorage: number;
}

const QUOTAS: Record<UserRole, QuotaRule> = {
  user: {
    maxFileSize: 200 * MB,
    maxFileCount: 2,
    maxTotalStorage: 300 * MB,
  },
  vip: {
    maxFileSize: 200 * MB,
    maxFileCount: 5,
    maxTotalStorage: 500 * MB,
  },
  admin: {
    maxFileSize: Infinity,
    maxFileCount: Infinity,
    maxTotalStorage: 2 * GB,
  }
};

export function checkUploadQuota(
  role: UserRole, 
  currentFileCount: number, 
  currentTotalStorage: number, 
  newFileSize: number
) {
  const quota = QUOTAS[role] || QUOTAS.user;

  if (newFileSize > quota.maxFileSize) {
    return {
      allowed: false,
      reason: `单文件大小超出限制，当前角色最大允许 ${quota.maxFileSize / MB}MB`
    };
  }

  if (currentFileCount >= quota.maxFileCount) {
    return {
      allowed: false,
      reason: `媒体文件数量超出限制，当前角色最多允许 ${quota.maxFileCount} 个文件`
    };
  }

  if (currentTotalStorage + newFileSize > quota.maxTotalStorage) {
    const totalStr = quota.maxTotalStorage >= GB 
      ? (quota.maxTotalStorage / GB) + 'GB' 
      : (quota.maxTotalStorage / MB) + 'MB';
    return {
      allowed: false,
      reason: `总存储空间不足，当前角色最大允许存储 ${totalStr}`
    };
  }

  return { allowed: true };
}
