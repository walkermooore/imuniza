import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useAuthStore } from '../../stores/auth'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import type { UserRole } from '../../types'

const API_URL = import.meta.env.VITE_API_URL

interface LoginResponse {
  data: {
    accessToken: string
    user: {
      id: string
      name: string
      email: string
      role: UserRole
    }
  }
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const setCurrentUser = useAuthStore((s) => s.setCurrentUser)
  const setToken = useAuthStore((s) => s.setToken)
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (res.status === 401) {
        setError('E-mail ou senha inválidos')
        return
      }
      if (!res.ok) {
        setError('Erro ao conectar com o servidor. Tente novamente.')
        return
      }
      const data = (await res.json()) as LoginResponse
      setToken(data.data.accessToken)
      setCurrentUser({
        id: data.data.user.id,
        name: data.data.user.name,
        email: data.data.user.email,
        role: data.data.user.role,
        isActive: true,
        createdAt: new Date().toISOString(),
      })
      navigate({ to: '/dashboard' })
    } catch (e) {
      setError('Erro ao conectar com o servidor. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 p-8 border rounded-xl shadow-sm bg-card">
        {/* Logo */}
        <div className="justify-center items-center gap-2 justify-center">
          <img src="/logo.svg" width={45} style={{display: "block", margin: "auto"}} alt="Imunize-Me logo" />
          <span className="text-2xl font-bold block text-center" style={{ color: '#1A2F7C' }}>
            Imunize-Me
          </span>
        </div>

        {/* Email / password form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@exemplo.com"
              required
              disabled={loading}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              disabled={loading}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Entrando…' : 'Entrar'}
          </Button>
        </form>
      </div>
    </div>
  )
}
