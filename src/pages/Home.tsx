import React, { useState, useRef, useEffect, useMemo } from 'react';
import { UploadCloud, FileVideo, Shield, Zap, Sparkles, Search, Copy, Check, Trash2, ExternalLink, Film, AlertCircle, Palette, Tag, Plus, X, LayoutGrid, List, ArrowUpDown, HardDrive, Eye, Activity, Clock } from 'lucide-react';
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
  const [stagedFile, setStagedFile] = useState<File | null>(null);
  const [customVideoTitle, setCustomVideoTitle] = useState<string>('');
  const [stagedTags, setStagedTags] = useState<string[]>([]);
  const [tagInputText, setTagInputText] = useState<string>('');
  
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'size' | 'title'>('newest');
  const [selectedFilterTag, setSelectedFilterTag] = useState<string | null>(null);

  const [editingTagVideoId, setEditingTagVideoId] = useState<string | null>(null);
  const [editingTagValue, setEditingTagValue] = useState<string>('');

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
    
    if (file.size > 100 * 1024 * 1024) {
      const errMsg = 'File size exceeds the 100MB maximum limit.';
      setUploadError(errMsg);
      toast.error(errMsg, 'File Exceeds Limit');
      return;
    }

    setStagedFile(file);
    const defaultTitle = file.name.replace(/\.[^/.]+$/, "");
    setCustomVideoTitle(defaultTitle);
    setStagedTags([]);
    setTagInputText('');
  };

  const handleAddStagedTag = () => {
    if (!tagInputText.trim()) return;
    const clean = tagInputText.trim().toLowerCase().replace(/^#/, '');
    if (!stagedTags.includes(clean)) {
      setStagedTags([...stagedTags, clean]);
    }
    setTagInputText('');
  };

  const handleRemoveStagedTag = (tagToRemove: string) => {
    setStagedTags(stagedTags.filter(t => t !== tagToRemove));
  };

  const handleStartUpload = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!stagedFile) return;
    toast.info(`Uploading "${customVideoTitle || stagedFile.name}"...`, 'File Upload Started');
    uploadFile(stagedFile, customVideoTitle, stagedTags);
  };

  const uploadFile = async (file: File, titleToSend?: string, tagsToSend?: string[]) => {
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

        let attempts = 0;
        let chunkSuccess = false;
        let lastError = '';

        while (attempts < 3 && !chunkSuccess) {
          attempts++;
          try {
            await new Promise((resolve, reject) => {
              const formData = new FormData();
              formData.append('chunk', chunk, 'chunk.bin');
              formData.append('uploadId', uploadId);
              formData.append('chunkIndex', chunkIndex.toString());

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
                if (xhr.status === 200) {
                  resolve(true);
                } else {
                  let msg = `Status ${xhr.status}`;
                  try {
                    const parsed = JSON.parse(xhr.responseText);
                    if (parsed.error) msg = parsed.error;
                  } catch (e) {}
                  reject(new Error(msg));
                }
              };
              xhr.onerror = () => reject(new Error('Network connectivity issue.'));
              xhr.send(formData);
            });
            chunkSuccess = true;
          } catch (err: any) {
            lastError = err?.message || 'Upload error';
            if (attempts < 3) {
              await new Promise(r => setTimeout(r, 800)); // wait 800ms before retrying chunk
            }
          }
        }

        if (!chunkSuccess) {
          throw new Error(`Chunk ${chunkIndex + 1}/${totalChunks} failed: ${lastError}`);
        }
      }

      const completeRes = await fetch('/api/upload-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uploadId,
          fileName: file.name,
          mimeType: file.type || 'video/mp4',
          size: file.size,
          totalChunks,
          title: titleToSend || customVideoTitle || file.name,
          tags: tagsToSend || stagedTags
        })
      });

      const resData = await completeRes.json();
      if (!completeRes.ok || !resData.success) {
        throw new Error(resData.error || 'Failed to assemble video chunks on server.');
      }

      if (resData.video) {
        setIsUploading(false);
        setStagedFile(null);
        setStagedTags([]);
        addRecentVideo(resData.video);
        toast.success(`"${resData.video.originalName}" uploaded successfully!`, 'Upload Complete');
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

  const handleSaveVideoTags = async (videoId: string, newTags: string[]) => {
    const updated = recentVideos.map(v => v.id === videoId ? { ...v, tags: newTags } : v);
    setRecentVideos(updated);
    localStorage.setItem('recent_videos', JSON.stringify(updated));

    try {
      await fetch(`/api/videos/${videoId}/tags`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: newTags })
      });
      toast.success('Asset tags updated', 'Tags Saved');
    } catch (e) {
      console.error(e);
    }
  };

  // Analytics computations
  const totalStorageBytes = useMemo(() => {
    return recentVideos.reduce((acc, v) => acc + (v.size || 0), 0);
  }, [recentVideos]);

  const totalViewsCount = useMemo(() => {
    return recentVideos.reduce((acc, v) => acc + (v.viewCount || 0), 0);
  }, [recentVideos]);

  const availableTags = useMemo(() => {
    const tagsSet = new Set<string>();
    recentVideos.forEach(v => {
      v.tags?.forEach(t => tagsSet.add(t));
    });
    return Array.from(tagsSet);
  }, [recentVideos]);

  const filteredVideos = useMemo(() => {
    let result = recentVideos.filter(v => {
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch = !query || v.originalName.toLowerCase().includes(query) || v.tags?.some(tag => tag.toLowerCase().includes(query));
      const matchesTag = !selectedFilterTag || v.tags?.includes(selectedFilterTag);
      return matchesSearch && matchesTag;
    });

    return result.sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortBy === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sortBy === 'size') return b.size - a.size;
      if (sortBy === 'title') return a.originalName.localeCompare(b.originalName);
      return 0;
    });
  }, [recentVideos, searchQuery, selectedFilterTag, sortBy]);

  return (
    <div className="flex flex-col gap-8 pb-10">
      
      {/* Top High-Tech Analytics Banner */}
      <div className={`grid grid-cols-2 sm:grid-cols-4 gap-4 p-5 rounded-3xl border ${config.borderClass} ${config.cardBgClass} shadow-xl`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
            <HardDrive className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <p className={`text-[10px] font-mono uppercase tracking-wider ${config.textSecondary}`}>Storage Occupied</p>
            <p className={`text-base font-mono font-bold ${config.accentColor}`}>
              {(totalStorageBytes / (1024 * 1024)).toFixed(1)} <span className="text-xs font-normal opacity-70">MB</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0">
            <Film className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <p className={`text-[10px] font-mono uppercase tracking-wider ${config.textSecondary}`}>Total Assets</p>
            <p className={`text-base font-mono font-bold ${config.textPrimary}`}>{recentVideos.length} <span className="text-xs font-normal opacity-70">Videos</span></p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
            <Eye className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <p className={`text-[10px] font-mono uppercase tracking-wider ${config.textSecondary}`}>Total Views</p>
            <p className={`text-base font-mono font-bold ${config.textPrimary}`}>{totalViewsCount} <span className="text-xs font-normal opacity-70">Plays</span></p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
            <Shield className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <p className={`text-[10px] font-mono uppercase tracking-wider ${config.textSecondary}`}>Max File Limit</p>
            <p className={`text-base font-mono font-bold ${config.textPrimary}`}>100 <span className="text-xs font-normal opacity-70">MB / file</span></p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">
        {/* Upload Section */}
        <div className="col-span-1 lg:col-span-7 flex flex-col gap-6">
          
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
                <Shield className={`w-3.5 h-3.5 ${config.accentColor}`} /> 100MB Max
              </span>
              <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl ${theme === 'light' ? 'bg-slate-100 border-slate-200' : 'bg-white/5 border-white/10'} border`}>
                <Zap className="w-3.5 h-3.5 text-cyan-400" /> Fast Chunking
              </span>
            </div>
          </div>

          {/* Dropzone Card */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={(e) => {
              if (!isUploading && !stagedFile) {
                fileInputRef.current?.click();
              }
            }}
            className={cn(
              "relative group flex-1 min-h-[360px] sm:min-h-[400px] rounded-3xl border-2 border-dashed transition-all duration-300 overflow-hidden flex flex-col items-center justify-center p-6 sm:p-8 text-center shadow-xl",
              config.dropzoneBgClass,
              isDragging 
                ? `${config.accentBorder} bg-opacity-20 scale-[1.01]` 
                : `${config.borderClass} hover:${config.accentBorder}`,
              !stagedFile && !isUploading && "cursor-pointer",
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

            <div className="relative z-20 flex flex-col items-center max-w-md w-full">
              {stagedFile && !isUploading ? (
                /* Staged File Form with Custom Video Name Input */
                <form 
                  onSubmit={handleStartUpload} 
                  onClick={(e) => e.stopPropagation()} 
                  className="w-full space-y-5 animate-in fade-in zoom-in-95 duration-200"
                >
                  <div className={cn(
                    "w-16 h-16 rounded-2xl border flex items-center justify-center mx-auto shadow-lg",
                    `${config.borderClass} ${theme === 'light' ? 'bg-slate-100 text-slate-700' : 'bg-white/5 text-white/70'}`
                  )}>
                    <Film className={`w-8 h-8 ${config.accentColor}`} />
                  </div>

                  <div className="space-y-1">
                    <span className={`inline-block px-3 py-1 rounded-full text-[11px] font-mono ${config.badgeClass}`}>
                      {(stagedFile.size / (1024 * 1024)).toFixed(1)} MB • {stagedFile.type || 'Video'}
                    </span>
                    <p className={`text-xs ${config.textSecondary} truncate max-w-xs mx-auto mt-1`}>
                      Original file: <span className="font-mono text-white/70">{stagedFile.name}</span>
                    </p>
                  </div>

                  <div className="text-left space-y-1.5 pt-2">
                    <label className={`block text-xs font-medium ${config.textPrimary}`}>
                      Video Title / Name <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={customVideoTitle}
                      onChange={(e) => setCustomVideoTitle(e.target.value)}
                      placeholder="Enter a descriptive video title..."
                      required
                      autoFocus
                      className={`w-full px-4 py-2.5 rounded-2xl text-sm border font-medium focus:outline-none transition-all shadow-inner ${
                        theme === 'light' 
                          ? 'bg-white border-slate-300 text-slate-900 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20' 
                          : 'bg-[#0a0d14] border-white/15 text-white focus:border-[#00FF88] focus:ring-2 focus:ring-[#00FF88]/20'
                      }`}
                    />
                  </div>

                  {/* Staged Tags Input */}
                  <div className="text-left space-y-1.5">
                    <label className={`block text-xs font-medium ${config.textPrimary} flex items-center justify-between`}>
                      <span className="flex items-center gap-1">
                        <Tag className="w-3 h-3 text-emerald-400" />
                        Categorization Tags (Optional)
                      </span>
                      <span className={`text-[10px] ${config.textSecondary}`}>Press Enter or comma to add</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={tagInputText}
                        onChange={(e) => setTagInputText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ',') {
                            e.preventDefault();
                            handleAddStagedTag();
                          }
                        }}
                        placeholder="e.g. tutorial, marketing, demo..."
                        className={`flex-1 px-4 py-2 rounded-2xl text-xs border focus:outline-none transition-all ${
                          theme === 'light'
                            ? 'bg-white border-slate-300 text-slate-900 focus:border-emerald-600'
                            : 'bg-[#0a0d14] border-white/15 text-white focus:border-[#00FF88]'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={handleAddStagedTag}
                        className={`px-3 py-2 rounded-2xl text-xs font-semibold border ${config.buttonSecondary} flex items-center gap-1`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add
                      </button>
                    </div>

                    {stagedTags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {stagedTags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                          >
                            #{tag}
                            <button
                              type="button"
                              onClick={() => handleRemoveStagedTag(tag)}
                              className="hover:text-rose-400 transition-colors"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                    <button
                      type="submit"
                      className={`w-full sm:flex-1 py-3 px-5 rounded-2xl ${config.buttonPrimary} text-xs font-bold shadow-lg transition-all duration-200 flex items-center justify-center gap-2`}
                    >
                      <UploadCloud className="w-4 h-4" />
                      <span>Upload & Share Video</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setStagedFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className={`w-full sm:w-auto py-3 px-4 rounded-2xl border text-xs font-semibold ${config.buttonSecondary} transition-all`}
                    >
                      Change File
                    </button>
                  </div>
                </form>
              ) : (
                /* Default Dropzone or Uploading Progress UI */
                <>
                  <div className={cn(
                    "w-20 h-20 rounded-2xl border flex items-center justify-center transition-all duration-300 mb-6 shadow-xl relative",
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
                        : 'Supports high frame rate MP4, MOV, WEBM, MKV or AVI up to 100MB.'}
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
                </>
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

        {/* Recent Uploads Sidebar / Media Library */}
        <div className={`col-span-1 lg:col-span-5 flex flex-col gap-4 lg:border-l ${config.borderClass} lg:pl-8`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-white/5">
            <div className="flex items-center gap-2">
              <h3 className={`text-xs font-semibold uppercase tracking-widest ${config.textSecondary}`}>Asset Library</h3>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${config.badgeClass}`}>
                {filteredVideos.length} / {recentVideos.length}
              </span>
            </div>

            {/* View Mode & Sort Controls */}
            <div className="flex items-center gap-2">
              <div className={`flex items-center p-0.5 rounded-xl border ${config.borderClass} ${theme === 'light' ? 'bg-slate-100' : 'bg-black/30'}`}>
                <button
                  onClick={() => setViewMode('grid')}
                  title="Grid View"
                  className={`p-1.5 rounded-lg text-xs transition-all ${
                    viewMode === 'grid'
                      ? 'bg-emerald-500 text-slate-950 shadow-md font-bold'
                      : `${config.textSecondary} hover:${config.textPrimary}`
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  title="List View"
                  className={`p-1.5 rounded-lg text-xs transition-all ${
                    viewMode === 'list'
                      ? 'bg-emerald-500 text-slate-950 shadow-md font-bold'
                      : `${config.textSecondary} hover:${config.textPrimary}`
                  }`}
                >
                  <List className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Sort Selector */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className={`text-[11px] font-mono px-2.5 py-1.5 rounded-xl border ${config.borderClass} ${
                  theme === 'light' ? 'bg-white text-slate-800' : 'bg-[#0a0d14] text-white'
                } focus:outline-none focus:border-emerald-500 transition-colors`}
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="size">Largest Size</option>
                <option value="title">Title A-Z</option>
              </select>
            </div>
          </div>

          {/* Search Input */}
          {recentVideos.length > 0 && (
            <div className="relative">
              <Search className={`w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 ${config.textSecondary}`} />
              <input 
                type="text"
                placeholder="Search assets by title or tag (e.g. #demo)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full ${theme === 'light' ? 'bg-white border-slate-200 text-slate-800' : 'bg-[#0a0d14] border-white/10 text-white'} border rounded-2xl pl-10 pr-8 py-2.5 text-xs placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition-colors`}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {/* Quick Tag Pills Bar */}
          {availableTags.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              <button
                onClick={() => setSelectedFilterTag(null)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-mono transition-all shrink-0 border ${
                  selectedFilterTag === null
                    ? 'bg-emerald-500 text-slate-950 font-bold border-emerald-400'
                    : `${config.textSecondary} hover:${config.textPrimary} border-transparent hover:border-white/10`
                }`}
              >
                All Assets
              </button>
              {availableTags.map((t) => (
                <button
                  key={t}
                  onClick={() => setSelectedFilterTag(selectedFilterTag === t ? null : t)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-mono transition-all shrink-0 border ${
                    selectedFilterTag === t
                      ? 'bg-emerald-500 text-slate-950 font-bold border-emerald-400'
                      : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                  }`}
                >
                  #{t}
                </button>
              ))}
            </div>
          )}

          {/* Video Assets Display */}
          <div className="overflow-y-auto max-h-[620px] pr-1 space-y-3">
            {filteredVideos.length === 0 ? (
              <div className={`p-8 rounded-3xl border ${config.borderClass} border-dashed text-center ${config.cardBgClass}`}>
                <FileVideo className={`w-8 h-8 ${config.textSecondary} mx-auto mb-2 opacity-50`} />
                <p className={`text-xs ${config.textSecondary} leading-relaxed font-light`}>
                  {searchQuery || selectedFilterTag ? 'No matching videos or tags found' : 'No recent video uploads'}
                </p>
              </div>
            ) : viewMode === 'grid' ? (
              /* GRID VIEW MODE */
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredVideos.map((video) => (
                  <div 
                    key={video.id} 
                    className={`group flex flex-col p-3 rounded-2xl border ${config.borderClass} ${config.cardBgClass} hover:border-emerald-500/40 hover:shadow-xl transition-all duration-300 relative`}
                  >
                    <VideoPreviewThumbnail
                      video={video}
                      onClick={() => navigate(`/v/${video.id}`)}
                      onDurationLoaded={handleDurationLoaded}
                      className="w-full h-28 rounded-xl overflow-hidden shrink-0 mb-2.5"
                    />

                    <div className="flex flex-col min-w-0 flex-1 justify-between space-y-2">
                      <div>
                        <Link to={`/v/${video.id}`} className="block w-full">
                          <p className={`text-xs font-semibold ${config.textPrimary} group-hover:${config.accentColor} transition-colors truncate`} title={video.originalName}>
                            {video.originalName}
                          </p>
                        </Link>
                        <p className={`text-[10px] font-mono ${config.textSecondary} mt-0.5`}>
                          {formatDistanceToNow(new Date(video.createdAt))} ago • {(video.size / (1024 * 1024)).toFixed(1)} MB
                        </p>
                      </div>

                      {/* Tag Chips */}
                      <div className="flex flex-wrap items-center gap-1">
                        {video.tags && video.tags.length > 0 && video.tags.map((tag, idx) => (
                          <span
                            key={idx}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setSelectedFilterTag(tag);
                            }}
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 cursor-pointer hover:bg-emerald-500/20"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>

                      {/* Card Bottom Toolbar */}
                      <div className="flex items-center justify-between pt-2 border-t border-white/5">
                        <button 
                          onClick={(e) => {
                            e.preventDefault();
                            navigator.clipboard.writeText(`${window.location.origin}/v/${video.id}`);
                            setCopiedLink(video.id);
                            toast.success('Link copied to clipboard!', 'Link Copied');
                            setTimeout(() => setCopiedLink(null), 2000);
                          }}
                          className={`text-[10px] font-mono flex items-center gap-1 ${
                            copiedLink === video.id ? `${config.accentColor} font-bold` : `${config.textSecondary} hover:${config.textPrimary}`
                          }`}
                        >
                          {copiedLink === video.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedLink === video.id ? 'Copied' : 'Copy'}</span>
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
                              toast.error('Failed to delete asset.', 'Error');
                            }
                          }}
                          className={`text-[10px] font-mono flex items-center gap-1 ${
                            confirmDelete === video.id ? 'text-red-500 font-bold' : 'text-red-400/50 hover:text-red-400'
                          }`}
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>{confirmDelete === video.id ? 'Confirm?' : ''}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* LIST VIEW MODE */
              <div className="flex flex-col gap-2.5">
                {filteredVideos.map((video) => (
                  <div 
                    key={video.id} 
                    className={`group flex flex-col sm:flex-row gap-3 p-3 rounded-2xl border ${config.borderClass} ${config.cardBgClass} hover:shadow-lg transition-all duration-300`}
                  >
                    <VideoPreviewThumbnail
                      video={video}
                      onClick={() => navigate(`/v/${video.id}`)}
                      onDurationLoaded={handleDurationLoaded}
                      className="w-full sm:w-24 h-24 sm:h-16 rounded-xl overflow-hidden shrink-0"
                    />
                    <div className="flex flex-col justify-center min-w-0 flex-1">
                      <Link to={`/v/${video.id}`} className="block w-full">
                        <p className={`text-xs font-semibold ${config.textPrimary} group-hover:${config.accentColor} transition-colors truncate`} title={video.originalName}>
                          {video.originalName}
                        </p>
                      </Link>
                      <p className={`text-[10px] font-mono ${config.textSecondary} mt-0.5`}>
                        {formatDistanceToNow(new Date(video.createdAt))} ago • {(video.size / (1024 * 1024)).toFixed(1)} MB
                      </p>

                      {/* Tag Chips List */}
                      <div className="flex flex-wrap items-center gap-1 mt-1.5">
                        {video.tags && video.tags.length > 0 && video.tags.map((tag, idx) => (
                          <span
                            key={idx}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setSearchQuery(tag);
                            }}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors cursor-pointer"
                            title={`Click to filter by #${tag}`}
                          >
                            #{tag}
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const newTags = video.tags?.filter((_, i) => i !== idx) || [];
                                handleSaveVideoTags(video.id, newTags);
                              }}
                              className="hover:text-rose-400 transition-colors"
                              title="Remove tag"
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </span>
                        ))}

                        {/* Add Tag Button or Input */}
                        {editingTagVideoId === video.id ? (
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="text"
                              value={editingTagValue}
                              onChange={(e) => setEditingTagValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  if (editingTagValue.trim()) {
                                    const clean = editingTagValue.trim().toLowerCase().replace(/^#/, '');
                                    const existing = video.tags || [];
                                    if (!existing.includes(clean)) {
                                      handleSaveVideoTags(video.id, [...existing, clean]);
                                    }
                                    setEditingTagValue('');
                                    setEditingTagVideoId(null);
                                  }
                                } else if (e.key === 'Escape') {
                                  setEditingTagVideoId(null);
                                }
                              }}
                              placeholder="Tag name..."
                              autoFocus
                              className={`px-2 py-0.5 text-[10px] font-mono border rounded ${
                                theme === 'light' ? 'bg-white text-slate-900 border-slate-300' : 'bg-black/40 text-white border-white/20'
                              } focus:outline-none focus:border-emerald-500 w-20`}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                if (editingTagValue.trim()) {
                                  const clean = editingTagValue.trim().toLowerCase().replace(/^#/, '');
                                  const existing = video.tags || [];
                                  if (!existing.includes(clean)) {
                                    handleSaveVideoTags(video.id, [...existing, clean]);
                                  }
                                  setEditingTagValue('');
                                }
                                setEditingTagVideoId(null);
                              }}
                              className="p-0.5 text-emerald-400 hover:text-emerald-300"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingTagVideoId(null)}
                              className="p-0.5 text-slate-400 hover:text-white"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setEditingTagVideoId(video.id);
                              setEditingTagValue('');
                            }}
                            className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono ${config.textSecondary} hover:${config.accentColor} hover:bg-white/5 border border-transparent hover:border-white/10 transition-colors`}
                            title="Add tag to asset"
                          >
                            <Tag className="w-2.5 h-2.5" />
                            <span>+ tag</span>
                          </button>
                        )}
                      </div>
                      
                      {/* Actions */}
                      <div className="flex items-center gap-3 mt-2 pt-1 border-t border-white/5">
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
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

