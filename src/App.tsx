import { apiFetch } from "./lib/api";
// 
import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Bell, BarChart2, Plus, Zap, BatteryCharging, HeartPulse, User, Battery, Coffee } from 'lucide-react';
import { EXERCISES, INTERVENTION_PROMPTS } from './data';
import { UserState, Choice, ActivityLog, Exercise } from './types';
import { saveLargeMedia, getLargeMedia, deleteLargeMedia } from './lib/db';

// Components
import { Splash } from './components/Splash';
import { Avatar } from './components/Avatar';
import { ChoiceModal } from './components/ChoiceModal';
import { ExercisePlayer } from './components/ExercisePlayer';
import { Dashboard } from './components/Dashboard';
import { MorningCheckin } from './components/MorningCheckin';
import { AddCustomActivity } from './components/AddCustomActivity';
import { SecretCareModal } from './components/SecretCareModal';
import { LogHistoryModal } from './components/LogHistoryModal';
import { ExerciseListModal } from './components/ExerciseListModal';
import { ProfileModal } from './components/ProfileModal';
import { ReminderSettingsModal } from './components/ReminderSettingsModal';
import { ReminderPopup } from './components/ReminderPopup';

import { MigrationModal } from './components/MigrationModal';
import { getAuthToken, removeAuthToken } from './lib/api';


import { trackEvent } from "./lib/analytics";
import { subscribeToPush } from "./lib/push";
import { Reminder } from "./types";

type AppFlowState = 'booting' | 'splash' | 'checkin' | 'main';
type ModalState = 'none' | 'intervention' | 'exercise' | 'dashboard' | 'add_activity' | 'secret_care' | 'log_history' | 'exercise_list' | 'profile' | 'reminders';
type WorldTab = 'now' | 'ideal';

const ENERGY_MIN = 30;
const ENERGY_MAX = 100;
const DECAY_PER_HOUR = 4; // Drop 4 energy per hour idle

