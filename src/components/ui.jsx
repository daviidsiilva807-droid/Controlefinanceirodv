import { useEffect, useRef } from 'react'
import { Icone } from './Icone'
import { formatValor, parseCentavos } from '../lib/money'

// --------------------------------------------------------------- botões

const VARIANTES = {
  primario:
    'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 disabled:bg-brand-600/50',
  secundario:
    'bg-slate-200 text-slate-900 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700',
  perigo: 'bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800',
  fantasma:
    'text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800',
  contorno:
    'border border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800',
}

const TAMANHOS = {
  sm: 'h-9 px-3 text-sm gap-1.5',
  md: 'h-11 px-4 text-sm gap-2',
  lg: 'h-14 px-6 text-base gap-2',
}

export function Botao({
  variante = 'primario',
  tamanho = 'md',
  className = '',
  icone,
  children,
  carregando = false,
  ...props
}) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-xl font-medium transition-colors
        disabled:cursor-not-allowed disabled:opacity-60
        focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2
        focus-visible:ring-offset-slate-50 dark:focus-visible:ring-offset-slate-950 focus-visible:outline-none
        ${VARIANTES[variante]} ${TAMANHOS[tamanho]} ${className}`}
      disabled={props.disabled || carregando}
      {...props}
    >
      {carregando ? <Girando /> : icone ? <Icone nome={icone} tamanho={18} /> : null}
      {children}
    </button>
  )
}

export function BotaoIcone({ nome, rotulo, className = '', ...props }) {
  return (
    <button
      aria-label={rotulo}
      title={rotulo}
      // 44px é o alvo de toque mínimo confortável no celular.
      className={`inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-600
        transition-colors hover:bg-slate-200 active:bg-slate-300
        dark:text-slate-300 dark:hover:bg-slate-800 dark:active:bg-slate-700 ${className}`}
      {...props}
    >
      <Icone nome={nome} tamanho={20} />
    </button>
  )
}

// ---------------------------------------------------------------- campos

export function Campo({ rotulo, dica, erro, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      {rotulo && (
        <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
          {rotulo}
        </span>
      )}
      {children}
      {dica && !erro && (
        <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">{dica}</span>
      )}
      {erro && <span className="mt-1 block text-xs text-rose-600 dark:text-rose-400">{erro}</span>}
    </label>
  )
}

const ESTILO_ENTRADA = `w-full rounded-xl border border-slate-300 bg-white px-3.5 text-slate-900
  placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30
  focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100
  dark:placeholder:text-slate-500`

export function Entrada({ className = '', ...props }) {
  return <input className={`${ESTILO_ENTRADA} h-11 ${className}`} {...props} />
}

export function Selecao({ className = '', children, ...props }) {
  return (
    <select className={`${ESTILO_ENTRADA} h-11 appearance-none ${className}`} {...props}>
      {children}
    </select>
  )
}

/**
 * Campo de dinheiro no modelo "caixa de supermercado": a pessoa digita só
 * dígitos e eles preenchem da direita para a esquerda (1 → 0,01; 12 → 0,12;
 * 1234 → 12,34). É o padrão dos apps de banco brasileiros e evita a dúvida
 * de onde colocar a vírgula com o teclado numérico do celular.
 *
 * O valor sai daqui SEMPRE em centavos inteiros.
 */
export function CampoValor({ valor, aoMudar, autoFocus, className = '', tamanho = 'lg' }) {
  const ref = useRef(null)

  return (
    <div className={`relative ${className}`}>
      <span
        className={`pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-medium
          text-slate-400 dark:text-slate-500 ${tamanho === 'lg' ? 'text-2xl' : 'text-base'}`}
      >
        R$
      </span>
      <input
        ref={ref}
        // `decimal` abre o teclado numérico com vírgula no iOS e Android.
        inputMode="decimal"
        type="text"
        autoFocus={autoFocus}
        value={formatValor(valor)}
        onChange={(e) => aoMudar(parseCentavos(e.target.value))}
        onFocus={(e) => e.target.setSelectionRange(e.target.value.length, e.target.value.length)}
        className={`${ESTILO_ENTRADA} tabular font-semibold ${
          tamanho === 'lg' ? 'h-16 pl-14 text-3xl' : 'h-11 pl-11 text-base'
        }`}
      />
    </div>
  )
}

/** Abas de escolha única — usado para despesa/receita/transferência. */
export function Segmentado({ opcoes, valor, aoMudar, className = '' }) {
  return (
    <div
      role="tablist"
      className={`flex gap-1 rounded-xl bg-slate-200 p-1 dark:bg-slate-800 ${className}`}
    >
      {opcoes.map((o) => {
        const ativo = o.valor === valor
        return (
          <button
            key={o.valor}
            role="tab"
            aria-selected={ativo}
            onClick={() => aoMudar(o.valor)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              ativo
                ? o.corAtiva ?? 'bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-white'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            {o.rotulo}
          </button>
        )
      })}
    </div>
  )
}

// ------------------------------------------------------------ contêineres

export function Cartao({ className = '', children, ...props }) {
  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800
        dark:bg-slate-900 ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}

export function TituloSecao({ children, acao }) {
  return (
    <div className="mb-2 flex items-center justify-between px-1">
      <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400">{children}</h2>
      {acao}
    </div>
  )
}

/**
 * Folha que sobe pela base da tela. É o padrão de modal em celular: fica ao
 * alcance do polegar e não desloca o conteúdo atrás.
 */
export function Folha({ aberta, aoFechar, titulo, children, rodape }) {
  useEffect(() => {
    if (!aberta) return
    const aoTeclar = (e) => e.key === 'Escape' && aoFechar()
    document.addEventListener('keydown', aoTeclar)
    // Trava o scroll do fundo enquanto a folha está aberta.
    const overflowAnterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', aoTeclar)
      document.body.style.overflow = overflowAnterior
    }
  }, [aberta, aoFechar])

  if (!aberta) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div
        className="animate-fade-in absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
        onClick={aoFechar}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className="animate-sheet-up relative flex max-h-[92vh] w-full max-w-lg flex-col
          rounded-t-3xl bg-slate-50 shadow-2xl dark:bg-slate-950 sm:mb-4 sm:rounded-3xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <h2 className="text-base font-semibold">{titulo}</h2>
          <BotaoIcone nome="fechar" rotulo="Fechar" onClick={aoFechar} />
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
        {rodape && (
          <div className="border-t border-slate-200 px-4 py-3 pb-safe dark:border-slate-800">
            {rodape}
          </div>
        )}
      </div>
    </div>
  )
}

export function Confirmacao({ aberta, titulo, mensagem, textoConfirmar = 'Confirmar', perigo, aoConfirmar, aoFechar }) {
  if (!aberta) return null
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="animate-fade-in absolute inset-0 bg-slate-950/60" onClick={aoFechar} aria-hidden="true" />
      <div
        role="alertdialog"
        aria-modal="true"
        className="animate-fade-in relative w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900"
      >
        <h2 className="text-base font-semibold">{titulo}</h2>
        {mensagem && <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{mensagem}</p>}
        <div className="mt-5 flex gap-2">
          <Botao variante="secundario" className="flex-1" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao
            variante={perigo ? 'perigo' : 'primario'}
            className="flex-1"
            onClick={() => {
              aoConfirmar()
              aoFechar()
            }}
          >
            {textoConfirmar}
          </Botao>
        </div>
      </div>
    </div>
  )
}

// ------------------------------------------------------------- indicadores

export function Girando({ className = '' }) {
  return (
    <span
      className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-current
        border-t-transparent ${className}`}
      role="status"
      aria-label="Carregando"
    />
  )
}

