import { Button } from "@/components/ui/button";
import { Code, FileText, Share2, Zap } from "lucide-react";

export default function SessionQuickActions() {
  return (
    <div className="p-4 border-t border-white/10 relative z-10">
      <h4 className="text-sm font-semibold text-foreground mb-4 flex items-center">
        <Zap size={16} className="mr-2 text-yellow-400" />
        Quick Actions
      </h4>

      <div className="space-y-3">
        <Button
          variant="ghost"
          className="w-full zed-button rounded-xl justify-start hover:zed-glow transition-all duration-300"
        >
          <FileText size={16} className="mr-3 text-cyan-400" />
          <div className="text-left">
            <div className="text-sm font-medium text-foreground">
              Generate Report
            </div>
            <div className="text-xs text-muted-foreground">
              Export analysis results
            </div>
          </div>
        </Button>

        <Button
          variant="ghost"
          className="w-full zed-button rounded-xl justify-start hover:zed-glow transition-all duration-300"
        >
          <Code size={16} className="mr-3 text-purple-400" />
          <div className="text-left">
            <div className="text-sm font-medium text-foreground">
              Export Code
            </div>
            <div className="text-xs text-muted-foreground">
              Download generated scripts
            </div>
          </div>
        </Button>

        <Button
          variant="ghost"
          className="w-full zed-button rounded-xl justify-start hover:zed-glow transition-all duration-300"
        >
          <Share2 size={16} className="mr-3 text-pink-400" />
          <div className="text-left">
            <div className="text-sm font-medium text-foreground">
              Share Session
            </div>
            <div className="text-xs text-muted-foreground">
              Team collaboration
            </div>
          </div>
        </Button>
      </div>
    </div>
  );
}