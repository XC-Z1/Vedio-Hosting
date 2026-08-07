import React, { useState, useRef, useEffect } from 'react';
import { FileVideo, Play } from 'lucide-react';
import { VideoMeta } from '../types';
import { formatDuration } from '../lib/utils';

interface VideoPreviewThumbnailProps {
  video: VideoMeta;
  onClick?: () => void;
  onDurationLoaded?: (id: string, duration: number) => void;
  showDurationBadge?: boolean;
  className?: string;
}

export default function VideoPreviewThumbnail({ 
  video, 
  onClick, 
  onDurationLoaded,
  showDurationBadge = true,
  className = "w-28 h-18"
}: VideoPreviewThumbnailProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [duration, setDuration] = useState<number | undefined>(video.duration);

  useEffect(() => {
    if (video.duration) {
      setDuration(video.duration);
    }
  }, [video.duration]);

  const handleLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    const dur = e.currentTarget.duration;
    if (dur && isFinite(dur) && dur > 0) {
      setDuration(dur);
      if (onDurationLoaded) {
        onDurationLoaded(video.id, dur);
      }
    }
  };

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (isHovered && videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
      timeout = setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.pause();
          videoRef.current.currentTime = 0;
        }
      }, 4000);
    } else if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
    return () => clearTimeout(timeout);
  }, [isHovered]);

  const formattedDur = formatDuration(duration);

  return (
    <div 
      className={`${className} bg-gradient-to-br from-[#121620] to-[#0a0d14] border border-white/10 rounded-xl flex-shrink-0 flex items-center justify-center relative overflow-hidden group shadow-lg transition-all duration-300 hover:border-[#00FF88]/40 hover:shadow-[0_0_20px_rgba(0,255,136,0.15)] ${onClick ? 'cursor-pointer' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
    >
      <div className={`absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-10 transition-opacity duration-300 ${isHovered ? 'opacity-40' : 'opacity-80'}`} />
      
      {/* Fallback & Initial Icon */}
      <div className={`flex flex-col items-center justify-center gap-1 z-10 transition-all duration-300 ${isHovered ? 'scale-110 opacity-0' : 'scale-100 opacity-100'}`}>
        <FileVideo className="w-5 h-5 text-white/40 group-hover:text-[#00FF88] transition-colors" />
      </div>

      {/* Play Icon on Hover */}
      <div className={`absolute z-20 w-8 h-8 rounded-full bg-[#00FF88] text-black flex items-center justify-center shadow-lg transition-all duration-300 ${isHovered ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}`}>
        <Play className="w-4 h-4 fill-black translate-x-0.5" />
      </div>

      <video
        ref={videoRef}
        src={video.dataUrl || `/uploads/${video.filename}`}
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${isHovered ? 'opacity-100' : 'opacity-30'}`}
        muted
        playsInline
        preload="metadata"
        onLoadedMetadata={handleLoadedMetadata}
        loop={false}
      />

      {showDurationBadge && formattedDur && (
        <span className="absolute bottom-1.5 right-1.5 bg-black/90 text-[#00FF88] text-[10px] font-mono px-1.5 py-0.5 rounded-md border border-white/10 z-20 pointer-events-none shadow">
          {formattedDur}
        </span>
      )}
    </div>
  );
}

