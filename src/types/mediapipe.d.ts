// src/types/mediapipe.d.ts

export interface NormalizedLandmark {
  x: number
  y: number
  z: number
}

export type NormalizedLandmarkList = NormalizedLandmark[]

export interface HandsResults {
  multiHandLandmarks: NormalizedLandmarkList[]
  multiHandWorldLandmarks: NormalizedLandmarkList[]
  multiHandedness: Array<{
    label: 'Left' | 'Right'
    score: number
  }>
}

export interface FaceMeshResults {
  multiFaceLandmarks: NormalizedLandmarkList[]
}

export interface HandsOptions {
  maxNumHands: number
  modelComplexity: 0 | 1
  minDetectionConfidence: number
  minTrackingConfidence: number
}

export interface FaceMeshOptions {
  maxNumFaces: number
  refineLandmarks: boolean
  minDetectionConfidence: number
  minTrackingConfidence: number
}

export interface MediaPipeLocateFileConfig {
  locateFile: (file: string) => string
}

export declare class MediaPipeHands {
  constructor(config: MediaPipeLocateFileConfig)
  setOptions(options: HandsOptions): void
  onResults(callback: (results: HandsResults) => void): void
  send(data: { image: HTMLVideoElement }): Promise<void>
  close(): void
}

export declare class MediaPipeFaceMesh {
  constructor(config: MediaPipeLocateFileConfig)
  setOptions(options: FaceMeshOptions): void
  onResults(callback: (results: FaceMeshResults) => void): void
  send(data: { image: HTMLVideoElement }): Promise<void>
  close(): void
}

export interface MediaPipeCameraOptions {
  onFrame: () => Promise<void>
  width: number
  height: number
}

export declare class MediaPipeCamera {
  constructor(videoElement: HTMLVideoElement, options: MediaPipeCameraOptions)
  start(): Promise<void>
  stop(): void
}

declare global {
  interface Window {
    Hands: typeof MediaPipeHands
    FaceMesh: typeof MediaPipeFaceMesh
    Camera: typeof MediaPipeCamera
  }
}