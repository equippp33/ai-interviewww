// "use client";

// declare global {
//   interface MediaRecorderErrorEvent extends Event {
//     error: Error;
//   }
// }

// import { api } from "@/trpc/react";
// import { useParams, useRouter } from "next/navigation";
// import useInterviewUpload from "@/hooks/useInterviewUpload";
// import { useEffect, useRef, useState, useCallback } from "react";
// import Image from "next/image";

// import { useToast } from "@/components/ui/use-toast";
// import Link from "next/link";
// import InstructionDialog from "@/app/interview/components/instruction";

// declare global {
//   interface Window {
//     webkitAudioContext: typeof AudioContext;
//   }
// }

// type InterviewStatus =
//   | "waiting"
//   | "initializing"
//   | "playing-question"
//   | "recording"
//   | "completed";

// // Add interface for the audio response
// interface AudioResponse {
//   audio: string;
//   // Add other properties if they exist in the response
// }

// // Add the ProcessStreamResponse type
// interface ProcessStreamResponse {
//   isComplete: boolean;
//   nextQuestion: string;
//   shouldContinueRecording: boolean;
//   transcript: string;
//   questionCount: number;
//   audio?: string;
// }

// // Update the timer constants
// const INTERVIEW_DURATION = 15 * 60; // 15 minutes in seconds

// const InterviewPage = () => {
//   const { interviewid, id, session } = useParams();
//   const { toast } = useToast();
//   const router = useRouter();
//   // Add a new loading state
//   const [isLoadingNextQuestion, setIsLoadingNextQuestion] = useState(false);
//   const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
//   const [isMonitoringAudio, setIsMonitoringAudio] = useState(false);
//   const [error, setError] = useState<string>("");
//   const [isRecording, setIsRecording] = useState(false);
//   const [interviewStatus, setInterviewStatus] =
//     useState<InterviewStatus>("waiting");
//   const [isUserSpeaking, setIsUserSpeaking] = useState(false);
//   const compressorRef = useRef<DynamicsCompressorNode | null>(null);
//   const filterRef = useRef<BiquadFilterNode | null>(null);
//   const chunksRef = useRef<BlobPart[]>([]);
//   const [showQuestion, setShowQuestion] = useState(false);
//   const [isAudioPlaying, setIsAudioPlaying] = useState(false);
//   const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
//   const [hasConsent, setHasConsent] = useState(false);
//   const [silenceStartTime, setSilenceStartTime] = useState<number | null>(null);

//   const [timeLeft, setTimeLeft] = useState(INTERVIEW_DURATION);
//   const [formattedTime, setFormattedTime] = useState("15:00");
//   const [isCompletionProcessing, setIsCompletionProcessing] = useState(false);
//   const [showCompletionModal, setShowCompletionModal] = useState(false);

//   // Add these new states near your other state declarations
//   const [canProceedToNext, setCanProceedToNext] = useState(false);
//   const [timeRemaining, setTimeRemaining] = useState(20);
//   const timerRef = useRef<NodeJS.Timeout | null>(null);
//   const interviewTimerRef = useRef<NodeJS.Timeout | null>(null);
//   const analyserRef = useRef<AnalyserNode | null>(null);
//   const videoRef = useRef<HTMLVideoElement>(null);
//   if (videoRef.current) {
//     videoRef.current.muted = true;
//   }
//   const recorderRef = useRef<MediaRecorder | null>(null);
//   const audioContextRef = useRef<AudioContext | null>(null);
//   const audioElementRef = useRef<HTMLAudioElement | null>(null);
//   const audioStreamRef = useRef<MediaStream | null>(null);
//   const audioDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(
//     null,
//   );
//   const mixedStreamRef = useRef<MediaStream | null>(null);
//   const [isSpeechProcessing, setIsSpeechProcessing] = useState(false);
//   const [questionCount, setQuestionCount] = useState(0);
//   const speechTimeoutRef = useRef<NodeJS.Timeout | null>(null);
//   const [currentQuestion, setCurrentQuestion] = useState<string>("");
//   const canvasRef = useRef<HTMLCanvasElement>(null);
//   const watermarkRef = useRef<HTMLImageElement | null>(null);
//   const [nextQuestionCache, setNextQuestionCache] = useState<{
//     question: string;
//     audio: string;
//   } | null>(null);

//   // Add new states for violation tracking
//   const [isViolated, setIsViolated] = useState(false);
//   const violationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

//   const [showInstructions, setShowInstructions] = useState(false);

//   const [hasReadInstructions, setHasReadInstructions] = useState(false);

//   const { data: user, isLoading: isUserLoading } = api.user.getUser.useQuery();

//   const { data: interview, isLoading: isInterviewLoading } =
//     api.interview.getInterview.useQuery({
//       interviewId: interviewid as string,
//       id: id as string,
//     });

//   // Single consolidated effect for media handling
//   useEffect(() => {
//     if (hasConsent) {
//       console.log("Consent granted, setting up media...");

//       const setupMedia = async () => {
//         try {
//           // Initialize audio context first
//           const AudioContext = window.AudioContext || window.webkitAudioContext;
//           audioContextRef.current = new AudioContext({
//             latencyHint: "interactive",
//             sampleRate: 48000,
//           });
//           console.log("Audio context initialized");

//           // Set up audio nodes
//           audioDestinationRef.current =
//             audioContextRef.current.createMediaStreamDestination();
//           analyserRef.current = audioContextRef.current.createAnalyser();
//           analyserRef.current.fftSize = 2048;
//           analyserRef.current.smoothingTimeConstant = 0.8;

//           // Set up media stream if not already exists
//           if (!mediaStream) {
//             const stream = await navigator.mediaDevices.getUserMedia({
//               video: {
//                 width: { ideal: 1280 },
//                 height: { ideal: 720 },
//                 frameRate: { ideal: 30 },
//                 facingMode: "user",
//               },
//               audio: {
//                 echoCancellation: true,
//                 noiseSuppression: true,
//                 autoGainControl: true,
//                 sampleRate: 48000,
//               },
//             });

//             console.log("Media stream obtained:", {
//               videoTracks: stream.getVideoTracks().length,
//               audioTracks: stream.getAudioTracks().length,
//             });

