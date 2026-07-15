import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { X, Trash2, Video, Music } from 'lucide-react';
import { Exercise } from '../types';
import { saveLargeMedia, getLargeMedia, checkVisitorQuota, checkCloudQuota, uploadCloudMedia } from '../lib/db';
import { getAuthToken } from '../lib/api';

interface AddCustomActivityProps {
  existingExercise: Exercise | null;
  onSave: (exercise: Exercise) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
}

export function AddCustomActivity({ existingExercise, onSave, onDelete, onClose }: AddCustomActivityProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [contentType, setContentType] = useState<'none' | 'url' | 'text' | 'video' | 'audio'>('none');
  const [contentUrl, setContentUrl] = useState('');
  const [contentText, setContentText] = useState('');
  const [durationStr, setDurationStr] = useState('');
  const [energyStr, setEnergyStr] = useState('');
  const [mp4FileName, setMp4FileName] = useState('');
  const [audioFileName, setAudioFileName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const loadMedia = async () => {
      if (existingExercise) {
        setTitle(existingExercise.title);
        setDescription(existingExercise.description || '');
        
        let mediaType: 'none' | 'text' | 'url' | 'video' | 'audio' = 'none';
        if (existingExercise.customMediaType) {
          mediaType = existingExercise.customMediaType;
        } else if (existingExercise.contentUrl) {
          const urlStr = existingExercise.contentUrl.toLowerCase();
          if (urlStr.startsWith('data:video/') || urlStr.endsWith('.mp4') || urlStr.endsWith('.webm') || urlStr.endsWith('.mov')) {
            mediaType = 'video';
          } else if (urlStr.startsWith('data:audio/') || urlStr.endsWith('.mp3') || urlStr.endsWith('.m4a') || urlStr.endsWith('.wav')) {
            mediaType = 'audio';
          } else {
            mediaType = 'url';
          }
        } else if (existingExercise.contentText) {
          mediaType = 'text';
        }

        setContentType(mediaType);

        if (existingExercise.contentUrl) {
          let url = existingExercise.contentUrl;
          if (url.startsWith('db_ref:')) {
            const id = url.replace('db_ref:', '');
            try {
              const actualMedia = await getLargeMedia(`media_${id}`);
              if (actualMedia) {
                url = actualMedia;
              }
            } catch (err) {
              console.warn('Failed to load media from IndexedDB:', err);
            }
          }
          setContentUrl(url);

          if (mediaType === 'video') {
            setMp4FileName('已选择的视频文件.mp4');
          } else if (mediaType === 'audio') {
            setAudioFileName('已选择的音频文件');
          }
        } else if (existingExercise.contentText) {
          setContentText(existingExercise.contentText);
        }

        setDurationStr(existingExercise.durationSeconds > 0 ? String(Math.round(existingExercise.durationSeconds / 60)) : '');
        setEnergyStr(existingExercise.energyBoost > 0 ? String(existingExercise.energyBoost) : '');
      }
    };

    loadMedia();
  }, [existingExercise]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || isSaving) return;

    setIsSaving(true);
    const exerciseId = existingExercise ? existingExercise.id : `custom_${Date.now()}`;
    
    let finalContentUrl = (contentType === 'url' || contentType === 'video' || contentType === 'audio') ? contentUrl.trim() : undefined;

    // Save to IndexedDB if it's a base64 string
    if (finalContentUrl && finalContentUrl.startsWith('data:')) {
      try {
        await saveLargeMedia(`media_${exerciseId}`, finalContentUrl);
        finalContentUrl = `db_ref:${exerciseId}`;
      } catch (err) {
        console.error('Failed to save to IndexedDB:', err);
      }
    }

    const newExercise: Exercise = {
      id: exerciseId,
      title: title.trim(),
      description: description.trim() || '专属小空活动',
      guideText: existingExercise?.guideText || [],
      contentUrl: finalContentUrl,
      contentText: contentType === 'text' ? contentText.trim() : undefined,
      type: existingExercise?.type || 'custom',
      durationSeconds: parseInt(durationStr) ? parseInt(durationStr) * 60 : 0,
      energyBoost: parseInt(energyStr) || 0,
      customMediaType: contentType,
    };

    onSave(newExercise);
    setIsSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-100/80 dark:bg-stone-950/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md p-6 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl relative shadow-xl max-h-[90vh] overflow-y-auto custom-scrollbar"
      >
        <button onClick={onClose} className="absolute top-6 right-6 text-stone-400 hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300">
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-xl font-medium text-stone-800 dark:text-stone-200 mb-6">
          {existingExercise ? '修改小空活动' : '添加小空活动'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-stone-500 dark:text-stone-400 mb-1">小空活动 <span className="text-red-400">*</span></label>
            <input 
              type="text" 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-xl px-4 py-3 text-stone-800 dark:text-stone-200 outline-none focus:border-sky-400 dark:focus:border-sky-500/50 transition-colors"
              placeholder="散步"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-stone-500 dark:text-stone-400 mb-1">描述</label>
            <input 
              type="text" 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-xl px-4 py-3 text-stone-800 dark:text-stone-200 outline-none focus:border-sky-400 dark:focus:border-sky-500/50 transition-colors text-sm"
              placeholder="专属小空活动"
            />
          </div>

          <div className="pt-2">
            <label className="block text-sm text-stone-500 dark:text-stone-400 mb-2">上传内容</label>
            <div className="flex flex-wrap gap-1.5 mb-3">
              <button 
                type="button"
                onClick={() => setContentType('none')}
                className={`px-3 py-2 text-xs rounded-lg transition-colors border ${contentType === 'none' ? 'bg-sky-50 border-sky-200 text-sky-600 dark:bg-sky-900/30 dark:border-sky-700 dark:text-sky-400 font-medium' : 'bg-transparent border-stone-200 text-stone-500 dark:border-stone-700'}`}
              >无内容</button>
              <button 
                type="button"
                onClick={() => setContentType('text')}
                className={`px-3 py-2 text-xs rounded-lg transition-colors border ${contentType === 'text' ? 'bg-sky-50 border-sky-200 text-sky-600 dark:bg-sky-900/30 dark:border-sky-700 dark:text-sky-400 font-medium' : 'bg-transparent border-stone-200 text-stone-500 dark:border-stone-700'}`}
              >文本</button>
              <button 
                type="button"
                onClick={() => setContentType('url')}
                className={`px-3 py-2 text-xs rounded-lg transition-colors border ${contentType === 'url' ? 'bg-sky-50 border-sky-200 text-sky-600 dark:bg-sky-900/30 dark:border-sky-700 dark:text-sky-400 font-medium' : 'bg-transparent border-stone-200 text-stone-500 dark:border-stone-700'}`}
              >链接</button>
              <button 
                type="button"
                onClick={() => setContentType('video')}
                className={`px-3 py-2 text-xs rounded-lg transition-colors border ${contentType === 'video' ? 'bg-sky-50 border-sky-200 text-sky-600 dark:bg-sky-900/30 dark:border-sky-700 dark:text-sky-400 font-medium' : 'bg-transparent border-stone-200 text-stone-500 dark:border-stone-700'}`}
              >视频文件</button>
              <button 
                type="button"
                onClick={() => setContentType('audio')}
                className={`px-3 py-2 text-xs rounded-lg transition-colors border ${contentType === 'audio' ? 'bg-sky-50 border-sky-200 text-sky-600 dark:bg-sky-900/30 dark:border-sky-700 dark:text-sky-400 font-medium' : 'bg-transparent border-stone-200 text-stone-500 dark:border-stone-700'}`}
              >音频文件</button>
            </div>
            
            {contentType === 'text' && (
              <textarea 
                value={contentText}
                onChange={(e) => setContentText(e.target.value)}
                rows={4}
                className="w-full bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-xl px-4 py-3 text-stone-800 dark:text-stone-200 outline-none focus:border-sky-400 dark:focus:border-sky-500/50 transition-colors text-sm custom-scrollbar"
                placeholder="粘贴你要阅读的文字或段落..."
              />
            )}

            {contentType === 'url' && (
              <input 
                type="url" 
                value={contentUrl}
                onChange={(e) => setContentUrl(e.target.value)}
                className="w-full bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-xl px-4 py-3 text-stone-800 dark:text-stone-200 outline-none focus:border-sky-400 dark:focus:border-sky-500/50 transition-colors text-sm"
                placeholder="https://"
              />
            )}

            {contentType === 'video' && (
              <div className="space-y-2">
                <div className="flex items-center justify-center border-2 border-dashed border-stone-200 dark:border-stone-800 rounded-xl p-4 bg-stone-50 dark:bg-stone-950">
                  <label className="cursor-pointer flex flex-col items-center space-y-2 w-full text-center">
                    <Video className="w-6 h-6 text-sky-500" />
                    <span className="text-xs text-sky-500 hover:text-sky-600 font-medium">选择视频文件，只支持mp4文件</span>
                    <input 
                      type="file" 
                      accept="video/mp4" 
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const isLogged = !!getAuthToken();
                          if (isLogged) {
                            const canUpload = await checkCloudQuota();
                            if (!canUpload) return;
                            setIsSaving(true);
                            const mediaId = await uploadCloudMedia(file, (p) => setMp4FileName(`上传中 ${p}%`));
                            setIsSaving(false);
                            if (mediaId) {
                               setMp4FileName(file.name);
                               setContentUrl(`cloud_ref:${mediaId}`);
                            } else {
                               setMp4FileName('');
                            }
                          } else {
                            if (file.size > 15 * 1024 * 1024) {
                              alert('较大媒体在浏览器本地存储可能存在丢失、加载缓慢风险');
                            }
                            const canSave = await checkVisitorQuota(file.size);
                            if (!canSave) return;
                            setMp4FileName(file.name);
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              if (event.target?.result) {
                                setContentUrl(event.target.result as string);
                              }
                            };
                            reader.readAsDataURL(file);
                          }
                        }
                      }}
                      className="hidden" 
                    />
                    {mp4FileName && (
                      <span className="text-xs text-stone-500 dark:text-stone-400 break-all text-center px-2 mt-1">
                        已选择: {mp4FileName}
                      </span>
                    )}
                  </label>
                </div>
              </div>
            )}

            {contentType === 'audio' && (
              <div className="space-y-2">
                <div className="flex items-center justify-center border-2 border-dashed border-stone-200 dark:border-stone-800 rounded-xl p-4 bg-stone-50 dark:bg-stone-950">
                  <label className="cursor-pointer flex flex-col items-center space-y-2 w-full text-center">
                    <Music className="w-6 h-6 text-sky-500" />
                    <span className="text-xs text-sky-500 hover:text-sky-600 font-medium">选择音频文件，支持mp4和m4a文件</span>
                    <input 
                      type="file" 
                      accept="audio/*,video/mp4" 
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const isLogged = !!getAuthToken();
                          if (isLogged) {
                            const canUpload = await checkCloudQuota();
                            if (!canUpload) return;
                            setIsSaving(true);
                            const mediaId = await uploadCloudMedia(file, (p) => setAudioFileName(`上传中 ${p}%`));
                            setIsSaving(false);
                            if (mediaId) {
                               setAudioFileName(file.name);
                               setContentUrl(`cloud_ref:${mediaId}`);
                            } else {
                               setAudioFileName('');
                            }
                          } else {
                            if (file.size > 15 * 1024 * 1024) {
                              alert('较大媒体在浏览器本地存储可能存在丢失、加载缓慢风险');
                            }
                            const canSave = await checkVisitorQuota(file.size);
                            if (!canSave) return;
                            setAudioFileName(file.name);
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              if (event.target?.result) {
                                setContentUrl(event.target.result as string);
                              }
                            };
                            reader.readAsDataURL(file);
                          }
                        }
                      }}
                      className="hidden" 
                    />
                    {audioFileName && (
                      <span className="text-xs text-stone-500 dark:text-stone-400 break-all text-center px-2 mt-1">
                        已选择: {audioFileName}
                      </span>
                    )}
                  </label>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-sm text-stone-500 dark:text-stone-400 mb-1">时间 (分钟)</label>
              <input 
                type="number" 
                min="0"
                value={durationStr}
                onChange={(e) => setDurationStr(e.target.value)}
                placeholder="不限时"
                className="w-full bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-xl px-4 py-3 text-stone-800 dark:text-stone-200 outline-none focus:border-sky-400 dark:focus:border-sky-500/50 transition-colors text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-stone-500 dark:text-stone-400 mb-1">能量恢复</label>
              <input 
                type="number" 
                min="0"
                value={energyStr}
                onChange={(e) => setEnergyStr(e.target.value)}
                placeholder="0"
                className="w-full bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-xl px-4 py-3 text-stone-800 dark:text-stone-200 outline-none focus:border-sky-400 dark:focus:border-sky-500/50 transition-colors text-sm"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-6">
             {existingExercise && onDelete && (
               <button
                 type="button"
                 onClick={() => onDelete(existingExercise.id)}
                 className="flex items-center justify-center w-14 py-4 text-red-500 bg-red-50 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20 rounded-2xl transition-all"
               >
                 <Trash2 className="w-5 h-5" />
               </button>
             )}
            <button
              type="submit"
              disabled={!title.trim()}
              className="flex-1 py-4 text-sm font-medium text-white bg-sky-500 hover:bg-sky-400 rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {existingExercise ? '保存修改' : '保存并添加'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
