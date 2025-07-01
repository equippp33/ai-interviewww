import { type FC, useState, useRef, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";

interface ConsentScreenProps {
  onConsent: (stream: MediaStream) => void;
}

const ConsentScreen: FC<ConsentScreenProps> = ({ onConsent }) => {
  const [hasPermissions, setHasPermissions] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const requestPermissions = async () => {
    try {
      console.log("Requesting permissions...");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      console.log("Stream obtained:", stream);

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setHasPermissions(true);
    } catch (error) {
      console.error("Error accessing media devices:", error);
      setHasPermissions(false);
    }
  };

  // Cleanup function
  useEffect(() => {
    return () => {
      if (streamRef.current && !hasPermissions) {
        streamRef.current.getTracks().forEach((track) => {
          track.stop();
        });
      }
    };
  }, [hasPermissions]);

  // Video container section
  const renderVideoContainer = () => (
    <div className="relative h-[300px] w-full overflow-hidden rounded-2xl bg-gray-100">
      {!hasPermissions ? (
        <button
          onClick={requestPermissions}
          className="absolute inset-0 flex items-center justify-center bg-gray-100 text-gray-600 hover:bg-gray-200"
        >
          <span className="text-center">
            Click to enable
            <br />
            camera & microphone
          </span>
        </button>
      ) : (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="h-full w-full object-cover"
        />
      )}
    </div>
  );

  // Add this useEffect to handle video stream after permissions are granted
  useEffect(() => {
    if (hasPermissions && videoRef.current && !videoRef.current.srcObject) {
      void requestPermissions();
    }
  }, [hasPermissions]);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-[#f2f1f6] ">
      <div className="w-full max-w-6xl rounded-3xl bg-white p-8 shadow-lg">
        {/* Top Section with Logo */}
        <div className="mb-8 grid grid-cols-2 gap-8">
          <div className="relative h-[300px] w-full overflow-hidden rounded-2xl bg-red-500">
            <Image
              src="/assets/images/eq.png"
              alt="Virtual Interview Logo"
              fill
              className="m-0 h-full w-full object-cover p-0"
              priority
            />
          </div>
          <div className="flex flex-col justify-center">
            <h1 className="mb-2 text-3xl font-bold">Hey! its your</h1>
            <h2 className="mb-4 text-4xl font-bold">Virtual Interview</h2>
            <p className="text-lg text-gray-600">Welcome to the session!</p>
          </div>
        </div>

        {/* Bottom Section with Features */}
        <div className="grid grid-cols-2 gap-8">
          {renderVideoContainer()}
          <div className="flex flex-col justify-between">
            <div>
              <h3 className="mb-4 text-xl font-semibold">
                Key Features to be known before starting
              </h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• Your video and audio will be recorded</li>
                <li>• The interview will last for 15 minutes</li>
                <li>• Your responses will be analyzed by AI</li>
              </ul>
            </div>

            <div className="space-y-4">
              <p className="text-sm text-gray-500">
                By participating in this session{" "}
                <Link
                  href="/privacy-policy"
                  className="text-indigo-600 hover:text-indigo-700"
                >
                  Privacy policy
                </Link>
              </p>

              <button
                onClick={() => {
                  if (streamRef.current) {
                    onConsent(streamRef.current);
                  }
                }}
                disabled={!hasPermissions}
                className={`w-full rounded-full px-6 py-3 text-center text-lg font-medium text-white transition-all ${
                  hasPermissions
                    ? "bg-indigo-600 hover:bg-indigo-700"
                    : "cursor-not-allowed bg-gray-400"
                }`}
              >
                Lets get started !
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConsentScreen;
