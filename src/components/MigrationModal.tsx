import React, { useState } from 'react';
import { motion } from 'motion/react';
import { trackEvent } from '../lib/analytics';

export const MigrationModal = ({ onSync, onSkip }: { onSync: () => void, onSkip: () => void }) => {
  const [loading, setLoading] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm bg-white/95 rounded-3xl p-6 shadow-xl"
      >
        <h2 className="text-xl font-bold text-gray-900 mb-4 text-center">发现本地媒体数据</h2>
        <p className="text-sm text-gray-600 mb-6 text-center">
          您有存储在本地的音视频数据。是否要将它们同步至云端，以防丢失？
        </p>
        
        <div className="space-y-3">
          <button
            onClick={() => {
              setLoading(true);
              trackEvent('MIGRATE_SYNC');
              onSync();
            }}
            disabled={loading}
            className="w-full py-3 rounded-2xl bg-sky-500 text-white font-medium shadow-md shadow-sky-200"
          >
            {loading ? '同步中...' : '同步至云端'}
          </button>
          
          <button
            onClick={() => {
              trackEvent('MIGRATE_SKIP');
              onSkip();
            }}
            disabled={loading}
            className="w-full py-3 rounded-2xl border border-gray-200 text-gray-500 font-medium"
          >
            跳过并清空本地数据
          </button>
        </div>
      </motion.div>
    </div>
  );
};
