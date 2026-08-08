import React, { useState, useRef, useEffect } from 'react';
import { FileVideo, Play, Loader2 } from 'lucide-react';
import { VideoMeta } from '../types';
import { formatDuration } from '../lib/utils';
import { generateVideoThumbnail } from '../lib/thumbnail';

interface VideoPreviewThumbnailProps {
  video: VideoMeta;
  onClick?: () => void;
  onDurationLoaded?: (id: string, duration: number) => void;
  onThumbnailGenerated?: (id: string, thumbnailUrl: string) => void;
  showDurationBadge?: boolean;
  className?: string;
}

export default function VideoPreviewThumbnail({ 
  video, 
  onClick, 
  onDurationLoaded,
  onThumbnailGenerated,
  showDurationBadge = true,
  className = "w-28 h-18"
}: VideoPreviewThumbnailProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [duration, setDuration] = useState<number | undefined>(video.duration);
  const [thumbUrl, setThumbUrl] = useState<string | undefined>(video.thumbnailUrl);
  const [isGeneratingThumb, setIsGeneratingThumb] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [videoError, setVideoError] = useState(false);

  const videoSource = video.dataUrl || video.downloadUrl || `/uploads/${video.filename}` || '/api/sample-video';

  // 1. Sync thumbnail from video prop or generate automatically if missing
  useEffect(() => {
    if (video.thumbnailUrl) {
      setThumbUrl(video.thumbnailUrl);
    } else if (!thumbUrl && !isGeneratingThumb && videoSource) {
      setIsGeneratingThumb(true);
      generateVideoThumbnail(videoSource, 1.0)
        .then(({ thumbnailUrl, duration: dur }) => {
          if (thumbnailUrl) {
            setThumbUrl(thumbnailUrl);
            video.thumbnailUrl = thumbnailUrl;
            if (onThumbnailGenerated) {
              onThumbnailGenerated(video.id, thumbnailUrl);
            }
          }
          if (dur && !duration) {
            setDuration(dur);
            if (onDurationLoaded) {
              onDurationLoaded(video.id, dur);
            }
          }
        })
        .catch((err) => {
          console.warn('Auto thumbnail generation warning:', err);
        })
        .finally(() => {
          setIsGeneratingThumb(false);
        });
    }
  }, [video.id, video.thumbnailUrl, videoSource]);

  useEffect(() => {
    if (video.duration) {
      setDuration(video.duration);
    }
  }, [video.duration]);

  // Handle metadata/data load on the live video element
  const handleVideoLoaded = () => {
    if (videoRef.current) {
      const v = videoRef.current;
      const dur = v.duration;
      if (dur && isFinite(dur) && dur > 0) {
        setDuration(dur);
        if (onDurationLoaded) {
          onDurationLoaded(video.id, dur);
        }
      }
    }
  };

  const handleVideoError = () => {
    setVideoError(true);
  };

  // Hover video preview playback
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (isHovered && videoRef.current && !videoError) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
      timeout = setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.pause();
          if ((videoRef.current.duration || 0) > 0.5) {
            videoRef.current.currentTime = 0.5;
          }
        }
      }, 5000);
    } else if (videoRef.current) {
      videoRef.current.pause();
      if (videoRef.current.currentTime === 0 && (videoRef.current.duration || 0) > 0.5) {
        videoRef.current.currentTime = 0.5;
      }
    }
    return () => clearTimeout(timeout);
  }, [isHovered, videoError]);

  const formattedDur = formatDuration(duration);

  return (
    <div 
      className={`${className} bg-[#0c1017] border border-white/10 rounded-xl flex-shrink-0 flex items-center justify-center relative overflow-hidden group shadow-lg transition-all duration-300 hover:border-[#00FF88]/50 hover:shadow-[0_0_20px_rgba(0,255,136,0.15)] ${onClick ? 'cursor-pointer' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
    >
      {/* 1. Captured Picture Image Poster (Static image display) */}
      {thumbUrl && !imageFailed ? (
        <img
          src={thumbUrl}
          alt={video.originalName || 'Video thumbnail'}
          onError={() => setImageFailed(true)}
          className={`absolute inset-0 w-full h-full object-cover transition-all duration-300 ${
            isHovered ? 'opacity-20 scale-105' : 'opacity-100 scale-100'
          } z-10`}
        />
      ) : null}

      {/* 2. Loading Shimmer when generating thumbnail frame */}
      {isGeneratingThumb && !thumbUrl && (
        <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center z-20">
          <Loader2 className="w-5 h-5 text-[#00FF88] animate-spin" />
        </div>
      )}

      {/* 3. Live Video Element for Hover Preview */}
      {!videoError && (
        <video
          ref={videoRef}
          src={videoSource}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
            isHovered ? 'opacity-100 z-15' : 'opacity-0 z-0'
          }`}
          muted
          playsInline
          preload="metadata"
          onLoadedMetadata={handleVideoLoaded}
          onLoadedData={handleVideoLoaded}
          onError={handleVideoError}
        />
      )}

      {/* 4. Vignette Gradient Overlay */}
      <div className={`absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none transition-opacity duration-300 ${isHovered ? 'opacity-20 z-20' : 'opacity-60 z-12'}`} />

      {/* 5. Fallback File Icon if no thumbnail image and video failed */}
      {!thumbUrl && !isGeneratingThumb && (
        <div className="flex flex-col items-center justify-center gap-1 z-10 pointer-events-none">
          <FileVideo className="w-7 h-7 text-white/40 group-hover:text-[#00FF88] transition-colors" />
        </div>
      )}

      {/* 6. Center Play Icon Overlay */}
      <div className={`absolute z-25 w-10 h-10 rounded-full bg-[#00FF88] text-black flex items-center justify-center shadow-2xl transition-all duration-300 ${isHovered ? 'scale-100 opacity-100' : 'scale-75 opacity-80 group-hover:scale-90 group-hover:opacity-100'}`}>
        <Play className="w-4 h-4 fill-black translate-x-0.5" />
      </div>

      {/* 7. Duration Badge */}
      {showDurationBadge && formattedDur && (
        <span className="absolute bottom-1.5 right-1.5 bg-black/90 text-[#00FF88] text-[10px] font-mono px-1.5 py-0.5 rounded-md border border-white/10 z-25 pointer-events-none shadow">
          {formattedDur}
        </span>
      )}
    </div>
  );
}
