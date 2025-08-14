import { verifyFaceLocally } from './verifyFaceLocally';

interface StartProctoringOptions {
  videoElement: HTMLVideoElement;
  referenceBase64: string;
  onResult: (result: {
    match: boolean;
    distance: number;
    snapshotBase64: string;
  }) => void;
  intervalMs?: number;
}

let intervalId: NodeJS.Timeout | null = null;

export function startProctoring({
  videoElement,
  referenceBase64,
  onResult,
  intervalMs = 30000, // default to 30 seconds
}: StartProctoringOptions) {
  if (intervalId) stopProctoring();

  const captureAndVerify = async () => {
    try {
      console.log('Starting to capture for proctoring!');
      if (videoElement.readyState < 2) return;

      const canvas = document.createElement('canvas');
      canvas.width = videoElement.videoWidth;
      canvas.height = videoElement.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context not available');
      ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

      const snapshotBase64 = canvas.toDataURL('image/png');
      const result = await verifyFaceLocally(snapshotBase64, referenceBase64);

      onResult({ ...result, snapshotBase64 });
    } catch (error) {
    console.warn('No face detected or verification failed:', error);
    onResult({
      match: false,
      distance: 0.99,
      snapshotBase64: '', // or use a blank/last snapshot if needed
    });
  }
  };

  intervalId = setInterval(captureAndVerify, intervalMs);
}

export function stopProctoring() {
  if (intervalId) {
    console.log("Stopping Proctoring again");
    clearInterval(intervalId);
    intervalId = null;
  }
}