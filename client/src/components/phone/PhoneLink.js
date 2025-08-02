"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = PhoneLink;
var react_1 = require("react");
var button_1 = require("@/components/ui/button");
var card_1 = require("@/components/ui/card");
var badge_1 = require("@/components/ui/badge");
var lucide_react_1 = require("lucide-react");
function PhoneLink(_a) {
    var _b = _a.isCollapsed, isCollapsed = _b === void 0 ? false : _b;
    var _c = (0, react_1.useState)('disconnected'), status = _c[0], setStatus = _c[1];
    var _d = (0, react_1.useState)('qr'), method = _d[0], setMethod = _d[1];
    var _e = (0, react_1.useState)([]), connectedDevices = _e[0], setConnectedDevices = _e[1];
    var _f = (0, react_1.useState)(''), pairingCode = _f[0], setPairingCode = _f[1];
    var _g = (0, react_1.useState)(false), showPairing = _g[0], setShowPairing = _g[1];
    (0, react_1.useEffect)(function () {
        // Simulate device detection
        if (status === 'pairing') {
            var timer_1 = setTimeout(function () {
                if (Math.random() > 0.2) { // 80% success rate
                    var newDevice = {
                        id: Math.random().toString(36).substr(2, 9),
                        name: "".concat(Math.random() > 0.5 ? 'iPhone' : 'Android', " Device"),
                        type: Math.random() > 0.5 ? 'ios' : 'android',
                        battery: Math.floor(Math.random() * 40) + 60, // 60-100%
                        signal: Math.floor(Math.random() * 30) + 70, // 70-100%
                        lastSeen: new Date()
                    };
                    setConnectedDevices(__spreadArray(__spreadArray([], connectedDevices, true), [newDevice], false));
                    setStatus('connected');
                    setShowPairing(false);
                }
                else {
                    setStatus('error');
                    setTimeout(function () { return setStatus('disconnected'); }, 3000);
                }
            }, 3000);
            return function () { return clearTimeout(timer_1); };
        }
    }, [status, connectedDevices]);
    var generatePairingCode = function () {
        var code = Math.random().toString(36).substr(2, 8).toUpperCase();
        setPairingCode(code);
        return code;
    };
    var handleConnect = function (selectedMethod) {
        setMethod(selectedMethod);
        setStatus('pairing');
        setShowPairing(true);
        if (selectedMethod === 'manual' || selectedMethod === 'qr') {
            generatePairingCode();
        }
    };
    var disconnectDevice = function (deviceId) {
        setConnectedDevices(function (devices) { return devices.filter(function (d) { return d.id !== deviceId; }); });
        if (connectedDevices.length === 1) {
            setStatus('disconnected');
        }
    };
    var getStatusColor = function () {
        switch (status) {
            case 'connected': return 'text-green-400';
            case 'pairing': return 'text-yellow-400';
            case 'error': return 'text-red-400';
            default: return 'text-muted-foreground';
        }
    };
    var getMethodIcon = function (connectionMethod) {
        switch (connectionMethod) {
            case 'qr': return <lucide_react_1.QrCode size={16}/>;
            case 'bluetooth': return <lucide_react_1.Bluetooth size={16}/>;
            case 'manual': return <lucide_react_1.Phone size={16}/>;
        }
    };
    if (isCollapsed) {
        return (<div className="w-full p-3 space-y-3">
        <button_1.Button onClick={function () { return handleConnect('qr'); }} variant="ghost" size="sm" className={"w-full h-10 zed-button rounded-xl ".concat(status === 'connected' ? 'zed-glow' : '')} disabled={status === 'pairing'}>
          <lucide_react_1.Smartphone size={16} className={getStatusColor()}/>
        </button_1.Button>
        
        {connectedDevices.length > 0 && (<div className="text-center">
            <badge_1.Badge className="text-xs bg-green-600/20 text-green-400 border-green-400/30">
              {connectedDevices.length}
            </badge_1.Badge>
          </div>)}
      </div>);
    }
    return (<card_1.Card className="zed-message p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 zed-avatar rounded-2xl flex items-center justify-center">
            <lucide_react_1.Smartphone size={20} className={getStatusColor()}/>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Phone Link</h3>
            <p className={"text-xs ".concat(getStatusColor())}>
              {status === 'connected' ? "".concat(connectedDevices.length, " device(s) linked") :
            status === 'pairing' ? 'Establishing connection...' :
                status === 'error' ? 'Connection failed' :
                    'No devices connected'}
            </p>
          </div>
        </div>
        
        <badge_1.Badge variant="outline" className={"text-xs ".concat(status === 'connected' ? 'border-green-400/30 text-green-400' :
            status === 'pairing' ? 'border-yellow-400/30 text-yellow-400' :
                status === 'error' ? 'border-red-400/30 text-red-400' :
                    'border-muted-foreground/30 text-muted-foreground')}>
          {status === 'connected' ? 'LINKED' :
            status === 'pairing' ? 'PAIRING' :
                status === 'error' ? 'ERROR' : 'OFFLINE'}
        </badge_1.Badge>
      </div>

      {/* Connected Devices */}
      {connectedDevices.length > 0 && (<div className="space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground">Connected Devices</h4>
          {connectedDevices.map(function (device) { return (<div key={device.id} className="flex items-center justify-between p-2 rounded-xl zed-glass">
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 zed-avatar rounded-lg flex items-center justify-center">
                  <lucide_react_1.Smartphone size={12} className="text-green-400"/>
                </div>
                <div>
                  <p className="text-xs font-medium text-foreground">{device.name}</p>
                  <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                    <div className="flex items-center space-x-1">
                      <lucide_react_1.Battery size={10}/>
                      <span>{device.battery}%</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <lucide_react_1.Signal size={10}/>
                      <span>{device.signal}%</span>
                    </div>
                  </div>
                </div>
              </div>
              <button_1.Button variant="ghost" size="sm" onClick={function () { return disconnectDevice(device.id); }} className="w-6 h-6 p-0 text-muted-foreground hover:text-red-400">
                <lucide_react_1.XCircle size={12}/>
              </button_1.Button>
            </div>); })}
        </div>)}

      {/* Connection Methods */}
      {status === 'disconnected' && (<div className="space-y-3">
          <h4 className="text-xs font-medium text-muted-foreground">Connection Methods</h4>
          <div className="grid grid-cols-3 gap-2">
            <button_1.Button onClick={function () { return handleConnect('qr'); }} variant="ghost" size="sm" className="flex-col h-16 zed-button rounded-xl space-y-1">
              <lucide_react_1.QrCode size={16} className="text-purple-400"/>
              <span className="text-xs">QR Code</span>
            </button_1.Button>
            
            <button_1.Button onClick={function () { return handleConnect('bluetooth'); }} variant="ghost" size="sm" className="flex-col h-16 zed-button rounded-xl space-y-1">
              <lucide_react_1.Bluetooth size={16} className="text-blue-400"/>
              <span className="text-xs">Bluetooth</span>
            </button_1.Button>
            
            <button_1.Button onClick={function () { return handleConnect('manual'); }} variant="ghost" size="sm" className="flex-col h-16 zed-button rounded-xl space-y-1">
              <lucide_react_1.Phone size={16} className="text-cyan-400"/>
              <span className="text-xs">Manual</span>
            </button_1.Button>
          </div>
        </div>)}

      {/* Pairing Interface */}
      {showPairing && status === 'pairing' && (<div className="space-y-3 pt-2 border-t border-white/10">
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              {getMethodIcon(method)}
              <lucide_react_1.RefreshCw size={16} className="ml-2 animate-spin text-yellow-400"/>
            </div>
            <p className="text-sm font-medium text-foreground mb-1">
              {method === 'qr' ? 'Scan QR Code' :
                method === 'bluetooth' ? 'Bluetooth Pairing' :
                    'Manual Pairing'}
            </p>
            <p className="text-xs text-muted-foreground mb-3">
              {method === 'qr' ? 'Open ZED mobile app and scan the code below' :
                method === 'bluetooth' ? 'Make sure Bluetooth is enabled on your device' :
                    'Enter the pairing code in the ZED mobile app'}
            </p>
            
            {(method === 'qr' || method === 'manual') && pairingCode && (<div className="p-3 rounded-xl zed-glass text-center">
                <p className="text-xs text-muted-foreground mb-1">Pairing Code</p>
                <code className="text-lg font-mono text-cyan-400 tracking-wider">
                  {pairingCode}
                </code>
              </div>)}
          </div>
          
          <button_1.Button onClick={function () {
                setStatus('disconnected');
                setShowPairing(false);
            }} variant="ghost" size="sm" className="w-full zed-button rounded-xl">
            Cancel Pairing
          </button_1.Button>
        </div>)}

      {/* Error State */}
      {status === 'error' && (<div className="text-center py-2">
          <lucide_react_1.AlertCircle size={20} className="text-red-400 mx-auto mb-2"/>
          <p className="text-xs text-red-400">
            Failed to connect to device. Please try again.
          </p>
        </div>)}

      {/* Features when connected */}
      {status === 'connected' && connectedDevices.length > 0 && (<div className="space-y-2 pt-2 border-t border-white/10">
          <h4 className="text-xs font-medium text-muted-foreground">Available Features</h4>
          <div className="grid grid-cols-2 gap-2">
            <button_1.Button variant="ghost" size="sm" className="flex-col h-12 zed-button rounded-xl space-y-1">
              <lucide_react_1.Zap size={12} className="text-yellow-400"/>
              <span className="text-xs">Sync Chats</span>
            </button_1.Button>
            
            <button_1.Button variant="ghost" size="sm" className="flex-col h-12 zed-button rounded-xl space-y-1">
              <lucide_react_1.RefreshCw size={12} className="text-green-400"/>
              <span className="text-xs">Push Files</span>
            </button_1.Button>
          </div>
        </div>)}
    </card_1.Card>);
}
