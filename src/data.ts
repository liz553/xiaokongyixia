import { Exercise } from './types';

export const EXERCISES: Exercise[] = [
  {
    id: 'breathe_1',
    title: '冥想',
    description: '跟随空空的节奏，深呼吸，回到当下的身体里。',
    type: 'default',
    durationSeconds: 180, // 3 mins default
    energyBoost: 15,
    guideText: [
      "准备好了吗？让我们开始吧。",
      "找一个舒服的姿势，肩膀放松。",
      "如果有念头飘过，轻轻在心里说一句，这是个念头...",
      "然后继续观察呼吸。",
      "深深地吸气...",
      "缓慢地呼气...",
      "感受此刻的宁静。"
    ]
  },
  {
    id: 'stretch_1',
    title: '下蹲',
    description: '离开椅子，活动一下僵硬的关节，唤醒身体的活力。',
    type: 'default',
    durationSeconds: 60, // 1 min default
    energyBoost: 20,
    guideText: [
      "来，暂时离开一下屏幕，站起来吧。",
      "双腿与肩同宽，感受双脚稳稳踩在地面的感觉。",
      "现在，让我们缓慢地下蹲...",
      "保持一下...",
      "好，慢慢站起。",
      "感受身体重新充满了轻盈的力量。"
    ]
  }
];

export const INTERVENTION_PROMPTS = [
  "肩膀是不是不知不觉又紧张起来了？你的小分身想邀请你放松一下。",
  "刚才工作太投入了吧！呼吸是不是有点浅了？来陪我深呼吸几次好吗？",
  "如果你现在停下来1分钟，会让接下来的1小时更清晰。要试试吗？",
  "我看你好像陷入了某种情绪或念头里，试着跳出来，我们去散散步？"
];
