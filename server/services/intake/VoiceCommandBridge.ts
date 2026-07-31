/**
 * VoiceCommandBridge
 *
 * Functional voice command intake. Accepts a transcript (captured by
 * the browser's Web Speech API or any future ASR provider) and routes
 * it through ExternalCommandGateway, which produces a real ZAR task
 * with execution plan + approval gating.
 *
 * Audio capture is intentionally out of scope here — it lives in the
 * client (controls-row mic in ChatControls.tsx posts to /api/intake/voice
 * which lands on this bridge). When a server-side ASR provider is added
 * later, it can call into the same `process()` entry point.
 */

import { ExternalCommandGateway, type GatewayResult } from "./ExternalCommandGateway";
import { logRuntimeEvent } from "../RuntimeLogger";

export interface VoiceCommandEvent {
  transcript: string;
  speaker_id: string;
  confidence: number; // 0..1
  detected_intent?: string;
  timestamp?: string;
  /** Optional ZAR user_id resolved by the upstream voice provider. */
  user_id?: string;
  /** Optional locale / device / room info from the capture device. */
  metadata?: Record<string, unknown>;
}

export interface VoicePipelineHooks {
  onTranscript?: (event: VoiceCommandEvent) => void | Promise<void>;
  onIntentDetected?: (event: VoiceCommandEvent) => void | Promise<void>;
  onRouted?: (result: GatewayResult) => void | Promise<void>;
}

export interface VoiceCommandRoutingResult {
  status: "routed" | "ignored" | "stubbed";
  reason: string;
  gateway_result?: GatewayResult;
}

const MIN_TRANSCRIPT_LENGTH = 2;
const MIN_CONFIDENCE = 0.4;

export class VoiceCommandBridge {
  private static hooks: VoicePipelineHooks = {};

  static registerHooks(hooks: VoicePipelineHooks): void {
    this.hooks = { ...this.hooks, ...hooks };
  }

  /**
   * Route a voice event through the universal gateway. Today this is
   * a thin pass-through; later it will own ASR, wake-word, and speaker
   * identification before reaching the gateway.
   */
  static async process(event: VoiceCommandEvent): Promise<VoiceCommandRoutingResult> {
    const transcript = (event.transcript || "").trim();
    if (transcript.length < MIN_TRANSCRIPT_LENGTH) {
      return { status: "ignored", reason: "transcript too short" };
    }
    if (typeof event.confidence === "number" && event.confidence < MIN_CONFIDENCE) {
      return { status: "ignored", reason: "confidence below threshold" };
    }

    if (this.hooks.onTranscript) await this.hooks.onTranscript(event);
    if (event.detected_intent && this.hooks.onIntentDetected) {
      await this.hooks.onIntentDetected(event);
    }

    try {
      const gateway_result = await ExternalCommandGateway.receive({
        channel: "voice",
        sender_id: event.speaker_id,
        message: transcript,
        metadata: {
          confidence: event.confidence,
          detected_intent: event.detected_intent,
          ...(event.metadata || {}),
        },
        timestamp: event.timestamp,
        user_id: event.user_id,
      });

      if (this.hooks.onRouted) await this.hooks.onRouted(gateway_result);

      await logRuntimeEvent({
        level: "info",
        source: "server",
        event: "intake.voice.routed",
        detail: `Voice from ${event.speaker_id}: ${transcript.slice(0, 80)}`,
        context: {
          task_id: gateway_result.task.id,
          confidence: event.confidence,
        },
      });

      return { status: "routed", reason: "ok", gateway_result };
    } catch (err: any) {
      await logRuntimeEvent({
        level: "warn",
        source: "server",
        event: "intake.voice.failed",
        detail: err?.message || String(err),
      });
      return { status: "stubbed", reason: err?.message || "voice routing failed" };
    }
  }

  /**
   * Convenience shape that future ASR providers can adopt directly.
   * Keeping it here means the rest of the codebase already knows how
   * to feed the bridge once the provider lands.
   */
  static describeContract(): {
    accepted_event: keyof VoiceCommandEvent;
    forwards_to: string[];
    hooks: Array<keyof VoicePipelineHooks>;
  } {
    return {
      accepted_event: "transcript",
      forwards_to: [
        "ExternalCommandGateway",
        "TaskExecutionEngine (via gateway)",
        "ApprovalWatchdog (via gateway)",
      ],
      hooks: ["onTranscript", "onIntentDetected", "onRouted"],
    };
  }
}

export default VoiceCommandBridge;
