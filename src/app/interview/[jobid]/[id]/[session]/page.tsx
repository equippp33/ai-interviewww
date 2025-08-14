"use client";

declare global {
  interface MediaRecorderErrorEvent extends Event {
    error: Error;
  }
}
import axios from "axios";
import { FaceMesh } from "@mediapipe/face_mesh";
import { Camera } from "@mediapipe/camera_utils";
import { initLipSyncDetection } from "@/lib/utils/initLipSyncDetection";
import { CheckCircle, AlertTriangle } from "lucide-react";
import { ensureFaceModelsAreLoaded } from "@/lib/faceLoader1";
import { verifyFaceLocally } from "@/lib/verifyFaceLocally";
import { startProctoring, stopProctoring } from "@/lib/startProctoring";
import { api } from "@/trpc/react";
import { useParams, useRouter } from "next/navigation";
import useInterviewUpload from "@/hooks/useInterviewUpload";
import {
  Mic,
  Circle,
  Square,
  Check,
  AlertCircle,
  ChevronDown,
} from "lucide-react";
import React, { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";
import { Wifi, Battery, Video, UserCircle, ClipboardList } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import Link from "next/link";
import InstructionDialog from "@/app/interview/components/instruction";

declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext;
  }
}

interface NetworkInformation {
  effectiveType: string;
  downlink: number;
}

type InterviewStatus =
  | "waiting"
  | "initializing"
  | "playing-question"
  | "recording"
  | "completed";

// Add interface for the audio response
interface AudioResponse {
  audio: string;
}

// Add the ProcessStreamResponse type
interface ProcessStreamResponse {
  isComplete: boolean;
  nextQuestion: string;
  topic?: string;
  shouldContinueRecording: boolean;
  transcript: string;
  questionCount: number;
  audio?: string;
  currentQuestions_Answer?: {
    question: string;
    topic: string;
    answer: string;
  };
}

const INTERVIEW_DURATION = 15 * 60;
const Min_Time_Frame = 5;