//             setMediaStream(stream);
//           }

//           // Connect audio nodes if media stream exists
//           if (mediaStream) {
//             const microphone =
//               audioContextRef.current.createMediaStreamSource(mediaStream);
//             const microphoneGain = audioContextRef.current.createGain();
//             microphoneGain.gain.value = 0.7;

//             // Connect microphone to analyzer and destination
//             microphone.connect(analyserRef.current);
//             microphone.connect(microphoneGain);
//             microphoneGain.connect(audioDestinationRef.current);

//             mixedStreamRef.current = audioDestinationRef.current.stream;

//             // Set up video
//             if (videoRef.current) {
//               console.log("Setting up video element");
//               videoRef.current.srcObject = mediaStream;
//               await videoRef.current.play();
//               console.log("Video playback started");
//             } else {
//               console.error("Video element ref not found");
//             }
//           }
//         } catch (err) {
//           console.error("Media setup error:", err);
//           setError(
//             `Failed to initialize media: ${err instanceof Error ? err.message : String(err)}`,
//           );
//         }
//       };

//       void setupMedia();

//       // Cleanup function
//       return () => {
//         console.log("Cleaning up media resources...");
//         if (mediaStream) {
//           mediaStream.getTracks().forEach((track) => {
//             track.stop();
//             console.log(`Stopped ${track.kind} track`);
//           });
//         }
//         if (audioContextRef.current) {
//           void audioContextRef.current.close();
//           console.log("Audio context closed");
//         }
//       };
//     }
//   }, [hasConsent, mediaStream]);

//   const startRecording = useCallback(() => {
//     if (!mediaStream) {
//       console.error("No media stream available");
//       setError("No media stream available");
//       return;
//     }

//     try {
//       console.log("Starting recording with mixed streams");

//       const canvas = document.createElement("canvas");
//       const ctx = canvas.getContext("2d");
//       canvas.width = 1280;
//       canvas.height = 720;

//       const watermark = document.createElement("img");
//       watermark.src = "/assets/images/eq.png";
//       watermarkRef.current = watermark;

//       // Create audio context and destination if not exists
//       if (!audioContextRef.current) {
//         const AudioContext = window.AudioContext || window.webkitAudioContext;
//         audioContextRef.current = new AudioContext();
//         audioDestinationRef.current =
//           audioContextRef.current.createMediaStreamDestination();
//       }

//       // Mix user's audio with the destination stream
//       const micSource =
//         audioContextRef.current.createMediaStreamSource(mediaStream);
//       if (audioDestinationRef.current) {
//         micSource.connect(audioDestinationRef.current);
//       }

//       // Create a new stream that includes both video and mixed audio
//       const videoTrack = mediaStream.getVideoTracks()[0];
//       const mixedStream = new MediaStream();
//       if (videoTrack) mixedStream.addTrack(videoTrack);
//       const audioTrack =
//         audioDestinationRef.current?.stream.getAudioTracks()[0];
//       if (audioTrack) {
//         mixedStream.addTrack(audioTrack);
//       }

//       if (!chunksRef.current) {
//         chunksRef.current = [];
//       }

//       const recorder = new MediaRecorder(mixedStream, {
//         mimeType: "video/webm;codecs=vp8,opus",
//         videoBitsPerSecond: 2500000,
//         audioBitsPerSecond: 128000,
//       });

//       // Rest of the recorder setup...
//       recorder.ondataavailable = (event) => {
//         if (event.data && event.data.size > 0) {
//           chunksRef.current.push(event.data);
//           console.log("Recorded chunk size:", event.data.size);
//         }
//       };

//       recorder.onstop = () => {
//         console.log(
//           "Recording stopped, total chunks:",
//           chunksRef.current.length,
//         );
//         const finalBlob = new Blob(chunksRef.current, { type: "video/webm" });
//         console.log("Final recording size:", finalBlob.size);
//         setRecordedBlob(finalBlob);
//         setInterviewStatus("completed");
//       };

//       recorder.start(1000);
//       console.log("MediaRecorder started:", recorder.state);
//       recorderRef.current = recorder;
//       setIsRecording(true);
//     } catch (err) {
//       console.error("Error starting recording:", err);
//       setError(
//         `Failed to start recording: ${err instanceof Error ? err.message : String(err)}`,
//       );
//     }
//   }, [mediaStream, setError]);

//   const playAudioFromBase64 = useCallback(
//     async (base64Audio: string, onEnded?: () => void) => {
//       console.log("Starting audio playback for question...");
//       setIsMonitoringAudio(false);

//       try {
//         // Clean up existing audio
//         if (audioElementRef.current) {
//           audioElementRef.current.pause();
//           audioElementRef.current.removeAttribute("src");
//           audioElementRef.current = null;
//         }

//         const audio = new Audio();
//         audioElementRef.current = audio;

//         // Create audio context if not exists
//         if (!audioContextRef.current) {
//           const AudioContext = window.AudioContext || window.webkitAudioContext;
//           audioContextRef.current = new AudioContext();
//         }

//         // Set up event listeners
//         audio.addEventListener("play", () => {
//           console.log("Audio started playing");

//           // Connect question audio to the recording stream
//           if (audioContextRef.current) {
//             const source =
//               audioContextRef.current.createMediaElementSource(audio);
//             const gainNode = audioContextRef.current.createGain();
//             gainNode.gain.value = 1.0; // Adjust volume as needed

//             source.connect(gainNode);
//             gainNode.connect(audioContextRef.current.destination);

//             // If we have a media stream destination, connect to it for recording
//             if (audioDestinationRef.current) {
//               gainNode.connect(audioDestinationRef.current);
//             }
//           }

//           setIsAudioPlaying(true);
//           setShowQuestion(true);
//         });

//         audio.addEventListener("ended", () => {
//           console.log("Audio playback completed");
//           setIsAudioPlaying(false);
//           onEnded?.();
//         });

//         // Create and play audio
//         const audioData = atob(base64Audio);
//         const arrayBuffer = new ArrayBuffer(audioData.length);
//         const view = new Uint8Array(arrayBuffer);
//         for (let i = 0; i < audioData.length; i++) {
//           view[i] = audioData.charCodeAt(i);
//         }

