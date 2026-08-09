export type ForegroundVoiceState =
  | "idle"
  | "requesting-permission"
  | "armed"
  | "listening"
  | "processing"
  | "speaking"
  | "cancelled"
  | "unsupported"
  | "failed";

export interface ForegroundVoiceSnapshot {
  readonly state: ForegroundVoiceState;
  readonly supported: boolean;
  readonly active: boolean;
  readonly detail: string | null;
  readonly transcript: string;
}

export interface ForegroundVoiceSubmissionResult {
  readonly status: "completed" | "failed" | "aborted" | "handled" | "ignored";
  readonly responseText: string | null;
}

export interface ForegroundVoiceConversationController {
  sendMessage(command: string): Promise<ForegroundVoiceSubmissionResult>;
}

export interface VoiceRecognitionAlternativeLike {
  readonly transcript: string;
}

export interface VoiceRecognitionResultLike {
  readonly isFinal: boolean;
  readonly length: number;
  readonly [index: number]: VoiceRecognitionAlternativeLike;
}

export interface VoiceRecognitionResultEventLike {
  readonly resultIndex: number;
  readonly results: ArrayLike<VoiceRecognitionResultLike>;
}

export interface VoiceRecognitionErrorEventLike {
  readonly error?: string;
  readonly message?: string;
}

