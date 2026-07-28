import { Aviso, Cartao } from '../components/ui'

/**
 * Tela que aparece quando o .env.local ainda não foi preenchido. Sem ela o
 * app quebraria com um "Failed to fetch" no console, que não diz nada para
 * quem está montando o projeto pela primeira vez.
 */
export function Configuracao() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-4 p-5">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-2xl">
          📊
        </div>
        <h1 className="text-xl font-bold">Falta conectar o Supabase</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Três minutos e o app está no ar.
        </p>
      </div>

      <Cartao className="space-y-4 text-sm">
        <Passo numero={1} titulo="Crie um projeto">
          Acesse{' '}
          <a
            className="text-brand-600 underline dark:text-brand-400"
            href="https://app.supabase.com"
            target="_blank"
            rel="noreferrer"
          >
            app.supabase.com
          </a>{' '}
          e crie um projeto novo (o plano gratuito basta).
        </Passo>

        <Passo numero={2} titulo="Rode os arquivos SQL">
          No <strong>SQL Editor</strong>, execute na ordem os arquivos da pasta{' '}
          <code className="rounded bg-slate-200 px-1 dark:bg-slate-800">supabase/</code>:{' '}
          <code className="rounded bg-slate-200 px-1 dark:bg-slate-800">01_schema.sql</code>,{' '}
          <code className="rounded bg-slate-200 px-1 dark:bg-slate-800">02_functions.sql</code> e{' '}
          <code className="rounded bg-slate-200 px-1 dark:bg-slate-800">03_rls.sql</code>.
        </Passo>

        <Passo numero={3} titulo="Copie a URL e a chave pública">
          Em <strong>Settings → API Keys</strong>, copie a <em>Project URL</em> e a chave pública —
          ela aparece como <em>Publishable key</em> (<code>sb_publishable_…</code>) nos projetos
          novos ou como <em>anon public</em> (<code>eyJhbGciOi…</code>) nos antigos. As duas
          funcionam. Cole num arquivo{' '}
          <code className="rounded bg-slate-200 px-1 dark:bg-slate-800">.env.local</code> na raiz do
          projeto:
          <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">
            {`VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...`}
          </pre>
        </Passo>

        <Passo numero={4} titulo="Reinicie o servidor">
          O Vite só lê o <code className="rounded bg-slate-200 px-1 dark:bg-slate-800">.env</code>{' '}
          na inicialização — pare e rode{' '}
          <code className="rounded bg-slate-200 px-1 dark:bg-slate-800">npm run dev</code> de novo.
        </Passo>
      </Cartao>

      <Aviso tipo="info">
        A chave <strong>anon</strong> é pública por natureza e pode ir para o bundle. Quem protege
        seus dados é o RLS do arquivo <code>03_rls.sql</code> — não pule esse passo.
      </Aviso>
    </div>
  )
}

function Passo({ numero, titulo, children }) {
  return (
    <div className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
        {numero}
      </span>
      <div className="min-w-0">
        <p className="font-semibold">{titulo}</p>
        <div className="mt-0.5 text-slate-600 dark:text-slate-400">{children}</div>
      </div>
    </div>
  )
}
