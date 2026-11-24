import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icone } from './Icone'
import { formatarDataCotacao } from '../lib/dolar'
import { formatBRL } from '../lib/money'

const FORMATADOR_DOLAR = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

export function BannersInicio({
  cotacao,
  carregando,
  erro,
  atualizar,
  saldo,
  faturas,
  despesas,
}) {
  const [indice, setIndice] = useState(0)
  const [pausado, setPausado] = useState(false)

  const banners = [
    {
      rotulo: 'Dólar comercial',
      icone: 'grafico',
      valor: cotacao ? FORMATADOR_DOLAR.format(cotacao.valor) : null,
      detalhe: cotacao
        ? `Cotação de venda PTAX · ${formatarDataCotacao(cotacao.data)}`
        : erro
          ? 'Não foi possível consultar o Banco Central.'
          : 'Consultando a cotação no Banco Central...',
      cor: 'from-emerald-600 to-teal-700',
    },
    {
      rotulo: 'Saldo em contas',
      icone: 'carteira',
      valor: formatBRL(saldo),
      detalhe: 'Total disponível nas suas contas cadastradas.',
      cor: 'from-brand-600 to-brand-800',
      link: '/mais/contas',
      textoLink: 'Ver contas',
    },
    {
      rotulo: 'Resumo do mês',
      icone: 'setaBaixo',
      valor: `${formatBRL(despesas)} em despesas`,
      detalhe: `${formatBRL(faturas)} em faturas neste mês.`,
      cor: 'from-violet-600 to-indigo-700',
      link: '/relatorios',
      textoLink: 'Ver relatório',
    },
  ]

  useEffect(() => {
    if (pausado || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const intervalo = window.setInterval(() => {
      setIndice((atual) => (atual + 1) % banners.length)
    }, 7000)

    return () => window.clearInterval(intervalo)
  }, [banners.length, pausado])

  const banner = banners[indice]

  return (
    <section
      className="space-y-2"
      aria-label="Informações financeiras"
      aria-roledescription="carrossel"
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
      onFocusCapture={() => setPausado(true)}
      onBlurCapture={(evento) => {
        if (!evento.currentTarget.contains(evento.relatedTarget)) setPausado(false)
      }}
    >
      <div
        className={`min-h-32 rounded-2xl bg-gradient-to-br ${banner.cor} p-4 text-white shadow-sm`}
        aria-live="off"
      >
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
            <Icone nome={banner.icone} tamanho={20} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-white/80">{banner.rotulo}</p>
            <p className="tabular mt-0.5 truncate text-2xl font-bold">
              {banner.valor ?? (erro ? 'Cotação indisponível' : 'Carregando...')}
            </p>
            <p className="mt-1 text-xs text-white/80">{banner.detalhe}</p>
            {indice === 0 && erro && (
              <button
                type="button"
                onClick={atualizar}
                className="mt-2 text-xs font-semibold underline underline-offset-2"
              >
                Tentar novamente
              </button>
            )}
            {banner.link && (
              <Link
                to={banner.link}
                className="mt-2 inline-flex items-center gap-1 text-xs font-semibold"
              >
                {banner.textoLink}
                <Icone nome="direita" tamanho={13} />
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center gap-2" aria-label="Selecionar banner">
        {banners.map((item, i) => (
          <button
            key={item.rotulo}
            type="button"
            aria-label={`Mostrar banner: ${item.rotulo}`}
            aria-current={i === indice ? 'true' : undefined}
            onClick={() => setIndice(i)}
            className={`h-2 rounded-full transition-all ${
              i === indice
                ? 'w-5 bg-brand-600 dark:bg-brand-400'
                : 'w-2 bg-slate-300 dark:bg-slate-700'
            }`}
          />
        ))}
      </div>
    </section>
  )
}
