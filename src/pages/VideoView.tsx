import { useEffect, useState, useRef, SyntheticEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import { VideoMeta } from '../types';
import { ArrowLeft, Loader2, Copy, Check, Download, Eye, Film, Sparkles, HardDrive, Shield, Gauge, Tag, Plus, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { motion } from 'motion/react';
import { formatDuration } from '../lib/utils';
import { useTheme } from '../ThemeContext';
import { useToast } from '../ToastContext';

export default function VideoView() {
  const { id } = useParams<{ id: string }>();
  const [video, setVideo] = useState<VideoMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [duration, setDuration] = useState<number | undefined>(undefined);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [newTagInput, setNewTagInput] = useState('');
  const [isAddingTag, setIsAddingTag] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const { theme, config } = useTheme();
  const { toast } = useToast();

  const viewCountedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!id) return;

    fetch(`/api/videos/${id}`)
      .then(res => {
        if (!res.ok) throw new Error('Video not found');
        return res.json();
      })
      .then(data => {
        setVideo(data);
        if (data.duration) setDuration(data.duration);
        if (data.originalName) {
          document.title = `${data.originalName} - StreamShare Pro`;
        }
        setLoading(false);

        // Increment view count strictly once per video ID on page load
        if (viewCountedRef.current !== id) {
          viewCountedRef.current = id;
          fetch(`/api/videos/${id}/view`, { method: 'POST' })
            .then(res => res.json())
            .then(resData => {
              if (resData && typeof resData.viewCount === 'number') {
                setVideo(prev => prev ? { ...prev, viewCount: resData.viewCount } : prev);
              }
            })
            .catch(() => {});
        }
      })
      .catch(err => {
        // Fallback to localStorage if API endpoint fails or is delayed
        const saved = localStorage.getItem('recent_videos');
        if (saved) {
          try {
            const parsed = JSON.parse(saved) as VideoMeta[];
            const found = parsed.find(v => v.id === id);
            if (found) {
              setVideo(found);
              if (found.duration) setDuration(found.duration);
              if (found.originalName) {
                document.title = `${found.originalName} - StreamShare Pro`;
              }
              setLoading(false);
              return;
            }
          } catch (e) {}
        }
        setError(err.message);
        setLoading(false);
      });

    return () => {
      document.title = 'StreamShare Pro - Fast & Secure Video Sharing';
    };
  }, [id]);

  const handleLoadedMetadata = (e: SyntheticEvent<HTMLVideoElement, Event>) => {
    const dur = e.currentTarget.duration;
    if (dur && isFinite(dur) && dur > 0) {
      setDuration(dur);
    }
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackSpeed;
    }
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
    toast.info(`Playback speed set to ${speed}x`, 'Speed Adjusted');
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    toast.success('Direct share URL copied to clipboard!', 'Link Copied');
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[60vh] gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-[#00FF88]" />
        <p className="text-xs font-mono text-white/50 animate-pulse">Initializing Stream Engine...</p>
      </div>
    );
  }

  if (error || !video) {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center flex flex-col items-center justify-center p-8 bg-[#090d15] border border-white/10 rounded-3xl shadow-2xl">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", bounce: 0.5 }}
          className="relative w-56 h-56 mb-6"
        >
          <motion.svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-2xl">
            <rect x="30" y="40" width="140" height="110" rx="16" fill="#0d121d" stroke="rgba(255,255,255,0.15)" strokeWidth="3" />
            <path d="M40 150 L160 150" stroke="rgba(255,255,255,0.15)" strokeWidth="3" strokeLinecap="round" />
            
            {[...Array(6)].map((_, i) => (
              <rect key={`top-${i}`} x={40 + i * 20} y="48" width="10" height="8" rx="2" fill="rgba(255,255,255,0.2)" />
            ))}
            {[...Array(6)].map((_, i) => (
              <rect key={`bottom-${i}`} x={40 + i * 20} y="134" width="10" height="8" rx="2" fill="rgba(255,255,255,0.2)" />
            ))}

            <motion.path 
              d="M75 95 Q85 85 95 95" 
              stroke="#F5F5F5" strokeWidth="4" strokeLinecap="round" 
              animate={{ d: ["M75 95 Q85 85 95 95", "M75 90 Q85 80 95 90", "M75 95 Q85 85 95 95"] }}
              transition={{ duration: 3, repeat: Infinity }}
            />
            <motion.path 
              d="M105 95 Q115 85 125 95" 
              stroke="#F5F5F5" strokeWidth="4" strokeLinecap="round" 
              animate={{ d: ["M105 95 Q115 85 125 95", "M105 90 Q115 80 125 90", "M105 95 Q115 85 125 95"] }}
              transition={{ duration: 3, repeat: Infinity }}
            />
            
            <motion.path 
              d="M85 115 Q100 105 115 115" 
              stroke="#F5F5F5" strokeWidth="4" strokeLinecap="round"
              animate={{ d: ["M85 120 Q100 110 115 120", "M85 115 Q100 105 115 115", "M85 120 Q100 110 115 120"] }}
              transition={{ duration: 3, repeat: Infinity }}
            />

            <motion.path 
              d="M120 105 Q125 115 120 120 Q115 115 120 105" 
              fill="#00FF88"
              animate={{ y: [0, 10, 15], opacity: [0, 1, 0] }}
              transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
            />
            
            <path d="M60 40 L80 80 L70 100 L90 150" stroke="#05080e" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M60 40 L80 80 L70 100 L90 150" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </motion.svg>
          
          <motion.div 
            className="absolute -top-2 -right-2 bg-[#00FF88] text-black font-mono font-bold px-3 py-1 text-xs rounded-full rotate-12 shadow-lg"
            animate={{ rotate: [12, 16, 12] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          >
            404
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <h2 className="text-2xl font-serif italic text-white mb-2">Asset Not Available</h2>
          <p className="text-xs text-white/50 leading-relaxed font-light mb-6">
            This media file has been removed or the share link has expired.
          </p>
          <Link to="/" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#00FF88] text-black font-semibold text-xs transition-transform hover:scale-105 shadow-lg">
            <ArrowLeft className="w-4 h-4" /> Return to Dashboard
          </Link>
        </motion.div>
      </div>
    );
  }

  const handleAddTag = async () => {
    if (!newTagInput.trim() || !video) return;
    const clean = newTagInput.trim().toLowerCase().replace(/^#/, '');
    const currentTags = video.tags || [];
    if (currentTags.includes(clean)) {
      setNewTagInput('');
      setIsAddingTag(false);
      return;
    }

    const updated = [...currentTags, clean];
    setVideo(prev => prev ? { ...prev, tags: updated } : prev);
    setNewTagInput('');
    setIsAddingTag(false);

    try {
      await fetch(`/api/videos/${video.id}/tags`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: updated })
      });
      const saved = localStorage.getItem('recent_videos');
      if (saved) {
        try {
          const list: VideoMeta[] = JSON.parse(saved);
          const idx = list.findIndex(v => v.id === video.id);
          if (idx !== -1) {
            list[idx].tags = updated;
            localStorage.setItem('recent_videos', JSON.stringify(list));
          }
        } catch (e) {}
      }
      toast.success(`Added tag "#${clean}"`, 'Tags Updated');
    } catch (e) {
      toast.error('Failed to update tags', 'Error');
    }
  };

  const handleRemoveTag = async (tagToRemove: string) => {
    if (!video) return;
    const updated = (video.tags || []).filter(t => t !== tagToRemove);
    setVideo(prev => prev ? { ...prev, tags: updated } : prev);

    try {
      await fetch(`/api/videos/${video.id}/tags`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: updated })
      });
      const saved = localStorage.getItem('recent_videos');
      if (saved) {
        try {
          const list: VideoMeta[] = JSON.parse(saved);
          const idx = list.findIndex(v => v.id === video.id);
          if (idx !== -1) {
            list[idx].tags = updated;
            localStorage.setItem('recent_videos', JSON.stringify(list));
          }
        } catch (e) {}
      }
      toast.info(`Removed tag "#${tagToRemove}"`, 'Tags Updated');
    } catch (e) {
      toast.error('Failed to remove tag', 'Error');
    }
  };

  const shareUrl = window.location.href;
  const downloadSrc = video.downloadUrl || `/uploads/${video.filename}`;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full pb-10">
      <div className="col-span-1 lg:col-span-8 flex flex-col gap-6">
        
        {/* Back Link */}
        <Link to="/" className={`inline-flex items-center gap-2 text-xs font-mono ${config.textSecondary} hover:${config.accentColor} transition-colors group`}>
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>Back to Assets Dashboard</span>
        </Link>

        {/* Cinema Video Container */}
        <div className={`relative aspect-video ${theme === 'light' ? 'bg-slate-900' : 'bg-[#030508]'} rounded-3xl overflow-hidden border ${config.borderClass} shadow-2xl group`}>
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none z-10" />
          <video 
            ref={videoRef}
            className="w-full h-full object-contain relative z-20"
            controls
            autoPlay
            playsInline
            src={`/uploads/${video.filename}`}
            onLoadedMetadata={handleLoadedMetadata}
            onPlay={() => {
              if (videoRef.current) {
                videoRef.current.playbackRate = playbackSpeed;
              }
            }}
          >
            Your browser does not support the video tag.
          </video>
        </div>

        {/* Playback Speed Controls Bar */}
        <div className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-2xl border ${config.borderClass} ${config.cardBgClass} shadow-lg`}>
          <div className="flex items-center gap-2">
            <Gauge className={`w-4 h-4 ${config.accentColor}`} />
            <span className={`text-xs font-semibold ${config.textPrimary}`}>Playback Speed</span>
          </div>

          <div className="flex items-center gap-1 sm:gap-1.5 p-1 rounded-xl bg-black/10 dark:bg-white/5 border border-white/10">
            {[0.5, 1, 1.25, 1.5, 2].map((speed) => (
              <button
                key={speed}
                onClick={() => handleSpeedChange(speed)}
                className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs font-mono font-medium transition-all duration-150 ${
                  playbackSpeed === speed
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-md scale-105'
                    : `${config.textSecondary} hover:${config.textPrimary} hover:bg-white/10`
                }`}
              >
                {speed}x
              </button>
            ))}
          </div>
        </div>

        {/* Title & Stats Bar */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pt-2">
          <div className="space-y-2 max-w-xl">
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${config.badgeClass} text-[10px] font-mono`}>
              <Film className="w-3 h-3" /> Uncompressed Source
            </div>
            <h2 className={`text-3xl sm:text-4xl font-serif italic ${config.textPrimary} break-all leading-tight`}>{video.originalName}</h2>
            <p className={`text-xs ${config.textSecondary} font-mono pt-0.5`}>
              Uploaded {formatDistanceToNow(new Date(video.createdAt))} ago • {(video.size / (1024 * 1024)).toFixed(2)} MB
            </p>

            {/* Tags Banner */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {video.tags && video.tags.length > 0 ? (
                video.tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  >
                    #{tag}
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      className="hover:text-rose-400 transition-colors ml-0.5"
                      title="Remove tag"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))
              ) : (
                <span className={`text-xs font-mono ${config.textSecondary} italic`}>No tags assigned</span>
              )}

              {isAddingTag ? (
                <div className="inline-flex items-center gap-1">
                  <input
                    type="text"
                    value={newTagInput}
                    onChange={(e) => setNewTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTag();
                      } else if (e.key === 'Escape') {
                        setIsAddingTag(false);
                      }
                    }}
                    placeholder="New tag..."
                    autoFocus
                    className={`px-2.5 py-1 text-xs font-mono border rounded-lg ${
                      theme === 'light' ? 'bg-white text-slate-900 border-slate-300' : 'bg-black/40 text-white border-white/20'
                    } focus:outline-none focus:border-emerald-500 w-24`}
                  />
                  <button
                    onClick={handleAddTag}
                    className="p-1 text-emerald-400 hover:text-emerald-300"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setIsAddingTag(false)}
                    className="p-1 text-slate-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsAddingTag(true)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono ${config.textSecondary} hover:${config.accentColor} hover:bg-white/5 border border-transparent hover:border-white/10 transition-colors`}
                >
                  <Tag className="w-3 h-3" />
                  <span>+ Add Tag</span>
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <a
              href={downloadSrc}
              download={video.originalName}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl ${config.buttonSecondary} border text-xs font-semibold transition-all shadow-md`}
            >
              <Download className={`w-4 h-4 ${config.accentColor}`} />
              <span>Download</span>
            </a>
          </div>
        </div>

        {/* Share Link Banner Card */}
        <div className={`${config.cardBgClass} p-5 sm:p-6 rounded-2xl border ${config.borderClass} flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl`}>
          <div className="min-w-0 flex-1">
            <p className={`text-[10px] font-mono uppercase tracking-widest ${config.textSecondary} mb-1`}>Direct Shareable Link</p>
            <p className={`font-mono text-xs sm:text-sm ${config.accentColor} truncate ${theme === 'light' ? 'bg-slate-100 border-slate-200' : 'bg-black/40 border-white/10'} px-3 py-2 rounded-xl border`}>{shareUrl}</p>
          </div>
          <button
            onClick={handleCopyLink}
            className={`shrink-0 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl ${config.buttonPrimary} text-xs shadow-lg transition-all`}
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" /> Link Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" /> Copy Link
              </>
            )}
          </button>
        </div>
      </div>
      
      {/* Sidebar Metadata Card */}
      <div className={`col-span-1 lg:col-span-4 flex flex-col gap-4 lg:border-l ${config.borderClass} lg:pl-8`}>
        <h3 className={`text-xs font-semibold uppercase tracking-widest ${config.textSecondary} mb-2`}>Asset Details</h3>
        
        <div className={`p-6 rounded-2xl border ${config.borderClass} ${config.cardBgClass} space-y-5 shadow-xl`}>
          <div className={`pb-4 border-b ${config.borderClass}`}>
            <p className={`text-[10px] font-mono uppercase ${config.textSecondary} mb-1`}>Unique Asset ID</p>
            <p className={`font-mono text-xs ${config.textPrimary} break-all select-all`}>{video.id}</p>
          </div>

          {duration !== undefined && duration > 0 && (
            <div className={`pb-4 border-b ${config.borderClass}`}>
              <p className={`text-[10px] font-mono uppercase ${config.textSecondary} mb-1`}>Runtime Duration</p>
              <p className={`font-mono text-xs ${config.accentColor} font-bold`}>{formatDuration(duration)}</p>
            </div>
          )}

          <div className={`pb-4 border-b ${config.borderClass}`}>
            <p className={`text-[10px] font-mono uppercase ${config.textSecondary} mb-1`}>MIME Format</p>
            <p className="font-mono text-xs text-cyan-400">{video.mimetype}</p>
          </div>

          <div className={`pb-4 border-b ${config.borderClass}`}>
            <p className={`text-[10px] font-mono uppercase ${config.textSecondary} mb-1`}>Views Count</p>
            <div className="flex items-center gap-2 mt-0.5">
              <Eye className={`w-4 h-4 ${config.textSecondary}`} />
              <span className={`font-mono text-xs font-semibold ${config.textPrimary}`}>{video.viewCount || 1} Views</span>
            </div>
          </div>

          <div>
            <p className={`text-[10px] font-mono uppercase ${config.textSecondary} mb-1`}>System Filename</p>
            <p className={`font-mono text-xs ${config.textSecondary} break-all`}>{video.filename}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

