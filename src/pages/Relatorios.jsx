import { useEffect, useMemo, useState } from 'react'
import { Cabecalho } from '../components/AppShell'
import { BarrasMensais, RankingCategorias } from '../components/graficos'
import { Botao, Cartao, Esqueleto, Segmentado, TituloSecao, Vazio } from '../components/ui'
import { useTransacoes } from '../hooks/useTransacoes'
import {
  addMonths,
  chaveMes,
  inicioMesISO,
  mesDaChave,
  rotuloMes,
  rotuloMesCurto,
  subMonths,
  ultimosMeses,
} from '../lib/dates'
import { formatBRL } from '../lib/money'
import { totaisPorCategoria } from '../lib/resumo'
import { mensagemDeErro, supabase } from '../lib/supabase'
import { useUI } from '../store/uiStore'

export function Relatorios() {
  const mes = useUI((s) => s.mes)
  const mostrarToast = useUI((s) => s.mostrarToast)

  const [periodo, setPeriodo] = useState(6)
  const [evolucao, setEvolucao] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [exportando, setExportando] = useState(false)

  const { transacoes } = useTransacoes(mes)
  const porCategoria = useMemo(() => totaisPorCategoria(transacoes, 'expense'), [transacoes])
  const totalDespesas = porCategoria.reduce((a, c) => a + c.total, 0)

  // A evolução vem da RPC monthly_totals: agregar no banco evita baixar um ano
  // inteiro de lançamentos só para desenhar 12 barras.
  useEffect(() => {
    let ativo = true
    setCarregando(true)

    const meses = ultimosMeses(periodo)
    const de = inicioMesISO(meses[0])
    const ate = inicioMesISO(addMonths(meses[meses.length - 1], 1))

    supabase.rpc('monthly_totals', { p_from: de, p_to: ate }).then(({ data, error }) => {
      if (!ativo) return
      if (!error) {
        const porMes = new Map(
          (data ?? []).map((l) => [
            l.month.slice(0, 7),
            { receitas: Number(l.income_cents), despesas: Number(l.expense_cents) },
          ])
        )
        // Meses sem lançamento precisam aparecer zerados — um buraco no
        // gráfico faz o mês parecer inexistente em vez de vazio.
        setEvolucao(
          meses.map((m) => ({
            rotulo: rotuloMesCurto(m),
            receitas: porMes.get(chaveMes(m))?.receitas ?? 0,
            despesas: porMes.get(chaveMes(m))?.despesas ?? 0,
          }))
        )
      }
      setCarregando(false)
    })

    return () => {
      ativo = false
    }
  }, [periodo])

  const media = useMemo(() => {
    if (!evolucao.length) return { receitas: 0, despesas: 0 }
    const soma = evolucao.reduce(
      (a, m) => ({ receitas: a.receitas + m.receitas, despesas: a.despesas + m.despesas }),
      { receitas: 0, despesas: 0 }
    )
    return {
      receitas: Math.round(soma.receitas / evolucao.length),
      despesas: Math.round(soma.despesas / evolucao.length),
    }
  }, [evolucao])

  const mesAtual = evolucao.at(-1)
  const mesAnterior = evolucao.at(-2)
  const variacao =
    mesAnterior?.despesas && mesAtual
      ? ((mesAtual.despesas - mesAnterior.despesas) / mesAnterior.despesas) * 100
      : null

  const exportarCSV = async () => {
    setExportando(true)
    try {
      const inicio = inicioMesISO(subMonths(mesDaChave(mes), periodo - 1))
      const fim = inicioMesISO(addMonths(mesDaChave(mes), 1))

      const { data, error } = await supabase
        .from('transactions')
        .select(`
          date, kind, amount_cents, description, paid,
          installment_no, installment_total,
          categories ( name ),
          accounts!transactions_account_id_fkey ( name )
        `)
        .gte('date', inicio)
        .lt('date', fim)
        .order('date')
      if (error) throw error

      baixarCSV(data ?? [], `financeiro-${inicio}-a-${mes}.csv`)
      mostrarToast(`${data?.length ?? 0} lançamentos exportados.`, 'sucesso')
    } catch (e) {
      mostrarToast(mensagemDeErro(e), 'erro')
    } finally {
      setExportando(false)
    }
  }

  return (
    <>
      <Cabecalho titulo="Relatórios" subtitulo={rotuloMes(mesDaChave(mes))} />

      <div className="space-y-5 p-4">
        <Segmentado
          opcoes={[
            { valor: 6, rotulo: '6 meses' },
            { valor: 12, rotulo: '12 meses' },
          ]}
          valor={periodo}
          aoMudar={setPeriodo}
        />

        <section>
          <TituloSecao>Evolução</TituloSecao>
          <Cartao>
            {carregando ? (
              <Esqueleto className="h-56" />
            ) : (
              <BarrasMensais dados={evolucao} altura={200} />
            )}
          </Cartao>
        </section>

        <div className="grid grid-cols-2 gap-3">
          <Cartao>
            <p className="text-xs text-slate-500 dark:text-slate-400">Média de entradas</p>
            <p className="tabular mt-1 text-lg font-bold">{formatBRL(media.receitas)}</p>
          </Cartao>
          <Cartao>
            <p className="text-xs text-slate-500 dark:text-slate-400">Média de saídas</p>
            <p className="tabular mt-1 text-lg font-bold">{formatBRL(media.despesas)}</p>
          </Cartao>
        </div>

        {variacao != null && (
          <Cartao className="flex items-center gap-3 py-3">
            <span className="text-xl" aria-hidden="true">
              {variacao > 0 ? '📈' : '📉'}
            </span>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Você gastou{' '}
              <strong
                className={
                  variacao > 0
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-emerald-600 dark:text-emerald-400'
                }
              >
                {Math.abs(variacao).toFixed(0)}% {variacao > 0 ? 'a mais' : 'a menos'}
              </strong>{' '}
              que no mês anterior.
            </p>
          </Cartao>
        )}

        <section>
          <TituloSecao>Categorias em {rotuloMes(mesDaChave(mes))}</TituloSecao>
          <Cartao>
            {porCategoria.length === 0 ? (
              <Vazio icone="grafico" titulo="Sem despesas neste mês" />
            ) : (
              <RankingCategorias dados={porCategoria} total={totalDespesas} limite={20} />
            )}
          </Cartao>
        </section>

        <Botao
          variante="contorno"
          tamanho="lg"
          className="w-full"
          icone="baixar"
          onClick={exportarCSV}
          carregando={exportando}
        >
          Exportar {periodo} meses em CSV
        </Botao>
      </div>
    </>
  )
}