//         const blob = new Blob([arrayBuffer], { type: "audio/mpeg" });
//         const url = URL.createObjectURL(blob);

//         audio.src = url;
//         audio.load();
//         audio.volume = 1.0;

//         try {
//           await audio.play();
//           console.log("Audio playback started successfully");
//         } catch (playError) {
//           console.error("Play error:", playError);
//           throw playError;
//         }

//         return () => {
//           URL.revokeObjectURL(url);
//         };
//       } catch (err) {
//         console.error("Audio setup error:", err);
//         setError("Failed to play audio");
//         onEnded?.();
//       }
//     },
//     [],
//   );

//   const getAudioMutation = api.interview.getAudio.useMutation();

//   const handleInterviewStart = useCallback(async () => {
//     console.log("Starting interview...");
//     setInterviewStatus("initializing");

//     try {
//       // Ensure media stream is initialized
//       if (
//         !mediaStream?.getTracks().some((track) => track.readyState === "live")
//       ) {
//         const stream = await navigator.mediaDevices.getUserMedia({
//           video: true,
//           audio: true,
//         });
//         setMediaStream(stream);
//       }

//       setError("");
//       setShowQuestion(false);

//       // Generate initial greeting
//       const initialQuestion = `Hi ${interview?.fullName ?? ""}, welcome to the interview. Could you please introduce yourself and tell us about your background?`;

//       // Update the Promise wrapper with proper typing
//       const audioResponse = await new Promise<AudioResponse>(
//         (resolve, reject) => {
//           getAudioMutation.mutate(
//             {
//               text: initialQuestion,
//               fullName: interview?.fullName ?? "",
//             },
//             {
//               onSuccess: (data) => resolve(data as AudioResponse),
//               onError: (error) => reject(error),
//             },
//           );
//         },
//       );

//       if (audioResponse.audio) {
//         setCurrentQuestion(initialQuestion);
//         setShowQuestion(true);
//         startRecording();

//         void playAudioFromBase64(audioResponse.audio, () => {
//           console.log("Initial question completed");
//           setInterviewStatus("recording");
//           setQuestionCount(1);
//         });
//       } else {
//         throw new Error("Failed to get audio response");
//       }
//     } catch (err) {
//       console.error("Error starting interview:", err);
//       setError("Failed to start interview. Please try again.");
//       setInterviewStatus("waiting");
//     }
//   }, [
//     interview?.fullName,
//     startRecording,
//     getAudioMutation,
//     mediaStream,
//     playAudioFromBase64,
//   ]);

//   const { mutate: processSpeech } = api.interview.processStreamOld.useMutation({
//     onSuccess: async (response: ProcessStreamResponse) => {
//       console.log("Process speech response received");
//       setError("");
//       setIsSpeechProcessing(false);
//       setIsLoadingNextQuestion(false);

//       if (response.isComplete) {
//         console.log("Interview complete, stopping recording");
//         if (recorderRef.current) {
//           recorderRef.current.stop();
//         }
//         void handleInterviewCompletion();
//         return;
//       }

//       if (response.nextQuestion && response.audio) {
//         console.log("Current Question Updated:", response.nextQuestion);

//         // Continue recording, just play the next question
//         setCurrentQuestion(response.nextQuestion);
//         setQuestionCount(response.questionCount);

//         // Reset timer for next question
//         setTimeRemaining(20);
//         setCanProceedToNext(false);

//         // Play the next question
//         await playAudioFromBase64(response.audio, () => {
//           console.log("Question audio completed");
//           setInterviewStatus("recording");
//         });
//       }
//     },
//     onError: (error) => {
//       console.error("Speech processing error:", error);
//       setError("Failed to process response");
//       setIsSpeechProcessing(false);
//       setIsLoadingNextQuestion(false);
//       setInterviewStatus("recording");
//     },
//   });

//   // Add mutation for submitting interview
//   const { mutate: submitInterview } = api.interview.submitInterview.useMutation(
//     {
//       onSuccess: () => {
//         // Clean up all media streams
//         cleanupMediaStreams();
//         toast({
//           title: "Interview submitted successfully",
//           description: "Your interview has been recorded and submitted.",
//         });
//         router.push(`/student/profile/${id as string}`);
//       },
//       onError: (error) => {
//         toast({
//           title: "Failed to submit interview",
//           description: error.message,
//           variant: "destructive",
//         });
//       },
//     },
//   );

//   // Add helper function to cleanup media streams
//   const cleanupMediaStreams = useCallback(() => {
//     console.log("Cleaning up media streams...");

//     // Stop recording if still active
//     if (recorderRef.current && recorderRef.current.state !== "inactive") {
//       recorderRef.current.stop();
//       console.log("Stopped recorder");
//     }

//     // Only cleanup after ensuring recording is complete
//     if (recordedBlob) {
//       if (mediaStream) {
//         mediaStream.getTracks().forEach((track) => {
//           track.stop();
//           console.log(`Stopped ${track.kind} track`);
//         });
//         setMediaStream(null);
//       }

//       if (mixedStreamRef.current) {
//         mixedStreamRef.current.getTracks().forEach((track) => {
//           track.stop();
//           console.log(`Stopped mixed ${track.kind} track`);
//         });
//         mixedStreamRef.current = null;
//       }

//       if (audioContextRef.current) {
//         void audioContextRef.current.close();
//         audioContextRef.current = null;
//         console.log("Closed audio context");
//       }

//       if (videoRef.current) {
//         videoRef.current.srcObject = null;
//         console.log("Cleared video element");
//       }
//     }
//   }, [mediaStream, recordedBlob]);

//   // Add upload handler using useInterviewUpload
//   const { uploadInterview, uploading } = useInterviewUpload((url) => {
//     submitInterview({
//       interviewId: interviewid as string,
//       userId: id as string,
//       sessionId: session as string,
//       videoUrl: url,
//     });
//   });

//   // Update handleSubmitInterview to ensure cleanup happens before upload
//   const handleSubmitInterview = useCallback(() => {
//     if (recordedBlob) {
//       console.log("Submitting interview, blob size:", recordedBlob.size);

//       // Upload the interview recording
//       void uploadInterview(recordedBlob);

