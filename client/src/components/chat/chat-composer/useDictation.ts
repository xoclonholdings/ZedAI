import { useEffect, useRef, useState } from "react";

/**
 * Web Speech API dictation toggle. Returns whether speech recognition
 * is available in this browser, whether we're currently listening,
 * and a toggle that pipes transcripts into the caller via `onTranscript`.
 *
 * Safari/iOS expose this under the webkit prefix; we probe both at
 * mount so the mic button can hide when unsupported.
 */
export function useDictation(onTranscript: (text: string) => void) {
  const [isDictating, setIsDictating] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setSpeechSupported(!!SR);
  }, []);

  function toggle() {
    if (!speechSupported) return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (isDictating) {
      try {
        recognitionRef.current?.stop();
      } catch {
        /* stop() can throw if recog already ended — safe to ignore */
      }
      setIsDictating(false);
      return;
    }
    const recog = new SR();
    recog.continuous = false;
    recog.interimResults = true;
    recog.lang = "en-US";
    recog.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((r: any) => r[0].transcript)
        .join("");
      onTranscript(transcript);
    };
    recog.onend = () => setIsDictating(false);
    recog.onerror = () => setIsDictating(false);
    recognitionRef.current = recog;
    recog.start();
    setIsDictating(true);
  }

  return { isDictating, speechSupported, toggle };
}
