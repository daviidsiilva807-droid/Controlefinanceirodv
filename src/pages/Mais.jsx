import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Cabecalho } from '../components/AppShell'
import { Icone } from '../components/Icone'
import { Botao, Cartao, Confirmacao, Etiqueta } from '../components/ui'
import { useNaoLidas } from '../hooks/useMensagens'
import { biometriaAtiva, pinConfigurado } from '../lib/pin'
import { useAuth } from '../store/authStore'
import { useUI } from '../store/uiStore'

const SECOES = [
  {
    titulo: 'Seu dinheiro',
    itens: [
      { para: '/orcamentos', icone: 'alvo', rotulo: 'Orçamentos', descricao: 'Limites por categoria' },
      { para: '/relatorios', icone: 'grafico', rotulo: 'Relatórios', descricao: 'Evolução e exportação' },
      { para: '/mais/contas', icone: 'carteira', rotulo: 'Contas e cartões', descricao: 'Saldos e limites' },
      { para: '/mais/categorias', icone: 'filtro', rotulo: 'Categorias', descricao: 'Cores e ícones' },
      {
        para: '/mais/recorrentes',
        icone: 'repetir',
        rotulo: 'Contas recorrentes',
        descricao: 'Aluguel, assinaturas…',
      },
    ],
  },
  {
    titulo: 'Sua conta',
    itens: [
      { para: '/mais/perfil', icone: 'pessoas', rotulo: 'Perfil', descricao: 'Nome e avatar' },
      { para: '/mais/seguranca', icone: 'cadeado', rotulo: 'Bloqueio do app', descricao: 'PIN e biometria' },
    ],
  },
]

export function Mais() {
  const perfil = useAuth((s) => s.perfil)
  const sessao = useAuth((s) => s.sessao)
  const sair = useAuth((s) => s.sair)
  const tema = useUI((s) => s.tema)
  const alternarTema = useUI((s) => s.alternarTema)
  const naoLidas = useNaoLidas()
  const [confirmarSaida, setConfirmarSaida] = useState(false)

  const protegido = pinConfigurado()
  const ehAdmin = perfil?.role === 'admin'

  return (
    <>
      <Cabecalho titulo="Mais" />

      <div className="space-y-5 p-4">
        <Link
          to="/mais/perfil"
          className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4
            transition-colors active:bg-slate-100 dark:border-slate-800 dark:bg-slate-900
            dark:active:bg-slate-800"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-100 text-2xl dark:bg-brand-900/40">
            {perfil?.emoji ?? '🙂'}
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 truncate font-semibold">
              {perfil?.display_name ?? 'Você'}
              {ehAdmin && <Etiqueta cor="roxo">admin</Etiqueta>}
            </p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
              {sessao?.user?.email}
            </p>
          </div>
          {/* Sinaliza quando o app está desprotegido: sem isso a pessoa acha
              que configurou o PIN e nunca configurou. */}
          {!protegido && (
            <span className="rounded-lg bg-amber-100 px-2 py-1 text-[11px] font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-400">
              sem PIN
            </span>
          )}
          {protegido && biometriaAtiva() && (
            <Icone nome="digital" tamanho={20} className="text-brand-600 dark:text-brand-400" />
          )}
        </Link>

        <Cartao className="p-0">
          <Link
            to="/mensagens"
            className="flex items-center gap-3 rounded-2xl px-4 py-3 transition-colors
              active:bg-slate-100 dark:active:bg-slate-800"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <Icone nome="sino" tamanho={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">Mensagens</span>
              <span className="block text-xs text-slate-500 dark:text-slate-400">
                {naoLidas ? `${naoLidas} não lida${naoLidas > 1 ? 's' : ''}` : 'Nenhuma pendente'}
              </span>
            </span>
            {naoLidas > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[11px] font-bold text-white">
                {naoLidas}
              </span>
            )}
            <Icone nome="direita" tamanho={18} className="shrink-0 text-slate-400" />
          </Link>
        </Cartao>

        {/* O menu de administração só aparece para admin — mas quem barra de
            verdade é o RLS: mesmo forçando a URL, o banco não devolve nada. */}
        {ehAdmin && (
          <Cartao className="border-violet-200 p-0 dark:border-violet-900">
            <Link
              to="/mais/administracao"
              className="flex items-center gap-3 rounded-2xl px-4 py-3 transition-colors
                active:bg-slate-100 dark:active:bg-slate-800"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                <Icone nome="escudo" tamanho={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">Administração</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">
                  Usuários e envio de mensagens
                </span>
              </span>
              <Icone nome="direita" tamanho={18} className="shrink-0 text-slate-400" />
            </Link>
          </Cartao>
        )}

        {SECOES.map((secao) => (
          <section key={secao.titulo}>
            <h2 className="mb-2 px-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
              {secao.titulo}
            </h2>
            <Cartao className="divide-y divide-slate-200 p-0 dark:divide-slate-800">
              {secao.itens.map((item) => (
                <Link
                  key={item.para}
                  to={item.para}
                  className="flex items-center gap-3 px-4 py-3 transition-colors first:rounded-t-2xl
                    last:rounded-b-2xl active:bg-slate-100 dark:active:bg-slate-800"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    <Icone nome={item.icone} tamanho={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{item.rotulo}</span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">
                      {item.descricao}
                    </span>
                  </span>
                  <Icone nome="direita" tamanho={18} className="shrink-0 text-slate-400" />
                </Link>
              ))}
            </Cartao>
          </section>
        ))}

        <Cartao className="p-0">
          <button
            onClick={alternarTema}
            className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 transition-colors
              active:bg-slate-100 dark:active:bg-slate-800"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <Icone nome={tema === 'escuro' ? 'lua' : 'sol'} tamanho={18} />
            </span>
            <span className="flex-1 text-left text-sm font-medium">
              Tema {tema === 'escuro' ? 'escuro' : 'claro'}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">tocar para trocar</span>
          </button>
        </Cartao>

        <Botao
          variante="fantasma"
          className="w-full text-rose-600 dark:text-rose-400"
          icone="sair"
          onClick={() => setConfirmarSaida(true)}
        >
          Sair da conta
        </Botao>

        <p className="pb-2 text-center text-[11px] text-slate-400 dark:text-slate-600">
          Controle Financeiro · seus lançamentos são visíveis só para você
        </p>
      </div>

      <Confirmacao
        aberta={confirmarSaida}
        titulo="Sair da conta?"
        mensagem="Você vai precisar do e-mail e da senha para entrar de novo."
        textoConfirmar="Sair"
        perigo
        aoConfirmar={sair}
        aoFechar={() => setConfirmarSaida(false)}
      />
    </>
  )
}