//       // Only clean up media streams AFTER successful upload
//       cleanupMediaStreams();
//     }
//   }, [recordedBlob, uploadInterview, cleanupMediaStreams]);

//   // Add new state for silence tracking

//   // Initialize audio analyzer when consent is given
//   useEffect(() => {
//     if (hasConsent && audioContextRef.current) {
//       try {
//         analyserRef.current = audioContextRef.current.createAnalyser();
//         analyserRef.current.fftSize = 2048;
//         analyserRef.current.smoothingTimeConstant = 0.8;

//         if (mediaStream) {
//           const microphone =
//             audioContextRef.current.createMediaStreamSource(mediaStream);
//           microphone.connect(analyserRef.current);
//         }
//       } catch (err) {
//         console.error("Failed to initialize audio analyzer:", err);
//       }
//     }
//   }, [hasConsent, mediaStream]);

//   // Add this state to track if we should be monitoring audio

//   // Update the checkAudioLevel function
//   const checkAudioLevel = useCallback(() => {
//     if (
//       !analyserRef.current ||
//       !mediaStream?.getAudioTracks()[0]?.enabled ||
//       isSpeechProcessing
//     ) {
//       return;
//     }

//     const dataArray = new Float32Array(analyserRef.current.frequencyBinCount);
//     analyserRef.current.getFloatTimeDomainData(dataArray);

//     let rms = 0;
//     for (const value of dataArray) {
//       rms += value * value;
//     }
//     rms = Math.sqrt(rms / dataArray.length);
//     const db = 20 * Math.log10(rms);

//     const isSpeaking = db > -45;
//     setIsUserSpeaking(isSpeaking);

//     // Only update speaking state, don't process automatically
//     if (isSpeaking) {
//       if (silenceStartTime) {
//         setSilenceStartTime(null);
//       }
//       hasSpokenRef.current = true;
//     } else if (!silenceStartTime && hasSpokenRef.current) {
//       setSilenceStartTime(Date.now());
//     }
//   }, [isSpeechProcessing, mediaStream, silenceStartTime]);

//   // Add ref to track if user has spoken
//   const hasSpokenRef = useRef(false);

//   // Update the processRecordedAudio function
//   const processRecordedAudio = useCallback(() => {
//     if (!chunksRef.current.length) {
//       setIsMonitoringAudio(true);
//       return;
//     }

//     const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
//     if (audioBlob.size < 1024) {
//       // If there's no significant audio data, send a flag indicating no response
//       processSpeech({
//         audio: "", // Empty audio
//         currentQuestion,
//         questionCount: questionCount + 1,
//         fullName: interview?.fullName ?? "",
//         primarySpecialization: interview?.primarySpecialization ?? "",
//         silenceDuration: 0,
//         isNoResponse: true, // Add this flag
//       });
//       return;
//     }

//     setIsSpeechProcessing(true);
//     setInterviewStatus("playing-question");

//     const reader = new FileReader();
//     reader.onloadend = () => {
//       if (typeof reader.result !== "string") {
//         console.error("Failed to read audio data");
//         setError("Failed to process audio");
//         setIsSpeechProcessing(false);
//         setIsMonitoringAudio(true);
//         return;
//       }

//       const base64Data = reader.result.split(",")[1];
//       if (!base64Data) {
//         console.error("Invalid audio data format");
//         setError("Invalid audio format");
//         setIsSpeechProcessing(false);
//         setIsMonitoringAudio(true);
//         return;
//       }

//       processSpeech({
//         audio: base64Data,
//         currentQuestion,
//         questionCount: questionCount + 1,
//         fullName: interview?.fullName ?? "",
//         primarySpecialization: interview?.primarySpecialization ?? "",
//         silenceDuration: 0,
//         isNoResponse: false, // Add this flag
//       });
//     };

//     reader.onerror = () => {
//       console.error("Error reading audio file");
//       setError("Failed to process audio");
//       setIsSpeechProcessing(false);
//       setIsMonitoringAudio(true);
//     };

//     reader.readAsDataURL(audioBlob);
//   }, [currentQuestion, questionCount, interview, processSpeech]);

//   // Update the monitoring effect
//   useEffect(() => {
//     let intervalId: NodeJS.Timeout | null = null;

//     if (
//       interviewStatus === "recording" &&
//       !isAudioPlaying &&
//       !isSpeechProcessing
//     ) {
//       setIsMonitoringAudio(true);
//       intervalId = setInterval(checkAudioLevel, 100);
//     } else {
//       setIsMonitoringAudio(false);
//     }

//     return () => {
//       if (intervalId) {
//         clearInterval(intervalId);
//       }
//       if (speechTimeoutRef.current) {
//         clearTimeout(speechTimeoutRef.current);
//         speechTimeoutRef.current = null;
//       }
//     };
//   }, [interviewStatus, checkAudioLevel, isAudioPlaying, isSpeechProcessing]);

//   // Add debug logging to track question flow
//   useEffect(() => {
//     console.log("Current Question Updated:", currentQuestion);
//   }, [currentQuestion]);

//   // Add this useEffect to handle the timer
//   useEffect(() => {
//     let timerId: NodeJS.Timeout | null = null;

//     if (
//       interviewStatus === "recording" &&
//       !isAudioPlaying &&
//       !isLoadingNextQuestion &&
//       timeRemaining > 0
//     ) {
//       console.log("Starting question timer:", timeRemaining);
//       timerId = setInterval(() => {
//         setTimeRemaining((prev) => {
//           const newTime = prev - 1;
//           if (newTime <= 0) {
//             setCanProceedToNext(true);
//             return 0;
//           }
//           return newTime;
//         });
//       }, 1000);
//     }

//     return () => {
//       if (timerId) {
//         clearInterval(timerId);
//       }
//     };
//   }, [interviewStatus, isAudioPlaying, isLoadingNextQuestion, timeRemaining]);

//   // Update handleNextQuestion to show loading state
//   const handleNextQuestion = useCallback(() => {
//     if (!canProceedToNext) return;

//     setIsLoadingNextQuestion(true);

