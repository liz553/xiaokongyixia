import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Avatar } from './Avatar';

interface MorningCheckinProps {
  onCheckIn: (energyScore: number) => void;
}

export function MorningCheckin({ onCheckIn }: MorningCheckinProps) {
  const [step, setStep] = useState<'sleep' | 'prompt' | 'charging' | 'done'>('sleep');
  const [energy, setEnergy] = useState(30);
  const requestRef = useRef<number>(undefined);
  // Need to track this cleanly inside RAF
  const isPressing = useRef(false);

  const wakeUp = () => {
    if (step === 'sleep') {
      setStep('prompt');
    }
  };

  const startCharging = () => {
    if (step === 'prompt' || step === 'charging') {
      setStep('charging');
      isPressing.current = true;
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      requestRef.current = requestAnimationFrame(chargeLoop);
    }
  };

  const stopCharging = () => {
    if (step === 'charging') {
      isPressing.current = false;
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      setStep('done');
      
      // Auto finish after showing result
      setTimeout(() => {
        // Will use energy ref implicitly through re-render capture, but state works fine if captured via a delayed use effect, 
        // to be safe let's ensure we use the current visual state.
      }, 2500);
    }
  };

  // We need useEffect to trigger `onCheckIn` cleanly when `done` timer expires.
  useEffect(() => {
    if (step === 'done') {
      const timer = setTimeout(() => {
        onCheckIn(Math.floor(energy));
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [step, energy, onCheckIn]);

  const chargeLoop = () => {
    if (!isPressing.current) return;
    
    setEnergy((prev) => {
      const next = prev + 0.6; // Speed tuning
      if (next >= 100) {
        isPressing.current = false;
        setTimeout(() => setStep('done'), 0);
        return 100;
      }
      return next;
    });
    
    if (isPressing.current) {
      requestRef.current = requestAnimationFrame(chargeLoop);
    }
  };

  useEffect(() => {
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  const roundedEnergy = Math.floor(energy);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-start pt-[10vh] pb-12 px-6 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 touch-none select-none">
      
      {/* Header Text Area */}
      <div className="w-full flex flex-col items-center justify-end h-20 mb-8">
        <AnimatePresence mode="wait">
          {step === 'sleep' && (
            <motion.div 
              key="sleep"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-lg font-light tracking-[0.2em] text-stone-400 text-center"
            >
              轻拍，叫醒空空
            </motion.div>
          )}
          {step === 'prompt' && (
            <motion.div 
              key="prompt"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col items-center gap-3 text-center"
            >
              <span className="text-lg font-light tracking-[0.1em] text-stone-600 dark:text-stone-300">
                现在感觉如何？<br/>请给空空传输你的今日能量哦
              </span>
              <span className="text-xs tracking-widest text-stone-400 bg-stone-200/40 dark:bg-stone-800/40 px-4 py-1.5 rounded-full">
                长按空空
              </span>
            </motion.div>
          )}
          {step === 'charging' && (
            <motion.div 
              key="charging"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-xl font-medium tracking-wide text-sky-500 dark:text-sky-400 flex items-center justify-center gap-2"
            >
              空空接收能量中 <span className="font-mono w-10 text-left">{roundedEnergy}</span>
            </motion.div>
          )}
          {step === 'done' && (
            <motion.div 
              key="done"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-3"
            >
              <div className="text-2xl font-medium text-stone-800 dark:text-stone-100">
                {roundedEnergy > 60 ? "充能完成" : "充能完成。今日这么累，要多休息哦"}
              </div>
              <div className="text-base text-stone-500">今日初始能量: {roundedEnergy}</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Avatar Interaction Area */}
      <div className="flex-1 flex items-center justify-center w-full grow">
        <Avatar 
          energy={energy} 
          size="xl" 
          isSleeping={step === 'sleep'}
          onClick={step === 'sleep' ? wakeUp : undefined}
          onPointerDown={(e) => {
            if (step === 'prompt') {
              startCharging();
              // Try to capture pointer to keep tracking if finger slides off slightly
              try { e.currentTarget.setPointerCapture(e.pointerId); } catch(err) {}
            }
          }}
          onPointerUp={(e) => {
            if (step === 'charging') {
              stopCharging();
              try { e.currentTarget.releasePointerCapture(e.pointerId); } catch(err) {}
            }
          }}
          onPointerLeave={(e) => {
            if (step === 'charging') {
              stopCharging();
            }
          }}
          className={
            step === 'sleep' ? "cursor-pointer" : 
            step === 'prompt' ? "cursor-pointer active:cursor-grabbing" : 
            step === 'charging' ? "cursor-grabbing" : ""
          }
        />
      </div>
      
    </div>
  );
}
