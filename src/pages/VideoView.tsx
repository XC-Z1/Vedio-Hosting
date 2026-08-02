import { useEffect, useState, SyntheticEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import { VideoMeta } from '../types';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { motion } from 'motion/react';
import { formatDuration } from '../lib/utils';

export default function VideoView() {
  const { id } = useParams<{ id: string }>();
  const [video, setVideo] = useState<VideoMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [duration, setDuration] = useState<number | undefined>(undefined);

  useEffect(() => {
    fetch(`/api/videos/${id}`)
      .then(res => {
        if (!res.ok) throw new Error('Video not found');
        return res.json();
      })
      .then(data => {
        setVideo(data);
        if (data.duration) setDuration(data.duration);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [id]);

  const handleLoadedMetadata = (e: SyntheticEvent<HTMLVideoElement, Event>) => {
    const dur = e.currentTarget.duration;
    if (dur && isFinite(dur) && dur > 0) {
      setDuration(dur);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[#00FF88]" />
      </div>
    );
  }

  if (error || !video) {
    return (
      <div className="max-w-lg mx-auto mt-20 text-center flex flex-col items-center justify-center">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", bounce: 0.5 }}
          className="relative w-64 h-64 mb-8"
        >
          <motion.svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-2xl">
            {/* Background shape */}
            <rect x="30" y="40" width="140" height="110" rx="12" fill="#111" stroke="#333" strokeWidth="4" />
            <path d="M40 150 L160 150" stroke="#333" strokeWidth="4" strokeLinecap="round" />
            
            {/* Broken film strip holes */}
            {[...Array(6)].map((_, i) => (
              <rect key={`top-${i}`} x={40 + i * 20} y="48" width="10" height="8" rx="2" fill="#333" />
            ))}
            {[...Array(6)].map((_, i) => (
              <rect key={`bottom-${i}`} x={40 + i * 20} y="134" width="10" height="8" rx="2" fill="#333" />
            ))}

            {/* Sad Face */}
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

            {/* Tear drop */}
            <motion.path 
              d="M120 105 Q125 115 120 120 Q115 115 120 105" 
              fill="#00FF88"
              animate={{ y: [0, 10, 15], opacity: [0, 1, 0] }}
              transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
            />
            
            {/* Crack in the film */}
            <path d="M60 40 L80 80 L70 100 L90 150" stroke="#050505" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M60 40 L80 80 L70 100 L90 150" stroke="#333" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </motion.svg>
          
          {/* Floating 404 badges */}
          <motion.div 
            className="absolute -top-4 -right-4 bg-[#00FF88] text-black font-mono font-bold px-4 py-2 rounded-full rotate-12 shadow-lg"
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
          <h2 className="text-3xl font-serif italic text-[#F5F5F5] mb-2">Asset Not Found</h2>
          <p className="text-xs text-white/40 uppercase tracking-widest leading-relaxed">
            The video has been permanently deleted<br/>or the link is broken.
          </p>
          <Link to="/" className="inline-block mt-8 border border-white/20 px-8 py-4 text-[10px] uppercase font-bold tracking-widest hover:bg-white hover:text-black transition-all">
            Return to Dashboard
          </Link>
        </motion.div>
      </div>
    );
  }

  const shareUrl = window.location.href;

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-8 h-full">
      <div className="col-span-1 md:col-span-8 flex flex-col gap-6">
        <Link to="/" className="inline-flex items-center space-x-2 text-[10px] uppercase tracking-widest text-white/40 hover:text-white transition-colors">
          <ArrowLeft className="w-3 h-3" />
          <span>Back to Library</span>
        </Link>

        <div className="relative aspect-video bg-[#111] group overflow-hidden border border-white/5">
          <video 
            className="w-full h-full object-contain relative z-20"
            controls
            autoPlay
            src={video.downloadUrl || `/uploads/${video.filename}`}
            onLoadedMetadata={handleLoadedMetadata}
          >
            Your browser does not support the video tag.
          </video>
        </div>

        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-4xl font-serif italic mb-2 break-all">{video.originalName}</h2>
            <p className="text-xs text-white/60 tracking-wider font-light">
              Uploaded {formatDistanceToNow(new Date(video.createdAt))} ago • {formatDuration(duration) ? `${formatDuration(duration)} • ` : ''}{(video.size / (1024 * 1024)).toFixed(2)} MB • {video.mimetype.split('/')[1]?.toUpperCase() || 'VIDEO'}
            </p>
          </div>
        </div>

        <div className="bg-white/5 p-6 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between mt-4 gap-4">
          <div className="min-w-0 flex-1 pr-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 mb-1">Shareable Link</p>
            <p className="font-mono text-sm text-[#00FF88] truncate">{shareUrl}</p>
          </div>
          <button
            onClick={handleCopyLink}
            className="shrink-0 px-6 py-3 border border-white/20 hover:bg-white hover:text-black transition-colors text-[10px] uppercase font-bold tracking-widest"
          >
            {copied ? 'Copied' : 'Copy Link'}
          </button>
        </div>
      </div>
      
      {/* Sidebar Placeholder for Video View */}
      <div className="col-span-1 md:col-span-4 flex flex-col gap-4 border-l border-white/10 pl-8">
        <h3 className="text-[10px] uppercase tracking-[0.3em] text-white/30 mb-4">Asset Details</h3>
        
        <div className="space-y-6">
          <div>
            <p className="text-[10px] text-white/40 uppercase tracking-widest mb-1">ID</p>
            <p className="font-mono text-xs">{video.id}</p>
          </div>
          {duration !== undefined && duration > 0 && (
            <div>
              <p className="text-[10px] text-white/40 uppercase tracking-widest mb-1">Duration</p>
              <p className="font-mono text-xs">{formatDuration(duration)}</p>
            </div>
          )}
          <div>
            <p className="text-[10px] text-white/40 uppercase tracking-widest mb-1">Format</p>
            <p className="font-mono text-xs">{video.mimetype}</p>
          </div>
          <div>
            <p className="text-[10px] text-white/40 uppercase tracking-widest mb-1">System Name</p>
            <p className="font-mono text-xs break-all">{video.filename}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
