import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UserState, ActivityLog } from '../types';
import { Activity, History, X, ChevronLeft, ChevronRight, Sparkles, Laptop, BatteryCharging } from 'lucide-react';
import { Avatar } from './Avatar';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts';

interface DashboardProps {
  userState: UserState;
  onOpenHistory?: () => void;
  onClose: () => void;
}

export function Dashboard({ userState, onOpenHistory, onClose }: DashboardProps) {
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth()); // 0 to 11
  const [selectedDayCard, setSelectedDayCard] = useState<{ date: Date; dayLogs: ActivityLog[] } | null>(null);

  // 今日区间起点（0点时间戳）
  const startOfToday = useMemo(() => {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  }, []);

  // 今日统计
  const todayLogs = useMemo(() => {
    return userState.logs.filter(l => l.timestamp >= startOfToday);
  }, [userState.logs, startOfToday]);

  const timelyRestCount = todayLogs.filter(l => l.choice === 'A').length;
  const busyCount = todayLogs.filter(l => l.choice === 'B').length;

  // 第三板块：折线图数据构造（空空现在 vs 空空如果）
  const chartPoints = useMemo(() => {
    const sorted = [...todayLogs].sort((a, b) => a.timestamp - b.timestamp);
    let curN = 50;
    let curI = 50;
    const res = [{ time: '00:00', 现在空空: 50, 如果空空: 50 }];
    
    sorted.forEach(l => {
      const d = new Date(l.timestamp);
      const tStr = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
      if (l.choice === 'A') {
        curN = Math.min(100, curN + (l.energyChange || 15));
        curI = Math.min(100, curI + (l.energyChange || 15));
      } else {
        // Choice 'B'
        curN = Math.min(100, curN + (l.energyChange || 0)); 
        curI = Math.min(100, curI + 10); // Ideal version chooses to rest
      }
      res.push({ time: tStr, 现在空空: Math.round(curN), 如果空空: Math.round(curI) });
    });

    res.push({
      time: '现在',
      现在空空: Math.round(userState.currentEnergy),
      如果空空: Math.round(userState.parallelEnergy)
    });
    return res;
  }, [todayLogs, userState.currentEnergy, userState.parallelEnergy]);

  // 第四板块：日历网格计算
  const { daysInMonth, firstDayWeek } = useMemo(() => {
    const totalDays = new Date(viewYear, viewMonth + 1, 0).getDate();
    const firstDay = new Date(viewYear, viewMonth, 1).getDay(); // 0 is Sunday
    return { daysInMonth: totalDays, firstDayWeek: firstDay };
  }, [viewYear, viewMonth]);

  const changeMonth = (delta: number) => {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setViewYear(y);
    setViewMonth(m);
  };

  const handleDayClick = (dayNum: number) => {
    const targetDate = new Date(viewYear, viewMonth, dayNum);
    const dayStart = targetDate.getTime();
    const dayEnd = dayStart + 24 * 60 * 60 * 1000 - 1;
    const dLogs = userState.logs.filter(l => l.timestamp >= dayStart && l.timestamp <= dayEnd);
    setSelectedDayCard({ date: targetDate, dayLogs: dLogs });
  };

  return (
    <div className="fixed inset-0 z-40 bg-stone-50 dark:bg-stone-950 p-6 flex flex-col md:p-12 overflow-y-auto custom-scrollbar">
      {/* 顶部头部栏 */}
      <div className="flex items-center justify-between mt-4 mb-10 max-w-3xl mx-auto w-full">
        <h2 className="text-2xl font-medium text-stone-800 dark:text-stone-100 flex items-center gap-3">
          <Activity className="w-6 h-6 text-sky-500" />
          状态日志
        </h2>
        <div className="flex items-center gap-3">
          {onOpenHistory && (
            <button 
              onClick={onOpenHistory}
              title="查看历史能量轨迹"
              className="p-2.5 text-stone-500 hover:text-sky-600 dark:text-stone-400 dark:hover:text-sky-400 transition-colors bg-white dark:bg-stone-900 rounded-full shadow-sm border border-stone-200 dark:border-stone-800"
            >
              <History className="w-5 h-5" />
            </button>
          )}
          <button 
            onClick={onClose} 
            className="p-2.5 text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200 transition-colors bg-white dark:bg-stone-900 rounded-full shadow-sm border border-stone-200 dark:border-stone-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto w-full space-y-8 pb-12">
        
        {/* 板块一：呈现两个空空的能量对比 */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-6 bg-white dark:bg-stone-900/60 rounded-3xl border border-stone-200 dark:border-stone-800 flex flex-col items-center justify-center space-y-4 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 w-full h-1 bg-sky-400/80" />
            <Avatar energy={userState.currentEnergy} size="sm" />
            <div className="text-center">
              <div className="text-xs text-stone-400 dark:text-stone-500 font-medium tracking-wider mb-2">现实世界</div>
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-sm font-medium text-stone-700 dark:text-stone-300">能量</span>
                <span className="text-3xl font-light text-stone-900 dark:text-stone-100">{Math.floor(userState.currentEnergy)}</span>
              </div>
            </div>
          </div>
          
          <div className="p-6 bg-amber-50/70 dark:bg-stone-900/60 rounded-3xl border border-amber-200/80 dark:border-amber-500/20 flex flex-col items-center justify-center space-y-4 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 w-full h-1 bg-amber-400/80" />
            <Avatar energy={userState.parallelEnergy} size="sm" variant="ideal" />
            <div className="text-center">
              <div className="text-xs text-amber-500 dark:text-amber-400/80 font-medium tracking-wider mb-2">平行世界</div>
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-sm font-medium text-amber-800 dark:text-amber-300">能量</span>
                <span className="text-3xl font-light text-amber-900 dark:text-amber-200">{Math.floor(userState.parallelEnergy)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 板块二：今日选择统计 */}
        <div className="p-6 bg-white dark:bg-stone-900/60 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm">
          <div className="text-xs font-medium text-stone-400 dark:text-stone-500 tracking-wider mb-4 uppercase">今日选择</div>
          <div className="grid grid-cols-2 gap-4 divide-x divide-stone-100 dark:divide-stone-800">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-sky-50 dark:bg-sky-950/50 flex items-center justify-center text-sky-500">
                <BatteryCharging className="w-6 h-6" />
              </div>
              <div>
                <div className="text-sm text-stone-500 dark:text-stone-400">及时休息</div>
                <div className="text-2xl font-semibold text-stone-800 dark:text-stone-100 mt-0.5">{timelyRestCount} <span className="text-xs font-normal text-stone-400">次</span></div>
              </div>
            </div>

            <div className="flex items-center gap-4 pl-4">
              <div className="w-12 h-12 rounded-2xl bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-stone-500">
                <Laptop className="w-6 h-6" />
              </div>
              <div>
                <div className="text-sm text-stone-500 dark:text-stone-400">惯性忙碌</div>
                <div className="text-2xl font-semibold text-stone-800 dark:text-stone-100 mt-0.5">{busyCount} <span className="text-xs font-normal text-stone-400">次</span></div>
              </div>
            </div>
          </div>
        </div>

        {/* 板块三：今日能量曲线图 (同一图呈两条线) */}
        <div className="p-6 bg-white dark:bg-stone-900/60 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="text-xs font-medium text-stone-400 dark:text-stone-500 tracking-wider uppercase">今日能量轨迹对比</div>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5 text-sky-600 dark:text-sky-400 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-500 inline-block" /> 现在空空
              </span>
              <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" /> 如果空空
              </span>
            </div>
          </div>

          <div className="w-full h-56 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartPoints} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                <XAxis dataKey="time" stroke="#a8a29e" fontSize={11} tickLine={false} />
                <YAxis domain={[30, 100]} stroke="#a8a29e" fontSize={11} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1c1917', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '12px' }}
                />
                <Line type="monotone" dataKey="现在空空" stroke="#0ea5e9" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="如果空空" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 板块四：能量月历与悬浮弹窗页面b */}
        <div className="p-6 bg-white dark:bg-stone-900/60 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="text-base font-medium text-stone-800 dark:text-stone-100 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              能量日历 ({viewYear}年{viewMonth + 1}月)
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => changeMonth(-1)} className="p-1.5 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg text-stone-500">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => changeMonth(1)} className="p-1.5 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg text-stone-500">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 周几表头 */}
          <div className="grid grid-cols-7 gap-2 text-center text-xs text-stone-400 mb-3">
            <span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span>
          </div>

          {/* 日历格子 */}
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: firstDayWeek }).map((_, idx) => (
              <div key={`empty_${idx}`} className="h-12 rounded-2xl bg-transparent" />
            ))}

            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const cellStart = new Date(viewYear, viewMonth, dayNum).getTime();
              const cellEnd = cellStart + 24 * 3600 * 1000 - 1;
              const dayLogs = userState.logs.filter(l => l.timestamp >= cellStart && l.timestamp <= cellEnd);
              const restLog = dayLogs.filter(l => l.choice === 'A');
              const hasRest = restLog.length > 0;
              const lastEnergy = dayLogs.length > 0 ? Math.round(dayLogs[0].energyChange || 50) : null;

              return (
                <button
                  key={`day_${dayNum}`}
                  onClick={() => handleDayClick(dayNum)}
                  className={`h-14 rounded-2xl p-2 relative flex flex-col items-center justify-between transition-all border ${
                    hasRest
                      ? 'bg-sky-50/90 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800/80 text-sky-800 dark:text-sky-200 font-medium hover:scale-105 shadow-sm'
                      : 'bg-stone-50 dark:bg-stone-800/40 border-stone-100 dark:border-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-100'
                  }`}
                >
                  <span className="text-xs">{dayNum}</span>
                  {hasRest ? (
                    <span className="w-2 h-2 rounded-full bg-sky-500 shadow-[0_0_8px_#0ea5e9]" title="本日已充能" />
                  ) : (
                    <span className="text-[10px] text-stone-300 dark:text-stone-600">-</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 悬浮页面b：点击月历某日小空卡 Modal */}
      <AnimatePresence>
        {selectedDayCard && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-sm bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl p-6 shadow-2xl relative max-h-[80vh] flex flex-col"
            >
              <button 
                onClick={() => setSelectedDayCard(null)}
                className="absolute top-5 right-5 text-stone-400 hover:text-stone-600"
              >
                <X className="w-5 h-5" />
              </button>

              <h3 className="text-lg font-medium text-stone-800 dark:text-stone-100 mb-4">
                {selectedDayCard.date.getMonth() + 1}月{selectedDayCard.date.getDate()}日小空卡
              </h3>

              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="p-3 bg-sky-50 dark:bg-sky-950/40 rounded-2xl border border-sky-100 dark:border-sky-900">
                  <div className="text-xs text-stone-500">及时休息</div>
                  <div className="text-xl font-semibold text-sky-600 dark:text-sky-400 mt-1">
                    {selectedDayCard.dayLogs.filter(l => l.choice === 'A').length} <span className="text-xs font-normal">次</span>
                  </div>
                </div>

                <div className="p-3 bg-stone-100 dark:bg-stone-800 rounded-2xl">
                  <div className="text-xs text-stone-500">惯性忙碌</div>
                  <div className="text-xl font-semibold text-stone-700 dark:text-stone-300 mt-1">
                    {selectedDayCard.dayLogs.filter(l => l.choice === 'B').length} <span className="text-xs font-normal">次</span>
                  </div>
                </div>
              </div>

              <div className="text-xs font-medium text-stone-400 tracking-wider mb-2 uppercase">能量轨迹</div>
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {selectedDayCard.dayLogs.length === 0 ? (
                  <div className="text-sm text-stone-400 py-6 text-center">这一天还未记录任何选择</div>
                ) : (
                  selectedDayCard.dayLogs.map(item => (
                    <div key={item.id} className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/50 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-medium text-stone-700 dark:text-stone-200">
                          {item.choice === 'A' ? (item.title || '小空休息') : '选择继续忙碌，放弃休息'}
                        </span>
                        <span className="text-stone-400 ml-2">{new Date(item.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <span className={item.choice === 'A' ? 'text-sky-500 font-semibold' : 'text-stone-400'}>
                        {item.choice === 'A' ? `+${item.energyChange || 10}` : '+0'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
