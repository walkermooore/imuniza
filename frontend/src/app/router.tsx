import { Outlet, createRootRoute, createRoute, createRouter, redirect } from '@tanstack/react-router'
import { Toaster } from '../components/ui/toaster'
import { useAuthStore } from '../stores/auth'
import AuthLayout from './layouts/AuthLayout'
import { DevRibbon } from '../components/DevRibbon'

// ─── Page imports ─────────────────────────────────────────────────────────────

import LoginPage from './pages/LoginPage'
import DisponibilidadePage from './pages/DisponibilidadePage'
import DashboardPage from './pages/DashboardPage'
import AberturasPage from './pages/AberturasPage'
import DescartesPage from './pages/DescartesPage'
import MonitoramentoPage from './pages/MonitoramentoPage'
import LotesPage from './pages/LotesPage'
import VacinasPage from './pages/VacinasPage'
import LocaisPage from './pages/LocaisPage'
import SalasPage from './pages/SalasPage'
import EquipePage from './pages/EquipePage'
import UsuariosPage from './pages/UsuariosPage'
import MotivosAberturaPage from './pages/MotivosAberturaPage'
import MotivosDescartePage from './pages/MotivosDescartePage'
import ParametrosPage from './pages/ParametrosPage'
import DisponibilidadeInternaPage from './pages/DisponibilidadeInternaPage'
import DisponibilidadeUbsPage from './pages/DisponibilidadeUbsPage'

// ─── Root route ───────────────────────────────────────────────────────────────

const rootRoute = createRootRoute({
  component: () => (
    <>
      <Outlet />
      <Toaster />
      <DevRibbon />
    </>
  ),
})

// ─── Public routes ────────────────────────────────────────────────────────────

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
})

const disponibilidadePublicRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/disponibilidade',
  component: DisponibilidadePage,
})

const disponibilidadeUbsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/disponibilidade/ubs/$id',
  component: DisponibilidadeUbsPage,
})

// ─── Authenticated layout route (pathless) ────────────────────────────────────

const authenticatedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'authenticated',
  beforeLoad: () => {
    const { currentUser } = useAuthStore.getState()
    if (!currentUser) {
      throw redirect({ to: '/login' })
    }
  },
  component: AuthLayout,
})

// ─── Index redirect ───────────────────────────────────────────────────────────

const indexRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/dashboard' })
  },
})

// ─── Dashboard ────────────────────────────────────────────────────────────────

const dashboardRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/dashboard',
  component: DashboardPage,
})

// ─── Operações ────────────────────────────────────────────────────────────────

const aberturasRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/operacoes/aberturas',
  component: AberturasPage,
})

const descartesRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/operacoes/descartes',
  component: DescartesPage,
})

const monitoramentoRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/operacoes/monitoramento',
  component: MonitoramentoPage,
})

// ─── Estoque ──────────────────────────────────────────────────────────────────

const lotesRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/estoque/lotes',
  component: LotesPage,
})

const vacinasRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/estoque/vacinas',
  component: VacinasPage,
})

// ─── Estrutura ────────────────────────────────────────────────────────────────

const locaisRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/estrutura/locais',
  component: LocaisPage,
})

const salasRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/estrutura/salas',
  component: SalasPage,
})

const equipeRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/estrutura/equipe',
  component: EquipePage,
})

// ─── Configurações ────────────────────────────────────────────────────────────

const usuariosRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/configuracoes/usuarios',
  component: UsuariosPage,
})

const motivosAberturaRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/configuracoes/motivos-abertura',
  component: MotivosAberturaPage,
})

const motivosDescarteRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/configuracoes/motivos-descarte',
  component: MotivosDescartePage,
})

const parametrosRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/configuracoes/parametros',
  component: ParametrosPage,
})

// ─── Disponibilidade interna ──────────────────────────────────────────────────

const disponibilidadeInternaRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/disponibilidade-interna',
  component: DisponibilidadeInternaPage,
})

// ─── Route tree ───────────────────────────────────────────────────────────────

const routeTree = rootRoute.addChildren([
  loginRoute,
  disponibilidadePublicRoute,
  disponibilidadeUbsRoute,
  authenticatedRoute.addChildren([
    indexRoute,
    dashboardRoute,
    aberturasRoute,
    descartesRoute,
    monitoramentoRoute,
    lotesRoute,
    vacinasRoute,
    locaisRoute,
    salasRoute,
    equipeRoute,
    usuariosRoute,
    motivosAberturaRoute,
    motivosDescarteRoute,
    parametrosRoute,
    disponibilidadeInternaRoute,
  ]),
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