export function Esqueleto({ className = '' }) {
  return <div className={`animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800 ${className}`} />
}

export function Vazio({ icone = 'lista', titulo, mensagem, acao }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-200 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
        <Icone nome={icone} tamanho={26} />
      </div>
      <p className="font-medium text-slate-700 dark:text-slate-200">{titulo}</p>
      {mensagem && <p className="mt-1 max-w-xs text-sm text-slate-500 dark:text-slate-400">{mensagem}</p>}
      {acao && <div className="mt-4">{acao}</div>}
    </div>
  )
}

const CORES_BARRA = {
  ok: 'bg-brand-500',
  atencao: 'bg-amber-500',
  estourado: 'bg-rose-500',
}

export function Barra({ percentual, nivel = 'ok', className = '' }) {
  return (
    <div
      className={`h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800 ${className}`}
      role="progressbar"
      aria-valuenow={Math.round(percentual)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-500 ${CORES_BARRA[nivel]}`}
        // Trava em 100% para a barra não vazar do contêiner quando estoura.
        style={{ width: `${Math.min(100, Math.max(0, percentual))}%` }}
      />
    </div>
  )
}

export function Etiqueta({ cor = 'slate', children, className = '' }) {
  const cores = {
    slate: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    verde: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
    vermelho: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400',
    ambar: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
    roxo: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-400',
  }
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px]
        font-medium ${cores[cor]} ${className}`}
    >
      {children}
    </span>
  )
}

export function Aviso({ tipo = 'info', children, className = '' }) {
  const estilos = {
    info: 'bg-sky-50 text-sky-900 border-sky-200 dark:bg-sky-950/50 dark:text-sky-200 dark:border-sky-900',
    alerta:
      'bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950/50 dark:text-amber-200 dark:border-amber-900',
    erro: 'bg-rose-50 text-rose-900 border-rose-200 dark:bg-rose-950/50 dark:text-rose-200 dark:border-rose-900',
  }
  return (
    <div className={`flex gap-2 rounded-xl border p-3 text-sm ${estilos[tipo]} ${className}`}>
      <Icone nome={tipo === 'info' ? 'info' : 'alerta'} tamanho={18} className="mt-0.5 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  )
}
