import { motion } from 'motion/react';
import { Avatar } from './Avatar';
import { UserState } from '../types';

interface ChoiceModalProps {
  prompt: string;
  userState: UserState;
  onChooseA: () => void;
  onChooseB: () => void;
}

export function ChoiceModal({ prompt, userState, onChooseA, onChooseB }: ChoiceModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-100/80 dark:bg-stone-950/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-lg p-8 space-y-8 overflow-hidden bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl shadow-xl"
      >
        <div className="relative z-10 text-center">
          <h2 className="text-lg font-light leading-relaxed tracking-wide text-stone-600 dark:text-stone-300">
            {prompt}
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-4 my-8 relative z-10">
          <div className="flex flex-col items-center p-4 bg-stone-50 dark:bg-stone-950/50 rounded-2xl border border-stone-200 dark:border-stone-800/50 space-y-4">
            <Avatar energy={userState.currentEnergy} size="sm" />
            <div className="text-center">
              <div className="text-sm font-medium text-stone-600 dark:text-stone-400">现在的你</div>
              <div className="text-xs text-stone-500 mt-1">能量: {Math.floor(userState.currentEnergy)}</div>
            </div>
          </div>
          
          <div className="flex flex-col items-center p-4 bg-sky-50 dark:bg-stone-950/50 rounded-2xl border border-sky-200 dark:border-sky-500/20 space-y-4">
            <Avatar energy={userState.parallelEnergy} size="sm" isParallel />
            <div className="text-center">
              <div className="text-sm font-medium text-sky-600 dark:text-sky-300">上一次休息了的你</div>
              <div className="text-xs text-sky-500/70 dark:text-sky-500/70 mt-1">能量: {Math.floor(userState.parallelEnergy)}</div>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex flex-col space-y-3">
          <button
            onClick={onChooseA}
            className="flex items-center justify-between w-full px-6 py-4 text-left transition-all bg-sky-50 dark:bg-stone-800/50 hover:bg-sky-100 dark:hover:bg-sky-900/40 border border-sky-200 dark:border-stone-700/50 hover:border-sky-300 dark:hover:border-sky-500/50 rounded-2xl group"
          >
            <div>
              <div className="font-medium text-sky-700 dark:text-sky-400 group-hover:text-sky-800 dark:group-hover:text-sky-300">选择 A（小空一下）</div>
              <div className="text-sm text-stone-500 dark:text-stone-400 mt-1">及时休息，让现在的你靠近理想的自己。</div>
            </div>
          </button>
          
          <button
            onClick={onChooseB}
            className="flex items-center justify-between w-full px-6 py-4 text-left transition-all bg-stone-50 dark:bg-stone-800/50 hover:bg-stone-100 dark:hover:bg-stone-800 border border-stone-200 dark:border-transparent hover:border-stone-300 dark:hover:border-stone-700/50 rounded-2xl group"
          >
            <div>
              <div className="font-medium text-stone-600 dark:text-stone-400 group-hover:text-stone-700 dark:group-hover:text-stone-300">选择 B（继续忙碌）</div>
              <div className="text-sm text-stone-400 dark:text-stone-500 mt-1">放弃休息，能量可能会持续衰减。</div>
            </div>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
