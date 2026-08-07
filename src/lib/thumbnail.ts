export function generateVideoThumbnail(
  source: File | string,
  preferredTime = 1.0
): Promise<{ thumbnailUrl: string; duration: number }> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      return reject(new Error('Window context required'));
    }

    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';
    video.preload = 'auto';

    let objectUrl: string | null = null;
    if (typeof source === 'string') {
      video.src = source;
    } else {
      objectUrl = URL.createObjectURL(source);
      video.src = objectUrl;
    }

    let isCleanedUp = false;
    const cleanup = () => {
      if (isCleanedUp) return;
      isCleanedUp = true;
      if (objectUrl) {
        try { URL.revokeObjectURL(objectUrl); } catch (e) {}
      }
      video.pause();
      video.onseeked = null;
      video.onloadedmetadata = null;
      video.onerror = null;
      video.removeAttribute('src');
      video.load();
    };

    // Calculate average pixel brightness to detect pitch-black frames
    const getFrameBrightness = (ctx: CanvasRenderingContext2D, width: number, height: number): number => {
      try {
        const sampleW = Math.min(100, width);
        const sampleH = Math.min(100, height);
        const imgData = ctx.getImageData(0, 0, sampleW, sampleH);
        const data = imgData.data;
        let totalBrightness = 0;
        const totalPixels = data.length / 4;
        for (let i = 0; i < data.length; i += 16) { // sample every 4th pixel for speed
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          totalBrightness += (r * 0.299 + g * 0.587 + b * 0.114);
        }
        return totalBrightness / (totalPixels / 4);
      } catch (e) {
        return 128; // fallback if getImageData fails (e.g. cross-origin)
      }
    };

    const tryCaptureAtTimestamps = async () => {
      const duration = video.duration || 0;
      const timestampsToTry: number[] = [];

      if (duration > 0) {
        timestampsToTry.push(Math.min(preferredTime, duration * 0.5));
        timestampsToTry.push(Math.min(0.5, duration * 0.2));
        timestampsToTry.push(Math.min(2.0, duration * 0.8));
        timestampsToTry.push(0.1);
      } else {
        timestampsToTry.push(preferredTime, 0.5, 0.1);
      }

      let bestThumbnail = '';
      let bestBrightness = -1;

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 360;
      const ctx = canvas.getContext('2d');

      for (const timeSec of timestampsToTry) {
        if (isCleanedUp) break;
        try {
          // Seek to timestamp
          video.currentTime = timeSec;
          await new Promise<void>((res) => {
            let done = false;
            const onSeeked = () => {
              if (!done) { done = true; video.onseeked = null; res(); }
            };
            video.onseeked = onSeeked;
            setTimeout(() => { if (!done) { done = true; res(); } }, 600);
          });

          // Play briefly to force GPU frame decode on mobile/Safari
          try {
            await video.play();
            video.pause();
          } catch (e) {}

          if (ctx && canvas.width > 0 && canvas.height > 0) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const brightness = getFrameBrightness(ctx, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.82);

            if (dataUrl && dataUrl.length > 300) {
              if (brightness > bestBrightness) {
                bestBrightness = brightness;
                bestThumbnail = dataUrl;
              }
              // If brightness is reasonable (> 20), accept this non-black frame!
              if (brightness >= 20) {
                cleanup();
                return resolve({ thumbnailUrl: dataUrl, duration });
              }
            }
          }
        } catch (seekErr) {
          console.warn('Seek error for timestamp:', timeSec, seekErr);
        }
      }

      if (bestThumbnail) {
        cleanup();
        return resolve({ thumbnailUrl: bestThumbnail, duration });
      }

      cleanup();
      reject(new Error('Could not capture valid non-empty frame from video'));
    };

    video.onloadedmetadata = () => {
      tryCaptureAtTimestamps();
    };

    video.onerror = () => {
      cleanup();
      reject(new Error('Video failed to load for thumbnail extraction'));
    };

    // Safety timeout in case video stalls
    setTimeout(() => {
      if (!isCleanedUp) {
        tryCaptureAtTimestamps();
      }
    }, 3500);

    video.load();
  });
}
