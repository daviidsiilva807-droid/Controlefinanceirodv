import { supabase } from './supabase'

/**
 * Assina as mudanças de uma tabela filtrando por uma coluna (sempre a do
 * usuário logado, na prática). Devolve a função de cancelamento, pronta para
 * ser o retorno de um useEffect.
 *
 * O SUFIXO ALEATÓRIO NO NOME DO CANAL NÃO É ENFEITE. O supabase-js guarda os
 * canais por tópico e devolve a MESMA instância quando o nome se repete.
 * Se um segundo componente monta o mesmo hook, o `.on()` dele cai num canal
 * que já passou por `.subscribe()`, e a biblioteca lança:
 *
 *     cannot add `postgres_changes` callbacks ... after `subscribe()`
 *
 * Esse erro sobe pelo React e deixa a tela EM BRANCO. Acontece de verdade:
 * o sino do cabeçalho e o card de mensagens da tela Mais usam o mesmo hook ao
 * mesmo tempo. Com o sufixo, cada componente tem o canal dele.
 */
export function assinarTabela({ tabela, coluna, valor, aoMudar }) {
  if (!valor) return () => {}

  const canal = supabase
    .channel(`${tabela}:${valor}:${crypto.randomUUID()}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: tabela, filter: `${coluna}=eq.${valor}` },
      aoMudar
    )
    .subscribe()

  return () => {
    supabase.removeChannel(canal)
  }
}
