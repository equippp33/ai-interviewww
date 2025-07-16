"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import { Mic, Circle, Square, Check, AlertCircle, ChevronDown, Wifi, Battery, Video, UserCircle, ClipboardList } from "lucide-react";
import Image from "next/image";
import { useParams } from "next/navigation";
import { api } from "@/trpc/react";
import { toast } from "sonner";

declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext;
  }
}

type CandidateApplication = {
  id: string;
  candidateId: string;
  jobId: string;
  name: string;
  email: string;
  phoneNumber: string | null;
  dob: string | null;
  gender: string | null;
  maritalStatus: string | null;
  nationality: string | null;
  location: string | null;
  photo: string | null;
  bio: string | null;
  linkedinUrl: string | null;
  highestDegree: string | null;
  universityName: string | null;
  specialization: string | null;
  percentage: string | null;
  graduationYear: string | null;
  totalExperience: string | null;
  currentCTC: string | null;
  expectedCTC: string | null;
  technicalSkills: string | null;
  languages: string | null;
  resume: string | null;
  jobTitle: string | null;
  jobDescription: string | null;
  jobLocation: string | null;
  companyName: string | null;
  skillsRequired: string | null;
  createdAt: string;
  updatedAt: string;
};

interface InterviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface AudioResponse {
  audio: string;
}

interface ProcessStreamResponse {
  isComplete: boolean;
  nextQuestion: string;
  topic?: string;
  shouldContinueRecording: boolean;
  transcript: string;
  questionCount: number;
  audio?: string;
  previousQuestions?: {
    question: string;
    topic: string;
    answer: string;
  }[];
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
const MIN_TIME_FRAME = 5; // 5 seconds per question
const MAX_QUESTIONS = 20; // Maximum number of questions

export default function InterviewPage() {
  const params = useParams();
  const jobId = params.jobid as string;
  const applicationId = params.id as string;
  const sessionId = params.session as string;
  const { data: application, isLoading } = api.interview.getCandidateApplication.useQuery({ id: applicationId });

  const [hasConsent, setHasConsent] = useState(false);
  const [isTestingMic, setIsTestingMic] = useState(false);
  const [microphonePlayback, setMicrophonePlayback] = useState<"none" | "recording" | "playing">("none");
  const [hasMicrophoneTested, setHasMicrophoneTested] = useState(false);
  const [networkSpeed, setNetworkSpeed] = useState<"unchecked" | "checking" | "good" | "moderate" | "poor">("unchecked");
  const [interviewStatus, setInterviewStatus] = useState<"waiting" | "initializing" | "playing-question" | "recording" | "completed">("waiting");
  const [isRecording, setIsRecording] = useState(false);
  const [formattedTime, setFormattedTime] = useState("15:00");
  const [questionCount, setQuestionCount] = useState(0);
  const [isMonitoringAudio, setIsMonitoringAudio] = useState(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [showQuestion, setShowQuestion] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [currentTopic, setCurrentTopic] = useState("");
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(MIN_TIME_FRAME);
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
  const [isPaused, setIsPaused] = useState(false);
  const [previousQuestions, setPreviousQuestions] = useState<{ question: string; topic: string; answer: string }[]>([]);
  const [resumeText, setResumeText] = useState("");
  const [jdText, setJdText] = useState("");
  const [jdTopics, setJdTopics] = useState<string[]>([]);

  const chunksRef = useRef<BlobPart[]>([]);
  const chunksRef1 = useRef<BlobPart[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const transcriptRef = useRef<string>("");
  const watermarkRef = useRef<HTMLImageElement | null>(null);
  const mimeType = "video/webm;codecs=vp9,opus";
  const videoRef = useRef<HTMLVideoElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recorderRef1 = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const audioDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const mixedStreamRef = useRef<MediaStream | null>(null);

  const getAudioMutation = api.interview.getAudio.useMutation();
  const processStreamOldMutation = api.interview.processStreamOld.useMutation();
  const extractSummaryMutation = api.interview.extractSummary.useMutation();
  const extractTopicsMutation = api.interview.extractTopicsFromJD.useMutation();
  const getThankYouMessageMutation = api.interview.getThankYouMessage.useMutation();
  const submitInterviewMutation = api.interview.submitInterview.useMutation({
    onSuccess: () => {
      toast("Interview submitted successfully");
    },
    onError: (error) => {
      setError(`Failed to submit interview: ${error.message}`);
    },
  });

  // Extract resume and JD summaries on mount
  useEffect(() => {
    if (application?.resume && application?.jobDescription) {
      extractSummaryMutation.mutate(
        { parsed_text: application.resume },
        {
          onSuccess: (data) => setResumeText(data.summary),
          onError: () => setError("Failed to parse resume"),
        }
      );
      extractSummaryMutation.mutate(
        { parsed_text: application.jobDescription },
        {
          onSuccess: (data) => setJdText(data.summary),
          onError: () => setError("Failed to parse job description"),
        }
      );
      extractTopicsMutation.mutate(
        { JD_text: application.jobDescription },
        {
          onSuccess: (data) => setJdTopics(data.topics),
          onError: () => setError("Failed to extract JD topics"),
        }
      );
    }
  }, [application]);

  // Timer for interview duration and question time
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (interviewStatus === "recording" && !isAudioPlaying) {
      timer = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 0) {
            setCanProceedToNext(true);
            return 0;
          }
          return prev - 1;
        });
        setFormattedTime(
          new Date((INTERVIEW_DURATION - (questionCount * MIN_TIME_FRAME)) * 1000)
            .toISOString()
            .substr(14, 5)
        );
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [interviewStatus, isAudioPlaying, questionCount]);

