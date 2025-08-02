// Social Media Feed Component - Currently disabled to optimize performance
// This feature can be re-enabled when social media integrations are needed

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle } from "lucide-react";

export default function SocialFeed() {
  return (
    <Card className="zed-message p-6">
      <div className="text-center space-y-3">
        <div className="w-12 h-12 zed-avatar rounded-2xl flex items-center justify-center mx-auto">
          <AlertCircle size={24} className="text-yellow-400" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Social Media Feed</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Feature temporarily disabled to optimize performance
          </p>
        </div>
        <Badge variant="outline" className="text-xs border-yellow-400/30 text-yellow-400">
          Coming Soon
        </Badge>
      </div>
    </Card>
  );
}