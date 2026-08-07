export function generateVideoThumbnail(
  source: File | string,
  seekToSeconds = 0.5
): Promise<{ thumbnailUrl: string; duration: number }> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      return reject(new Error('Window context required'));
    }

    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';

    let objectUrl: string | null = null;
    if (typeof source === 'string') {
      video.src = source.includes('#t=') ? source : `${source}#t=${seekToSeconds}`;
    } else {
      objectUrl = URL.createObjectURL(source);
      video.src = `${objectUrl}#t=${seekToSeconds}`;
    }

    const cleanup = () => {
      if (objectUrl) {
        try { URL.revokeObjectURL(objectUrl); } catch (e) {}
      }
      video.onseeked = null;
      video.onloadeddata = null;
      video.onerror = null;
      video.removeAttribute('src');
      video.load();
    };

    let seekedHandled = false;

    const captureFrame = () => {
      if (seekedHandled) return;
      seekedHandled = true;

      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 480;
        canvas.height = video.videoHeight || 270;
        const ctx = canvas.getContext('2d');
        if (ctx && canvas.width > 0 && canvas.height > 0) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.82);
          const duration = video.duration || 0;
          cleanup();
          resolve({ thumbnailUrl, duration });
          return;
        }
      } catch (err) {
        console.warn('Canvas thumbnail capture warning:', err);
      }
      cleanup();
      reject(new Error('Failed to capture frame from video canvas'));
    };

    video.onseeked = captureFrame;
    video.onloadeddata = () => {
      if (video.readyState >= 2) {
        try {
          if (Math.abs(video.currentTime - seekToSeconds) < 0.1) {
            captureFrame();
          } else {
            video.currentTime = seekToSeconds;
          }
        } catch (e) {
          captureFrame();
        }
      }
    };

    video.onerror = () => {
      cleanup();
      reject(new Error('Video loading error during thumbnail generation'));
    };

    // Safety fallback timeout
    setTimeout(() => {
      if (!seekedHandled) {
        captureFrame();
      }
    }, 2500);

    video.load();
  });
}
