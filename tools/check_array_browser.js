/** Run with playwright-cli on the real site; see docs/validation/geo-array-reader.md. */
async (page) => {
  const { base, artifacts } = await page.evaluate(() => ({
    base: new URL('.', location.href).href,
    artifacts: new URL(location.href).searchParams.get('arrayArtifacts'),
  }));
  if (!artifacts?.startsWith('/')) throw Error('Supply ?arrayArtifacts=<absolute artifact directory>');
  const errors = [];
  const onError = e => errors.push(String(e.message || e));
  const onConsole = m => { if (m.type() === 'error') errors.push(m.text()); };
  const onRequest = r => errors.push(r.url());
  page.on('pageerror', onError); page.on('console', onConsole); page.on('requestfailed', onRequest);
  const check = (ok, note) => { if (!ok) throw Error(note); };
  const results = [];
  const pass = route => route.continue();
  await page.route('**/*', pass);
  try {
    await page.goto(base);
    await page.getByLabel('Colour by', { exact: true }).waitFor();
    await page.waitForFunction(() => document.body.innerText.includes('Every protein-coding gene'));
    const sourceSummary = page.locator('summary').filter({hasText:/^Data Sources/});
    const provenanceSummary = page.locator('summary').filter({hasText:/^Provenance$/});
    for (const [type, label, count] of [
      ['array-log2-ratio', 'Array log2 sample/reference ratio', 95],
      ['array-signal', 'Array normalized signal', 20],
      ['array-profile', 'Array normalized time-course profile', 12],
    ]) {
      await page.getByLabel('Colour by', {exact:true}).selectOption(`type.transcriptomics.array.${type}`);
      if (!await sourceSummary.evaluate(el => el.parentElement.open)) await sourceSummary.click();
      const sources = page.locator('details').filter({has:sourceSummary});
      const radios = sources.getByRole('radio');
      check(await radios.count() === count, `${type} count`);
      const selected = await radios.evaluateAll(rs => rs.filter(r => r.checked).map(r => r.getAttribute('aria-label')));
      check(selected.length === 1, `${type} must read exactly one initial dataset`);
      const first = selected[0];
      check(!/Optional/.test(first), `${type} default is an individual sample`);
      check(await radios.first().isChecked(), `${type} initially reads the first deposited sample`);
      await radios.nth(1).check();
      check(await radios.nth(1).isChecked(), `${type} switching`);
      await radios.nth(1).focus();
      await page.keyboard.press('ArrowDown');
      check(await radios.nth(2).isChecked(), `${type} keyboard switching`);
      const optional = sources.getByRole('radio', {name:/Optional/});
      if (await optional.count()) {
        await optional.first().check();
        check(await optional.first().isChecked(), `${type} optional summary selection`);
      }
      if (!await provenanceSummary.evaluate(el => el.parentElement.open)) await provenanceSummary.click();
      const provenance = page.locator('details').filter({has:provenanceSummary});
      await page.waitForFunction(() => [...document.querySelectorAll('details')].some(d=>d.querySelector('summary')?.textContent==='Provenance' && d.textContent.includes('combined by the authors')));
      const text = await provenance.innerText();
      check(text.includes('Measured in PCC 7942') && text.includes('not measured in UTEX'), `${type} transferred caveat`);
      if (type === 'array-profile') check(text.includes('not absolute RNA abundance'), 'profile meaning');
      const lowTraffic = await page.getByLabel('Judge activity by', {exact:true}).locator('option').allTextContents();
      check(!lowTraffic.some(t => /Array log2|Array normalized time-course/.test(t)), 'non-abundance excluded from low traffic');
      results.push({type, datasets:count, provenance:text});
      for (const [width,height] of [[375,812],[768,1024],[959,900],[961,900],[1239,900],[1241,900],[1280,800],[1440,900]]) {
        await page.setViewportSize({width,height});
        check(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth), `${type} overflow at ${width}`);
        if ([375,768,1280,1440].includes(width)) {
          await sourceSummary.scrollIntoViewIfNeeded();
          await page.screenshot({path:`${artifacts}/${type}-${width}.png`});
        }
      }
      await sourceSummary.click();
      const explanation = page.locator('summary').filter({hasText:`${label} explanation`});
      await explanation.click();
      const method = page.locator('details').filter({has:explanation});
      check((await method.innerText()).includes('Authors’ probe reduction'), `${type} processing disclosure`);
      await explanation.scrollIntoViewIfNeeded();
      await page.screenshot({path:`${artifacts}/${type}-method.png`});
      await explanation.click();
      await provenanceSummary.scrollIntoViewIfNeeded();
      await page.screenshot({path:`${artifacts}/${type}-provenance.png`});
    }
    if (!await sourceSummary.evaluate(el => el.parentElement.open)) await sourceSummary.click();
    await page.getByRole('button', {name:'Change Data Selection',exact:true}).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('checkbox', {name:'Include array datasets (127)',exact:true}).check();
    await dialog.getByLabel('Add a filter',{exact:true}).selectOption('study');
    await dialog.getByLabel('Study or label contains',{exact:true}).fill('GSE102914');
    for (const [width,height] of [[375,812],[768,1024],[1280,800],[1440,900]]) {
      await page.setViewportSize({width,height});
      const medium = dialog.locator('tr[data-id^="GSE102914"] .ds-chip').filter({hasText:/^EPA Very Soft Water$/});
      check(await medium.count() === 20, 'all signal samples and optional summaries appear in the array table');
      check(await medium.evaluateAll(es => es.every(e => {
        const a=e.getBoundingClientRect(), b=e.closest('td').getBoundingClientRect();
        return a.left >= b.left && a.right <= b.right;
      })), `medium chips stay inside their column at ${width}`);
      check(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth), `dialog overflow at ${width}`);
      await page.screenshot({path:`${artifacts}/array-selection-${width}.png`});
    }
    await dialog.getByRole('button',{name:'Close',exact:true}).click();
    check(errors.length===0, JSON.stringify(errors));
    return {results,errors};
  } finally {
    await page.unroute('**/*', pass);
    page.off('pageerror',onError); page.off('console',onConsole); page.off('requestfailed',onRequest);
  }
}
