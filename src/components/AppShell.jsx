import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Icone } from './Icone'
import { BotaoIcone } from './ui'
import { useNaoLidas } from '../hooks/useMensagens'
import { Toast } from './Toast'
import { DicaInstalar } from './DicaInstalar'
import { FormLancamento } from '../pages/FormLancamento'
import { useUI } from '../store/uiStore'

const ABAS = [
  { para: '/', icone: 'casa', rotulo: 'Início' },
  { para: '/lancamentos', icone: 'lista', rotulo: 'Lançar' },
  null, // espaço do botão flutuante
  { para: '/cartoes', icone: 'cartao', rotulo: 'Cartões' },
  { para: '/mais', icone: 'menu', rotulo: 'Mais' },
]

export function AppShell() {
  const abrirForm = useUI((s) => s.abrirForm)
  const formLancamento = useUI((s) => s.formLancamento)
  const { pathname } = useLocation()

  return (
    <div className="min-h-dvh bg-slate-50 dark:bg-slate-950">
      {/* pb-32 reserva a altura da barra inferior + o botão flutuante, para o
          último item da lista nunca ficar escondido atrás deles. */}
      <main className="mx-auto max-w-lg pb-32">
        <Outlet />
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/90
          backdrop-blur-lg dark:border-slate-800 dark:bg-slate-900/90"
        aria-label="Navegação principal"
      >
        <div className="mx-auto flex max-w-lg items-stretch justify-around px-2">
          {ABAS.map((aba, i) =>
            aba ? (
              <NavLink
                key={aba.para}
                to={aba.para}
                end={aba.para === '/'}
                className={({ isActive }) =>
                  `flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium
                   transition-colors ${
                     isActive
                       ? 'text-brand-600 dark:text-brand-400'
                       : 'text-slate-500 dark:text-slate-400'
                   }`
                }
              >
                <Icone nome={aba.icone} tamanho={22} />
                {aba.rotulo}
              </NavLink>
            ) : (
              // Espaçador: o botão flutuante ocupa este lugar visualmente.
              <div key="fab" className="w-16 shrink-0" aria-hidden="true" />
            )
          )}
        </div>
        <div className="h-safe-bottom" />
      </nav>

      <button
        onClick={() => abrirForm({})}
        aria-label="Novo lançamento"
        className="fixed bottom-7 left-1/2 z-40 flex h-16 w-16 -translate-x-1/2 items-center
          justify-center rounded-full bg-brand-600 text-white shadow-lg shadow-brand-600/30
          transition-transform active:scale-95 dark:shadow-brand-900/50 mb-safe"
      >
        <Icone nome="mais" tamanho={28} />
      </button>

      {formLancamento && <FormLancamento />}
      {/* A dica de instalação só faz sentido nas telas principais, não em
          submenus de configuração. */}
      {pathname === '/' && <DicaInstalar />}
      <Toast />
    </div>
  )
}

/** Cabeçalho das subtelas de configuração, com botão de voltar. */
export function CabecalhoVoltar({ titulo, subtitulo, acao }) {
  const navegar = useNavigate()
  return (
    <header className="sticky top-0 z-20 flex min-h-14 items-center gap-1 border-b border-slate-200
      bg-slate-50/90 px-2 pt-safe backdrop-blur-lg dark:border-slate-800 dark:bg-slate-950/90">
      <BotaoIcone nome="esquerda" rotulo="Voltar" onClick={() => navegar(-1)} />
      <div className="min-w-0 flex-1 py-2">
        <h1 className="truncate text-lg font-bold">{titulo}</h1>
        {subtitulo && (
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">{subtitulo}</p>
        )}
      </div>
      {acao}
    </header>
  )
}

/**
 * Sino de mensagens com contador de não lidas.
 *
 * Fica no cabeçalho das telas principais, e não na barra inferior, porque a
 * barra já tem cinco itens — um sexto deixaria os alvos de toque estreitos
 * demais para o polegar.
 */
export function Sino() {
  const naoLidas = useNaoLidas()

  return (
    <NavLink
      to="/mensagens"
      aria-label={naoLidas ? `Mensagens, ${naoLidas} não lidas` : 'Mensagens'}
      className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl
        text-slate-600 transition-colors active:bg-slate-200 dark:text-slate-300
        dark:active:bg-slate-800"
    >
      <Icone nome="sino" tamanho={20} />
      {naoLidas > 0 && (
        <span
          className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center
            rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white"
        >
          {naoLidas > 9 ? '9+' : naoLidas}
        </span>
      )}
    </NavLink>
  )
}

/** Cabeçalho padrão das telas internas. */
export function Cabecalho({ titulo, subtitulo, acao, children, comSino = true }) {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50/90 px-4 pt-safe
      backdrop-blur-lg dark:border-slate-800 dark:bg-slate-950/90">
      <div className="flex min-h-14 items-center justify-between gap-2 py-2">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold">{titulo}</h1>
          {subtitulo && (
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">{subtitulo}</p>
          )}
        </div>
        {acao}
        {comSino && <Sino />}
      </div>
      {children}
    </header>
  )
}
