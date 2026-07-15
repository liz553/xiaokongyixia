import { useState } from 'react';
import { motion } from 'motion/react';
import { Coffee, X } from 'lucide-react';

interface SecretCareModalProps {
  onAdd: (title: string, boost: number) => void;
  onClose: () => void;
}

export function SecretCareModal({ onAdd, onClose }: SecretCareModalProps) {
  const [title, setTitle] = useState('');
  const [energyStr, setEnergyStr] = useState('10');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    
    const boost = parseInt(energyStr) || 10;
    onAdd(title.trim(), boost);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-100/80 dark:bg-black/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-sm p-6 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl relative shadow-xl"
      >
        <button onClick={onClose} className="absolute top-6 right-6 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors">
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-sky-100 dark:bg-sky-500/20 rounded-full text-sky-500 dark:text-sky-400">
            <Coffee className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-medium text-stone-800 dark:text-stone-200">偷偷关照身体</h2>
        </div>
        
        <p className="text-sm text-stone-500 dark:text-stone-400 mb-6 leading-relaxed">
          告诉空空你刚刚做过什么关照自己的事情，让空空为你增加能量。
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-stone-500 dark:text-stone-400 mb-1">小空活动 (如: 散步3公里, 喝了一大杯水)</label>
            <input 
              type="text" 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-xl px-4 py-3 text-stone-800 dark:text-stone-200 outline-none focus:border-sky-400 dark:focus:border-sky-500/50 transition-colors"
              placeholder="输入活动名称"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-stone-500 dark:text-stone-400 mb-1">获得了多少能量？</label>
            <input 
              type="number" 
              min="1"
              value={energyStr}
              onChange={(e) => setEnergyStr(e.target.value)}
              className="w-full bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-xl px-4 py-3 text-stone-800 dark:text-stone-200 outline-none focus:border-sky-400 dark:focus:border-sky-500/50 transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={!title.trim()}
            className="w-full mt-6 py-4 text-sm font-medium text-white bg-sky-500 hover:bg-sky-600 rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-sky-500/20"
          >
            告诉空空
          </button>
        </form>
      </motion.div>
    </div>
  );
}
