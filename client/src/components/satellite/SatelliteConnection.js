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
exports.default = SatelliteConnection;
var react_1 = require("react");
var button_1 = require("@/components/ui/button");
var card_1 = require("@/components/ui/card");
var badge_1 = require("@/components/ui/badge");
var lucide_react_1 = require("lucide-react");
function SatelliteConnection(_a) {
    var _this = this;
    var _b = _a.isCollapsed, isCollapsed = _b === void 0 ? false : _b;
    var _c = (0, react_1.useState)('disconnected'), status = _c[0], setStatus = _c[1];
    var _d = (0, react_1.useState)(0), signalStrength = _d[0], setSignalStrength = _d[1];
    var _e = (0, react_1.useState)(0), latency = _e[0], setLatency = _e[1];
    var _f = (0, react_1.useState)(0), bandwidth = _f[0], setBandwidth = _f[1];
    (0, react_1.useEffect)(function () {
        var interval;
        if (status === 'connected') {
            interval = setInterval(function () {
                // Simulate realistic satellite connection metrics
                setSignalStrength(Math.floor(Math.random() * 20) + 80); // 80-100%
                setLatency(Math.floor(Math.random() * 100) + 200); // 200-300ms
                setBandwidth(Math.floor(Math.random() * 50) + 100); // 100-150 Mbps
            }, 2000);
        }
        return function () {
            if (interval)
                clearInterval(interval);
        };
    }, [status]);
    var handleConnect = function () { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (status === 'connected') {
                        setStatus('disconnected');
                        setSignalStrength(0);
                        setLatency(0);
                        setBandwidth(0);
                        return [2 /*return*/];
                    }
                    setStatus('connecting');
                    // Simulate connection process
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 3000); })];
                case 1:
                    // Simulate connection process
                    _a.sent();
                    if (Math.random() > 0.1) { // 90% success rate
                        setStatus('connected');
                        setSignalStrength(85);
                        setLatency(250);
                        setBandwidth(125);
                    }
                    else {
                        setStatus('error');
                        setTimeout(function () { return setStatus('disconnected'); }, 3000);
                    }
                    return [2 /*return*/];
            }
        });
    }); };
    var getStatusColor = function () {
        switch (status) {
            case 'connected': return 'text-green-400';
            case 'connecting': return 'text-yellow-400';
            case 'error': return 'text-red-400';
            default: return 'text-muted-foreground';
        }
    };
    var getStatusIcon = function () {
        switch (status) {
            case 'connected': return <lucide_react_1.Satellite size={16} className="text-green-400"/>;
            case 'connecting': return <lucide_react_1.Radio size={16} className="text-yellow-400 animate-pulse"/>;
            case 'error': return <lucide_react_1.AlertTriangle size={16} className="text-red-400"/>;
            default: return <lucide_react_1.WifiOff size={16} className="text-muted-foreground"/>;
        }
    };
    var getStatusText = function () {
        switch (status) {
            case 'connected': return 'Satellite Online';
            case 'connecting': return 'Establishing Link...';
            case 'error': return 'Connection Failed';
            default: return 'Offline';
        }
    };
    if (isCollapsed) {
        return (<div className="w-full p-3 space-y-3">
        <button_1.Button onClick={handleConnect} variant="ghost" size="sm" className={"w-full h-10 zed-button rounded-xl ".concat(status === 'connected' ? 'zed-glow' : '')} disabled={status === 'connecting'}>
          {getStatusIcon()}
        </button_1.Button>
        
        {status === 'connected' && (<div className="space-y-1">
            <div className="flex items-center justify-center">
              <div className={"w-2 h-2 rounded-full ".concat(signalStrength > 80 ? 'bg-green-400' :
                    signalStrength > 60 ? 'bg-yellow-400' : 'bg-red-400')}/>
            </div>
          </div>)}
      </div>);
    }
    return (<card_1.Card className="zed-message p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 zed-avatar rounded-2xl flex items-center justify-center">
            {getStatusIcon()}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Satellite Link</h3>
            <p className={"text-xs ".concat(getStatusColor())}>
              {getStatusText()}
            </p>
          </div>
        </div>
        
        <badge_1.Badge variant="outline" className={"text-xs ".concat(status === 'connected' ? 'border-green-400/30 text-green-400' :
            status === 'connecting' ? 'border-yellow-400/30 text-yellow-400' :
                status === 'error' ? 'border-red-400/30 text-red-400' :
                    'border-muted-foreground/30 text-muted-foreground')}>
          {status === 'connected' ? 'ONLINE' :
            status === 'connecting' ? 'SYNC' :
                status === 'error' ? 'ERROR' : 'OFFLINE'}
        </badge_1.Badge>
      </div>

      {/* Connection Metrics */}
      {status === 'connected' && (<div className="grid grid-cols-3 gap-3">
          <div className="text-center p-2 rounded-xl zed-glass">
            <div className="flex items-center justify-center mb-1">
              <lucide_react_1.Signal size={12} className="text-green-400"/>
            </div>
            <p className="text-xs text-muted-foreground">Signal</p>
            <p className="text-sm font-semibold text-foreground">{signalStrength}%</p>
          </div>
          
          <div className="text-center p-2 rounded-xl zed-glass">
            <div className="flex items-center justify-center mb-1">
              <lucide_react_1.Activity size={12} className="text-blue-400"/>
            </div>
            <p className="text-xs text-muted-foreground">Latency</p>
            <p className="text-sm font-semibold text-foreground">{latency}ms</p>
          </div>
          
          <div className="text-center p-2 rounded-xl zed-glass">
            <div className="flex items-center justify-center mb-1">
              <lucide_react_1.Zap size={12} className="text-purple-400"/>
            </div>
            <p className="text-xs text-muted-foreground">Speed</p>
            <p className="text-sm font-semibold text-foreground">{bandwidth}M</p>
          </div>
        </div>)}

      {/* Connection Button */}
      <button_1.Button onClick={handleConnect} className={"w-full rounded-xl ".concat(status === 'connected'
            ? 'bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-400/30'
            : 'zed-gradient')} disabled={status === 'connecting'}>
        {status === 'connecting' ? (<>
            <lucide_react_1.Radio size={16} className="mr-2 animate-spin"/>
            Establishing Connection...
          </>) : status === 'connected' ? (<>
            <lucide_react_1.WifiOff size={16} className="mr-2"/>
            Disconnect Satellite
          </>) : (<>
            <lucide_react_1.Globe size={16} className="mr-2"/>
            Connect to Satellite
          </>)}
      </button_1.Button>

      {/* Status Details */}
      {status === 'connected' && (<div className="pt-2 border-t border-white/10">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Network Protocol:</span>
            <span className="text-foreground font-mono">SAT-NET v2.1</span>
          </div>
          <div className="flex items-center justify-between text-xs mt-1">
            <span className="text-muted-foreground">Orbital Position:</span>
            <span className="text-foreground font-mono">GEO-7 (35.8°N)</span>
          </div>
        </div>)}

      {status === 'error' && (<div className="pt-2 border-t border-red-400/20">
          <p className="text-xs text-red-400 text-center">
            Failed to establish satellite connection. Retrying in 3 seconds...
          </p>
        </div>)}
    </card_1.Card>);
}
