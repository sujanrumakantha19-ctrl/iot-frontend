import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login } from '../../services/auth'
import { initSocket } from '../../services/socketClient'
import loginHero from '../../assets/login_hero.png'
import logoImage from '../../assets/logo.png'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const session = await login(email, password)
      if (!session) {
        setError('Invalid email or password')
        setLoading(false)
        return
      }
      initSocket()
      navigate(`/${session.role}/dashboard`)
    } catch (err) {
      setError(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel: Image Only */}
      <div className="hidden lg:block w-1/2 relative overflow-hidden bg-slate-950">
        <img
          src={loginHero}
          alt="IoT Platform"
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Subtle overlay to soften the image slightly but keep it immersive */}
        <div className="absolute inset-0 bg-slate-950/20" />
      </div>

      {/* Right panel: Flat, Immersive Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-12 md:p-16 bg-white">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <img
              src={logoImage}
              alt="Sarayu Logo"
              className="h-16 mx-auto mb-6 object-contain"
            />
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Welcome Back</h2>
            <p className="text-xs text-slate-400 mt-1.5 font-medium">Sign in to manage your ecosystem</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all shadow-sm"
                placeholder="you@example.com"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-3.5 pr-10 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all shadow-sm"
                  placeholder="Enter password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  <i className={`pi ${showPassword ? 'pi-eye-slash' : 'pi-eye'} text-sm`} />
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg px-4 py-3 flex items-center gap-2">
                <i className="pi pi-exclamation-circle text-rose-500" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-semibold text-sm transition-all shadow-md shadow-blue-500/15 cursor-pointer flex items-center justify-center gap-2"
            >
              {loading && <i className="pi pi-spin pi-spinner text-xs" />}
              Sign In
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
