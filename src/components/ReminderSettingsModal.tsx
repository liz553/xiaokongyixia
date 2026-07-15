import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, Plus, Trash2, X, Clock, ChevronLeft, Check } from 'lucide-react';
import { Reminder, Exercise } from '../types';

interface ReminderSettingsModalProps {
  reminders: Reminder[];
  exercises: Exercise[];
  allowReminders?: boolean;
  onSave: (reminders: Reminder[], allowReminders: boolean, receiveEndNotification?: boolean) => void;
  onBack: () => void;
  onClose: () => void;
}

export function ReminderSettingsModal({ reminders, exercises, allowReminders = true, receiveEndNotification: initialReceiveEnd = false, onSave, onBack, onClose }: ReminderSettingsModalProps & { receiveEndNotification?: boolean }) {
  const [globalAllow, setGlobalAllow] = useState<boolean>(allowReminders);
  const [receiveEndNotification, setReceiveEndNotification] = useState(initialReceiveEnd);
  const [localReminders, setLocalReminders] = useState<Reminder[]>(reminders);
  const [editingId, setEditingId] = useState<string | null>(null); // 'new' or specific reminder id, or null
  const [time, setTime] = useState("14:00");
  const [exerciseId, setExerciseId] = useState(exercises[0]?.id || "");

  const handleOpenAdd = () => {
    setEditingId('new');
    setTime("14:00");
    setExerciseId(exercises[0]?.id || "");
  };

  const handleOpenEdit = (reminder: Reminder) => {
    setEditingId(reminder.id);
    setTime(reminder.time);
    setExerciseId(reminder.exerciseId);
  };

  const handleSave = () => {
    let updated: Reminder[];
    if (editingId === 'new') {
      const newReminder: Reminder = {
        id: Math.random().toString(36).substr(2, 9),
        time: time,
        exerciseId: exerciseId,
        enabled: true
      };
      updated = [...localReminders, newReminder];
    } else {
      updated = localReminders.map(r => 
        r.id === editingId ? { ...r, time: time, exerciseId: exerciseId } : r
      );
    }
    
    // Sort chronologically
    updated.sort((a, b) => a.time.localeCompare(b.time));
    setLocalReminders(updated);
    setEditingId(null);
    onSave(updated, globalAllow);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid triggering open edit when deleting
    const updated = localReminders.filter(r => r.id !== id);
    setLocalReminders(updated);
    onSave(updated, globalAllow);
  };

  const toggleReminder = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid triggering open edit when toggling
    const updated = localReminders.map(r => 
      r.id === id ? { ...r, enabled: !r.enabled } : r
    );
    setLocalReminders(updated);
    onSave(updated, globalAllow);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 50 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-stone-900/40 backdrop-blur-md"
    >
      <div className="w-full max-w-md bg-white dark:bg-stone-900 rounded-[32px] overflow-hidden shadow-2xl border border-stone-200 dark:border-stone-800 flex flex-col max-h-[80vh]">
        <div className="p-8 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between bg-white dark:bg-stone-900 sticky top-0 z-10">
          <button onClick={onBack} className="p-2 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-full transition-colors">
            <ChevronLeft className="w-5 h-5 text-stone-400" />
          </button>
          <h2 className="text-xl font-medium text-stone-800 dark:text-stone-100">小空提醒</h2>
          <button onClick={onClose} className="p-2 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-full transition-colors">
            <X className="w-5 h-5 text-stone-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <div className="space-y-4">
            {!editingId && (
              <div className="flex flex-col gap-4 p-4 bg-stone-50 dark:bg-stone-800/50 rounded-2xl mb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-stone-800 dark:text-stone-200">允许系统智能提醒</div>
                    <div className="text-xs text-stone-500 dark:text-stone-400">长时间未休息时空空会主动提醒你</div>
                  </div>
                  <button
                    onClick={() => {
                      const nextVal = !globalAllow;
                      setGlobalAllow(nextVal);
                      onSave(localReminders, nextVal);
                    }}
                    className={`relative w-12 h-6 rounded-full transition-colors ${globalAllow ? 'bg-sky-500' : 'bg-stone-300 dark:bg-stone-700'}`}
                  >
                    <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${globalAllow ? 'translate-x-6' : ''}`} />
                  </button>
                </div>
                
                <div className="flex items-center justify-between border-t border-stone-200/50 dark:border-stone-700/50 pt-4">
                  <div>
                    <div className="text-sm font-medium text-stone-800 dark:text-stone-200">接收放松结束提醒</div>
                    <div className="text-xs text-stone-500 dark:text-stone-400">锁屏状态下倒计时结束推送通知与触感</div>
                  </div>
                  <button
                    onClick={async () => {
                      const nextVal = !receiveEndNotification;
                      setReceiveEndNotification(nextVal);
                      onSave(localReminders, globalAllow, nextVal);
                      if (nextVal) {
                        try {
                          await Notification.requestPermission();
                          // Subscription logic will be handled at the App level or later
                        } catch (e) {}
                      }
                    }}
                    className={`relative w-12 h-6 rounded-full transition-colors ${receiveEndNotification ? 'bg-sky-500' : 'bg-stone-300 dark:bg-stone-700'}`}
                  >
                    <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${receiveEndNotification ? 'translate-x-6' : ''}`} />
                  </button>
                </div>
              </div>
            )}
            {localReminders.length === 0 && !editingId && (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-stone-50 dark:bg-stone-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Bell className="w-8 h-8 text-stone-200 dark:text-stone-700" />
                </div>
                <p className="text-sm text-stone-400">还没有设置个性化提醒哦</p>
              </div>
            )}

            {/* List existing reminders */}
            {!editingId && localReminders.map((reminder) => {
              const exercise = exercises.find(e => e.id === reminder.exerciseId);
              return (
                <div 
                  key={reminder.id}
                  onClick={() => handleOpenEdit(reminder)}
                  className={`p-5 rounded-[24px] border transition-all flex items-center justify-between cursor-pointer hover:border-sky-300 dark:hover:border-sky-800 hover:shadow-sm ${
                    reminder.enabled 
                      ? 'bg-sky-50/50 dark:bg-sky-900/20 border-sky-100 dark:border-sky-800/50' 
                      : 'bg-stone-50/50 dark:bg-stone-800/30 border-transparent grayscale'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="text-2xl font-mono font-medium text-stone-800 dark:text-stone-100">
                      {reminder.time}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-stone-700 dark:text-stone-200">
                        {exercise?.title || "冥想与呼吸"}
                      </div>
                      <div className="text-[10px] text-stone-400 mt-0.5 uppercase tracking-wider">
                        {reminder.enabled ? '已开启' : '已关闭' } · 点击可修改
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={(e) => toggleReminder(reminder.id, e)}
                      className={`w-10 h-6 rounded-full transition-colors relative flex items-center px-1 ${
                        reminder.enabled ? 'bg-sky-500' : 'bg-stone-200 dark:bg-stone-700'
                      }`}
                    >
                      <motion.div 
                        animate={{ x: reminder.enabled ? 16 : 0 }}
                        className="w-4 h-4 bg-white rounded-full shadow-sm"
                      />
                    </button>
                    <button 
                      onClick={(e) => handleDelete(reminder.id, e)}
                      className="p-2 text-stone-300 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Editing Form (Adding / Modifying) */}
            <AnimatePresence>
              {editingId && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="p-6 bg-white dark:bg-stone-900 border-2 border-dashed border-sky-200 dark:border-sky-800 rounded-[28px] space-y-5"
                >
                  <h3 className="text-sm font-medium text-stone-700 dark:text-stone-300">
                    {editingId === 'new' ? '添加提醒' : '修改提醒'}
                  </h3>

                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-sky-500" />
                    <input
                      type="time"
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                      className="flex-1 bg-stone-50 dark:bg-stone-800 border-none rounded-xl p-3 text-lg font-mono focus:ring-2 focus:ring-sky-500/20"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-stone-400 ml-1">提醒项目</label>
                    <select
                      value={exerciseId}
                      onChange={(e) => setExerciseId(e.target.value)}
                      className="w-full bg-stone-50 dark:bg-stone-800 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-sky-500/20 text-stone-700 dark:text-stone-200"
                    >
                      {exercises.map(e => (
                        <option key={e.id} value={e.id}>{e.title}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingId(null)}
                      className="flex-1 py-3 text-sm font-medium text-stone-400 hover:text-stone-600 transition-colors"
                    >
                      取消
                    </button>
                    <button
                      onClick={handleSave}
                      className="flex-1 py-3 bg-sky-500 text-white rounded-xl text-sm font-medium hover:bg-sky-600 transition-colors flex items-center justify-center gap-2 shadow-sm"
                    >
                      <Check className="w-4 h-4" /> 确定
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {!editingId && (
          <div className="p-8 bg-white dark:bg-stone-900">
            <button
              onClick={handleOpenAdd}
              className="w-full py-4 bg-stone-50 dark:bg-stone-800/50 text-stone-600 dark:text-stone-300 rounded-2xl font-medium border-2 border-dashed border-stone-200 dark:border-stone-800 hover:border-sky-300 hover:text-sky-600 transition-all flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              <span>添加提醒</span>
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
