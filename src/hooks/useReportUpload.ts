// "use client";

// import { useState } from "react";
// import axios from "axios";
// import { toast } from "@/components/ui/use-toast";
// import { api } from "@/trpc/react";

// const useReportUpload = ({
//   pdfBytes,
//   callback,
// }: {
//   pdfBytes: Uint8Array | null;
//   callback?: (url: string) => void;
// }) => {
//   const [uploading, setUploading] = useState(false);

//   const { mutate: getUploadURL } = api.user.getUploadURL.useMutation({
//     onSuccess: async (data) => {
//       if (data.success && data.uploadParams && data.id) {
//         try {
//           const MAX_SIZE_MB = 10;
//           if (!pdfBytes) {
//             return toast({ title: "No PDF data to upload" });
//           }

//           const fileSizeMB = pdfBytes.length / 1024 / 1024;
//           if (fileSizeMB > MAX_SIZE_MB) {
//             throw new Error(
//               `PDF size (${fileSizeMB.toFixed(2)}MB) exceeds maximum allowed size of ${MAX_SIZE_MB}MB`,
//             );
//           }

//           // Create file from PDF bytes
//           const file = new Blob([pdfBytes], { type: "application/pdf" });

//           // Upload to R2
//           await axios.put(data.uploadParams, file, {
//             headers: {
//               "Content-Type": "application/pdf",
//             },
//             maxBodyLength: 10 * 1024 * 1024, // 10MB in bytes
//             maxContentLength: 10 * 1024 * 1024, // 10MB in bytes
//           });

//           const publicUrl = `https://images.equippp.global/reports/${data.id}`;
//           if (callback) callback(publicUrl);
//           setUploading(false);
//         } catch (error) {
//           setUploading(false);
//           toast({
//             type: "foreground",
//             title:
//               error instanceof Error ? error.message : "Error in uploading PDF",
//           });
//         }
//       } else {
//         setUploading(false);
//         toast({
//           type: "foreground",
//           title: data?.error ?? "Error in uploading PDF",
//         });
//       }
//     },
//     onError(error) {
//       setUploading(false);
//       toast({
//         title: error.message ?? "Error in uploading PDF",
//       });
//     },
//   });

//   const handleUpload = () => {
//     setUploading(true);
//     getUploadURL({
//       folderName: "reports",
//     });
//   };

//   return { handleUpload, uploading };
// };

// export default useReportUpload;
