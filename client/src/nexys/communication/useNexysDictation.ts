import { useCallback, useEffect, useRef, useState } from "react";

import {
  ForegroundVoiceController,
  type ForegroundVoiceSnapshot,
  type ForegroundVoiceSpeaker,
  type ForegroundVoiceSubmissionResult,
  type VoiceRecognitionLike,
} from "./foregroundVoice";

interface SpeechRecognitionConstructor {
  new (): VoiceRecognitionLike;
}

interface SpeechWindow extends Window {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}

export interface UseNexysForegroundVoiceOptions {
  readonly submitCommand: (command: string) => Promise<ForegroundVoiceSubmissionResult>;
  readonly cancelSubmission?: () => void;
}

const SERVER_SNAPSHOT: ForegroundVoiceSnapshot = {
  state: "unsupported",
  supported: false,
  active: false,
  detail: "Foreground voice is unavailable in this browser.",
  transcript: "",
};

/**
 * Owns the browser-only foreground voice session. Recognition is activated
 * only from the existing user-controlled microphone/Talk interaction and is
 * stopped on backgrounding, page hide, navigation, or component cleanup.
 */
export function useNexysForegroundVoice({
  submitCommand,
  cancelSubmission,
}: UseNexysForegroundVoiceOptions) {
  const submitCommandRef = useRef(submitCommand);
  const cancelSubmissionRef = useRef(cancelSubmission);
  const controllerRef = useRef<ForegroundVoiceController | null>(null);
  const [snapshot, setSnapshot] = useState<ForegroundVoiceSnapshot>(SERVER_SNAPSHOT);

  submitCommandRef.current = submitCommand;
  cancelSubmissionRef.current = cancelSubmission;

  useEffect(() => {
    const speechWindow = window as SpeechWindow;
    const Recognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    const speaker = createBrowserSpeaker(window);
    const controller = new ForegroundVoiceController({
      createRecognition: Recognition ? () => new Recognition() : undefined,
      speaker,
      submitCommand: (command) => submitCommandRef.current(command),
      cancelSubmission: () => cancelSubmissionRef.current?.(),
    });

    controllerRef.current = controller;
    const unsubscribe = controller.subscribe(setSnapshot);

    const stopForBackground = () => {
      if (document.visibilityState !== "visible") controller.suspend();
    };
    const stopForPageHide = () => controller.suspend();

    document.addEventListener("visibilitychange", stopForBackground);
    window.addEventListener("pagehide", stopForPageHide);

    return () => {
      document.removeEventListener("visibilitychange", stopForBackground);
      window.removeEventListener("pagehide", stopForPageHide);
      unsubscribe();
      controller.destroy();
      controllerRef.current = null;
    };
  }, []);

  const toggle = useCallback(() => controllerRef.current?.toggle(), []);
  const deactivate = useCallback(() => controllerRef.current?.deactivate("user"), []);

  return {
    ...snapshot,
    toggle,
    deactivate,
  };
}

function createBrowserSpeaker(browserWindow: Window): ForegroundVoiceSpeaker | undefined {
  if (!("speechSynthesis" in browserWindow) || !("SpeechSynthesisUtterance" in browserWindow)) {
    return undefined;
  }

  return {
    speak(text, onEnd, onError) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onend = onEnd;
      utterance.onerror = onError;
      browserWindow.speechSynthesis.speak(utterance);
    },
    cancel() {
      browserWindow.speechSynthesis.cancel();
    },
  };
}
