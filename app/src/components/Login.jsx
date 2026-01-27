import { useState, useRef, useEffect } from 'react'
import { Bot, Lock, User, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function Login({ onLogin }) {
  const canvasRef = useRef(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      })

      const data = await response.json()

      if (data.success) {
        // Store token
        if (data.token) {
          localStorage.setItem('localbase-auth-token', data.token)
        }
        onLogin()
      } else {
        setError(data.error || 'Login failed')
      }
    } catch (err) {
      setError('Connection failed')
    } finally {
      setLoading(false)
    }
  }

  // Starfield animation (same as Home.jsx)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    canvas.width = canvas.offsetWidth
    canvas.height = canvas.offsetHeight

    const centerX = canvas.width / 2
    const centerY = canvas.height / 2

    const stars = Array.from({ length: 800 }, () => {
      const angle = Math.random() * Math.PI * 2
      const distance = Math.random() * 2000
      return {
        x: centerX + Math.cos(angle) * distance,
        y: centerY + Math.sin(angle) * distance,
        z: Math.random() * 3000,
        angle: angle,
        speed: Math.random() * 6 + 2
      }
    })

    let animationId
    const animate = () => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.15)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      stars.forEach(star => {
        star.z -= star.speed

        if (star.z <= 0) {
          star.z = 3000
          star.angle = Math.random() * Math.PI * 2
          const distance = Math.random() * 2000
          star.x = centerX + Math.cos(star.angle) * distance
          star.y = centerY + Math.sin(star.angle) * distance
        }

        const k = 128 / star.z
        const px = (star.x - centerX) * k + centerX
        const py = (star.y - centerY) * k + centerY
        const size = (1 - star.z / 3000) * 0.8
        const opacity = (1 - star.z / 3000) * 0.7

        const prevZ = star.z + star.speed
        const prevK = 128 / prevZ
        const prevPx = (star.x - centerX) * prevK + centerX
        const prevPy = (star.y - centerY) * prevK + centerY

        ctx.beginPath()
        ctx.moveTo(prevPx, prevPy)
        ctx.lineTo(px, py)
        ctx.strokeStyle = `rgba(134, 239, 172, ${opacity * 0.6})`
        ctx.lineWidth = size * 0.5
        ctx.stroke()

        ctx.beginPath()
        ctx.arc(px, py, size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(134, 239, 172, ${opacity})`
        ctx.fill()
      })

      animationId = requestAnimationFrame(animate)
    }

    animate()

    const handleResize = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    window.addEventListener('resize', handleResize)

    return () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  return (
    <div className="h-screen w-screen flex items-center justify-center relative overflow-hidden bg-background">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ background: 'transparent' }}
      />
      <div className="relative z-10 text-center space-y-8 max-w-md px-8">
        <div className="space-y-6">
          <Bot className="h-20 w-20 mx-auto text-green-400 opacity-80" strokeWidth={1} />

          <div className="space-y-2">
            <h1 className="text-xl font-medium tracking-tight text-muted-foreground">
              welcome to
            </h1>
            <h2 className="text-4xl font-bold tracking-tight text-green-400 font-mono">
              localbase
            </h2>
          </div>
        </div>

        <Card className="border-border bg-card/80 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Lock className="h-4 w-4" />
              Sign in to continue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="pl-10 bg-background border-border focus:border-green-400 font-mono"
                    autoFocus
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10 bg-background border-border focus:border-green-400 font-mono"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <p className="text-sm text-red-400 text-center">{error}</p>
              )}

              <Button
                type="submit"
                disabled={!username || !password || loading}
                className="w-full bg-green-400 text-black hover:bg-green-500 font-mono disabled:opacity-50"
              >
                {loading ? 'Signing in...' : 'Sign in'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">
          your local-first analytics workspace
        </p>
      </div>
    </div>
  )
}
