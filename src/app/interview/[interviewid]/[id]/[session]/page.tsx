"use client";
import { useCallback, useRef, useState } from "react";
import { Mic, Circle, Square, Check, AlertCircle, ChevronDown, Wifi, Battery, Video, UserCircle, ClipboardList } from "lucide-react";
import Image from "next/image";
import router from "next/router";
import { api } from "@/trpc/react";
import { toast } from "sonner";
// import { Toaster } from "@/components/ui/sonner"


declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext;
  }
}
interface InterviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface AudioResponse {
  audio: string;
  // Add other properties if they exist in the response
}


const InstructionDialog = ({ open, onOpenChange }: InterviewDialogProps) => {
  return (
    <div className={`${open ? "block" : "hidden"} fixed inset-0 z-50 flex items-center justify-center bg-black/50`}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6">
        <h3 className="text-lg font-semibold text-gray-900">Interview Instructions</h3>
        <p className="mt-2 text-sm text-gray-600">
          Please follow these guidelines to ensure a smooth interview experience:
        </p>
        <ul className="mt-2 list-disc pl-5 text-sm text-gray-600">
          <li>Ensure a quiet environment with good lighting.</li>
          <li>Keep your camera and microphone enabled throughout the session.</li>
          <li>Do not switch tabs or minimize the browser window.</li>
          <li>Respond to questions clearly and concisely.</li>
        </ul>
        <button
          onClick={() => onOpenChange(false)}
          className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Close
        </button>
      </div>
    </div>
  );
};

const INTERVIEW_DURATION = 15 * 60; // 15 minutes in seconds
const Min_Time_Frame = 5; // 5 