//     if (nextQuestionCache) {
//       // Use cached question
//       setCurrentQuestion(nextQuestionCache.question);
//       setQuestionCount((prev) => prev + 1);
//       void playAudioFromBase64(nextQuestionCache.audio, () => {
//         setInterviewStatus("recording");
//       });
//       setNextQuestionCache(null); // Clear cache
//       setIsLoadingNextQuestion(false);
//     } else {
//       // Fallback to original logic if cache miss
//       // Your existing question processing logic
//     }
//   }, [canProceedToNext, nextQuestionCache, playAudioFromBase64]);

//   // Update the timer effect to only run when not loading and not playing audio
//   useEffect(() => {
//     let timerId: NodeJS.Timeout | null = null;

//     if (
//       interviewStatus === "recording" &&
//       !isAudioPlaying && // Don't count during audio playback
//       !isLoadingNextQuestion && // Don't count during loading
//       timeRemaining > 0
//     ) {
//       timerId = setInterval(() => {
//         setTimeRemaining((prev) => {
//           const newTime = prev - 1;
//           if (newTime <= 0) {
//             setCanProceedToNext(true);
//             return 0;
//           }
//           return newTime;
//         });
//       }, 1000);
//     }

//     return () => {
//       if (timerId) {
//         clearInterval(timerId);
//       }
//     };
//   }, [interviewStatus, isAudioPlaying, isLoadingNextQuestion, timeRemaining]);

//   // Reset timer when new question starts playing
//   useEffect(() => {
//     if (isAudioPlaying) {
//       setTimeRemaining(20);
//       setCanProceedToNext(false);
//     }
//   }, [isAudioPlaying]);

//   const handleInterviewCompletion = useCallback(async () => {
//     setIsCompletionProcessing(true);

//     try {
//       // Stop recording but DON'T stop media streams yet
//       if (recorderRef.current && recorderRef.current.state !== "inactive") {
//         recorderRef.current.stop();
//         console.log("Stopped recording");
//       }

//       // Show completion modal
//       setShowCompletionModal(true);
//     } catch (error) {
//       console.error("Error during completion:", error);
//       toast({
//         title: "Error",
//         description: "Failed to complete interview properly",
//         variant: "destructive",
//       });
//     } finally {
//       setIsCompletionProcessing(false);
//     }
//   }, []);

//   useEffect(() => {
//     if (timeLeft <= 1) {
//       void handleInterviewCompletion();
//       // Don't cleanup streams here
//     }
//   }, [timeLeft, handleInterviewCompletion]);

//   const { mutate: prefetchSpeech } = api.interview.processStreamOld.useMutation(
//     {
//       onSuccess: (response) => {
//         if (response.nextQuestion && response.audio) {
//           setNextQuestionCache({
//             question: response.nextQuestion,
//             audio: response.audio,
//           });
//         }
//       },
//       onError: (error) => {
//         console.error("Error prefetching next question:", error);
//       },
//     },
//   );

//   const prefetchNextQuestion = useCallback(() => {
//     // Create a small audio blob from current chunks to include context
//     if (chunksRef.current.length > 0) {
//       const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
//       const reader = new FileReader();

//       reader.onloadend = () => {
//         const base64Data = reader.result?.toString().split(",")[1];

//         if (base64Data) {
//           prefetchSpeech({
//             audio: base64Data,
//             currentQuestion,

//             questionCount,
//             fullName: interview?.fullName ?? "",
//             primarySpecialization: interview?.primarySpecialization ?? "",
//             isNoResponse: false,
//             silenceDuration: 0,
//           });
//         }
//       };

//       reader.readAsDataURL(audioBlob);
//     }
//   }, [currentQuestion, questionCount, interview, prefetchSpeech]);

//   // Add this mutation
//   const { mutate: updateViolation } = api.interview.updateViolation.useMutation(
//     {
//       onSuccess: () => {
//         toast({
//           variant: "destructive",
//           title: "Interview Terminated",
//           description:
//             "You have violated the interview rules. You may retry after 2 hours.",
//         });
//         router.push(`/student/profile/${id as string}`);
//       },
//     },
//   );

//   // Add function to handle violations
//   const handleViolation = useCallback(() => {
//     setIsViolated(true);

//     // Stop recording and cleanup
//     if (recorderRef.current && recorderRef.current.state !== "inactive") {
//       recorderRef.current.stop();
//     }
//     cleanupMediaStreams();

//     // Update violation status in database
//     updateViolation({
//       interviewId: interviewid as string,
//       userId: id as string,
//       sessionId: session as string,
//     });
//   }, [cleanupMediaStreams, id, interviewid, session, updateViolation]);

//   useEffect(() => {
//     if (
//       interviewStatus === "recording" &&
//       !isAudioPlaying &&
//       !isSpeechProcessing
//     ) {
//       void prefetchNextQuestion();
//     }
//   }, [
//     interviewStatus,
//     isAudioPlaying,
//     isSpeechProcessing,
//     prefetchNextQuestion,
//   ]);

//   {
//     interviewStatus === "recording" && !isAudioPlaying && timeRemaining > 0 && (
//       <div className="absolute right-4 top-4 z-10 flex items-center space-x-2 rounded-full bg-gray-100/90 px-3 py-1.5">
//         <div className="h-2 w-2 rounded-full bg-green-500"></div>
//         <span className="text-sm font-medium text-gray-700">
//           {timeRemaining}s remaining
//         </span>
//       </div>
//     );
//   }

//   {
//     interviewStatus === "recording" &&
//       !isAudioPlaying &&
//       timeRemaining === 0 && (
//         <div className="animate-fade-in absolute right-4 top-4 z-10 rounded-full bg-blue-50 px-4 py-2">
//           <span className="text-sm text-blue-600">
//             You can continue answering or proceed to the next question
//           </span>
//         </div>
//       );
//   }

//   useEffect(() => {
//     const minutes = Math.floor(timeLeft / 60);
//     const seconds = timeLeft % 60;
//     setFormattedTime(
//       `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`,
//     );
//   }, [timeLeft]);

//   // Add this useEffect for the interview timer
//   useEffect(() => {
//     if (interviewStatus !== "waiting" && interviewStatus !== "initializing") {
//       const timer = setInterval(() => {
//         setTimeLeft((prevTime) => {
//           if (prevTime <= 1) {
//             clearInterval(timer);
//             return 0;
//           }
//           return prevTime - 1;
//         });
//       }, 1000);

