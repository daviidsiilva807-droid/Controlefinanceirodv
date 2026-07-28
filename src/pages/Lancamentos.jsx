import { useMemo, useState } from 'react'
import { Cabecalho } from '../components/AppShell'
import { Icone } from '../components/Icone'
import { ItemLancamento } from '../components/ItemLancamento'
import { SeletorMes } from '../components/SeletorMes'
import { Botao, Cartao, Entrada, Esqueleto, Selecao, Vazio } from '../components/ui'
import { useTransacoes } from '../hooks/useTransacoes'
import { rotuloDia } from '../lib/dates'
import { formatBRL } from '../lib/money'
import { agruparPorDia, filtrarTransacoes } from '../lib/resumo'
import { useDados } from '../store/dataStore'
import { useUI } from '../store/uiStore'

const FILTROS_VAZIOS = {
  busca: '',
  contaId: '',
  categoriaId: '',
  tipo: 'todos',
  situacao: 'todos',
}

export function Lancamentos() {
  const mes = useUI((s) => s.mes)
  const abrirForm = useUI((s) => s.abrirForm)
  const contas = useDados((s) => s.contas)
  const categorias = useDados((s) => s.categorias)

  const { transacoes, carregando } = useTransacoes(mes)
  const [filtros, setFiltros] = useState(FILTROS_VAZIOS)
  const [painelAberto, setPainelAberto] = useState(false)

  const mudar = (campo, valor) => setFiltros((f) => ({ ...f, [campo]: valor }))

  const filtradas = useMemo(() => filtrarTransacoes(transacoes, filtros), [transacoes, filtros])
  const grupos = useMemo(() => agruparPorDia(filtradas), [filtradas])

  const filtrosAtivos =
    Object.entries(filtros).filter(([k, v]) => v !== FILTROS_VAZIOS[k]).length

  const total = filtradas.reduce(
    (acc, t) => (t.kind === 'income' ? acc + t.amount_cents : t.kind === 'expense' ? acc - t.amount_cents : acc),
    0
  )

  return (
    <>
      <Cabecalho
        titulo="Lançamentos"
        acao={
          <button
            onClick={() => setPainelAberto((v) => !v)}
            className={`relative flex h-11 w-11 items-center justify-center rounded-xl transition-colors ${
              painelAberto || filtrosAtivos
                ? 'bg-brand-600 text-white'
                : 'text-slate-600 dark:text-slate-300'
            }`}
            aria-label="Filtros"
            aria-expanded={painelAberto}
          >
            <Icone nome="filtro" tamanho={20} />
            {filtrosAtivos > 0 && !painelAberto && (
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-brand-400" />
            )}
          </button>
        }
      >
        <SeletorMes className="justify-center pb-2" />
      </Cabecalho>

      {painelAberto && (
        <div className="animate-fade-in border-b border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="relative mb-3">
            <Icone
              nome="busca"
              tamanho={18}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <Entrada
              value={filtros.busca}
              onChange={(e) => mudar('busca', e.target.value)}
              placeholder="Buscar por descrição…"
              className="pl-10"
              type="search"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Selecao value={filtros.tipo} onChange={(e) => mudar('tipo', e.target.value)}>
              <option value="todos">Todos os tipos</option>
              <option value="expense">Despesas</option>
              <option value="income">Receitas</option>
              <option value="transfer">Transferências</option>
            </Selecao>

            <Selecao value={filtros.situacao} onChange={(e) => mudar('situacao', e.target.value)}>
              <option value="todos">Pagos e previstos</option>
              <option value="pagos">Só pagos</option>
              <option value="previstos">Só previstos</option>
            </Selecao>

            <Selecao value={filtros.contaId} onChange={(e) => mudar('contaId', e.target.value)}>
              <option value="">Todas as contas</option>
              {contas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.name}
                </option>
              ))}
            </Selecao>

            <Selecao value={filtros.categoriaId} onChange={(e) => mudar('categoriaId', e.target.value)}>
              <option value="">Todas as categorias</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.name}
                </option>
              ))}
            </Selecao>
          </div>

          {filtrosAtivos > 0 && (
            <Botao
              variante="fantasma"
              tamanho="sm"
              className="mt-3 w-full"
              onClick={() => setFiltros(FILTROS_VAZIOS)}
            >
              Limpar filtros
            </Botao>
          )}
        </div>
      )}

      <div className="space-y-4 p-4">
        {/* Barra de total: com filtro ativo é o número que responde à pergunta
            que motivou o filtro ("quanto gastei em mercado este mês?"). */}
        {!carregando && filtradas.length > 0 && (
          <div className="flex items-baseline justify-between px-1 text-sm">
            <span className="text-slate-500 dark:text-slate-400">
              {filtradas.length} lançamento{filtradas.length > 1 ? 's' : ''}
            </span>
            <span
              className={`tabular font-semibold ${
                total < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {formatBRL(total)}
            </span>
          </div>
        )}

        {carregando ? (
          <div className="space-y-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <Esqueleto key={i} className="h-14" />
            ))}
          </div>
        ) : grupos.length === 0 ? (
          <Vazio
            icone={filtrosAtivos ? 'busca' : 'lista'}
            titulo={filtrosAtivos ? 'Nada encontrado' : 'Nenhum lançamento neste mês'}
            mensagem={
              filtrosAtivos
                ? 'Tente afrouxar os filtros ou trocar o mês.'
                : 'Toque no + para registrar seu primeiro gasto ou receita.'
            }
            acao={
              filtrosAtivos ? (
                <Botao variante="secundario" onClick={() => setFiltros(FILTROS_VAZIOS)}>
                  Limpar filtros
                </Botao>
              ) : (
                <Botao onClick={() => abrirForm({})}>Novo lançamento</Botao>
              )
            }
          />
        ) : (
          grupos.map((grupo) => (
            <section key={grupo.data}>
              <div className="mb-1 flex items-baseline justify-between px-2">
                <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {rotuloDia(grupo.data)}
                </h2>
                <span className="tabular text-xs text-slate-400 dark:text-slate-500">
                  {formatBRL(grupo.total)}
                </span>
              </div>
              <Cartao className="px-2 py-1">
                {grupo.itens.map((t) => (
                  <ItemLancamento key={t.id} transacao={t} aoClicar={abrirForm} />
                ))}
              </Cartao>
            </section>
          ))
        )}
      </div>
    </>
  )
}
