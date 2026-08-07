import React, { useState, useRef, useEffect } from 'react';
import { FileVideo, Play } from 'lucide-react';
import { VideoMeta } from '../types';
import { formatDuration } from '../lib/utils';
import { generateVideoThumbnail } from '../lib/thumbnail';

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
  const [thumbUrl, setThumbUrl] = useState<string | undefined>(video.thumbnailUrl);
  const [imageFailed, setImageFailed] = useState(false);

  const videoSource = video.dataUrl || `/uploads/${video.filename}`;

  useEffect(() => {
    if (video.thumbnailUrl) {
      setThumbUrl(video.thumbnailUrl);
    } else if (!thumbUrl) {
      generateVideoThumbnail(videoSource, 0.5)
        .then(({ thumbnailUrl, duration: dur }) => {
          if (thumbnailUrl) {
            setThumbUrl(thumbnailUrl);
          }
          if (dur && !duration) {
            setDuration(dur);
            if (onDurationLoaded) {
              onDurationLoaded(video.id, dur);
            }
          }
        })
        .catch(() => {
          generateVideoThumbnail(videoSource, 0.1)
            .then(({ thumbnailUrl }) => setThumbUrl(thumbnailUrl))
            .catch(() => {});
        });
    }
  }, [video.id, video.thumbnailUrl, videoSource]);

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
      {/* Background Poster Image */}
      {thumbUrl && !imageFailed ? (
        <img
          src={thumbUrl}
          alt={video.originalName || 'Video thumbnail'}
          onError={() => setImageFailed(true)}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${isHovered ? 'opacity-0' : 'opacity-100'}`}
        />
      ) : null}

      {/* Subtle Gradient Overlay */}
      <div className={`absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent z-10 transition-opacity duration-300 ${isHovered ? 'opacity-30' : 'opacity-50'}`} />
      
      {/* Fallback Icon if no thumbnail image exists and not hovered */}
      {(!thumbUrl || imageFailed) && (
        <div className={`flex flex-col items-center justify-center gap-1 z-10 transition-all duration-300 ${isHovered ? 'scale-110 opacity-0' : 'scale-100 opacity-100'}`}>
          <FileVideo className="w-6 h-6 text-white/50 group-hover:text-[#00FF88] transition-colors" />
        </div>
      )}

      {/* Hover Play Button */}
      <div className={`absolute z-20 w-8 h-8 rounded-full bg-[#00FF88] text-black flex items-center justify-center shadow-lg transition-all duration-300 ${isHovered ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}`}>
        <Play className="w-4 h-4 fill-black translate-x-0.5" />
      </div>

      {/* Live Preview Video on Hover */}
      <video
        ref={videoRef}
        src={`${videoSource}#t=0.5`}
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${isHovered ? 'opacity-100 z-15' : 'opacity-0 z-0'}`}
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
