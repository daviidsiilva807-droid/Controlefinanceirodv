import { useState } from 'react'
import { CabecalhoVoltar } from '../components/AppShell'
import { Icone } from '../components/Icone'
import {
  Aviso,
  Botao,
  BotaoIcone,
  Campo,
  CampoValor,
  Cartao,
  Confirmacao,
  Entrada,
  Folha,
  Segmentado,
  Selecao,
  Vazio,
} from '../components/ui'
import { useSaldos } from '../hooks/useSaldos'
import { formatBRL } from '../lib/money'
import { mensagemDeErro } from '../lib/supabase'
import { useDados } from '../store/dataStore'
import { useUI } from '../store/uiStore'

const TIPOS = [
  { valor: 'corrente', rotulo: 'Conta corrente', icone: '🏦' },
  { valor: 'poupanca', rotulo: 'Poupança', icone: '🐷' },
  { valor: 'dinheiro', rotulo: 'Dinheiro', icone: '💵' },
  { valor: 'cartao', rotulo: 'Cartão de crédito', icone: '💳' },
  { valor: 'investimento', rotulo: 'Investimento', icone: '📈' },
]

const ICONES = ['🏦', '💵', '💳', '🐷', '📈', '💰', '🏧', '📱', '🪙', '💎']
const CORES = ['#2a78d6', '#1baf7a', '#eb6834', '#4a3aa7', '#e34948', '#eda100', '#e87ba4', '#898781']

