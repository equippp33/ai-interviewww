// import { useState } from "react";
// import axios, { AxiosError } from "axios";
// import { api } from "@/trpc/react";
// import mime from "mime-types";
// import { useToast } from "@/components/ui/use-toast";

// const useUpload = ({
//   files,
//   callback,
// }: {
//   files: File[] | null;
//   callback?: (id: string) => void;
// }) => {
//   const [uploading, setUploading] = useState(false);
//   const { toast } = useToast();

//   const { mutate: getUploadURL } = api.user.getUploadURL.useMutation({
//     onSuccess(data) {
//       if (data.success) {
//         try {
//           const url = data?.uploadParams ?? "";
//           const id = data?.id ?? "";

//           if (!files || files.length === 0)
//             return toast({ title: "No files to upload" });

//           void Promise.all(files.map((file) => uploadFile(url, file, id)))
//             .then(() => {
//               if (callback) callback(id);
//             })
//             .catch((error) => {
//               setUploading(false);

//               if (error instanceof AxiosError) {
//                 console.log(error.response?.data);
//                 toast({
//                   type: "foreground",
//                   title:
//                     "Error in Uploading: " +
//                     "Please check your network connection and try again later",
//                 });
//               } else {
//                 toast({
//                   type: "foreground",
//                   title: "Error in Uploading",
//                 });
//               }
//             });
//         } catch (error) {
//           setUploading(false);
//           toast({
//             type: "foreground",
//             title: "Error in Uploading",
//           });
//         }
//       } else {
//         setUploading(false);
//         toast({
//           type: "foreground",
//           title: data?.error ?? "Error in Uploading",
//         });
//       }
//     },
//     onError(error) {
//       setUploading(false);
//       toast({
//         title: error.message ?? "Error in Uploading",
//       });
//     },
//   });

//   const uploadFile = async (url: string, file: File, id: string) => {
//     const contentType: string | false = mime.lookup(file.name);

//     const tryUpload = async ({ url }: { url: string }) => {
//       await axios.put(`${url}`, file, {
//         headers: { "Content-Type": contentType ?? "image/png" },
//       });
//     };

//     try {
//       await tryUpload({ url: url });
//     } catch (error) {
//       try {
//         await tryUpload({
//           url: url.replace(
//             "https://3-0-images.d5665e8d9c503924f37c1a4eb77ef48f.r2.cloudflarestorage.com",
//             "https://upload.equippp.global",
//           ),
//         });
//       } catch (error) {
//         toast({
//           title: "Error in Uploading",
//           // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
//           description: `${error}`,
//         });
//       }
//     } finally {
//       setUploading(false);
//     }
//   };

//   const handleUpload = ({ folderName }: { folderName: string }) => {
//     setUploading(true);
//     getUploadURL({ folderName });
//   };

//   return { handleUpload, uploading };
// };

// export default useUpload;
