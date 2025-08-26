import { FaceMesh, type Results } from "@mediapipe/face_mesh";
import { Camera } from "@mediapipe/camera_utils";

export function initLipSyncDetection(
  videoEl: HTMLVideoElement,
  mediaStream: MediaStream,
  toast: (opts: {
      title: string;
      description?: string;
      variant?: "default" | "destructive";
      duration?: number;
    }) => void
) {
  console.log("🔍 Lip-sync detector initialized");

  // --- Audio Setup ---
  const audioCtx = new AudioContext();
  const analyser = audioCtx.createAnalyser();
  const micSource = audioCtx.createMediaStreamSource(mediaStream);
  analyser.fftSize = 256;
  micSource.connect(analyser);
  const dataArray = new Uint8Array(analyser.frequencyBinCount);

  const audioBuffer: number[] = [];
  const bufferSize = 5;

  const getSmoothedVolume = (): number => {
    analyser.getByteFrequencyData(dataArray);
    const avg = dataArray.reduce((sum, val) => sum + val, 0) / dataArray.length;

    audioBuffer.push(avg);
    if (audioBuffer.length > bufferSize) audioBuffer.shift();

    const smoothed = audioBuffer.reduce((a, b) => a + b, 0) / audioBuffer.length;
    return smoothed;
  };

  // --- FaceMesh Setup ---
  const faceMesh = new FaceMesh({
    locateFile: (file) =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
  });

  faceMesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });

  const lipThreshold = 0.01;     
  const volumeThreshold = 20;

  // --- Aggregation logic ---
  let checkResults: boolean[] = [];
  let consecutiveFails = 0;
  const checkInterval = 100000; // in ms
  let lastCheckTime = 0;

  const onResults = (results: Results) => {
    const now = Date.now();
    if (now - lastCheckTime < checkInterval) return;
    lastCheckTime = now;

    const landmarks = results.multiFaceLandmarks?.[0];
    if (!landmarks) return;

    const topLip = landmarks[13];
    const bottomLip = landmarks[14];
    if (!topLip || !bottomLip) return;

    const mouthGap = Math.abs(bottomLip.y - topLip.y);
    const mouthOpen = mouthGap > lipThreshold;

    const audioLevel = getSmoothedVolume();
    const isSpeaking = audioLevel > volumeThreshold;

    const lipSyncOK = (mouthOpen && isSpeaking) || (!mouthOpen && !isSpeaking) || (mouthOpen && !isSpeaking);

    checkResults.push(lipSyncOK);

    // console.log({
    //   audioLevel: audioLevel.toFixed(1),
    //   mouthGap: mouthGap.toFixed(3),
    //   mouthOpen,
    //   isSpeaking,
    //   lipSyncOK,
    // });

    // After 10 samples (~1 sec at 100ms interval)
    if (checkResults.length === 10) {
      const trueCount = checkResults.filter(Boolean).length;

      if (trueCount >= 1) {
        console.log("Lip-sync matched in this 1-second window");
        consecutiveFails = 0;
      } else {
        consecutiveFails++;
        console.log(`No match in this window. Consecutive fails: ${consecutiveFails}`);
        if (consecutiveFails >= 3) {
          console.log("🚨 Lip-sync mismatch for 5 consecutive seconds!");
          consecutiveFails = 0;
          // toast({
          //   title: "Warning",
          //   description: "Voice is not matching with your lips",
          //   variant: "destructive",
          //   duration: 2000,
          // });
        }
      }

      checkResults = []; // Reset for next second
    }
  };

  faceMesh.onResults(onResults);

  const camera = new Camera(videoEl, {
    onFrame: async () => {
      await faceMesh.send({ image: videoEl });
    },
    width: 640,
    height: 480,
  });

  camera.start();
}
