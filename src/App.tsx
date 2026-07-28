/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { MoreVertical, Info, User, X, FolderKanban, Trash2, Link as LinkIcon, FileVideo } from 'lucide-react';
import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import Home from './pages/Home';
import VideoView from './pages/VideoView';
import { VideoMeta } from './types';

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [userVideos, setUserVideos] = useState<VideoMeta[]>([]);

  useEffect(() => {
    if (manageOpen) {
      const saved = localStorage.getItem('recent_videos');
      if (saved) {
        try {
          setUserVideos(JSON.parse(saved));
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
    } catch(err) {
      console.error(err);
    }
  };

  const [copiedApp, setCopiedApp] = useState<string | null>(null);
  const handleCopyLink = (id: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/v/${id}`);
    setCopiedApp(id);
    setTimeout(() => setCopiedApp(null), 2000);
  };

  return (
    <BrowserRouter>
      <div className="min-h-screen w-full bg-[#050505] text-[#F5F5F5] font-sans overflow-x-hidden selection:bg-[#00FF88]/30 flex flex-col">
        {/* Top Header Navigation */}
        <header className="h-20 shrink-0 border-b border-white/10 flex items-center justify-between px-6 md:px-10 sticky top-0 bg-[#050505]/95 backdrop-blur z-50">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex flex-col">
              <h1 className="text-2xl font-serif italic tracking-tight">StreamShare.</h1>
              <p className="text-[9px] uppercase tracking-widest text-white/40 mt-0.5">Premium Video Engine</p>
            </Link>
          </div>
          
          <div className="hidden md:flex gap-10">
            <div className="text-center">
              <p className="text-[10px] text-white/40 uppercase tracking-widest">Storage Used</p>
              <p className="text-sm font-mono mt-0.5">12.4 / 100 GB</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-white/40 uppercase tracking-widest">Total Views</p>
              <p className="text-sm font-mono mt-0.5">284.2K</p>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="hidden md:flex items-center gap-3 border-r border-white/10 pr-6">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-white/20 to-white/5 border border-white/20"></div>
              <p className="text-xs tracking-tight">Tarikul Islam</p>
            </div>
            
            <div className="relative">
              <button 
                onClick={() => setMenuOpen(!menuOpen)}
                className="text-white/60 hover:text-white transition-colors group p-2 outline-none"
              >
                <MoreVertical className="w-6 h-6" />
              </button>

              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)}></div>
                  <div className="absolute right-0 mt-2 w-56 bg-[#0a0a0a] border border-white/10 shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    <button 
                      onClick={() => { setManageOpen(true); setMenuOpen(false); }}
                      className="w-full text-left px-5 py-4 text-xs tracking-widest uppercase text-white/70 hover:text-[#00FF88] hover:bg-white/5 transition-colors flex items-center gap-3"
                    >
                      <FolderKanban className="w-4 h-4" /> Manage Library
                    </button>
                    <button 
                      onClick={() => { setAboutOpen(true); setMenuOpen(false); }}
                      className="w-full text-left px-5 py-4 text-xs tracking-widest uppercase text-white/70 hover:text-[#00FF88] hover:bg-white/5 transition-colors flex items-center gap-3 border-t border-white/5"
                    >
                      <Info className="w-4 h-4" /> About
                    </button>
                    <a 
                      href="https://techmster.site/xcz/" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      onClick={() => setMenuOpen(false)}
                      className="w-full text-left px-5 py-4 text-xs tracking-widest uppercase text-white/70 hover:text-[#00FF88] hover:bg-white/5 transition-colors flex items-center gap-3 border-t border-white/5"
                    >
                      <User className="w-4 h-4" /> See Developer
                    </a>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Dynamic Content */}
        <main className="flex-1 w-full max-w-[1600px] mx-auto p-6 md:p-10">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/v/:id" element={<VideoView />} />
          </Routes>
        </main>

        {/* Manage Library Modal */}
        {manageOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div 
              className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300" 
              onClick={() => setManageOpen(false)}
            ></div>
            <div className="relative w-full max-w-3xl max-h-[80vh] flex flex-col bg-[#050505] border border-white/10 p-8 sm:p-12 shadow-2xl animate-in fade-in zoom-in-95 duration-300">
              <button 
                onClick={() => setManageOpen(false)} 
                className="absolute top-6 right-6 text-white/40 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
              
              <div className="shrink-0 mb-8">
                <h2 className="text-3xl font-serif italic mb-2">Manage Library</h2>
                <p className="text-[10px] uppercase tracking-widest text-white/40">Your uploaded assets ({userVideos.length})</p>
              </div>

              <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                {userVideos.length === 0 ? (
                  <div className="p-12 border border-white/10 border-dashed text-center">
                    <p className="text-[10px] text-white/40 uppercase tracking-widest">No assets in library</p>
                  </div>
                ) : (
                  userVideos.map(video => (
                    <div key={video.id} className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 border border-white/10 bg-white/5 hover:bg-white/10 transition-colors">
                      <div className="w-24 h-16 bg-[#111] border border-white/10 flex-shrink-0 flex items-center justify-center">
                        <FileVideo className="w-6 h-6 text-white/20" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <Link to={`/v/${video.id}`} onClick={() => setManageOpen(false)} className="block truncate font-medium hover:text-[#00FF88] transition-colors">
                          {video.originalName}
                        </Link>
                        <p className="text-[10px] text-white/40 mt-1 uppercase tracking-wider">
                          {formatDistanceToNow(new Date(video.createdAt))} ago • {(video.size / (1024 * 1024)).toFixed(1)} MB
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 mt-4 sm:mt-0">
                        <button
                          onClick={() => handleCopyLink(video.id)}
                          className="p-3 border border-white/10 hover:border-white/30 text-white/60 hover:text-white transition-colors"
                          title="Copy Link"
                        >
                          {copiedApp === video.id ? <span className="text-[10px] uppercase font-bold text-[#00FF88]">Copied</span> : <LinkIcon className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => handleDeleteVideo(video.id)}
                          className={`p-3 border transition-colors ${confirmDeleteApp === video.id ? 'border-red-500/50 text-red-500 hover:bg-red-500/10' : 'border-white/10 hover:border-red-500/50 text-white/60 hover:text-red-500'}`}
                          title="Delete Video"
                        >
                          {confirmDeleteApp === video.id ? <span className="text-[10px] uppercase font-bold">Sure?</span> : <Trash2 className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* About Modal */}
        {aboutOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div 
              className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300" 
              onClick={() => setAboutOpen(false)}
            ></div>
            <div className="relative w-full max-w-2xl bg-[#050505] border border-white/10 p-8 sm:p-12 shadow-2xl animate-in fade-in zoom-in-95 duration-300">
              <button 
                onClick={() => setAboutOpen(false)} 
                className="absolute top-6 right-6 text-white/40 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
              
              <h2 className="text-3xl font-serif italic mb-2">About StreamShare</h2>
              <p className="text-[10px] uppercase tracking-widest text-white/40 mb-10">Premium Video Engine</p>

              <div className="space-y-8">
                <section>
                  <h3 className="text-[10px] uppercase tracking-widest text-[#00FF88] mb-4">How to use</h3>
                  <p className="text-white/70 text-sm leading-relaxed font-light">
                    Uploading a video is seamless and fast. Simply drag and drop your media file onto the dashboard area, or click to browse your device. Once processed, you will instantly receive a secure, shareable link. No compression is applied, ensuring your content remains in pristine condition for playback. You can easily manage your uploads from the Recent Assets panel, where you can hover over a video to Copy its Link for sharing, or Delete it permanently from the server.
                  </p>
                </section>
                
                <section>
                  <h3 className="text-[10px] uppercase tracking-widest text-[#00FF88] mb-4">Features</h3>
                  <ul className="space-y-4 text-white/70 text-sm font-light">
                    <li className="flex items-center gap-4">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#00FF88]"></div>
                      High-speed uncompressed video processing
                    </li>
                    <li className="flex items-center gap-4">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#00FF88]"></div>
                      Up to 1GB file size limit per upload
                    </li>
                    <li className="flex items-center gap-4">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#00FF88]"></div>
                      Instant shareable secure links with minimal UI
                    </li>
                    <li className="flex items-center gap-4">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#00FF88]"></div>
                      Hover actions on recent uploads for quick copying or deletion
                    </li>
                    <li className="flex items-center gap-4">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#00FF88]"></div>
                      Professional, high-contrast editorial aesthetic interface
                    </li>
                  </ul>
                </section>
              </div>
            </div>
          </div>
        )}
      </div>
    </BrowserRouter>
  );
}
