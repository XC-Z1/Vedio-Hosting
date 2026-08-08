import { useEffect, useState, useRef, SyntheticEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import { VideoMeta } from '../types';
import { ArrowLeft, Loader2, Copy, Check, Download, Eye, Film, Sparkles, HardDrive, Shield, Gauge, Tag, Plus, X, Maximize, Maximize2, Minimize2, QrCode, Code, Share2, SkipBack, SkipForward, PictureInPicture2, Keyboard, HelpCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { motion } from 'motion/react';
import { formatDuration, getShareableVideoUrl } from '../lib/utils';
import { useTheme } from '../ThemeContext';
import { useToast } from '../ToastContext';
import { QRCodeSvg } from '../lib/qrSvg';

export default function VideoView() {
  const { id } = useParams<{ id: string }>();
  const [video, setVideo] = useState<VideoMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [copiedEmbed, setCopiedEmbed] = useState(false);
  const [copiedDirect, setCopiedDirect] = useState(false);
  const [duration, setDuration] = useState<number | undefined>(undefined);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [newTagInput, setNewTagInput] = useState('');
  const [isAddingTag, setIsAddingTag] = useState(false);
  
  const [isTheatreMode, setIsTheatreMode] = useState(false);
  const [isCleanPlayerMode, setIsCleanPlayerMode] = useState(true);
  const [shareTab, setShareTab] = useState<'direct' | 'link' | 'embed' | 'qr'>('direct');
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);

  const { theme, config } = useTheme();
  const { toast } = useToast();

  const viewCountedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!id) return;

    const loadVideoFromData = (data: any) => {
      setVideo({
        ...data,
        public: true
      });
      if (data.duration) setDuration(data.duration);
      if (data.originalName) {
        document.title = `${data.originalName} - StreamShare Direct Player`;
      }
      setLoading(false);

      if (viewCountedRef.current !== id) {
        viewCountedRef.current = id;
        fetch(`/api/videos/${data.id || id}/view`, { method: 'POST' })
          .then(res => res.json())
          .then(resData => {
            if (resData && typeof resData.viewCount === 'number') {
              setVideo(prev => prev ? { ...prev, viewCount: resData.viewCount } : prev);
            }
          })
          .catch(() => {});
      }
    };

    fetch(`/api/videos/${id}`)
      .then(res => {
        if (!res.ok) throw new Error('Video not found');
        return res.json();
      })
      .then(data => {
        if (data && (data.downloadUrl || data.dataUrl || data.filename)) {
          loadVideoFromData(data);
        } else {
          throw new Error('Invalid data');
        }
      })
      .catch(() => {
        // Fallback: Check localStorage recent_videos strictly for this video ID
        const saved = localStorage.getItem('recent_videos');
        if (saved) {
          try {
            const parsed = JSON.parse(saved) as VideoMeta[];
            const found = parsed.find(v => v.id === id || v.filename === id || (v.filename && v.filename.includes(id)));
            if (found) {
              loadVideoFromData(found);
              return;
            }
          } catch (e) {}
        }

        setError('This video link is invalid or the video has been removed.');
        setLoading(false);
      });

    return () => {
      document.title = 'StreamShare Pro - Fast & Secure Video Sharing';
    };
  }, [id]);

  // Keyboard shortcuts listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in input
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (!videoRef.current) return;

      if (e.code === 'Space') {
        e.preventDefault();
        if (videoRef.current.paused) videoRef.current.play();
        else videoRef.current.pause();
      } else if (e.code === 'KeyF') {
        e.preventDefault();
        if (document.fullscreenElement) {
          document.exitFullscreen();
        } else {
          videoRef.current.requestFullscreen();
        }
      } else if (e.code === 'KeyM') {
        e.preventDefault();
        videoRef.current.muted = !videoRef.current.muted;
        toast.info(videoRef.current.muted ? 'Muted' : 'Unmuted', 'Audio Toggle');
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 5);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        videoRef.current.currentTime = Math.min(videoRef.current.duration || 0, videoRef.current.currentTime + 5);
      } else if (e.code === 'KeyT') {
        e.preventDefault();
        setIsTheatreMode(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSeek = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.min(
        Math.max(0, videoRef.current.currentTime + seconds),
        videoRef.current.duration || 0
      );
    }
  };

  const handleTogglePiP = async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (e) {
      toast.error('Picture-in-Picture is not supported in this browser environment', 'PiP Unavailable');
    }
  };

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

  const shareUrl = getShareableVideoUrl(id || '', false);
  const directShareUrl = getShareableVideoUrl(id || '', true);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success('Share URL copied to clipboard!', 'Link Copied');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyDirect = () => {
    navigator.clipboard.writeText(directShareUrl);
    setCopiedDirect(true);
    toast.success('Direct Video Link copied! Anyone with this link sees ONLY the video.', 'Direct Link Copied');
    setTimeout(() => setCopiedDirect(false), 2000);
  };

  const embedCodeSnippet = video ? `<iframe src="${window.location.href}" width="640" height="360" frameborder="0" allowfullscreen></iframe>` : '';

  const handleCopyEmbed = () => {
    navigator.clipboard.writeText(embedCodeSnippet);
    setCopiedEmbed(true);
    toast.success('HTML embed snippet copied to clipboard!', 'Embed Code Copied');
    setTimeout(() => setCopiedEmbed(false), 2000);
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
          <h2 className="text-2xl font-serif italic text-white mb-2">
            {error?.includes('private') ? 'Private Video' : 'Asset Not Available'}
          </h2>
          <p className="text-xs text-white/50 leading-relaxed font-light mb-6">
            {error || 'This media file has been removed or the share link has expired.'}
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

  const downloadSrc = video.downloadUrl || `/uploads/${video.filename}`;

  return (
    <div className={`grid grid-cols-1 ${isTheatreMode || isCleanPlayerMode ? '' : 'lg:grid-cols-12'} gap-8 h-full pb-10 transition-all duration-300`}>
      <div className={`col-span-1 ${isTheatreMode || isCleanPlayerMode ? 'w-full max-w-5xl mx-auto' : 'lg:col-span-8'} flex flex-col gap-6`}>
        
        {/* Top Header Navigation & Mode Controls */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <Link to="/" className={`inline-flex items-center gap-2 text-xs font-mono ${config.textSecondary} hover:${config.accentColor} transition-colors group`}>
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span>Back to Dashboard</span>
          </Link>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setIsCleanPlayerMode(prev => !prev)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border ${config.borderClass} ${
                isCleanPlayerMode ? 'bg-[#00FF88] text-slate-950 font-bold shadow-lg' : `${config.cardBgClass} ${config.textSecondary} hover:${config.textPrimary}`
              } text-xs font-mono transition-all`}
              title="Toggle Direct Video Mode"
            >
              <Film className="w-3.5 h-3.5" />
              <span>{isCleanPlayerMode ? 'Full Studio' : 'Direct Video View'}</span>
            </button>

            <button
              onClick={() => setShowShortcutsModal(true)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border ${config.borderClass} ${config.cardBgClass} text-xs font-mono ${config.textSecondary} hover:${config.textPrimary} transition-all`}
              title="Keyboard Shortcuts"
            >
              <Keyboard className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Shortcuts</span>
            </button>

            <button
              onClick={() => setIsTheatreMode(prev => !prev)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border ${config.borderClass} ${
                isTheatreMode ? 'bg-emerald-500 text-slate-950 font-bold' : `${config.cardBgClass} ${config.textSecondary} hover:${config.textPrimary}`
              } text-xs font-mono transition-all`}
              title="Toggle Theatre Mode (T)"
            >
              {isTheatreMode ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{isTheatreMode ? 'Exit Theatre' : 'Theatre Mode'}</span>
            </button>
          </div>
        </div>

        {/* Cinema Video Container */}
        <div className={`relative ${isTheatreMode ? 'aspect-[21/9]' : 'aspect-video'} ${theme === 'light' ? 'bg-slate-900' : 'bg-[#030508]'} rounded-3xl overflow-hidden border ${config.borderClass} shadow-2xl group transition-all duration-300`}>
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none z-10" />
          <video 
            ref={videoRef}
            className="w-full h-full object-contain relative z-20 cursor-pointer"
            controls
            autoPlay
            playsInline
            src={video.dataUrl || video.downloadUrl || `/uploads/${video.filename}`}
            onLoadedMetadata={handleLoadedMetadata}
            onCanPlay={() => {
              if (videoRef.current) {
                videoRef.current.play().catch(() => {
                  // If browser blocked unmuted autoplay, try muted autoplay
                  if (videoRef.current) {
                    videoRef.current.muted = true;
                    videoRef.current.play().catch(() => {});
                  }
                });
              }
            }}
            onError={(e) => {
              console.warn('Video playback source warning:', e);
            }}
            onPlay={() => {
              setIsPlaying(true);
              if (videoRef.current) {
                videoRef.current.playbackRate = playbackSpeed;
              }
            }}
            onPause={() => setIsPlaying(false)}
          >
            Your browser does not support the video tag.
          </video>

          {!isPlaying && (
            <div 
              onClick={() => {
                if (videoRef.current) {
                  videoRef.current.muted = false;
                  videoRef.current.play().catch(() => {});
                }
              }}
              className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 backdrop-blur-[2px] cursor-pointer group-hover:bg-black/30 transition-all"
            >
              <div className="flex flex-col items-center gap-3 bg-black/80 text-white px-8 py-5 rounded-3xl border border-[#00FF88]/40 shadow-2xl shadow-[#00FF88]/20 group-hover:scale-105 transition-transform">
                <div className="w-16 h-16 rounded-full bg-[#00FF88] flex items-center justify-center text-slate-950 shadow-lg">
                  <Film className="w-8 h-8 translate-x-0.5" />
                </div>
                <span className="font-bold text-sm tracking-wide">Click to Play Video</span>
                <span className="text-[11px] text-white/60 font-mono">StreamShare Direct Stream</span>
              </div>
            </div>
          )}
        </div>

        {/* Pro Playback Controls Bar */}
        <div className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-2xl border ${config.borderClass} ${config.cardBgClass} shadow-lg`}>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleSeek(-5)}
              className={`p-1.5 rounded-lg border ${config.borderClass} ${config.textSecondary} hover:${config.textPrimary} hover:bg-white/5 transition-all text-xs font-mono flex items-center gap-1`}
              title="Seek back 5s (←)"
            >
              <SkipBack className="w-3.5 h-3.5" /> -5s
            </button>
            <button
              onClick={() => handleSeek(5)}
              className={`p-1.5 rounded-lg border ${config.borderClass} ${config.textSecondary} hover:${config.textPrimary} hover:bg-white/5 transition-all text-xs font-mono flex items-center gap-1`}
              title="Seek forward 5s (→)"
            >
              +5s <SkipForward className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Gauge className={`w-4 h-4 ${config.accentColor}`} />
            <span className={`text-xs font-semibold ${config.textPrimary} hidden sm:inline`}>Speed:</span>
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

          <div className="flex items-center gap-2">
            <button
              onClick={handleTogglePiP}
              className={`p-2 rounded-xl border ${config.borderClass} ${config.textSecondary} hover:${config.textPrimary} hover:bg-white/5 transition-all text-xs flex items-center gap-1.5`}
              title="Toggle Picture-In-Picture"
            >
              <PictureInPicture2 className="w-4 h-4" />
              <span className="hidden md:inline">PiP</span>
            </button>
          </div>
        </div>

        {/* Title & Stats Bar */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pt-2">
          <div className="space-y-2 max-w-xl">
            <div className="flex flex-wrap items-center gap-2">
              <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${config.badgeClass} text-[10px] font-mono`}>
                <Film className="w-3 h-3" /> Uncompressed Source
              </div>
              <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full ${video.public === false ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'} text-[10px] font-mono font-medium`}>
                <Shield className="w-3 h-3" /> {video.public === false ? 'Private (Owner Only)' : 'Public Shared Link'}
              </div>
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

          <div className="flex items-center gap-2.5 shrink-0 flex-wrap sm:flex-nowrap">
            <button
              onClick={handleCopyDirect}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-[#00FF88] hover:bg-[#00e67a] text-slate-950 font-bold text-xs transition-all shadow-lg shadow-[#00FF88]/20 hover:scale-105 active:scale-95 cursor-pointer"
              title="Copy shareable video link to clipboard"
            >
              {copiedDirect ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Link Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy Video Link</span>
                </>
              )}
            </button>

            <a
              href={downloadSrc}
              download={video.originalName}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl ${config.buttonSecondary} border text-xs font-semibold transition-all shadow-md`}
            >
              <Download className={`w-4 h-4 ${config.accentColor}`} />
              <span>Download Video</span>
            </a>
          </div>
        </div>

        {/* Tabbed Share & Integration Studio Card */}
        <div className={`${config.cardBgClass} p-5 sm:p-6 rounded-3xl border ${config.borderClass} flex flex-col gap-5 shadow-xl`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-3">
            <div className="flex items-center gap-2">
              <Share2 className={`w-4 h-4 ${config.accentColor}`} />
              <h3 className={`text-xs font-semibold uppercase tracking-wider ${config.textPrimary}`}>Share & Integration Studio</h3>
            </div>

            {/* Studio Navigation Tabs */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-black/10 dark:bg-white/5 border border-white/10 flex-wrap">
              <button
                onClick={() => setShareTab('direct')}
                className={`px-3 py-1 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 ${
                  shareTab === 'direct'
                    ? 'bg-[#00FF88] text-slate-950 font-bold shadow-md'
                    : `${config.textSecondary} hover:${config.textPrimary}`
                }`}
              >
                <Film className="w-3.5 h-3.5" />
                <span>Direct Video Link</span>
              </button>

              <button
                onClick={() => setShareTab('link')}
                className={`px-3 py-1 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 ${
                  shareTab === 'link'
                    ? 'bg-emerald-500 text-slate-950 font-bold shadow-md'
                    : `${config.textSecondary} hover:${config.textPrimary}`
                }`}
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Standard Link</span>
              </button>

              <button
                onClick={() => setShareTab('embed')}
                className={`px-3 py-1 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 ${
                  shareTab === 'embed'
                    ? 'bg-emerald-500 text-slate-950 font-bold shadow-md'
                    : `${config.textSecondary} hover:${config.textPrimary}`
                }`}
              >
                <Code className="w-3.5 h-3.5" />
                <span>HTML Embed</span>
              </button>

              <button
                onClick={() => setShareTab('qr')}
                className={`px-3 py-1 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 ${
                  shareTab === 'qr'
                    ? 'bg-emerald-500 text-slate-950 font-bold shadow-md'
                    : `${config.textSecondary} hover:${config.textPrimary}`
                }`}
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>Mobile QR</span>
              </button>
            </div>
          </div>

          {/* TAB 0: Direct Video Link */}
          {shareTab === 'direct' && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in">
              <div className="min-w-0 flex-1">
                <p className={`text-[10px] font-mono uppercase tracking-widest ${config.textSecondary} mb-1`}>Direct Video Link (Zero Clutter)</p>
                <p className={`font-mono text-xs sm:text-sm text-[#00FF88] truncate ${theme === 'light' ? 'bg-slate-100 border-slate-200' : 'bg-black/40 border-white/10'} px-3 py-2 rounded-xl border select-all`}>{directShareUrl}</p>
                <p className="text-[10px] font-mono text-white/50 mt-1">Friends opening this link will see ONLY the video player directly!</p>
              </div>
              <button
                onClick={handleCopyDirect}
                className={`shrink-0 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-[#00FF88] text-slate-950 font-bold text-xs shadow-lg transition-all hover:scale-105`}
              >
                {copiedDirect ? (
                  <>
                    <Check className="w-4 h-4" /> Link Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" /> Copy Direct Link
                  </>
                )}
              </button>
            </div>
          )}

          {/* TAB 1: Direct Link */}
          {shareTab === 'link' && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in">
              <div className="min-w-0 flex-1">
                <p className={`text-[10px] font-mono uppercase tracking-widest ${config.textSecondary} mb-1`}>Standard Studio Link</p>
                <p className={`font-mono text-xs sm:text-sm ${config.accentColor} truncate ${theme === 'light' ? 'bg-slate-100 border-slate-200' : 'bg-black/40 border-white/10'} px-3 py-2 rounded-xl border select-all`}>{shareUrl}</p>
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
          )}

          {/* TAB 2: HTML Embed Code */}
          {shareTab === 'embed' && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in">
              <div className="min-w-0 flex-1">
                <p className={`text-[10px] font-mono uppercase tracking-widest ${config.textSecondary} mb-1`}>Responsive iFrame Snippet</p>
                <p className={`font-mono text-xs ${config.accentColor} break-all ${theme === 'light' ? 'bg-slate-100 border-slate-200' : 'bg-black/40 border-white/10'} px-3 py-2 rounded-xl border select-all`}>
                  {embedCodeSnippet}
                </p>
              </div>
              <button
                onClick={handleCopyEmbed}
                className={`shrink-0 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl ${config.buttonPrimary} text-xs shadow-lg transition-all`}
              >
                {copiedEmbed ? (
                  <>
                    <Check className="w-4 h-4" /> Embed Copied!
                  </>
                ) : (
                  <>
                    <Code className="w-4 h-4" /> Copy Embed
                  </>
                )}
              </button>
            </div>
          )}

          {/* TAB 3: Instant Mobile QR Code */}
          {shareTab === 'qr' && (
            <div className="flex flex-col sm:flex-row items-center gap-6 p-2 animate-in fade-in">
              <div className="shrink-0">
                <QRCodeSvg value={shareUrl} size={150} darkColor={theme === 'light' ? '#0f172a' : '#10b981'} />
              </div>
              <div className="space-y-2 text-center sm:text-left">
                <h4 className={`text-sm font-semibold ${config.textPrimary}`}>Scan to Play on Smartphone</h4>
                <p className={`text-xs ${config.textSecondary} leading-relaxed max-w-sm`}>
                  Point your mobile device camera at this QR code to instantly stream this media asset on iOS or Android.
                </p>
                <p className={`text-[10px] font-mono ${config.accentColor}`}>No login or app install required.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Shortcuts Helper Modal */}
      {showShortcutsModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowShortcutsModal(false)}>
          <div className={`max-w-md w-full p-6 rounded-3xl border ${config.borderClass} ${config.cardBgClass} shadow-2xl space-y-5 animate-in zoom-in-95`} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Keyboard className={`w-5 h-5 ${config.accentColor}`} />
                <h3 className={`text-sm font-bold ${config.textPrimary}`}>Playback Keyboard Shortcuts</h3>
              </div>
              <button onClick={() => setShowShortcutsModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs font-mono">
              <div className="flex items-center justify-between p-2 rounded-xl bg-black/20 border border-white/5">
                <span className={config.textSecondary}>Play / Pause</span>
                <kbd className="px-2 py-1 rounded bg-white/10 text-emerald-400 font-bold border border-white/20">Space</kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-black/20 border border-white/5">
                <span className={config.textSecondary}>Toggle Fullscreen</span>
                <kbd className="px-2 py-1 rounded bg-white/10 text-emerald-400 font-bold border border-white/20">F</kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-black/20 border border-white/5">
                <span className={config.textSecondary}>Toggle Mute</span>
                <kbd className="px-2 py-1 rounded bg-white/10 text-emerald-400 font-bold border border-white/20">M</kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-black/20 border border-white/5">
                <span className={config.textSecondary}>Seek Back 5 seconds</span>
                <kbd className="px-2 py-1 rounded bg-white/10 text-emerald-400 font-bold border border-white/20">← Left</kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-black/20 border border-white/5">
                <span className={config.textSecondary}>Seek Forward 5 seconds</span>
                <kbd className="px-2 py-1 rounded bg-white/10 text-emerald-400 font-bold border border-white/20">→ Right</kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-black/20 border border-white/5">
                <span className={config.textSecondary}>Toggle Theatre Mode</span>
                <kbd className="px-2 py-1 rounded bg-white/10 text-emerald-400 font-bold border border-white/20">T</kbd>
              </div>
            </div>

            <button
              onClick={() => setShowShortcutsModal(false)}
              className={`w-full py-2.5 rounded-2xl ${config.buttonPrimary} text-xs font-semibold shadow-lg`}
            >
              Got It
            </button>
          </div>
        </div>
      )}
      
      {/* Sidebar Metadata Card */}
      {!isCleanPlayerMode && !isTheatreMode && (
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
      )}
    </div>
  );
}

