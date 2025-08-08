import { useSignal } from '../hooks/useSignal';

export default function SignalSidebar() {
  const { signalStrength, connected } = useSignal();
  return (
    <aside className="hidden md:flex flex-col w-64 bg-gray-900 border-r border-gray-800 p-4 z-20">
      <div className="font-bold text-lg mb-4 text-cyan-400">Signal</div>
      <div className="flex items-center space-x-2 mb-2">
        <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'}`}></div>
        <span className="text-sm">{connected ? 'Connected' : 'Disconnected'}</span>
      </div>
      <div className="text-xs text-gray-400">Signal Strength: {signalStrength}%</div>
    </aside>
  );
}
