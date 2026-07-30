import { useEffect, useMemo, useState } from 'react'
import { Icone } from '../components/Icone'
import {
  AreaTexto,
  Aviso,
  Botao,
  BotaoIcone,
  Campo,
  CampoValor,
  Confirmacao,
  Entrada,
  Folha,
  Segmentado,
  Selecao,
  Vazio,
} from '../components/ui'
import { Link } from 'react-router-dom'
import {
  atualizarLancamento,
  criarLancamento,
  excluirLancamento,
} from '../hooks/useTransacoes'
import { addMonths, hojeISO, parseData, rotuloMes } from '../lib/dates'
import { dividirParcelas, formatBRL } from '../lib/money'
import { mensagemDeErro } from '../lib/supabase'
import { useDados } from '../store/dataStore'
import { useUI } from '../store/uiStore'

const TIPOS = [
  { valor: 'expense', rotulo: 'Despesa', corAtiva: 'bg-rose-600 text-white shadow-sm' },
  { valor: 'income', rotulo: 'Receita', corAtiva: 'bg-brand-600 text-white shadow-sm' },
  { valor: 'transfer', rotulo: 'Transferência', corAtiva: 'bg-slate-600 text-white shadow-sm' },
]

const estadoInicial = (transacao, contas) => ({
  kind: transacao.kind ?? 'expense',
  amount_cents: transacao.amount_cents ?? 0,
  description: transacao.description ?? '',
  notes: transacao.notes ?? '',
  date: transacao.date ?? hojeISO(),
  account_id: transacao.account_id ?? contas[0]?.id ?? '',
  category_id: transacao.category_id ?? '',
  transfer_account_id: transacao.transfer_account_id ?? '',
  paid: transacao.paid ?? true,
  parcelas: 1,
})