const InterviewPage = () => {
  const lipMotionHistory = useRef<number[]>([]);
  const audioVolumeHistory = useRef<number[]>([]);
  const lipSyncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [idVerificationStatus, setIdVerificationStatus] = useState<
    | "pending_permission"
    | "prompt"
    | "capturing"
    | "verifying"
    | "success"
    | "failed"
  >("pending_permission");
  const [idFaceCompositeImage, setIdFaceCompositeImage] = useState<
    string | null
  >(null);
  const [faceMissCount, setFaceMissCount] = useState(0);
  const MAX_FACE_MISS = 1;
  const [verificationMessage, setVerificationMessage] = useState<string | null>(
    null,
  );
  const idCheckVideoRef = useRef<HTMLVideoElement>(null);
  const [referenceImageBase64, setReferenceImageBase64] = useState<string | null>(null);
  const { interviewid, id, session } = useParams();
  const [resumeText, setResumeText] = useState<string | undefined>(undefined);
  const [JD_text, setJD_text] = useState<string | undefined>(undefined);
  const [resumeSummary, setResumeSummary] = useState<string>("");
  const [jdSummary, setJDSummary] = useState<string>("");
  const { toast } = useToast();
  const router = useRouter();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  // Add a new loading state
  const [isLoadingNextQuestion, setIsLoadingNextQuestion] = useState(false);
  const [nextClicked, setNextClicked] = useState(false);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [isTestingMic, setIsTestingMic] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isMonitoringAudio, setIsMonitoringAudio] = useState(false);
  const [error, setError] = useState<string>("");
  const [isRecording, setIsRecording] = useState(false);
  const [interviewStatus, setInterviewStatus] =
    useState<InterviewStatus>("waiting");
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const compressorRef = useRef<DynamicsCompressorNode | null>(null);
  const filterRef = useRef<BiquadFilterNode | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const chunksRef1 = useRef<BlobPart[]>([]);

  const [showQuestion, setShowQuestion] = useState(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [hasConsent, setHasConsent] = useState(false);
  const [silenceStartTime, setSilenceStartTime] = useState<number | null>(null);

  const [timeLeft, setTimeLeft] = useState(INTERVIEW_DURATION);
  const [formattedTime, setFormattedTime] = useState("3:00");
  const [isCompletionProcessing, setIsCompletionProcessing] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [JD_topics, setJDTopics] = useState<string[]>([]);
  const [hasMicrophoneTested, setHasMicrophoneTested] = useState(false);
  const [microphonePlayback, setMicrophonePlayback] = useState<
    "none" | "recording" | "playing"
  >("none");

  // Add these new states near your other state declarations
  const [canProceedToNext, setCanProceedToNext] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(5);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const interviewTimerRef = useRef<NodeJS.Timeout | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  if (videoRef.current) {
    videoRef.current.muted = true;
  }
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recorderRef1 = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null,);
  const mixedStreamRef = useRef<MediaStream | null>(null);
  const [isSpeechProcessing, setIsSpeechProcessing] = useState(false);
  const [questionCount, setQuestionCount] = useState(0);
  const speechTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<string>("");
  const [currentTopic, setCurrentTopic] = useState<string>("");
  const [previousQuestions, setPreviousQuestions] = useState<{ question: string; topic: string; answer: string }[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const watermarkRef = useRef<HTMLImageElement | null>(null);
  const [nextQuestionCache, setNextQuestionCache] = useState<{question: string; audio: string;} | null>(null);

  // Add new states for violation tracking
  const [isViolated, setIsViolated] = useState(false);
  const violationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const [hasReadInstructions, setHasReadInstructions] = useState(false);

  // Ensuring the model faces are loaded beforehand
  useEffect(() => {
    console.log("Running ensureFaceModelsAreLoaded() on client side");

    ensureFaceModelsAreLoaded()
      .then(() => console.log("Face models loaded"))
      .catch((err) => console.error("Failed to load models:", err));
  }, []);

  useEffect(() => {
    if (mediaStream && idCheckVideoRef.current) {
      idCheckVideoRef.current.srcObject = mediaStream;
    }
  }, [mediaStream]);

  const [networkSpeed, setNetworkSpeed] = useState<
    "unchecked" | "checking" | "good" | "moderate" | "poor"
  >("unchecked");

  const checkNetworkSpeed = async () => {
    setNetworkSpeed("checking");

    if (!navigator.onLine) {
      setNetworkSpeed("poor");
      toast({
        title: "No Internet Connection",
        description: "Please check your internet connection and try again.",
        variant: "destructive",
        duration: 2000,
      });
      return;
    }

    try {
      const startTime = performance.now();
      // Using a larger file for more accurate testing on fast connections
      const testFileUrl = "https://images.equippp.global/bfsi.gif";
      const tests = 2; // Reduced number of tests but using parallel requests
      let totalBytes = 0;

      // Run tests in parallel for faster and more accurate results
      const testPromises = Array(tests)
        .fill(null)
        .map(async (_, i) => {
          try {
            const response = await fetch(`${testFileUrl}?n=${i}`, {
              signal: AbortSignal.timeout(10000), // Increased timeout for larger file
              cache: "no-store", // Prevent caching
            });

            if (!response.ok) {
              throw new Error("Network response was not ok");
            }

            const blob = await response.blob();
            return blob.size;
          } catch (error) {
            console.error(`Test ${i} failed:`, error);
            return 0;
          }
        });

      // Wait for all tests to complete
      const results = await Promise.all(testPromises);
      totalBytes = results.reduce((sum, size) => sum + size, 0);

      const endTime = performance.now();
      const durationInSeconds = (endTime - startTime) / 1000;
      const speedMbps = (totalBytes * 8) / (1024 * 1024 * durationInSeconds);

      console.log("Measured speed:", speedMbps, "Mbps");
      console.log("Test duration:", durationInSeconds, "seconds");
      console.log("Total bytes:", totalBytes);

      // Adjusted thresholds for modern connections
      if (speedMbps > 15) {
        setNetworkSpeed("good");
        toast({
          title: "Excellent Connection Speed",
          description: `${speedMbps.toFixed(1)} Mbps - Perfect for video upload.`,
          duration: 2000,
        });
      } else if (speedMbps > 8) {
        setNetworkSpeed("moderate");
        toast({
          title: "Good Connection Speed",
          description: `${speedMbps.toFixed(1)} Mbps - Video upload should be quick.`,
          duration: 2000,
        });
      } else if (speedMbps > 3) {
        setNetworkSpeed("moderate");
        toast({
          title: "Moderate Connection Speed",
          description: `${speedMbps.toFixed(1)} Mbps - Video upload may take a few minutes.`,
          duration: 2000,
        });
      } else {
        setNetworkSpeed("poor");
        toast({
          title: "Connection Speed Warning",
          description: `${speedMbps.toFixed(1)} Mbps - Upload speed might be unstable.`,
          variant: "destructive",
          duration: 2000,
        });
      }

      // Additional check using Navigator.connection if available
      if ("connection" in navigator) {
        // Define NetworkInformation type

        // Type assertion for connection
        const connection = (navigator as { connection?: NetworkInformation })
          .connection;

        if (connection) {
          console.log("Connection type:", connection.effectiveType);
          console.log("Downlink:", connection.downlink, "Mbps");

          // If browser reports faster speed than our test, use that
          if (
            connection.effectiveType === "4g" &&
            connection.downlink > speedMbps
          ) {
            setNetworkSpeed("good");
            toast({
              title: "5G/4G Connection Detected",
              description:
                "Your connection should be suitable for video upload.",
              duration: 2000,
            });
          }
        }
      }
    } catch (error) {
      console.error("Network test failed:", error);

      // Check if it's a timeout error
      if (error instanceof Error && error.name === "TimeoutError") {
        setNetworkSpeed("poor");
        toast({
          title: "Speed Test Timeout",
          description:
            "The connection test took too long to complete. This might be temporary.",
          variant: "destructive",
          duration: 2000,
        });
      } else {
        // If the test fails but we're online, don't immediately assume poor connection
        if (navigator.onLine) {
          setNetworkSpeed("moderate");
          toast({
            title: "Connection Test Limited",
            description:
              "Couldn't accurately measure speed, but connection appears to be working.",
            duration: 2000,
          });
        } else {
          setNetworkSpeed("poor");
          toast({
            title: "Connection Test Failed",
            description: "Please check your internet connection and try again.",
            variant: "destructive",
            duration: 2000,
          });
        }
      }
    }
  };

  const { data: user, isLoading: isUserLoading } = api.user.getUser.useQuery();

  const { data: interview, isLoading: isInterviewLoading } =
    api.interview.getInterview.useQuery({
      interviewId: interviewid as string,
      id: id as string,
    });

  const { mutateAsync: convertImageToBase64 } = api.image.convertToBase64.useMutation();

  useEffect(() => {
    const referenceImageUrl = interview?.profilePicture;
    if (!referenceImageUrl) return;

    convertImageToBase64({ imageUrl: referenceImageUrl })
      .then((base64Image) => {
        // console.log("✅ Got Base64 from backend:", base64Image);
        setReferenceImageBase64(base64Image); // <-- your state for face verification
      })
      .catch((err) => {
        console.error("❌ Failed to convert image:", err.message);
      });
  }, [interview?.profilePicture]);

  // console.log({ referenceImageBase64 });

  const userResume = interview?.resume ?? "";

  // A static fixed PDF of Job Description
  const JD =
    "https://drive.google.com/uc?export=download&id=1Gv_JFInhA-pZ7jHCLQsTN9D1cOTD2VgH";

  // This function parses any pdf given to it
  const parsePDF = async (pdfUrl: string) => {
    console.log("Entered PDF parser");

    if (!pdfUrl) {
      console.error("No PDF URL provided for parsing");
      return null;
    }

    try {
      const extractResponse = await fetch("/api/parse-resume", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ pdfUrl }),
      });

      if (!extractResponse.ok) {
        const errorData = (await extractResponse.json()) as { error?: string };
        throw new Error(errorData.error ?? "Failed to extract text");
      }

      const { text } = (await extractResponse.json()) as { text: string };

      console.log("Extracted Resume Text:", text);
      return text;
    } catch (error) {
      console.error("Text extraction failed:", error);
      return null;
    }
  };

  const getSupportedMimeType = () => {
    const types = [
      "video/webm;codecs=vp8,opus",
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=h264,opus",
      "video/webm",
      "video/mp4;codecs=h264,aac",
      "video/mp4",
    ];

    for (const type of types) {
      if (
        typeof window !== "undefined" &&
        typeof MediaRecorder !== "undefined"
      ) {
        if (MediaRecorder.isTypeSupported(type)) {
          return type;
        }
      }
    }

    console.error("No supported MIME type found");
    return "audio/webm"; // fallback
  };

  const [mimeType, setMimeType] = useState("audio/webm"); // default fallback

  useEffect(() => {
    const getSupportedMimeType = () => {
      const types = [
        "video/webm;codecs=vp8,opus",
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=h264,opus",
        "video/webm",
        "video/mp4;codecs=h264,aac",
        "video/mp4",
      ];

      for (const type of types) {
        if (
          typeof MediaRecorder !== "undefined" &&
          MediaRecorder.isTypeSupported(type)
        ) {
          return type;
        }
      }

      console.error("No supported MIME type found");
      return "audio/webm";
    };

    // Safe: browser-only logic inside useEffect
    setMimeType(getSupportedMimeType());

    const eqLogo = new window.Image();
    eqLogo.src = "/assets/images/eq.png";
  }, []);

  // Add new state for quality management
  const [videoQuality, setVideoQuality] = useState<"high" | "medium" | "low">(
    "high",
  );

  // Add quality presets
  const qualityPresets = {
    high: {
      width: 640, // 360p width
      height: 360, // 360p height
      frameRate: 15, // reduced framerate
      videoBitsPerSecond: 800000, // 800 Kbps
    },
    medium: {
      width: 480, // 240p width
      height: 240, // 240p height
      frameRate: 12,
      videoBitsPerSecond: 500000, // 500 Kbps
    },
    low: {
      width: 320, // 180p width
      height: 180, // 180p height
      frameRate: 10,
      videoBitsPerSecond: 250000, // 250 Kbps
    },
  };

  useEffect(() => {
    if (hasConsent) {
      console.log("Consent granted, setting up media...");

      const setupMedia = async () => {
        try {
          // Initialize audio context first
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          audioContextRef.current = new AudioContext({
            latencyHint: "interactive",
            sampleRate: 48000,
          });
          console.log("Audio context initialized");

          // Set up audio nodes
          audioDestinationRef.current =
            audioContextRef.current.createMediaStreamDestination();
          analyserRef.current = audioContextRef.current.createAnalyser();
          analyserRef.current.fftSize = 2048;
          analyserRef.current.smoothingTimeConstant = 0.8;

          // Set up media stream if not already exists
          if (!mediaStream) {
            const currentQuality = qualityPresets[videoQuality];
            const stream = await navigator.mediaDevices.getUserMedia({
              video: {
                width: { ideal: currentQuality.width },
                height: { ideal: currentQuality.height },
                frameRate: { ideal: currentQuality.frameRate },
                facingMode: "user",
              },
              audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                sampleRate: 48000,
              },
            });

            console.log("Media stream obtained:", {
              videoTracks: stream.getVideoTracks().length,
              audioTracks: stream.getAudioTracks().length,
            });

            setMediaStream(stream);
          }

          // Connect audio nodes if media stream exists
          if (mediaStream) {
            const microphone =
              audioContextRef.current.createMediaStreamSource(mediaStream);
            const microphoneGain = audioContextRef.current.createGain();
            microphoneGain.gain.value = 0.7;

            // Connect microphone to analyzer and destination
            microphone.connect(analyserRef.current);
            microphone.connect(microphoneGain);
            microphoneGain.connect(audioDestinationRef.current);

            mixedStreamRef.current = audioDestinationRef.current.stream;

            // Set up video
            if (videoRef.current) {
              console.log("Setting up video element");
              videoRef.current.srcObject = mediaStream;
              await videoRef.current.play();
              console.log("Video playback started");
            } else {
              console.error("Video element ref not found");
            }

            // Adding for proctoring as well
            if (idCheckVideoRef.current && !idCheckVideoRef.current.srcObject) {
              console.log("Setting up proctoring element");
              idCheckVideoRef.current.srcObject = mediaStream;
              await idCheckVideoRef.current.play();
            } else {
              console.error("Proctoring element ref not found");
            }
          }
        } catch (err) {
          console.error("Media setup error:", err);
          setError(
            `Failed to initialize media: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      };

      void setupMedia();

      // Cleanup function
      return () => {
        console.log("Cleaning up media resources...");
        if (mediaStream) {
          mediaStream.getTracks().forEach((track) => {
            track.stop();
            console.log(`Stopped ${track.kind} track`);
          });
        }
        if (audioContextRef.current) {
          void audioContextRef.current.close();
          console.log("Audio context closed");
        }
        console.log("Stopping Proctoring");
        stopProctoring();
      };
    }
  }, [hasConsent, mediaStream, videoQuality]);

  // Initialize audio analyzer when consent is given
  useEffect(() => {
    if (hasConsent && audioContextRef.current) {
      try {
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 2048;
        analyserRef.current.smoothingTimeConstant = 0.8;

        if (mediaStream) {
          const microphone =
            audioContextRef.current.createMediaStreamSource(mediaStream);
          microphone.connect(analyserRef.current);
        }
      } catch (err) {
        console.error("Failed to initialize audio analyzer:", err);
      }
    }
  }, [hasConsent, mediaStream]);

  useEffect(() => {
    if (mediaStream && isTestingMic) {
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(mediaStream);
      microphone.connect(analyser);
      analyser.fftSize = 256;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateAudioLevel = () => {
        analyser.getByteFrequencyData(dataArray);
        const average =
          dataArray.reduce((acc, val) => acc + val, 0) / dataArray.length;
        setAudioLevel(Math.min((average / 128) * 100, 100));

        if (isTestingMic) {
          requestAnimationFrame(updateAudioLevel);
        }
      };

      updateAudioLevel();

      return () => {
        microphone.disconnect();
        void audioContext.close();
      };
    }
  }, [mediaStream, isTestingMic]);

  const [isPaused, setIsPaused] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const transcriptRef = useRef<string>("");

  const startAudioRecording = useCallback(() => {
    if (!mediaStream) {
      console.error("No media stream available for audio recording");
      setError("No media stream available for audio recording");
      return;
    }

    try {
      console.log("Starting fresh audio-only recording...");

      const audioTrack1 = mediaStream
        .getAudioTracks()
        .find((track) => track.kind === "audio");
      if (!audioTrack1) {
        console.error("No audio track found");
        setError("No audio track found");
        return;
      }

      const audioStream1 = new MediaStream([audioTrack1]); // Create a stream with only the audio track

      const audioRecorder1 = new MediaRecorder(audioStream1, {
        mimeType: "audio/webm;codecs=opus",
        audioBitsPerSecond: 64000,
      });

      audioRecorder1.ondataavailable = (event) => {
        if (event.data.size > 0 && !isPaused) {
          chunksRef1.current.push(event.data);
          // console.log("Recorded audio chunk size:", event.data.size);

          // Send to WebSocket
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            event.data.arrayBuffer().then((buffer) => {
              wsRef.current?.send(buffer);
            });
          }
        }
      };

      audioRecorder1.onstop = () => {
        console.log(
          "Audio recording stopped, total chunks:",
          chunksRef1.current.length,
        );
        const finalBlob1 = new Blob(chunksRef1.current, { type: "audio/webm" });
        console.log("Final audio size:", finalBlob1.size / 1024, "KB");
        chunksRef1.current = []; // Clear chunks for next recording
      };

      // Adding the websocket dependencies
      const ws = new WebSocket("ws://localhost:3000/stt-service");

      ws.onopen = () => {
        console.log("🔵 WebSocket connected to STT backend");
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === "transcript" && msg.transcript) {
            if (msg.is_final) {
              // Append final transcript to the main transcriptRef
              transcriptRef.current += msg.transcript + ". ";
              console.log("🟢 Final transcript:", msg.transcript);
            } else {
              // Show interim transcript (don't append to final transcript)
              // console.log("🟡 Interim transcript:", msg.transcript);
            }
          }
        } catch (err) {
          console.error("Error parsing STT message:", err);
        }
      };

      ws.onerror = (err) => {
        console.error("WebSocket error:", err);
      };

      ws.onclose = () => {
        console.log("🔴 WebSocket closed");
      };

      wsRef.current = ws;

      audioRecorder1.start(1000);
      console.log("AudioRecorder started:", audioRecorder1.state);
      recorderRef1.current = audioRecorder1;
      setIsRecording(true);
      setIsPaused(false);

      // Starting lip-sync monitoring here
      const videoEl = document.querySelector("video") as HTMLVideoElement;
      if (videoEl) {
        console.log("Starting lip-sync monitoring here");
        console.log(
          "Make sure you are in a quiet environment with no external distrubance",
        );
        initLipSyncDetection(videoEl, mediaStream, toast);
      }
    } catch (err) {
      console.error("Error starting audio recording:", err);
      setError(`Failed to start audio recording: ${(err as Error).message}`);
    }
  }, [mediaStream, setError]);

  const pauseAudioRecording = useCallback(() => {
    if (recorderRef1.current && recorderRef1.current.state === "recording") {
      recorderRef1.current.pause();
      console.log("Audio recording paused");
      setIsPaused(true);
    }
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.close();
    }
  }, []);

  const restartAudioRecording = useCallback(() => {
    if (recorderRef1.current && recorderRef1.current.state !== "inactive") {
      console.log("Stopping current recording before restarting...");

      recorderRef1.current.stop();
      recorderRef1.current.onstop = () => {
        console.log("Recording stopped. Clearing previous chunks...");
        chunksRef1.current = []; // Clear old audio data
        console.log("Starting a fresh recording...");
        startAudioRecording(); // Start fresh recording
      };
    } else {
      console.log("No active recording found, starting a fresh one...");
      startAudioRecording();
    }
  }, [startAudioRecording]);

  const startRecording = useCallback(() => {
    if (!mediaStream) {
      console.error("No media stream available");
      setError("No media stream available");
      return;
    }

    try {
      console.log("Starting recording with mixed streams");

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.width = 1280;
      canvas.height = 720;

      const watermark = document.createElement("img");
      watermark.src = "/assets/images/eq.png";
      watermarkRef.current = watermark;

      // Create audio context and destination if not exists
      if (!audioContextRef.current) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioContextRef.current = new AudioContext();
        audioDestinationRef.current =
          audioContextRef.current.createMediaStreamDestination();
      }

      // Mix user's audio with the destination stream
      const micSource =
        audioContextRef.current.createMediaStreamSource(mediaStream);
      if (audioDestinationRef.current) {
        micSource.connect(audioDestinationRef.current);
      }

      // Create a new stream that includes both video and mixed audio
      const videoTrack = mediaStream.getVideoTracks()[0];
      const mixedStream = new MediaStream();
      if (videoTrack) mixedStream.addTrack(videoTrack);
      const audioTrack =
        audioDestinationRef.current?.stream.getAudioTracks()[0];
      if (audioTrack) {
        mixedStream.addTrack(audioTrack);
      }

      const recorder = new MediaRecorder(mixedStream, {
        mimeType,
        videoBitsPerSecond: 2500000,
        audioBitsPerSecond: 128000,
      });

      // Rest of the recorder setup...
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        console.log(
          "Recording stopped, total chunks:",
          chunksRef.current.length,
        );
        const finalBlob = new Blob(chunksRef.current, { type: "video/webm" });
        setRecordedBlob(finalBlob);
        setInterviewStatus("completed");
        console.log("Final recording size:", finalBlob.size / 1024, " KB");
      };

      recorder.start(1000);
      console.log("MediaRecorder started:", recorder.state);
      recorderRef.current = recorder;
      setIsRecording(true);
    } catch (err) {
      console.error("Error starting recording:", err);
      setError(
        `Failed to start recording: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }, [mediaStream, setError]);

  // This function converts text-file (base 64) to audio
  const playAudioFromBase64 = useCallback(
    async (base64Audio: string, onEnded?: () => void) => {
      console.log("Starting audio playback for question...");
      setIsMonitoringAudio(false);

      try {
        // Clean up existing audio
        if (audioElementRef.current) {
          audioElementRef.current.pause();
          audioElementRef.current.removeAttribute("src");
          audioElementRef.current = null;
        }

        const audio = new Audio();
        audioElementRef.current = audio;

        // Create audio context if not exists
        if (!audioContextRef.current) {
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          audioContextRef.current = new AudioContext();
        }

        // Set up event listeners
        audio.addEventListener("play", () => {
          console.log("Audio started playing");

          // Connect question audio to the recording stream
          if (audioContextRef.current) {
            const source =
              audioContextRef.current.createMediaElementSource(audio);
            const gainNode = audioContextRef.current.createGain();
            gainNode.gain.value = 1.0; // Adjust volume as needed

            source.connect(gainNode);
            gainNode.connect(audioContextRef.current.destination);

            // If we have a media stream destination, connect to it for recording
            if (audioDestinationRef.current) {
              gainNode.connect(audioDestinationRef.current);
            }
          }

          setIsAudioPlaying(true);
          setShowQuestion(true);
        });

        audio.addEventListener("ended", () => {
          console.log("Audio playback completed");
          setIsAudioPlaying(false);
          onEnded?.();
        });

        // Create and play audio
        const audioData = atob(base64Audio);
        const arrayBuffer = new ArrayBuffer(audioData.length);
        const view = new Uint8Array(arrayBuffer);
        for (let i = 0; i < audioData.length; i++) {
          view[i] = audioData.charCodeAt(i);
        }

        const blob = new Blob([arrayBuffer], { type: mimeType });
        const url = URL.createObjectURL(blob);

        audio.src = url;
        audio.load();
        audio.volume = 1.0;

        try {
          await audio.play();
          console.log("Audio playback started successfully");
        } catch (playError) {
          console.error("Play error:", playError);
          throw playError;
        }

        return () => {
          URL.revokeObjectURL(url);
        };
      } catch (err) {
        console.error("Audio setup error:", err);
        setError("Failed to play audio");
        onEnded?.();
      }
    },
    [],
  );

  const getAudioMutation = api.interview.getAudio.useMutation();
  const handleInterviewStart = useCallback(async () => {
    console.log("Starting interview...");
    setInterviewStatus("initializing");

    try {
      // Ensure media stream is initialized
      if (
        !mediaStream?.getTracks().some((track) => track.readyState === "live")
      ) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        setMediaStream(stream);
      }

      setError("");
      setShowQuestion(false);

      const initialQuestion = `Hi ${interview?.fullName ?? ""}, welcome to the interview. Could you please introduce yourself and tell us about your background?`;

      const audioResponse = await new Promise<AudioResponse>(
        (resolve, reject) => {
          getAudioMutation.mutate(
            {
              text: initialQuestion,
              fullName: interview?.fullName ?? "",
            },
            {
              onSuccess: (data) => resolve(data as AudioResponse),
              onError: (error) => reject(error),
            },
          );
        },
      );

      if (audioResponse.audio) {
        setCurrentQuestion(initialQuestion);
        setShowQuestion(true);

        void playAudioFromBase64(audioResponse.audio, () => {
          console.log("Initial question completed");
          setQuestionCount(1);
        });

        setInterviewStatus("recording");
        startRecording();
        startAudioRecording();

        // Start Proctoring
        if (idCheckVideoRef.current && referenceImageBase64) {
          console.log("Start Proctoring man");
          startProctoring({
            videoElement: idCheckVideoRef.current,
            referenceBase64: referenceImageBase64,
            onResult: ({ match, distance, snapshotBase64 }) => {
              if (!match) {
                console.log("Face Mismatch");
                setVerificationMessage(
                  `⚠ Warning! Face mismatch. Distance: ${distance.toFixed(3)}`,
                );
                //  Setting a limit for face mismatch
                setFaceMissCount((prev) => {
                  const newCount = prev + 1;
                  console.log("newCount = ", newCount);
                  if (newCount >= MAX_FACE_MISS) {
                    console.log(
                      "Face not detected multiple times",
                    );
                    setFaceMissCount(0);
                    // stopProctoring();
                    // cleanupMediaStreams();
                    // Optionally navigate to exit screen or show error

                    // toast({
                    //   title: "Warning",
                    //   description:
                    //     "Face not detected multiple times. Please be visible infront of the camera",
                    //   variant: "destructive",
                    //   duration: 2000,
                    // });
                  }
                  return newCount;
                });
              } else {
                console.log("Face Matches!");
                setVerificationMessage(
                  `Face verified. Distance: ${distance.toFixed(3)}`,
                );
                setIdVerificationStatus("success");
                setFaceMissCount(0); // setting the face-mismatch count to 0 if right face is detected
              }
              setIdFaceCompositeImage(snapshotBase64);
              // console.log("Interview Status:", interviewStatus);
            },
          });
        } else {
          console.warn(
            "Skipping proctoring - reference image or video not available",
          );
        }
      } else {
        throw new Error("Failed to get audio response");
      }
    } catch (err) {
      console.error("Error starting interview:", err);
      setError("Failed to start interview. Please try again.");
      setInterviewStatus("waiting");
    }
  }, [
    interview?.fullName,
    startRecording,
    startAudioRecording,
    getAudioMutation,
    mediaStream,
    playAudioFromBase64,
    idCheckVideoRef.current,
    referenceImageBase64,
  ]);

  const { mutate: processSpeech } = api.interview.processStreamOld.useMutation({
    onSuccess: async (response: ProcessStreamResponse) => {
      console.log("Process speech response received");
      setError("");
      setIsSpeechProcessing(false);
      setIsLoadingNextQuestion(false);

      if (response.isComplete) {
        console.log("Interview complete, stopping recording");
        if (recorderRef.current) {
          recorderRef.current.stop();
        }
        void handleInterviewCompletion();
        return;
      }

      if (response.nextQuestion && response.audio) {
        console.log("Current Question Updated:", response.nextQuestion);

        setCurrentQuestion(response.nextQuestion);
        setQuestionCount(response.questionCount);

        // Reset timer for next question
        setTimeRemaining(Min_Time_Frame);
        setCanProceedToNext(false);

        // Play the next question
        await playAudioFromBase64(response.audio, () => {
          console.log("Question audio completed");
          setInterviewStatus("recording");
          startRecording();
        });
      }
    },
    onError: (error) => {
      console.error("Speech processing error:", error);
      setError("Failed to process response");
      setIsSpeechProcessing(false);
      setIsLoadingNextQuestion(false);
      setInterviewStatus("recording");
    },
  });

  // Add mutation for submitting interview
  const { mutate: submitInterview } = api.interview.submitInterview.useMutation(
    {
      onSuccess: () => {
        // Stop the proctoring as well
        stopProctoring();

        // Clean up all media streams
        cleanupMediaStreams();
        toast({
          title: "Interview submitted successfully",
          description: "Your interview has been recorded and submitted.",
          duration: 2000,
        });
        router.push(`/student/profile/${id as string}`);
      },
      onError: (error) => {
        toast({
          title: "Failed to submit interview",
          description: error.message,
          variant: "destructive",
          duration: 2000,
        });
      },
    },
  );

  // Add helper function to cleanup media streams
  const cleanupMediaStreams = useCallback(() => {
    console.log("Cleaning up media streams...");

    // Stop recording if still active
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
      console.log("Stopped recorder");
    }

    // Only cleanup after ensuring recording is complete
    if (recordedBlob) {
      if (mediaStream) {
        mediaStream.getTracks().forEach((track) => {
          track.stop();
          console.log(`Stopped ${track.kind} track`);
        });
        setMediaStream(null);
      }

      if (mixedStreamRef.current) {
        mixedStreamRef.current.getTracks().forEach((track) => {
          track.stop();
          console.log(`Stopped mixed ${track.kind} track`);
        });
        mixedStreamRef.current = null;
      }

      if (audioContextRef.current) {
        void audioContextRef.current.close();
        audioContextRef.current = null;
        console.log("Closed audio context");
      }

      if (videoRef.current) {
        videoRef.current.srcObject = null;
        console.log("Cleared video element");
      }
    }
  }, [mediaStream, recordedBlob]);

  // Add upload handler using useInterviewUpload
  const { uploadInterview, uploading } = useInterviewUpload((url) => {
    console.log("End stage: Here is the URL : ", url);
    submitInterview({
      interviewId: interviewid as string,
      userId: id as string,
      phoneNumber: interview?.phoneNumber ?? "",
      sessionId: session as string,
      collegeName: interview?.collegeName ?? "",
      yearOfPassing: interview?.yearOfPassing ?? "",
      rollno: interview?.rollno ?? "",
      stream: interview?.stream ?? "",
      videoUrl: url,
      email: interview?.email ?? "",
      fullName: interview?.fullName ?? "",
      previousQuestions: previousQuestions ?? [],
      JD_text: JD_text ?? "",
      resumeText: resumeText ?? "",
      JD_topics: JD_topics ?? [],
    });
  });

  // Update handleSubmitInterview to ensure cleanup happens before upload
  const handleSubmitInterview = useCallback(() => {
    if (!recordedBlob) {
      console.error("❌ Error: No recorded blob found!");
      return;
    }

    console.log(
      "🔍 Debug: Submitting interview, blob size:",
      recordedBlob.size,
    );

    console.log("Previous Q&As: ", previousQuestions);

    if (recordedBlob) {
      console.log("Submitting interview, blob size:", recordedBlob.size);

      // Upload the interview recording
      void uploadInterview(recordedBlob);

      // Only clean up media streams AFTER successful upload
      cleanupMediaStreams();
    }
  }, [recordedBlob, uploadInterview, cleanupMediaStreams]);

  // Add new state for silence tracking

  // Initialize audio analyzer when consent is given
  useEffect(() => {
    if (hasConsent && audioContextRef.current) {
      try {
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 2048;
        analyserRef.current.smoothingTimeConstant = 0.8;

        if (mediaStream) {
          const microphone =
            audioContextRef.current.createMediaStreamSource(mediaStream);
          microphone.connect(analyserRef.current);
        }
      } catch (err) {
        console.error("Failed to initialize audio analyzer:", err);
      }
    }
  }, [hasConsent, mediaStream]);

  // Add this state to track if we should be monitoring audio

  // Update the checkAudioLevel function
  const checkAudioLevel = useCallback(() => {
    if (
      !analyserRef.current ||
      !mediaStream?.getAudioTracks()[0]?.enabled ||
      isSpeechProcessing
    ) {
      return;
    }

    const dataArray = new Float32Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getFloatTimeDomainData(dataArray);

    let rms = 0;
    for (const value of dataArray) {
      rms += value * value;
    }
    rms = Math.sqrt(rms / dataArray.length);
    const db = 20 * Math.log10(rms);

    const isSpeaking = db > -45;
    setIsUserSpeaking(isSpeaking);

    // Only update speaking state, don't process automatically
    if (isSpeaking) {
      if (silenceStartTime) {
        setSilenceStartTime(null);
      }
      hasSpokenRef.current = true;
    } else if (!silenceStartTime && hasSpokenRef.current) {
      setSilenceStartTime(Date.now());
    }
  }, [isSpeechProcessing, mediaStream, silenceStartTime]);

  // Add ref to track if user has spoken
  const hasSpokenRef = useRef(false);

  // Update the processRecordedAudio function
  const processRecordedAudio = useCallback(() => {
    if (!chunksRef.current.length) {
      setIsMonitoringAudio(true);
      return;
    }

    const audioBlob = new Blob(chunksRef.current, { type: mimeType });
    if (audioBlob.size < 1024) {
      // If there's no significant audio data, send a flag indicating no response
      console.log("Nothing much received, empty string");
      processSpeech({
        audio: "", // Empty audio
        currentQuestion,
        questionCount: questionCount + 1,
        fullName: interview?.fullName ?? "",
        primarySpecialization: interview?.primarySpecialization ?? "",
        silenceDuration: 0,
        isNoResponse: true, // Add this flag
        JD_topics: JD_topics,
      });
      return;
    }

    setIsSpeechProcessing(true);
    setInterviewStatus("playing-question");

    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result !== "string") {
        console.error("Failed to read audio data");
        setError("Failed to process audio");
        setIsSpeechProcessing(false);
        setIsMonitoringAudio(true);
        return;
      }

      const base64Data = reader.result.split(",")[1];
      if (!base64Data) {
        console.error("Invalid audio data format");
        setError("Invalid audio format");
        setIsSpeechProcessing(false);
        setIsMonitoringAudio(true);
        return;
      }

      processSpeech({
        audio: base64Data,
        currentQuestion,
        questionCount: questionCount + 1,
        fullName: interview?.fullName ?? "",
        primarySpecialization: interview?.primarySpecialization ?? "",
        silenceDuration: 0,
        isNoResponse: false, // Add this flag
        JD_topics: JD_topics,
      });
    };

    reader.onerror = () => {
      console.error("Error reading audio file");
      setError("Failed to process audio");
      setIsSpeechProcessing(false);
      setIsMonitoringAudio(true);
    };

    reader.readAsDataURL(audioBlob);
  }, [currentQuestion, questionCount, interview, processSpeech]);

  // Update the monitoring effect
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    if (
      interviewStatus === "recording" &&
      !isAudioPlaying &&
      !isSpeechProcessing
    ) {
      setIsMonitoringAudio(true);
      intervalId = setInterval(checkAudioLevel, 100);
    } else {
      setIsMonitoringAudio(false);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
      if (speechTimeoutRef.current) {
        clearTimeout(speechTimeoutRef.current);
        speechTimeoutRef.current = null;
      }
    };
  }, [interviewStatus, checkAudioLevel, isAudioPlaying, isSpeechProcessing]);

  // Add this useEffect to handle the timer
  useEffect(() => {
    let timerId: NodeJS.Timeout | null = null;

    if (
      interviewStatus === "recording" &&
      !isAudioPlaying &&
      !isLoadingNextQuestion &&
      timeRemaining > 0
    ) {
      console.log("Starting question timer:", timeRemaining);
      timerId = setInterval(() => {
        setTimeRemaining((prev) => {
          const newTime = prev - 1;
          if (newTime <= 0) {
            setCanProceedToNext(true);
            return 0;
          }
          return newTime;
        });
      }, 1000);
    }

    return () => {
      if (timerId) {
        clearInterval(timerId);
      }
    };
  }, [interviewStatus, isAudioPlaying, isLoadingNextQuestion, timeRemaining]);

  // This is Santha's modified one
  const handleNextQuestion = useCallback(() => {
    if (!canProceedToNext) return;
    setIsLoadingNextQuestion(true);
    setNextClicked(true);
    pauseAudioRecording();

    // if (chunksRef.current.length > 0) {
    //   const audioBlob = new Blob(chunksRef1.current, { type: "audio/webm" });
    //   console.log("current audio size:", audioBlob.size / 1024, "KB");
    //   const reader = new FileReader();

    //   reader.onloadend = () => {
    //     const base64Data = reader.result?.toString().split(",")[1];
    //     if (base64Data) {
    //       prefetchSpeech({
    //         audio: base64Data,
    //         currentQuestion,
    //         topic: currentTopic,
    //         JD_topics: JD_topics,
    //         questionCount,
    //         fullName: interview?.fullName ?? "",
    //         primarySpecialization: interview?.primarySpecialization ?? "",
    //         isNoResponse: false,
    //         silenceDuration: 0,
    //         resumeText: resumeSummary ?? undefined,
    //         JD_text: jdSummary ?? undefined,
    //         previousQuestions,
    //       });
    //     }
    //   };

    //   reader.readAsDataURL(audioBlob);
    //   // chunksRef.current = [];
    // }

    const liveTranscript = transcriptRef.current.trim();
    console.log("Gathering live transcript : ", liveTranscript);
    if (liveTranscript.length >= 0) {
      prefetchSpeech({
        audio: liveTranscript, // here audio is the liveTranscipt in string format
        currentQuestion,
        topic: currentTopic,
        JD_topics,
        questionCount,
        fullName: interview?.fullName ?? "",
        primarySpecialization: interview?.primarySpecialization ?? "",
        isNoResponse: false,
        silenceDuration: 0,
        resumeText: resumeSummary ?? undefined,
        JD_text: jdSummary ?? undefined,
        previousQuestions,
      });
      transcriptRef.current = ""; // clear after sending
    }
  }, [canProceedToNext, playAudioFromBase64]);

  // Update the timer effect to only run when not loading and not playing audio
  useEffect(() => {
    let timerId: NodeJS.Timeout | null = null;

    if (
      interviewStatus === "recording" &&
      !isAudioPlaying && // Don't count during audio playback
      !isLoadingNextQuestion && // Don't count during loading
      timeRemaining > 0
    ) {
      timerId = setInterval(() => {
        setTimeRemaining((prev) => {
          const newTime = prev - 1;
          if (newTime <= 0) {
            setCanProceedToNext(true);
            return 0;
          }
          return newTime;
        });
      }, 1000);
    }

    return () => {
      if (timerId) {
        clearInterval(timerId);
      }
    };
  }, [interviewStatus, isAudioPlaying, isLoadingNextQuestion, timeRemaining]);

  // Reset timer when new question starts playing
  useEffect(() => {
    if (isAudioPlaying) {
      setTimeRemaining(Min_Time_Frame);
      setCanProceedToNext(false);
    }
  }, [isAudioPlaying]);

  const handleInterviewCompletion = useCallback(async () => {
    setIsCompletionProcessing(true);

    try {
      // Stop recording but DON'T stop media streams yet
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
        pauseAudioRecording();
        console.log("Stopped recording");
      }

      // Show completion modal
      setShowCompletionModal(true);
    } catch (error) {
      console.error("Error during completion:", error);
      toast({
        title: "Error",
        description: "Failed to complete interview properly",
        variant: "destructive",
        duration: 2000,
      });
    } finally {
      setIsCompletionProcessing(false);
    }
  }, []);

  useEffect(() => {
    if (timeLeft <= 1) {
      void handleInterviewCompletion();
      // Don't cleanup streams here
    }
  }, [timeLeft, handleInterviewCompletion]);

  // original prefetchSpeech
  const { mutate: prefetchSpeech } = api.interview.processStreamOld.useMutation(
    {
      onSuccess: (response: ProcessStreamResponse) => {
        console.log("Next Question : ", response.nextQuestion);
        setIsLoadingNextQuestion(false);
        setCurrentQuestion(response.nextQuestion);
        console.log("Current topic : ", response.topic);
        setCurrentTopic(response.topic ?? "Unknown");
        setQuestionCount((prev) => prev + 1);
        console.log("Transcript: ", response.transcript);

        const qa = response.currentQuestions_Answer;
        if (qa) {
          console.log("Q:", qa.question);
          console.log("Topic:", qa.topic);
          console.log("Answer:", qa.answer);
        }

        setNextClicked(false);

        if (response.nextQuestion && response.topic && qa) {
          setPreviousQuestions((prev) => [
            ...prev,
            {
              question: qa.question,
              topic: qa.topic ?? "Unknown",
              answer: qa.answer,
            },
          ]);
        }

        if (response.audio) {
          void playAudioFromBase64(response.audio, () => {
            // setInterviewStatus("recording");
            restartAudioRecording();
          });
        }
      },
      onError: (error) => {
        console.error("Error prefetching next question:", error);
      },
    },
  );

  // Entire code of verification of face
  async function getBase64FromPublicImage(imagePath: string): Promise<string> {
    try {
      const response = await fetch(imagePath);
      const blob = await response.blob();
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error("Error converting image to base64:", error);
      return "";
    }
  }

  const handleCaptureAndVerify = async () => {
    if (!idCheckVideoRef.current) {
      console.error("Video reference is missing");
      return;
    }
    setIdVerificationStatus("capturing");

    const waitForVideoReady = (video: HTMLVideoElement): Promise<void> => {
      console.log("Entered wait video to get ready");
      return new Promise((resolve, reject) => {
        if (video.readyState >= 2) {
          resolve();
        } else {
          const onLoadedData = () => {
            video.removeEventListener("loadeddata", onLoadedData);
            resolve();
          };
          video.addEventListener("loadeddata", onLoadedData);

          // Optional timeout to avoid infinite wait
          setTimeout(() => {
            video.removeEventListener("loadeddata", onLoadedData);
            reject(new Error("Video took too long to load"));
          }, 5000);
        }
      });
    };

    try {
      const video = idCheckVideoRef.current;
      // Wait until video is ready
      await waitForVideoReady(video);
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("Failed to get canvas context");
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const capturedBase64Image = canvas.toDataURL("image/png");

      if (!capturedBase64Image.startsWith("data:image/")) {
        throw new Error("Captured image is not a valid base64 image");
      }
      setIdFaceCompositeImage(capturedBase64Image);
      setIdVerificationStatus("verifying");

      if (!referenceImageBase64) {
        throw new Error("Please upload a reference image first.");
      }

      console.log({ capturedBase64Image, referenceImageBase64 });

      const result = await verifyFaceLocally(
        capturedBase64Image,
        referenceImageBase64,
      );

      if (result.match) {
        setVerificationMessage(
          `Matched! Distance: ${result.distance.toFixed(3)}`,
        );
        setIdVerificationStatus("success");
      } else {
        setVerificationMessage(
          `No match. Distance: ${result.distance.toFixed(3)}`,
        );
        setIdVerificationStatus("failed");
      }
    } catch (err: any) {
      console.error(err);
      setVerificationMessage(err.message || "An unexpected error occurred.");
      setIdVerificationStatus("failed");
    }
  };

  const { mutate: getTopicsFromJD, data: topicData } =
    api.interview.extractTopicsFromJD.useMutation({
      onSuccess: (data) => {
        console.log("Extracted Topics: ", data.topics);
        setJDTopics(data.topics);
      },
      onError: (error) => {
        console.error("Error extracting topics: ", error);
      },
    });

  const { mutate: getJDSummary, data: jdSummaryData } =
    api.interview.extractSummary.useMutation({
      onSuccess: (data) => {
        console.log("JD Summary: ", data.summary);
        setJDSummary(data.summary);
      },
      onError: (error) => {
        console.error("Error summarizing JD: ", error);
      },
    });

  const { mutate: getResumeSummary, data: resumeSummaryData } =
    api.interview.extractSummary.useMutation({
      onSuccess: (data) => {
        console.log("Resume Summary: ", data.summary);
        setResumeSummary(data.summary);
      },
      onError: (error) => {
        console.error("Error summarizing Resume: ", error);
      },
    });

  // Add this mutation
  const { mutate: updateViolation } = api.interview.updateViolation.useMutation(
    {
      onSuccess: () => {
        toast({
          variant: "destructive",
          title: "Interview Terminated",
          description:
            "You have violated the interview rules. You may retry after 2 hours.",
        });
        router.push(`/student/profile/${id as string}`);
      },
    },
  );

  // Add function to handle violations
  const handleViolation = useCallback(() => {
    setIsViolated(true);

    // Stop recording and cleanup
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
      pauseAudioRecording();
    }
    cleanupMediaStreams();

    // Update violation status in database
    // updateViolation({
    //   interviewId: interviewid as string,
    //   userId: id as string,
    //   sessionId: session as string,

    // });
  }, [cleanupMediaStreams, id, interviewid, session, updateViolation]);

  {
    interviewStatus === "recording" && !isAudioPlaying && timeRemaining > 0 && (
      <div className="absolute right-4 top-4 z-10 flex items-center space-x-2 rounded-full bg-gray-100/90 px-3 py-1.5">
        <div className="h-2 w-2 rounded-full bg-green-500"></div>
        <span className="text-sm font-medium text-gray-700">
          {timeRemaining}s remaining
        </span>
      </div>
    );
  }

  {
    interviewStatus === "recording" &&
      !isAudioPlaying &&
      timeRemaining === 0 && (
        <div className="animate-fade-in absolute right-4 top-4 z-10 rounded-full bg-blue-50 px-4 py-2">
          <span className="text-sm text-blue-600">
            You can continue answering or proceed to the next question
          </span>
        </div>
      );
  }

  useEffect(() => {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    setFormattedTime(
      `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`,
    );
  }, [timeLeft]);

  // Add this useEffect for the interview timer
  useEffect(() => {
    if (interviewStatus !== "waiting" && interviewStatus !== "initializing") {
      const timer = setInterval(() => {
        setTimeLeft((prevTime) => {
          if (prevTime <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prevTime - 1;
        });
      }, 1000);

      return () => {
        clearInterval(timer);
      };
    }
  }, [interviewStatus]);

  // Add this useEffect to format the time
  useEffect(() => {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    setFormattedTime(
      `${minutes.toString().padStart(2, "0")}:${seconds
        .toString()
        .padStart(2, "0")}`,
    );
  }, [timeLeft]);

  useEffect(() => {
    if (hasConsent && !isViolated) {
      // Request full screen
      const enterFullScreen = async () => {
        try {
          await document.documentElement.requestFullscreen();
        } catch (err) {
          console.error("Failed to enter full screen:", err);
        }
      };
      void enterFullScreen();

      // Monitor full screen changes
      const handleFullScreenChange = () => {
        if (!document.fullscreenElement && interviewStatus !== "waiting") {
          handleViolation();
        }
      };

      // Monitor tab/window visibility
      const handleVisibilityChange = () => {
        if (document.hidden && interviewStatus !== "waiting") {
          handleViolation();
        }
      };

      // Monitor keyboard shortcuts
      const handleKeyDown = (event: KeyboardEvent) => {
        if (
          (event.ctrlKey || event.altKey || event.key === "F11") &&
          interviewStatus !== "waiting"
        ) {
          event.preventDefault();
          handleViolation();
        }
      };

      // Prevent right-click
      const handleContextMenu = (e: Event) => {
        if (interviewStatus !== "waiting") {
          e.preventDefault();
        }
      };

      // Add event listeners
      document.addEventListener("fullscreenchange", handleFullScreenChange);
      document.addEventListener("visibilitychange", handleVisibilityChange);
      document.addEventListener("keydown", handleKeyDown);
      document.addEventListener("contextmenu", handleContextMenu);

      // Cleanup
      return () => {
        document.removeEventListener(
          "fullscreenchange",
          handleFullScreenChange,
        );
        document.removeEventListener(
          "visibilitychange",
          handleVisibilityChange,
        );
        document.removeEventListener("keydown", handleKeyDown);
        document.removeEventListener("contextmenu", handleContextMenu);
      };
    }
  }, [hasConsent, handleViolation, interviewStatus, isViolated]);

  if (isInterviewLoading || isUserLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mb-4 flex justify-center">
            <div className="relative h-16 w-16">
              <div className="absolute h-16 w-16 animate-spin rounded-full border-4 border-solid border-blue-400 border-t-transparent"></div>
              <div className="absolute h-16 w-16 animate-ping rounded-full border-4 border-solid border-blue-400 opacity-20"></div>
            </div>
          </div>
          <h2 className="text-xl font-semibold text-gray-700">
            Initializing Interview
          </h2>
          <p className="mt-2 text-sm text-gray-500">
            Please wait while we set up your session...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    toast({
      title: "Session Expired",
      description:
        "Your session has timed out. Please login again to continue.",
    });
    window.location.href = "/login";
  }

  return (
    <div className="flex h-screen items-center justify-center bg-[#f2f1f6] p-6">
      {!hasConsent ? (
        <div className="w-full max-w-6xl rounded-3xl bg-white p-4 shadow-lg md:p-6">
          {/* Top Section with Logo */}
          <div className="mb-4 grid grid-cols-1 gap-4 md:mb-6 md:grid-cols-2 md:gap-6">
            <div className="relative h-[120px] w-full overflow-hidden rounded-2xl bg-red-500 md:h-[200px]">
              <Image
                src="/assets/images/eq.png"
                alt="Virtual Interview Logo"
                fill
                className="m-0 h-full w-full object-cover p-0"
                priority
              />
            </div>
            <div className="flex flex-col justify-center text-center md:text-left">
              <h1 className="mb-1 text-lg font-bold md:text-2xl">
                Hey! its your
              </h1>
              <h2 className="mb-2 text-xl font-bold md:text-3xl">
                Virtual Interview
              </h2>
              <p className="text-xs text-gray-600 md:text-base">
                Welcome to the session!
              </p>
            </div>
          </div>

          {/* Bottom Section with Features */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
            <div className="relative flex h-[180px] w-full flex-col items-center justify-center overflow-hidden rounded-2xl bg-gray-100 md:h-[250px]">
              {/* Condition 1: Pending permission & no media stream yet - show original button with modified onClick */}
              {idVerificationStatus === "pending_permission" && !mediaStream ? (
                <button
                  onClick={async () => {
                    try {
                      // // Load profile picture as Base64
                      // if (interview?.profilePicture) {
                      //   try {
                      //     const response = await axios.get(interview.profilePicture, {
                      //       responseType: "arraybuffer",
                      //     });
                      //     const base64Image = Buffer.from(response.data, "binary").toString("base64");
                      //     setReferenceImageBase64(`data:image/jpeg;base64,${base64Image}`);
                      //     console.log(base64Image);
                      //   } catch (imgErr) {
                      //     console.error("Failed to load profile picture", imgErr);
                      //     toast({
                      //       title: "Image Load Failed",
                      //       description: "Could not load candidate's profile picture for verification.",
                      //       variant: "destructive",
                      //     });
                      //   }
                      // }
                      // Function to call parse-pdf
                      void Promise.all([
                        parsePDF(userResume),
                        parsePDF(JD),
                      ]).then(([text1, text2]) => {
                        if (text1) {
                          console.log("text1 : ", text1);
                          setResumeText(text1);
                          getResumeSummary({ parsed_text: text1 });
                        }
                        if (text2) {
                          console.log("text2 : ", text2);
                          setJD_text(text2);
                          getTopicsFromJD({ JD_text: text2 });
                          getJDSummary({ parsed_text: text2 });
                        }
                      });
                      if (!navigator.mediaDevices?.getUserMedia) {
                        toast({
                          variant: "destructive",
                          title: "Device Not Supported",
                          description:
                            "Your browser doesn't support camera and microphone access",
                          duration: 2000,
                        });
                        return;
                      }
                      const constraints = {
                        video: true,
                        audio: {
                          echoCancellation: true,
                          noiseSuppression: true,
                        },
                      };
                      const stream =
                        await navigator.mediaDevices.getUserMedia(constraints);
                      if (
                        !stream.getVideoTracks().length ||
                        !stream.getAudioTracks().length
                      ) {
                        throw new Error("Missing camera or microphone access");
                      }
                      const AudioContextGlobal =
                        window.AudioContext || window.webkitAudioContext;
                      const audioContext = new AudioContextGlobal();
                      const destination =
                        audioContext.createMediaStreamDestination();
                      const source =
                        audioContext.createMediaStreamSource(stream);
                      source.connect(destination);
                      audioContextRef.current = audioContext;
                      audioDestinationRef.current = destination;
                      mixedStreamRef.current = destination.stream;
                      setMediaStream(stream);
                      setIdVerificationStatus("prompt");

                      toast({
                        title: "Ready to Start",
                        description: "Camera and microphone are now active",
                        duration: 2000,
                      });
                    } catch (error) {
                      console.error("Media access error:", error);
                      const isIOS = /iPad|iPhone|iPod/.test(
                        navigator.userAgent,
                      );
                      const isAndroid = /android/i.test(navigator.userAgent);
                      if (isIOS) {
                        /* your existing iOS toast */
                      } else if (isAndroid) {
                        /* your existing Android toast */
                      } else {
                        /* your existing generic toast */
                      }
                      setIdVerificationStatus("pending_permission");
                    }
                  }}
                  className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-r from-blue-50 to-indigo-50 p-4 text-center transition-all duration-300 hover:from-blue-100 hover:to-indigo-100"
                >
                  <div className="mb-3 rounded-full bg-indigo-100 p-3">
                    <Video className="h-6 w-6 animate-pulse text-indigo-600" />
                  </div>
                  <span className="text-sm font-medium text-gray-700 md:text-base">
                    Tap to enable camera & microphone
                  </span>
                  <span className="mt-1 text-xs text-gray-500 md:text-sm">
                    Required to start interview & ID verification
                  </span>
                  {/iPad|iPhone|iPod/.test(navigator.userAgent) && (
                    <span className="mt-2 text-xs text-orange-500">
                      iOS users: Check Settings if permissions are blocked
                    </span>
                  )}
                  <div className="mt-3 animate-bounce">
                    <ChevronDown className="h-5 w-5 text-indigo-400" />
                  </div>
                </button>
              ) : mediaStream ? ( // Conditions for ID verification steps when mediaStream is available
                <>
                  {/* Video feed for ID check */}
                  {(idVerificationStatus === "prompt" ||
                    (idVerificationStatus === "failed" &&
                      idCheckVideoRef.current)) && (
                    <video
                      ref={idCheckVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="h-full w-full object-cover"
                    />
                  )}

                  {idVerificationStatus === "prompt" && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center space-y-3 bg-black/60 p-4 text-center backdrop-blur-sm">
                      <p className="text-sm font-medium text-white md:text-base">
                        Hold your government-issued ID (e.g., Aadhaar) in front
                        of the camera.
                      </p>
                      <button
                        onClick={handleCaptureAndVerify}
                        className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50"
                      >
                        Capture & Verify ID
                      </button>
                    </div>
                  )}

                  {(idVerificationStatus === "capturing" ||
                    idVerificationStatus === "verifying") && (
                    <div className="flex h-full w-full flex-col items-center justify-center bg-gray-800 p-4 text-white">
                      {idVerificationStatus === "verifying" &&
                        idFaceCompositeImage && (
                          <Image
                            src={idFaceCompositeImage}
                            alt="Captured Face"
                            width={160}
                            height={120}
                            className="mb-3 rounded-lg border-2 border-indigo-400 object-contain"
                          />
                        )}
                      <div className="flex items-center space-x-2">
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                        <span className="text-sm font-medium">
                          {idVerificationStatus === "capturing"
                            ? "Capturing Image..."
                            : "Verifying Image... Please Wait"}
                        </span>
                      </div>
                      {idVerificationStatus === "verifying" &&
                        verificationMessage && (
                          <p className="mt-2 text-xs text-indigo-300">
                            {verificationMessage}
                          </p>
                        )}
                    </div>
                  )}

                  {idVerificationStatus === "success" && (
                    <div className="flex h-full w-full flex-col items-center justify-center space-y-2 bg-green-50 p-4 text-center">
                      {idFaceCompositeImage && (
                        <Image
                          src={idFaceCompositeImage}
                          alt="Successful Verification"
                          width={160}
                          height={120}
                          className="mb-2 rounded-lg border-2 border-green-400 object-contain"
                        />
                      )}
                      <CheckCircle className="h-10 w-10 text-green-500 md:h-12 md:w-12" />{" "}
                      {/* Ensure CheckCircle icon imported */}
                      <p className="text-base font-semibold text-green-700 md:text-lg">
                        Image Verification Successful!
                      </p>
                      {verificationMessage && (
                        <p className="text-xs text-green-600">
                          {verificationMessage}
                        </p>
                      )}
                      <p className="text-xs text-gray-600">
                        You can now proceed with other checks.
                      </p>
                    </div>
                  )}

                  {idVerificationStatus === "failed" &&
                    (idCheckVideoRef.current &&
                    idCheckVideoRef.current.srcObject === mediaStream ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center space-y-3 bg-black/60 p-4 text-center backdrop-blur-sm">
                        {idFaceCompositeImage && (
                          <Image
                            src={idFaceCompositeImage}
                            alt="Last Failed Attempt"
                            width={120}
                            height={90}
                            className="mb-2 rounded-lg border border-red-300 object-contain opacity-75"
                          />
                        )}
                        <p className="text-sm font-medium text-white md:text-base">
                          Verification Failed. Please try again.
                        </p>
                        {verificationMessage && (
                          <p className="mb-2 text-xs text-red-200">
                            {verificationMessage}
                          </p>
                        )}
                        <p className="text-xs text-indigo-200">
                          Hold your face towards the camera and ensure good
                          lighting.
                        </p>
                        <button
                          onClick={handleCaptureAndVerify}
                          className="mt-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50"
                        >
                          Recapture & Verify Face
                        </button>
                      </div>
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center space-y-3 bg-red-50 p-4 text-center">
                        {idFaceCompositeImage && (
                          <Image
                            src={idFaceCompositeImage}
                            alt="Failed Verification Attempt"
                            width={160}
                            height={120}
                            className="mb-2 rounded-lg border-2 border-red-400 object-contain"
                          />
                        )}
                        <AlertTriangle className="h-10 w-10 text-red-500 md:h-12 md:w-12" />{" "}
                        {/* Ensure AlertTriangle icon imported */}
                        <p className="text-base font-semibold text-red-700 md:text-lg">
                          ID Verification Failed
                        </p>
                        {verificationMessage && (
                          <p className="mb-3 text-xs text-red-600">
                            {verificationMessage}
                          </p>
                        )}
                        <button
                          onClick={async () => {
                            if (mediaStream) {
                              mediaStream
                                .getTracks()
                                .forEach((track) => track.stop());
                            }
                            const stream =
                              await navigator.mediaDevices.getUserMedia({
                                video: true,
                                audio: true,
                              });
                            setMediaStream(stream); // This re-triggers the useEffect binding
                            setIdFaceCompositeImage(null);
                            setVerificationMessage(null);
                            setIdVerificationStatus("prompt");
                          }}
                          className="rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50"
                        >
                          Retry Verification
                        </button>
                      </div>
                    ))}
                </>
              ) : (
                // Fallback if somehow idVerificationStatus is not 'pending_permission' but mediaStream is null
                <div className="flex h-full items-center justify-center">
                  <p className="text-xs text-gray-500">
                    Please enable camera and microphone.
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-col justify-between space-y-3">
              <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                {/* Profile Section */}
                <div className="mb-2 flex flex-col space-y-2 border-b border-gray-200 pb-2 md:flex-row md:items-center md:justify-between md:space-y-0">
                  <div className="flex items-center space-x-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 md:h-8 md:w-8">
                      <UserCircle className="h-4 w-4 text-indigo-600 md:h-5 md:w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500">Name</p>
                      <p className="text-xs font-semibold text-gray-800">
                        {interview?.fullName}
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500">
                      Specialization
                    </p>
                    <p className="text-xs font-semibold text-gray-800">
                      {interview?.primarySpecialization}
                    </p>
                  </div>
                </div>

                {/* Instructions Section */}
                <div>
                  <h3 className="mb-2 flex items-center text-xs font-semibold text-gray-800">
                    <ClipboardList className="mr-1 h-3 w-3 text-indigo-600 md:h-4 md:w-4" />
                    Important Instructions
                  </h3>
                  <div className="space-y-1.5">
                    <div className="flex items-center space-x-2 rounded-md py-0.5">
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-50 md:h-6 md:w-6">
                        <Wifi className="h-3 w-3 text-indigo-600" />
                      </div>
                      <span className="text-[10px] text-gray-700 md:text-xs">
                        Ensure you are connected to a high-speed network
                      </span>
                    </div>
                    <div className="flex items-center space-x-2 rounded-md py-0.5">
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-50 md:h-6 md:w-6">
                        <Battery className="h-3 w-3 text-indigo-600" />
                      </div>
                      <span className="text-[10px] text-gray-700 md:text-xs">
                        Verify that your system is fully charged
                      </span>
                    </div>
                    <div className="flex items-center space-x-2 rounded-md py-0.5">
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-50 md:h-6 md:w-6">
                        <Video className="h-3 w-3 text-indigo-600" />
                      </div>
                      <span className="text-[10px] text-gray-700 md:text-xs">
                        Confirm camera and microphone access
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 border-t border-gray-200 pt-3">
                  <h3 className="mb-2 flex items-center text-xs font-semibold text-gray-800">
                    <Mic className="mr-1 h-3 w-3 text-indigo-600 md:h-4 md:w-4" />
                    Microphone Test
                  </h3>
                  <div className="space-y-3">
                    {/* Test sentence */}
                    <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                      <p className="text-xs text-gray-600">
                        Please read this sentence:
                      </p>
                      <p className="mt-1 text-sm font-medium text-gray-800">
                        &quot;I am ready for my virtual interview today.&quot;
                      </p>
                    </div>

                    {/* Recording status and controls */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {(isTestingMic || !hasMicrophoneTested) && (
                          <button
                            onClick={async () => {
                              if (!mediaStream) {
                                toast({
                                  title: "Microphone Not Accessible",
                                  description:
                                    "Please allow microphone access before recording.",
                                  variant: "destructive",
                                  duration: 2000,
                                });
                                return;
                              }

                              if (isTestingMic) {
                                // Stop recording
                                if (mediaRecorderRef.current) {
                                  mediaRecorderRef.current.stop();
                                  setIsTestingMic(false);
                                  setMicrophonePlayback("playing");
                                }
                              } else {
                                // Start recording
                                try {
                                  const audioChunks: Blob[] = [];
                                  const mediaRecorder = new MediaRecorder(
                                    mediaStream,
                                  );
                                  mediaRecorderRef.current = mediaRecorder;

                                  // Set up audio analysis
                                  const audioContext = new AudioContext();
                                  const source =
                                    audioContext.createMediaStreamSource(
                                      mediaStream,
                                    );
                                  const processor =
                                    audioContext.createScriptProcessor(
                                      2048,
                                      1,
                                      1,
                                    );
                                  source.connect(processor);
                                  processor.connect(audioContext.destination);

                                  let hasDetectedSound = false;

                                  // Audio processing event handler
                                  processor.onaudioprocess = (e) => {
                                    const inputData =
                                      e.inputBuffer.getChannelData(0);
                                    const inputDataLength = inputData.length;
                                    let total = 0;

                                    // Calculate average volume
                                    for (let i = 0; i < inputDataLength; i++) {
                                      total += Math.abs(inputData[i] ?? 0); // Add fallback for undefined
                                    }
                                    const average = total / inputDataLength;

                                    if (average > 0.01) {
                                      // Adjust threshold as needed
                                      hasDetectedSound = true;
                                      console.log("Sound detected!", average);
                                    }
                                  };

                                  mediaRecorder.ondataavailable = (event) => {
                                    audioChunks.push(event.data);
                                  };

                                  mediaRecorder.onstop = () => {
                                    // Cleanup
                                    processor.disconnect();
                                    source.disconnect();
                                    void audioContext.close();

                                    const audioBlob = new Blob(audioChunks, {
                                      type: "audio/mpeg",
                                    });
                                    const audioUrl =
                                      URL.createObjectURL(audioBlob);
                                    const audio = new Audio(audioUrl);
                                    audio.onended = () => {
                                      setMicrophonePlayback("none");
                                      if (hasDetectedSound) {
                                        setHasMicrophoneTested(true);
                                      } else {
                                        toast({
                                          title: "No Audio Detected",
                                          description:
                                            "Please speak the test sentence out loud when recording.",
                                          variant: "destructive",
                                          duration: 2000,
                                        });
                                      }
                                    };
                                    void audio.play();
                                  };

                                  // Start recording
                                  mediaRecorder.start();
                                  setIsTestingMic(true);
                                  setMicrophonePlayback("recording");
                                } catch (error) {
                                  console.error(
                                    "Error testing microphone:",
                                    error,
                                  );
                                  toast({
                                    title: "Microphone Error",
                                    description:
                                      "Failed to test microphone. Please check permissions.",
                                    variant: "destructive",
                                    duration: 2000,
                                  });
                                }
                              }
                            }}
                            className={`flex items-center space-x-2 rounded-md px-3 py-2 text-xs font-medium transition-all ${
                              isTestingMic
                                ? "bg-red-100 text-red-600 hover:bg-red-200"
                                : "bg-indigo-100 text-indigo-600 hover:bg-indigo-200"
                            }`}
                          >
                            {isTestingMic ? (
                              <>
                                <Square className="h-3 w-3" />
                                <span>
                                  Click to Stop Recording and Play Back Your
                                  Test
                                </span>
                              </>
                            ) : (
                              <>
                                <Circle className="h-3 w-3" />
                                <span>Start Recording</span>
                              </>
                            )}
                          </button>
                        )}

                        {/* Recording status indicator */}
                        <div className="flex items-center space-x-2">
                          {microphonePlayback === "recording" && (
                            <span className="flex items-center text-xs text-red-600">
                              <span className="mr-2 h-2 w-2 animate-pulse rounded-full bg-red-600" />
                              Recording...
                            </span>
                          )}
                          {microphonePlayback === "playing" && (
                            <span className="flex items-center text-xs text-indigo-600">
                              <span className="mr-2 h-2 w-2 animate-pulse rounded-full bg-indigo-600" />
                              Playing back...
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Microphone test status */}
                      {hasMicrophoneTested && (
                        <div className="flex items-center text-xs text-green-600">
                          <Check className="mr-1 h-4 w-4" />
                          Test completed
                        </div>
                      )}
                    </div>

                    {/* Instructions */}
                    <p className="text-xs text-gray-500">
                      {!hasMicrophoneTested
                        ? "Please test your microphone before proceeding"
                        : "Great! Your microphone is working properly"}
                    </p>
                  </div>
                </div>

                <div className="mt-3 border-t border-gray-200 pt-3">
                  <h3 className="mb-2 flex items-center text-xs font-semibold text-gray-800">
                    <Wifi className="mr-1 h-3 w-3 text-indigo-600 md:h-4 md:w-4" />
                    Network Speed Test
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 p-3">
                      <div className="flex items-center space-x-2">
                        <div
                          className={`h-2 w-2 rounded-full ${
                            networkSpeed === "checking"
                              ? "animate-pulse bg-yellow-500"
                              : networkSpeed === "good"
                                ? "bg-green-500"
                                : networkSpeed === "moderate"
                                  ? "bg-yellow-500"
                                  : networkSpeed === "poor"
                                    ? "bg-red-500"
                                    : "bg-gray-300"
                          }`}
                        />
                        <span className="text-xs text-gray-600">
                          {networkSpeed === "checking"
                            ? "Checking speed..."
                            : networkSpeed === "good"
                              ? "Good connection"
                              : networkSpeed === "moderate"
                                ? "Moderate connection"
                                : networkSpeed === "poor"
                                  ? "Poor connection"
                                  : "Click to test connection"}
                        </span>
                      </div>
                      <button
                        onClick={checkNetworkSpeed}
                        disabled={networkSpeed === "checking"}
                        className={`rounded-md px-3 py-1 text-xs font-medium ${
                          networkSpeed === "checking"
                            ? "bg-gray-100 text-gray-400"
                            : "bg-indigo-100 text-indigo-600 hover:bg-indigo-200"
                        }`}
                      >
                        {networkSpeed === "checking"
                          ? "Testing..."
                          : "Test Speed"}
                      </button>
                    </div>

                    {networkSpeed === "poor" && (
                      <div className="rounded-md bg-red-50 p-3">
                        <div className="flex">
                          <AlertCircle className="h-4 w-4 text-red-400" />
                          <div className="ml-2">
                            <p className="text-xs font-medium text-red-800">
                              Your internet connection might be too slow
                            </p>
                            <p className="mt-1 text-xs text-red-600">
                              We recommend:
                              <ul className="ml-4 mt-1 list-disc">
                                <li>Connect to a stable WiFi network</li>
                                <li>Move closer to your router</li>
                                <li>
                                  Close other bandwidth-heavy applications
                                </li>
                              </ul>
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center space-x-2 rounded-lg border border-gray-100 bg-gray-50 p-2">
                  <input
                    type="checkbox"
                    id="consent-checkbox"
                    className="h-3 w-3 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    onChange={(e) => setHasReadInstructions(e.target.checked)}
                  />
                  <div className="flex-1">
                    <label
                      htmlFor="consent-checkbox"
                      className="text-[10px] font-medium text-gray-700 md:text-xs"
                    >
                      I have read and agree to the interview instructions
                    </label>
                    <button
                      onClick={() => setShowInstructions(true)}
                      className="ml-1 text-[10px] font-medium text-indigo-600 hover:text-indigo-700 md:text-xs"
                    >
                      (Read Instructions)
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (!hasMicrophoneTested) {
                      toast({
                        title: "Microphone Test Required",
                        description:
                          "Please test your microphone before proceeding.",
                        variant: "destructive",
                        duration: 2000,
                      });
                      return;
                    }
                    if (!hasReadInstructions) {
                      toast({
                        title: "Instructions Required",
                        description:
                          "Please read and agree to the instructions before proceeding.",
                        variant: "destructive",
                        duration: 2000,
                      });
                      return;
                    }
                    if (networkSpeed !== "good") {
                      toast({
                        title: "Network Speed Check Required",
                        description:
                          "Please ensure you have a good internet connection before proceeding.",
                        variant: "destructive",
                        duration: 2000,
                      });
                      return;
                    }
                    setHasConsent(true);
                  }}
                  // disabled={
                  //   !hasReadInstructions ||
                  //   !hasMicrophoneTested ||
                  //   networkSpeed !== "good"
                  // }
                  className={`w-full rounded-full px-3 py-1.5 text-xs font-medium text-white transition-all md:px-4 md:py-2 md:text-sm ${
                    // hasReadInstructions
                    // &&
                    // hasMicrophoneTested &&
                    // networkSpeed === "good" &&
                    mediaStream
                      ? "bg-indigo-600 hover:bg-indigo-700"
                      : "cursor-not-allowed bg-gray-400"
                  }`}
                >
                  Let&apos;s get started!
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        // Existing interview UI
        <div className="interview-container w-full max-w-7xl rounded-2xl bg-white p-8 shadow-sm">
          {/* Timer Bar */}
          <div className="mb-6 flex items-center justify-between rounded-lg bg-gray-50 p-3">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div
                  className={`h-2 w-2 rounded-full ${isRecording ? "animate-pulse bg-red-500" : "bg-green-500"}`}
                ></div>
                <span className="text-sm font-medium text-gray-700">
                  Time Remaining: {formattedTime}
                </span>
              </div>
              <div className="h-4 w-px bg-gray-300"></div>
              <span className="text-sm text-gray-600">
                Question {questionCount}
              </span>
            </div>
            {interviewStatus === "waiting" && (
              <button
                onClick={handleInterviewStart}
                className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Start Interview
              </button>
            )}
          </div>

          <div className="grid h-[600px] grid-cols-[1fr,1.2fr] gap-8">
            {/* Left Column - Interviewer & Question - Static height container */}
            <div className="relative flex h-full flex-col rounded-2xl bg-[#eff0fd] p-4">
              {/* Interviewer Interface */}
              <div className="overflow-hidden rounded-2xl border-2 border-blue-200/30 bg-black shadow-lg">
                <div className="relative h-[220px] w-full overflow-hidden bg-[#111]">
                  <div className="relative h-full w-full">
                    <Image
                      src="/assets/images/eq.png"
                      alt="EQ Animated Logo"
                      fill
                      className={`h-full w-full object-cover ${
                        isAudioPlaying ? "animate-fast-pulse" : ""
                      }`}
                    />
                  </div>

                  {/* Processing States */}
                  {isSpeechProcessing && (
                    <div className="absolute bottom-4 left-0 right-0 text-center">
                      <div className="flex items-center justify-center space-x-2">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-400 border-t-transparent"></div>
                        <span className="text-sm text-blue-400">
                          Processing your response...
                        </span>
                      </div>
                    </div>
                  )}

                  {isLoadingNextQuestion && (
                    <div className="absolute bottom-4 left-0 right-0 text-center">
                      <div className="flex items-center justify-center space-x-2">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-purple-400 border-t-transparent"></div>
                        <span className="text-sm text-purple-400">
                          Preparing next question...
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Question Display */}
              <div className="mt-6 flex-1 rounded-xl bg-white/80 p-6 shadow-sm">
                <div className="mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Interview Question
                  </h2>
                  <div className="mt-1 text-sm text-gray-500">
                    Please listen carefully and respond naturally to the
                    question...
                  </div>
                </div>

                {isLoadingNextQuestion ? (
                  <div className="flex flex-col items-center space-y-4 py-4">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-400 border-t-transparent"></div>
                    <p className="text-sm text-gray-600">
                      Getting your interview question...
                    </p>
                  </div>
                ) : showQuestion ? (
                  <p className="text-base text-gray-800">{currentQuestion}</p>
                ) : null}
              </div>
            </div>

            {/* Right Column - User Video - Static height container */}
            <div className="relative flex h-full flex-col">
              <div className="relative flex-1 overflow-hidden rounded-2xl bg-gray-100">
                {/* Timer Display */}
                {interviewStatus === "recording" &&
                  !isAudioPlaying &&
                  timeRemaining > 0 && (
                    <div className="absolute right-4 top-4 z-10 flex items-center space-x-2 rounded-full bg-gray-100/90 px-3 py-1.5">
                      <div className="h-2 w-2 rounded-full bg-green-500"></div>
                      <span className="text-sm font-medium text-gray-700">
                        {timeRemaining}s remaining
                      </span>
                    </div>
                  )}

                {/* Time's Up Notification */}
                {interviewStatus === "recording" &&
                  !isAudioPlaying &&
                  timeRemaining === 0 && (
                    <div className="animate-fade-in absolute right-4 top-4 z-10 rounded-full bg-blue-50 px-4 py-2">
                      <span className="text-sm text-blue-600">
                        You can continue answering or proceed to the next
                        question
                      </span>
                    </div>
                  )}

                {/* User Video */}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="h-full w-full object-cover"
                />

                {/* Proctoring Video (always mounted) */}
                <video
                  ref={idCheckVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`h-full w-full object-cover ${
                    idVerificationStatus === "prompt" ||
                    idVerificationStatus === "failed"
                      ? "block"
                      : "hidden"
                  }`}
                />

                {/* For lip syncing */}
                <video
                  id="webcam"
                  autoPlay
                  playsInline
                  muted
                  width={320}
                  height={240}
                  style={{ display: "none" }}
                />

                {/* Status Indicators - Inside video container */}
                <div className="absolute bottom-4 left-0 right-0 flex items-center justify-between px-4">
                  {/* Recording Indicator */}
                  {interviewStatus === "recording" && (
                    <div className="flex items-center space-x-2 rounded-full bg-black/30 px-3 py-1.5 backdrop-blur-sm">
                      <div className="h-2 w-2 animate-pulse rounded-full bg-red-500"></div>
                      <span className="text-sm font-medium text-white">
                        Recording...
                      </span>
                    </div>
                  )}

                  {/* Speaking Indicator */}
                  {isUserSpeaking && (
                    <div className="flex items-center space-x-2 rounded-full bg-black/30 px-3 py-1.5 backdrop-blur-sm">
                      <div className="h-2 w-2 animate-pulse rounded-full bg-green-500"></div>
                      <span className="text-sm font-medium text-white">
                        Speaking
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex w-full justify-end">
            <div className="">
              {interviewStatus === "recording" &&
                timeRemaining === 0 &&
                !nextClicked && (
                  <button
                    onClick={handleNextQuestion}
                    className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:bg-indigo-400"
                  >
                    Next Question
                  </button>
                )}
            </div>
          </div>
        </div>
      )}

      {/* Loading overlay during completion processing */}
      {isCompletionProcessing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="rounded-lg bg-white p-8 text-center">
            <div className="mb-4 flex justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
            </div>
            <h3 className="text-lg font-medium text-gray-900">
              Completing Interview
            </h3>
            <p className="mt-2 text-sm text-gray-500">
              Please wait while we process your interview...
            </p>
          </div>
        </div>
      )}

      {/* Completion modal */}
      {showCompletionModal && recordedBlob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-8 text-center shadow-xl transition-all">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <svg
                className="h-8 w-8 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h3 className="mb-4 text-2xl font-bold text-gray-900">
              Interview Successfully Completed!
            </h3>
            <p className="mb-8 text-gray-600">
              Thank you for participating in this interview. Your responses have
              been recorded. Please submit your responses to complete the
              process.
            </p>
            <div className="flex space-x-4">
              {}
              <button
                onClick={handleSubmitInterview}
                disabled={uploading}
                className="flex-1 rounded-lg bg-gradient-to-r from-green-500 to-green-600 px-6 py-3 text-white transition-all hover:from-green-600 hover:to-green-700 hover:shadow-lg disabled:from-green-300 disabled:to-green-400"
              >
                {uploading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Uploading...
                  </span>
                ) : (
                  "Submit Interview"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <InstructionDialog
        open={showInstructions}
        onOpenChange={setShowInstructions}
      />
    </div>
  );
};

export default InterviewPage;
