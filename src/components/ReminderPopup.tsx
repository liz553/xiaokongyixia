import { motion } from 'motion/react';
import { Bell, X } from 'lucide-react';
import { Exercise } from '../types';

interface ReminderPopupProps {
  exercise: Exercise;
  message: string;
  onAccept: () => void;
  onBusy: () => void;
  onDismiss: () => void;
}

export function ReminderPopup({ exercise, message, onAccept, onBusy, onDismiss }: ReminderPopupProps) {
  return (
    <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-sm">
      <motion.div
        initial={{ y: -100, opacity: 0, scale: 0.9 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: -100, opacity: 0, scale: 0.9 }}
        className="bg-white/90 dark:bg-stone-900/90 backdrop-blur-xl border border-stone-200 dark:border-stone-800 rounded-[32px] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.15)] overflow-hidden"
      >
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-sky-100 dark:bg-sky-900/30 rounded-2xl flex items-center justify-center shrink-0">
            <Bell className="w-6 h-6 text-sky-600 dark:text-sky-400 animate-bounce" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-stone-800 dark:text-stone-100 mb-1">小空建议</h4>
            <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
              {message}
            </p>
          </div>
          <button 
            onClick={onDismiss}
            className="p-1 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-full transition-colors"
            title="关闭"
          >
            <X className="w-4 h-4 text-stone-300" />
          </button>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={onBusy}
            className="flex-1 py-3 bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 rounded-2xl text-xs font-medium flex items-center justify-center gap-2 hover:bg-stone-200 dark:hover:bg-stone-700 active:scale-[0.98] transition-all"
          >
            继续忙碌
          </button>
          <button
            onClick={onAccept}
            className="flex-1 py-3 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 rounded-2xl text-xs font-medium flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all shadow-sm"
          >
            小空一下
          </button>
        </div>
      </motion.div>
    </div>
  );
}
