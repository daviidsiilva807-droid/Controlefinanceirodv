import { addMonths, chaveMes, mesDaChave, rotuloMes, subMonths } from '../lib/dates'
import { useUI } from '../store/uiStore'
import { BotaoIcone } from './ui'

/**
 * Navegação de mês compartilhada por dashboard, lançamentos, orçamentos e
 * cartões. O mês vive no store, então trocar aqui muda o app inteiro — o
 * usuário não precisa reselecionar o mês em cada aba.
 */
export function SeletorMes({ className = '' }) {
  const mes = useUI((s) => s.mes)
  const definirMes = useUI((s) => s.definirMes)
  const irParaMesAtual = useUI((s) => s.irParaMesAtual)

  const data = mesDaChave(mes)
  const ehMesAtual = mes === chaveMes(new Date())

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <BotaoIcone
        nome="esquerda"
        rotulo="Mês anterior"
        onClick={() => definirMes(chaveMes(subMonths(data, 1)))}
      />

      <button
        onClick={irParaMesAtual}
        disabled={ehMesAtual}
        className="min-w-[9.5rem] rounded-xl px-2 py-1.5 text-center transition-colors
          enabled:hover:bg-slate-200 disabled:cursor-default dark:enabled:hover:bg-slate-800"
      >
        <span className="block text-sm font-semibold">{rotuloMes(data)}</span>
        {/* Só aparece fora do mês corrente, como atalho de volta. */}
        {!ehMesAtual && (
          <span className="block text-[11px] text-brand-600 dark:text-brand-400">
            voltar para hoje
          </span>
        )}
      </button>

      <BotaoIcone
        nome="direita"
        rotulo="Próximo mês"
        onClick={() => definirMes(chaveMes(addMonths(data, 1)))}
      />
    </div>
  )
}
