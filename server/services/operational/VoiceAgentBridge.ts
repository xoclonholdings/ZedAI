/**
 * VoiceAgentBridge
 *
 * PLACEHOLDER for future real-time voice agent support.
 *
 * Defines:
 *   - the event shape voice transcribers will emit
 *   - lifecycle hooks (start / transcript chunk / end) so other modules
 *     can already register for them
 *   - a record-only sink that stores voice events into omnichannel
 *     memory once a real voice provider is wired in
 *
 * NOT IMPLEMENTED:
 *   - audio capture
 *   - real ASR / TTS pipelines
 *   - turn-taking logic
 */

import { OmnichannelMemoryService } from "./OmnichannelMemoryService";

export type VoiceSpeaker = "user" | "agent" | "third_party";

export interface VoiceEvent {
  session_id: string;
  speaker: VoiceSpeaker;
  transcript: string;
  intent?: string;
  confidence?: number;
  action_requested?: string;
  timestamp?: string;
}

export interface VoiceLifecycleHandlers {
  onSessionStart?: (session_id: string, metadata?: Record<string, unknown>) => void | Promise<void>;
  onTranscriptChunk?: (event: VoiceEvent) => void | Promise<void>;
  onSessionEnd?: (session_id: string, summary?: string) => void | Promise<void>;
}

export class VoiceAgentBridge {
  private static handlers: VoiceLifecycleHandlers = {};

  static registerHandlers(handlers: VoiceLifecycleHandlers): void {
    this.handlers = { ...this.handlers, ...handlers };
  }

  static async sessionStart(session_id: string, metadata?: Record<string, unknown>): Promise<void> {
    if (this.handlers.onSessionStart) {
      await this.handlers.onSessionStart(session_id, metadata);
    }
    await OmnichannelMemoryService.append({
      channel: "voice",
      summary: `Voice session ${session_id} started`,
      participants: [{ display_name: "voice-agent", role: "agent" }],
      action_taken: "session_start",
    });
  }

  static async transcriptChunk(event: VoiceEvent): Promise<void> {
    if (this.handlers.onTranscriptChunk) {
      await this.handlers.onTranscriptChunk(event);
    }
    await OmnichannelMemoryService.append({
      channel: "voice",
      summary: `${event.speaker}: ${event.transcript.slice(0, 240)}`,
      participants: [{ display_name: event.speaker, role: event.speaker === "agent" ? "agent" : "user" }],
      action_taken: event.action_requested || null,
    });
  }

  static async sessionEnd(session_id: string, summary?: string): Promise<void> {
    if (this.handlers.onSessionEnd) {
      await this.handlers.onSessionEnd(session_id, summary);
    }
    await OmnichannelMemoryService.append({
      channel: "voice",
      summary: summary || `Voice session ${session_id} ended`,
      participants: [{ display_name: "voice-agent", role: "agent" }],
      action_taken: "session_end",
    });
  }
}

export default VoiceAgentBridge;
