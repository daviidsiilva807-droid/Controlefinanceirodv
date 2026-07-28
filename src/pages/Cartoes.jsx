import { Link } from 'react-router-dom'
import { Cabecalho } from '../components/AppShell'
import { Icone } from '../components/Icone'
import { ItemLancamento } from '../components/ItemLancamento'
import { SeletorMes } from '../components/SeletorMes'
import { Barra, Botao, Cartao, Esqueleto, Etiqueta, TituloSecao, Vazio } from '../components/ui'
import { useFatura, useParcelasFuturas } from '../hooks/useFatura'
import { useMemo } from 'react'
import { diasAte, mesDaChave, rotuloMesCurto } from '../lib/dates'
import { formatBRL } from '../lib/money'
import { useDados } from '../store/dataStore'
import { useUI } from '../store/uiStore'

export function Cartoes() {
  const mes = useUI((s) => s.mes)
  const abrirForm = useUI((s) => s.abrirForm)
  const contas = useDados((s) => s.contas)
  const cartoes = useMemo(
    () => contas.filter((c) => c.type === 'cartao' && !c.archived),
    [contas]
  )
  const { faturas, totalGeral, carregando } = useFatura(mes)
  const { parcelas, total: totalParcelas } = useParcelasFuturas()

  if (!cartoes.length) {
    return (
      <>
        <Cabecalho titulo="Cartões" />
        <Vazio
          icone="cartao"
          titulo="Nenhum cartão cadastrado"
          mensagem="Cadastre seu cartão de crédito para acompanhar a fatura e as compras parceladas."
          acao={
            <Link to="/mais/contas">
              <Botao>Cadastrar cartão</Botao>
            </Link>
          }
        />
      </>
    )
  }

  return (
    <>
      <Cabecalho titulo="Cartões" subtitulo={`Faturas de ${rotuloMesCurto(mesDaChave(mes))}`}>
        <SeletorMes className="justify-center pb-2" />
      </Cabecalho>

      <div className="space-y-5 p-4">
        {faturas.length > 1 && (
          <Cartao className="flex items-baseline justify-between">
            <span className="text-sm text-slate-500 dark:text-slate-400">Total das faturas</span>
            <span className="tabular text-xl font-bold">{formatBRL(totalGeral)}</span>
          </Cartao>
        )}

        {carregando
          ? [0, 1].map((i) => <Esqueleto key={i} className="h-40" />)
          : faturas.map((fatura) => (
              <FaturaDoCartao key={fatura.cartao.id} fatura={fatura} aoClicarItem={abrirForm} />
            ))}

        {/* O "já comprometido" que o saldo de hoje não mostra — é a diferença
            entre achar que sobrou dinheiro e ter dinheiro sobrando. */}
        {parcelas.length > 0 && (
          <section>
            <TituloSecao>Parcelas dos próximos meses</TituloSecao>
            <Cartao>
              <div className="mb-3 flex items-baseline justify-between">
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  {parcelas.length} parcela{parcelas.length > 1 ? 's' : ''} a vencer
                </span>
                <span className="tabular font-semibold text-rose-600 dark:text-rose-400">
                  {formatBRL(totalParcelas)}
                </span>
              </div>
              <ul className="space-y-2">
                {parcelas.slice(0, 8).map((p) => (
                  <li key={p.id} className="flex items-center gap-2 text-sm">
                    <span className="text-xs text-slate-400">{rotuloMesCurto(p.date)}</span>
                    <span className="min-w-0 flex-1 truncate">{p.description || 'Parcela'}</span>
                    <Etiqueta cor="roxo">
                      {p.installment_no}/{p.installment_total}
                    </Etiqueta>
                    <span className="tabular font-medium">{formatBRL(p.amount_cents)}</span>
                  </li>
                ))}
              </ul>
              {parcelas.length > 8 && (
                <p className="mt-2 text-center text-xs text-slate-500 dark:text-slate-400">
                  + {parcelas.length - 8} parcelas
                </p>
              )}
            </Cartao>
          </section>
        )}
      </div>
    </>
  )
}

function FaturaDoCartao({ fatura, aoClicarItem }) {
  const { cartao, lancamentos, total, percentualDoLimite } = fatura
  const diasParaFechar = diasAte(cartao.closing_day)
  const diasParaVencer = diasAte(cartao.due_day)

  const nivelLimite =
    percentualDoLimite == null ? 'ok' : percentualDoLimite >= 90 ? 'estourado' : percentualDoLimite >= 70 ? 'atencao' : 'ok'

  return (
    <section>
      <Cartao style={{ borderColor: `${cartao.color}55` }}>
        <div className="flex items-start gap-3">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl"
            style={{ background: `${cartao.color}22` }}
          >
            {cartao.icon}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{cartao.name}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              fecha em {diasParaFechar}d · vence em {diasParaVencer}d
            </p>
          </div>
          <div className="text-right">
            <p className="tabular text-xl font-bold">{formatBRL(total)}</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">fatura do mês</p>
          </div>
        </div>

        {percentualDoLimite != null && (
          <div className="mt-4">
            <div className="mb-1 flex justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Limite usado</span>
              <span className="tabular">
                {formatBRL(total)} de {formatBRL(cartao.credit_limit_cents)}
              </span>
            </div>
            <Barra percentual={percentualDoLimite} nivel={nivelLimite} />
          </div>
        )}

        {lancamentos.length === 0 ? (
          <p className="mt-4 text-center text-sm text-slate-500 dark:text-slate-400">
            Nenhuma compra nesta fatura.
          </p>
        ) : (
          <div className="mt-3 border-t border-slate-200 pt-1 dark:border-slate-800">
            {lancamentos.map((t) => (
              <ItemLancamento
                key={t.id}
                transacao={{ ...t, kind: 'expense' }}
                aoClicar={aoClicarItem}
                mostrarConta={false}
              />
            ))}
          </div>
        )}
      </Cartao>

      {/* Data de vencimento por extenso ajuda quem paga por boleto/agendamento. */}
      <p className="mt-1.5 flex items-center justify-center gap-1 text-[11px] text-slate-400 dark:text-slate-500">
        <Icone nome="calendario" tamanho={12} />
        vence dia {cartao.due_day} · fechamento dia {cartao.closing_day}
      </p>
    </section>
  )
}
