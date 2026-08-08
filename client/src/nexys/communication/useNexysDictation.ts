import { useEffect, useRef, useState } from "react";

export function useNexysDictation(onTranscript: (text: string) => void) {
  const [isDictating, setIsDictating] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setSpeechSupported(Boolean(SpeechRecognition));
  }, []);

  function toggle() {
    if (!speechSupported) return;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (isDictating) {
      try {
        recognitionRef.current?.stop();
      } catch {
        /* already stopped */
      }
      setIsDictating(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0].transcript)
        .join("");
      onTranscript(transcript);
    };
    recognition.onend = () => setIsDictating(false);
    recognition.onerror = () => setIsDictating(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsDictating(true);
  }

  return { isDictating, speechSupported, toggle };
}
