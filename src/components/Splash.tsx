import { motion } from 'motion/react';
import { Avatar } from './Avatar';
import { useEffect } from 'react';

interface SplashProps {
  onComplete: () => void;
}

export function Splash({ onComplete }: SplashProps) {
  useEffect(() => {
    const timer = setTimeout(onComplete, 3500);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <motion.div 
      className="fixed inset-0 z-50 flex flex-col items-center bg-stone-50 dark:bg-stone-950 text-stone-800 dark:text-stone-100 p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.8 } }}
    >
      <div className="mt-[15vh] mb-12">
        <Avatar energy={90} size="xl" />
      </div>

      <div className="text-center">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 1.5, ease: "easeOut" }}
          className="flex flex-col items-center space-y-1"
        >
          <p className="text-xl sm:text-2xl font-serif font-light tracking-[0.35em] leading-snug text-stone-600/80 dark:text-stone-300/80 antialiased">
            小空一下，或者不，
          </p>
          <p className="text-base sm:text-lg font-serif font-light tracking-[0.35em] leading-snug text-stone-500/70 dark:text-stone-400/70 antialiased mt-1">
            空空陪你。
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
}
