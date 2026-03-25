import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Smartphone, 
  Wifi, 
  WifiOff, 
  QrCode,
  Bluetooth,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle,
  Phone,
  Zap,
  Signal,
  Battery
} from "lucide-react";

interface PhoneLinkProps {
  isCollapsed?: boolean;
}

type ConnectionMethod = 'qr' | 'bluetooth' | 'manual';
type ConnectionStatus = 'disconnected' | 'pairing' | 'connected' | 'error';

interface ConnectedDevice {
  id: string;
  name: string;
  type: 'ios' | 'android';
  battery: number;
  signal: number;
  lastSeen: Date;
}

export default function PhoneLink({ isCollapsed = false }: PhoneLinkProps) {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [method, setMethod] = useState<ConnectionMethod>('qr');
  const [connectedDevices, setConnectedDevices] = useState<ConnectedDevice[]>([]);
  const [pairingCode, setPairingCode] = useState('');
  const [showPairing, setShowPairing] = useState(false);

  useEffect(() => {
    // Simulate device detection
    if (status === 'pairing') {
      const timer = setTimeout(() => {
        if (Math.random() > 0.2) { // 80% success rate
          const newDevice: ConnectedDevice = {
            id: Math.random().toString(36).substr(2, 9),
            name: `${Math.random() > 0.5 ? 'iPhone' : 'Android'} Device`,
            type: Math.random() > 0.5 ? 'ios' : 'android',
            battery: Math.floor(Math.random() * 40) + 60, // 60-100%
            signal: Math.floor(Math.random() * 30) + 70, // 70-100%
            lastSeen: new Date()
          };
          setConnectedDevices([...connectedDevices, newDevice]);
          setStatus('connected');
          setShowPairing(false);
        } else {
          setStatus('error');
          setTimeout(() => setStatus('disconnected'), 3000);
        }
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [status, connectedDevices]);

  const generatePairingCode = () => {
    const code = Math.random().toString(36).substr(2, 8).toUpperCase();
    setPairingCode(code);
    return code;
  };

  const handleConnect = (selectedMethod: ConnectionMethod) => {
    setMethod(selectedMethod);
    setStatus('pairing');
    setShowPairing(true);
    
    if (selectedMethod === 'manual' || selectedMethod === 'qr') {
      generatePairingCode();
    }
  };

  const disconnectDevice = (deviceId: string) => {
    setConnectedDevices(devices => devices.filter(d => d.id !== deviceId));
    if (connectedDevices.length === 1) {
      setStatus('disconnected');
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'connected': return 'text-green-400';
      case 'pairing': return 'text-yellow-400';
      case 'error': return 'text-red-400';
      default: return 'text-muted-foreground';
    }
  };

  const getMethodIcon = (connectionMethod: ConnectionMethod) => {
    switch (connectionMethod) {
      case 'qr': return <QrCode size={16} />;
      case 'bluetooth': return <Bluetooth size={16} />;
      case 'manual': return <Phone size={16} />;
    }
  };

  if (isCollapsed) {
    return (
      <div className="w-full p-3 space-y-3">
        <Button
          onClick={() => handleConnect('qr')}
          variant="ghost"
          size="sm"
          className={`w-full h-10 zed-button rounded-xl ${
            status === 'connected' ? 'zed-glow' : ''
          }`}
          disabled={status === 'pairing'}
        >
          <Smartphone size={16} className={getStatusColor()} />
        </Button>
        
        {connectedDevices.length > 0 && (
          <div className="text-center">
            <Badge className="text-xs bg-green-600/20 text-green-400 border-green-400/30">
              {connectedDevices.length}
            </Badge>
          </div>
        )}
      </div>
    );
  }

  return (
    <Card className="zed-message p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 zed-avatar rounded-2xl flex items-center justify-center">
            <Smartphone size={20} className={getStatusColor()} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Phone Link</h3>
            <p className={`text-xs ${getStatusColor()}`}>
              {status === 'connected' ? `${connectedDevices.length} device(s) linked` :
               status === 'pairing' ? 'Establishing connection...' :
               status === 'error' ? 'Connection failed' :
               'No devices connected'}
            </p>
          </div>
        </div>
        
        <Badge 
          variant="outline" 
          className={`text-xs ${
            status === 'connected' ? 'border-green-400/30 text-green-400' :
            status === 'pairing' ? 'border-yellow-400/30 text-yellow-400' :
            status === 'error' ? 'border-red-400/30 text-red-400' :
            'border-muted-foreground/30 text-muted-foreground'
          }`}
        >
          {status === 'connected' ? 'LINKED' : 
           status === 'pairing' ? 'PAIRING' :
           status === 'error' ? 'ERROR' : 'OFFLINE'}
        </Badge>
      </div>

      {/* Connected Devices */}
      {connectedDevices.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground">Connected Devices</h4>
          {connectedDevices.map((device) => (
            <div key={device.id} className="flex items-center justify-between p-2 rounded-xl zed-glass">
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 zed-avatar rounded-lg flex items-center justify-center">
                  <Smartphone size={12} className="text-green-400" />
                </div>
                <div>
                  <p className="text-xs font-medium text-foreground">{device.name}</p>
                  <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                    <div className="flex items-center space-x-1">
                      <Battery size={10} />
                      <span>{device.battery}%</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Signal size={10} />
                      <span>{device.signal}%</span>
                    </div>
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => disconnectDevice(device.id)}
                className="w-6 h-6 p-0 text-muted-foreground hover:text-red-400"
              >
                <XCircle size={12} />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Connection Methods */}
      {status === 'disconnected' && (
        <div className="space-y-3">
          <h4 className="text-xs font-medium text-muted-foreground">Connection Methods</h4>
          <div className="grid grid-cols-3 gap-2">
            <Button
              onClick={() => handleConnect('qr')}
              variant="ghost"
              size="sm"
              className="flex-col h-16 zed-button rounded-xl space-y-1"
            >
              <QrCode size={16} className="text-purple-400" />
              <span className="text-xs">QR Code</span>
            </Button>
            
            <Button
              onClick={() => handleConnect('bluetooth')}
              variant="ghost"
              size="sm"
              className="flex-col h-16 zed-button rounded-xl space-y-1"
            >
              <Bluetooth size={16} className="text-blue-400" />
              <span className="text-xs">Bluetooth</span>
            </Button>
            
            <Button
              onClick={() => handleConnect('manual')}
              variant="ghost"
              size="sm"
              className="flex-col h-16 zed-button rounded-xl space-y-1"
            >
              <Phone size={16} className="text-cyan-400" />
              <span className="text-xs">Manual</span>
            </Button>
          </div>
        </div>
      )}

      {/* Pairing Interface */}
      {showPairing && status === 'pairing' && (
        <div className="space-y-3 pt-2 border-t border-white/10">
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              {getMethodIcon(method)}
              <RefreshCw size={16} className="ml-2 animate-spin text-yellow-400" />
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
            
            {(method === 'qr' || method === 'manual') && pairingCode && (
              <div className="p-3 rounded-xl zed-glass text-center">
                <p className="text-xs text-muted-foreground mb-1">Pairing Code</p>
                <code className="text-lg font-mono text-cyan-400 tracking-wider">
                  {pairingCode}
                </code>
              </div>
            )}
          </div>
          
          <Button
            onClick={() => {
              setStatus('disconnected');
              setShowPairing(false);
            }}
            variant="ghost"
            size="sm"
            className="w-full zed-button rounded-xl"
          >
            Cancel Pairing
          </Button>
        </div>
      )}

      {/* Error State */}
      {status === 'error' && (
        <div className="text-center py-2">
          <AlertCircle size={20} className="text-red-400 mx-auto mb-2" />
          <p className="text-xs text-red-400">
            Failed to connect to device. Please try again.
          </p>
        </div>
      )}

      {/* Features when connected */}
      {status === 'connected' && connectedDevices.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-white/10">
          <h4 className="text-xs font-medium text-muted-foreground">Available Features</h4>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="flex-col h-12 zed-button rounded-xl space-y-1"
            >
              <Zap size={12} className="text-yellow-400" />
              <span className="text-xs">Sync Chats</span>
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              className="flex-col h-12 zed-button rounded-xl space-y-1"
            >
              <RefreshCw size={12} className="text-green-400" />
              <span className="text-xs">Push Files</span>
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}