//       return () => {
//         clearInterval(timer);
//       };
//     }
//   }, [interviewStatus]);

//   // Add this useEffect to format the time
//   useEffect(() => {
//     const minutes = Math.floor(timeLeft / 60);
//     const seconds = timeLeft % 60;
//     setFormattedTime(
//       `${minutes.toString().padStart(2, "0")}:${seconds
//         .toString()
//         .padStart(2, "0")}`,
//     );
//   }, [timeLeft]);

//   useEffect(() => {
//     if (hasConsent && !isViolated) {
//       // Request full screen
//       const enterFullScreen = async () => {
//         try {
//           await document.documentElement.requestFullscreen();
//         } catch (err) {
//           console.error("Failed to enter full screen:", err);
//         }
//       };
//       void enterFullScreen();

//       // Monitor full screen changes
//       const handleFullScreenChange = () => {
//         if (!document.fullscreenElement && interviewStatus !== "waiting") {
//           handleViolation();
//         }
//       };

//       // Monitor tab/window visibility
//       const handleVisibilityChange = () => {
//         if (document.hidden && interviewStatus !== "waiting") {
//           handleViolation();
//         }
//       };

//       // Monitor keyboard shortcuts
//       const handleKeyDown = (event: KeyboardEvent) => {
//         if (
//           (event.ctrlKey || event.altKey || event.key === "F11") &&
//           interviewStatus !== "waiting"
//         ) {
//           event.preventDefault();
//           handleViolation();
//         }
//       };

//       // Prevent right-click
//       const handleContextMenu = (e: Event) => {
//         if (interviewStatus !== "waiting") {
//           e.preventDefault();
//         }
//       };

//       // Add event listeners
//       document.addEventListener("fullscreenchange", handleFullScreenChange);
//       document.addEventListener("visibilitychange", handleVisibilityChange);
//       document.addEventListener("keydown", handleKeyDown);
//       document.addEventListener("contextmenu", handleContextMenu);

//       // Cleanup
//       return () => {
//         document.removeEventListener(
//           "fullscreenchange",
//           handleFullScreenChange,
//         );
//         document.removeEventListener(
//           "visibilitychange",
//           handleVisibilityChange,
//         );
//         document.removeEventListener("keydown", handleKeyDown);
//         document.removeEventListener("contextmenu", handleContextMenu);
//       };
//     }
//   }, [hasConsent, handleViolation, interviewStatus, isViolated]);

//   if (isInterviewLoading || isUserLoading) {
//     return (
//       <div className="flex h-screen w-full items-center justify-center bg-gray-50">
//         <div className="text-center">
//           <div className="mb-4 flex justify-center">
//             <div className="relative h-16 w-16">
//               <div className="absolute h-16 w-16 animate-spin rounded-full border-4 border-solid border-blue-400 border-t-transparent"></div>
//               <div className="absolute h-16 w-16 animate-ping rounded-full border-4 border-solid border-blue-400 opacity-20"></div>
//             </div>
//           </div>
//           <h2 className="text-xl font-semibold text-gray-700">
//             Initializing Interview
//           </h2>
//           <p className="mt-2 text-sm text-gray-500">
//             Please wait while we set up your session...
//           </p>
//         </div>
//       </div>
//     );
//   }

//   if (!user) {
//     toast({
//       title: "Session Expired",
//       description:
//         "Your session has timed out. Please login again to continue.",
//     });
//     router.push("/login");
//   }

//   return (
//     <div className="flex h-screen items-center justify-center bg-[#f2f1f6] p-6">
//       {!hasConsent ? (
//         <div className="w-full max-w-6xl rounded-3xl bg-white p-8 shadow-lg">
//           {/* Top Section with Logo */}
//           <div className="mb-8 grid grid-cols-2 gap-8">
//             <div className="relative h-[300px] w-full overflow-hidden rounded-2xl bg-red-500">
//               <Image
//                 src="/assets/images/eq.png"
//                 alt="Virtual Interview Logo"
//                 fill
//                 className="m-0 h-full w-full object-cover p-0"
//                 priority
//               />
//             </div>
//             <div className="flex flex-col justify-center">
//               <h1 className="mb-2 text-3xl font-bold">Hey! its your</h1>
//               <h2 className="mb-4 text-4xl font-bold">Virtual Interview</h2>
//               <p className="text-lg text-gray-600">Welcome to the session!</p>
//             </div>
//           </div>

//           {/* Bottom Section with Features */}
//           <div className="grid grid-cols-2 gap-8">
//             <div className="relative h-[300px] w-full overflow-hidden rounded-2xl bg-gray-100">
//               {mediaStream ? (
//                 <div className="flex h-full items-center justify-center">
//                   <Image
//                     src={
//                       interview?.profilePicture ?? "/assets/images/profile.png"
//                     }
//                     alt="Profile Picture"
//                     width={200}
//                     height={200}
//                     className="rounded-full object-cover"
//                   />
//                 </div>
//               ) : (
//                 <button
//                   onClick={async () => {
//                     try {
//                       console.log("Requesting permissions...");
//                       const stream = await navigator.mediaDevices.getUserMedia({
//                         video: {
//                           width: { ideal: 1280 },
//                           height: { ideal: 720 },
//                           frameRate: { ideal: 30 },
//                         },
//                         audio: {
//                           echoCancellation: true,
//                           noiseSuppression: true,
//                           autoGainControl: true,
//                           sampleRate: 48000,
//                         },
//                       });

//                       console.log("Stream obtained:", stream);
//                       setMediaStream(stream);

