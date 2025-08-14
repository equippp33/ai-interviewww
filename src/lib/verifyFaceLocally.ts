import * as faceapi from '@vladmandic/face-api';

export async function verifyFaceLocally(inputBase64: string, referenceBase64: string): Promise<{ match: boolean; distance: number }> {
  const loadImage = async (base64: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.src = base64;
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
    });

  const [inputImage, referenceImage] = await Promise.all([
    loadImage(inputBase64),
    loadImage(referenceBase64),
  ]);

  const inputDetection = await faceapi
    .detectSingleFace(inputImage)
    .withFaceLandmarks()
    .withFaceDescriptor();
  const referenceDetection = await faceapi
    .detectSingleFace(referenceImage)
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!inputDetection || !referenceDetection) {
    return {
    match: false,
    distance: 0.99,
  };
  }

  const distance = faceapi.euclideanDistance(
    inputDetection.descriptor,
    referenceDetection.descriptor
  );

  const match = distance < 0.5; 
  return { match, distance };
}