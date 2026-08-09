import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ForegroundVoiceController,
  parseZarWakePhrase,
  submitVoiceCommandThroughConversation,
  type ForegroundVoiceSpeaker,
  type ForegroundVoiceSubmissionResult,
  type VoiceRecognitionLike,
  type VoiceRecognitionResultEventLike,
} from "./foregroundVoice";

class FakeRecognition implements VoiceRecognitionLike {
  continuous = false;
  interimResults = false;
  lang = "";
  onstart: (() => void) | null = null;
  onresult: ((event: VoiceRecognitionResultEventLike) => void) | null = null;
  onerror: ((event: { error?: string; message?: string }) => void) | null = null;
  onend: (() => void) | null = null;
  startCount = 0;
  stopCount = 0;
  abortCount = 0;

  start() {
    this.startCount += 1;
  }

  stop() {
    this.stopCount += 1;
  }

  abort() {
    this.abortCount += 1;
  }

  emitStart() {
    this.onstart?.();
  }

  emitFinal(...transcripts: string[]) {
    const results = transcripts.map((transcript) => ({
      0: { transcript },
      isFinal: true,
      length: 1,
    }));
    this.onresult?.({ resultIndex: 0, results });
  }

  emitError(error: string) {
    this.onerror?.({ error });
  }

  emitEnd() {
    this.onend?.();
  }
}

class FakeSpeaker implements ForegroundVoiceSpeaker {
  readonly spoken: string[] = [];
  cancelCount = 0;
  private onEnd: (() => void) | null = null;
  private onError: (() => void) | null = null;

  speak(text: string, onEnd: () => void, onError: () => void) {
    this.spoken.push(text);
    this.onEnd = onEnd;
    this.onError = onError;
  }

  cancel() {
    this.cancelCount += 1;
    this.onEnd = null;
    this.onError = null;
  }

  finish() {
    const callback = this.onEnd;
    this.onEnd = null;
    callback?.();
  }

  fail() {
    const callback = this.onError;
    this.onError = null;
    callback?.();
  }
}

function completed(responseText = "ZAR's real response."): ForegroundVoiceSubmissionResult {
  return { status: "completed", responseText };
}

function createHarness(
  submitCommand = vi.fn(async () => completed()),
  cancelSubmission = vi.fn(),
) {
  const recognition = new FakeRecognition();
  const speaker = new FakeSpeaker();
  const controller = new ForegroundVoiceController({
    createRecognition: () => recognition,
    speaker,
    submitCommand,
    cancelSubmission,
  });
  return { controller, recognition, speaker, submitCommand, cancelSubmission };
}