const TIPOS = { expense: 'Despesa', income: 'Receita', transfer: 'Transferência' }

/**
 * CSV pensado para abrir no Excel em português: separador ponto-e-vírgula,
 * decimal com vírgula e BOM no início — sem o BOM o Excel lê UTF-8 como
 * Latin-1 e todo acento vira caractere quebrado.
 */
function baixarCSV(linhas, nomeArquivo) {
  const cabecalho = [
    'Data',
    'Tipo',
    'Categoria',
    'Conta',
    'Descrição',
    'Valor',
    'Situação',
    'Parcela',
  ]

  const escapar = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`

  const corpo = linhas.map((t) =>
    [
      t.date,
      TIPOS[t.kind] ?? t.kind,
      t.categories?.name ?? '',
      t.accounts?.name ?? '',
      t.description ?? '',
      (t.amount_cents / 100).toFixed(2).replace('.', ','),
      t.paid ? 'Pago' : 'Previsto',
      t.installment_total > 1 ? `${t.installment_no}/${t.installment_total}` : '',
    ]
      .map(escapar)
      .join(';')
  )

  const conteudo = '﻿' + [cabecalho.map(escapar).join(';'), ...corpo].join('\r\n')
  const url = URL.createObjectURL(new Blob([conteudo], { type: 'text/csv;charset=utf-8;' }))

  const link = document.createElement('a')
  link.href = url
  link.download = nomeArquivo
  link.click()
  URL.revokeObjectURL(url)
}
