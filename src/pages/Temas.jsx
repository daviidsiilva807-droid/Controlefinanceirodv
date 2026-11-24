import { CabecalhoVoltar } from '../components/AppShell'
import { Icone } from '../components/Icone'
import { Cartao, TituloSecao } from '../components/ui'
import { useUI } from '../store/uiStore'

const OPCOES = [
  {
    id: 'gelo',
    nome: 'Cinza gelo',
    descricao: 'Leveza e contraste com azul ardósia e vermelho cereja.',
    cores: [
      { cor: '#F1F5F9', proporcao: 60 },
      { cor: '#475569', proporcao: 30 },
      { cor: '#C1121F', proporcao: 10 },
    ],
  },
  {
    id: 'verde',
    nome: 'Verde crescimento',
    descricao: 'Equilíbrio e constância para acompanhar suas metas.',
    cores: ['#052E2B', '#0F766E', '#34D399', '#A7F3D0', '#ECFDF5'].map((cor) => ({ cor })),
  },
  {
    id: 'vinho',
    nome: 'Vinho champagne',
    descricao: 'Uma paleta quente, elegante e com presença.',
    cores: ['#1F0D12', '#5B1A2B', '#9F2D45', '#E7C6CF', '#FFF5F7'].map((cor) => ({ cor })),
  },
  {
    id: 'azul',
    nome: 'Azul amanhecer',
    descricao: 'Clareza e tranquilidade para suas decisões financeiras.',
    cores: ['#061A24', '#0B3A53', '#0FA3B1', '#B5E2FA', '#F3FAFF'].map((cor) => ({ cor })),
  },
  {
    id: 'neon',
    nome: 'Dashboard neon',
    descricao: 'Contraste forte, painéis escuros e energia para agir.',
    cores: ['#0B0D0F', '#20242A', '#00D77B', '#B8FF3D', '#F3F7ED'].map((cor) => ({ cor })),
  },
]

export function Temas() {
  const tema = useUI((state) => state.tema)
  const definirTema = useUI((state) => state.definirTema)

  return (
    <>
      <CabecalhoVoltar titulo="Temas" />
      <div className="space-y-5 p-4">
        <section>
          <TituloSecao>Escolha uma identidade</TituloSecao>
          <div className="space-y-3">
            {OPCOES.map((opcao) => {
              const selecionado = tema === opcao.id
              return (
                <button
                  key={opcao.id}
                  type="button"
                  aria-pressed={selecionado}
                  onClick={() => definirTema(opcao.id)}
                  className={`w-full rounded-2xl border p-4 text-left transition-all active:scale-[.99] ${
                    selecionado
                      ? 'border-brand-600 bg-brand-50 ring-2 ring-brand-600/20 dark:border-brand-400 dark:bg-brand-950/40'
                      : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
                      <Icone nome="paleta" tamanho={19} className="text-slate-600 dark:text-slate-300" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-3">
                        <span className="font-semibold">{opcao.nome}</span>
                        {selecionado && <Icone nome="check" tamanho={18} className="shrink-0 text-brand-600 dark:text-brand-400" />}
                      </span>
                      <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">{opcao.descricao}</span>
                    </span>
                  </div>
                  <span className="mt-4 flex h-12 overflow-hidden rounded-xl border border-black/5 shadow-inner dark:border-white/5">
                    {opcao.cores.map(({ cor, proporcao }) => (
                      <span key={cor} className="min-w-0 flex-1" style={{ backgroundColor: cor, flexBasis: proporcao ? `${proporcao}%` : undefined }} />
                    ))}
                  </span>
                  <span className="mt-2 flex justify-between text-[10px] font-medium text-slate-400 dark:text-slate-500">
                    {opcao.cores.map(({ cor }) => <span key={cor}>{cor}</span>)}
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        <Cartao className="flex gap-3 bg-slate-100 dark:bg-slate-900">
          <Icone nome="info" tamanho={18} className="mt-0.5 shrink-0 text-slate-500" />
          <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
            A escolha fica salva neste dispositivo e altera os destaques, botões e indicadores do app.
          </p>
        </Cartao>
      </div>
    </>
  )
}