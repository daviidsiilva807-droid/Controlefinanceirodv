export function suportaNotificacoes() {
  return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window
}

function chaveVapidParaBytes(chave) {
  const preenchida = `${chave}${'='.repeat((4 - (chave.length % 4)) % 4)}`
  const base64 = preenchida.replace(/-/g, '+').replace(/_/g, '/')
  const binario = window.atob(base64)
  return Uint8Array.from(binario, (caractere) => caractere.charCodeAt(0))
}

export async function criarAssinaturaPush() {
  const chavePublica = import.meta.env.VITE_VAPID_PUBLIC_KEY
  if (!chavePublica) throw new Error('VITE_VAPID_PUBLIC_KEY não configurada.')

  const registro = await navigator.serviceWorker.ready
  const existente = await registro.pushManager.getSubscription()
  if (existente) return existente

  return registro.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: chaveVapidParaBytes(chavePublica),
  })
}

export function dadosDaAssinatura(assinatura) {
  const json = assinatura.toJSON()
  return {
    endpoint: assinatura.endpoint,
    p256dh: json.keys?.p256dh ?? '',
    auth: json.keys?.auth ?? '',
  }
}