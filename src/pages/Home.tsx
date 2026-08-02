import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, FileVideo, Shield, Zap, Sparkles, Search, Copy, Check, Trash2, ExternalLink, Film, AlertCircle, Palette } from 'lucide-react';
import { cn, formatDuration } from '../lib/utils';
import { Link, useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { VideoMeta } from '../types';
import VideoPreviewThumbnail from '../components/VideoPreviewThumbnail';
import { useTheme, themes, ThemeMode } from '../ThemeContext';
import { useToast } from '../ToastContext';

export default function Home() {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [recentVideos, setRecentVideos] = useState<VideoMeta[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const { theme, setTheme, config } = useTheme();
  const { toast } = useToast();

  useEffect(() => {
    const loadVideos = () => {
      const saved = localStorage.getItem('recent_videos');
      if (saved) {
        try {
          setRecentVideos(JSON.parse(saved));
        } catch (e) { }
      }
    };
    
    loadVideos();
    
    const handleVideosUpdated = () => {
      loadVideos();
    };

    window.addEventListener('videos_updated', handleVideosUpdated);
    return () => window.removeEventListener('videos_updated', handleVideosUpdated);
  }, []);

  const handleDurationLoaded = (id: string, duration: number) => {
    setRecentVideos(prev => {
      let updated = false;
      const next = prev.map(v => {
        if (v.id === id && (!v.duration || Math.abs(v.duration - duration) > 0.1)) {
          updated = true;
          return { ...v, duration };
        }
        return v;
      });
      if (updated) {
        localStorage.setItem('recent_videos', JSON.stringify(next));
      }
      return next;
    });
  };

  const addRecentVideo = (video: VideoMeta) => {
    const updated = [video, ...recentVideos].slice(0, 15);
    setRecentVideos(updated);
    localStorage.setItem('recent_videos', JSON.stringify(updated));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleFile = (file: File) => {
    setUploadError(null);
    const isVideo = file.type.startsWith('video/') || file.name.match(/\.(mp4|mov|webm|mkv|avi)$/i);
    if (!isVideo) {
      const errMsg = 'Please select a valid video file format (MP4, MOV, WEBM, MKV, AVI).';
      setUploadError(errMsg);
      toast.error(errMsg, 'Invalid File Format');
      return;
    }
    
    if (file.size > 1024 * 1024 * 1024) {
      const errMsg = 'File size exceeds the 1GB maximum limit.';
      setUploadError(errMsg);
      toast.error(errMsg, 'File Exceeds Limit');
      return;
    }

    toast.info(`Uploading "${file.name}"...`, 'File Upload Started');
    uploadFile(file);
  };

  const uploadFile = async (file: File) => {
    setIsUploading(true);
    setUploadProgress(0);
    setUploadError(null);

    const chunkSize = 512 * 1024;
    const totalChunks = Math.ceil(file.size / chunkSize);
    const uploadId = Date.now().toString() + '_' + Math.random().toString(36).substring(7);

    try {
      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        const start = chunkIndex * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const chunk = file.slice(start, end);

        const formData = new FormData();
        formData.append('chunk', chunk, 'chunk.bin');
        formData.append('uploadId', uploadId);
        formData.append('chunkIndex', chunkIndex.toString());

        await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', '/api/upload-chunk');
          
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const chunkProgress = e.loaded / e.total;
              const overallProgress = Math.round(((chunkIndex + chunkProgress) / totalChunks) * 100);
              setUploadProgress(overallProgress);
            }
          };

          xhr.onload = () => {
            if (xhr.status === 200) resolve(true);
            else reject(new Error(`Chunk upload failed with status ${xhr.status}`));
          };
          xhr.onerror = () => reject(new Error('Network error occurred during chunk transfer.'));
          xhr.send(formData);
        });
      }

      const completeRes = await fetch('/api/upload-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uploadId,
          fileName: file.name,
          mimeType: file.type,
          size: file.size,
          totalChunks
        })
      });

      if (!completeRes.ok) throw new Error('Failed to assemble video chunks on server.');

      const resData = await completeRes.json();
      if (resData.video) {
        setIsUploading(false);
        addRecentVideo(resData.video);
        toast.success(`"${file.name}" uploaded successfully!`, 'Upload Complete');
        navigate(`/v/${resData.video.id}`);
      } else {
        throw new Error('Invalid server response.');
      }

    } catch (err) {
      setIsUploading(false);
      const errMsg = err instanceof Error ? err.message : 'Upload failed. Please try again.';
      setUploadError(errMsg);
      toast.error(errMsg, 'Upload Failed');
    }
  };

  const filteredVideos = recentVideos.filter(v => 
    v.originalName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-8 pb-10">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">
        {/* Upload Section */}
        <div className="col-span-1 lg:col-span-8 flex flex-col gap-6">
          
          {/* Header Title with Badges */}
          <div className={`flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-2 border-b ${config.borderClass}`}>
            <div>
              <h2 className={`text-3xl sm:text-4xl font-serif italic tracking-tight ${config.textPrimary}`}>Upload Asset</h2>
              <p className={`text-xs ${config.textSecondary} tracking-wider font-light mt-1`}>
                High-bandwidth video streaming with instant playback URL generation.
              </p>
            </div>

            <div className={`flex items-center gap-3 text-[11px] font-mono ${config.textSecondary}`}>
              <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl ${theme === 'light' ? 'bg-slate-100 border-slate-200' : 'bg-white/5 border-white/10'} border`}>
                <Shield className={`w-3.5 h-3.5 ${config.accentColor}`} /> 1GB Max
              </span>
              <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl ${theme === 'light' ? 'bg-slate-100 border-slate-200' : 'bg-white/5 border-white/10'} border`}>
                <Zap className="w-3.5 h-3.5 text-cyan-400" /> Ultra Fast
              </span>
            </div>
          </div>

          {/* Dropzone Card */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !isUploading && fileInputRef.current?.click()}
            className={cn(
              "relative group flex-1 min-h-[360px] sm:min-h-[400px] rounded-3xl border-2 border-dashed transition-all duration-500 cursor-pointer overflow-hidden flex flex-col items-center justify-center p-8 text-center shadow-2xl backdrop-blur-sm",
              config.dropzoneBgClass,
              isDragging 
                ? `${config.accentBorder} bg-opacity-20 scale-[1.01]` 
                : `${config.borderClass} hover:${config.accentBorder} hover:shadow-2xl`,
              isUploading && "pointer-events-none opacity-90"
            )}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="video/*"
              className="hidden"
            />

            {/* Ambient Glows */}
            <div className={cn("absolute -top-24 -left-24 w-60 h-60 rounded-full blur-3xl pointer-events-none group-hover:opacity-100 transition-all duration-700", config.glowClass)} />

            <div className="relative z-20 flex flex-col items-center max-w-md w-full">
              {/* Circle Upload Icon */}
              <div className={cn(
                "w-20 h-20 rounded-2xl border flex items-center justify-center transition-all duration-500 mb-6 shadow-xl relative",
                isDragging 
                  ? `${config.accentBg} text-black scale-110 shadow-2xl` 
                  : `${config.borderClass} ${theme === 'light' ? 'bg-slate-100 text-slate-700' : 'bg-white/5 text-white/70'} group-hover:scale-105`
              )}>
                {isUploading ? (
                  <div className="relative flex items-center justify-center">
                    <div className={`w-10 h-10 border-2 ${config.accentBorder} border-t-transparent rounded-full animate-spin`} />
                    <Film className={`w-4 h-4 ${config.accentColor} absolute`} />
                  </div>
                ) : (
                  <UploadCloud className="w-9 h-9" />
                )}
              </div>

              <div className="space-y-2 mb-6">
                <h3 className={`text-xl font-semibold tracking-tight ${config.textPrimary}`}>
                  {isUploading ? 'Streaming Video Chunk Data...' : 'Drop video file here, or browse computer'}
                </h3>
                <p className={`text-xs ${config.textSecondary} max-w-xs mx-auto leading-relaxed font-light`}>
                  {isUploading 
                    ? `Uploading chunks to server storage • ${uploadProgress}% completed` 
                    : 'Supports high frame rate MP4, MOV, WEBM, MKV or AVI up to 1GB.'}
                </p>
              </div>

              {/* Progress Bar & Badges during upload */}
              {isUploading && (
                <div className="w-full space-y-2 mt-2">
                  <div className={`flex justify-between items-center text-xs font-mono ${config.textSecondary}`}>
                    <span className={config.accentColor}>Processing</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className={`w-full h-2.5 ${theme === 'light' ? 'bg-slate-200' : 'bg-white/10'} rounded-full overflow-hidden p-0.5 border ${config.borderClass}`}>
                    <div 
                      className={`h-full ${config.accentBg} rounded-full transition-all duration-300 ease-out`}
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {!isUploading && (
                <div className={`inline-flex items-center gap-2 px-6 py-3 rounded-2xl ${config.buttonPrimary} text-xs shadow-lg transition-all duration-300`}>
                  <span>Select Video File</span>
                </div>
              )}
            </div>
          </div>

          {uploadError && (
            <div className="p-4 rounded-2xl border border-red-500/30 bg-red-500/10 text-red-400 text-xs flex items-center gap-3 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{uploadError}</span>
            </div>
          )}
        </div>

        {/* Recent Uploads Sidebar */}
        <div className={`col-span-1 lg:col-span-4 flex flex-col gap-4 lg:border-l ${config.borderClass} lg:pl-8`}>
          <div className="flex items-center justify-between">
            <h3 className={`text-xs font-semibold uppercase tracking-widest ${config.textSecondary}`}>Recent Assets</h3>
            <span className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full ${config.badgeClass}`}>
              {filteredVideos.length} Items
            </span>
          </div>

          {/* Search Input */}
          {recentVideos.length > 0 && (
            <div className="relative">
              <Search className={`w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 ${config.textSecondary}`} />
              <input 
                type="text"
                placeholder="Search recent assets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full ${theme === 'light' ? 'bg-white border-slate-200 text-slate-800' : 'bg-[#0a0d14] border-white/10 text-white'} border rounded-2xl pl-10 pr-3 py-2.5 text-xs placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition-colors`}
              />
            </div>
          )}

          {/* Video List */}
          <div className="flex flex-col gap-3 overflow-y-auto max-h-[580px] pr-1">
            {filteredVideos.length === 0 ? (
              <div className={`p-8 rounded-3xl border ${config.borderClass} border-dashed text-center ${config.cardBgClass}`}>
                <FileVideo className={`w-8 h-8 ${config.textSecondary} mx-auto mb-2 opacity-50`} />
                <p className={`text-xs ${config.textSecondary} leading-relaxed font-light`}>
                  {searchQuery ? 'No matching videos found' : 'No recent video uploads'}
                </p>
              </div>
            ) : (
              filteredVideos.map((video) => (
                <div 
                  key={video.id} 
                  className={`group flex gap-3 p-3 rounded-2xl border ${config.borderClass} ${config.cardBgClass} hover:shadow-lg transition-all duration-300`}
                >
                  <VideoPreviewThumbnail
                    video={video}
                    onClick={() => navigate(`/v/${video.id}`)}
                    onDurationLoaded={handleDurationLoaded}
                    className="w-24 h-16 rounded-xl overflow-hidden"
                  />
                  <div className="flex flex-col justify-center min-w-0 flex-1">
                    <Link to={`/v/${video.id}`} className="block w-full">
                      <p className={`text-xs font-semibold ${config.textPrimary} group-hover:${config.accentColor} transition-colors truncate`} title={video.originalName}>
                        {video.originalName}
                      </p>
                    </Link>
                    <p className={`text-[10px] font-mono ${config.textSecondary} mt-1`}>
                      {formatDistanceToNow(new Date(video.createdAt))} ago • {(video.size / (1024 * 1024)).toFixed(1)} MB
                    </p>
                    
                    {/* Actions */}
                    <div className="flex items-center gap-3 mt-2">
                      <button 
                        onClick={(e) => {
                          e.preventDefault();
                          navigator.clipboard.writeText(`${window.location.origin}/v/${video.id}`);
                          setCopiedLink(video.id);
                          toast.success('Link copied to clipboard!', 'Link Copied');
                          setTimeout(() => setCopiedLink(null), 2000);
                        }}
                        className={cn(
                          "text-[10px] font-mono flex items-center gap-1 transition-colors",
                          copiedLink === video.id ? `${config.accentColor} font-bold` : `${config.textSecondary} hover:${config.textPrimary}`
                        )}
                      >
                        {copiedLink === video.id ? (
                          <>
                            <Check className={`w-3 h-3 ${config.accentColor}`} /> Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" /> Copy Link
                          </>
                        )}
                      </button>

                      <button 
                        onClick={async (e) => {
                          e.preventDefault();
                          if (confirmDelete !== video.id) {
                            setConfirmDelete(video.id);
                            setTimeout(() => setConfirmDelete(null), 3000);
                            return;
                          }
                          try {
                            await fetch(`/api/videos/${video.id}`, { method: 'DELETE' });
                            const updated = recentVideos.filter(v => v.id !== video.id);
                            setRecentVideos(updated);
                            localStorage.setItem('recent_videos', JSON.stringify(updated));
                            setConfirmDelete(null);
                            window.dispatchEvent(new Event('videos_updated'));
                            toast.info(`"${video.originalName}" has been deleted.`, 'Asset Deleted');
                          } catch(err) {
                            console.error(err);
                            toast.error('Failed to delete asset. Please try again.', 'Error');
                          }
                        }}
                        className={cn(
                          "text-[10px] font-mono flex items-center gap-1 transition-colors ml-auto",
                          confirmDelete === video.id ? 'text-red-500 font-bold' : 'text-red-400/50 hover:text-red-400'
                        )}
                      >
                        <Trash2 className="w-3 h-3" />
                        {confirmDelete === video.id ? 'Confirm?' : ''}
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