  // Set up video element
  useEffect(() => {
    if (videoRef.current && mediaStream) {
      videoRef.current.srcObject = mediaStream;
      videoRef.current.muted = true;
    }
  }, [mediaStream]);

  // Clean up media streams on unmount
  useEffect(() => {
    return () => {
      cleanupMediaStreams();
    };
  }, []);

  const startAudioRecording = useCallback(() => {
    if (!mediaStream) {
      setError("No media stream available for audio recording");
      return;
    }

    try {
      const audioTrack = mediaStream.getAudioTracks().find((track) => track.kind === "audio");
      if (!audioTrack) {
        setError("No audio track found");
        return;
      }

      const audioStream = new MediaStream([audioTrack]);
      const audioRecorder = new MediaRecorder(audioStream, {
        mimeType: "audio/webm;codecs=opus",
        audioBitsPerSecond: 64000,
      });

      audioRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && !isPaused) {
          chunksRef1.current.push(event.data);
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            event.data.arrayBuffer().then((buffer) => {
              wsRef.current?.send(buffer);
            });
          }
        }
      };

      audioRecorder.onstop = () => {
        const finalBlob = new Blob(chunksRef1.current, { type: "audio/webm" });
        chunksRef1.current = [];
      };

      const ws = new WebSocket(process.env.NEXT_PUBLIC_STT_WS_URL || "ws://localhost:3000/stt-service");
      ws.onopen = () => console.log("WebSocket connected to STT backend");
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "transcript" && msg.transcript) {
            if (msg.is_final) {
              transcriptRef.current += msg.transcript + ". ";
            }
          }
        } catch (err) {
          setError("Error parsing STT message");
        }
      };
      ws.onerror = () => setError("WebSocket error");
      ws.onclose = () => console.log("WebSocket closed");
      wsRef.current = ws;

      audioRecorder.start(1000);
      recorderRef1.current = audioRecorder;
      setIsRecording(true);
      setIsPaused(false);
    } catch (err) {
      setError(`Failed to start audio recording: ${(err as Error).message}`);
    }
  }, [mediaStream]);

  const restartAudioRecording = useCallback(() => {
    pauseAudioRecording();
    startAudioRecording();
  }, [startAudioRecording]);

  const startRecording = useCallback(() => {
    if (!mediaStream) {
      setError("No media stream available");
      return;
    }

    try {
      const canvas = document.createElement("canvas");
      canvas.width = 1280;
      canvas.height = 720;

      const watermark = document.createElement("img");
      watermark.src = "/assets/images/eq.png";
      watermarkRef.current = watermark;

      if (!audioContextRef.current) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioContextRef.current = new AudioContext();
        audioDestinationRef.current = audioContextRef.current.createMediaStreamDestination();
      }

      const micSource = audioContextRef.current.createMediaStreamSource(mediaStream);
      if (audioDestinationRef.current) {
        micSource.connect(audioDestinationRef.current);
      }

      const videoTrack = mediaStream.getVideoTracks()[0];
      const mixedStream = new MediaStream();
      if (videoTrack) mixedStream.addTrack(videoTrack);
      const audioTrack = audioDestinationRef.current?.stream.getAudioTracks()[0];
      if (audioTrack) mixedStream.addTrack(audioTrack);

      const recorder = new MediaRecorder(mixedStream, {
        mimeType,
        videoBitsPerSecond: 2500000,
        audioBitsPerSecond: 128000,
      });

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const finalBlob = new Blob(chunksRef.current, { type: "video/webm" });
        setRecordedBlob(finalBlob);
        setInterviewStatus("completed");
      };

      recorder.start(1000);
      recorderRef.current = recorder;
      setIsRecording(true);
    } catch (err) {
      setError(`Failed to start recording: ${(err as Error).message}`);
    }
  }, [mediaStream]);

  const playAudioFromBase64 = useCallback(
    async (base64Audio: string, onEnded?: () => void) => {
      setIsMonitoringAudio(false);

      try {
        if (audioElementRef.current) {
          audioElementRef.current.pause();
          audioElementRef.current.removeAttribute("src");
          audioElementRef.current = null;
        }

        const audio = new Audio();
        audioElementRef.current = audio;

        if (!audioContextRef.current) {
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          audioContextRef.current = new AudioContext();
        }

        audio.addEventListener("play", () => {
          if (audioContextRef.current) {
            const source = audioContextRef.current.createMediaElementSource(audio);
            const gainNode = audioContextRef.current.createGain();
            gainNode.gain.value = 1.0;
            source.connect(gainNode);
            gainNode.connect(audioContextRef.current.destination);
            if (audioDestinationRef.current) {
              gainNode.connect(audioDestinationRef.current);
            }
          }
          setIsAudioPlaying(true);
          setShowQuestion(true);
        });

        audio.addEventListener("ended", () => {
          setIsAudioPlaying(false);
          onEnded?.();
        });

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

        await audio.play();
        return () => URL.revokeObjectURL(url);
      } catch (err) {
        setError("Failed to play audio");
        onEnded?.();
      }
    },
    []
  );

  const pauseAudioRecording = useCallback(() => {
    if (recorderRef1.current && recorderRef1.current.state === "recording") {
      recorderRef1.current.pause();
      setIsPaused(true);
    }
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.close();
    }
  }, []);

  const handleInterviewCompletion = useCallback(async () => {
    setIsCompletionProcessing(true);
    try {
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
        pauseAudioRecording();
      }
      const thankYouResponse = await getThankYouMessageMutation.mutateAsync({ fullName: application?.name ?? "" });
      if (thankYouResponse.audio) {
        await playAudioFromBase64(thankYouResponse.audio);
      }
      setShowCompletionModal(true);
    } catch (error) {
      setError("Failed to complete interview properly");
    } finally {
      setIsCompletionProcessing(false);
    }
  }, [pauseAudioRecording, application?.name, playAudioFromBase64]);

  const handleInterviewStart = useCallback(async () => {
    setInterviewStatus("initializing");
    try {
      if (!mediaStream?.getTracks().some((track) => track.readyState === "live")) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        setMediaStream(stream);
      }

      setError("");
      setShowQuestion(false);

      const initialQuestion = `Hi ${application?.name ?? ""}, welcome to the interview. Could you please introduce yourself and tell us about your background?`;

      const audioResponse = await getAudioMutation.mutateAsync({
        text: initialQuestion,
        fullName: application?.name ?? "",
      });

      if (audioResponse.audio) {
        setCurrentQuestion(initialQuestion);
        setCurrentTopic("Introduction");
        setShowQuestion(true);
        await playAudioFromBase64(audioResponse.audio, () => {
          setQuestionCount(1);
          restartAudioRecording();
        });
        setInterviewStatus("recording");
        startRecording();
        startAudioRecording();
      } else {
        throw new Error("Failed to get audio response");
      }
    } catch (err) {
      setError("Failed to start interview. Please try again.");
      setInterviewStatus("waiting");
    }
  }, [application?.name, startRecording, startAudioRecording, restartAudioRecording, getAudioMutation, mediaStream, playAudioFromBase64]);

  const cleanupMediaStreams = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    if (recorderRef1.current && recorderRef1.current.state !== "inactive") {
      recorderRef1.current.stop();
    }
    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => track.stop());
      setMediaStream(null);
    }
    if (mixedStreamRef.current) {
      mixedStreamRef.current.getTracks().forEach((track) => track.stop());
      mixedStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [mediaStream]);

  const handleCheckNetworkSpeed = () => {
    setNetworkSpeed("checking");
    setTimeout(() => {
      setNetworkSpeed("good");
    }, 2000);
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

  const handleNextQuestion = useCallback(async () => {
    if (timeRemaining > 0 || nextClicked || !application || questionCount >= MAX_QUESTIONS) return;
    setNextClicked(true);
    setIsAudioPlaying(true);
    setShowQuestion(false);
    setIsLoadingNextQuestion(true);

    try {
      pauseAudioRecording();
      const response = await processStreamOldMutation.mutateAsync({
        audio: transcriptRef.current,
        currentQuestion,
        questionCount,
        fullName: application.name,
        JD_topics: jdTopics,
        primarySpecialization: application.specialization ?? "",
        resumeText,
        JD_text: jdText,
        previousQuestions,
        isNoResponse: !transcriptRef.current,
      });

      if (response.isComplete || questionCount + 1 >= MAX_QUESTIONS) {
        await handleInterviewCompletion();
        return;
      }

      setCurrentQuestion(response.nextQuestion);
      setCurrentTopic(response.topic ?? "");
      setPreviousQuestions(response.previousQuestions ?? []);
      setQuestionCount(response.questionCount);
      transcriptRef.current = "";
      setShowQuestion(true);
      await playAudioFromBase64(response.audio ?? "", () => {
        restartAudioRecording();
      });
      setTimeRemaining(MIN_TIME_FRAME);
      setCanProceedToNext(false);
    } catch (err) {
      setError("Failed to fetch next question");
    } finally {
      setNextClicked(false);
      setIsAudioPlaying(false);
      setIsLoadingNextQuestion(false);
    }
  }, [
    timeRemaining,
    nextClicked,
    application,
    questionCount,
    currentQuestion,
    jdTopics,
    resumeText,
    jdText,
    previousQuestions,
    pauseAudioRecording,
    restartAudioRecording,
    playAudioFromBase64,
    handleInterviewCompletion,
  ]);

  const handleSubmitInterview = useCallback(() => {
    if (!application || !recordedBlob) {
      setError("Missing application data or recorded video");
      return;
    }
    setIsCompletionProcessing(true);
    submitInterviewMutation.mutate({
      userId: application.candidateId,
      interviewId: jobId,
      sessionId: sessionId,
      previousQuestions,
      email: application.email,
      phoneNumber: application.phoneNumber ?? "",
      technicalSkills: application.technicalSkills ?? "",
      languages: application.languages ?? "",
      resume: application.resume ?? "",
      jobTitle: application.jobTitle ?? "",
      jobDescription: application.jobDescription ?? "",
      jobLocation: application.jobLocation ?? "",
      companyName: application.companyName ?? "",
      skillsRequired: application.skillsRequired ? application.skillsRequired.split(",").map(s => s.trim()) : [],
      videoUrl: URL.createObjectURL(recordedBlob), // Placeholder; actual upload needed
      JD_text: jdText,
      resumeText,
      JD_topics: jdTopics,
    }, {
      onSuccess: () => {
        cleanupMediaStreams();
        setShowCompletionModal(true);
      },
      onError: () => {
        setIsCompletionProcessing(false);
      },
    });
  }, [application, recordedBlob, applicationId, jobId, sessionId, previousQuestions, resumeText, jdText, jdTopics, cleanupMediaStreams]);

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-50">
        <div>Loading application data...</div>
      </div>
    );
  }

  if (!application) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-50">
        <div>No application found for this candidate.</div>
      </div>
    );
  }

  const interview = {
    fullName: application.name,
    primarySpecialization: application.specialization,
    profilePicture: application.photo || "/assets/images/profile.png",
    phoneNumber: application.phoneNumber,
    collegeName: application.universityName,
    yearOfPassing: application.graduationYear,
    stream: application.specialization,
    email: application.email,
    jobTitle: application.jobTitle,
    companyName: application.companyName,
    technicalSkills: application.technicalSkills,
    jobDescription: application.jobDescription,
  };

  return (
    <div className="flex h-screen items-center justify-center bg-[#f2f1f6] p-6">
      {error && (
        <div className="fixed top-4 right-4 rounded-lg bg-red-50 p-4 text-red-600 z-50">
          <AlertCircle className="h-5 w-5 inline mr-2" />
          {error}
        </div>
      )}
      {!hasConsent ? (
        <div className="w-full max-w-6xl rounded-3xl bg-white p-4 shadow-lg md:p-6">
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
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
            <div className="relative h-[180px] w-full overflow-hidden rounded-2xl bg-gray-100 md:h-[250px]">
              <button
                onClick={async () => {
                  try {
                    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                    setMediaStream(stream);
                    setHasConsent(true);
                  } catch {
                    setError("Please allow camera and microphone access.");
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
                <div className="mb-2 flex flex-col space-y-2 border-b border-gray-200 pb-2 md:flex-row md:items-center md:justify-between md:space-y-0">
                  <div className="flex items-center space-x-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 md:h-8 md:w-8">
                      <UserCircle className="h-4 w-4 text-indigo-600 md:h-5 md:w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500">Name</p>
                      <p className="text-xs font-semibold text-gray-800">{application.name}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500">Specialization</p>
                    <p className="text-xs font-semibold text-gray-800">{application.specialization ?? "N/A"}</p>
                  </div>
                </div>
                <div>
                  <h3 className="mb-2 flex items-center text-xs font-semibold text-gray-800">
                    <ClipboardList className="mr-1 h-3 w-3 text-indigo-600 md:h-4 md:w-4" />
                    Candidate Details
                  </h3>
                  <div className="space-y-1.5">
                    <div className="flex items-center space-x-2 rounded-md py-0.5">
                      <span className="text-[10px] text-gray-700 md:text-xs">Email: {application.email}</span>
                    </div>
                    <div className="flex items-center space-x-2 rounded-md py-0.5">
                      <span className="text-[10px] text-gray-700 md:text-xs">Phone: {application.phoneNumber ?? "N/A"}</span>
                    </div>
                    <div className="flex items-center space-x-2 rounded-md py-0.5">
                      <span className="text-[10px] text-gray-700 md:text-xs">University: {application.universityName ?? "N/A"}</span>
                    </div>
                    <div className="flex items-center space-x-2 rounded-md py-0.5">
                      <span className="text-[10px] text-gray-700 md:text-xs">Degree: {application.highestDegree ?? "N/A"}</span>
                    </div>
                    <div className="flex items-center space-x-2 rounded-md py-0.5">
                      <span className="text-[10px] text-gray-700 md:text-xs">Job Title: {application.jobTitle ?? "N/A"}</span>
                    </div>
                    <div className="flex items-center space-x-2 rounded-md py-0.5">
                      <span className="text-[10px] text-gray-700 md:text-xs">Company: {application.companyName ?? "N/A"}</span>
                    </div>
                    <div className="flex items-center space-x-2 rounded-md py-0.5">
                      <span className="text-[10px] text-gray-700 md:text-xs">Skills: {application.technicalSkills ?? "N/A"}</span>
                    </div>
                    <div className="flex items-center space-x-2 rounded-md py-0.5">
                      <span className="text-[10px] text-gray-700 md:text-xs">Job Description: {application.jobDescription ?? "N/A"}</span>
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
          <div className="mb-6 flex items-center justify-between rounded-lg bg-gray-50 p-3">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div
                  className={`h-2 w-2 rounded-full ${isRecording ? "animate-pulse bg-red-500" : "bg-green-500"}`}
                ></div>
                <span className="text-sm font-medium text-gray-700">Time Remaining: {formattedTime}</span>
              </div>
              <div className="h-4 w-px bg-gray-300"></div>
              <span className="text-sm text-gray-600">Question {questionCount} - {currentTopic}</span>
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
                  <div>
                    <p className="text-sm font-medium text-gray-600">Topic: {currentTopic}</p>
                    <p className="mt-2 text-base text-gray-800">{currentQuestion}</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center space-y-4 py-4">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-400 border-t-transparent"></div>
                    <p className="text-sm text-gray-600">Getting your interview question...</p>
                  </div>
                )}
              </div>
            </div>
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
                  ref={videoRef}
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
                  disabled={isLoadingNextQuestion}
                >
                  {isLoadingNextQuestion ? "Loading..." : "Next Question"}
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
