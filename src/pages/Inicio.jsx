import { useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Cabecalho } from '../components/AppShell'
import { Icone } from '../components/Icone'
import { ItemLancamento } from '../components/ItemLancamento'
import { SeletorMes } from '../components/SeletorMes'
import { LinhaOrcamento, RankingCategorias, RoscaCategorias } from '../components/graficos'
import { Botao, Cartao, Esqueleto, TituloSecao, Vazio } from '../components/ui'
import { useFatura } from '../hooks/useFatura'
import { useOrcamentos } from '../hooks/useOrcamentos'
import { useMaterializarRecorrentes } from '../hooks/useRecorrentes'
import { useSaldos } from '../hooks/useSaldos'
import { useTransacoes } from '../hooks/useTransacoes'
import { chaveMes, diasAte } from '../lib/dates'
import { formatBRL } from '../lib/money'
import { calcularOrcamentos, projetarGasto, resumirMes, totaisPorCategoria } from '../lib/resumo'
import { useUI } from '../store/uiStore'

export function Inicio() {
  const mes = useUI((s) => s.mes)
  const abrirForm = useUI((s) => s.abrirForm)
  const mostrarToast = useUI((s) => s.mostrarToast)

  const { transacoes, carregando } = useTransacoes(mes)
  const { total: saldoEmContas } = useSaldos()
  const { orcamentos } = useOrcamentos(mes)
  const { faturas, totalGeral: totalFaturas } = useFatura(mes)

  const aoCriarRecorrentes = useCallback(
    (quantidade) =>
      mostrarToast(
        `${quantidade} conta${quantidade > 1 ? 's' : ''} recorrente${quantidade > 1 ? 's' : ''} lançada${quantidade > 1 ? 's' : ''} neste mês.`,
        'info'
      ),
    [mostrarToast]
  )
  useMaterializarRecorrentes(mes, aoCriarRecorrentes)

  const resumo = useMemo(() => resumirMes(transacoes), [transacoes])
  const porCategoria = useMemo(() => totaisPorCategoria(transacoes, 'expense'), [transacoes])
  const orcamentosCalculados = useMemo(
    () => calcularOrcamentos(orcamentos, transacoes),
    [orcamentos, transacoes]
  )
  const ehMesAtual = mes === chaveMes(new Date())
  const projecao = ehMesAtual ? projetarGasto(resumo.despesas) : null

  const totalDespesas = porCategoria.reduce((a, c) => a + c.total, 0)
  const emAlerta = orcamentosCalculados.filter((o) => o.nivel !== 'ok')

  return (
    <>
      <Cabecalho titulo="Início">
        <SeletorMes className="justify-center pb-2" />
      </Cabecalho>

      <div className="space-y-5 p-4">
        {/* -------------------------------------------------- resumo do mês */}
        <Cartao className="bg-gradient-to-br from-brand-600 to-brand-800 text-white dark:border-brand-900">
          <p className="text-xs text-brand-100">Sobrou no mês</p>
          <p className="tabular mt-0.5 text-3xl font-bold">{formatBRL(resumo.saldo)}</p>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <ResumoLinha
              icone="setaCima"
              rotulo="Entradas"
              valor={resumo.receitas}
              previsto={resumo.receitasPrevistas}
            />
            <ResumoLinha
              icone="setaBaixo"
              rotulo="Saídas"
              valor={resumo.despesas}
              previsto={resumo.despesasPrevistas}
            />
          </div>
        </Cartao>

        <div className="grid grid-cols-2 gap-3">
          <Painel
            rotulo="Saldo em contas"
            valor={formatBRL(saldoEmContas)}
            icone="carteira"
            para="/mais/contas"
          />
          <Painel
            rotulo={totalFaturas ? 'Faturas do mês' : 'Nenhuma fatura'}
            valor={formatBRL(totalFaturas)}
            icone="cartao"
            para="/cartoes"
          />
        </div>

        {/* Projeção só no mês corrente: em mês fechado o número real já é o
            definitivo, e projetar o futuro sem histórico não diz nada. */}
        {projecao != null && projecao > resumo.despesas && (
          <Cartao className="flex items-center gap-3 py-3">
            <Icone nome="grafico" tamanho={18} className="shrink-0 text-slate-400" />
            <p className="text-sm text-slate-600 dark:text-slate-400">
              No ritmo atual, você fecha o mês gastando{' '}
              <strong className="text-slate-900 dark:text-slate-100">{formatBRL(projecao)}</strong>.
            </p>
          </Cartao>
        )}

        {/* ------------------------------------------ alertas de orçamento */}
        {emAlerta.length > 0 && (
          <section>
            <TituloSecao
              acao={
                <Link to="/orcamentos" className="text-xs font-medium text-brand-600 dark:text-brand-400">
                  ver todos
                </Link>
              }
            >
              Atenção nos orçamentos
            </TituloSecao>
            <Cartao className="space-y-4">
              {emAlerta.slice(0, 3).map((o) => (
                <LinhaOrcamento key={o.id} orcamento={o} />
              ))}
            </Cartao>
          </section>
        )}

        {/* -------------------------------------------------- por categoria */}
        <section>
          <TituloSecao
            acao={
              <Link to="/relatorios" className="text-xs font-medium text-brand-600 dark:text-brand-400">
                relatórios
              </Link>
            }
          >
            Para onde foi o dinheiro
          </TituloSecao>
          <Cartao>
            {carregando ? (
              <div className="space-y-3">
                <Esqueleto className="h-40" />
                <Esqueleto className="h-4" />
                <Esqueleto className="h-4 w-2/3" />
              </div>
            ) : porCategoria.length === 0 ? (
              <Vazio
                icone="grafico"
                titulo="Nenhuma despesa neste mês"
                mensagem="Lance seu primeiro gasto no botão + para ver o resumo aqui."
                acao={<Botao onClick={() => abrirForm({})}>Lançar gasto</Botao>}
              />
            ) : (
              <>
                <RoscaCategorias dados={porCategoria} total={totalDespesas} />
                <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-800">
                  <RankingCategorias dados={porCategoria} total={totalDespesas} limite={6} />
                </div>
              </>
            )}
          </Cartao>
        </section>

        {/* ------------------------------------------------------- faturas */}
        {faturas.some((f) => f.total > 0) && (
          <section>
            <TituloSecao
              acao={
                <Link to="/cartoes" className="text-xs font-medium text-brand-600 dark:text-brand-400">
                  detalhes
                </Link>
              }
            >
              Cartões
            </TituloSecao>
            <Cartao className="divide-y divide-slate-200 py-0 dark:divide-slate-800">
              {faturas
                .filter((f) => f.total > 0)
                .map(({ cartao, total }) => (
                  <div key={cartao.id} className="flex items-center gap-3 py-3">
                    <span className="text-lg">{cartao.icon}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{cartao.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        vence em {diasAte(cartao.due_day)} dias
                      </p>
                    </div>
                    <span className="tabular text-sm font-semibold">{formatBRL(total)}</span>
                  </div>
                ))}
            </Cartao>
          </section>
        )}

        {/* -------------------------------------------- últimos lançamentos */}
        <section>
          <TituloSecao
            acao={
              <Link to="/lancamentos" className="text-xs font-medium text-brand-600 dark:text-brand-400">
                ver tudo
              </Link>
            }
          >
            Últimos lançamentos
          </TituloSecao>
          <Cartao className="px-2 py-1">
            {carregando ? (
              <div className="space-y-2 p-2">
                {[0, 1, 2].map((i) => (
                  <Esqueleto key={i} className="h-12" />
                ))}
              </div>
            ) : transacoes.length === 0 ? (
              <Vazio icone="lista" titulo="Nada lançado ainda neste mês" />
            ) : (
              transacoes
                .slice(0, 5)
                .map((t) => <ItemLancamento key={t.id} transacao={t} aoClicar={abrirForm} />)
            )}
          </Cartao>
        </section>
      </div>
    </>
  )
}

function ResumoLinha({ icone, rotulo, valor, previsto }) {
  return (
    <div className="rounded-xl bg-white/10 p-3">
      <p className="flex items-center gap-1 text-[11px] text-brand-100">
        <Icone nome={icone} tamanho={13} />
        {rotulo}
      </p>
      <p className="tabular mt-0.5 font-semibold">{formatBRL(valor)}</p>
      {previsto > 0 && (
        <p className="tabular text-[11px] text-brand-200">+ {formatBRL(previsto)} previsto</p>
      )}
    </div>
  )
}

function Painel({ rotulo, valor, icone, para }) {
  return (
    <Link
      to={para}
      className="rounded-2xl border border-slate-200 bg-white p-3 transition-colors
        active:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:active:bg-slate-800"
    >
      <p className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
        <Icone nome={icone} tamanho={14} />
        {rotulo}
      </p>
      <p className="tabular mt-1 text-lg font-bold">{valor}</p>
    </Link>
  )
}
