import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatBRL, formatBRLCurto } from '../lib/money'
import { useUI } from '../store/uiStore'
import { Barra } from './ui'

/**
 * PALETA — decisões tomadas com o validador de acessibilidade, não no olho.
 *
 * 1) Receitas × despesas usa AZUL × VERMELHO, não verde × vermelho. Verde e
 *    vermelho são a dupla clássica de finanças, mas medem ΔE 4,1 em
 *    deuteranopia — para ~8% dos homens as duas séries viram a mesma cor. Azul
 *    × vermelho mede ΔE 23,8 (claro) e 19,2 (escuro) e passa em tudo.
 *    O verde/vermelho semântico continua nos VALORES em texto, onde o sinal
 *    (+/−) já carrega o significado sem depender da cor.
 *
 * 2) A rosca por categoria é secundária, limitada a 6 fatias e com rótulo
 *    direto em cada uma. Acima de 3 cores arbitrárias lado a lado, nenhuma
 *    ordenação de paleta passa nos limites de separação — então a leitura
 *    séria de "onde meu dinheiro foi" acontece no ranking de barras abaixo
 *    dela, onde cada linha tem emoji, nome e valor e a cor é só enfeite.
 */
const RECEITA = { claro: '#2a78d6', escuro: '#3987e5' }
const DESPESA = { claro: '#d03b3b', escuro: '#e66767' }
const NEUTRO = '#898781'

const EIXO = { claro: '#898781', escuro: '#898781' }
const GRADE = { claro: '#e2e8f0', escuro: '#1e293b' }

function useCores() {
  const tema = useUI((s) => s.tema)
  const t = tema === 'escuro' ? 'escuro' : 'claro'
  return {
    receita: RECEITA[t],
    despesa: DESPESA[t],
    eixo: EIXO[t],
    grade: GRADE[t],
    superficie: t === 'escuro' ? '#0f172a' : '#ffffff',
  }
}

// ------------------------------------------------------------------ tooltip

function Balao({ active, payload, label, formatarRotulo }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-slate-700 dark:bg-slate-900">
      <p className="mb-1 font-semibold">{formatarRotulo ? formatarRotulo(label) : label}</p>
      {payload.map((p) => (
        <p key={p.dataKey ?? p.name} className="flex items-center gap-2 tabular">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: p.color ?? p.payload?.cor }}
          />
          <span className="text-slate-500 dark:text-slate-400">{p.name}</span>
          <span className="ml-auto font-medium">{formatBRL(p.value)}</span>
        </p>
      ))}
    </div>
  )
}

// -------------------------------------------------- ranking de categorias

/**
 * A visão principal de "para onde foi o dinheiro". Barras deitadas ordenadas
 * do maior para o menor: comparar comprimentos é muito mais fácil do que
 * comparar ângulos de fatia, e cada linha traz emoji, nome e valor — a cor
 * nunca é a única forma de identificar a categoria.
 */
export function RankingCategorias({ dados, total, limite = 8, aoClicar }) {
  if (!dados.length) return null
  const visiveis = dados.slice(0, limite)
  const maior = visiveis[0]?.total ?? 1

  return (
    <ul className="space-y-3">
      {visiveis.map((c) => (
        <li key={c.id}>
          <button
            onClick={() => aoClicar?.(c)}
            className="w-full text-left"
            disabled={!aoClicar}
          >
            <div className="mb-1 flex items-baseline gap-2">
              <span aria-hidden="true">{c.icone}</span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.nome}</span>
              <span className="tabular text-sm font-semibold">{formatBRL(c.total)}</span>
              <span className="tabular w-10 text-right text-xs text-slate-500 dark:text-slate-400">
                {c.percentual.toFixed(0)}%
              </span>
            </div>
            {/* Comprimento relativo ao MAIOR gasto, não ao total: com 15
                categorias, barras proporcionais ao total ficariam todas
                minúsculas e ilegíveis. */}
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{ width: `${(c.total / maior) * 100}%`, background: c.cor }}
              />
            </div>
          </button>
        </li>
      ))}
      {dados.length > limite && (
        <li className="pt-1 text-center text-xs text-slate-500 dark:text-slate-400">
          + {dados.length - limite} categorias menores ·{' '}
          {formatBRL(dados.slice(limite).reduce((acc, c) => acc + c.total, 0))}
        </li>
      )}
    </ul>
  )
}

/**
 * Rosca de composição — a "pizza" pedida, no papel certo: um resumo visual de
 * quanto cada categoria pesa no total, não uma ferramenta de comparação.
 * Máximo de 6 fatias (5 categorias + "Outros"), com folga de 2px entre elas.
 */
