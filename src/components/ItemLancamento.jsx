import { Icone } from './Icone'
import { Etiqueta } from './ui'
import { corDoValor, formatComSinal } from '../lib/money'

/**
 * Uma linha da lista de lançamentos. Usada no dashboard, na lista completa e
 * na fatura do cartão, então tudo que varia entra por prop.
 */
export function ItemLancamento({ transacao: t, aoClicar, mostrarConta = true }) {
  const ehTransferencia = t.kind === 'transfer'

  return (
    <button
      onClick={() => aoClicar?.(t)}
      className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left
        transition-colors active:bg-slate-100 dark:active:bg-slate-800"
    >
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg"
        style={{
          // O fundo é a cor da categoria bem diluída: dá identidade sem
          // competir com o valor, que é a informação principal da linha.
          background: ehTransferencia ? undefined : `${t.categories?.color ?? '#64748b'}22`,
        }}
      >
        {ehTransferencia ? (
          <Icone nome="transferencia" tamanho={18} className="text-slate-500" />
        ) : (
          (t.categories?.icon ?? '🏷️')
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium">
            {t.description || t.categories?.name || 'Transferência'}
          </span>
          {t.installment_total > 1 && (
            <Etiqueta cor="roxo">
              {t.installment_no}/{t.installment_total}
            </Etiqueta>
          )}
          {t.recurring_rule_id && (
            <Icone nome="repetir" tamanho={12} className="shrink-0 text-slate-400" />
          )}
          {/* Sem este indicador a observação some: ela não cabe na lista, e a
              pessoa não teria como saber que existe algo escrito ali dentro. */}
          {t.notes?.trim() && (
            <Icone
              nome="nota"
              tamanho={12}
              className="shrink-0 text-slate-400"
              aria-label="Tem observações"
            />
          )}
        </span>
        <span className="mt-0.5 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
          <span className="truncate">
            {t.categories?.name ?? 'Transferência'}
            {mostrarConta && t.accounts?.name ? ` · ${t.accounts.name}` : ''}
          </span>
        </span>
      </span>

      <span className="shrink-0 text-right">
        <span className={`tabular block text-sm font-semibold ${corDoValor(t.amount_cents, t.kind)}`}>
          {formatComSinal(t.amount_cents, t.kind)}
        </span>
        {/* "Previsto" precisa aparecer: um lançamento não pago não entrou no
            saldo, e confundir os dois é o erro que quebra a confiança no app. */}
        {!t.paid && (
          <span className="mt-0.5 block">
            <Etiqueta cor="ambar">previsto</Etiqueta>
          </span>
        )}
      </span>
    </button>
  )
}
