import { useState, useRef } from "react";
import axios, { AxiosError } from "axios";
import { toast } from "sonner";
import { api } from "@/trpc/react";

const useInterviewUpload = (callback: (url: string) => void) => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const { mutate: getUploadURL } = api.user.getUploadURL.useMutation({
    onSuccess(data) {
      if (!data.success || !data.uploadParams || !data.id) {
        setUploading(false);
        setUploadProgress(0);
        toast( "Upload failed: Invalid response");
        return;
      }

      const url = data.uploadParams;
      const id = data.id;
      const interviewUrl = `https://images.equippp.global/interviews/${id}`;

      void uploadFile(url, id)
        .then(() => {
          setUploadProgress(100);
          callback(interviewUrl);
        })
        .catch((error) => {
          setUploading(false);
          setUploadProgress(0);

          if (error instanceof AxiosError) {
            console.error("Upload error:", error.response?.data);
            toast(
            "Error in Uploading: Please try again later");
          } else {
            console.error("Upload error:", error);
            toast(
              "Error in Uploading");
          }
        });
    },
    onError(error) {
      setUploading(false);
      setUploadProgress(0);
      toast( "Upload failed");
    },
  });

  const uploadFile = async (url: string, id: string) => {
    if (!blobRef.current) {
      throw new Error("No recording found");
    }

    const contentType = "video/webm";
    const file = new File([blobRef.current], `interview-${Date.now()}.webm`, {
      type: contentType,
    });

    const upload = async (uploadUrl: string) => {
      await axios.put(uploadUrl, file, {
        headers: { "Content-Type": contentType },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / (progressEvent.total ?? 0),
          );
          setUploadProgress(percentCompleted);
        },
      });
    };

    try {
      // Try primary URL
      await upload(url);
    } catch (primaryError) {
      // Try fallback URL
      const fallbackUrl = url.replace(
        "https://3-0-images.d5665e8d9c503924f37c1a4eb77ef48f.r2.cloudflarestorage.com",
        "https://upload.equippp.global",
      );

      try {
        await upload(fallbackUrl);
      } catch (fallbackError) {
        console.error("Upload failed on both URLs:", {
          primaryError,
          fallbackError,
        });
        throw new Error("Upload failed on both primary and fallback URLs");
      }
    } finally {
      setUploading(false);
    }
  };

  // Store blob reference
  const blobRef = useRef<Blob | null>(null);

  const handleUpload = (blob: Blob) => {
    blobRef.current = blob;
    setUploading(true);
    setUploadProgress(0);
    getUploadURL({ folderName: "interviews" });
  };

  return { uploadInterview: handleUpload, uploading, uploadProgress };
};

export default useInterviewUpload;
