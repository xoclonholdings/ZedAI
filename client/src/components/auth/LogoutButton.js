"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = LogoutButton;
var button_1 = require("@/components/ui/button");
var lucide_react_1 = require("lucide-react");
function LogoutButton() {
    var handleLogout = function () {
        window.location.href = '/api/logout';
    };
    return (<button_1.Button variant="ghost" size="sm" onClick={handleLogout} className="zed-button rounded-xl text-muted-foreground hover:text-foreground">
      <lucide_react_1.LogOut size={16}/>
    </button_1.Button>);
}
