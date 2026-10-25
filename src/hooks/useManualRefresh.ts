import { useEffect, useRef } from 'react';
import { registerManualRefresh } from '@/lib/manualRefresh';

export function useManualRefresh(refresh: () => Promise<unknown> | unknown) {
  const current = useRef(refresh);
  current.current = refresh;
  useEffect(() => registerManualRefresh(() => current.current()), []);
}