# 项目规范与目录映射 (Project Guidelines & Directory Mapping)

## 核心设计理念 (Core Design Philosophy)
“小空一下”是一个基于双世界（现实 vs 理想）架构的陪伴型冥想/放松与能量记录应用。
- **空空现在 (Now World)**：记录用户现实中的能量流失与休息。采用冷色调（如天蓝色系，Sky/Stone）。选择“继续忙碌”记录为 +0 能量。
- **空空如果 (Ideal World)**：展示如果每次都选择休息，最理想的能量状态。采用暖色/治愈色调（如琥珀/青色，Amber/Teal）。在理想世界中，所有“继续忙碌”的选择都会被模拟为“及时休息”并记录为 +10 能量。
- **能量体系**：数值限制在 30 ~ 100 之间，不展示上限（如“100”），随时间自然衰减（每小时掉4点）。

## 目录与功能映射关系 (Directory & Feature Mapping)
- `src/App.tsx`：应用主入口。管理路由、双世界切换、全局用户状态（能量、日志、最后交互时间）、系统/个性化提醒检测逻辑（Timer）。
- `src/types.ts`：全局类型定义（UserState, ActivityLog, Exercise, Reminder, UserProfile）。
- `src/data.ts`：内置的默认放松锻炼数据。
- `src/components/Splash.tsx`：页面 1，应用开屏页。
- `src/components/MorningCheckin.tsx`：页面 2，早晨打卡充能页面。
- `src/components/Avatar.tsx`：空空的视觉核心。根据能量值计算大小、心跳频率、流体形状。
- `src/components/Dashboard.tsx`：状态日志面板。包含双世界能量对比、今日统计、能量轨迹对比折线图（Recharts）、能量日历。
- `src/components/LogHistoryModal.tsx`：页面 a / a1，今日能量轨迹列表。在“如果”世界中，忙碌记录会映射为休息记录展示。
- `src/components/ChoiceModal.tsx`：系统干预/随机提示选项。支持“选择 A（小空一下）”和“选择 B（继续忙碌）”。
- `src/components/ExerciseListModal.tsx`：页面 5，放松项目列表。
- `src/components/ExercisePlayer.tsx`：放松播放页。支持 1min/3min/继续模式，根据沉浸时长动态计算能量增益（5-35点）。
- `src/components/SecretCareModal.tsx`：页面 6，记录“偷偷关照”。
- `src/components/AddCustomActivity.tsx`：添加自定义专属项目。
- `src/components/ProfileModal.tsx`：页面 15，个人主页。修改用户名、头像，跳转提醒设置。
- `src/components/ReminderSettingsModal.tsx`：页面 16，小空提醒设置。自定义定时提醒。
- `src/components/ReminderPopup.tsx`：提醒弹窗。支持直接“开始”项目或“继续忙碌”。

## 开发约定 (Development Rules)
1. **无需复述历史**：后续迭代抛弃之前的中间态。代码编辑必须基于以上最新的代码版本进行直接外科手术式替换。仅永久保存项目最终完整源码。
2. **记录逻辑**：
    - “现在”世界：选择忙碌记录为灰色 +0；选择放松记录为项目名 +10（或动态值）。
    - “如果”世界：忙碌动作自动转化为“选择及时休息”并记录为 +10。
3. **极简原则**：始终保持 UI 干净，无环境与框架侵入代码。使用 Tailwind CSS 管理响应式和夜间模式。
4. **沉浸式交互**：弹窗使用虚化背景 (`backdrop-blur`)。动画使用 `motion/react`。
