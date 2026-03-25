import { File } from "lucide-react";

import SatelliteConnection from "../satellite/SatelliteConnection";
import PhoneLink from "../phone/PhoneLink";
import SessionAnalyticsCard from "./SessionAnalyticsCard";
import SessionFilesList from "./SessionFilesList";
import SessionQuickActions from "./SessionQuickActions";

import type { Conversation, File as FileType, Session } from "@shared/schema";

interface SessionPanelProps {
  conversation?: Conversation;
  files: FileType[];
  session?: Session;
}

export default function SessionPanel({
  conversation,
  files,
  session,
}: SessionPanelProps) {
  return (
    <div className="w-96 zed-sidebar flex flex-col h-full relative">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-10 right-4 w-20 h-20 bg-cyan-600/5 rounded-full blur-2xl zed-float" />
        <div
          className="absolute bottom-20 left-4 w-16 h-16 bg-purple-500/5 rounded-full blur-xl zed-float"
          style={{ animationDelay: "2s" }}
        />
      </div>

      <div className="p-6 border-b border-white/10 relative z-10">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
            Session Control
          </h3>
        </div>
      </div>

      <div className="p-4 border-b border-white/10 relative z-10 space-y-4">
        <SatelliteConnection />
        <PhoneLink />
      </div>

      <SessionAnalyticsCard
        conversation={conversation}
        session={session}
        fileCount={files.length}
      />

      <div className="flex-1 p-4 overflow-y-auto relative z-10">
        <h4 className="text-sm font-semibold text-foreground mb-4 flex items-center">
          <File size={16} className="mr-2 text-cyan-400" />
          Data Storage
        </h4>

        <SessionFilesList files={files} />
      </div>

      <SessionQuickActions />
    </div>
  );
}