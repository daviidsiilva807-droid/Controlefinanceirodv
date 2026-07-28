import { useUI } from '../store/uiStore'
import { Icone } from './Icone'

const ESTILOS = {
  info: 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900',
  sucesso: 'bg-emerald-600 text-white',
  erro: 'bg-rose-600 text-white',
}

const ICONES = { info: 'info', sucesso: 'check', erro: 'alerta' }

export function Toast() {
  const toast = useUI((s) => s.toast)
  const fechar = useUI((s) => s.fecharToast)
  if (!toast) return null

  return (
    // Aparece ACIMA da barra inferior (bottom-28), senão fica escondido atrás
    // dela justamente no momento em que precisa ser lido.
    <div
      role="status"
      aria-live="polite"
      className="animate-fade-in fixed inset-x-4 bottom-28 z-50 mx-auto max-w-sm mb-safe"
    >
      <button
        onClick={fechar}
        className={`flex w-full items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium
          shadow-lg ${ESTILOS[toast.tipo] ?? ESTILOS.info}`}
      >
        <Icone nome={ICONES[toast.tipo] ?? 'info'} tamanho={18} className="shrink-0" />
        <span className="flex-1 text-left">{toast.mensagem}</span>
      </button>
    </div>
  )
}