//                       // Initialize audio context
//                       const AudioContext =
//                         window.AudioContext || window.webkitAudioContext;
//                       audioContextRef.current = new AudioContext();
//                       audioDestinationRef.current =
//                         audioContextRef.current.createMediaStreamDestination();
//                       const source =
//                         audioContextRef.current.createMediaStreamSource(stream);
//                       source.connect(audioDestinationRef.current);
//                       mixedStreamRef.current =
//                         audioDestinationRef.current.stream;
//                     } catch (error) {
//                       console.error("Error accessing media devices:", error);
//                       setError("Failed to access camera and microphone");
//                     }
//                   }}
//                   className="absolute inset-0 flex items-center justify-center bg-gray-100 text-gray-600 hover:bg-gray-200"
//                 >
//                   <span className="text-center">
//                     Click to enable camera & microphone
//                     <br />
//                     to start interview
//                   </span>
//                 </button>
//               )}
//             </div>
//             <div className="flex flex-col justify-between">
//               <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
//                 <div className="flex items-center justify-between">
//                   <div>
//                     <span className="text-sm font-medium text-gray-500">
//                       Name
//                     </span>
//                     <p className="text-sm font-semibold text-gray-800">
//                       {interview?.fullName}
//                     </p>
//                   </div>
//                   <div>
//                     <span className="text-sm font-medium text-gray-500">
//                       Specialization
//                     </span>
//                     <p className="text-sm font-semibold text-gray-800">
//                       {interview?.primarySpecialization}
//                     </p>
//                   </div>
//                 </div>
//               </div>

//               <div className="space-y-4">
//                 <div className="flex items-start space-x-3 rounded-lg border border-gray-100 bg-gray-50 p-4">
//                   <input
//                     type="checkbox"
//                     id="consent-checkbox"
//                     className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
//                     onChange={(e) => setHasReadInstructions(e.target.checked)}
//                   />
//                   <div className="flex-1">
//                     <label
//                       htmlFor="consent-checkbox"
//                       className="text-sm font-medium text-gray-700"
//                     >
//                       I have read and agree to the interview instructions
//                     </label>
//                     <button
//                       onClick={() => setShowInstructions(true)}
//                       className="ml-1 text-sm font-medium text-indigo-600 hover:text-indigo-700"
//                     >
//                       (Read Instructions)
//                     </button>
//                     {/* <p className="mt-1 text-xs text-gray-500">
//                       By participating, you agree to our{" "}
//                       <Link
//                         href="/privacy-policy"
//                         className="text-indigo-600 hover:text-indigo-700"
//                       >
//                         Privacy Policy
//                       </Link>
//                     </p> */}
//                   </div>
//                 </div>

//                 <button
//                   onClick={() => {
//                     if (!hasReadInstructions) {
//                       toast({
//                         title: "Please read instructions",
//                         description:
//                           "You must read and agree to the instructions before proceeding.",
//                         variant: "destructive",
//                       });
//                       return;
//                     }
//                     setHasConsent(true);
//                   }}
//                   disabled={!hasReadInstructions}
//                   className={`w-full rounded-full px-6 py-3 text-center text-lg font-medium text-white transition-all ${
//                     hasReadInstructions && mediaStream
//                       ? "bg-indigo-600 hover:bg-indigo-700"
//                       : "cursor-not-allowed bg-gray-400"
//                   }`}
//                 >
//                   Let&apos;s get started!
//                 </button>
//               </div>
//             </div>
//           </div>
//         </div>
//       ) : (
//         // Existing interview UI
//         <div className="interview-container w-full max-w-7xl rounded-2xl bg-white p-8 shadow-sm">
//           {/* Timer Bar */}
//           <div className="mb-6 flex items-center justify-between rounded-lg bg-gray-50 p-3">
//             <div className="flex items-center space-x-4">
//               <div className="flex items-center space-x-2">
//                 <div
//                   className={`h-2 w-2 rounded-full ${isRecording ? "animate-pulse bg-red-500" : "bg-green-500"}`}
//                 ></div>
//                 <span className="text-sm font-medium text-gray-700">
//                   Time Remaining: {formattedTime}
//                 </span>
//               </div>
//               <div className="h-4 w-px bg-gray-300"></div>
//               <span className="text-sm text-gray-600">
//                 Question {questionCount}
//               </span>
//             </div>
//             {interviewStatus === "waiting" && (
//               <button
//                 onClick={handleInterviewStart}
//                 className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700"
//               >
//                 Start Interview
//               </button>
//             )}
//           </div>

//           <div className="grid h-[600px] grid-cols-[1fr,1.2fr] gap-8">
//             {/* Left Column - Interviewer & Question - Static height container */}
//             <div className="relative flex h-full flex-col rounded-2xl bg-[#eff0fd] p-4">
//               {/* Interviewer Interface */}
//               <div className="overflow-hidden rounded-2xl border-2 border-blue-200/30 bg-black shadow-lg">
//                 <div className="relative h-[220px] w-full overflow-hidden bg-[#111]">
//                   <div className="relative h-full w-full">
//                     <Image
//                       src="/assets/images/eq.png"
//                       alt="EQ Animated Logo"
//                       fill
//                       className={`h-full w-full object-cover ${
//                         isAudioPlaying ? "animate-fast-pulse" : ""
//                       }`}
//                     />
//                   </div>

//                   {/* Processing States */}
//                   {isSpeechProcessing && (
//                     <div className="absolute bottom-4 left-0 right-0 text-center">
//                       <div className="flex items-center justify-center space-x-2">
//                         <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-400 border-t-transparent"></div>
//                         <span className="text-sm text-blue-400">
//                           Processing your response...
//                         </span>
//                       </div>
//                     </div>
//                   )}

//                   {isLoadingNextQuestion && (
//                     <div className="absolute bottom-4 left-0 right-0 text-center">
//                       <div className="flex items-center justify-center space-x-2">
//                         <div className="h-4 w-4 animate-spin rounded-full border-2 border-purple-400 border-t-transparent"></div>
//                         <span className="text-sm text-purple-400">
//                           Preparing next question...
//                         </span>
//                       </div>
//                     </div>
//                   )}
//                 </div>
//               </div>

//               {/* Question Display */}
//               <div className="mt-6 flex-1 rounded-xl bg-white/80 p-6 shadow-sm">
//                 <div className="mb-4">
//                   <h2 className="text-lg font-semibold text-gray-900">
//                     Interview Question
//                   </h2>
//                   <div className="mt-1 text-sm text-gray-500">
//                     Please listen carefully and respond naturally to the
//                     question...
//                   </div>
//                 </div>

