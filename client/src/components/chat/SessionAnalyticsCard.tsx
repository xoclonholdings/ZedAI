import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Clock, FileText, HardDrive, MessageSquare } from "lucide-react";
import type { Conversation, Session } from "@shared/schema";

interface SessionAnalyticsCardProps {
  conversation?: Conversation;
  session?: Session;
  fileCount: number;
}

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }

  return `${mins}m`;
}

export default function SessionAnalyticsCard({
  conversation,
  session,
  fileCount,
}: SessionAnalyticsCardProps) {
  return (
    <div className="p-4 border-b border-white/10 relative z-10">
      <h4 className="text-sm font-semibold text-foreground mb-4 flex items-center">
        <MessageSquare size={16} className="mr-2 text-purple-400" />
        Session Analytics
      </h4>

      <div className="space-y-4">
        <Card className="zed-glass p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">AI Model</span>
            <Badge className="bg-purple-600/20 text-purple-400 border-purple-400/30">
              {conversation?.model || "GPT-4o"}
            </Badge>
          </div>

          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground flex items-center">
              <Clock size={12} className="mr-1" />
              Session Time
            </span>
            <span className="text-sm font-medium text-foreground">
              {session?.duration ? formatDuration(session.duration) : "0m"}
            </span>
          </div>

          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground flex items-center">
              <FileText size={12} className="mr-1" />
              Files Processed
            </span>
            <span className="text-sm font-medium text-foreground">
              {fileCount} files
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground flex items-center">
              <HardDrive size={12} className="mr-1" />
              Memory Usage
            </span>
            <span className="text-sm font-medium text-foreground">
              {session?.memoryUsage ? `${session.memoryUsage} MB` : "0 MB"}
            </span>
          </div>
        </Card>
      </div>
    </div>
  );
}