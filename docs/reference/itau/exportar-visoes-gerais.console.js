// Cole no console do DevTools (F12 > Console) com uma aba aberta e logada em
// https://devportal.itau.com.br/nossas-apis/itau-ep9-api-recebimentos-v1-externo
// Baixa itau-visoes-gerais.json com a aba "visão geral" das 15 APIs. Não leva cookies nem dados da conta.
(async () => {
  const slugs = [
    'itau-ep9-api-recebimentos-v1-externo', 'itau-ep9-gtw-cash-management-ext-v2', 'itau-ep9-gtw-boletos-boletos-v3-ext-aws',
    'itau-ep9-api-boleto-v1-externo', 'itau-ep9-gtw-boletoscash-boletoscash-v2-ext-aws', 'itau-ep9-api-extrato-v1-externo',
    'itau-ep9-api-regulatorio-pix-v2-externo', 'itau-ep9-api-conciliacao-v1-externo', 'itau-ng7-api-pixautomatico-v1-externo',
    'itau-ep9-api-qrcode-pix-automatico-v1-externo', 'itau-vw9-api-account-statement-v1-externo', 'itau-ep9-gtw-sispag-ext',
    'itau-ep9-gtw-pix-recebimentos-ext-v2', 'itau-ep9-gtw-pix-recebimentos-conciliacoes-v2-ext', 'itau-ep9-api-saque-troco-v1-externo',
  ];
  const build = window.__NEXT_DATA__.buildId;
  const out = [];
  for (const s of slugs) {
    const r = await fetch(`/_next/data/${build}/nossas-apis/${s}.json?slug=${s}`, { credentials: 'include' });
    const p = (await r.json()).pageProps || {};
    const sp = p.specifications || {};
    out.push({
      slug: s,
      title: sp.specificationsData?.info?.title,
      version: sp.specificationsData?.info?.version,
      updated_at: p.data?.updated_at,
      sandboxUrl: sp.sandboxUrl,
      README: p.data?.README,
    });
  }
  const sem = out.filter((o) => !o.README).map((o) => o.slug);
  if (sem.length) console.warn('Sem visão geral (login expirado?):', sem);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 1)], { type: 'application/json' }));
  a.download = 'itau-visoes-gerais.json';
  a.click();
  console.log('ok:', out.length - sem.length, 'de', out.length);
})();
