import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

type UseRealtimeSyncOptions = {
  onDataChange: () => void;
};

type UseRealtimeSyncReturn = {
  realtimeConnected: boolean;
};

const INITIAL_RETRY_DELAY = 3000;
const MAX_RETRY_DELAY = 30000;
const DEBOUNCE_MS = 500;

export function useRealtimeSync({ onDataChange }: UseRealtimeSyncOptions): UseRealtimeSyncReturn {
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const supabase = useMemo(() => createClient(), []);

  // Refs for lifecycle management
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryDelayRef = useRef(INITIAL_RETRY_DELAY);
  const isMountedRef = useRef(true);

  // Stable ref for onDataChange to avoid re-subscribing on callback identity changes
  const onDataChangeRef = useRef(onDataChange);
  onDataChangeRef.current = onDataChange;

  const triggerDataChange = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        onDataChangeRef.current();
      }
    }, DEBOUNCE_MS);
  }, []);

  const subscribe = useCallback(() => {
    if (!isMountedRef.current) return;

    // Clean up any existing channel before creating a new one
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase
      .channel('realtime:metadata-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversation_metadata' },
        () => triggerDataChange()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversation_contact_labels' },
        () => triggerDataChange()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'contacts' },
        () => triggerDataChange()
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'conversation_notes' },
        () => triggerDataChange()
      )
      .subscribe((status) => {
        if (!isMountedRef.current) return;

        if (status === 'SUBSCRIBED') {
          setRealtimeConnected(true);
          retryDelayRef.current = INITIAL_RETRY_DELAY;
        } else if (
          status === 'CHANNEL_ERROR' ||
          status === 'TIMED_OUT' ||
          status === 'CLOSED'
        ) {
          setRealtimeConnected(false);

          // Schedule reconnect with exponential backoff
          if (retryTimerRef.current) {
            clearTimeout(retryTimerRef.current);
          }
          const delay = retryDelayRef.current;
          retryDelayRef.current = Math.min(delay * 2, MAX_RETRY_DELAY);

          retryTimerRef.current = setTimeout(() => {
            if (isMountedRef.current) {
              subscribe();
            }
          }, delay);
        }
      });

    channelRef.current = channel;
  }, [supabase, triggerDataChange]);

  useEffect(() => {
    isMountedRef.current = true;

    subscribe();

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Tab became visible — reconnect with fresh token and refresh data
        if (retryTimerRef.current) {
          clearTimeout(retryTimerRef.current);
          retryTimerRef.current = null;
        }
        retryDelayRef.current = INITIAL_RETRY_DELAY;
        subscribe();
        // Immediately refresh stale data
        onDataChangeRef.current();
      }
      // When tab becomes hidden: do nothing (keep subscription alive)
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMountedRef.current = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);

      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [subscribe, supabase]);

  return { realtimeConnected };
}
