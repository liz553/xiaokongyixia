import { motion } from "motion/react";
import React from "react";

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  energy: number;
  isParallel?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isSleeping?: boolean;
  variant?: 'current' | 'ideal'; // Used to force an ideal color scheme
}

export function Avatar({ energy, isParallel = false, size = 'md', isSleeping = false, variant = 'current', className = "", ...props }: AvatarProps) {
  // Energy normalizes from 30 to 100 range logically for visuals
  const clampedEnergy = Math.max(30, Math.min(100, energy));
  const normalizedEnergy = (clampedEnergy - 30) / 70; // 0 to 1 range
  
  // Dimensions based on size
  const sizes = {
    sm: { container: 'w-20 h-20', core: 'w-14 h-14', baseScale: 0.8 },
    md: { container: 'w-40 h-40', core: 'w-28 h-28', baseScale: 0.95 },
    lg: { container: 'w-52 h-52', core: 'w-36 h-36', baseScale: 1.05 },
    xl: { container: 'w-64 h-64', core: 'w-44 h-44', baseScale: 1.15 },
  };

  const { container, core, baseScale } = sizes[size] || sizes.md;
  
  // Scale mapping: 30 energy = ~85% size, 100 energy = ~120% size
  const scale = baseScale * (0.85 + normalizedEnergy * 0.35); 
  
  // Breathing duration
  const breathDuration = isSleeping ? 4 : (3.5 - normalizedEnergy * 1.5); 
  
  // Blob shape
  const radiusFluid = isSleeping 
    ? ["60% 40% 50% 50% / 50% 50% 40% 60%", "50% 50% 45% 55% / 55% 45% 50% 50%", "60% 40% 50% 50% / 50% 50% 40% 60%"]
    : [
      "60% 40% 50% 60% / 55% 50% 55% 45%",
      "45% 55% 60% 40% / 50% 60% 45% 55%",
      "60% 40% 50% 60% / 55% 50% 55% 45%"
    ];
    
  // Dynamic color: transition from slate-300/400 to bright cyan-sky
  let bgColor, shadowColor;

  if (variant === 'ideal') {
    // Warm ethereal colors for ideal world (amber/peach gradient feel)
    const rVal = Math.round(250 + (253 - 250) * normalizedEnergy);
    const gVal = Math.round(200 + (224 - 200) * normalizedEnergy);
    const bVal = Math.round(150 + (100 - 150) * normalizedEnergy); // getting warmer
    bgColor = `rgb(${rVal}, ${gVal}, ${bVal})`;
    shadowColor = `rgba(${rVal}, ${gVal}, ${bVal}, ${0.4 + normalizedEnergy * 0.4})`;
  } else {
    // Cool relaxed colors for reality
    const rVal = Math.round(168 + (56 - 168) * normalizedEnergy); // stone-400 -> sky-400
    const gVal = Math.round(162 + (189 - 162) * normalizedEnergy);
    const bVal = Math.round(158 + (248 - 158) * normalizedEnergy);
    bgColor = `rgb(${rVal}, ${gVal}, ${bVal})`;
    shadowColor = `rgba(${rVal}, ${gVal}, ${bVal}, ${0.2 + normalizedEnergy * 0.4})`;
  }

  // Awake eyes
  const [isBlinking, setIsBlinking] = React.useState(false);

  React.useEffect(() => {
    if (isSleeping) return;
    const triggerBlink = () => {
      setIsBlinking(true);
      setTimeout(() => setIsBlinking(false), 150);
      
      // Schedule next blink randomly between 3 to 6 seconds
      const nextTime = 3000 + Math.random() * 3000;
      blinkTimeoutId = setTimeout(triggerBlink, nextTime);
    };

    let blinkTimeoutId = setTimeout(triggerBlink, 3000 + Math.random() * 3000);

    return () => clearTimeout(blinkTimeoutId);
  }, [isSleeping]);

  const yJitter = isSleeping ? [0, 2, 0] : [0, -8 * normalizedEnergy, 0];
  
  return (
    <div className={`relative flex items-center justify-center ${container} ${className}`} {...props}>
      {/* Ambient Glow */}
      <motion.div
        animate={{
          scale: [1, 1.05, 1],
          opacity: [0.4, 0.6, 0.4],
        }}
        transition={{ duration: breathDuration, repeat: Infinity, ease: "easeInOut" }}
        className="absolute inset-0 rounded-full blur-2xl"
        style={{ backgroundColor: bgColor }}
      />
      
      {/* Kong Kong Body */}
      <motion.div
        animate={{
          borderRadius: radiusFluid,
          scale: scale,
          y: yJitter,
          rotate: isSleeping ? [0, 1, 0, -1, 0] : [0, 3, -2, 0]
        }}
        transition={{
          duration: breathDuration,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        className={`relative z-10 flex items-center justify-center transition-all duration-300 ease-out ${core}`}
        style={{ backgroundColor: bgColor, boxShadow: `0 0 40px ${shadowColor}` }}
      >
        {/* Core Highlight to give 3D jelly feel */}
        <div className="absolute inset-0 m-auto w-3/4 h-3/4 bg-white/30 rounded-[inherit] rotate-12 blur-md" />
        <div className="absolute top-1/4 left-1/4 w-1/4 h-1/4 bg-white/50 rounded-full blur-sm" />
        
        {/* Eyes */}
        <div className="absolute w-full h-full flex items-center justify-center gap-4 -mt-2">
          {isSleeping ? (
            // Sleeping eyes
            <>
              <div className="w-4 h-1 bg-stone-600/70 dark:bg-stone-800/80 rounded-full" />
              <div className="w-4 h-1 bg-stone-600/70 dark:bg-stone-800/80 rounded-full" />
            </>
          ) : isBlinking ? (
            // Blinking eyes
            <>
              <div className="w-3 h-0.5 bg-stone-600/80 dark:bg-stone-800/90 rounded-full" />
              <div className="w-3 h-0.5 bg-stone-600/80 dark:bg-stone-800/90 rounded-full" />
            </>
          ) : (
            // Awake eyes
            <>
              <div className="w-2.5 h-3.5 bg-stone-600/80 dark:bg-stone-800/90 rounded-full flex items-start justify-end p-0.5">
                <div className="w-1 h-1 bg-white rounded-full opacity-90" />
              </div>
              <div className="w-2.5 h-3.5 bg-stone-600/80 dark:bg-stone-800/90 rounded-full flex items-start justify-end p-0.5">
                <div className="w-1 h-1 bg-white rounded-full opacity-90" />
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