async function settle() {
  await Promise.resolve();
  await Promise.resolve();
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("foreground ZAR voice", () => {
  it("recognizes ZAR and Hey ZAR without matching unrelated words", () => {
    expect(parseZarWakePhrase("ZAR")).toEqual({ matched: true, command: "" });
    expect(parseZarWakePhrase("Hey ZAR")).toEqual({ matched: true, command: "" });
    expect(parseZarWakePhrase("Hey ZAR, open my project")).toEqual({
      matched: true,
      command: "open my project",
    });
    expect(parseZarWakePhrase("czar")).toEqual({ matched: false, command: "" });
  });

  it.each(["ZAR", "Hey ZAR"])("activates command capture for %s", (wakePhrase) => {
    const { controller, recognition } = createHarness();
    controller.activate();
    recognition.emitStart();
    recognition.emitFinal(wakePhrase);

    expect(controller.getSnapshot()).toMatchObject({
      state: "listening",
      active: true,
    });
  });

  it("submits a wake phrase plus immediate command and speaks ZAR's returned response", async () => {
    const { controller, recognition, speaker, submitCommand } = createHarness();
    controller.activate();
    recognition.emitStart();
    recognition.emitFinal("Hey ZAR, summarize this conversation");
    await settle();

    expect(submitCommand).toHaveBeenCalledTimes(1);
    expect(submitCommand).toHaveBeenCalledWith("summarize this conversation");
    expect(speaker.spoken).toEqual(["ZAR's real response."]);
    expect(controller.getSnapshot().state).toBe("speaking");

    speaker.finish();
    expect(controller.getSnapshot().state).toBe("armed");
    expect(recognition.startCount).toBe(2);
  });

  it("accepts a command after a short wake-phrase pause", async () => {
    const { controller, recognition, submitCommand } = createHarness();
    controller.activate();
    recognition.emitStart();
    recognition.emitFinal("ZAR");
    recognition.emitFinal("continue the current project");
    await settle();

    expect(submitCommand).toHaveBeenCalledWith("continue the current project");
  });

  it("uses the existing conversation controller for commands and contextual follow-ups", async () => {
    const sendMessage = vi
      .fn()
      .mockResolvedValueOnce(completed("First response"))
      .mockResolvedValueOnce(completed("Contextual follow-up"));
    const conversationController = { sendMessage };

    await submitVoiceCommandThroughConversation(conversationController, "start the audit");
    await submitVoiceCommandThroughConversation(conversationController, "what did you find");

    expect(sendMessage.mock.calls).toEqual([
      ["start the audit"],
      ["what did you find"],
    ]);
  });

  it.each(["ZAR, sleep", "stop listening"])("deactivates for %s", async (command) => {
    const { controller, recognition, speaker, submitCommand } = createHarness();
    controller.activate();
    recognition.emitStart();
    recognition.emitFinal(command);
    await settle();

    expect(controller.getSnapshot()).toMatchObject({ state: "cancelled", active: false });
    expect(submitCommand).not.toHaveBeenCalled();
    expect(recognition.abortCount).toBeGreaterThan(0);
    expect(speaker.cancelCount).toBeGreaterThan(0);
  });

  it("stops recognition, speech, and pending work when the app backgrounds", () => {
    const { controller, recognition, cancelSubmission } = createHarness();
    controller.activate();
    recognition.emitStart();
    controller.suspend();
    vi.advanceTimersByTime(5_000);

    expect(controller.getSnapshot()).toMatchObject({ state: "cancelled", active: false });
    expect(controller.getSnapshot().detail).toContain("foreground");
    expect(recognition.abortCount).toBeGreaterThan(0);
    expect(recognition.startCount).toBe(1);
    expect(cancelSubmission).toHaveBeenCalled();
  });

  it("stops safely during component cleanup or navigation away", () => {
    const { controller, recognition, cancelSubmission } = createHarness();
    controller.activate();
    recognition.emitStart();
    controller.destroy();
    vi.advanceTimersByTime(5_000);

    expect(controller.getSnapshot()).toMatchObject({ state: "cancelled", active: false });
    expect(recognition.abortCount).toBeGreaterThan(0);
    expect(recognition.startCount).toBe(1);
    expect(cancelSubmission).toHaveBeenCalled();
  });

  it("prevents duplicate final results from submitting twice", async () => {
    const { controller, recognition, submitCommand } = createHarness();
    controller.activate();
    recognition.emitStart();
    recognition.emitFinal("ZAR, open Memory", "ZAR, open Memory");
    await settle();

    expect(submitCommand).toHaveBeenCalledTimes(1);
  });

  it("exposes a truthful unsupported state", () => {
    const controller = new ForegroundVoiceController({
      submitCommand: async () => completed(),
    });
    controller.activate();

    expect(controller.getSnapshot()).toMatchObject({
      state: "unsupported",
      supported: false,
      active: false,
    });
  });

  it("recovers from a transient recognition failure without a restart loop", () => {
    const { controller, recognition } = createHarness();
    controller.activate();
    recognition.emitStart();
    recognition.emitError("network");

    expect(controller.getSnapshot()).toMatchObject({ state: "failed", active: true });
    recognition.emitEnd();
    vi.advanceTimersByTime(250);
    expect(recognition.startCount).toBe(2);

    recognition.emitStart();
    expect(controller.getSnapshot().state).toBe("armed");
  });

  it("stops retrying after repeated recognition start failures", () => {
    const recognition = new FakeRecognition();
    recognition.start = vi.fn(() => {
      recognition.startCount += 1;
      throw new Error("start failed");
    });
    const controller = new ForegroundVoiceController({
      createRecognition: () => recognition,
      speaker: new FakeSpeaker(),
      submitCommand: async () => completed(),
    });

    controller.activate();
    for (let attempt = 0; attempt < 7; attempt += 1) vi.advanceTimersByTime(250);

    expect(controller.getSnapshot()).toMatchObject({ state: "failed", active: false });
    expect(recognition.startCount).toBe(7);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("fails closed when microphone permission is denied", () => {
    const { controller, recognition } = createHarness();
    controller.activate();
    recognition.emitError("not-allowed");

    expect(controller.getSnapshot()).toMatchObject({ state: "failed", active: false });
    expect(controller.getSnapshot().detail).toContain("Microphone access");
  });

  it("ignores a stale response after voice is deactivated", async () => {
    let resolveSubmission: ((result: ForegroundVoiceSubmissionResult) => void) | null = null;
    const submitCommand = vi.fn(() => new Promise<ForegroundVoiceSubmissionResult>((resolve) => {
      resolveSubmission = resolve;
    }));
    const { controller, recognition, speaker } = createHarness(submitCommand);
    controller.activate();
    recognition.emitStart();
    recognition.emitFinal("ZAR, inspect the project");
    expect(controller.getSnapshot().state).toBe("processing");

    controller.deactivate("user");
    resolveSubmission?.(completed("Late response"));
    await settle();

    expect(controller.getSnapshot()).toMatchObject({ state: "cancelled", active: false });
    expect(speaker.spoken).toEqual([]);
  });

  it("returns an unanswered wake phrase to armed listening after inactivity", () => {
    const { controller, recognition } = createHarness();
    controller.activate();
    recognition.emitStart();
    recognition.emitFinal("ZAR");
    expect(controller.getSnapshot().state).toBe("listening");

    vi.advanceTimersByTime(6_000);
    expect(controller.getSnapshot()).toMatchObject({ state: "armed", active: true });
  });

  it("surfaces speech-output failure and requires deliberate reactivation", async () => {
    const { controller, recognition, speaker } = createHarness();
    controller.activate();
    recognition.emitStart();
    recognition.emitFinal("ZAR, answer me");
    await settle();
    speaker.fail();

    expect(controller.getSnapshot()).toMatchObject({ state: "failed", active: false });
  });
});
