self.addEventListener('push', (event) => {
  let dados
  try {
    dados = event.data?.json() ?? {}
  } catch {
    dados = { body: event.data?.text() ?? '' }
  }

  event.waitUntil(
    self.registration.showNotification(dados.title ?? 'Controle Financeiro', {
      body: dados.body ?? 'Você tem um lembrete financeiro.',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: dados.url ?? '/cartoes' },
      tag: dados.tag ?? 'controle-financeiro',
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL(event.notification.data?.url ?? '/cartoes', self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientes) => {
      const cliente = clientes.find((item) => item.url.startsWith(self.location.origin))
      if (cliente) {
        cliente.navigate(url)
        return cliente.focus()
      }
      return self.clients.openWindow(url)
    })
  )
})