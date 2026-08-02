import React, { useState, useRef, useEffect } from 'react';
import { FileVideo } from 'lucide-react';
import { VideoMeta } from '../types';
import { formatDuration } from '../lib/utils';

interface VideoPreviewThumbnailProps {
  video: VideoMeta;
  onClick?: () => void;
  onDurationLoaded?: (id: string, duration: number) => void;
  showDurationBadge?: boolean;
}

export default function VideoPreviewThumbnail({ 
  video, 
  onClick, 
  onDurationLoaded,
  showDurationBadge = true 
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
      }, 3000);
    } else if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
    return () => clearTimeout(timeout);
  }, [isHovered]);

  const formattedDur = formatDuration(duration);

  return (
    <div 
      className={`w-24 h-16 bg-[#111] border border-white/10 flex-shrink-0 flex items-center justify-center relative overflow-hidden group ${onClick ? 'cursor-pointer' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
    >
      <FileVideo className={`w-6 h-6 text-white/20 absolute z-10 transition-opacity duration-300 ${isHovered ? 'opacity-0' : 'opacity-100'}`} />
      <video
        ref={videoRef}
        src={video.downloadUrl || `/uploads/${video.filename}`}
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${isHovered ? 'opacity-100' : 'opacity-0'}`}
        muted
        playsInline
        preload="metadata"
        onLoadedMetadata={handleLoadedMetadata}
        loop={false}
      />
      {showDurationBadge && formattedDur && (
        <span className="absolute bottom-1 right-1 bg-black/85 text-[#00FF88] text-[9px] font-mono px-1 py-0.5 rounded border border-white/10 z-20 pointer-events-none">
          {formattedDur}
        </span>
      )}
    </div>
  );
}
