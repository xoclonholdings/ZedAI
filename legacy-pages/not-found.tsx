import { useLocation } from 'wouter'

export default function NotFoundPage() {
  const [, setLocation] = useLocation()

  return (
    <div className="min-h-screen bg-black cyberpunk-bg flex items-center justify-center">
      <div className="text-center max-w-md mx-auto p-8">
        <h1 className="text-8xl font-bold gradient-text mb-4">404</h1>
        <h2 className="text-2xl font-semibold text-white mb-4">Page Not Found</h2>
        <p className="text-gray-400 mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <button
          onClick={() => setLocation('/')}
          className="bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200"
        >
          Go Home
        </button>
      </div>
    </div>
  )
}
