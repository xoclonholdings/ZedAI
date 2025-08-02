"use strict";
// Social Media Feed Component - Currently disabled to optimize performance
// This feature can be re-enabled when social media integrations are needed
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = SocialFeed;
var card_1 = require("@/components/ui/card");
var badge_1 = require("@/components/ui/badge");
var lucide_react_1 = require("lucide-react");
function SocialFeed() {
    return (<card_1.Card className="zed-message p-6">
      <div className="text-center space-y-3">
        <div className="w-12 h-12 zed-avatar rounded-2xl flex items-center justify-center mx-auto">
          <lucide_react_1.AlertCircle size={24} className="text-yellow-400"/>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Social Media Feed</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Feature temporarily disabled to optimize performance
          </p>
        </div>
        <badge_1.Badge variant="outline" className="text-xs border-yellow-400/30 text-yellow-400">
          Coming Soon
        </badge_1.Badge>
      </div>
    </card_1.Card>);
}