export function RoscaCategorias({ dados, total }) {
  const cores = useCores()
  if (!dados.length) return null

  const principais = dados.slice(0, 5)
  const resto = dados.slice(5)
  const fatias = [
    ...principais.map((c) => ({ nome: c.nome, valor: c.total, cor: c.cor })),
    ...(resto.length
      ? [{ nome: 'Outros', valor: resto.reduce((a, c) => a + c.total, 0), cor: NEUTRO }]
      : []),
  ]

  return (
    <div className="relative h-52">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={fatias}
            dataKey="valor"
            nameKey="nome"
            innerRadius="62%"
            outerRadius="94%"
            paddingAngle={2}
            stroke={cores.superficie}
            strokeWidth={2}
            isAnimationActive={false}
          >
            {fatias.map((f) => (
              <Cell key={f.nome} fill={f.cor} />
            ))}
          </Pie>
          <Tooltip content={<Balao />} />
        </PieChart>
      </ResponsiveContainer>

      {/* O total vai no miolo da rosca: é o número que a pessoa procura
          primeiro, e o buraco do donut é espaço morto de qualquer forma. */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[11px] text-slate-500 dark:text-slate-400">Total no mês</span>
        <span className="tabular text-xl font-bold">{formatBRL(total)}</span>
      </div>
    </div>
  )
}

// ------------------------------------------------------- evolução mensal

/**
 * Receitas × despesas nos últimos meses. Duas séries, uma escala só —
 * nunca dois eixos Y, que é a forma mais fácil de fazer um gráfico mentir.
 */
export function BarrasMensais({ dados, altura = 200 }) {
  const cores = useCores()

  return (
    <div>
      <div className="mb-2 flex items-center justify-center gap-4 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: cores.receita }} />
          <span className="text-slate-600 dark:text-slate-400">Receitas</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: cores.despesa }} />
          <span className="text-slate-600 dark:text-slate-400">Despesas</span>
        </span>
      </div>

      <div style={{ height: altura }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={dados} margin={{ top: 4, right: 4, bottom: 0, left: -12 }} barGap={2}>
            <XAxis
              dataKey="rotulo"
              tick={{ fontSize: 11, fill: cores.eixo }}
              axisLine={{ stroke: cores.grade }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: cores.eixo }}
              axisLine={false}
              tickLine={false}
              tickFormatter={formatBRLCurto}
              width={58}
            />
            <Tooltip content={<Balao />} cursor={{ fill: cores.grade, opacity: 0.35 }} />
            {/* Sem animação de propósito: as barras nascem com altura zero e
                crescem, e quem abre o relatório e sai rolando vê o gráfico
                vazio. Num app de números, o dado na tela vale mais que o
                floreio de entrada. */}
            <Bar
              dataKey="receitas"
              name="Receitas"
              fill={cores.receita}
              radius={[4, 4, 0, 0]}
              isAnimationActive={false}
            />
            <Bar
              dataKey="despesas"
              name="Despesas"
              fill={cores.despesa}
              radius={[4, 4, 0, 0]}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

/** Linha de orçamento: categoria, barra e quanto falta. */
export function LinhaOrcamento({ orcamento, aoClicar }) {
  const { categories: categoria, gasto, limit_cents: limite, percentual, nivel, restante } = orcamento

  const mensagem =
    nivel === 'estourado'
      ? `Estourou ${formatBRL(-restante)}`
      : `Faltam ${formatBRL(restante)}`

  return (
    <button onClick={() => aoClicar?.(orcamento)} className="w-full text-left" disabled={!aoClicar}>
      <div className="mb-1 flex items-baseline gap-2">
        <span aria-hidden="true">{categoria?.icon}</span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{categoria?.name}</span>
        <span className="tabular text-xs text-slate-500 dark:text-slate-400">
          {formatBRL(gasto)} de {formatBRL(limite)}
        </span>
      </div>
      <Barra percentual={percentual} nivel={nivel} />
      <p
        className={`mt-1 text-xs ${
          nivel === 'estourado'
            ? 'text-rose-600 dark:text-rose-400'
            : nivel === 'atencao'
              ? 'text-amber-600 dark:text-amber-400'
              : 'text-slate-500 dark:text-slate-400'
        }`}
      >
        {/* O ícone acompanha a cor: quem não distingue vermelho de âmbar
            precisa de outro sinal além do tom da barra. */}
        {nivel !== 'ok' && <span aria-hidden="true">{nivel === 'estourado' ? '⚠️ ' : '⚡ '}</span>}
        {mensagem} · {percentual.toFixed(0)}%
      </p>
    </button>
  )
}
