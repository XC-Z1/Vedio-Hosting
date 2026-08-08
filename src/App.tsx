/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { MoreVertical, Info, User, X, FolderKanban, Trash2, Link as LinkIcon, FileVideo, Download, ArrowUpDown, Shield, Zap, Film, Palette, Check, Sun, Moon } from 'lucide-react';
import { useState, useEffect, useMemo, useRef } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import Home from './pages/Home';
import VideoView from './pages/VideoView';
import { VideoMeta } from './types';
import VideoPreviewThumbnail from './components/VideoPreviewThumbnail';
import { formatDuration } from './lib/utils';
import { useTheme, themes, ThemeMode } from './ThemeContext';
import { useToast } from './ToastContext';

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [userVideos, setUserVideos] = useState<VideoMeta[]>([]);
  const [sortBy, setSortBy] = useState<'date' | 'views' | 'size'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [previewVideo, setPreviewVideo] = useState<VideoMeta | null>(null);

  const { theme, setTheme, config } = useTheme();
  const { toast } = useToast();

  const handleDurationLoaded = (id: string, duration: number) => {
    setUserVideos(prev => {
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

  useEffect(() => {
    if (manageOpen) {
      const saved = localStorage.getItem('recent_videos');
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as VideoMeta[];
          setUserVideos(parsed);
          
          // Fetch latest metadata to get updated view counts
          Promise.all(
            parsed.map(v => 
              fetch(`/api/videos/${v.id}`)
                .then(res => res.ok ? res.json() : v)
                .catch(() => v)
            )
          ).then((updatedVideos) => {
            setUserVideos(updatedVideos);
            // Optionally update local storage with the latest data
            localStorage.setItem('recent_videos', JSON.stringify(updatedVideos));
          });
        } catch (e) { }
      }
    }
  }, [manageOpen]);

  const [confirmDeleteApp, setConfirmDeleteApp] = useState<string | null>(null);

  const handleDeleteVideo = async (id: string) => {
    if (confirmDeleteApp !== id) {
      setConfirmDeleteApp(id);
      setTimeout(() => setConfirmDeleteApp(null), 3000);
      return;
    }
    
    try {
      await fetch(`/api/videos/${id}`, { method: 'DELETE' });
      const updated = userVideos.filter(v => v.id !== id);
      setUserVideos(updated);
      localStorage.setItem('recent_videos', JSON.stringify(updated));
      setConfirmDeleteApp(null);
      
      // Dispatch custom event to let Home page know
      window.dispatchEvent(new Event('videos_updated'));
      toast.info('Asset deleted from library', 'Asset Deleted');
    } catch(err) {
      console.error(err);
      toast.error('Failed to delete asset. Please try again.', 'Error');
    }
  };

  const [copiedApp, setCopiedApp] = useState<string | null>(null);
  const handleCopyLink = (id: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/v/${id}?direct=true`);
    setCopiedApp(id);
    toast.success('Direct video link copied to clipboard!', 'Link Copied');
    setTimeout(() => setCopiedApp(null), 2000);
  };

  const handleExportLibrary = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(userVideos, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "video_library_metadata.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    toast.success('Library metadata JSON exported!', 'Library Exported');
  };

  const sortedVideos = useMemo(() => {
    return [...userVideos].sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'date') {
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } else if (sortBy === 'views') {
        comparison = (a.viewCount || 0) - (b.viewCount || 0);
      } else if (sortBy === 'size') {
        comparison = a.size - b.size;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [userVideos, sortBy, sortOrder]);

  const topVideos = useMemo(() => {
    return [...userVideos]
      .filter(v => (v.viewCount || 0) > 0)
      .sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0))
      .slice(0, 5)
      .map(v => ({
        name: v.originalName.length > 15 ? v.originalName.substring(0, 15) + '...' : v.originalName,
        views: v.viewCount || 0
      }));
  }, [userVideos]);

  return (
    <BrowserRouter>
      <div className={`min-h-screen w-full ${config.bgClass} ${config.textPrimary} font-sans overflow-x-hidden transition-colors duration-300 flex flex-col relative`}>
        
        {/* Top Header Navigation */}
        <header className={`h-20 shrink-0 border-b ${theme === 'light' ? 'border-slate-200' : 'border-white/10'} flex items-center justify-between px-6 md:px-12 sticky top-0 ${config.headerBgClass} z-50 shadow-md transition-colors`}>
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#00FF88] to-cyan-400 p-[1px] shadow-[0_0_20px_rgba(0,255,136,0.2)] group-hover:shadow-[0_0_30px_rgba(0,255,136,0.4)] transition-all duration-300">
                <div className={`w-full h-full ${theme === 'light' ? 'bg-slate-900' : 'bg-[#07090e]'} rounded-[11px] flex items-center justify-center`}>
                  <FileVideo className="w-5 h-5 text-[#00FF88]" />
                </div>
              </div>
              <div className="flex flex-col">
                <h1 className={`text-2xl font-serif italic tracking-tight ${config.textPrimary} group-hover:text-[#00FF88] transition-colors`}>StreamShare</h1>
                <p className={`text-[9px] uppercase font-mono tracking-widest ${config.textSecondary} -mt-0.5`}>High Performance Media Engine</p>
              </div>
            </Link>
          </div>
          
          <div className={`hidden lg:flex items-center gap-8 px-6 py-2 rounded-full ${theme === 'light' ? 'bg-slate-100 border-slate-200' : 'bg-white/5 border-white/10'} border backdrop-blur-sm`}>
            <div className="text-center">
              <p className={`text-[9px] ${config.textSecondary} uppercase font-mono tracking-widest`}>Storage Used</p>
              <p className={`text-xs font-mono font-semibold ${config.accentColor} mt-0.5`}>12.4 / 100 GB</p>
            </div>
            <div className={`h-6 w-[1px] ${theme === 'light' ? 'bg-slate-200' : 'bg-white/10'}`} />
            <div className="text-center">
              <p className={`text-[9px] ${config.textSecondary} uppercase font-mono tracking-widest`}>Total Views</p>
              <p className="text-xs font-mono font-semibold text-cyan-400 mt-0.5">284.2K</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Dark / Light Mode Toggle Button */}
            <button
              onClick={() => setTheme(theme === 'light' ? 'sunset' : 'light')}
              title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all duration-150 active:scale-95 ${
                theme === 'light' 
                  ? 'bg-slate-100 border-slate-200 text-slate-800 hover:bg-slate-200/80 shadow-sm' 
                  : 'bg-white/5 border-white/10 text-violet-300 hover:bg-white/10 hover:border-white/20'
              }`}
            >
              {theme === 'light' ? (
                <>
                  <Sun className="w-4 h-4 text-amber-500 shrink-0" />
                  <span className="hidden sm:inline">Light Mode</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-violet-400 shrink-0" />
                  <span className="hidden sm:inline">Dark Mode</span>
                </>
              )}
            </button>

            <button 
              onClick={() => setManageOpen(true)}
              className={`hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl ${theme === 'light' ? 'bg-slate-100 border-slate-200 text-slate-800' : 'bg-white/5 border-white/10 text-white'} border text-xs font-semibold hover:border-[#00FF88]/40 transition-all duration-300`}
            >
              <FolderKanban className="w-4 h-4 text-[#00FF88]" />
              <span>Library ({userVideos.length})</span>
            </button>

            <div className={`hidden md:flex items-center gap-3 border-l ${theme === 'light' ? 'border-slate-200' : 'border-white/10'} pl-5`}>
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#00FF88]/30 to-cyan-500/30 border border-white/20 flex items-center justify-center font-bold text-xs text-white shadow">
                XC
              </div>
              <p className={`text-xs font-medium tracking-tight ${config.textPrimary}`}>XC</p>
            </div>
            
            <div className="relative">
              <button 
                onClick={() => setMenuOpen(!menuOpen)}
                className={`w-10 h-10 rounded-xl ${theme === 'light' ? 'bg-slate-100 border-slate-200 text-slate-700' : 'bg-white/5 border-white/10 text-white/70'} border flex items-center justify-center hover:text-[#00FF88] transition-all duration-300`}
              >
                <MoreVertical className="w-5 h-5" />
              </button>

              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)}></div>
                  <div className={`absolute right-0 mt-3 w-60 ${theme === 'light' ? 'bg-white border-slate-200 text-slate-800' : 'bg-[#0c1017] border-white/15 text-white'} border rounded-2xl shadow-2xl z-50 p-2 space-y-1 animate-in fade-in slide-in-from-top-2 duration-200`}>
                    <button 
                      onClick={() => { setTheme(theme === 'light' ? 'sunset' : 'light'); setMenuOpen(false); }}
                      className={`w-full text-left px-4 py-3 text-xs font-semibold ${theme === 'light' ? 'hover:bg-slate-100' : 'hover:bg-white/5'} rounded-xl transition-colors flex items-center gap-3`}
                    >
                      {theme === 'light' ? (
                        <>
                          <Sun className="w-4 h-4 text-amber-500" /> Light Mode
                        </>
                      ) : (
                        <>
                          <Moon className="w-4 h-4 text-violet-400" /> Dark Mode
                        </>
                      )}
                    </button>
                    <button 
                      onClick={() => { setManageOpen(true); setMenuOpen(false); }}
                      className={`w-full text-left px-4 py-3 text-xs font-semibold ${theme === 'light' ? 'hover:bg-slate-100' : 'hover:bg-white/5'} rounded-xl transition-colors flex items-center gap-3`}
                    >
                      <FolderKanban className="w-4 h-4 text-[#00FF88]" /> Manage Library
                    </button>
                    <button 
                      onClick={() => { setAboutOpen(true); setMenuOpen(false); }}
                      className={`w-full text-left px-4 py-3 text-xs font-semibold ${theme === 'light' ? 'hover:bg-slate-100' : 'hover:bg-white/5'} rounded-xl transition-colors flex items-center gap-3`}
                    >
                      <Info className="w-4 h-4 text-cyan-400" /> About Platform
                    </button>
                    <a 
                      href="https://techmster.site/xcz/" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      onClick={() => setMenuOpen(false)}
                      className={`w-full text-left px-4 py-3 text-xs font-semibold ${theme === 'light' ? 'hover:bg-slate-100' : 'hover:bg-white/5'} rounded-xl transition-colors flex items-center gap-3 border-t ${theme === 'light' ? 'border-slate-100' : 'border-white/10'} pt-3`}
                    >
                      <User className="w-4 h-4 text-violet-400" /> Developer Profile (XC)
                    </a>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Dynamic Content */}
        <main className="flex-1 w-full max-w-[1600px] mx-auto p-6 md:p-12 z-10">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/v/:id" element={<VideoView />} />
          </Routes>
        </main>

        {/* Footer */}
        <footer className="py-2" />

        {/* Manage Library Modal */}
        {manageOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <div 
              className="absolute inset-0 bg-black/80 backdrop-blur-md animate-in fade-in duration-300" 
              onClick={() => setManageOpen(false)}
            ></div>
            <div className="relative w-full max-w-4xl max-h-[85vh] flex flex-col bg-[#090d15] border border-white/15 rounded-3xl p-6 sm:p-10 shadow-2xl animate-in fade-in zoom-in-95 duration-300 overflow-hidden">
              <button 
                onClick={() => setManageOpen(false)} 
                className="absolute top-6 right-6 w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="shrink-0 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 pr-10">
                <div>
                  <h2 className="text-3xl font-serif italic text-white mb-1">Manage Library</h2>
                  <p className="text-xs font-mono text-white/40">Total Uploaded Assets: <span className="text-[#00FF88] font-bold">{userVideos.length}</span></p>
                </div>
                {userVideos.length > 0 && (
                  <button
                    onClick={handleExportLibrary}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:border-[#00FF88]/50 text-white/80 hover:text-white transition-all text-xs font-semibold shadow-sm"
                  >
                    <Download className="w-4 h-4 text-[#00FF88]" /> Export JSON Metadata
                  </button>
                )}
              </div>

              {topVideos.length > 0 && (
                <div className="shrink-0 mb-6 border border-white/10 rounded-2xl bg-white/[0.03] p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-semibold uppercase tracking-widest text-white/70">Top 5 Assets by Views</h3>
                    <span className="text-[10px] font-mono text-[#00FF88]">Live Analytics</span>
                  </div>
                  <div className="h-36 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={topVideos} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <XAxis dataKey="name" stroke="#ffffff40" fontSize={11} tickLine={false} axisLine={false} />
                        <YAxis stroke="#ffffff40" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                        <Tooltip 
                          cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                          contentStyle={{ backgroundColor: '#0c1017', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '12px', fontSize: '12px', color: '#fff' }}
                          itemStyle={{ color: '#00FF88' }}
                        />
                        <Bar dataKey="views" fill="#00FF88" radius={[6, 6, 0, 0]} maxBarSize={36} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {userVideos.length > 0 && (
                <div className="shrink-0 mb-4 flex items-center justify-end gap-3">
                  <div className="relative">
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as 'date' | 'views' | 'size')}
                      className="appearance-none bg-[#0c1017] border border-white/15 rounded-xl text-white/80 text-xs font-medium px-4 py-2 pr-9 hover:border-white/30 transition-colors outline-none cursor-pointer"
                    >
                      <option value="date">Sort by Date Uploaded</option>
                      <option value="views">Sort by Most Viewed</option>
                      <option value="size">Sort by File Size</option>
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-white/40">
                      <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>
                    </div>
                  </div>
                  <button
                    onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                    className="p-2.5 rounded-xl border border-white/15 bg-[#0c1017] hover:border-white/30 text-white/70 hover:text-white transition-colors flex items-center justify-center"
                    title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                  >
                    <ArrowUpDown className="w-4 h-4" />
                  </button>
                </div>
              )}

              <div className="flex-1 overflow-y-auto pr-2 space-y-3">
                {sortedVideos.length === 0 ? (
                  <div className="p-12 border border-white/10 border-dashed rounded-2xl text-center bg-white/[0.01]">
                    <FileVideo className="w-10 h-10 text-white/20 mx-auto mb-3" />
                    <p className="text-xs font-mono text-white/40">No media assets in your library yet</p>
                  </div>
                ) : (
                  sortedVideos.map(video => (
                    <div key={video.id} className="flex flex-col sm:flex-row sm:items-center gap-4 p-3.5 rounded-2xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/25 hover:scale-[1.015] transform transition-all duration-300 hover:shadow-lg">
                      <VideoPreviewThumbnail 
                        video={video} 
                        onClick={() => setPreviewVideo(video)} 
                        onDurationLoaded={handleDurationLoaded}
                        className="w-28 h-18"
                      />
                      <div className="flex-1 min-w-0">
                        <Link to={`/v/${video.id}`} onClick={() => setManageOpen(false)} className="block truncate font-semibold text-white/90 hover:text-[#00FF88] transition-colors text-sm">
                          {video.originalName}
                        </Link>
                        <div className="flex items-center gap-3 mt-1.5 text-xs font-mono text-white/40">
                          <span>{formatDistanceToNow(new Date(video.createdAt))} ago</span>
                          <span>•</span>
                          <span>{(video.size / (1024 * 1024)).toFixed(1)} MB</span>
                          <span>•</span>
                          <span className="text-cyan-400 font-semibold">{video.viewCount || 0} views</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 mt-3 sm:mt-0">
                        <button
                          onClick={() => handleCopyLink(video.id)}
                          className="px-3 py-2 rounded-xl border border-white/10 hover:border-white/30 bg-white/5 text-white/70 hover:text-white transition-all text-xs font-mono flex items-center gap-1.5"
                          title="Copy Share Link"
                        >
                          <LinkIcon className="w-3.5 h-3.5 text-[#00FF88]" />
                          {copiedApp === video.id ? <span className="text-[#00FF88] font-bold">Copied!</span> : <span>Link</span>}
                        </button>
                        <button
                          onClick={() => handleDeleteVideo(video.id)}
                          className={`px-3 py-2 rounded-xl border transition-all text-xs font-mono flex items-center gap-1.5 ${confirmDeleteApp === video.id ? 'border-red-500/50 bg-red-500/20 text-red-400' : 'border-white/10 bg-white/5 hover:border-red-500/40 text-white/70 hover:text-red-400'}`}
                          title="Delete Asset"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          {confirmDeleteApp === video.id ? <span>Confirm</span> : <span>Delete</span>}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Video Preview Overlay */}
        {previewVideo && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-8">
            <div 
              className="absolute inset-0 bg-black/90 backdrop-blur-md animate-in fade-in duration-300" 
              onClick={() => setPreviewVideo(null)}
            ></div>
            <div className="relative w-full max-w-5xl aspect-video bg-black border border-white/20 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
              <button 
                onClick={() => setPreviewVideo(null)} 
                className="absolute top-4 right-4 z-20 px-4 py-2 rounded-xl bg-black/70 border border-white/20 text-white hover:bg-black transition-all flex items-center gap-2 text-xs font-semibold"
              >
                Close <X className="w-4 h-4" />
              </button>
              <video
                src={previewVideo.downloadUrl || `/uploads/${previewVideo.filename}`}
                controls
                autoPlay
                className="w-full h-full object-contain"
              />
            </div>
          </div>
        )}

        {/* About Modal */}
        {aboutOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <div 
              className="absolute inset-0 bg-black/80 backdrop-blur-md animate-in fade-in duration-300" 
              onClick={() => setAboutOpen(false)}
            ></div>
            <div className="relative w-full max-w-2xl bg-[#090d15] border border-white/15 rounded-3xl p-8 sm:p-12 shadow-2xl animate-in fade-in zoom-in-95 duration-300">
              <button 
                onClick={() => setAboutOpen(false)} 
                className="absolute top-6 right-6 w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-[#00FF88]/20 border border-[#00FF88]/40 flex items-center justify-center">
                  <Info className="w-4 h-4 text-[#00FF88]" />
                </div>
                <h2 className="text-3xl font-serif italic text-white">About StreamShare</h2>
              </div>
              <p className="text-xs font-mono uppercase tracking-widest text-white/40 mb-8 ml-11">Uncompressed Video Transfer & Streaming</p>

              <div className="space-y-6 text-xs text-white/80 leading-relaxed font-light">
                <section className="p-4 rounded-2xl bg-white/[0.03] border border-white/10">
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-[#00FF88] mb-2">Platform Overview</h3>
                  <p>
                    StreamShare is built for high-bitrate video sharing without forced encoding compression. Drag and drop any video up to 1GB to instantly generate a shareable playback link with zero quality loss.
                  </p>
                </section>
                
                <section className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-[#00FF88]">Key Capabilities</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center gap-3">
                      <Shield className="w-4 h-4 text-[#00FF88] shrink-0" />
                      <span>Encrypted Chunk Uploads</span>
                    </div>
                    <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center gap-3">
                      <Zap className="w-4 h-4 text-cyan-400 shrink-0" />
                      <span>Instant HTML5 Playback</span>
                    </div>
                    <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center gap-3">
                      <Film className="w-4 h-4 text-violet-400 shrink-0" />
                      <span>Hover Preview & Metadata</span>
                    </div>
                    <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center gap-3">
                      <Download className="w-4 h-4 text-yellow-400 shrink-0" />
                      <span>Library Export & Analytics</span>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </div>
        )}
      </div>
    </BrowserRouter>
  );
}

