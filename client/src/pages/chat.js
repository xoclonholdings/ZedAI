"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Chat;
var react_1 = require("react");
var wouter_1 = require("wouter");
var react_query_1 = require("@tanstack/react-query");
var ChatSidebar_1 = require("@/components/chat/ChatSidebar");
var ChatArea_1 = require("@/components/chat/ChatArea");
var zLogoPath = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8ZGVmcz4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0iemVkR3JhZGllbnQiIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdHlsZT0ic3RvcC1jb2xvcjojYTg1NWY3O3N0b3Atb3BhY2l0eToxIiAvPgogICAgICA8c3RvcCBvZmZzZXQ9IjUwJSIgc3R5bGU9InN0b3AtY29sb3I6IzMwOGNmZjtzdG9wLW9wYWNpdHk6MSIgLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxMDAlIiBzdHlsZT0ic3RvcC1jb2xvcjojZWI0ODk5O3N0b3Atb3BhY2l0eToxIiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICA8L2RlZnM+CiAgPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiByeD0iOCIgZmlsbD0idXJsKCN6ZWRHcmFkaWVudCkiLz4KICA8cGF0aCBkPSJNOCAxMmgyMGwtMTIgOGgyMHYzSDE0bDEyLThIOHYtM3oiIGZpbGw9IndoaXRlIiBmaWxsLW9wYWNpdHk9IjAuOSIvPgo8L3N2Zz4K";
function Chat() {
    var conversationId = (0, wouter_1.useParams)().id;
    var _a = (0, react_1.useState)(false), isSidebarOpen = _a[0], setIsSidebarOpen = _a[1];
    var _b = (0, react_1.useState)(false), isMobile = _b[0], setIsMobile = _b[1];
    // Check if mobile on mount and resize
    (0, react_1.useEffect)(function () {
        var checkMobile = function () {
            setIsMobile(window.innerWidth < 768);
            if (window.innerWidth >= 768) {
                setIsSidebarOpen(true); // Always show sidebar on desktop
            }
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return function () { return window.removeEventListener('resize', checkMobile); };
    }, []);
    // Fetch conversations for sidebar
    var _c = (0, react_query_1.useQuery)({
        queryKey: ["/api/conversations"],
        refetchInterval: 30000, // Refresh every 30 seconds
    }).data, conversations = _c === void 0 ? [] : _c;
    // Fetch current conversation if ID provided
    var currentConversation = (0, react_query_1.useQuery)({
        queryKey: ["/api/conversations", conversationId],
        enabled: !!conversationId,
    }).data;
    // Fetch messages for current conversation
    var _d = (0, react_query_1.useQuery)({
        queryKey: ["/api/conversations", conversationId, "messages"],
        enabled: !!conversationId,
        refetchInterval: 5000, // Refresh every 5 seconds when active
    }), _e = _d.data, messages = _e === void 0 ? [] : _e, messagesLoading = _d.isLoading, messagesError = _d.error;
    // Fetch files for current conversation
    var _f = (0, react_query_1.useQuery)({
        queryKey: ["/api/conversations", conversationId, "files"],
        enabled: !!conversationId,
    }).data, files = _f === void 0 ? [] : _f;
    return (<div className="flex h-screen-mobile bg-black overflow-hidden">
      {/* Desktop Sidebar */}
      {!isMobile && (<div className="w-80 flex-shrink-0">
          <ChatSidebar_1.default conversations={conversations} onClose={function () { return setIsSidebarOpen(false); }} isMobile={false} onMenuClick={function () { return setIsSidebarOpen(true); }}/>
        </div>)}

      {/* Mobile Sidebar */}
      {isMobile && (<>
          <div className={"\n            fixed inset-y-0 left-0 z-50 w-80\n            ".concat(isSidebarOpen ? 'translate-x-0' : '-translate-x-full', "\n            transition-transform duration-200 ease-in-out\n          ")}>
            <ChatSidebar_1.default conversations={conversations} onClose={function () { return setIsSidebarOpen(false); }} isMobile={true} onMenuClick={function () { return setIsSidebarOpen(true); }}/>
          </div>
          
          {/* Mobile Backdrop */}
          {isSidebarOpen && (<div className="fixed inset-0 bg-black/50 z-40" onClick={function () { return setIsSidebarOpen(false); }}/>)}
        </>)}
      
      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <ChatArea_1.default conversation={currentConversation} messages={messages} files={files} conversationId={conversationId} isMobile={isMobile} onOpenSidebar={function () { return setIsSidebarOpen(true); }}/>
      </div>
    </div>);
}
