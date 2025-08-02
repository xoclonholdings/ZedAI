"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Login;
var react_1 = require("react");
var button_1 = require("@/components/ui/button");
var input_1 = require("@/components/ui/input");
var card_1 = require("@/components/ui/card");
var use_toast_1 = require("@/hooks/use-toast");
var react_query_1 = require("@tanstack/react-query");
var lucide_react_1 = require("lucide-react");
var zLogoPath = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8ZGVmcz4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0iemVkR3JhZGllbnQiIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdHlsZT0ic3RvcC1jb2xvcjojYTg1NWY3O3N0b3Atb3BhY2l0eToxIiAvPgogICAgICA8c3RvcCBvZmZzZXQ9IjUwJSIgc3R5bGU9InN0b3AtY29sb3I6IzMwOGNmZjtzdG9wLW9wYWNpdHk6MSIgLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxMDAlIiBzdHlsZT0ic3RvcC1jb2xvcjojZWI0ODk5O3N0b3Atb3BhY2l0eToxIiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICA8L2RlZnM+CiAgPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiByeD0iOCIgZmlsbD0idXJsKCN6ZWRHcmFkaWVudCkiLz4KICA8cGF0aCBkPSJNOCAxMmgyMGwtMTIgOGgyMHYzSDE0bDEyLThIOHYtM3oiIGZpbGw9IndoaXRlIiBmaWxsLW9wYWNpdHk9IjAuOSIvPgo8L3N2Zz4K";
var useAuth_1 = require("@/hooks/useAuth");
var useAuthMock_1 = require("@/hooks/useAuthMock");
function Login() {
    var _this = this;
    var _a = (0, react_1.useState)({ username: "", password: "" }), credentials = _a[0], setCredentials = _a[1];
    var _b = (0, react_1.useState)(false), showPassword = _b[0], setShowPassword = _b[1];
    var _c = (0, react_1.useState)(""), securePhrase = _c[0], setSecurePhrase = _c[1];
    var _d = (0, react_1.useState)(false), showSecondaryAuth = _d[0], setShowSecondaryAuth = _d[1];
    var _e = (0, react_1.useState)(false), isLoading = _e[0], setIsLoading = _e[1];
    var toast = (0, use_toast_1.useToast)().toast;
    var queryClient = (0, react_query_1.useQueryClient)();
    var refetch = (0, useAuth_1.useAuth)().refetch;
    var mockAuth = (0, useAuthMock_1.useAuthMock)();
    // Use mock auth as fallback
    var USE_MOCK_AUTH = false; // Set to false when server is working
    var handleSubmit = function (e) { return __awaiter(_this, void 0, void 0, function () {
        var result, loginData, response, data, error_1;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    e.preventDefault();
                    if (!credentials.username || !credentials.password) {
                        toast({
                            title: "Missing credentials",
                            description: "Please enter both username and password",
                            variant: "destructive",
                        });
                        return [2 /*return*/];
                    }
                    setIsLoading(true);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 7, 8, 9]);
                    if (!USE_MOCK_AUTH) return [3 /*break*/, 3];
                    return [4 /*yield*/, mockAuth.login(credentials.username, credentials.password)];
                case 2:
                    result = _a.sent();
                    if (result.success) {
                        toast({
                            title: "Welcome to ZED",
                            description: "Successfully logged in! (Mock Mode)",
                        });
                        window.location.reload(); // Refresh to update auth state
                    }
                    else {
                        toast({
                            title: "Login failed",
                            description: result.reason || "Invalid credentials",
                            variant: "destructive",
                        });
                    }
                    return [3 /*break*/, 6];
                case 3:
                    loginData = {
                        username: credentials.username,
                        password: credentials.password
                    };
                    if (securePhrase) {
                        loginData.securePhrase = securePhrase;
                    }
                    return [4 /*yield*/, fetch("/api/login", {
                            method: "POST",
                            body: JSON.stringify(loginData),
                            headers: { "Content-Type": "application/json" },
                            credentials: 'include',
                        })];
                case 4:
                    response = _a.sent();
                    return [4 /*yield*/, response.json()];
                case 5:
                    data = _a.sent();
                    if (data.success) {
                        toast({
                            title: "Welcome to ZED",
                            description: "Successfully logged in!",
                        });
                        // Wait a moment for session to be established, then force refetch
                        setTimeout(function () { return __awaiter(_this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, refetch()];
                                    case 1:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); }, 200);
                    }
                    else if (data.requiresSecondaryAuth) {
                        setShowSecondaryAuth(true);
                        toast({
                            title: "Additional verification required",
                            description: "Please enter your secure phrase to continue",
                            variant: "default",
                        });
                    }
                    else {
                        toast({
                            title: "Login failed",
                            description: data.error || "Invalid credentials",
                            variant: "destructive",
                        });
                    }
                    _a.label = 6;
                case 6: return [3 /*break*/, 9];
                case 7:
                    error_1 = _a.sent();
                    toast({
                        title: "Login failed",
                        description: "Network error. Please try again.",
                        variant: "destructive",
                    });
                    return [3 /*break*/, 9];
                case 8:
                    setIsLoading(false);
                    return [7 /*endfinally*/];
                case 9: return [2 /*return*/];
            }
        });
    }); };
    return (<div className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden">
      {/* Subtle animated background elements matching chat interface */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-20 left-20 w-96 h-96 bg-purple-600/5 rounded-full blur-3xl zed-float"/>
        <div className="absolute bottom-20 right-20 w-80 h-80 bg-cyan-500/5 rounded-full blur-3xl zed-float zed-delay-4s"/>
        <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-pink-500/5 rounded-full blur-3xl zed-float zed-delay-2s"/>
      </div>
      {/* Grid Pattern Overlay */}
      <div className="absolute inset-0 opacity-5 pointer-events-none zed-grid-overlay"/>

      <div className="relative z-10 w-full max-w-md">
        {/* ZED Logo */}
        <div className="text-center mb-8">
          <div className="mb-4">
            <img src={zLogoPath} alt="Z" className="w-16 h-16 mx-auto opacity-70"/>
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">
            ZED
          </h1>
          <p className="text-muted-foreground mt-2">Enhanced AI Assistant</p>
        </div>

        <card_1.Card className="zed-glass border-white/10">
          <card_1.CardHeader className="space-y-1">
            <card_1.CardTitle className="text-2xl text-center text-foreground">Sign In</card_1.CardTitle>
            <card_1.CardDescription className="text-center text-muted-foreground">
              Enter your credentials to access ZED
            </card_1.CardDescription>
          </card_1.CardHeader>
          <card_1.CardContent className="space-y-4">
            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Username</label>
                <input_1.Input type="text" placeholder="Enter username" value={credentials.username} onChange={function (e) { return setCredentials(__assign(__assign({}, credentials), { username: e.target.value })); }} className="zed-input" disabled={isLoading}/>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Password</label>
                <div className="relative">
                  <input_1.Input type={showPassword ? "text" : "password"} placeholder="Enter password" value={credentials.password} onChange={function (e) { return setCredentials(__assign(__assign({}, credentials), { password: e.target.value })); }} className="zed-input pr-10" disabled={isLoading}/>
                  <button type="button" onClick={function () { return setShowPassword(!showPassword); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                    {showPassword ? <lucide_react_1.EyeOff size={16}/> : <lucide_react_1.Eye size={16}/>}
                  </button>
                </div>
              </div>

              {showSecondaryAuth && (<div className="space-y-2 border-t border-gray-700 pt-4">
                  <div className="text-sm text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 rounded-lg p-3">
                    🔐 Admin verification required. Enter your secure phrase:
                  </div>
                  <input_1.Input type="password" placeholder="Secure Phrase (XOCLON_SECURE_2025)" value={securePhrase} onChange={function (e) { return setSecurePhrase(e.target.value); }} className="zed-input" disabled={isLoading}/>
                </div>)}

              <button_1.Button type="submit" className="w-full zed-gradient hover:zed-gradient-hover text-white" disabled={isLoading}>
                {isLoading ? (<div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Signing in...</span>
                  </div>) : (<div className="flex items-center space-x-2">
                    <lucide_react_1.Sparkles size={16}/>
                    <span>{showSecondaryAuth ? "Verify Access" : "Sign In"}</span>
                  </div>)}
              </button_1.Button>
            </form>
          </card_1.CardContent>
        </card_1.Card>

        <p className="text-center text-muted-foreground text-sm mt-6">
          Local authentication • No external dependencies
        </p>
      </div>
    </div>);
}
