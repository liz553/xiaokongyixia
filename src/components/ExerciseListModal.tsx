import { motion } from 'motion/react';
import { Play, FileEdit } from 'lucide-react';
import { Exercise } from '../types';

interface ExerciseListModalProps {
  exercises: Exercise[];
  onSelect: (exercise: Exercise) => void;
  onEditRequest: (exercise: Exercise) => void;
  onClose: () => void;
}

export function ExerciseListModal({ exercises, onSelect, onEditRequest, onClose }: ExerciseListModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-100/80 dark:bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-lg p-6 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl shadow-2xl relative max-h-[85vh] flex flex-col"
      >
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-medium text-stone-800 dark:text-stone-100">休息一下，陪陪自己</h2>
            <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">选择一个陪伴放松的活动</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
          {exercises.map((ex) => (
            <div
              key={ex.id}
              className="w-full text-left p-4 rounded-2xl bg-stone-50 hover:bg-stone-100 dark:bg-stone-800/40 dark:hover:bg-stone-800 border border-stone-100 dark:border-stone-700/50 transition-all group flex items-center gap-4"
            >
              <div className="flex-1 cursor-pointer" onClick={() => onSelect(ex)}>
                <div className="font-medium text-stone-700 dark:text-stone-200 flex items-center gap-2">
                  {ex.title}
                </div>
                {ex.description && (
                  <div className="text-sm text-stone-500 mt-1 line-clamp-1">{ex.description}</div>
                )}
                <div className="text-xs text-stone-400 mt-2 flex items-center gap-3">
                  {ex.durationSeconds > 0 && <span>≈ {Math.round(ex.durationSeconds / 60)} 分钟</span>}
                  {ex.energyBoost > 0 && <span>+{ex.energyBoost} 能量</span>}
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button 
                  onClick={(e) => { e.stopPropagation(); onEditRequest(ex); }}
                  className="w-10 h-10 rounded-full flex items-center justify-center text-stone-400 hover:text-stone-600 hover:bg-stone-200 dark:hover:bg-stone-700 dark:hover:text-stone-300 transition-colors"
                >
                  <FileEdit className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => onSelect(ex)}
                  className="w-10 h-10 rounded-full bg-white dark:bg-stone-700 border border-stone-200 dark:border-stone-600 flex items-center justify-center text-stone-400 group-hover:text-sky-500 group-hover:border-sky-200 dark:group-hover:text-sky-400 dark:group-hover:border-sky-500/50 transition-colors shadow-sm"
                >
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 pt-4 border-t border-stone-100 dark:border-stone-800">
          <button 
            onClick={onClose}
            className="w-full py-4 rounded-2xl bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 font-medium hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors text-center"
          >
            继续忙碌，空空会陪你
          </button>
        </div>
      </motion.div>
    </div>
  );
}