export function FormLancamento() {
  const transacao = useUI((s) => s.formLancamento)
  const fechar = useUI((s) => s.fecharForm)
  const mostrarToast = useUI((s) => s.mostrarToast)
  // Seletores devolvem o array cru; o filtro vai no useMemo. Um `.filter()`
  // dentro do seletor do Zustand cria um array novo a cada render e o React
  // entra em loop de re-render.
  const todasContas = useDados((s) => s.contas)
  const todasCategorias = useDados((s) => s.categorias)
  const contas = useMemo(() => todasContas.filter((c) => !c.archived), [todasContas])
  const categorias = useMemo(
    () => todasCategorias.filter((c) => !c.archived),
    [todasCategorias]
  )

  const editando = Boolean(transacao?.id)
  const [form, setForm] = useState(() => estadoInicial(transacao ?? {}, contas))
  const [erro, setErro] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [confirmarExclusao, setConfirmarExclusao] = useState(false)

  const mudar = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }))

  const contaSelecionada = contas.find((c) => c.id === form.account_id)
  const ehCartao = contaSelecionada?.type === 'cartao'
  const ehTransferencia = form.kind === 'transfer'

  const categoriasDoTipo = useMemo(
    () => categorias.filter((c) => c.kind === (form.kind === 'income' ? 'income' : 'expense')),
    [categorias, form.kind]
  )

  // Trocar despesa↔receita invalida a categoria escolhida: as listas são
  // separadas, e manter um id da lista errada geraria um insert rejeitado.
  useEffect(() => {
    if (ehTransferencia) return
    if (form.category_id && !categoriasDoTipo.some((c) => c.id === form.category_id)) {
      mudar('category_id', '')
    }
  }, [categoriasDoTipo, form.category_id, ehTransferencia])

  // Parcelamento só existe em cartão de crédito.
  useEffect(() => {
    if (!ehCartao && form.parcelas > 1) mudar('parcelas', 1)
  }, [ehCartao, form.parcelas])

  const salvar = async () => {
    setErro(null)

    if (!form.amount_cents) return setErro('Informe o valor.')
    if (!form.account_id) return setErro('Escolha a conta.')
    if (!ehTransferencia && !form.category_id) return setErro('Escolha a categoria.')
    if (ehTransferencia && !form.transfer_account_id) return setErro('Escolha a conta de destino.')
    if (ehTransferencia && form.transfer_account_id === form.account_id) {
      return setErro('A conta de destino precisa ser diferente da origem.')
    }

    setSalvando(true)
    try {
      if (editando) {
        await atualizarLancamento(transacao.id, form)
        mostrarToast('Lançamento atualizado.', 'sucesso')
      } else {
        await criarLancamento(form)
        mostrarToast(
          form.parcelas > 1 ? `${form.parcelas} parcelas lançadas.` : 'Lançamento salvo.',
          'sucesso'
        )
      }
      fechar()
    } catch (e) {
      setErro(mensagemDeErro(e))
    } finally {
      setSalvando(false)
    }
  }

  const excluir = async (todasAsParcelas) => {
    try {
      await excluirLancamento(transacao, { todasAsParcelas })
      mostrarToast('Lançamento excluído.', 'sucesso')
      fechar()
    } catch (e) {
      mostrarToast(mensagemDeErro(e), 'erro')
    }
  }

  const valorDaParcela = form.parcelas > 1 ? dividirParcelas(form.amount_cents, form.parcelas)[0] : 0

  /**
   * Mesma regra do trigger set_invoice_month() no banco: compra a partir do
   * dia do fechamento entra na fatura do mês seguinte. Repetida aqui só para
   * exibir o aviso — quem decide de verdade continua sendo o banco, para que
   * relatório e fatura nunca discordem.
   */
  const faturaDestino = useMemo(() => {
    if (!ehCartao || !form.date || !contaSelecionada?.closing_day) return null
    const data = parseData(form.date)
    const mesDaFatura =
      data.getDate() >= contaSelecionada.closing_day ? addMonths(data, 1) : data
    return rotuloMes(mesDaFatura)
  }, [ehCartao, form.date, contaSelecionada])

  // Sem nenhuma conta ativa não há o que lançar, e o formulário viraria um
  // beco sem saída: o seletor de conta fica vazio e o erro só aparece ao
  // tentar salvar. Acontece de verdade quando a pessoa arquiva ou apaga as
  // contas que vieram por padrão.
  if (!contas.length) {
    return (
      <Folha aberta aoFechar={fechar} titulo="Novo lançamento">
        <Vazio
          icone="carteira"
          titulo="Nenhuma conta ativa"
          mensagem="Todo lançamento precisa sair de uma conta. Crie uma conta ou reative uma arquivada para começar."
          acao={
            <Link to="/mais/contas" onClick={fechar}>
              <Botao>Ir para Contas</Botao>
            </Link>
          }
        />
      </Folha>
    )
  }

  return (
    <>
      <Folha
        aberta
        aoFechar={fechar}
        titulo={editando ? 'Editar lançamento' : 'Novo lançamento'}
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
            <Botao tamanho="lg" className="flex-1" onClick={salvar} carregando={salvando}>
              {editando ? 'Salvar' : 'Adicionar'}
            </Botao>
          </div>
        }
      >
        <div className="space-y-4">
          <Segmentado
            opcoes={TIPOS}
            valor={form.kind}
            aoMudar={(v) => mudar('kind', v)}
          />

          {/* O valor vem primeiro e já com foco: é o único campo que a pessoa
              SEMPRE precisa preencher, e os outros têm padrão razoável. */}
          <CampoValor
            valor={form.amount_cents}
            aoMudar={(v) => mudar('amount_cents', v)}
            autoFocus={!editando}
          />

          {!ehTransferencia && (
            <Campo rotulo="Categoria">
              <GradeCategorias
                categorias={categoriasDoTipo}
                selecionada={form.category_id}
                aoSelecionar={(id) => mudar('category_id', id)}
              />
            </Campo>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo={ehTransferencia ? 'De' : 'Conta'}>
              <Selecao value={form.account_id} onChange={(e) => mudar('account_id', e.target.value)}>
                {contas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon} {c.name}
                  </option>
                ))}
              </Selecao>
            </Campo>

            {ehTransferencia ? (
              <Campo rotulo="Para">
                <Selecao
                  value={form.transfer_account_id}
                  onChange={(e) => mudar('transfer_account_id', e.target.value)}
                >
                  <option value="">Escolha…</option>
                  {contas
                    .filter((c) => c.id !== form.account_id && c.type !== 'cartao')
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.icon} {c.name}
                      </option>
                    ))}
                </Selecao>
              </Campo>
            ) : (
              <Campo rotulo="Data">
                <Entrada type="date" value={form.date} onChange={(e) => mudar('date', e.target.value)} />
              </Campo>
            )}
          </div>

          {ehTransferencia && (
            <Campo rotulo="Data">
              <Entrada type="date" value={form.date} onChange={(e) => mudar('date', e.target.value)} />
            </Campo>
          )}

          {/* Fica logo abaixo de Conta e Data porque são esses dois campos que
              determinam a fatura — o aviso precisa estar onde a decisão é
              tomada, não no fim do formulário.
              Sem ele a pessoa lança, abre a aba Cartões, não encontra nada e
              conclui que o app perdeu o lançamento — quando ele foi para a
              fatura seguinte, como manda a regra de fechamento. */}
          {ehCartao && !ehTransferencia && faturaDestino && (
            <Aviso tipo="info">
              Entra na fatura de <strong>{faturaDestino}</strong>, porque{' '}
              {contaSelecionada.name} fecha no dia {contaSelecionada.closing_day}.
            </Aviso>
          )}

          <Campo rotulo="Descrição" dica="Opcional — é o texto que aparece na lista.">
            <Entrada
              value={form.description}
              onChange={(e) => mudar('description', e.target.value)}
              placeholder={ehTransferencia ? 'Ex.: reserva de emergência' : 'Ex.: mercado do mês'}
              maxLength={120}
            />
          </Campo>

          {/* Observações fica recolhido por padrão: o campo é útil, mas usado
              numa minoria dos lançamentos. Sempre visível, ele empurraria o
              botão de salvar para fora da tela no celular e tornaria o
              caminho comum mais lento. */}
          <Observacoes valor={form.notes} aoMudar={(v) => mudar('notes', v)} />

          {/* Parcelamento: só aparece em cartão, e só na criação — dividir um
              lançamento que já existe mexeria em linhas de outros meses. */}
          {ehCartao && !ehTransferencia && !editando && (
            <Campo rotulo="Parcelar">
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                {[1, 2, 3, 4, 5, 6, 10, 12, 18, 24].map((n) => (
                  <button
                    key={n}
                    onClick={() => mudar('parcelas', n)}
                    className={`h-10 shrink-0 rounded-xl px-3.5 text-sm font-medium transition-colors ${
                      form.parcelas === n
                        ? 'bg-brand-600 text-white'
                        : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {n === 1 ? 'à vista' : `${n}x`}
                  </button>
                ))}
              </div>
              {form.parcelas > 1 && form.amount_cents > 0 && (
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  {form.parcelas}x de {formatBRL(valorDaParcela)} · total{' '}
                  {formatBRL(form.amount_cents)}
                  {/* A sobra dos centavos vai na primeira parcela; dizer isso
                      evita a impressão de erro de arredondamento. */}
                  {form.amount_cents % form.parcelas !== 0 && ' (a 1ª absorve os centavos)'}
                </p>
              )}
            </Campo>
          )}

          <label className="flex items-center gap-3 rounded-xl border border-slate-300 px-3.5 py-3 dark:border-slate-700">
            <input
              type="checkbox"
              checked={form.paid}
              onChange={(e) => mudar('paid', e.target.checked)}
              className="h-5 w-5 rounded accent-brand-600"
            />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">
                {form.kind === 'income' ? 'Já recebi' : 'Já paguei'}
              </span>
              <span className="block text-xs text-slate-500 dark:text-slate-400">
                Desmarque para lançar como previsto — não entra no saldo.
              </span>
            </span>
          </label>

          {editando && transacao.installment_total > 1 && (
            <Aviso tipo="info">
              Esta é a parcela {transacao.installment_no} de {transacao.installment_total}. Editar
              aqui muda só esta parcela.
            </Aviso>
          )}

          {erro && <Aviso tipo="erro">{erro}</Aviso>}
        </div>
      </Folha>

      {/* Compra parcelada precisa de três saídas (esta parcela / todas /
          cancelar), então não cabe no diálogo de confirmação simples. */}
      {confirmarExclusao && transacao?.installment_total > 1 ? (
        <Folha
          aberta
          aoFechar={() => setConfirmarExclusao(false)}
          titulo="Excluir compra parcelada"
        >
          <p className="text-sm text-slate-600 dark:text-slate-400">
            “{transacao.description || transacao.categories?.name}” foi lançada em{' '}
            {transacao.installment_total}x. O que você quer excluir?
          </p>
          <div className="mt-4 space-y-2">
            <Botao variante="contorno" tamanho="lg" className="w-full" onClick={() => excluir(false)}>
              Só a parcela {transacao.installment_no}
            </Botao>
            <Botao variante="perigo" tamanho="lg" className="w-full" onClick={() => excluir(true)}>
              Todas as {transacao.installment_total} parcelas
            </Botao>
            <Botao
              variante="fantasma"
              tamanho="lg"
              className="w-full"
              onClick={() => setConfirmarExclusao(false)}
            >
              Cancelar
            </Botao>
          </div>
        </Folha>
      ) : (
        <Confirmacao
          aberta={confirmarExclusao}
          titulo="Excluir lançamento?"
          mensagem="Essa ação não pode ser desfeita."
          textoConfirmar="Excluir"
          perigo
          aoConfirmar={() => excluir(false)}
          aoFechar={() => setConfirmarExclusao(false)}
        />
      )}
    </>
  )
}

/**
 * Campo de observações, recolhido quando está vazio.
 *
 * Abre sozinho se o lançamento já tem uma anotação — senão a pessoa editaria
 * o lançamento sem perceber que existe um texto guardado ali.
 */
function Observacoes({ valor, aoMudar }) {
  const [aberto, setAberto] = useState(Boolean(valor))

  if (!aberto) {
    return (
      <button
        onClick={() => setAberto(true)}
        className="flex w-full items-center gap-2 rounded-xl border border-dashed border-slate-300
          px-3.5 py-3 text-sm text-slate-500 transition-colors active:bg-slate-100
          dark:border-slate-700 dark:text-slate-400 dark:active:bg-slate-800"
      >
        <Icone nome="mais" tamanho={16} />
        Adicionar observações
      </button>
    )
  }

  return (
    <Campo
      rotulo="Observações"
      dica="Nota fiscal, o que foi combinado, por que o valor mudou… As quebras de linha são preservadas."
    >
      <AreaTexto
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        linhas={4}
        maxLength={2000}
        placeholder="Anote aqui o que você vai querer lembrar depois…"
        autoFocus={!valor}
      />
      <div className="mt-1 flex items-center justify-between">
        <span className="text-[11px] text-slate-400 dark:text-slate-500">
          {valor.length}/2000
        </span>
        {valor.length === 0 && (
          <button
            onClick={() => setAberto(false)}
            className="text-[11px] text-slate-500 dark:text-slate-400"
          >
            cancelar
          </button>
        )}
      </div>
    </Campo>
  )
}

/**
 * Grade de categorias com ícone. Bem mais rápida no celular do que um select:
 * a pessoa reconhece o emoji sem ler, e tudo cabe em dois toques.
 */
function GradeCategorias({ categorias, selecionada, aoSelecionar }) {
  if (!categorias.length) {
    return (
      <p className="rounded-xl bg-slate-200 p-3 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-400">
        Nenhuma categoria cadastrada. Crie uma em Mais → Categorias.
      </p>
    )
  }

  return (
    <div className="grid grid-cols-4 gap-2">
      {categorias.map((c) => {
        const ativa = c.id === selecionada
        return (
          <button
            key={c.id}
            onClick={() => aoSelecionar(c.id)}
            className={`flex flex-col items-center gap-1 rounded-xl border p-2 transition-colors ${
              ativa
                ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30'
                : 'border-slate-200 dark:border-slate-800'
            }`}
          >
            <span
              className="flex h-9 w-9 items-center justify-center rounded-lg text-lg"
              style={{ background: `${c.color}22` }}
            >
              {c.icon}
            </span>
            <span className="w-full truncate text-center text-[10px] leading-tight">{c.name}</span>
            {ativa && <Icone nome="check" tamanho={12} className="text-brand-600 dark:text-brand-400" />}
          </button>
        )
      })}
    </div>
  )
}
