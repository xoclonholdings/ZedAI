"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var wouter_1 = require("wouter");
var queryClient_1 = require("./lib/queryClient");
var react_query_1 = require("@tanstack/react-query");
var toaster_1 = require("@/components/ui/toaster");
var tooltip_1 = require("@/components/ui/tooltip");
var not_found_1 = require("@/pages/not-found");
var chat_1 = require("@/pages/chat");
var ZedCorePage_1 = require("@/components/ZedCorePage");
// Error boundary component to catch any rendering issues
function ErrorBoundary(_a) {
    var children = _a.children;
    return children;
}
function LoadingScreen() {
    return (<div className="min-h-screen bg-black flex items-center justify-center no-flash">
      <div className="text-center">
        <div className="mb-6">
          <div className="w-16 h-16 mx-auto bg-gradient-to-r from-purple-500 via-cyan-500 to-pink-500 rounded-full animate-pulse"></div>
        </div>
        <div className="text-xl font-medium bg-gradient-to-r from-purple-400 via-cyan-400 to-pink-400 bg-clip-text text-transparent">
          ZED
        </div>
        <div className="text-sm text-gray-400 mt-2">Loading...</div>
      </div>
    </div>);
}
function Router() {
    // Skip authentication entirely - go directly to chat
    return (<wouter_1.Switch>
      <wouter_1.Route path="/">
        <chat_1.default />
      </wouter_1.Route>
      <wouter_1.Route path="/chat/:id?">
        <chat_1.default />
      </wouter_1.Route>
      <wouter_1.Route path="/zed/core">
        <ZedCorePage_1.ZedCorePage userId="admin" isAdmin={true}/>
      </wouter_1.Route>
      <wouter_1.Route component={not_found_1.default}/>
    </wouter_1.Switch>);
}
function App() {
    return (<ErrorBoundary>
      <react_query_1.QueryClientProvider client={queryClient_1.queryClient}>
        <tooltip_1.TooltipProvider>
          <toaster_1.Toaster />
          <Router />
        </tooltip_1.TooltipProvider>
      </react_query_1.QueryClientProvider>
    </ErrorBoundary>);
}
exports.default = App;