export default function App() {
  const [flowState, setFlowState] = useState<AppFlowState>('booting');
  const [activeTab, setActiveTab] = useState<WorldTab>('now');
  
  const [userState, setUserState] = useState<UserState>(() => {
    const saved = localStorage.getItem('userState');
    const localToken = localStorage.getItem('token');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Migration: if they don't have the new default exercises, seed them
      if (!parsed.customExercises) {
        parsed.customExercises = [...EXERCISES];
      } else {
        const hasDefaults = parsed.customExercises.some((e: Exercise) => e.type === 'default' || e.type === 'breathing');
        // if they don't have any defaults/legacy defaults, maybe they deleted them, but let's give them back the new ones once
        if (!hasDefaults) {
           parsed.customExercises = [...EXERCISES, ...parsed.customExercises];
        } else {
           // migrate legacy default types to 'default' so we can track them
           parsed.customExercises = parsed.customExercises.map((e: Exercise) => {
             if (e.type === 'breathing' || e.type === 'stretching' || e.type === 'mindfulness') {
                return { ...e, type: 'default' };
             }
             return e;
           });
           
           // If they still have the old '观呼吸' etc, we might want to let them keep them, but rename the types.
           // However it's fine as they will show up.
        }
      }
      const profile = parsed.profile || { username: '空空的朋友', avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix' };
      if (localToken && !profile.token) {
        profile.token = localToken;
      }
      if (!localToken && profile.token) {
        profile.token = undefined;
        profile.email = undefined;
      }
      return {
        ...parsed,
        profile,
        reminders: parsed.reminders || []
      };
    }
    return {
      currentEnergy: 50,
      parallelEnergy: 50,
      logs: [],
      customExercises: [...EXERCISES],
      lastWakeupTime: null,
      lastInteractionTime: Date.now(),
      profile: { username: '空空的朋友', avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix' },
      reminders: []
    };
  });

  const [activeModal, setActiveModal] = useState<ModalState>('none');
  const [currentPrompt, setCurrentPrompt] = useState<string>('');
  const [currentExercise, setCurrentExercise] = useState<Exercise | null>(null);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
  
  // Reminder tracking
  const [activeReminder, setActiveReminder] = useState<{ exercise: Exercise; message: string } | null>(null);
  const [lastReminderTime, setLastReminderTime] = useState<string>('');
  
  const [showMigration, setShowMigration] = useState<boolean>(false);



  // Listen to Push navigation
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'START_EXERCISE') {
        const { notifyType, exerciseId } = event.data.payload || {};
        if (notifyType === 'B' && exerciseId) {
          const ex = userState.customExercises.find(e => e.id === exerciseId) || EXERCISES[0];
          setCurrentExercise(ex);
          setActiveModal('exercise');
        }
      }
    };
    navigator.serviceWorker?.addEventListener('message', handleMessage);
    
    // Check URL params for push wake up
    const urlParams = new URLSearchParams(window.location.search);
    const startEx = urlParams.get('start_exercise');
    if (startEx) {
      const ex = userState.customExercises.find(e => e.id === startEx) || EXERCISES[0];
      setCurrentExercise(ex);
      setActiveModal('exercise');
      // Clean up url
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    return () => navigator.serviceWorker?.removeEventListener('message', handleMessage);
  }, [userState.customExercises]);

  // Apply energy decay on load / switch
  useEffect(() => {
    const handleAuthError = () => setActiveModal('profile');
    window.addEventListener('auth:unauthorized', handleAuthError);
    return () => window.removeEventListener('auth:unauthorized', handleAuthError);
  }, []);
  // Sync daily stats and logs on mount if logged in
  useEffect(() => {
    const fetchCloudInit = async () => {
      const token = localStorage.getItem('token');
      if (!token) return;
      try {
        const today = new Date();
        today.setHours(0,0,0,0);
        const iso = today.toISOString();
        const [statsRes, logsRes] = await Promise.all([
           apiFetch(`/api/logs/stats?startDate=${iso}`),
           apiFetch(`/api/logs/list?startDate=${iso}`)
        ]);
        if (statsRes.ok && logsRes.ok) {
          const statsData = await statsRes.json();
          const logsData = await logsRes.json();
          if (statsData.success && logsData.success) {
            setUserState(prev => {
              const totalEnergy = statsData.data.total_energy || 0;
              const count = statsData.data.activity_group?.reduce((acc: number, cur: any) => acc + cur.count, 0) || 0;
              
              const cloudLogs = logsData.data.map((l: any) => ({
                 id: l.id,
                 exerciseId: l.activity_type,
                 title: l.content_text || l.activity_type,
                 
                 energyChange: l.energy_change,
                 timestamp: new Date(l.created_at).getTime(),
                 choice: l.energy_change > 0 ? 'A' : 'B'
              }));
              cloudLogs.sort((a: ActivityLog, b: ActivityLog) => b.timestamp - a.timestamp);
              
              const oldLogs = prev.logs.filter(l => l.timestamp < today.getTime());
              const mergedLogs = [...cloudLogs, ...oldLogs];

              return {
                ...prev,
                currentEnergy: Math.max(30, Math.min(100, 50 + totalEnergy)),
                parallelEnergy: Math.max(30, Math.min(100, 50 + count * 10)),
                logs: mergedLogs
              };
            });
          }
        }
      } catch (e) {
        console.warn('Failed to fetch cloud init data, using local cache', e);
      }
    };
    fetchCloudInit();
  }, []);



    // Call subscribe to push on app load if logged in
    const token = localStorage.getItem('token');
    if (token) {
      if (userState.receiveEndNotification || userState.allowReminders) {
         subscribeToPush();
      }
    }

  useEffect(() => {
    const checkReminders = () => {
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      
      if (currentTime === lastReminderTime) return;

      // 1. Check User Reminders
      const userReminder = userState.reminders.find(r => r.enabled && r.time === currentTime);
      if (userReminder) {
        const exercise = userState.customExercises.find(e => e.id === userReminder.exerciseId) || EXERCISES[0];
        setLastReminderTime(currentTime);
        setActiveReminder({
          exercise,
          message: `${currentTime}点到了，${userState.profile.username}，来做个${exercise.title}放松一下吧。`
        });
        return;
      }

      // 2. Check Default Reminders (if no user reminder in +/- 1 hour window is not trivial, we'll check if any user reminder is active around now)
      if (userState.allowReminders === false) return; // User opted out of system reminders

      const hasUserReminderNearby = userState.reminders.some(r => {
        if (!r.enabled) return false;
        const [rh, rm] = r.time.split(':').map(Number);
        const rDate = new Date();
        rDate.setHours(rh, rm, 0);
        const diffMinutes = Math.abs((now.getTime() - rDate.getTime()) / (1000 * 60));
        return diffMinutes <= 60;
      });

      if (!hasUserReminderNearby) {
        const h = now.getHours();
        const m = now.getMinutes();
        
        const defaultMessages: Record<string, string> = {
          "10:00": "10点了，进来放空一下吧，让精神小小放松一下。",
          "11:00": "11点了，身体累了吗？休息一会儿再继续吧。",
          "11:40": "11:40了，准备吃午饭吧，为身体补充能量。",
          "12:40": "12:40了，午休一下吧，空空陪你睡个好觉。",
          "14:00": "14点了，做个冥想，从观呼吸开启清醒的下午吧。",
          "15:00": "15点了，站起来走走，活动一下僵硬的关节。",
          "16:00": "16点了，深呼吸，找回此刻的平静。",
          "17:00": "17点了，辛苦啦，让我们一起放下压力。",
          "17:40": "17:40了，准备吃晚饭吧，记得好好吃饭哦。",
          "21:00": "21:00了，时间不早了，放空一下吧，帮助入睡。"
        };

        if (defaultMessages[currentTime]) {
          setLastReminderTime(currentTime);
          let exercise = EXERCISES[0]; // Default to meditation
          if (currentTime === "15:00") exercise = EXERCISES[1]; // Squat/Stretch
          if (currentTime === "11:40" || currentTime === "17:40" || currentTime === "12:40") {
             // These are just notices, maybe use a "Drink Water" or simple rest activity
             exercise = EXERCISES[2]; 
          }

          setActiveReminder({
            exercise,
            message: defaultMessages[currentTime]
          });
        }
      }
    };

    const interval = setInterval(checkReminders, 10000); // Check every 10s
    return () => clearInterval(interval);
  }, [userState, lastReminderTime]);

  useEffect(() => {
    if (userState.lastInteractionTime) {
      const now = Date.now();
      const hoursElapsed = (now - userState.lastInteractionTime) / (1000 * 60 * 60);
      if (hoursElapsed > 0.5) {
        setUserState(prev => {
          const dropNow = hoursElapsed * DECAY_PER_HOUR;
          const dropIdeal = hoursElapsed * 1;
          return {
            ...prev,
            currentEnergy: Math.max(ENERGY_MIN, prev.currentEnergy - dropNow),
            parallelEnergy: Math.max(ENERGY_MIN, prev.parallelEnergy - dropIdeal),
            lastInteractionTime: now,
          };
        });
      }
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('userState', JSON.stringify(userState));
    } catch (error: any) {
      console.error('Failed to save state to localStorage:', error);
      if (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
        alert('由于本地存储限制（通常为5MB），保存失败。\n建议：清理一些不必要的日志。');
      }
    }
  }, [userState]);

  useEffect(() => {
    trackEvent('PAGE_VIEW');
    setFlowState('splash');
  }, []);

  
  const checkMigration = async () => {
    try {
       const hasLocal = localStorage.getItem('has_local_media'); // just a fast check flag or query indexedDB
       // For now, if visitor had stuff, we show migration
       // In a real app we query IndexedDB.
       setShowMigration(true);
    } catch(e) {}
  };

  const handleSyncMedia = async () => {
    // Sync logic would upload chunks via api/upload/chunk
    setShowMigration(false);
  };
  
  const handleSkipMedia = async () => {
    // Clear indexedDB
    setShowMigration(false);
  };

  const handleSplashComplete = () => {
    const today = new Date().toDateString();
    const lastWakeupDate = userState.lastWakeupTime ? new Date(userState.lastWakeupTime).toDateString() : null;
    
    if (lastWakeupDate !== today) {
      setFlowState('checkin');
    } else {
      setFlowState('main');
    }
  };


  // Sync a newly created log to cloud if logged in

  const syncRemindersToCloud = async (reminders: Reminder[]) => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      await apiFetch('/api/reminders/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reminders })
      });
    } catch(e) {
      console.warn('Failed to sync reminders', e);
    }
  };

  const syncLogToCloud = async (log: ActivityLog) => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      await apiFetch('/api/logs/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activity_type: log.exerciseId || log.title || 'default',
          duration_seconds: 0,
          energy_change: log.energyChange,
          content_text: log.title || ''
        })
      });
    } catch(e) {
      console.warn('Failed to sync log to cloud', e);
    }
  };

  const handleMorningCheckin = (initialEnergy: number) => {
    setUserState(prev => ({
      ...prev,
      currentEnergy: initialEnergy,
      parallelEnergy: initialEnergy,
      lastWakeupTime: Date.now(),
      lastInteractionTime: Date.now(),
    }));
    setFlowState('main');
    trackEvent('LONG_PRESS_TRIGGER', { init_energy: initialEnergy });
  };

  const triggerIntervention = () => {
    const prompt = INTERVENTION_PROMPTS[Math.floor(Math.random() * INTERVENTION_PROMPTS.length)];
    setCurrentPrompt(prompt);
    setActiveModal('intervention');
    trackEvent('intervention_triggered', { prompt });
  };

  // Intervention logic
  const handleChooseA = () => {
    setActiveModal('exercise_list');
    trackEvent('XIAOKONG_CLICK');
  };

  const handleChooseB = () => {
    const energyPenalty = 0;
    const newLog: ActivityLog = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
      choice: 'B',
      title: "选择继续忙碌，放弃休息",
      energyChange: energyPenalty,
    };
    
    setUserState(prev => ({
      ...prev,
      currentEnergy: Math.max(ENERGY_MIN, prev.currentEnergy - energyPenalty),
      parallelEnergy: Math.min(ENERGY_MAX, prev.parallelEnergy + 10), // Parallel user rests mentally
      lastInteractionTime: Date.now(),
      logs: [newLog, ...prev.logs],
    }));
    syncLogToCloud(newLog);
    
    setActiveModal('none');
    trackEvent('BUSY_CLICK');
  };

  const handleExerciseSelect = (exercise: Exercise) => {
    setCurrentExercise(exercise);
    setActiveModal('exercise');
  };

  const aChoiceMode = activeTab === 'ideal'; // Are we operating under ideal projection?

  const handleExerciseComplete = (dynamicBoost?: number) => {
    if (!currentExercise) return;
    
    const boost = typeof dynamicBoost === 'number' ? dynamicBoost : currentExercise.energyBoost;
    const newLog: ActivityLog = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
      choice: 'A',
      exerciseId: currentExercise.id,
      title: currentExercise.title,
      energyChange: boost,
    };

    setUserState(prev => ({
      ...prev,
      // If we are in "ideal" view, and we do an activity, it technically buffs both?
      // Yes, if you actually do it, it applies to both.
      currentEnergy: Math.min(ENERGY_MAX, prev.currentEnergy + boost),
      parallelEnergy: Math.min(ENERGY_MAX, prev.parallelEnergy + boost),
      lastInteractionTime: Date.now(),
      logs: [newLog, ...prev.logs],
    }));
    syncLogToCloud(newLog);

    setActiveModal('none');
    setCurrentExercise(null);
    trackEvent('exercise_completed', { exerciseId: currentExercise.id });
  };

  const handleSaveExercise = (exercise: Exercise) => {
    setUserState(prev => {
      const exists = prev.customExercises.some(e => e.id === exercise.id);
      if (exists) {
        return {
          ...prev,
          customExercises: prev.customExercises.map(e => e.id === exercise.id ? exercise : e)
        };
      } else {
        return {
          ...prev,
          customExercises: [...prev.customExercises, exercise]
        };
      }
    });
    setActiveModal('none');
    setEditingExercise(null);
    trackEvent('ADD_CLICK', { task_name: exercise.title });
  };

  const handleDeleteExercise = (id: string) => {
    const exercise = userState.customExercises.find(e => e.id === id);
    if (exercise?.contentUrl?.startsWith('cloud_ref:')) {
      const mediaId = exercise.contentUrl.replace('cloud_ref:', '');
      import('./lib/db').then(m => m.deleteCloudMedia(mediaId).catch(console.error));
    } else {
      deleteLargeMedia(`media_${id}`).catch(err => console.warn('Failed to delete large media:', err));
    }
    setUserState(prev => ({
      ...prev,
      customExercises: prev.customExercises.filter(e => e.id !== id)
    }));
    setActiveModal('none');
    setEditingExercise(null);
    import('./lib/analytics').then(m => m.trackEvent('exercise_deleted', { id }));
  };

  const handleEditExerciseRequest = (exercise: Exercise) => {
    setEditingExercise(exercise);
    setActiveModal('add_activity');
  };

  const handleSecretCare = (title: string, boost: number) => {
    const newLog: ActivityLog = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
      choice: 'A',
      title,
      energyChange: boost,
    };
    
    setUserState(prev => ({
      ...prev,
      currentEnergy: Math.min(ENERGY_MAX, prev.currentEnergy + boost),
      parallelEnergy: Math.min(ENERGY_MAX, prev.parallelEnergy + (boost * 0.5)),
      lastInteractionTime: Date.now(),
      logs: [newLog, ...prev.logs],
    }));
    syncLogToCloud(newLog);
    setActiveModal('none');
    trackEvent('TREAT_CLICK');
  };

  if (flowState === 'booting') return null;

  const currentConfig = {
    now: {
      bg: 'bg-stone-50 dark:bg-stone-950',
      textColor: 'text-stone-900 dark:text-stone-100',
      labelColor: 'text-stone-500',
      energyColor: 'text-stone-600 dark:text-stone-400',
      message: "空空就在这里，陪着你此刻的样子",
      isIdeal: false
    },
    ideal: {
      bg: 'bg-[#fefce8] dark:bg-[#1a1c1a]', // warm ethereal or calm dark green
      textColor: 'text-amber-900 dark:text-teal-50',
      labelColor: 'text-amber-600 dark:text-teal-500',
      energyColor: 'text-amber-700 dark:text-teal-400',
      message: "如果累了就小空一下，空空会变这样哦",
      isIdeal: true
    }
  }[activeTab];

  return (
    <div className={`min-h-screen font-sans selection:bg-sky-500/30 overflow-hidden transition-colors duration-700 ${currentConfig.bg} ${currentConfig.textColor}`}>
      
      <AnimatePresence mode="wait">
        {flowState === 'splash' && (
          <Splash key="splash" onComplete={handleSplashComplete} />
        )}

        {flowState === 'checkin' && (
          <MorningCheckin key="checkin" onCheckIn={handleMorningCheckin} />
        )}
      </AnimatePresence>

      {flowState === 'main' && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1 }}
          className="relative h-screen min-h-screen flex flex-col justify-between p-6 pb-8 overflow-hidden"
        >
          {/* Top Actions Layer */}
          <header className="flex justify-between items-start z-30">
            {/* View Toggles */}
            <div className="flex flex-col gap-2">
              <button 
                onClick={() => setActiveTab('now')}
                className={`text-base font-medium tracking-widest transition-colors ${activeTab === 'now' ? 'text-stone-800 dark:text-stone-100' : 'text-stone-400 dark:text-stone-600'}`}
              >
                空空现在
              </button>
              <button 
                onClick={() => { setActiveTab('ideal'); import('./lib/analytics').then(m => m.trackEvent('IDEAL_CLICK')); }}
                className={`text-base font-medium tracking-widest transition-colors ${activeTab === 'ideal' ? 'text-amber-600 dark:text-teal-400' : 'text-stone-400 dark:text-stone-600'}`}
              >
                空空如果
              </button>
            </div>
            
            {/* Tools Toggles */}
            <div className="flex gap-2 mt-1">
              <button 
                onClick={() => {
                  const role = userState.profile.role || 'visitor';
                  const maxCount = role === 'admin' ? Infinity : (role === 'visitor' ? 3 : 5);
                  if (userState.customExercises.length >= maxCount) {
                    alert(`小空活动数量已达上限（${maxCount}个），请删除部分后再添加。`);
                    import('./lib/analytics').then(m => m.trackEvent('ACTIVITY_QUOTA_LIMIT_TRIGGER'));
                    return;
                  }
                  setActiveModal('add_activity');
                }}
                className="flex items-center justify-center w-10 h-10 bg-white/50 dark:bg-stone-900/50 backdrop-blur-md border border-stone-200 dark:border-stone-800 rounded-full hover:bg-white dark:hover:bg-stone-800 transition-colors shadow-sm"
              >
                <Plus className="w-4 h-4 text-stone-600 dark:text-stone-300" />
              </button>
              
              <button 
                onClick={() => {
                  setActiveModal('dashboard');
                  trackEvent('ENERGY_CLICK');
                }}
                className="flex items-center justify-center w-10 h-10 bg-white/50 dark:bg-stone-900/50 backdrop-blur-md border border-stone-200 dark:border-stone-800 rounded-full hover:bg-white dark:hover:bg-stone-800 transition-colors shadow-sm"
              >
                <BarChart2 className="w-4 h-4 text-stone-600 dark:text-stone-300" />
              </button>

              <button 
                onClick={() => setActiveModal('profile')}
                className="flex items-center justify-center w-10 h-10 bg-white/50 dark:bg-stone-900/50 backdrop-blur-md border border-stone-200 dark:border-stone-800 rounded-full hover:bg-white dark:hover:bg-stone-800 transition-colors shadow-sm"
              >
                <User className="w-4 h-4 text-stone-600 dark:text-stone-300" />
              </button>
            </div>
          </header>
          
          {/* Main Companion Display */}
          <main className="flex flex-col items-center justify-center flex-1 py-4">
            <Avatar 
              energy={activeTab === 'now' ? userState.currentEnergy : userState.parallelEnergy} 
              size="xl" 
              variant={activeTab === 'now' ? 'current' : 'ideal'} 
              className="scale-100 transition-transform duration-500"
            />
            
            <div className="mt-8 text-center w-full px-8 max-w-sm mx-auto">
              <p className={`text-sm sm:text-base font-serif tracking-widest leading-relaxed ${currentConfig.labelColor}`}>
                {currentConfig.message}
              </p>
            </div>
          </main>

          {/* Bottom Action Bar */}
          <div className="w-full z-30">
            <div className={`grid ${activeTab === 'now' ? 'grid-cols-3' : 'grid-cols-2'} gap-3 w-full max-w-lg mx-auto`}>
              
              {/* Energy Button */}
              <button 
                onClick={() => setActiveModal('log_history')}
                className="flex flex-col items-center justify-center py-4 px-2 bg-stone-100/50 dark:bg-stone-900/60 backdrop-blur-md border border-stone-200/30 dark:border-stone-800 rounded-[1.75rem] hover:scale-[1.02] active:scale-[0.98] transition-all shadow-sm group"
              >
                <Battery className="w-4 h-4 text-stone-400 group-hover:text-stone-600 dark:group-hover:text-stone-300 transition-colors" />
                <span className="text-[10px] font-normal text-stone-400 dark:text-stone-500 mt-2 tracking-widest whitespace-nowrap">
                  当前能量
                </span>
                <span className="text-xl font-semibold text-stone-800 dark:text-stone-200 mt-0.5 font-mono">
                  {Math.floor(activeTab === 'now' ? userState.currentEnergy : userState.parallelEnergy)}
                </span>
              </button>

              {/* Take a break Button */}
              <button 
                onClick={() => setActiveModal('exercise_list')}
                className={`flex flex-col items-center justify-center py-4 px-2 backdrop-blur-md rounded-[1.75rem] hover:scale-[1.02] active:scale-[0.98] transition-all shadow-sm group ${
                  activeTab === 'now'
                    ? 'bg-sky-50/70 dark:bg-sky-950/20 border border-sky-100/50 dark:border-sky-900/30'
                    : 'bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/30'
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform ${
                  activeTab === 'now'
                    ? 'bg-sky-500 text-white'
                    : 'bg-amber-400 dark:bg-amber-500 text-white'
                }`}>
                  <Zap className="w-3.5 h-3.5 fill-white" />
                </div>
                <span className={`text-xs font-medium tracking-widest mt-2 whitespace-nowrap ${
                  activeTab === 'now'
                    ? 'text-sky-800 dark:text-sky-300'
                    : 'text-amber-800 dark:text-amber-300'
                }`}>
                  小空一下
                </span>
              </button>
              
              {/* Secret Care Button (Only in "Now" view logically) */}
              {activeTab === 'now' && (
                <button 
                  onClick={() => setActiveModal('secret_care')}
                  className="flex flex-col items-center justify-center py-4 px-2 bg-stone-100/50 dark:bg-stone-900/60 backdrop-blur-md border border-stone-200/30 dark:border-stone-800 rounded-[1.75rem] hover:scale-[1.02] active:scale-[0.98] transition-all shadow-sm group"
                >
                  <div className="w-8 h-8 rounded-full bg-stone-200/80 dark:bg-stone-800 text-stone-500 dark:text-stone-400 flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                    <Coffee className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-medium text-stone-600 dark:text-stone-300 tracking-widest mt-2 whitespace-nowrap">
                    偷偷关照
                  </span>
                </button>
              )}
            </div>
          </div>

        </motion.div>
      )}

      {/* Modals Container */}
      <AnimatePresence mode="wait">
        {activeModal === 'intervention' && (
          <ChoiceModal 
            key="intervention"
            prompt={currentPrompt}
            userState={userState}
            onChooseA={handleChooseA}
            onChooseB={handleChooseB}
          />
        )}
        
        {activeModal === 'exercise_list' && (
          <ExerciseListModal
            key="exercise_list"
            exercises={userState.customExercises}
            onSelect={handleExerciseSelect}
            onEditRequest={handleEditExerciseRequest}
            onClose={() => setActiveModal('none')}
          />
        )}
        
        {activeModal === 'exercise' && currentExercise && (
          <ExercisePlayer 
            key="exercise"
            exercise={currentExercise}
            onComplete={handleExerciseComplete}
          />
        )}
        
        {activeModal === 'add_activity' && (
          <AddCustomActivity 
            key="add_activity"
            existingExercise={editingExercise}
            onSave={handleSaveExercise}
            onDelete={handleDeleteExercise}
            onClose={() => {
              setEditingExercise(null);
              setActiveModal('none');
            }}
          />
        )}

        {activeModal === 'secret_care' && (
          <SecretCareModal
            key="secret_care"
            onAdd={handleSecretCare}
            onClose={() => setActiveModal('none')}
          />
        )}

        {activeModal === 'dashboard' && (
          <Dashboard 
            key="dashboard"
            userState={userState}
            onOpenHistory={() => setActiveModal('log_history')}
            onClose={() => setActiveModal('none')}
          />
        )}

        {activeModal === 'log_history' && (
          <LogHistoryModal
            key="log_history"
            userState={userState}
            world={activeTab}
            onClose={() => setActiveModal('none')}
          />
        )}

        {activeModal === 'profile' && (
          <ProfileModal
            key="profile"
            profile={userState.profile}
            onUpdate={(profile) => setUserState(prev => ({ ...prev, profile }))}
            onOpenReminders={() => setActiveModal('reminders')}
            onClose={() => setActiveModal('none')}
          />
        )}

        {activeModal === 'reminders' && (
          <ReminderSettingsModal
            key="reminders"
            reminders={userState.reminders}
            exercises={userState.customExercises}
            allowReminders={userState.allowReminders ?? true}
            onSave={(reminders, allowReminders) => {
              setUserState(prev => ({ ...prev, reminders, allowReminders }));
              syncRemindersToCloud(reminders);
              import('./lib/analytics').then(m => m.trackEvent('REMINDER_SET'));
            }}
            onBack={() => setActiveModal('profile')}
            onClose={() => setActiveModal('none')}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeReminder && (
          <ReminderPopup
            key="reminder-popup"
            exercise={activeReminder.exercise}
            message={activeReminder.message}
            onAccept={() => {
              handleExerciseSelect(activeReminder.exercise);
              setActiveReminder(null);
            }}
            onBusy={() => {
              handleChooseB();
              setActiveReminder(null);
            }}
            onDismiss={() => setActiveReminder(null)}
          />
        )}
      </AnimatePresence>

    </div>
  );
}
