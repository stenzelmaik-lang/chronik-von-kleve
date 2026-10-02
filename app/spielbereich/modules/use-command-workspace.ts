"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CommandWorkspace, WorkspaceMode, WorkspaceView } from '@/domain/command-workspace';
import { api, ApiError } from './api-client';

// Persist only layout and entity references. Document contents never enter browser storage.
export function useCommandWorkspace(mode: WorkspaceMode, windowRole: 'main' | 'companion', onDenied: () => void) {
  const [view, setView] = useState<WorkspaceView | null>(null), [dirty, setDirty] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const current = useRef<WorkspaceView | null>(null), changed = useRef(false), inFlight = useRef(false), generation = useRef(0), denied = useRef(onDenied);
  useEffect(() => { denied.current = onDenied; }, [onDenied]);
  const load = useCallback(async () => {
    const token = ++generation.current;
    await Promise.resolve();
    if (generation.current !== token) return;
    current.current = null; changed.current = false; setView(null); setDirty(false); setError('');
    try {
      const result = await api<WorkspaceView>(`/api/command-center/workspace?mode=${mode}&windowRole=${windowRole}`);
      if (generation.current === token) { current.current = result; setView(result); }
    } catch (e) { if (generation.current === token) { setError((e as Error).message); if (e instanceof ApiError && [401, 403].includes(e.status)) denied.current(); } }
  }, [mode, windowRole]);
  const cancelLoad = useCallback(() => { generation.current++; }, []);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => { window.clearTimeout(timer); cancelLoad(); }; }, [load, cancelLoad]);
  const change = useCallback((update: (workspace: CommandWorkspace) => CommandWorkspace) => {
    if (!current.current) return;
    const next = { ...current.current, workspace: update(current.current.workspace) };
    current.current = next; changed.current = true; setView(next); setDirty(true); setError('');
  }, []);
  const save = useCallback(async (): Promise<boolean> => {
    if (inFlight.current) return false;
    const sent = current.current;
    if (!sent || !changed.current) return !changed.current;
    const token = generation.current; inFlight.current = true; setBusy(true); setError('');
    try {
      const result = await api<WorkspaceView>('/api/command-center/workspace', 'POST', { mode: sent.mode, windowRole: sent.windowRole, version: sent.version, workspace: sent.workspace });
      if (token !== generation.current) return false;
      const latest = current.current!;
      const stillDirty = JSON.stringify(latest.workspace) !== JSON.stringify(sent.workspace);
      current.current = { ...result, workspace: stillDirty ? latest.workspace : result.workspace };
      changed.current = stillDirty; setView(current.current); setDirty(stillDirty); return true;
    } catch (e) {
      if (token === generation.current) { setError((e as Error).message); if (e instanceof ApiError && [401, 403].includes(e.status)) denied.current(); }
      return false;
    } finally { inFlight.current = false; setBusy(false); }
  }, []);
  useEffect(() => { if (!dirty || busy || error) return; const timer = window.setTimeout(() => void save(), 650); return () => window.clearTimeout(timer); }, [dirty, busy, error, view, save]);
  return { view, change, save, load, dirty, busy, error };
}
