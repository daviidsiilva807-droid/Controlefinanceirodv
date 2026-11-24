import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Cabecalho } from '../components/AppShell'
import { BannersInicio } from '../components/BannersInicio'
import { Icone } from '../components/Icone'
import { ItemLancamento } from '../components/ItemLancamento'
import { SeletorMes } from '../components/SeletorMes'
import { LinhaOrcamento, RankingCategorias, RoscaCategorias } from '../components/graficos'
import { Botao, Cartao, Esqueleto, TituloSecao, Vazio } from '../components/ui'
import { useAssinaturas } from '../hooks/useAssinaturas'
import { useFatura } from '../hooks/useFatura'
import { useEmprestimos } from '../hooks/useEmprestimos'
import { useOrcamentos } from '../hooks/useOrcamentos'
import { useMaterializarRecorrentes } from '../hooks/useRecorrentes'
import { useSaldos } from '../hooks/useSaldos'
import { useTransacoes } from '../hooks/useTransacoes'
import { useCotacaoDolar } from '../hooks/useCotacaoDolar'
import { chaveMes, diasAte } from '../lib/dates'
import { formatBRL } from '../lib/money'
import { lerDesafios, percentualDesafio, totalConcluido } from '../lib/desafios'
import { calcularOrcamentos, projetarGasto, resumirMes, totaisPorCategoria } from '../lib/resumo'
import { useUI } from '../store/uiStore'
import { useDados } from '../store/dataStore'

