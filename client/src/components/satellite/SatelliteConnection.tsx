import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Satellite, 
  Wifi, 
  WifiOff, 
  Radio, 
  Signal,
  Zap,
  Globe,
  Activity,
  AlertTriangle
} from "lucide-react";

interface SatelliteConnectionProps {
  isCollapsed?: boolean;
}

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export default function SatelliteConnection({ isCollapsed = false }: SatelliteConnectionProps) {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [signalStrength, setSignalStrength] = useState(0);
  const [latency, setLatency] = useState(0);
  const [bandwidth, setBandwidth] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (status === 'connected') {
      interval = setInterval(() => {
        // Simulate realistic satellite connection metrics
        setSignalStrength(Math.floor(Math.random() * 20) + 80); // 80-100%
        setLatency(Math.floor(Math.random() * 100) + 200); // 200-300ms
        setBandwidth(Math.floor(Math.random() * 50) + 100); // 100-150 Mbps
      }, 2000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [status]);

  const handleConnect = async () => {
    if (status === 'connected') {
      setStatus('disconnected');
      setSignalStrength(0);
      setLatency(0);
      setBandwidth(0);
      return;
    }

    setStatus('connecting');
    
    // Simulate connection process
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    if (Math.random() > 0.1) { // 90% success rate
      setStatus('connected');
      setSignalStrength(85);
      setLatency(250);
      setBandwidth(125);
    } else {
      setStatus('error');
      setTimeout(() => setStatus('disconnected'), 3000);
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'connected': return 'text-green-400';
      case 'connecting': return 'text-yellow-400';
      case 'error': return 'text-red-400';
      default: return 'text-muted-foreground';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'connected': return <Satellite size={16} className="text-green-400" />;
      case 'connecting': return <Radio size={16} className="text-yellow-400 animate-pulse" />;
      case 'error': return <AlertTriangle size={16} className="text-red-400" />;
      default: return <WifiOff size={16} className="text-muted-foreground" />;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'connected': return 'Satellite Online';
      case 'connecting': return 'Establishing Link...';
      case 'error': return 'Connection Failed';
      default: return 'Offline';
    }
  };

  if (isCollapsed) {
    return (
      <div className="w-full p-3 space-y-3">
        <Button
          onClick={handleConnect}
          variant="ghost"
          size="sm"
          className={`w-full h-10 zed-button rounded-xl ${
            status === 'connected' ? 'zed-glow' : ''
          }`}
          disabled={status === 'connecting'}
        >
          {getStatusIcon()}
        </Button>
        
        {status === 'connected' && (
          <div className="space-y-1">
            <div className="flex items-center justify-center">
              <div className={`w-2 h-2 rounded-full ${
                signalStrength > 80 ? 'bg-green-400' : 
                signalStrength > 60 ? 'bg-yellow-400' : 'bg-red-400'
              }`} />
            </div>
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
            {getStatusIcon()}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Satellite Link</h3>
            <p className={`text-xs ${getStatusColor()}`}>
              {getStatusText()}
            </p>
          </div>
        </div>
        
        <Badge 
          variant="outline" 
          className={`text-xs ${
            status === 'connected' ? 'border-green-400/30 text-green-400' :
            status === 'connecting' ? 'border-yellow-400/30 text-yellow-400' :
            status === 'error' ? 'border-red-400/30 text-red-400' :
            'border-muted-foreground/30 text-muted-foreground'
          }`}
        >
          {status === 'connected' ? 'ONLINE' : 
           status === 'connecting' ? 'SYNC' :
           status === 'error' ? 'ERROR' : 'OFFLINE'}
        </Badge>
      </div>

      {/* Connection Metrics */}
      {status === 'connected' && (
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-2 rounded-xl zed-glass">
            <div className="flex items-center justify-center mb-1">
              <Signal size={12} className="text-green-400" />
            </div>
            <p className="text-xs text-muted-foreground">Signal</p>
            <p className="text-sm font-semibold text-foreground">{signalStrength}%</p>
          </div>
          
          <div className="text-center p-2 rounded-xl zed-glass">
            <div className="flex items-center justify-center mb-1">
              <Activity size={12} className="text-blue-400" />
            </div>
            <p className="text-xs text-muted-foreground">Latency</p>
            <p className="text-sm font-semibold text-foreground">{latency}ms</p>
          </div>
          
          <div className="text-center p-2 rounded-xl zed-glass">
            <div className="flex items-center justify-center mb-1">
              <Zap size={12} className="text-purple-400" />
            </div>
            <p className="text-xs text-muted-foreground">Speed</p>
            <p className="text-sm font-semibold text-foreground">{bandwidth}M</p>
          </div>
        </div>
      )}

      {/* Connection Button */}
      <Button
        onClick={handleConnect}
        className={`w-full rounded-xl ${
          status === 'connected' 
            ? 'bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-400/30' 
            : 'zed-gradient'
        }`}
        disabled={status === 'connecting'}
      >
        {status === 'connecting' ? (
          <>
            <Radio size={16} className="mr-2 animate-spin" />
            Establishing Connection...
          </>
        ) : status === 'connected' ? (
          <>
            <WifiOff size={16} className="mr-2" />
            Disconnect Satellite
          </>
        ) : (
          <>
            <Globe size={16} className="mr-2" />
            Connect to Satellite
          </>
        )}
      </Button>

      {/* Status Details */}
      {status === 'connected' && (
        <div className="pt-2 border-t border-white/10">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Network Protocol:</span>
            <span className="text-foreground font-mono">SAT-NET v2.1</span>
          </div>
          <div className="flex items-center justify-between text-xs mt-1">
            <span className="text-muted-foreground">Orbital Position:</span>
            <span className="text-foreground font-mono">GEO-7 (35.8°N)</span>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="pt-2 border-t border-red-400/20">
          <p className="text-xs text-red-400 text-center">
            Failed to establish satellite connection. Retrying in 3 seconds...
          </p>
        </div>
      )}
    </Card>
  );
}