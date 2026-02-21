'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAutoPolling } from '@/hooks/use-auto-polling';

function createBeepSound(): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null;

  try {
    const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const duration = 0.3;
    const sampleRate = audioContext.sampleRate;
    const numSamples = Math.floor(duration * sampleRate);
    const buffer = audioContext.createBuffer(1, numSamples, sampleRate);
    const channel = buffer.getChannelData(0);

    // Generate a pleasant two-tone chime
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const envelope = Math.exp(-t * 8); // Quick decay
      const tone1 = Math.sin(2 * Math.PI * 880 * t); // A5
      const tone2 = Math.sin(2 * Math.PI * 1108.73 * t); // C#6
      channel[i] = (tone1 * 0.5 + tone2 * 0.5) * envelope * 0.4;
    }

    // Convert AudioBuffer to WAV blob
    const wavBlob = audioBufferToWav(buffer);
    const url = URL.createObjectURL(wavBlob);
    const audio = new Audio(url);
    audio.volume = 0.7;
    return audio;
  } catch {
    return null;
  }
}

function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const data = buffer.getChannelData(0);
  const dataLength = data.length * bytesPerSample;
  const headerLength = 44;
  const totalLength = headerLength + dataLength;

  const arrayBuffer = new ArrayBuffer(totalLength);
  const view = new DataView(arrayBuffer);

  // WAV header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, totalLength - 8, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataLength, true);

  // Write PCM samples
  let offset = 44;
  for (let i = 0; i < data.length; i++) {
    const sample = Math.max(-1, Math.min(1, data[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
    offset += 2;
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

type UseHandoffAlertsReturn = {
  /** Conversation IDs with unacknowledged handoffs (need attention) */
  alertingIds: Set<string>;
  /** All conversation IDs that have a handoff */
  allHandoffIds: Set<string>;
  /** Mark a conversation as acknowledged (user clicked it) */
  acknowledge: (conversationId: string) => void;
};

export function useHandoffAlerts(): UseHandoffAlertsReturn {
  const [allHandoffIds, setAllHandoffIds] = useState<Set<string>>(new Set());
  const [acknowledgedIds, setAcknowledgedIds] = useState<Set<string>>(new Set());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prevHandoffIdsRef = useRef<Set<string>>(new Set());

  // Initialize audio on mount
  useEffect(() => {
    audioRef.current = createBeepSound();
  }, []);

  const fetchHandoffs = useCallback(async () => {
    try {
      const response = await fetch('/api/conversations/handoffs');
      if (!response.ok) return;

      const data = await response.json();
      const newIds = new Set<string>(data.handoffConversationIds || []);

      // Detect brand-new handoffs (not previously known and not acknowledged)
      const prevIds = prevHandoffIdsRef.current;
      let hasNew = false;
      for (const id of newIds) {
        if (!prevIds.has(id) && !acknowledgedIds.has(id)) {
          hasNew = true;
          break;
        }
      }

      if (hasNew && audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {
          // Browser may block autoplay until user interaction
        });
      }

      prevHandoffIdsRef.current = newIds;
      setAllHandoffIds(newIds);
    } catch (error) {
      console.error('Error fetching handoffs:', error);
    }
  }, [acknowledgedIds]);

  useAutoPolling({
    interval: 10000,
    enabled: true,
    onPoll: fetchHandoffs
  });

  const acknowledge = useCallback((conversationId: string) => {
    setAcknowledgedIds((prev) => new Set([...prev, conversationId]));
  }, []);

  // Compute alerting set: handoffs that haven't been acknowledged
  const alertingIds = new Set(
    [...allHandoffIds].filter((id) => !acknowledgedIds.has(id))
  );

  return { alertingIds, allHandoffIds, acknowledge };
}