export function Contas() {
  const contas = useDados((s) => s.contas)
  const { saldos } = useSaldos()
  const [editando, setEditando] = useState(null)

  const ativas = contas.filter((c) => !c.archived)
  const arquivadas = contas.filter((c) => c.archived)

  return (
    <>
      <CabecalhoVoltar
        titulo="Contas e cartões"
        acao={<BotaoIcone nome="mais" rotulo="Nova conta" onClick={() => setEditando({})} />}
      />

      <div className="space-y-5 p-4">
        {ativas.length === 0 ? (
          <Vazio
            icone="carteira"
            titulo="Nenhuma conta"
            mensagem="Crie ao menos uma conta para começar a lançar."
            acao={<Botao onClick={() => setEditando({})}>Nova conta</Botao>}
          />
        ) : (
          <Cartao className="divide-y divide-slate-200 p-0 dark:divide-slate-800">
            {ativas.map((conta) => (
              <button
                key={conta.id}
                onClick={() => setEditando(conta)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors
                  active:bg-slate-100 dark:active:bg-slate-800"
              >
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg"
                  style={{ background: `${conta.color}22` }}
                >
                  {conta.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{conta.name}</span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">
                    {TIPOS.find((t) => t.valor === conta.type)?.rotulo}
                    {conta.type === 'cartao' && ` · fecha dia ${conta.closing_day}`}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  {conta.type === 'cartao' ? (
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      limite {formatBRL(conta.credit_limit_cents ?? 0)}
                    </span>
                  ) : (
                    <span
                      className={`tabular text-sm font-semibold ${
                        (saldos[conta.id] ?? 0) < 0 ? 'text-rose-600 dark:text-rose-400' : ''
                      }`}
                    >
                      {formatBRL(saldos[conta.id] ?? 0)}
                    </span>
                  )}
                </span>
                <Icone nome="direita" tamanho={16} className="shrink-0 text-slate-400" />
              </button>
            ))}
          </Cartao>
        )}

        {arquivadas.length > 0 && (
          <section>
            <h2 className="mb-2 px-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
              Arquivadas
            </h2>
            <Cartao className="divide-y divide-slate-200 p-0 dark:divide-slate-800">
              {arquivadas.map((conta) => (
                <button
                  key={conta.id}
                  onClick={() => setEditando(conta)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left opacity-60"
                >
                  <span className="text-lg">{conta.icon}</span>
                  <span className="flex-1 truncate text-sm">{conta.name}</span>
                </button>
              ))}
            </Cartao>
          </section>
        )}

        <Aviso tipo="info">
          Contas arquivadas somem dos formulários mas mantêm o histórico. É o caminho certo quando
          você troca de banco — apagar a conta apagaria os lançamentos junto.
        </Aviso>
      </div>

      {editando && <FolhaConta conta={editando} aoFechar={() => setEditando(null)} />}
    </>
  )
}

function FolhaConta({ conta, aoFechar }) {
  const salvarConta = useDados((s) => s.salvarConta)
  const excluirConta = useDados((s) => s.excluirConta)
  const mostrarToast = useUI((s) => s.mostrarToast)
  const editando = Boolean(conta.id)

  const [form, setForm] = useState({
    name: conta.name ?? '',
    type: conta.type ?? 'corrente',
    icon: conta.icon ?? '🏦',
    color: conta.color ?? '#2a78d6',
    initial_balance_cents: conta.initial_balance_cents ?? 0,
    credit_limit_cents: conta.credit_limit_cents ?? 0,
    closing_day: conta.closing_day ?? 25,
    due_day: conta.due_day ?? 5,
    archived: conta.archived ?? false,
  })
  const [erro, setErro] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [confirmarExclusao, setConfirmarExclusao] = useState(false)

  const mudar = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }))
  const ehCartao = form.type === 'cartao'

  const salvar = async () => {
    if (!form.name.trim()) return setErro('Dê um nome à conta.')
    setSalvando(true)
    try {
      await salvarConta({ ...conta, ...form })
      mostrarToast('Conta salva.', 'sucesso')
      aoFechar()
    } catch (e) {
      setErro(mensagemDeErro(e))
    } finally {
      setSalvando(false)
    }
  }

  const excluir = async () => {
    try {
      await excluirConta(conta.id)
      mostrarToast('Conta excluída.', 'sucesso')
      aoFechar()
    } catch (e) {
      // O banco recusa apagar conta com lançamentos (on delete restrict).
      // Arquivar é a saída correta, então oferecemos isso na mensagem.
      mostrarToast(
        mensagemDeErro(e).includes('lançamento')
          ? 'Esta conta tem lançamentos. Arquive-a em vez de excluir.'
          : mensagemDeErro(e),
        'erro'
      )
    }
  }

  return (
    <>
      <Folha
        aberta
        aoFechar={aoFechar}
        titulo={editando ? 'Editar conta' : 'Nova conta'}
        rodape={
          <div className="flex gap-2">
            {editando && (
              <BotaoIcone
                nome="lixeira"
                rotulo="Excluir"
                onClick={() => setConfirmarExclusao(true)}
                className="text-rose-600 dark:text-rose-400"
              />
            )}
            <Botao tamanho="lg" className="flex-1" onClick={salvar} carregando={salvando}>
              Salvar
            </Botao>
          </div>
        }
      >
        <div className="space-y-4">
          <Campo rotulo="Nome">
            <Entrada
              value={form.name}
              onChange={(e) => mudar('name', e.target.value)}
              placeholder="Ex.: Nubank"
              autoFocus={!editando}
            />
          </Campo>

          <Campo rotulo="Tipo">
            <Selecao
              value={form.type}
              onChange={(e) => {
                const tipo = e.target.value
                mudar('type', tipo)
                // Troca o ícone junto, a menos que o usuário já tenha
                // escolhido um manualmente diferente do padrão.
                const padraoAnterior = TIPOS.find((t) => t.valor === form.type)?.icone
                if (form.icon === padraoAnterior) {
                  mudar('icon', TIPOS.find((t) => t.valor === tipo)?.icone ?? '🏦')
                }
              }}
            >
              {TIPOS.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {t.icone} {t.rotulo}
                </option>
              ))}
            </Selecao>
          </Campo>

          {ehCartao ? (
            <>
              <Campo rotulo="Limite do cartão">
                <CampoValor
                  tamanho="sm"
                  valor={form.credit_limit_cents}
                  aoMudar={(v) => mudar('credit_limit_cents', v)}
                />
              </Campo>

              <div className="grid grid-cols-2 gap-3">
                <Campo rotulo="Fecha no dia" dica="1 a 28">
                  <Entrada
                    type="number"
                    min={1}
                    max={28}
                    inputMode="numeric"
                    value={form.closing_day}
                    onChange={(e) => mudar('closing_day', Number(e.target.value))}
                  />
                </Campo>
                <Campo rotulo="Vence no dia" dica="1 a 28">
                  <Entrada
                    type="number"
                    min={1}
                    max={28}
                    inputMode="numeric"
                    value={form.due_day}
                    onChange={(e) => mudar('due_day', Number(e.target.value))}
                  />
                </Campo>
              </div>

              <Aviso tipo="info">
                Compras feitas a partir do dia {form.closing_day} entram na fatura do mês seguinte.
              </Aviso>
            </>
          ) : (
            <Campo
              rotulo="Saldo inicial"
              dica="Quanto tem hoje nesta conta. Serve de ponto de partida para o saldo."
            >
              <CampoValor
                tamanho="sm"
                valor={form.initial_balance_cents}
                aoMudar={(v) => mudar('initial_balance_cents', v)}
              />
            </Campo>
          )}

          <Campo rotulo="Ícone">
            <div className="flex flex-wrap gap-2">
              {ICONES.map((i) => (
                <button
                  key={i}
                  onClick={() => mudar('icon', i)}
                  className={`flex h-11 w-11 items-center justify-center rounded-xl text-xl transition-colors ${
                    form.icon === i
                      ? 'bg-brand-600'
                      : 'bg-slate-200 dark:bg-slate-800'
                  }`}
                >
                  {i}
                </button>
              ))}
            </div>
          </Campo>

          <Campo rotulo="Cor">
            <div className="flex flex-wrap gap-2">
              {CORES.map((c) => (
                <button
                  key={c}
                  onClick={() => mudar('color', c)}
                  aria-label={`Cor ${c}`}
                  className={`h-9 w-9 rounded-full transition-transform ${
                    form.color === c ? 'ring-2 ring-slate-900 ring-offset-2 dark:ring-white dark:ring-offset-slate-950' : ''
                  }`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </Campo>

          {editando && (
            <Segmentado
              opcoes={[
                { valor: false, rotulo: 'Ativa' },
                { valor: true, rotulo: 'Arquivada' },
              ]}
              valor={form.archived}
              aoMudar={(v) => mudar('archived', v)}
            />
          )}

          {erro && <Aviso tipo="erro">{erro}</Aviso>}
        </div>
      </Folha>

      <Confirmacao
        aberta={confirmarExclusao}
        titulo="Excluir conta?"
        mensagem="Só é possível excluir contas sem nenhum lançamento. Se houver histórico, arquive."
        textoConfirmar="Excluir"
        perigo
        aoConfirmar={excluir}
        aoFechar={() => setConfirmarExclusao(false)}
      />
    </>
  )
}
