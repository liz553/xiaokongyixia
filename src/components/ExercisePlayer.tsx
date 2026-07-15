import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ExternalLink, VolumeX, Volume2, RotateCcw, RotateCw, Sparkles, Loader2, Music } from 'lucide-react';
import { Exercise } from '../types';
import { Avatar } from './Avatar';
import { trackEvent } from '../lib/analytics';
import { apiFetch } from '../lib/api';


interface ExercisePlayerProps {
  exercise: Exercise;
  onComplete: (dynamicBoost?: number) => void;
}

export function ExercisePlayer({ exercise, onComplete }: ExercisePlayerProps) {
  const [targetMode, setTargetMode] = useState<'1min' | '3min' | 'continue'>(() => {
    if (exercise.durationSeconds === 60) return '1min';
    if (exercise.durationSeconds === 180) return '3min';
    return 'continue';
  });
  
  const [timeLeft, setTimeLeft] = useState<number>(() => {
    if (exercise.durationSeconds > 0) return exercise.durationSeconds;
    return 180; // 默认给3分钟倒计时参考
  });
  
  const [passedSeconds, setPassedSeconds] = useState(0);
  const [isQuietMode, setIsQuietMode] = useState(false); // 安静模式（不听多媒体/只陪空空）
  const [resolvedUrl, setResolvedUrl] = useState<string>('');
  const [isLoadingMedia, setIsLoadingMedia] = useState(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Resolve IndexedDB media if needed
  useEffect(() => {
    const resolveMedia = async () => {
      if (exercise.contentUrl) {
        if (exercise.contentUrl.startsWith('db_ref:')) {
          setIsLoadingMedia(true);
          const id = exercise.contentUrl.replace('db_ref:', '');
          try {
            const { getLargeMedia } = await import('../lib/db');
            const data = await getLargeMedia(`media_${id}`);
            if (data) {
              setResolvedUrl(data);
            }
          } catch (err) {
            console.error('Failed to load media from IndexedDB:', err);
          } finally {
            setIsLoadingMedia(false);
          }
        } else if (exercise.contentUrl.startsWith('cloud_ref:')) {
          const id = exercise.contentUrl.replace('cloud_ref:', '');
          const token = localStorage.getItem('jwt_token') || '';
          setResolvedUrl(`/api/video-proxy?mediaId=${id}&token=${token}`);
        } else {
          setResolvedUrl(exercise.contentUrl);
        }
      }
    };
    resolveMedia();
  }, [exercise.contentUrl]);

  // 判断内容类型
  const mediaUrl = resolvedUrl || exercise.contentUrl || '';
  const isVideoUrl = exercise.customMediaType === 'video' || 
    (exercise.customMediaType === undefined && (mediaUrl.toLowerCase().endsWith('.mp4') || mediaUrl.toLowerCase().includes('data:video/') || mediaUrl.toLowerCase().includes('video')));
  const isAudioUrl = exercise.customMediaType === 'audio' || 
    (exercise.customMediaType === undefined && (mediaUrl.toLowerCase().endsWith('.mp3') || mediaUrl.toLowerCase().endsWith('.m4a') || mediaUrl.toLowerCase().includes('data:audio/') || mediaUrl.toLowerCase().includes('audio')));
  const hasMediaOrText = !!exercise.contentUrl || !!exercise.contentText;

  const calcDynamicBoost = (secs: number) => {
    // 保底5点，每沉浸10秒多恢复1点，上限35点
    return Math.min(35, Math.max(5, Math.round(secs / 10) + 5));
  };

  const handleFinish = () => {
    if (audioRef.current) audioRef.current.pause();
    if (videoRef.current) videoRef.current.pause();
    onComplete(calcDynamicBoost(passedSeconds));
  };

  // 倒计时与正计时定时器
  const passedSecondsRef = useRef(0);
  useEffect(() => { passedSecondsRef.current = passedSeconds; }, [passedSeconds]);

  useEffect(() => {
    return () => { 
       trackEvent('RELAX_MODE', { task_name: exercise.title, duration_seconds: passedSecondsRef.current });
    };
  }, [exercise.title]);

  const endTimestampRef = useRef<number | null>(null);
  const startTimestampRef = useRef<number>(Date.now() - passedSeconds * 1000);

  // Initialize endTimestamp based on initial targetMode
  useEffect(() => {
    if (targetMode === '1min') endTimestampRef.current = Date.now() + 60 * 1000;
    else if (targetMode === '3min') endTimestampRef.current = Date.now() + 180 * 1000;
    else endTimestampRef.current = null;
  }, []); // Run once on mount to set initial end time

  useEffect(() => {
    let animationFrameId: number;
    let lastTick = Date.now();

    const tick = () => {
      const now = Date.now();
      
      // Update passedSeconds accurately
      if (now - lastTick >= 1000) {
        setPassedSeconds(Math.floor((now - startTimestampRef.current) / 1000));
        lastTick = now;
      }

      // Handle countdown logic
      if ((targetMode === '1min' || targetMode === '3min') && endTimestampRef.current) {
        const remainingMs = endTimestampRef.current - now;
        if (remainingMs <= 0) {
          setTimeLeft(0);
          endTimestampRef.current = null;
          if ('vibrate' in navigator) {
            navigator.vibrate([200, 100, 200]);
          }
          handleFinish();
          return; // Stop ticking when finished
        } else {
          setTimeLeft(Math.ceil(remainingMs / 1000));
        }
      }

      animationFrameId = requestAnimationFrame(tick);
    };

    animationFrameId = requestAnimationFrame(tick);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const now = Date.now();
        setPassedSeconds(Math.floor((now - startTimestampRef.current) / 1000));
        if ((targetMode === '1min' || targetMode === '3min') && endTimestampRef.current) {
           const remainingMs = endTimestampRef.current - now;
           if (remainingMs <= 0) {
              setTimeLeft(0);
              endTimestampRef.current = null;
              if ('vibrate' in navigator) {
                navigator.vibrate([200, 100, 200]);
              }
              handleFinish();
           } else {
              setTimeLeft(Math.ceil(remainingMs / 1000));
           }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelAnimationFrame(animationFrameId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [targetMode]); // re-run when targetMode changes so closure uses latest targetMode

  // 切换时长与模式
  const switchMode = (mode: '1min' | '3min' | 'continue') => {
    setTargetMode(mode);
    if (mode === '1min') {
      const duration = 60;
      setTimeLeft(duration);
      endTimestampRef.current = Date.now() + duration * 1000;
    } else if (mode === '3min') {
      const duration = 180;
      setTimeLeft(duration);
      endTimestampRef.current = Date.now() + duration * 1000;
    } else {
      endTimestampRef.current = null;
      if (audioRef.current && audioRef.current.paused) audioRef.current.play().catch(() => {});
      if (videoRef.current && videoRef.current.paused) videoRef.current.play().catch(() => {});
    }
  };

  // 引导文案推算（无媒体时）
  let currentGuide = exercise.description;
  if (!exercise.contentText && !exercise.contentUrl && exercise.guideText && exercise.guideText.length > 0) {
    const totalDuration = targetMode === '1min' ? 60 : targetMode === '3min' ? 180 : 300;
    const interval = Math.max(4, Math.floor(totalDuration / exercise.guideText.length));
    const idx = Math.min(exercise.guideText.length - 1, Math.floor(passedSeconds / interval));
    currentGuide = exercise.guideText[idx] || exercise.description;
  }

  // 音频快退快进10秒
  const skipAudio = (seconds: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime + seconds);
    }
  };

  const isTimerMode = targetMode === '1min' || targetMode === '3min';

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-between p-6 bg-stone-50 dark:bg-stone-950 text-stone-800 dark:text-stone-100 overflow-y-auto"
    >
      {/* 顶部标题栏与心情切换按钮 */}
      <div className="w-full max-w-md flex items-center justify-between pt-6">
        <div className="text-sm font-medium text-stone-400 dark:text-stone-500 tracking-widest flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-sky-400 animate-pulse" />
          {exercise.title}
        </div>

        {hasMediaOrText && (
          <button
            onClick={() => setIsQuietMode(!isQuietMode)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
              isQuietMode
                ? 'bg-sky-500 text-white border-sky-600 dark:bg-sky-600 dark:border-sky-700 shadow-sm shadow-sky-500/10'
                : 'bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-800 hover:bg-stone-50'
            }`}
          >
            {isQuietMode ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            <span>安静模式</span>
          </button>
        )}
      </div>

      {/* 核心展示区（空空 / 视频 / 文本） */}
      <div className="relative flex flex-col items-center justify-center flex-1 w-full max-w-md my-6">
        
        {/* 如果开启安静陪伴模式，或者本产品无媒体/文本，则核心展示空空 */}
        {(isQuietMode || !hasMediaOrText) && (
          <div className="flex flex-col items-center justify-center space-y-8 my-auto">
            <Avatar energy={85} size="lg" />
            <div className="text-center min-h-16 px-6">
              <AnimatePresence mode="wait">
                <motion.p 
                  key={currentGuide}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="text-base md:text-lg font-light text-sky-700 dark:text-sky-200/90 leading-relaxed tracking-wide"
                >
                  {isQuietMode ? '嘘，闭上眼睛，空空安安静静陪你放松一会儿...' : currentGuide}
                </motion.p>
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* 媒体展现区（未开启安静模式时） */}
        {!isQuietMode && hasMediaOrText && (
          <div className="w-full flex flex-col items-center flex-1 justify-center space-y-6 max-h-[60vh]">
            {/* 文本/诗词 */}
            {exercise.contentText && (
              <div className="w-full flex-1 overflow-y-auto p-6 bg-white/70 dark:bg-stone-900/70 backdrop-blur border border-stone-200/60 dark:border-stone-800/60 rounded-3xl shadow-sm custom-scrollbar text-center md:text-left">
                <p className="text-stone-700 dark:text-stone-200 leading-loose whitespace-pre-wrap font-serif text-base tracking-wide">
                  {exercise.contentText}
                </p>
              </div>
            )}

            {/* 载入状态 */}
            {isLoadingMedia && (
              <div className="w-full flex flex-col items-center justify-center p-12 bg-white/50 dark:bg-stone-900/50 rounded-3xl border border-stone-200/50 dark:border-stone-800/50">
                <Loader2 className="w-8 h-8 text-sky-500 animate-spin mb-3" />
                <span className="text-xs text-stone-500">正在载入专属放松多媒体...</span>
              </div>
            )}

            {/* 视频 */}
            {!isLoadingMedia && resolvedUrl && isVideoUrl && (
              <div className="w-full max-w-sm aspect-[4/3] bg-stone-950 dark:bg-black rounded-3xl overflow-hidden flex items-center justify-center shadow-2xl relative border border-stone-200 dark:border-stone-800">
                <video 
                  ref={videoRef}
                  controls 
                  autoPlay
                  playsInline
                  webkit-playsinline="true"
                  src={resolvedUrl} 
                  className="w-full h-full object-contain"
                />
              </div>
            )}

            {/* 音频与音频控制卡片 */}
            {!isLoadingMedia && resolvedUrl && isAudioUrl && (
              <div className="w-full p-6 bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-xl flex flex-col items-center space-y-5">
                {/* Sound Wave Visualizer */}
                <div className="flex items-center justify-center gap-[4px] h-20 px-8 py-3 bg-stone-50 dark:bg-stone-950/50 rounded-2xl border border-stone-100 dark:border-stone-900/40 w-full max-w-sm justify-between">
                  {[...Array(15)].map((_, i) => {
                    const defaultHeight = [16, 32, 20, 48, 24, 56, 36, 60, 40, 44, 24, 36, 18, 28, 12][i] || 24;
                    return (
                      <motion.div
                        key={i}
                        className={`w-[4px] rounded-full ${
                          i % 3 === 0 
                            ? 'bg-sky-400 dark:bg-sky-500' 
                            : i % 3 === 1 
                            ? 'bg-teal-400 dark:bg-teal-500' 
                            : 'bg-indigo-400 dark:bg-indigo-500'
                        }`}
                        animate={isAudioPlaying ? {
                          height: [defaultHeight * 0.3, defaultHeight, defaultHeight * 0.6, defaultHeight * 1.1, defaultHeight * 0.3],
                        } : {
                          height: 8
                        }}
                        transition={isAudioPlaying ? {
                          duration: 1.1 + (i % 4) * 0.18,
                          repeat: Infinity,
                          repeatType: "reverse",
                          ease: "easeInOut",
                        } : {
                          duration: 0.3
                        }}
                        style={{ height: defaultHeight }}
                      />
                    );
                  })}
                </div>

                <div className="text-sm font-medium text-stone-700 dark:text-stone-200 text-center flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full bg-sky-500 ${isAudioPlaying ? 'animate-ping' : ''}`} />
                  {isAudioPlaying ? '正在播放专属放松音频...' : '已暂停音频播放'}
                </div>
                
                <audio 
                  ref={audioRef}
                  controls 
                  autoPlay
                  src={resolvedUrl} 
                  onPlay={() => setIsAudioPlaying(true)}
                  onPause={() => setIsAudioPlaying(false)}
                  onEnded={() => setIsAudioPlaying(false)}
                  className="w-full accent-sky-500 mt-2"
                />
                
                <div className="flex items-center gap-6 text-stone-400 dark:text-stone-500 pt-1">
                  <button onClick={() => skipAudio(-10)} className="flex items-center gap-1 hover:text-sky-500 transition-colors text-xs font-medium">
                    <RotateCcw className="w-4 h-4" /> 后退 10 秒
                  </button>
                  <button onClick={() => skipAudio(10)} className="flex items-center gap-1 hover:text-sky-500 transition-colors text-xs font-medium">
                    快进 10 秒 <RotateCw className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* 外部链接快捷跳出 */}
            {resolvedUrl && !isVideoUrl && !isAudioUrl && !resolvedUrl.startsWith('data:') && (
              <a 
                href={resolvedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 rounded-full text-xs font-medium text-sky-600 dark:text-sky-400 hover:scale-105 transition-transform"
              >
                <span>在第三方平台打开链接</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        )}
      </div>

      {/* 底部时间控制区（计时器 + 4个规定时长选项） */}
      <div className="w-full max-w-md flex flex-col items-center pb-6 space-y-6">
        {/* 时间进度显示 */}
        <div className="text-center">
          <div className="text-3xl font-mono font-extralight tracking-tighter text-stone-600 dark:text-stone-300">
            {isTimerMode 
              ? `${Math.floor(timeLeft / 60)}:${(timeLeft % 60).toString().padStart(2, '0')}`
              : `${Math.floor(passedSeconds / 60)}:${(passedSeconds % 60).toString().padStart(2, '0')}`
            }
          </div>
        </div>

        {/* 4个核心动作按钮 [1分钟] [3分钟] [继续] [结束] */}
        <div className="grid grid-cols-4 gap-2.5 w-full pt-2">
          <button
            onClick={() => switchMode('1min')}
            className={`py-3 rounded-2xl text-xs transition-all border ${
              targetMode === '1min'
                ? 'bg-sky-100/80 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-300/50 dark:border-sky-850 font-medium scale-[1.02] shadow-sm'
                : 'bg-sky-50/20 dark:bg-stone-900/40 text-stone-500 dark:text-stone-400 border-transparent hover:bg-sky-50/50 dark:hover:bg-stone-800/40'
            }`}
          >
            1分钟
          </button>

          <button
            onClick={() => switchMode('3min')}
            className={`py-3 rounded-2xl text-xs transition-all border ${
              targetMode === '3min'
                ? 'bg-sky-100/80 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-300/50 dark:border-sky-850 font-medium scale-[1.02] shadow-sm'
                : 'bg-sky-50/20 dark:bg-stone-900/40 text-stone-500 dark:text-stone-400 border-transparent hover:bg-sky-50/50 dark:hover:bg-stone-800/40'
            }`}
          >
            3分钟
          </button>

          <button
            onClick={() => switchMode('continue')}
            className={`py-3 rounded-2xl text-xs transition-all border ${
              targetMode === 'continue'
                ? 'bg-sky-100/80 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-300/50 dark:border-sky-850 font-medium scale-[1.02] shadow-sm'
                : 'bg-sky-50/20 dark:bg-stone-900/40 text-stone-500 dark:text-stone-400 border-transparent hover:bg-sky-50/50 dark:hover:bg-stone-800/40'
            }`}
          >
            继续
          </button>

          <button
            onClick={handleFinish}
            className="py-3 rounded-2xl text-xs bg-sky-50/20 dark:bg-stone-900/40 text-stone-500 dark:text-stone-400 border border-transparent hover:bg-sky-50/50 dark:hover:bg-stone-800/40 transition-all shadow-sm"
          >
            结束
          </button>
        </div>
      </div>
    </motion.div>
  );
}
