export type ActivityType = 'breathing' | 'stretching' | 'mindfulness' | 'custom' | 'default';

export type Exercise = {
  id: string;
  title: string;
  description: string;
  guideText?: string[]; // Sentences for legacy guidance
  contentText?: string; // Text content like poem
  contentUrl?: string; // Url link
  type: ActivityType;
  durationSeconds: number; // 0 for optional/open-ended
  energyBoost: number;
  customMediaType?: 'video' | 'audio' | 'text' | 'url' | 'none';
};

export type Choice = 'A' | 'B';

export type ActivityLog = {
  id: string;
  timestamp: number;
  choice: Choice;
  exerciseId?: string;
  title?: string;
  energyChange: number;
};

export type Reminder = {
  id: string;
  time: string; // "HH:mm"
  exerciseId: string; // ID of the exercise to perform
  enabled: boolean;
};

export type UserProfile = {
  username: string;
  avatarUrl?: string;
  role?: 'user' | 'vip' | 'admin' | 'visitor';
  token?: string;
  email?: string;
};

export type UserState = {
  currentEnergy: number; // 30 to 100
  parallelEnergy: number; // 30 to 100 (The 'A' world counterpart)
  logs: ActivityLog[];
  customExercises: Exercise[]; 
  lastWakeupTime: number | null;
  lastInteractionTime: number | null;
  profile: UserProfile;
  reminders: Reminder[];
  allowReminders?: boolean;
  receiveEndNotification?: boolean;
};
