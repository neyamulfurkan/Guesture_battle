'use client'

import { useCallback } from 'react'
import { create } from 'zustand'
import {
  CANVAS_FRAME_TIME_WARN,
  CANVAS_FRAME_TIME_CRITICAL,
  CANVAS_PERFORMANCE_SAMPLE_FRAMES,
  MEDIAPIPE_SLOW_DEVICE_TOTAL_MS,
  MEDIAPIPE_SLOW_DEVICE_FRAMES,
} from '@/lib/gameConstants'

// ─── Zustand store ────────────────────────────────────────────────────────────

interface PerformanceStore {
  isSlowDevice: boolean
  gestureFrameTimes: number[]
  canvasFrameTimes: number[]
  setIsSlowDevice: (value: boolean) => void
  recordGestureFrameTime: (ms: number) => void
  recordCanvasFrameTime: (ms: number) => void
}

export const usePerformanceStore = create<PerformanceStore>((set) => ({
  isSlowDevice: false,
  gestureFrameTimes: [],
  canvasFrameTimes: [],

  setIsSlowDevice: (value) => set({ isSlowDevice: value }),

  recordGestureFrameTime: (ms) =>
    set((state) => {
      const updated = [...state.gestureFrameTimes, ms].slice(-MEDIAPIPE_SLOW_DEVICE_FRAMES)
      const isSlowDevice =
        !state.isSlowDevice &&
        updated.length >= MEDIAPIPE_SLOW_DEVICE_FRAMES &&
        updated.reduce((sum, t) => sum + t, 0) > MEDIAPIPE_SLOW_DEVICE_TOTAL_MS
      return {
        gestureFrameTimes: updated,
        isSlowDevice: state.isSlowDevice || isSlowDevice,
      }
    }),

  recordCanvasFrameTime: (ms) =>
    set((state) => ({
      canvasFrameTimes: [...state.canvasFrameTimes, ms].slice(-CANVAS_PERFORMANCE_SAMPLE_FRAMES),
    })),
}))

// ─── Hook ─────────────────────────────────────────────────────────────────────

type PerformanceMode = 'full' | 'reduced' | 'minimal'

interface UsePerformanceMonitorResult {
  isSlowDevice: boolean
  performanceMode: PerformanceMode
  avgFrameTime: number
}

export function usePerformanceMonitor(): UsePerformanceMonitorResult {
  const isSlowDevice = usePerformanceStore((s) => s.isSlowDevice)
  const canvasFrameTimes = usePerformanceStore((s) => s.canvasFrameTimes)

  const avgFrameTime =
    canvasFrameTimes.length === 0
      ? 0
      : canvasFrameTimes.reduce((sum, t) => sum + t, 0) / canvasFrameTimes.length

  let performanceMode: PerformanceMode = 'full'
  if (avgFrameTime >= CANVAS_FRAME_TIME_CRITICAL) {
    performanceMode = 'minimal'
  } else if (avgFrameTime >= CANVAS_FRAME_TIME_WARN) {
    performanceMode = 'reduced'
  }

  return { isSlowDevice, performanceMode, avgFrameTime }
}

// ─── Convenience reporters (called by sibling hooks) ─────────────────────────

export function useReportGestureFrameTime(): (ms: number) => void {
  return usePerformanceStore(useCallback((s) => s.recordGestureFrameTime, []))
}

export function useReportCanvasFrameTime(): (ms: number) => void {
  return usePerformanceStore(useCallback((s) => s.recordCanvasFrameTime, []))
}