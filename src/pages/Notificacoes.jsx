import { useEffect, useState } from 'react'
import { CabecalhoVoltar } from '../components/AppShell'
import { Icone } from '../components/Icone'
import { Botao, Cartao, Campo, Entrada, TituloSecao } from '../components/ui'
import { criarAssinaturaPush, dadosDaAssinatura, suportaNotificacoes } from '../lib/notificacoes'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/authStore'
import { useUI } from '../store/uiStore'

const PADRAO = { enabled: false, days_before: 3, notify_closing: true, notify_due: true }

export function Notificacoes() {
  const userId = useAuth((state) => state.sessao?.user?.id)
  const mostrarToast = useUI((state) => state.mostrarToast)
  const [preferencias, setPreferencias] = useState(PADRAO)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!userId) return
    supabase
      .from('notification_settings')
      .select('enabled, days_before, notify_closing, notify_due')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setPreferencias(data)
        setCarregando(false)
      })
  }, [userId])

  const ativar = async () => {
    if (!suportaNotificacoes()) {
      mostrarToast('Este navegador não suporta notificações push.', 'erro')
      return
    }
    setSalvando(true)
    try {
      const permissao = Notification.permission === 'granted'
        ? 'granted'
        : await Notification.requestPermission()
      if (permissao !== 'granted') throw new Error('Permissão de notificações negada.')

      const assinatura = await criarAssinaturaPush()
      const { error } = await supabase.from('push_subscriptions').upsert(
        { user_id: userId, ...dadosDaAssinatura(assinatura) },
        { onConflict: 'endpoint' }
      )
      if (error) throw error
      await salvar({ enabled: true })
      mostrarToast('Notificações ativadas neste celular.', 'sucesso')
    } catch (erro) {
      mostrarToast(erro.message ?? 'Não foi possível ativar as notificações.', 'erro')
    } finally {
      setSalvando(false)
    }
  }

  const salvar = async (mudancas = {}) => {
    const novas = { ...preferencias, ...mudancas }
    setPreferencias(novas)
    const { error } = await supabase.from('notification_settings').upsert(
      { user_id: userId, ...novas },
      { onConflict: 'user_id' }
    )
    if (error) throw error
  }

  const mudarPreferencia = async (mudancas) => {
    try {
      await salvar(mudancas)
    } catch {
      mostrarToast('Não foi possível salvar esta preferência.', 'erro')
    }
  }

  return (
    <>
      <CabecalhoVoltar titulo="Notificações" />
      <div className="space-y-5 p-4">
        <Cartao className="flex items-start gap-3 border-brand-200 bg-brand-50 dark:border-brand-900 dark:bg-brand-950/30">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white">
            <Icone nome="sino" tamanho={19} />
          </span>
          <div>
            <p className="font-semibold">Lembretes de cartões</p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Receba um aviso antes do fechamento ou vencimento da fatura.
            </p>
          </div>
        </Cartao>

        <section>
          <TituloSecao>Permissão deste celular</TituloSecao>
          <Cartao>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-medium">Notificações push</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {preferencias.enabled ? 'Ativadas neste dispositivo' : 'Ainda não configuradas'}
                </p>
              </div>
              <Botao tamanho="sm" carregando={salvando} onClick={ativar}>
                {preferencias.enabled ? 'Atualizar' : 'Ativar'}
              </Botao>
            </div>
          </Cartao>
        </section>

        <section>
          <TituloSecao>Quando avisar</TituloSecao>
          <Cartao className="space-y-4">
            <Campo rotulo="Antecedência">
              <Entrada
                type="number"
                min="0"
                max="30"
                value={preferencias.days_before}
                disabled={carregando}
                onChange={(evento) => mudarPreferencia({ days_before: Number(evento.target.value) })}
              />
            </Campo>
            <Preferencia
              texto="Fechamento da fatura"
              ativa={preferencias.notify_closing}
              aoMudar={() => mudarPreferencia({ notify_closing: !preferencias.notify_closing })}
            />
            <Preferencia
              texto="Vencimento da fatura"
              ativa={preferencias.notify_due}
              aoMudar={() => mudarPreferencia({ notify_due: !preferencias.notify_due })}
            />
          </Cartao>
        </section>
      </div>
    </>
  )
}

function Preferencia({ texto, ativa, aoMudar }) {
  return (
    <button type="button" onClick={aoMudar} className="flex w-full items-center justify-between gap-3 text-left">
      <span className="text-sm">{texto}</span>
      <span className={`flex h-6 w-11 items-center rounded-full p-1 transition-colors ${ativa ? 'bg-brand-600' : 'bg-slate-300 dark:bg-slate-700'}`}>
        <span className={`h-4 w-4 rounded-full bg-white transition-transform ${ativa ? 'translate-x-5' : ''}`} />
      </span>
    </button>
  )
}