export function Inicio() {
  const mes = useUI((s) => s.mes)
  const abrirForm = useUI((s) => s.abrirForm)
  const mostrarToast = useUI((s) => s.mostrarToast)
  const contas = useDados((s) => s.contas)

  const { transacoes, carregando } = useTransacoes(mes)
  const { total: saldoEmContas, saldos } = useSaldos()
  const { orcamentos } = useOrcamentos(mes)
  const { faturas, totalGeral: totalFaturas } = useFatura(mes)
  const { totalMensal: totalAssinaturas } = useAssinaturas()
  const { emprestimos } = useEmprestimos()
  const cotacaoDolar = useCotacaoDolar()

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
  const contasInvestimento = contas.filter((conta) => conta.type === 'investimento' && !conta.archived)
  const totalInvestido = contasInvestimento.reduce((total, conta) => total + (saldos[conta.id] ?? 0), 0)

  return (
    <>
      <Cabecalho titulo="Início">
        <SeletorMes className="justify-center pb-2" />
      </Cabecalho>

      <div className="space-y-5 p-4">
        <BannersInicio
          {...cotacaoDolar}
          saldo={saldoEmContas}
          faturas={totalFaturas}
          despesas={resumo.despesas}
        />

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
          {totalAssinaturas > 0 && (
            <Painel
              className="col-span-2"
              rotulo="Assinaturas ativas"
              valor={`${formatBRL(totalAssinaturas)} por mês`}
              icone="calendario"
              para="/mais/assinaturas"
            />
          )}
        </div>

        <Investimentos
          contas={contasInvestimento}
          total={totalInvestido}
          saldos={saldos}
        />

        <ResumoEmprestimos emprestimos={emprestimos} />

        <ResumoDesafios />

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

function Investimentos({ contas, total, saldos }) {
  return (
    <section>
      <TituloSecao
        acao={
          <Link to="/mais/contas" className="text-xs font-medium text-brand-600 dark:text-brand-400">
            gerenciar
          </Link>
        }
      >
        Investimentos
      </TituloSecao>
      <Cartao className="overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-brand-900 text-white">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-slate-300">Patrimônio investido</p>
            <p className="tabular mt-1 text-2xl font-bold">{formatBRL(total)}</p>
          </div>
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-brand-200">
            <Icone nome="grafico" tamanho={21} />
          </span>
        </div>
        {contas.length > 0 ? (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {contas.slice(0, 2).map((conta) => (
              <div key={conta.id} className="rounded-xl bg-white/10 px-3 py-2">
                <p className="truncate text-xs text-slate-300">{conta.name}</p>
                <p className="tabular mt-0.5 text-sm font-semibold">{formatBRL(saldos[conta.id] ?? 0)}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-300">Crie uma conta de investimento para acompanhar seu patrimônio.</p>
        )}
        <Link
          to="/mais/contas"
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-200 transition-colors hover:text-white"
        >
          {contas.length > 0 ? 'Ver investimentos' : 'Adicionar investimento'}
          <Icone nome="direita" tamanho={15} />
        </Link>
      </Cartao>
    </section>
  )
}

function ResumoEmprestimos({ emprestimos }) {
  const ativos = emprestimos.filter((emprestimo) => emprestimo.active)
  const totalContratado = ativos.reduce((total, emprestimo) => total + emprestimo.amount_cents, 0)
  const totalMensal = ativos.reduce(
    (total, emprestimo) => total + emprestimo.installment_amount_cents,
    0
  )

  return (
    <section>
      <TituloSecao
        acao={
          <Link to="/mais/emprestimos" className="text-xs font-medium text-brand-600 dark:text-brand-400">
            gerenciar
          </Link>
        }
      >
        Empréstimos
      </TituloSecao>
      <Cartao className="overflow-hidden border-amber-200 bg-gradient-to-br from-amber-50 via-white to-brand-50 dark:border-amber-900 dark:from-amber-950/30 dark:via-slate-900 dark:to-brand-950/30">
        {ativos.length === 0 ? (
          <Link to="/mais/emprestimos" className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
              <Icone nome="carteira" tamanho={22} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">Nenhum empréstimo ativo</span>
              <span className="mt-1 block text-xs text-slate-600 dark:text-slate-400">
                Cadastre um empréstimo para acompanhar suas parcelas.
              </span>
            </span>
            <Icone nome="direita" tamanho={18} className="shrink-0 text-slate-400" />
          </Link>
        ) : (
          <>
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                <Icone nome="carteira" tamanho={22} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-slate-500 dark:text-slate-400">Compromisso mensal</p>
                <p className="tabular mt-0.5 text-2xl font-bold">{formatBRL(totalMensal)}</p>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                  {ativos.length} empréstimo{ativos.length > 1 ? 's' : ''} ativo{ativos.length > 1 ? 's' : ''} · {formatBRL(totalContratado)} contratado
                </p>
              </div>
            </div>
            <div className="mt-4 space-y-2 border-t border-amber-200/70 pt-3 dark:border-amber-900/60">
              {ativos.slice(0, 3).map((emprestimo) => (
                <div key={emprestimo.id} className="flex items-center gap-2 text-sm">
                  <span className="min-w-0 flex-1 truncate">{emprestimo.name}</span>
                  <span className="tabular shrink-0 text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {emprestimo.installments}x {formatBRL(emprestimo.installment_amount_cents)}
                  </span>
                </div>
              ))}
              {ativos.length > 3 && (
                <p className="text-xs text-slate-500 dark:text-slate-400">+ {ativos.length - 3} empréstimos</p>
              )}
            </div>
          </>
        )}
      </Cartao>
    </section>
  )
}

function ResumoDesafios() {
  const [desafios] = useState(lerDesafios)
  return (
    <section>
      <TituloSecao
        acao={
          <Link to="/desafios" className="text-xs font-medium text-brand-600 dark:text-brand-400">
            abrir aba
          </Link>
        }
      >
        Andamento dos desafios
      </TituloSecao>
      <Cartao className="space-y-4">
        {desafios.slice(0, 2).map((desafio) => (
          <div key={desafio.id}>
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <p className="truncate text-sm font-semibold">{desafio.nome}</p>
              <span className="tabular shrink-0 text-xs font-bold text-brand-700 dark:text-brand-300">
                {percentualDesafio(desafio)}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-brand-600 transition-all duration-300"
                style={{ width: `${percentualDesafio(desafio)}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {formatBRL(totalConcluido(desafio))} de {formatBRL(desafio.alvoCents)} · {desafio.concluidos.length}/{desafio.dias} dias
            </p>
          </div>
        ))}
        <Link
          to="/desafios"
          className="flex items-center justify-center gap-1.5 border-t border-slate-200 pt-3 text-sm font-semibold text-brand-600 dark:border-slate-800 dark:text-brand-400"
        >
          Ver detalhes e configurar
          <Icone nome="direita" tamanho={15} />
        </Link>
      </Cartao>
    </section>
  )
}

function Painel({ rotulo, valor, icone, para, className = '' }) {
  return (
    <Link
      to={para}
      className={`rounded-2xl border border-slate-200 bg-white p-3 transition-colors
        active:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:active:bg-slate-800 ${className}`}
    >
      <p className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
        <Icone nome={icone} tamanho={14} />
        {rotulo}
      </p>
      <p className="tabular mt-1 text-lg font-bold">{valor}</p>
    </Link>
  )
}
