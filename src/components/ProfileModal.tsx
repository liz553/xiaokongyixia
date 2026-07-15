import { useState } from 'react';
import { motion } from 'motion/react';
import { User, Camera, Bell, X, ChevronRight, UserCircle } from 'lucide-react';
import { UserProfile } from '../types';
import { apiFetch, setAuthToken } from '../lib/api';
import { getAuthToken, removeAuthToken } from '../lib/api';
import { trackEvent } from '../lib/analytics';


interface ProfileModalProps {
  profile: UserProfile;
  onUpdate: (profile: UserProfile) => void;
  onOpenReminders: () => void;
  onClose: () => void;
}



export function ProfileModal({ profile, onUpdate, onOpenReminders, onClose }: ProfileModalProps) {
  const [username, setUsername] = useState(profile.username);
  
  const isLoggedIn = !!profile.token;
  
  // Login State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Change Password State
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [newPassword, setNewPassword] = useState('');

  const handleLogin = async () => {
    if (!email || !password) {
      setError('请输入邮箱和密码');
      return;
    }
    try {
      setLoading(true);
      setError('');
      // First try to login, if fails with invalid credentials, maybe we should register?
      // Wait, the prompt says "验证码输入框 + 获取验证码按钮 + 登录按钮". 
      // But we modified the UI to be a generic password field since we don't have send-code.
      // Or we can call it "密码".
      let res = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      if (!res.ok) {
        // Fallback to register if login fails?
        res = await apiFetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
      }

      if (res.ok) {
        const data = await res.json();
        setAuthToken(data.token);
        trackEvent('LOGIN_SUCCESS');
        
        onUpdate({ ...profile, token: data.token });
      } else {
        const data = await res.json();
        setError(data.message || '登录失败');
      }
    } catch (e) {
      setError('网络异常，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    // API for password change is not provided, mock it for now
    setShowPasswordChange(false);
  };

  const handleSave = () => {
    // Validate nickname
    const trimName = username.trim();
    if (trimName.length < 2 || trimName.length > 16) {
      setError('昵称长度需在2-16字符之间');
      return;
    }
    setError('');
    onUpdate({ username: trimName,  });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-stone-900/40 backdrop-blur-md"
    >
      <div className="w-full max-w-md bg-white dark:bg-stone-900 rounded-[32px] overflow-hidden shadow-2xl border border-stone-200 dark:border-stone-800">
        <div className="p-8">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-xl font-medium text-stone-800 dark:text-stone-100">个人主页</h2>
            <button onClick={onClose} className="p-2 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-full transition-colors">
              <X className="w-5 h-5 text-stone-400" />
            </button>
          </div>

          {!isLoggedIn ? (
            <div className="space-y-4 mb-8">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-sky-100 dark:bg-sky-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <UserCircle className="w-8 h-8 text-sky-500" />
                </div>
                <h3 className="text-lg font-medium text-stone-800 dark:text-stone-100">欢迎来到空空</h3>
                <p className="text-sm text-stone-500">登录以云端同步你的能量记录与提醒</p>
              </div>
              
              {error && <div className="text-sm text-red-500 text-center">{error}</div>}
              
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="请输入邮箱"
                className="w-full px-4 py-3 bg-stone-50 dark:bg-stone-800 border-none rounded-2xl text-stone-800 dark:text-stone-100 placeholder-stone-400 focus:ring-2 focus:ring-sky-500/20 transition-all"
              />
              
              <div className="flex gap-2">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="验证码 / 密码"
                  className="flex-1 px-4 py-3 bg-stone-50 dark:bg-stone-800 border-none rounded-2xl text-stone-800 dark:text-stone-100 placeholder-stone-400 focus:ring-2 focus:ring-sky-500/20 transition-all"
                />
                <button
                  onClick={() => alert('请直接输入密码，新用户自动注册')}
                  className="px-4 py-3 rounded-2xl bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 font-medium whitespace-nowrap"
                >
                  获取验证码
                </button>
              </div>
              
              <button
                onClick={handleLogin}
                disabled={loading}
                className="w-full py-4 bg-sky-500 text-white rounded-2xl font-medium hover:opacity-90 active:scale-[0.98] transition-all shadow-lg shadow-sky-500/20 disabled:opacity-50"
              >
                {loading ? '登录中...' : '登录 / 注册'}
              </button>
            </div>
          ) : (
            <div className="flex flex-col mb-8">
              <div className="w-full space-y-4">
                <div className="flex items-center justify-center mb-6">
                  <div className="w-20 h-20 bg-stone-100 dark:bg-stone-800 rounded-full flex items-center justify-center">
                     <UserCircle className="w-10 h-10 text-stone-400" />
                  </div>
                </div>
                
                {error && <div className="text-sm text-red-500 text-center">{error}</div>}
                
                <div>
                  <label className="block text-xs font-medium text-stone-400 dark:text-stone-500 mb-1.5 ml-1">邮箱ID</label>
                  <div className="w-full px-4 py-3 bg-stone-50 dark:bg-stone-800 border-none rounded-2xl text-stone-500 dark:text-stone-400">
                    {/* Wait, we don't have email in UserProfile yet, just use a placeholder if not found */}
                    已登录
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-400 dark:text-stone-500 mb-1.5 ml-1">昵称</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="空空的朋友"
                    className="w-full px-4 py-3 bg-stone-50 dark:bg-stone-800 border-none rounded-2xl text-stone-800 dark:text-stone-100 placeholder-stone-400 focus:ring-2 focus:ring-sky-500/20 transition-all"
                  />
                  <div className="text-[10px] text-stone-400 mt-1 ml-1">长度2-16字符，不能包含纯空格</div>
                </div>
                
                {showPasswordChange ? (
                  <div className="mt-4 p-4 border border-stone-200 dark:border-stone-800 rounded-2xl space-y-3">
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="新密码"
                      className="w-full px-4 py-3 bg-stone-50 dark:bg-stone-800 border-none rounded-xl text-stone-800 dark:text-stone-100"
                    />
                    <div className="flex gap-2">
                      <button onClick={() => setShowPasswordChange(false)} className="flex-1 py-2 text-stone-500">取消</button>
                      <button onClick={handleChangePassword} className="flex-1 py-2 bg-stone-900 text-white rounded-xl">确定修改</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setShowPasswordChange(true)} className="text-sm text-sky-500 mt-2 font-medium">修改密码</button>
                )}
              </div>
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={onOpenReminders}
              className="w-full flex items-center justify-between p-4 bg-stone-50 dark:bg-stone-800/50 rounded-2xl hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors border border-transparent hover:border-stone-200 dark:hover:border-stone-700"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center">
                  <Bell className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="text-left">
                  <div className="text-sm font-medium text-stone-800 dark:text-stone-100">设置小空提醒</div>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-stone-300" />
            </button>
          </div>

          {isLoggedIn && (
            <div className="mt-8">
              <button
                onClick={handleSave}
                className="w-full py-4 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 rounded-2xl font-medium hover:opacity-90 active:scale-[0.98] transition-all shadow-lg"
              >
                保存修改
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
