import { useState } from 'react'
import { CabecalhoVoltar } from '../components/AppShell'
import { Icone } from '../components/Icone'
import {
  Aviso,
  Botao,
  BotaoIcone,
  Campo,
  CampoValor,
  Cartao,
  Confirmacao,
  Entrada,
  Etiqueta,
  Folha,
  Segmentado,
  Vazio,
} from '../components/ui'
import { useEmprestimos } from '../hooks/useEmprestimos'
import { formatBRL } from '../lib/money'
import { mensagemDeErro } from '../lib/supabase'
import { useUI } from '../store/uiStore'

export function Emprestimos() {
  const { emprestimos, carregando, salvar, excluir } = useEmprestimos()
  const [editando, setEditando] = useState(null)
  const ativos = emprestimos.filter((emprestimo) => emprestimo.active)
  const totalMensal = ativos.reduce((total, emprestimo) => total + emprestimo.installment_amount_cents, 0)

  return (
    <>
      <CabecalhoVoltar
        titulo="Empréstimos"
        subtitulo={totalMensal ? `${formatBRL(totalMensal)} em parcelas` : undefined}
        acao={<BotaoIcone nome="mais" rotulo="Novo empréstimo" onClick={() => setEditando({})} />}
      />
      <div className="space-y-4 p-4">
        <Aviso tipo="info">
          Registre empréstimos para visualizar o valor contratado, a quantidade de parcelas e o compromisso mensal.
        </Aviso>

        {carregando ? null : emprestimos.length === 0 ? (
          <Vazio
            icone="carteira"
            titulo="Nenhum empréstimo cadastrado"
            mensagem="Adicione um empréstimo para acompanhar suas parcelas."
            acao={<Botao onClick={() => setEditando({})}>Cadastrar empréstimo</Botao>}
          />
        ) : (
          <Cartao className="divide-y divide-slate-200 p-0 dark:divide-slate-800">
            {emprestimos.map((emprestimo) => (
              <button
                key={emprestimo.id}
                type="button"
                onClick={() => setEditando(emprestimo)}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors active:bg-slate-100 dark:active:bg-slate-800 ${
                  emprestimo.active ? '' : 'opacity-50'
                }`}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700 dark:bg-brand-900/50 dark:text-brand-300">
                  <Icone nome="carteira" tamanho={19} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-medium">{emprestimo.name}</span>
                    {!emprestimo.active && <Etiqueta>pausado</Etiqueta>}
                  </span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">
                    {emprestimo.installments} parcelas de {formatBRL(emprestimo.installment_amount_cents)}
                  </span>
                </span>
                <span className="tabular shrink-0 text-right text-sm font-semibold">
                  {formatBRL(emprestimo.amount_cents)}
                </span>
                <Icone nome="direita" tamanho={16} className="shrink-0 text-slate-400" />
              </button>
            ))}
          </Cartao>
        )}
      </div>

      {editando && (
        <FolhaEmprestimo
          emprestimo={editando}
          aoSalvar={salvar}
          aoExcluir={excluir}
          aoFechar={() => setEditando(null)}
        />
      )}
    </>
  )
}

function FolhaEmprestimo({ emprestimo, aoSalvar, aoExcluir, aoFechar }) {
  const mostrarToast = useUI((state) => state.mostrarToast)
  const editando = Boolean(emprestimo.id)
  const [form, setForm] = useState({
    name: emprestimo.name ?? '',
    amount_cents: emprestimo.amount_cents ?? 0,
    installments: emprestimo.installments ?? 1,
    installment_amount_cents: emprestimo.installment_amount_cents ?? 0,
    active: emprestimo.active ?? true,
  })
  const [erro, setErro] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [confirmarExclusao, setConfirmarExclusao] = useState(false)

  const mudar = (campo, valor) => {
    setForm((atual) => {
      const novo = { ...atual, [campo]: valor }
      if (campo === 'amount_cents' || campo === 'installments') {
        novo.installment_amount_cents = novo.installments
          ? Math.round(novo.amount_cents / novo.installments)
          : 0
      }
      return novo
    })
  }

  const confirmar = async () => {
    if (!form.name.trim()) return setErro('Dê um nome para o empréstimo.')
    if (!form.amount_cents) return setErro('Informe o valor do empréstimo.')
    if (!form.installments || form.installments < 1) return setErro('Informe a quantidade de parcelas.')
    if (!form.installment_amount_cents) return setErro('Informe o valor da parcela.')

    setSalvando(true)
    try {
      await aoSalvar({ ...emprestimo, ...form, name: form.name.trim(), installments: Number(form.installments) })
      mostrarToast('Empréstimo salvo.', 'sucesso')
      aoFechar()
    } catch (e) {
      setErro(mensagemDeErro(e))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <>
      <Folha
        aberta
        aoFechar={aoFechar}
        titulo={editando ? 'Editar empréstimo' : 'Novo empréstimo'}
        rodape={
          <div className="flex gap-2">
            {editando && (
              <BotaoIcone
                nome="lixeira"
                rotulo="Excluir"
                onClick={() => setConfirmarExclusao(true)}
                className="text-rose-600 dark:text-rose-400"
              />
            )}
            <Botao tamanho="lg" className="flex-1" onClick={confirmar} carregando={salvando}>
              Salvar
            </Botao>
          </div>
        }
      >
        <div className="space-y-4">
          <Campo rotulo="Descrição">
            <Entrada
              value={form.name}
              onChange={(evento) => mudar('name', evento.target.value)}
              placeholder="Ex.: Empréstimo pessoal"
              maxLength={80}
              autoFocus
            />
          </Campo>
          <CampoValor valor={form.amount_cents} aoMudar={(valor) => mudar('amount_cents', valor)} />
          <Campo rotulo="Quantidade de parcelas">
            <Entrada
              type="number"
              min={1}
              max={360}
              inputMode="numeric"
              value={form.installments}
              onChange={(evento) => mudar('installments', Number(evento.target.value))}
            />
          </Campo>
          <CampoValor
            valor={form.installment_amount_cents}
            aoMudar={(valor) => mudar('installment_amount_cents', valor)}
          />
          <p className="text-xs text-slate-500 dark:text-slate-400">
            O valor da parcela é calculado automaticamente, mas pode ser ajustado para incluir juros.
          </p>
          {editando && (
            <Segmentado
              opcoes={[{ valor: true, rotulo: 'Ativo' }, { valor: false, rotulo: 'Pausado' }]}
              valor={form.active}
              aoMudar={(valor) => mudar('active', valor)}
            />
          )}
          {erro && <Aviso tipo="erro">{erro}</Aviso>}
        </div>
      </Folha>

      <Confirmacao
        aberta={confirmarExclusao}
        titulo="Excluir empréstimo?"
        mensagem="Isso remove apenas o controle do empréstimo. Lançamentos já feitos não serão apagados."
        textoConfirmar="Excluir"
        perigo
        aoConfirmar={async () => {
          await aoExcluir(emprestimo.id)
          mostrarToast('Empréstimo excluído.', 'sucesso')
          aoFechar()
        }}
        aoFechar={() => setConfirmarExclusao(false)}
      />
    </>
  )
}