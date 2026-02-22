import { useEffect, useRef, useCallback, useState } from 'react';

type UseAutoPollingOptions = {
  interval?: number;
  enabled?: boolean;
  onPoll: () => void | Promise<void>;
};

export function useAutoPolling({ interval = 5000, enabled = true, onPoll }: UseAutoPollingOptions) {
  const [isPolling, setIsPolling] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentIntervalRef = useRef(interval);
  const baseIntervalRef = useRef(interval);

  // Sync interval refs when the interval prop changes (e.g. 10s → 5s fallback)
  useEffect(() => {
    baseIntervalRef.current = interval;
    currentIntervalRef.current = interval;
  }, [interval]);

  const resetBackoff = useCallback(() => {
    currentIntervalRef.current = baseIntervalRef.current;
  }, []);

  const increaseBackoff = useCallback(() => {
    const maxInterval = 60000;
    currentIntervalRef.current = Math.min(currentIntervalRef.current * 2, maxInterval);
  }, []);

  const startPolling = useCallback(() => {
    if (!enabled) return;

    setIsPolling(true);

    const poll = async () => {
      try {
        await onPoll();
        resetBackoff();
      } catch (error) {
        console.error('Polling error:', error);
        increaseBackoff();
      }

      // Reschedule with current interval (may have changed due to backoff)
      if (intervalRef.current) {
        clearTimeout(intervalRef.current);
      }
      intervalRef.current = setTimeout(poll, currentIntervalRef.current);
    };

    // Poll immediately
    poll();
  }, [enabled, onPoll, resetBackoff, increaseBackoff]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearTimeout(intervalRef.current);
      intervalRef.current = null;
    }
    setIsPolling(false);
    resetBackoff();
  }, [resetBackoff]);

  // Handle visibility change (pause when tab is hidden)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsPaused(true);
        stopPolling();
      } else {
        setIsPaused(false);
        if (enabled) {
          startPolling();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, startPolling, stopPolling]);

  // Start/stop polling based on enabled flag
  useEffect(() => {
    if (enabled && !document.hidden) {
      startPolling();
    } else {
      stopPolling();
    }

    return () => {
      stopPolling();
    };
  }, [enabled, startPolling, stopPolling]);

  return {
    isPolling,
    isPaused
  };
}
