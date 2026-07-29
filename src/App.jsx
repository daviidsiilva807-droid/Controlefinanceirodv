import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { Girando } from './components/ui'
import { supabaseConfigurado } from './lib/supabase'
import { marcarAtividade, precisaDestrancar } from './lib/pin'
import { useAuth } from './store/authStore'
import { useDados } from './store/dataStore'
import { useUI } from './store/uiStore'

import { Configuracao } from './pages/Configuracao'
import { Entrar } from './pages/Entrar'
import { Trancado } from './pages/Trancado'
import { Inicio } from './pages/Inicio'
import { Lancamentos } from './pages/Lancamentos'
import { Cartoes } from './pages/Cartoes'
import { Orcamentos } from './pages/Orcamentos'
import { Relatorios } from './pages/Relatorios'
import { Mais } from './pages/Mais'
import { Contas } from './pages/Contas'
import { Categorias } from './pages/Categorias'
import { Recorrentes } from './pages/Recorrentes'
import { Perfil } from './pages/Perfil'
import { Seguranca } from './pages/Seguranca'
import { Mensagens } from './pages/Mensagens'
import { Administracao } from './pages/Administracao'

export default function App() {
  const iniciarTema = useUI((s) => s.iniciarTema)
  const iniciar = useAuth((s) => s.iniciar)
  const carregando = useAuth((s) => s.carregando)
  const sessao = useAuth((s) => s.sessao)
  const trancado = useAuth((s) => s.trancado)
  const trancar = useAuth((s) => s.trancar)
  const carregarDados = useDados((s) => s.carregar)
  const limparDados = useDados((s) => s.limpar)

  const userId = sessao?.user?.id

  useEffect(() => {
    iniciarTema()
    iniciar()
  }, [iniciarTema, iniciar])

  // Contas e categorias são carregadas quando há sessão, e descartadas no
  // logout para não vazarem para a próxima conta que entrar neste aparelho.
  useEffect(() => {
    if (userId) carregarDados().catch(() => {})
    else limparDados()
  }, [userId, carregarDados, limparDados])

  /**
   * Tranca o app quando ele volta do segundo plano depois do tempo limite.
   * `visibilitychange` é o evento que funciona em PWA instalado — no iOS a
   * aba não é "fechada", ela só fica escondida.
   */
  useEffect(() => {
    if (!sessao) return
    const aoMudarVisibilidade = () => {
      if (document.visibilityState === 'hidden') marcarAtividade()
      else if (precisaDestrancar()) trancar()
    }
    document.addEventListener('visibilitychange', aoMudarVisibilidade)
    return () => document.removeEventListener('visibilitychange', aoMudarVisibilidade)
  }, [sessao, trancar])

  if (!supabaseConfigurado) return <Configuracao />
  if (carregando) return <TelaDeAbertura />
  if (!sessao) return <Entrar />
  if (trancado) return <Trancado />

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Inicio />} />
        <Route path="lancamentos" element={<Lancamentos />} />
        <Route path="cartoes" element={<Cartoes />} />
        <Route path="orcamentos" element={<Orcamentos />} />
        <Route path="relatorios" element={<Relatorios />} />
        <Route path="mensagens" element={<Mensagens />} />
        <Route path="mais" element={<Mais />} />
        <Route path="mais/contas" element={<Contas />} />
        <Route path="mais/categorias" element={<Categorias />} />
        <Route path="mais/recorrentes" element={<Recorrentes />} />
        <Route path="mais/perfil" element={<Perfil />} />
        <Route path="mais/seguranca" element={<Seguranca />} />
        {/* A guarda de admin fica dentro da própria tela: esconder o link do
            menu é conveniência, não controle de acesso. */}
        <Route path="mais/administracao" element={<Administracao />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function TelaDeAbertura() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-slate-950 text-white">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-600 text-3xl">
        📊
      </div>
      <Girando className="text-brand-400" />
    </div>
  )
}
