import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const headers = { 'Content-Type': 'application/json' }
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

function resposta(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers })
}

function dataDoDia(data: Date, dia: number) {
  const resultado = new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), dia))
  if (resultado < data) resultado.setUTCMonth(resultado.getUTCMonth() + 1)
  return resultado
}

function diferencaEmDias(alvo: Date, hoje: Date) {
  return Math.round((alvo.getTime() - hoje.getTime()) / 86400000)
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return resposta({ error: 'Método não permitido.' }, 405)

  const esperado = Deno.env.get('CRON_SECRET')
  if (!esperado || request.headers.get('authorization') !== `Bearer ${esperado}`) {
    return resposta({ error: 'Não autorizado.' }, 401)
  }

  webpush.setVapidDetails(
    `mailto:${Deno.env.get('VAPID_EMAIL')!}`,
    Deno.env.get('VAPID_PUBLIC_KEY')!,
    Deno.env.get('VAPID_PRIVATE_KEY')!
  )

  const hoje = new Date()
  hoje.setUTCHours(0, 0, 0, 0)
  const hojeISO = hoje.toISOString().slice(0, 10)
  const [{ data: cartoes, error: erroCartoes }, { data: preferencias }] = await Promise.all([
    supabase.from('accounts').select('id, user_id, name, closing_day, due_day').eq('type', 'cartao').eq('archived', false),
    supabase.from('notification_settings').select('user_id, enabled, days_before, notify_closing, notify_due'),
  ])
  if (erroCartoes) return resposta({ error: 'Não foi possível consultar os cartões.' }, 500)

  const porUsuario = new Map((preferencias ?? []).map((item) => [item.user_id, item]))
  let enviados = 0

  for (const cartao of cartoes ?? []) {
    const configuracao = porUsuario.get(cartao.user_id)
    if (!configuracao?.enabled) continue

    const eventos = [
      { tipo: 'closing', dia: cartao.closing_day, ativo: configuracao.notify_closing, nome: 'fechamento' },
      { tipo: 'due', dia: cartao.due_day, ativo: configuracao.notify_due, nome: 'vencimento' },
    ]
    const assinaturas = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', cartao.user_id)
    if (assinaturas.error) continue

    for (const evento of eventos) {
      if (!evento.ativo || !evento.dia) continue
      const alvo = dataDoDia(hoje, evento.dia)
      const dias = diferencaEmDias(alvo, hoje)
      if (dias !== Number(configuracao.days_before) && dias !== 0) continue
      const referencia = alvo.toISOString().slice(0, 10)
      const { data: jaEnviado } = await supabase
        .from('notification_deliveries')
        .select('id')
        .eq('user_id', cartao.user_id)
        .eq('account_id', cartao.id)
        .eq('event', evento.tipo)
        .eq('reference_date', referencia)
        .eq('days_before', dias)
        .maybeSingle()
      if (jaEnviado) continue

      const texto = dias === 0
        ? `A fatura do cartão ${cartao.name} vence hoje.`
        : `A fatura do cartão ${cartao.name} ${evento.nome} em ${dias} dia${dias === 1 ? '' : 's'}.`
      const payload = JSON.stringify({
        title: 'Lembrete financeiro',
        body: texto,
        url: '/cartoes',
        tag: `${cartao.id}-${evento.tipo}-${referencia}-${dias}`,
      })

      for (const assinatura of assinaturas.data ?? []) {
        try {
          await webpush.sendNotification(
            { endpoint: assinatura.endpoint, keys: { p256dh: assinatura.p256dh, auth: assinatura.auth } },
            payload
          )
          enviados += 1
        } catch (erro) {
          if (erro.statusCode === 404 || erro.statusCode === 410) {
            await supabase.from('push_subscriptions').delete().eq('id', assinatura.id)
          }
        }
      }

      await supabase.from('notification_deliveries').insert({
        user_id: cartao.user_id,
        account_id: cartao.id,
        event: evento.tipo,
        reference_date: referencia,
        days_before: dias,
      })
    }
  }

  return resposta({ enviados, hoje: hojeISO })
})