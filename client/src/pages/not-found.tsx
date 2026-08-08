import { useLocation } from 'wouter'

export default function NotFoundPage() {
  const [, setLocation] = useLocation()

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black p-4">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-20 top-20 h-96 w-96 rounded-full bg-cyan-500/5 blur-3xl zar-float" />
        <div className="absolute bottom-20 right-20 h-80 w-80 rounded-full bg-fuchsia-500/5 blur-3xl zar-float" />
      </div>
      <div className="zar-glass zar-glow relative z-10 mx-auto max-w-md rounded-2xl p-10 text-center">
        <h1 className="mb-4 bg-gradient-to-r from-purple-400 via-cyan-300 to-pink-400 bg-clip-text text-7xl font-bold text-transparent">
          404
        </h1>
        <h2 className="mb-3 text-2xl font-semibold text-white">Page not found</h2>
        <p className="mb-8 text-sm text-muted-foreground">
          This route doesn't exist or has moved. Head back to Nexys to find your way.
        </p>
        <button
          onClick={() => setLocation('/')}
          className="zar-button zar-gradient rounded-xl px-6 py-3 font-semibold text-white transition-all"
        >
          Back to Nexys
        </button>
      </div>
    </div>
  )
}
