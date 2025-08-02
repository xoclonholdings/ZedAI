"use strict";
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
exports.default = EnhancedLogin;
var react_1 = require("react");
var button_1 = require("@/components/ui/button");
var input_1 = require("@/components/ui/input");
var card_1 = require("@/components/ui/card");
var use_toast_1 = require("@/hooks/use-toast");
var Zed_ai_logo_1753468041342_png_1 = require("@assets/Zed-ai-logo_1753468041342.png");
require("./enhanced-login.css");
function EnhancedLogin() {
    var _this = this;
    var _a = (0, react_1.useState)(""), username = _a[0], setUsername = _a[1];
    var _b = (0, react_1.useState)(""), password = _b[0], setPassword = _b[1];
    var _c = (0, react_1.useState)(""), securePhrase = _c[0], setSecurePhrase = _c[1];
    var _d = (0, react_1.useState)(""), challengeAnswer = _d[0], setChallengeAnswer = _d[1];
    var _e = (0, react_1.useState)(false), isLoading = _e[0], setIsLoading = _e[1];
    var _f = (0, react_1.useState)(""), error = _f[0], setError = _f[1];
    var _g = (0, react_1.useState)(false), showSecondaryAuth = _g[0], setShowSecondaryAuth = _g[1];
    var _h = (0, react_1.useState)(false), showChallenge = _h[0], setShowChallenge = _h[1];
    var _j = (0, react_1.useState)(""), challengeMessage = _j[0], setChallengeMessage = _j[1];
    var toast = (0, use_toast_1.useToast)().toast;
    var handleLogin = function (e) { return __awaiter(_this, void 0, void 0, function () {
        var loginData, response, data, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    e.preventDefault();
                    setIsLoading(true);
                    setError("");
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 4, 5, 6]);
                    loginData = { username: username, password: password };
                    if (securePhrase)
                        loginData.securePhrase = securePhrase;
                    if (showSecondaryAuth)
                        loginData.requiresVerification = true;
                    return [4 /*yield*/, fetch("/api/login", {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                            },
                            body: JSON.stringify(loginData),
                        })];
                case 2:
                    response = _a.sent();
                    return [4 /*yield*/, response.json()];
                case 3:
                    data = _a.sent();
                    if (data.success) {
                        toast({
                            title: "Welcome to ZED",
                            description: "Successfully logged in with enhanced security!",
                        });
                        window.location.reload();
                    }
                    else if (data.requiresSecondaryAuth) {
                        setShowSecondaryAuth(true);
                        setError("Admin login requires additional verification");
                    }
                    else if (data.requiresChallenge) {
                        setShowChallenge(true);
                        setChallengeMessage(data.message);
                        setError("");
                    }
                    else {
                        setError(data.error || "Login failed");
                    }
                    return [3 /*break*/, 6];
                case 4:
                    error_1 = _a.sent();
                    setError("Network error. Please try again.");
                    return [3 /*break*/, 6];
                case 5:
                    setIsLoading(false);
                    return [7 /*endfinally*/];
                case 6: return [2 /*return*/];
            }
        });
    }); };
    var handleChallenge = function (e) { return __awaiter(_this, void 0, void 0, function () {
        var response, data, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    e.preventDefault();
                    setIsLoading(true);
                    setError("");
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 4, 5, 6]);
                    return [4 /*yield*/, fetch("/api/admin/verify-challenge", {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                            },
                            body: JSON.stringify({
                                challengeAnswer: challengeAnswer,
                                securePhrase: securePhrase || undefined
                            }),
                        })];
                case 2:
                    response = _a.sent();
                    return [4 /*yield*/, response.json()];
                case 3:
                    data = _a.sent();
                    if (data.success) {
                        setShowChallenge(false);
                        setChallengeAnswer("");
                        toast({
                            title: "Challenge Verified",
                            description: "Security challenge passed. Please try logging in again.",
                        });
                        setError("");
                    }
                    else {
                        setError(data.error || "Challenge verification failed");
                    }
                    return [3 /*break*/, 6];
                case 4:
                    error_2 = _a.sent();
                    setError("Network error. Please try again.");
                    return [3 /*break*/, 6];
                case 5:
                    setIsLoading(false);
                    return [7 /*endfinally*/];
                case 6: return [2 /*return*/];
            }
        });
    }); };
    if (showChallenge) {
        return (<div className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden">
        {/* Cyberpunk Grid Background */}
        <div className="absolute inset-0">
          <div className="w-full h-full cyberpunk-grid-bg"/>
        </div>

        <card_1.Card className="w-full max-w-md bg-black/80 border-red-500/30 backdrop-blur-sm shadow-2xl shadow-red-500/20">
          <card_1.CardHeader className="text-center space-y-6">
            <div className="flex justify-center mb-4">
              <img src={Zed_ai_logo_1753468041342_png_1.default} alt="Z Logo" className="h-16 w-16 object-contain zed-logo-invert"/>
            </div>
            
            <div>
              <card_1.CardTitle className="text-2xl font-bold bg-gradient-to-r from-red-400 via-purple-400 to-blue-400 bg-clip-text text-transparent">
                Security Challenge
              </card_1.CardTitle>
              <card_1.CardDescription className="text-gray-400 mt-2">
                {challengeMessage}
              </card_1.CardDescription>
            </div>
          </card_1.CardHeader>
          
          <card_1.CardContent>
            <form onSubmit={handleChallenge} className="space-y-4">
              <div className="space-y-2">
                <input_1.Input type="text" placeholder="Challenge Answer (42, xoclon, or diagnostic)" value={challengeAnswer} onChange={function (e) { return setChallengeAnswer(e.target.value); }} className="bg-black/50 border-red-500/50 text-white placeholder:text-gray-400 focus:border-red-400 focus:ring-red-400/20"/>
              </div>
              
              <div className="space-y-2">
                <input_1.Input type="password" placeholder="Or enter secure phrase" value={securePhrase} onChange={function (e) { return setSecurePhrase(e.target.value); }} className="bg-black/50 border-red-500/50 text-white placeholder:text-gray-400 focus:border-red-400 focus:ring-red-400/20"/>
              </div>

              {error && (<div className="text-red-400 text-sm text-center bg-red-500/10 border border-red-500/20 rounded p-2">
                  {error}
                </div>)}

              <div className="flex space-x-2">
                <button_1.Button type="button" onClick={function () { setShowChallenge(false); setError(""); }} className="flex-1 bg-gray-600 hover:bg-gray-700 text-white">
                  Back
                </button_1.Button>
                <button_1.Button type="submit" disabled={isLoading} className="flex-1 bg-gradient-to-r from-red-600 to-purple-600 hover:from-red-700 hover:to-purple-700 text-white">
                  {isLoading ? "Verifying..." : "Verify"}
                </button_1.Button>
              </div>
            </form>
          </card_1.CardContent>
        </card_1.Card>
      </div>);
    }
    return (<div className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden">
      {/* Cyberpunk Grid Background */}
      <div className="absolute inset-0 opacity-10">
        <div className="w-full h-full enhanced-login-bg"/>
      </div>

      <card_1.Card className="w-full max-w-md bg-black/80 border-purple-500/30 backdrop-blur-sm shadow-2xl shadow-purple-500/20">
        <card_1.CardHeader className="text-center space-y-6">
          {/* Overhead transparent logo */}
          <div className="flex justify-center mb-4">
            <img src={Zed_ai_logo_1753468041342_png_1.default} alt="Z Logo" className="h-16 w-16 object-contain zed-logo-invert"/>
          </div>
          
          <div>
            <card_1.CardTitle className="text-2xl font-bold bg-gradient-to-r from-pink-400 via-purple-400 to-blue-400 bg-clip-text text-transparent">
              {showSecondaryAuth ? "Admin Verification" : "ZED AI System"}
            </card_1.CardTitle>
            <card_1.CardDescription className="text-gray-400 mt-2">
              {showSecondaryAuth ? "Enhanced Security Required" : "Diagnostic Solution-Based AI Agent"}
            </card_1.CardDescription>
          </div>
        </card_1.CardHeader>
        
        <card_1.CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <input_1.Input type="text" placeholder="Username" value={username} onChange={function (e) { return setUsername(e.target.value); }} className="bg-black/50 border-purple-500/50 text-white placeholder:text-gray-400 focus:border-purple-400 focus:ring-purple-400/20" required disabled={showSecondaryAuth}/>
            </div>
            
            <div className="space-y-2">
              <input_1.Input type="password" placeholder="Password" value={password} onChange={function (e) { return setPassword(e.target.value); }} className="bg-black/50 border-purple-500/50 text-white placeholder:text-gray-400 focus:border-purple-400 focus:ring-purple-400/20" required disabled={showSecondaryAuth}/>
            </div>

            {showSecondaryAuth && (<div className="space-y-2">
                <input_1.Input type="password" placeholder="Secure Phrase (XOCLON_SECURE_2025)" value={securePhrase} onChange={function (e) { return setSecurePhrase(e.target.value); }} className="bg-black/50 border-yellow-500/50 text-white placeholder:text-gray-400 focus:border-yellow-400 focus:ring-yellow-400/20" required/>
                <p className="text-xs text-gray-500">
                  Admin login from new device requires secure phrase verification
                </p>
              </div>)}

            {error && (<div className="text-red-400 text-sm text-center bg-red-500/10 border border-red-500/20 rounded p-2">
                {error}
              </div>)}

            <button_1.Button type="submit" disabled={isLoading} className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-medium py-2 px-4 rounded-md transition-all duration-200 shadow-lg hover:shadow-purple-500/25">
              {isLoading ? "Signing In..." : showSecondaryAuth ? "Verify & Sign In" : "Sign In"}
            </button_1.Button>

            {showSecondaryAuth && (<button_1.Button type="button" onClick={function () { setShowSecondaryAuth(false); setSecurePhrase(""); setError(""); }} className="w-full bg-gray-600 hover:bg-gray-700 text-white">
                Back to Login
              </button_1.Button>)}
          </form>

          <div className="mt-6 text-center text-xs text-gray-500">
            <p>Enhanced Security Features:</p>
            <p>• Device fingerprinting • Session timeout (45 min)</p>
            <p>• Challenge recovery • Secure phrase override</p>
          </div>
        </card_1.CardContent>
      </card_1.Card>
    </div>);
}
