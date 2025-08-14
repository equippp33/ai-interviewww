import * as faceapi from '@vladmandic/face-api';

let modelsAreLoaded = false;

export async function ensureFaceModelsAreLoaded() {
  if (modelsAreLoaded) return;

  await Promise.all([
    faceapi.nets.ssdMobilenetv1.loadFromUri('/models/ssd_mobilenetv1'),
    faceapi.nets.faceLandmark68Net.loadFromUri('/models/face_landmark_68_model'),
    faceapi.nets.faceRecognitionNet.loadFromUri('/models/face_recognition_model'),
  ]);

  modelsAreLoaded = true;
  console.log('✅ FaceAPI models loaded');
}