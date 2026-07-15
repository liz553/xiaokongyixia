import { motion } from 'motion/react';
import { UserState } from '../types';
import { History, X, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';

interface LogHistoryModalProps {
  userState: UserState;
  world: 'now' | 'ideal';
  onClose: () => void;
}

export function LogHistoryModal({ userState, world, onClose }: LogHistoryModalProps) {
  // If we are looking at the ideal world, we might want to pretend some negative logs 
  // were positive, or just show all logs. Let's just show standard logs but style differently.
    const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const localLogs = userState.logs.filter(l => l.timestamp >= startOfToday);
  
  const [logs, setLogs] = useState(localLogs);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchCloudLogs = async () => {
      const token = localStorage.getItem('auth_token');
      if (!token) return;
      
      try {
        setLoading(true);
        const today = new Date();
        today.setHours(0,0,0,0);
        const res = await apiFetch(`/api/logs/list?startDate=${today.toISOString()}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            const cloudLogs = data.data.map((l: any) => ({
                 id: l.id,
                 activityId: l.activity_type,
                 title: l.content_text || l.activity_type,
                 duration: l.duration_seconds,
                 energyChange: l.energy_change,
                 timestamp: new Date(l.created_at).getTime(),
                 choice: l.energy_change > 0 ? 'A' : 'B'
            }));
            setLogs(cloudLogs);
          }
        }
      } catch (e) {
        console.warn('Failed to fetch cloud logs, using local cache', e);
      } finally {
        setLoading(false);
      }
    };
    
    fetchCloudLogs();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-200/60 dark:bg-black/60 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md p-6 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl shadow-xl flex flex-col max-h-[80vh]"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-medium text-stone-800 dark:text-stone-100 flex items-center gap-2">
            <History className={`w-5 h-5 ${world === 'ideal' ? 'text-amber-500' : 'text-sky-500'}`} />
            今日能量轨迹
          </h2>
          <button onClick={onClose} className="p-2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
          {loading ? (
            <div className="flex justify-center py-10 text-stone-400">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-10 text-stone-500">
              今日尚未产生记录...
            </div>
          ) : (
            logs.map((log) => {
              const isIdeal = world === 'ideal';
              const isChoiceA = log.choice === 'A';
              
              let textValue = log.title || (isChoiceA ? '选择了停下来休息' : '跟着惯性继续忙碌');
              let energyVal = log.energyChange;
              let statusColorClass = '';
              let energyColorClass = '';

              if (isIdeal) {
                // Ideal World View
                if (!isChoiceA) {
                  textValue = '选择及时休息';
                  energyVal = 10;
                }
                statusColorClass = 'bg-amber-400';
                energyColorClass = 'text-amber-500';
              } else {
                // Now World View
                if (!isChoiceA) {
                  textValue = '选择继续忙碌，放弃休息';
                  energyVal = 0;
                  statusColorClass = 'bg-stone-400 dark:bg-stone-600';
                  energyColorClass = 'text-stone-400 dark:text-stone-500';
                } else {
                  statusColorClass = 'bg-sky-400';
                  energyColorClass = 'text-sky-500';
                }
              }

              const displayEnergy = `${energyVal >= 0 ? '+' : ''}${energyVal}`;
              
              return (
                <div key={log.id} className="flex items-center justify-between p-4 bg-stone-50 dark:bg-stone-800/40 rounded-2xl border border-stone-100 dark:border-stone-800/80">
                  <div className="flex items-center gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full ${statusColorClass}`} />
                    <div>
                      <div className="text-sm font-medium text-stone-700 dark:text-stone-300">
                        {textValue}
                      </div>
                      <div className="text-xs text-stone-400">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                  <div className={`text-sm font-medium ${energyColorClass}`}>
                    {displayEnergy} 能量
                  </div>
                </div>
              );
            })
          )}
        </div>
      </motion.div>
    </div>
  );
}