export interface VoiceRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onresult: ((event: VoiceRecognitionResultEventLike) => void) | null;
  onerror: ((event: VoiceRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

export interface ForegroundVoiceSpeaker {
  speak(text: string, onEnd: () => void, onError: () => void): void;
  cancel(): void;
}

export interface ForegroundVoiceControllerOptions {
  readonly createRecognition?: () => VoiceRecognitionLike;
  readonly speaker?: ForegroundVoiceSpeaker;
  readonly submitCommand: (command: string) => Promise<ForegroundVoiceSubmissionResult>;
  readonly cancelSubmission?: () => void;
  readonly commandInactivityMs?: number;
  readonly restartDelayMs?: number;
  readonly now?: () => number;
  readonly schedule?: (callback: () => void, delayMs: number) => ReturnType<typeof setTimeout>;
  readonly cancelSchedule?: (timer: ReturnType<typeof setTimeout>) => void;
}

export type WakePhraseResult =
  | { readonly matched: false; readonly command: "" }
  | { readonly matched: true; readonly command: string };

const DEFAULT_COMMAND_INACTIVITY_MS = 6_000;
const DEFAULT_RESTART_DELAY_MS = 250;
const DUPLICATE_WINDOW_MS = 2_500;
const RESTART_WINDOW_MS = 10_000;
const MAX_RESTARTS_PER_WINDOW = 6;
const SLEEP_COMMANDS = new Set(["sleep", "go to sleep", "stop listening"]);
const FATAL_RECOGNITION_ERRORS = new Set([
  "audio-capture",
  "not-allowed",
  "service-not-allowed",
]);

export function parseZarWakePhrase(transcript: string): WakePhraseResult {
  const normalized = normalizeTranscript(transcript);
  const match = /^(?:hey[\s,]+)?zar\b[\s,.:;!?-]*(.*)$/i.exec(normalized);
  if (!match) return { matched: false, command: "" };
  return { matched: true, command: normalizeTranscript(match[1] || "") };
}

export function isVoiceSleepCommand(transcript: string): boolean {
  return SLEEP_COMMANDS.has(normalizeTranscript(transcript).toLowerCase());
}

export async function submitVoiceCommandThroughConversation(
  controller: ForegroundVoiceConversationController,
  command: string,
): Promise<ForegroundVoiceSubmissionResult> {
  return controller.sendMessage(command);
}

export class ForegroundVoiceController {
  private readonly createRecognition?: () => VoiceRecognitionLike;
  private readonly speaker?: ForegroundVoiceSpeaker;
  private readonly submitCommand: (command: string) => Promise<ForegroundVoiceSubmissionResult>;
  private readonly cancelSubmission?: () => void;
  private readonly commandInactivityMs: number;
  private readonly restartDelayMs: number;
  private readonly now: () => number;
  private readonly schedule: (callback: () => void, delayMs: number) => ReturnType<typeof setTimeout>;
  private readonly cancelSchedule: (timer: ReturnType<typeof setTimeout>) => void;
  private readonly listeners = new Set<(snapshot: ForegroundVoiceSnapshot) => void>();
  private readonly recentFinalTranscripts = new Map<string, number>();

  private snapshot: ForegroundVoiceSnapshot;
  private recognition: VoiceRecognitionLike | null = null;
  private restartTimer: ReturnType<typeof setTimeout> | null = null;
  private commandTimer: ReturnType<typeof setTimeout> | null = null;
  private unexpectedEnds: number[] = [];
  private generation = 0;
  private recognitionRunning = false;
  private recognitionStarting = false;
  private expectedRecognitionEnd = false;
  private awaitingCommand = false;
  private submissionInFlight = false;
  private permissionEstablished = false;
  private foreground = true;
  private destroyed = false;

  constructor(options: ForegroundVoiceControllerOptions) {
    this.createRecognition = options.createRecognition;
    this.speaker = options.speaker;
    this.submitCommand = options.submitCommand;
    this.cancelSubmission = options.cancelSubmission;
    this.commandInactivityMs = options.commandInactivityMs ?? DEFAULT_COMMAND_INACTIVITY_MS;
    this.restartDelayMs = options.restartDelayMs ?? DEFAULT_RESTART_DELAY_MS;
    this.now = options.now ?? Date.now;
    this.schedule = options.schedule ?? ((callback, delayMs) => setTimeout(callback, delayMs));
    this.cancelSchedule = options.cancelSchedule ?? ((timer) => clearTimeout(timer));

    const supported = Boolean(this.createRecognition && this.speaker);
    this.snapshot = {
      state: supported ? "idle" : "unsupported",
      supported,
      active: false,
      detail: supported ? null : "Foreground voice is unavailable in this browser.",
      transcript: "",
    };
  }

  getSnapshot(): ForegroundVoiceSnapshot {
    return this.snapshot;
  }

  subscribe(listener: (snapshot: ForegroundVoiceSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => this.listeners.delete(listener);
  }

  toggle(): void {
    if (this.snapshot.active) {
      this.deactivate("user");
      return;
    }
    this.activate();
  }

  activate(): void {
    if (this.destroyed) return;
    if (!this.snapshot.supported || !this.createRecognition || !this.speaker) {
      this.update({
        state: "unsupported",
        active: false,
        detail: "Foreground voice is unavailable in this browser.",
        transcript: "",
      });
      return;
    }

    this.generation += 1;
    this.foreground = true;
    this.awaitingCommand = false;
    this.submissionInFlight = false;
    this.unexpectedEnds = [];
    this.recentFinalTranscripts.clear();
    this.clearTimers();
    this.speaker.cancel();

    try {
      this.recognition = this.createRecognition();
      this.configureRecognition(this.recognition, this.generation);
    } catch {
      this.update({
        state: "failed",
        active: false,
        detail: "Voice activation could not start. Tap the microphone to try again.",
        transcript: "",
      });
      return;
    }

    this.update({
      state: this.permissionEstablished ? "armed" : "requesting-permission",
      active: true,
      detail: this.permissionEstablished ? "Say “ZAR” or “Hey ZAR”." : "Allow microphone access to activate ZAR voice.",
      transcript: "",
    });
    this.startRecognition();
  }

  deactivate(reason: "user" | "sleep" | "background" = "user"): void {
    if (this.destroyed) return;
    this.generation += 1;
    this.awaitingCommand = false;
    this.submissionInFlight = false;
    this.clearTimers();
    this.speaker?.cancel();
    this.stopRecognition(true);
    this.cancelSubmission?.();

    const detail = reason === "background"
      ? "Voice stopped when ZAR left the foreground."
      : reason === "sleep"
        ? "ZAR voice is asleep."
        : "Voice stopped.";
    this.update({
      state: "cancelled",
      active: false,
      detail,
      transcript: "",
    });
  }

  suspend(): void {
    this.foreground = false;
    if (this.snapshot.active) this.deactivate("background");
  }

  destroy(): void {
    if (this.destroyed) return;
    this.generation += 1;
    this.destroyed = true;
    this.foreground = false;
    this.awaitingCommand = false;
    this.submissionInFlight = false;
    this.clearTimers();
    this.speaker?.cancel();
    this.stopRecognition(true);
    this.cancelSubmission?.();
    this.update({
      state: "cancelled",
      active: false,
      detail: "Voice stopped.",
      transcript: "",
    });
    this.listeners.clear();
  }

  private configureRecognition(recognition: VoiceRecognitionLike, generation: number): void {
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onstart = () => {
      if (!this.isCurrent(generation)) return;
      this.recognitionRunning = true;
      this.recognitionStarting = false;
      this.expectedRecognitionEnd = false;
      this.permissionEstablished = true;
      this.update({
        state: this.awaitingCommand ? "listening" : "armed",
        active: true,
        detail: this.awaitingCommand ? "Listening for your command…" : "Say “ZAR” or “Hey ZAR”.",
      });
    };
    recognition.onresult = (event) => {
      if (!this.isCurrent(generation) || !this.snapshot.active) return;
      this.handleRecognitionResult(event, generation);
    };
    recognition.onerror = (event) => {
      if (!this.isCurrent(generation) || !this.snapshot.active) return;
      this.handleRecognitionError(event);
    };
    recognition.onend = () => {
      if (!this.isCurrent(generation)) return;
      this.recognitionRunning = false;
      this.recognitionStarting = false;

      if (this.expectedRecognitionEnd) {
        this.expectedRecognitionEnd = false;
        return;
      }
      if (!this.snapshot.active || !this.foreground || this.submissionInFlight) return;
      if (this.snapshot.state === "processing" || this.snapshot.state === "speaking") return;

      if (!this.registerRestartAttempt()) return;
      this.scheduleRestart();
    };
  }

  private handleRecognitionResult(event: VoiceRecognitionResultEventLike, generation: number): void {
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const result = event.results[index];
      const transcript = normalizeTranscript(result?.[0]?.transcript || "");
      if (!transcript) continue;

      this.update({ transcript });
      if (!result.isFinal || this.isDuplicateFinal(transcript)) continue;
      this.handleFinalTranscript(transcript, generation);
    }
  }

  private handleFinalTranscript(transcript: string, generation: number): void {
    if (!this.isCurrent(generation) || this.submissionInFlight) return;

    if (isVoiceSleepCommand(transcript)) {
      this.deactivate("sleep");
      return;
    }

    if (this.awaitingCommand) {
      const repeatedWake = parseZarWakePhrase(transcript);
      if (repeatedWake.matched && !repeatedWake.command) {
        this.beginCommandWindow();
        return;
      }
      const command = repeatedWake.matched ? repeatedWake.command : transcript;
      if (isVoiceSleepCommand(command)) {
        this.deactivate("sleep");
        return;
      }
      void this.processCommand(command, generation);
      return;
    }

    const wake = parseZarWakePhrase(transcript);
    if (!wake.matched) return;
    if (!wake.command) {
      this.beginCommandWindow();
      return;
    }
    if (isVoiceSleepCommand(wake.command)) {
      this.deactivate("sleep");
      return;
    }
    void this.processCommand(wake.command, generation);
  }

  private beginCommandWindow(): void {
    this.awaitingCommand = true;
    if (this.commandTimer) this.cancelSchedule(this.commandTimer);
    this.commandTimer = this.schedule(() => {
      this.commandTimer = null;
      if (!this.snapshot.active || this.submissionInFlight) return;
      this.awaitingCommand = false;
      this.update({
        state: "armed",
        detail: "Say “ZAR” or “Hey ZAR”.",
        transcript: "",
      });
      if (!this.recognitionRunning && !this.recognitionStarting) this.startRecognition();
    }, this.commandInactivityMs);
    this.update({
      state: "listening",
      detail: "Listening for your command…",
      transcript: "",
    });
  }

  private async processCommand(command: string, generation: number): Promise<void> {
    const normalized = normalizeTranscript(command);
    if (!normalized || this.submissionInFlight || !this.isCurrent(generation)) return;

    this.submissionInFlight = true;
    this.awaitingCommand = false;
    if (this.commandTimer) {
      this.cancelSchedule(this.commandTimer);
      this.commandTimer = null;
    }
    this.stopRecognition(true);
    this.update({
      state: "processing",
      detail: "ZAR is processing your command…",
      transcript: normalized,
    });

    let result: ForegroundVoiceSubmissionResult;
    try {
      result = await this.submitCommand(normalized);
    } catch {
      result = { status: "failed", responseText: null };
    }

    if (!this.isCurrent(generation) || !this.snapshot.active) return;
    this.submissionInFlight = false;

    if (result.status === "completed" && result.responseText?.trim()) {
      this.speakResponse(result.responseText.trim(), generation);
      return;
    }

    if (result.status === "handled" || result.status === "ignored") {
      this.returnToArmed();
      return;
    }

    this.fail(
      result.status === "aborted"
        ? "The voice request was cancelled. Tap the microphone to start again."
        : "ZAR could not complete that voice request. Tap the microphone to try again.",
    );
  }

  private speakResponse(responseText: string, generation: number): void {
    if (!this.speaker || !this.isCurrent(generation)) return;
    this.speaker.cancel();
    this.update({
      state: "speaking",
      detail: "ZAR is speaking…",
      transcript: "",
    });
    this.speaker.speak(
      responseText,
      () => {
        if (!this.isCurrent(generation) || !this.snapshot.active) return;
        this.returnToArmed();
      },
      () => {
        if (!this.isCurrent(generation) || !this.snapshot.active) return;
        this.fail("ZAR could not speak the response. Tap the microphone to try again.");
      },
    );
  }

  private returnToArmed(): void {
    if (!this.snapshot.active || !this.foreground) return;
    this.update({
      state: "armed",
      detail: "Say “ZAR” or “Hey ZAR”.",
      transcript: "",
    });
    this.startRecognition();
  }

  private handleRecognitionError(event: VoiceRecognitionErrorEventLike): void {
    const error = String(event.error || "unknown").toLowerCase();
    if (error === "aborted" && this.expectedRecognitionEnd) return;
    if (FATAL_RECOGNITION_ERRORS.has(error)) {
      const detail = error === "not-allowed" || error === "service-not-allowed"
        ? "Microphone access is required for foreground voice."
        : "No microphone is available for foreground voice.";
      this.fail(detail);
      return;
    }

    this.update({
      state: "failed",
      active: true,
      detail: "Voice recognition was interrupted. Reconnecting…",
    });
  }

  private fail(detail: string): void {
    this.generation += 1;
    this.awaitingCommand = false;
    this.submissionInFlight = false;
    this.clearTimers();
    this.speaker?.cancel();
    this.stopRecognition(true);
    this.update({
      state: "failed",
      active: false,
      detail,
      transcript: "",
    });
  }

  private scheduleRestart(): void {
    if (this.restartTimer) return;
    const generation = this.generation;
    this.restartTimer = this.schedule(() => {
      this.restartTimer = null;
      if (!this.isCurrent(generation) || !this.snapshot.active || !this.foreground) return;
      this.startRecognition();
    }, this.restartDelayMs);
  }

  private startRecognition(): void {
    if (
      !this.recognition ||
      !this.snapshot.active ||
      !this.foreground ||
      this.submissionInFlight ||
      this.recognitionRunning ||
      this.recognitionStarting
    ) return;

    this.expectedRecognitionEnd = false;
    this.recognitionStarting = true;
    try {
      this.recognition.start();
    } catch {
      this.recognitionStarting = false;
      if (!this.registerRestartAttempt()) return;
      this.scheduleRestart();
    }
  }

  private registerRestartAttempt(): boolean {
    const now = this.now();
    this.unexpectedEnds = this.unexpectedEnds.filter((time) => now - time <= RESTART_WINDOW_MS);
    this.unexpectedEnds.push(now);
    if (this.unexpectedEnds.length <= MAX_RESTARTS_PER_WINDOW) return true;
    this.fail("Voice recognition stopped repeatedly. Tap the microphone to try again.");
    return false;
  }

  private stopRecognition(abort: boolean): void {
    if (!this.recognition) return;
    this.expectedRecognitionEnd = true;
    this.recognitionRunning = false;
    this.recognitionStarting = false;
    try {
      if (abort) this.recognition.abort();
      else this.recognition.stop();
    } catch {
      // The browser may already have stopped recognition.
    }
  }

  private isDuplicateFinal(transcript: string): boolean {
    const normalized = transcript.toLowerCase();
    const now = this.now();
    for (const [value, time] of this.recentFinalTranscripts) {
      if (now - time > DUPLICATE_WINDOW_MS) this.recentFinalTranscripts.delete(value);
    }
    const previous = this.recentFinalTranscripts.get(normalized);
    this.recentFinalTranscripts.set(normalized, now);
    return previous !== undefined && now - previous <= DUPLICATE_WINDOW_MS;
  }

  private isCurrent(generation: number): boolean {
    return !this.destroyed && generation === this.generation;
  }

  private clearTimers(): void {
    if (this.restartTimer) this.cancelSchedule(this.restartTimer);
    if (this.commandTimer) this.cancelSchedule(this.commandTimer);
    this.restartTimer = null;
    this.commandTimer = null;
  }

  private update(next: Partial<ForegroundVoiceSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...next };
    for (const listener of this.listeners) listener(this.snapshot);
  }
}

function normalizeTranscript(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}
