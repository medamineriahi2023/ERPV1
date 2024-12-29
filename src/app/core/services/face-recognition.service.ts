import { Injectable } from '@angular/core';
import * as faceapi from 'face-api.js';

@Injectable({
  providedIn: 'root'
})
export class FaceRecognitionService {
  private modelsLoaded = false;

  constructor() {}

  async loadModels() {
    if (this.modelsLoaded) return;

    try {
      const MODEL_URL = '/assets/models';
      
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
      ]);

      this.modelsLoaded = true;
      console.log('Face recognition models loaded successfully');
    } catch (error) {
      console.error('Error loading face recognition models:', error);
      throw error;
    }
  }

  async getFaceDescriptor(imageElement: HTMLImageElement | HTMLVideoElement): Promise<Float32Array | null> {
    if (!this.modelsLoaded) {
      await this.loadModels();
    }

    try {
      const detection = await faceapi
        .detectSingleFace(imageElement)
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        console.log('No face detected');
        return null;
      }

      return detection.descriptor;
    } catch (error) {
      console.error('Error getting face descriptor:', error);
      return null;
    }
  }

  async compareFaces(descriptor1: Float32Array, descriptor2: Float32Array): Promise<number> {
    return faceapi.euclideanDistance(descriptor1, descriptor2);
  }

  async verifyFace(videoElement: HTMLVideoElement, referenceImage: HTMLImageElement): Promise<boolean> {
    try {
      await this.loadModels();

      // Get face detections
      const [referenceDetection, videoDetection] = await Promise.all([
        faceapi.detectSingleFace(referenceImage)
          .withFaceLandmarks()
          .withFaceDescriptor(),
        faceapi.detectSingleFace(videoElement)
          .withFaceLandmarks()
          .withFaceDescriptor()
      ]);

      if (!referenceDetection || !videoDetection) {
        console.error('No face detected in one or both images');
        return false;
      }

      // Calculate face similarity
      const distance = faceapi.euclideanDistance(
        referenceDetection.descriptor,
        videoDetection.descriptor
      );

      // Threshold for face matching (lower means more strict)
      const THRESHOLD = 0.6;
      const isMatch = distance < THRESHOLD;

      console.log('Face verification distance:', distance, 'Match:', isMatch);
      return isMatch;

    } catch (error) {
      console.error('Error during face verification:', error);
      throw error;
    }
  }
}
