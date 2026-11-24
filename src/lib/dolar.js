const URL_BASE =
  'https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarPeriodo'

function formatarDataConsulta(data) {
  const dia = String(data.getDate()).padStart(2, '0')
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  return `${mes}-${dia}-${data.getFullYear()}`
}

export function montarUrlCotacoes(dataReferencia = new Date()) {
  const dataFinal = new Date(
    dataReferencia.getFullYear(),
    dataReferencia.getMonth(),
    dataReferencia.getDate()
  )
  const dataInicial = new Date(dataFinal)
  dataInicial.setDate(dataInicial.getDate() - 7)

  return `${URL_BASE}(dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)?@dataInicial='${formatarDataConsulta(dataInicial)}'&@dataFinalCotacao='${formatarDataConsulta(dataFinal)}'&$format=json`
}

export function selecionarCotacao(payload) {
  if (!Array.isArray(payload?.value)) {
    throw new Error('Resposta inválida do Banco Central.')
  }

  const validas = payload.value.filter(
    (item) =>
      Number.isFinite(Number(item.cotacaoVenda)) &&
      Number(item.cotacaoVenda) > 0 &&
      /^\d{4}-\d{2}-\d{2}/.test(item.dataHoraCotacao ?? '')
  )
  const fechamentos = validas.filter((item) =>
    item.tipoBoletim?.toLowerCase().includes('fechamento')
  )
  const candidatas = fechamentos.length > 0 ? fechamentos : validas
  candidatas.sort((a, b) => b.dataHoraCotacao.localeCompare(a.dataHoraCotacao))

  if (candidatas.length === 0) {
    throw new Error('Nenhuma cotação válida foi retornada pelo Banco Central.')
  }

  return {
    valor: Number(candidatas[0].cotacaoVenda),
    data: candidatas[0].dataHoraCotacao.slice(0, 10),
  }
}

export function formatarDataCotacao(data) {
  const [ano, mes, dia] = data.split('-').map(Number)
  return new Intl.DateTimeFormat('pt-BR').format(new Date(ano, mes - 1, dia))
}
