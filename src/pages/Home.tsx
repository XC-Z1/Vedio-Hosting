import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, FileVideo, Video, Link as LinkIcon, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { Link, useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { VideoMeta } from '../types';

export default function Home() {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [recentVideos, setRecentVideos] = useState<VideoMeta[]>([]);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

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

  const addRecentVideo = (video: VideoMeta) => {
    const updated = [video, ...recentVideos].slice(0, 10);
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
      setUploadError('Please select a valid video file.');
      return;
    }
    
    // Check limit (1GB)
    if (file.size > 1024 * 1024 * 1024) {
      setUploadError('File size exceeds 1GB limit.');
      return;
    }

    uploadFile(file);
  };

  const uploadFile = async (file: File) => {
    setIsUploading(true);
    setUploadProgress(0);
    setUploadError(null);

    const chunkSize = 512 * 1024; // 512KB chunks to safely bypass Nginx proxy limits
    const totalChunks = Math.ceil(file.size / chunkSize);
    const uploadId = Date.now().toString() + '_' + Math.random().toString(36).substring(7);

    try {
      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        const start = chunkIndex * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const chunk = file.slice(start, end);

        const formData = new FormData();
        formData.append('chunk', chunk);
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
            else reject(new Error('Chunk upload failed'));
          };
          xhr.onerror = () => reject(new Error('Network error occurred during upload.'));
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

      if (!completeRes.ok) throw new Error('Failed to finalize upload on server.');

      const resData = await completeRes.json();
      if (resData.video) {
        setIsUploading(false);
        addRecentVideo(resData.video);
        navigate(`/v/${resData.video.id}`);
      } else {
        throw new Error('Invalid response from server.');
      }

    } catch (err) {
      setIsUploading(false);
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-8 h-full">
      {/* Upload Section */}
      <div className="col-span-1 md:col-span-8 flex flex-col gap-6">
        <div className="mb-4">
          <h2 className="text-4xl font-serif italic mb-2">Upload Asset</h2>
          <p className="text-xs text-white/60 tracking-wider font-light">
            Secure, uncompressed video delivery.
          </p>
        </div>

        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !isUploading && fileInputRef.current?.click()}
          className={cn(
            "relative group flex-1 min-h-[400px] border border-white/5 bg-[#111] transition-all duration-300 cursor-pointer overflow-hidden flex flex-col items-center justify-center",
            isDragging ? "border-[#00FF88] bg-white/5" : "hover:border-white/20 hover:bg-white/5",
            isUploading && "pointer-events-none opacity-80"
          )}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="video/*"
            className="hidden"
          />
          
          <div className="flex flex-col items-center justify-center text-center space-y-6 p-8 z-20">
            <div className={cn(
              "w-16 h-16 rounded-full border flex items-center justify-center transition-colors duration-300",
              isDragging ? "border-[#00FF88] text-[#00FF88]" : "border-white/20 text-white/60 group-hover:border-white group-hover:text-white"
            )}>
              {isUploading ? (
                <Loader2 className="w-6 h-6 animate-spin text-[#00FF88]" />
              ) : (
                <UploadCloud className="w-6 h-6" />
              )}
            </div>
            
            <div className="space-y-2">
              <h3 className="text-sm uppercase tracking-widest text-white">
                {isUploading ? 'Processing File...' : 'Select or drop video'}
              </h3>
              <p className="text-[10px] uppercase tracking-widest text-white/40">
                {isUploading 
                  ? `${uploadProgress}% Complete` 
                  : 'Max 1GB • MP4, MOV, WEBM'}
              </p>
            </div>

            {isUploading && (
              <div className="w-full max-w-sm mx-auto h-1 bg-white/10 overflow-hidden mt-4">
                <div 
                  className="h-full bg-[#00FF88] transition-all duration-300 ease-out"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            )}
          </div>
          
          {/* Subtle gradient overlay like the design */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-10 pointer-events-none"></div>
        </div>

        {uploadError && (
          <div className="p-4 border border-red-500/30 bg-red-500/10 text-red-500 text-xs tracking-widest uppercase animate-in fade-in">
            Error: {uploadError}
          </div>
        )}
      </div>

      {/* Recent Uploads Sidebar */}
      <div className="col-span-1 md:col-span-4 flex flex-col gap-4 overflow-hidden border-l border-white/10 pl-8">
        <h3 className="text-[10px] uppercase tracking-[0.3em] text-white/30 mb-2">Recent Assets</h3>
        
        <div className="flex flex-col gap-6 overflow-y-auto">
          {recentVideos.length === 0 ? (
            <div className="p-6 border border-white/10 border-dashed text-center">
              <p className="text-[10px] text-white/40 leading-relaxed uppercase tracking-widest">No recent uploads<br/>Waiting for files</p>
            </div>
          ) : (
            recentVideos.map((video) => (
              <div key={video.id} className="flex flex-col gap-2 group">
                <div className="flex gap-4">
                  <Link
                    to={`/v/${video.id}`}
                    className="w-24 h-16 bg-[#111] border border-white/5 flex-shrink-0 flex items-center justify-center group-hover:border-white/20 transition-colors"
                  >
                    <FileVideo className="w-6 h-6 text-white/20 group-hover:text-[#00FF88] transition-colors" />
                  </Link>
                  <div className="flex flex-col justify-center min-w-0 flex-1">
                    <Link to={`/v/${video.id}`} className="block w-full">
                      <p className="text-xs font-medium group-hover:text-[#00FF88] transition-colors truncate w-full" title={video.originalName}>
                        {video.originalName}
                      </p>
                    </Link>
                    <p className="text-[10px] text-white/40 mt-1 uppercase tracking-wider">
                      {formatDistanceToNow(new Date(video.createdAt))} • {(video.size / (1024 * 1024)).toFixed(1)} MB
                    </p>
                    <div className="flex items-center gap-3 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={(e) => {
                          e.preventDefault();
                          navigator.clipboard.writeText(`${window.location.origin}/v/${video.id}`);
                          setCopiedLink(video.id);
                          setTimeout(() => setCopiedLink(null), 2000);
                        }}
                        className={`text-[10px] uppercase tracking-widest transition-colors ${copiedLink === video.id ? 'text-[#00FF88] font-bold' : 'text-white/50 hover:text-white'}`}
                      >
                        {copiedLink === video.id ? 'Copied' : 'Copy Link'}
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
                          } catch(err) {
                            console.error(err);
                          }
                        }}
                        className={`text-[10px] uppercase tracking-widest transition-colors ${confirmDelete === video.id ? 'text-red-500 font-bold' : 'text-red-500/70 hover:text-red-500'}`}
                      >
                        {confirmDelete === video.id ? 'Sure?' : 'Delete'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
