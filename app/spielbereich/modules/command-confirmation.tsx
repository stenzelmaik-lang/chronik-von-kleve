"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';

// One accessible, non-blocking confirmation surface for the private workspace.
export function useCommandConfirmation() {
  const [question, setQuestion] = useState<string | null>(null);
  const pending = useRef<((accepted: boolean) => void) | null>(null);
  const finish = useCallback((accepted: boolean) => { const resolve = pending.current; pending.current = null; setQuestion(null); resolve?.(accepted); }, []);
  const ask = useCallback((text: string) => new Promise<boolean>(resolve => {
    pending.current?.(false); pending.current = resolve; setQuestion(text);
  }), []);
  useEffect(() => () => { pending.current?.(false); pending.current = null; }, []);
  return { ask, cancel: useCallback(() => finish(false), [finish]), dialog: <AlertDialog open={question !== null} onOpenChange={open => { if (!open) finish(false); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Aktion bewusst bestätigen</AlertDialogTitle><AlertDialogDescription>{question}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel onClick={() => finish(false)}>Abbrechen</AlertDialogCancel><AlertDialogAction onClick={() => finish(true)}>Bestätigen</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog> };
}
