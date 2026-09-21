import { useState } from 'react'
import { CabecalhoVoltar } from '../components/AppShell'
import { Icone } from '../components/Icone'
import { Botao, Campo, Cartao, Entrada, TituloSecao } from '../components/ui'
import {
  lerDesafios,
  percentualDesafio,
  salvarDesafios,
  totalConcluido,
  valorDoDia,
} from '../lib/desafios'
import { formatBRL } from '../lib/money'

const CORES = {
  brand: {
    card: 'border-brand-200 bg-brand-50/70 dark:border-brand-900 dark:bg-brand-950/30',
    chip: 'border-brand-300 bg-white text-brand-800 dark:border-brand-800 dark:bg-brand-950 dark:text-brand-200',
    ativo: 'border-brand-600 bg-brand-600 text-white dark:border-brand-400 dark:bg-brand-500',
  },
  amber: {
    card: 'border-amber-200 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/30',
    chip: 'border-amber-300 bg-white text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200',
    ativo: 'border-amber-600 bg-amber-600 text-white dark:border-amber-400 dark:bg-amber-500',
  },
}

export function Desafios() {
  const [desafios, setDesafios] = useState(lerDesafios)
  const [form, setForm] = useState({ nome: '', alvo: '', dias: '' })

  const alternarDia = (id, dia) => {
    setDesafios((atuais) => {
      const novos = atuais.map((desafio) => {
        if (desafio.id !== id) return desafio
        const concluidos = desafio.concluidos.includes(dia)
          ? desafio.concluidos.filter((item) => item !== dia)
          : [...desafio.concluidos, dia]
        return { ...desafio, concluidos }
      })
      salvarDesafios(novos)
      return novos
    })
  }

  const criarDesafio = (evento) => {
    evento.preventDefault()
    const alvoCents = Math.round(Number(form.alvo) * 100)
    const dias = Math.floor(Number(form.dias))
    if (!alvoCents || alvoCents < 100 || !dias || dias < 2 || dias > 365) return

    const novo = {
      id: `personalizado-${Date.now()}`,
      nome: form.nome.trim() || `Meta de ${formatBRL(alvoCents)}`,
      alvoCents,
      dias,
      cor: 'brand',
      concluidos: [],
    }
    const novos = [...desafios, novo]
    salvarDesafios(novos)
    setDesafios(novos)
    setForm({ nome: '', alvo: '', dias: '' })
  }

  return (
    <>
      <CabecalhoVoltar titulo="Desafios" />
      <div className="space-y-5 p-4">
        <section>
          <TituloSecao>Seus desafios</TituloSecao>
          <div className="space-y-4">
            {desafios.map((desafio) => (
              <DesafioCard key={desafio.id} desafio={desafio} aoAlternar={alternarDia} />
            ))}
          </div>
        </section>

        <section>
          <TituloSecao>Configurar novo desafio</TituloSecao>
          <Cartao>
            <form className="space-y-4" onSubmit={criarDesafio}>
              <Campo rotulo="Nome (opcional)">
                <Entrada
                  value={form.nome}
                  onChange={(evento) => setForm((atual) => ({ ...atual, nome: evento.target.value }))}
                  placeholder="Ex.: Viagem de fim de ano"
                  maxLength={40}
                />
              </Campo>
              <div className="grid grid-cols-2 gap-3">
                <Campo rotulo="Quanto juntar">
                  <Entrada
                    type="number"
                    inputMode="decimal"
                    min="1"
                    step="0.01"
                    value={form.alvo}
                    onChange={(evento) => setForm((atual) => ({ ...atual, alvo: evento.target.value }))}
                    placeholder="3.700,00"
                    required
                  />
                </Campo>
                <Campo rotulo="Quantidade de dias">
                  <Entrada
                    type="number"
                    inputMode="numeric"
                    min="2"
                    max="365"
                    step="1"
                    value={form.dias}
                    onChange={(evento) => setForm((atual) => ({ ...atual, dias: evento.target.value }))}
                    placeholder="100"
                    required
                  />
                </Campo>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                O app divide a meta pelos dias e ajusta o último depósito para não sobrar nem faltar centavo.
              </p>
              <Botao type="submit" className="w-full" icone="alvo">
                Criar desafio
              </Botao>
            </form>
          </Cartao>
        </section>
      </div>
    </>
  )
}

function DesafioCard({ desafio, aoAlternar }) {
  const estilo = CORES[desafio.cor] ?? CORES.brand
  const percentual = percentualDesafio(desafio)
  const total = totalConcluido(desafio)

  return (
    <Cartao className={estilo.card}>
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/80 text-brand-700 shadow-sm dark:bg-slate-900/70 dark:text-brand-300">
          <Icone nome="alvo" tamanho={22} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h3 className="font-bold">{desafio.nome}</h3>
            <span className="tabular text-sm font-bold">{formatBRL(total)} / {formatBRL(desafio.alvoCents)}</span>
          </div>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            {desafio.concluidos.length} de {desafio.dias} dias · {formatBRL(valorDoDia(desafio, 0))} por dia em média
          </p>
        </div>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/80 dark:bg-slate-900/70">
        <div className="h-full rounded-full bg-brand-600 transition-all duration-300" style={{ width: `${percentual}%` }} />
      </div>
      <div className="mt-4 grid grid-cols-5 gap-1.5 sm:gap-2">
        {Array.from({ length: desafio.dias }, (_, dia) => {
          const concluido = desafio.concluidos.includes(dia)
          return (
            <button
              key={dia}
              type="button"
              aria-label={`${concluido ? 'Desmarcar' : 'Marcar'} dia ${dia + 1}`}
              aria-pressed={concluido}
              onClick={() => aoAlternar(desafio.id, dia)}
              className={`flex aspect-[1.65] items-center justify-center rounded-full border text-[10px] font-bold transition-all active:scale-95 sm:text-xs ${concluido ? estilo.ativo : estilo.chip}`}
            >
              {concluido ? <Icone nome="check" tamanho={14} /> : formatBRL(valorDoDia(desafio, dia))}
            </button>
          )
        })}
      </div>
    </Cartao>
  )
}