export default function InterviewPage() {
  // Frontend-only states
  const [hasConsent, setHasConsent] = useState(false);
  const [isTestingMic, setIsTestingMic] = useState(false);
  const [microphonePlayback, setMicrophonePlayback] = useState<"none" | "recording" | "playing">("none");
  const [hasMicrophoneTested, setHasMicrophoneTested] = useState(false);
  const [networkSpeed, setNetworkSpeed] = useState<"unchecked" | "checking" | "good" | "moderate" | "poor">("unchecked");
  const [interviewStatus, setInterviewStatus] = useState<"waiting" | "initializing" | "playing-question" | "recording" | "completed">("waiting");
  const [isRecording, setIsRecording] = useState(false);
  const [formattedTime, setFormattedTime] = useState("15:00");
  const [questionCount, setQuestionCount] = useState(0);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [showQuestion, setShowQuestion] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [isSpeechProcessing, setIsSpeechProcessing] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(5);
  const [nextClicked, setNextClicked] = useState(false);
  const [isCompletionProcessing, setIsCompletionProcessing] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [hasReadInstructions, setHasReadInstructions] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string>("");
  const [isLoadingNextQuestion, setIsLoadingNextQuestion] = useState(false);
  const [canProceedToNext, setCanProceedToNext] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);

  const chunksRef = useRef<BlobPart[]>([]);
  const chunksRef1 = useRef<BlobPart[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const transcriptRef = useRef<string>("");
  const watermarkRef = useRef<HTMLImageElement | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const mimeType = "video/webm;codecs=vp9,opus";
  const [isMonitoringAudio, setIsMonitoringAudio] = useState(false);

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
  const audioDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(
    null,
  );
  const mixedStreamRef = useRef<MediaStream | null>(null);
  

  // Mock data for UI rendering
  const interview = {
    fullName: "John Doe",
    primarySpecialization: "Software Engineering",
    profilePicture: "/assets/images/profile.png",
  };

  const getAudioMutation =  api.interview.getAudio.useMutation();




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

      // This one is for the AudioOnlyRecording
      // audioRecorder1.ondataavailable = (event) => {
      //   if (event.data.size > 0 && !isPaused) {
      //     chunksRef1.current.push(event.data);
      //     console.log("Recorded audio chunk size:", event.data.size);
      //   }
      // };

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
              console.log("🟡 Interim transcript:", msg.transcript);
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
    } catch (err) {
      console.error("Error starting audio recording:", err);
      setError(`Failed to start audio recording: ${(err as Error).message}`);
    }
  }, [mediaStream, setError]);



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
      toast("Failed to complete interview properly");
    } finally {
      setIsCompletionProcessing(false);
    }
  }, []);

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

      // Generate initial greeting
      const initialQuestion = `Hi ${interview?.fullName ?? ""}, welcome to the interview. Could you please introduce yourself and tell us about your background?`;

      // Update the Promise wrapper with proper typing
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
        // Clean up all media streams
        cleanupMediaStreams();
        toast("Interview submitted successfully\nYour interview has been recorded and submitted.");
      },
      onError: (error) => {
        toast(
          "Failed to submit interview");
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

  // Frontend event handlers
  const handleCheckNetworkSpeed = () => {
    setNetworkSpeed("checking");
    setTimeout(() => {
      setNetworkSpeed("good");
    }, 2000);
  };

  const handleStartInterview = () => {
    setInterviewStatus("initializing");
    setTimeout(() => {
      setInterviewStatus("recording");
      setCurrentQuestion("Please introduce yourself and tell us about your background.");
      setShowQuestion(true);
      setIsAudioPlaying(true);
      setTimeout(() => {
        setIsAudioPlaying(false);
        setQuestionCount(1);
      }, 3000);
    }, 1000);
  };

  const handleTestMicrophone = () => {
    if (isTestingMic) {
      setIsTestingMic(false);
      setMicrophonePlayback("playing");
      setTimeout(() => {
        setMicrophonePlayback("none");
        setHasMicrophoneTested(true);
      }, 2000);
    } else {
      setIsTestingMic(true);
      setMicrophonePlayback("recording");
    }
  };

  const handleNextQuestion = () => {
    if (timeRemaining > 0 || nextClicked) return;
    setNextClicked(true);
    setIsAudioPlaying(true);
    setShowQuestion(false);
    setTimeout(() => {
      setCurrentQuestion("What are your strengths?");
      setShowQuestion(true);
      setQuestionCount((prev) => prev + 1);
      setTimeRemaining(5);
      setIsAudioPlaying(false);
      setNextClicked(false);
    }, 2000);
  };

  const handleSubmitInterview = () => {
    setIsCompletionProcessing(true);
    setTimeout(() => {
      setIsCompletionProcessing(false);
      setShowCompletionModal(true);
    }, 2000);
  };

  // Mock loading state
  const isLoading = false;

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mb-4 flex justify-center">
            <div className="relative h-16 w-16">
              <div className="absolute h-16 w-16 animate-spin rounded-full border-4 border-solid border-blue-400 border-t-transparent"></div>
              <div className="absolute h-16 w-16 animate-ping rounded-full border-4 border-solid border-blue-400 opacity-20"></div>
            </div>
          </div>
          <h2 className="text-xl font-semibold text-gray-700">Initializing Interview</h2>
          <p className="mt-2 text-sm text-gray-500">Please wait while we set up your session...</p>
        </div>
      </div>
    );
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
              <h1 className="mb-1 text-lg font-bold md:text-2xl">Hey! its your</h1>
              <h2 className="mb-2 text-xl font-bold md:text-3xl">Virtual Interview</h2>
              <p className="text-xs text-gray-600 md:text-base">Welcome to the session!</p>
            </div>
          </div>

          {/* Bottom Section with Features */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
            <div className="relative h-[180px] w-full overflow-hidden rounded-2xl bg-gray-100 md:h-[250px]">
              <button
                onClick={() => setHasConsent(true)}
                className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-r from-blue-50 to-indigo-50 p-4 text-center transition-all duration-300 hover:from-blue-100 hover:to-indigo-100"
              >
                <div className="mb-3 rounded-full bg-indigo-100 p-3">
                  <Video className="h-6 w-6 animate-pulse text-indigo-600" />
                </div>
                <span className="text-sm font-medium text-gray-700 md:text-base">
                  Tap to enable camera & microphone
                </span>
                <span className="mt-1 text-xs text-gray-500 md:text-sm">
                  Required to start interview
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
                      <p className="text-xs font-semibold text-gray-800">{interview.fullName}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500">Specialization</p>
                    <p className="text-xs font-semibold text-gray-800">{interview.primarySpecialization}</p>
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
                    <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                      <p className="text-xs text-gray-600">Please read this sentence:</p>
                      <p className="mt-1 text-sm font-medium text-gray-800">
                        "I am ready for my virtual interview today."
                      </p>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {(isTestingMic || !hasMicrophoneTested) && (
                          <button
                            onClick={handleTestMicrophone}
                            className={`flex items-center space-x-2 rounded-md px-3 py-2 text-xs font-medium transition-all ${
                              isTestingMic
                                ? "bg-red-100 text-red-600 hover:bg-red-200"
                                : "bg-indigo-100 text-indigo-600 hover:bg-indigo-200"
                            }`}
                          >
                            {isTestingMic ? (
                              <>
                                <Square className="h-3 w-3" />
                                <span>Click to Stop Recording and Play Back Your Test</span>
                              </>
                            ) : (
                              <>
                                <Circle className="h-3 w-3" />
                                <span>Start Recording</span>
                              </>
                            )}
                          </button>
                        )}
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
                      {hasMicrophoneTested && (
                        <div className="flex items-center text-xs text-green-600">
                          <Check className="mr-1 h-4 w-4" />
                          Test completed
                        </div>
                      )}
                    </div>
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
                        onClick={handleCheckNetworkSpeed}
                        disabled={networkSpeed === "checking"}
                        className={`rounded-md px-3 py-1 text-xs font-medium ${
                          networkSpeed === "checking"
                            ? "bg-gray-100 text-gray-400"
                            : "bg-indigo-100 text-indigo-600 hover:bg-indigo-200"
                        }`}
                      >
                        {networkSpeed === "checking" ? "Testing..." : "Test Speed"}
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
                                <li>Close other bandwidth-heavy applications</li>
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
                    if (hasReadInstructions && hasMicrophoneTested && networkSpeed === "good") {
                      setHasConsent(true);
                    }
                  }}
                  className={`w-full rounded-full px-3 py-1.5 text-xs font-medium text-white transition-all md:px-4 md:py-2 md:text-sm ${
                    hasReadInstructions && hasMicrophoneTested && networkSpeed === "good"
                      ? "bg-indigo-600 hover:bg-indigo-700"
                      : "cursor-not-allowed bg-gray-400"
                  }`}
                >
                  Let's get started!
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="interview-container w-full max-w-7xl rounded-2xl bg-white p-8 shadow-sm">
          {/* Timer Bar */}
          <div className="mb-6 flex items-center justify-between rounded-lg bg-gray-50 p-3">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div
                  className={`h-2 w-2 rounded-full ${isRecording ? "animate-pulse bg-red-500" : "bg-green-500"}`}
                ></div>
                <span className="text-sm font-medium text-gray-700">Time Remaining: {formattedTime}</span>
              </div>
              <div className="h-4 w-px bg-gray-300"></div>
              <span className="text-sm text-gray-600">Question {questionCount}</span>
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
            {/* Left Column - Interviewer & Question */}
            <div className="relative flex h-full flex-col rounded-2xl bg-[#eff0fd] p-4">
              <div className="overflow-hidden rounded-2xl border-2 border-blue-200/30 bg-black shadow-lg">
                <div className="relative h-[220px] w-full overflow-hidden bg-[#111]">
                  <Image
                    src="/assets/images/eq.png"
                    alt="EQ Animated Logo"
                    fill
                    className={`h-full w-full object-cover ${isAudioPlaying ? "animate-fast-pulse" : ""}`}
                  />
                </div>
              </div>
              <div className="mt-6 flex-1 rounded-xl bg-white/80 p-6 shadow-sm">
                <div className="mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">Interview Question</h2>
                  <div className="mt-1 text-sm text-gray-500">
                    Please listen carefully and respond naturally to the question...
                  </div>
                </div>
                {showQuestion ? (
                  <p className="text-base text-gray-800">{currentQuestion}</p>
                ) : (
                  <div className="flex flex-col items-center space-y-4 py-4">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-400 border-t-transparent"></div>
                    <p className="text-sm text-gray-600">Getting your interview question...</p>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column - User Video */}
            <div className="relative flex h-full flex-col">
              <div className="relative flex-1 overflow-hidden rounded-2xl bg-gray-100">
                {interviewStatus === "recording" && !isAudioPlaying && timeRemaining > 0 && (
                  <div className="absolute right-4 top-4 z-10 flex items-center space-x-2 rounded-full bg-gray-100/90 px-3 py-1.5">
                    <div className="h-2 w-2 rounded-full bg-green-500"></div>
                    <span className="text-sm font-medium text-gray-700">{timeRemaining}s remaining</span>
                  </div>
                )}
                {interviewStatus === "recording" && !isAudioPlaying && timeRemaining === 0 && (
                  <div className="animate-fade-in absolute right-4 top-4 z-10 rounded-full bg-blue-50 px-4 py-2">
                    <span className="text-sm text-blue-600">
                      You can continue answering or proceed to the next question
                    </span>
                  </div>
                )}
                <video
                  autoPlay
                  playsInline
                  muted
                  className="h-full w-full object-cover"
                />
                <div className="absolute bottom-4 left-0 right-0 flex items-center justify-between px-4">
                  {interviewStatus === "recording" && (
                    <div className="flex items-center space-x-2 rounded-full bg-black/30 px-3 py-1.5 backdrop-blur-sm">
                      <div className="h-2 w-2 animate-pulse rounded-full bg-red-500"></div>
                      <span className="text-sm font-medium text-white">Recording...</span>
                    </div>
                  )}
                  {isUserSpeaking && (
                    <div className="flex items-center space-x-2 rounded-full bg-black/30 px-3 py-1.5 backdrop-blur-sm">
                      <div className="h-2 w-2 animate-pulse rounded-full bg-green-500"></div>
                      <span className="text-sm font-medium text-white">Speaking</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex w-full justify-end">
            <div>
              {interviewStatus === "recording" && timeRemaining === 0 && !nextClicked && (
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

      {isCompletionProcessing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="rounded-lg bg-white p-8 text-center">
            <div className="mb-4 flex justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
            </div>
            <h3 className="text-lg font-medium text-gray-900">Completing Interview</h3>
            <p className="mt-2 text-sm text-gray-500">Please wait while we process your interview...</p>
          </div>
        </div>
      )}

      {showCompletionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-8 text-center shadow-xl transition-all">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="mb-4 text-2xl font-bold text-gray-900">Interview Successfully Completed!</h3>
            <p className="mb-8 text-gray-600">
              Thank you for participating in this interview. Your responses have been recorded. Please submit your responses to complete the process.
            </p>
            <div className="flex space-x-4">
              <button
                onClick={handleSubmitInterview}
                className="flex-1 rounded-lg bg-gradient-to-r from-green-500 to-green-600 px-6 py-3 text-white transition-all hover:from-green-600 hover:to-green-700 hover:shadow-lg"
              >
                Submit Interview
              </button>
            </div>
          </div>
        </div>
      )}

      <InstructionDialog open={showInstructions} onOpenChange={setShowInstructions} />
    </div>
  );
}

// export default InterviewPage;