//                 {isLoadingNextQuestion ? (
//                   <div className="flex flex-col items-center space-y-4 py-4">
//                     <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-400 border-t-transparent"></div>
//                     <p className="text-sm text-gray-600">
//                       Getting your interview question...
//                     </p>
//                   </div>
//                 ) : showQuestion ? (
//                   <p className="text-base text-gray-800">{currentQuestion}</p>
//                 ) : null}
//               </div>
//             </div>

//             {/* Right Column - User Video - Static height container */}
//             <div className="relative flex h-full flex-col">
//               <div className="relative flex-1 overflow-hidden rounded-2xl bg-gray-100">
//                 {/* Timer Display */}
//                 {interviewStatus === "recording" &&
//                   !isAudioPlaying &&
//                   timeRemaining > 0 && (
//                     <div className="absolute right-4 top-4 z-10 flex items-center space-x-2 rounded-full bg-gray-100/90 px-3 py-1.5">
//                       <div className="h-2 w-2 rounded-full bg-green-500"></div>
//                       <span className="text-sm font-medium text-gray-700">
//                         {timeRemaining}s remaining
//                       </span>
//                     </div>
//                   )}

//                 {/* Time's Up Notification */}
//                 {interviewStatus === "recording" &&
//                   !isAudioPlaying &&
//                   timeRemaining === 0 && (
//                     <div className="animate-fade-in absolute right-4 top-4 z-10 rounded-full bg-blue-50 px-4 py-2">
//                       <span className="text-sm text-blue-600">
//                         You can continue answering or proceed to the next
//                         question
//                       </span>
//                     </div>
//                   )}

//                 {/* User Video */}
//                 <video
//                   ref={videoRef}
//                   autoPlay
//                   playsInline
//                   muted
//                   className="h-full w-full object-cover"
//                 />

//                 {/* Status Indicators - Inside video container */}
//                 <div className="absolute bottom-4 left-0 right-0 flex items-center justify-between px-4">
//                   {/* Recording Indicator */}
//                   {interviewStatus === "recording" && (
//                     <div className="flex items-center space-x-2 rounded-full bg-black/30 px-3 py-1.5 backdrop-blur-sm">
//                       <div className="h-2 w-2 animate-pulse rounded-full bg-red-500"></div>
//                       <span className="text-sm font-medium text-white">
//                         Recording...
//                       </span>
//                     </div>
//                   )}

//                   {/* Speaking Indicator */}
//                   {isUserSpeaking && (
//                     <div className="flex items-center space-x-2 rounded-full bg-black/30 px-3 py-1.5 backdrop-blur-sm">
//                       <div className="h-2 w-2 animate-pulse rounded-full bg-green-500"></div>
//                       <span className="text-sm font-medium text-white">
//                         Speaking
//                       </span>
//                     </div>
//                   )}
//                 </div>
//               </div>
//             </div>
//           </div>

//           <div className="mt-6 flex w-full justify-end">
//             <div className="">
//               {interviewStatus === "recording" && timeRemaining === 0 && (
//                 <button
//                   onClick={handleNextQuestion}
//                   className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:bg-indigo-400"
//                 >
//                   Next Question
//                 </button>
//               )}
//             </div>
//           </div>
//         </div>
//       )}

//       {/* Loading overlay during completion processing */}
//       {isCompletionProcessing && (
//         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
//           <div className="rounded-lg bg-white p-8 text-center">
//             <div className="mb-4 flex justify-center">
//               <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
//             </div>
//             <h3 className="text-lg font-medium text-gray-900">
//               Completing Interview
//             </h3>
//             <p className="mt-2 text-sm text-gray-500">
//               Please wait while we process your interview...
//             </p>
//           </div>
//         </div>
//       )}

//       {/* Completion modal */}
//       {showCompletionModal && recordedBlob && (
//         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
//           <div className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-8 text-center shadow-xl transition-all">
//             <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
//               <svg
//                 className="h-8 w-8 text-green-600"
//                 fill="none"
//                 stroke="currentColor"
//                 viewBox="0 0 24 24"
//               >
//                 <path
//                   strokeLinecap="round"
//                   strokeLinejoin="round"
//                   strokeWidth={2}
//                   d="M5 13l4 4L19 7"
//                 />
//               </svg>
//             </div>
//             <h3 className="mb-4 text-2xl font-bold text-gray-900">
//               Interview Successfully Completed!
//             </h3>
//             <p className="mb-8 text-gray-600">
//               Thank you for participating in this interview. Your responses have
//               been recorded. Please submit your responses to complete the
//               process.
//             </p>
//             <div className="flex space-x-4">
//               {/* <button
//                 onClick={() => {
//                   const url = URL.createObjectURL(recordedBlob);
//                   const a = document.createElement("a");
//                   a.href = url;
//                   a.download = `interview-recording-${Date.now()}.webm`;
//                   document.body.appendChild(a);
//                   a.click();
//                   document.body.removeChild(a);
//                   URL.revokeObjectURL(url);
//                 }}
//                 className="flex-1 rounded-lg border-2 border-gray-300 bg-white px-6 py-3 text-gray-700 transition-all hover:bg-gray-50 hover:shadow-md"
//               >
//                 Download Recording
//               </button> */}
//               <button
//                 onClick={handleSubmitInterview}
//                 disabled={uploading}
//                 className="flex-1 rounded-lg bg-gradient-to-r from-green-500 to-green-600 px-6 py-3 text-white transition-all hover:from-green-600 hover:to-green-700 hover:shadow-lg disabled:from-green-300 disabled:to-green-400"
//               >
//                 {uploading ? (
//                   <span className="flex items-center justify-center gap-2">
//                     <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
//                       <circle
//                         className="opacity-25"
//                         cx="12"
//                         cy="12"
//                         r="10"
//                         stroke="currentColor"
//                         strokeWidth="4"
//                         fill="none"
//                       />
//                       <path
//                         className="opacity-75"
//                         fill="currentColor"
//                         d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
//                       />
//                     </svg>
//                     Uploading...
//                   </span>
//                 ) : (
//                   "Submit Interview"
//                 )}
//               </button>
//             </div>
//           </div>
//         </div>
//       )}

//       <InstructionDialog
//         open={showInstructions}
//         onOpenChange={setShowInstructions}
//       />
//     </div>
//   );
// };

// export default InterviewPage;
