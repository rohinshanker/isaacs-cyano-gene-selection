/** Run via playwright-cli run-code --filename from the assigned worktree. */
async (page) => {
  const { root, appUrl } = await page.evaluate(() => ({ root: new URL(location.href).searchParams.get('uiArtifacts'), appUrl: new URL('index.html', location.href).href }));
  if (!root?.startsWith('/')) throw new Error('Pass an absolute uiArtifacts path in the app URL.');
  const base = `${appUrl}?uiArtifacts=${encodeURIComponent(root)}`;
  const errors = [];
  const failures = [];
  const check = (ok, label) => { if (!ok) throw new Error(label); };
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('requestfailed', (request) => failures.push(request.url()));
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  let run = 0;
  const nonce = await page.evaluate(() => Date.now());
  const open = async (hash = '', query = '') => {
    await page.goto(`${base}&neighborUiRun=${nonce}-${++run}${query}#ver=8&p=chromosome&c=neighborTssOverlap&g=M744_RS01690${hash}`);
    await page.locator('.neighbor-site-filter').waitFor();
    await page.waitForFunction(() => !document.body.innerText.includes('Tan 2018 site evidence is loading.'));
  };
  const evidence = [];
  const save = async (name) => {
    await page.screenshot({ path: `${root}/${name}.png` });
    if (name.startsWith('chromosome-expanded')) await page.locator('.chromosome-sequence').screenshot({ path: `${root}/${name}-component.png` });
    if (name.startsWith('compact-')) await page.locator('.gene-view').last().screenshot({ path: `${root}/${name}-component.png` });
    // Semantic snapshots are returned as well as written by the CLI's separate snapshot commands.
    const snapshot = await page.locator('body').ariaSnapshot();
    evidence.push({ state: name, snapshot, url: page.url() });
  };
  await open();
  check(await page.locator('.neighbor-site-filter').innerText().then((text) => text.includes('With recorded overlap (603)')), 'exact overlap filter population');
  check(await page.locator('#chromosome-view .neighbor-site-legend').innerText().then((text) => text.includes('Evidence unavailable (0)')), 'legend and filter agree');
  if (await page.locator('#panel-toggle-gene-viewer').getAttribute('aria-expanded') === 'false') await page.locator('#panel-toggle-gene-viewer').click();
  await page.locator('.chromosome-sequence').getByRole('button', { name: 'Fit the whole gene into the strip', exact: true }).click();
  await page.waitForTimeout(150);
  const marks = await page.locator('.gene-view .neighbor-site-mark').count();
  check(marks >= 18, 'compact native markers');
  check(await page.locator('.gene-view .neighbor-site-mark').evaluateAll((nodes) => nodes.every((node) => {
    const line = node.querySelector('.neighbor-site-tick');
    return line && line.getAttribute('x1') === line.getAttribute('x2') && !node.querySelector('path');
  })), 'both compact mounts draw exact vertical lines');
  check(await page.locator('.gene-sequence-strip .neighbor-site-mark').count() > 0, 'expanded exact sequence markers');
  // Native metadata on every mark; no distance substitution.
  const native = await page.locator('.neighbor-site-mark').evaluateAll((nodes) => nodes.every((node) => Number(node.getAttribute('data-position')) >= 319773 && node.getAttribute('aria-label').includes('Tan 2018 Table S1')));
  check(native, 'marker coordinates/provenance');
  for (const [width, height] of [[375,812],[768,1024],[959,900],[961,900],[1239,900],[1241,900],[1280,800],[1440,900]]) {
    await page.setViewportSize({ width, height });
    await page.locator('.chromosome-sequence').getByRole('button', { name: 'Fit the whole gene into the strip', exact: true }).click();
    await page.locator('.gene-sequence-strip').scrollIntoViewIfNeeded();
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `no overflow ${width}`);
    await save(`chromosome-expanded-${width}`);
    await page.locator('.gene-view').last().scrollIntoViewIfNeeded();
    await save(`compact-${width}`);
  }
  // At nucleotide zoom, each line and underline identifies one readable source base.
  await open();
  await page.setViewportSize({ width: 1440, height: 900 });
  const sequence = page.locator('.chromosome-sequence');
  await sequence.locator('.neighbor-site-details > summary').click();
  await sequence.getByRole('button', { name: /^Inspect / }).first().click();
  for (let i = 0; i < 4; i += 1) await sequence.getByRole('button', { name: 'Zoom in on the sequence', exact: true }).click();
  const strip = sequence.locator('.gene-sequence-strip');
  await strip.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowLeft');
  check(await strip.locator('.neighbor-site-mark').count() > 0, 'letter-scale site fixture is visible');
  const exactBaseLines = async () => {
    check(await page.locator('.gene-sequence-strip').evaluate((host) => {
      const marks = [...host.querySelectorAll('.neighbor-site-mark')];
      const original = [...host.querySelectorAll('.gene-sequence-letter-original')];
      const recoded = [...host.querySelectorAll('.gene-sequence-letter-recoded')];
      return marks.length > 0 && marks.every((mark) => {
        const tick = mark.querySelector('.neighbor-site-tick');
        const x = Number(tick.getAttribute('x1'));
        if (tick.getAttribute('x1') !== tick.getAttribute('x2') || mark.querySelector('path')) return false;
        const underlines = [...mark.querySelectorAll('.neighbor-site-base')];
        const rows = recoded.length ? [original, recoded] : [original];
        return underlines.length === rows.length && rows.every((letters, i) => {
          const letter = letters.find((node) => Math.abs(Number(node.getAttribute('x')) - x) < 0.01);
          if (!letter || !letter.textContent.trim()) return false;
          const cell = letter.parentNode.querySelector(i ? '.gene-sequence-recoded' : '.gene-sequence-bases');
          const perNt = Number(cell.getAttribute('width')) / 3;
          const line = underlines[i];
          const left = Number(line.getAttribute('x1')); const right = Number(line.getAttribute('x2'));
          const style = getComputedStyle(letter);
          return Math.abs(left - (x - perNt / 2)) < 0.01 && Math.abs(right - (x + perNt / 2)) < 0.01
            && Number(line.getAttribute('y1')) > letter.getBBox().y + letter.getBBox().height
            && line.getAttribute('stroke-linecap') === 'butt' && style.visibility === 'visible'
            && style.fill !== getComputedStyle(cell).fill;
        });
      });
    }), 'lines underline exactly one base per Original/Recoded row with readable letters');
  };
  await exactBaseLines();
  await save('sequence-site-letters');
  await open('&g=M744_RS00250');
  if (await page.locator('#panel-toggle-gene-viewer').getAttribute('aria-expanded') === 'false') await page.locator('#panel-toggle-gene-viewer').click();
  check(await page.locator('.gene-view-key-neighbor-site').count() === 2, 'both compact views name the neighbouring-site line');
  check(await page.locator('.gene-view-key-tss').count() === 2, 'self-associated TSS key remains separate');
  check((await page.locator('.chromosome-sequence').innerText()).includes('Purple lines in the Sites row'), 'mixed self/neighbour sequence has an exact-base line key');
  await save('mixed-site-keys');
  // Real dense, opposite-strand and mapped iTSS examples, with an active recoding scheme.
  for (const gene of ['M744_RS01690', 'M744_RS04455', 'M744_RS00665']) {
    await open(`&g=${gene}&s=TCG-AGC`);
    const sequencePanel = page.locator('.chromosome-sequence .neighbor-site-details');
    await sequencePanel.locator('summary').first().click();
    check(await sequencePanel.locator('.neighbor-site-row').count() > 0, `${gene} source list`);
    if (gene === 'M744_RS04455') check((await sequencePanel.innerText()).includes('opposite strand'), 'opposite source strand explicit');
    if (gene === 'M744_RS00665') check((await sequencePanel.innerText()).includes('iTSS+125110'), 'mapped internal TSS explicit');
    for (const [width, height] of [[375,812],[768,1024],[959,900],[961,900],[1239,900],[1241,900],[1280,800],[1440,900]]) {
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(150); // Let responsive reflow and the strip's ResizeObserver settle.
      const inspectedRow = gene === 'M744_RS04455' ? sequencePanel.locator('.neighbor-site-row').filter({ hasText: 'opposite strand' }).first()
        : gene === 'M744_RS00665' ? sequencePanel.locator('.neighbor-site-row').filter({ hasText: 'iTSS+125110' }).first() : sequencePanel;
      await inspectedRow.getByRole('button', { name: /^Inspect / }).first().click();
      for (let i = 0; i < 4; i += 1) await page.locator('.chromosome-sequence').getByRole('button', { name: 'Zoom in on the sequence', exact: true }).click();
      await exactBaseLines();
      const cameraFingerprint = () => page.locator('.gene-sequence-strip').evaluate((host) => JSON.stringify({
        description: host.querySelector('svg').getAttribute('aria-label'),
        sites: [...host.querySelectorAll('.neighbor-site-tick')].map((line) => [line.getAttribute('x1'), line.getAttribute('y1')]),
      }));
      const atMax = await cameraFingerprint();
      for (let i = 0; i < 4; i += 1) await page.locator('.chromosome-sequence').getByRole('button', { name: 'Zoom in on the sequence', exact: true }).click();
      await page.locator('.gene-sequence-strip').scrollIntoViewIfNeeded();
      const box = await page.locator('.gene-sequence-strip').boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.wheel(0, -2000);
      await page.waitForTimeout(100);
      await page.mouse.move(0, 0);
      check(await cameraFingerprint() === atMax, `excess button/wheel zoom keeps inspected TSS base visible ${gene} ${width}`);
      await exactBaseLines();
      check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `base-level overflow ${gene} ${width}`);
      await page.locator('.gene-sequence-strip').scrollIntoViewIfNeeded();
      await save(`base-lines-${gene}-${width}`);
      await page.locator('.gene-sequence-strip').screenshot({ path: `${root}/base-lines-${gene}-${width}-strip.png` });
      await page.locator('.chromosome-sequence').screenshot({ path: `${root}/base-lines-${gene}-${width}-component.png` });
    }
  }
  await open('&g=M744_RS00665');
  const detailSites = page.locator('#detail .neighbor-site-details');
  if (await detailSites.getAttribute('open') === null) await detailSites.locator('summary').first().click();
  await detailSites.getByRole('button', { name: 'Open M744_RS00660', exact: true }).focus();
  await page.keyboard.press('Enter');
  check(page.url().includes('g=M744_RS00660'), 'detail-view neighbour navigation persists in the shared link');
  check((await page.locator('#detail').innerText()).startsWith('M744_RS00660'), 'detail-view neighbour navigation updates the gene');
  await save('detail-site-owner-navigation');
  // Colour explanations share one disclosure structure across every option.
  // Leaving the neighbour category must preserve that structure in both maps.
  for (const panelName of ['Chromosome/Gene', 'Native codon space']) {
    await page.getByRole('tab', { name: panelName, exact: true }).click();
    for (const value of ['lengthNt', 'neighborTssOverlap', 'functionCategory', 'neighborTssOverlap']) {
      const picker = panelName === 'Chromosome/Gene' ? page.locator('#chromosome-view select').filter({ has: page.locator('option[value="neighborTssOverlap"]') }).first() : page.locator('#color-by');
      await picker.selectOption(value);
      check(page.url().includes(`c=${value}`), `${panelName} colour change persists`);
    }
  }
  await open();
  // Dense list retains all 18 rows and permits keyboard navigation to a hidden owner.
  await page.setViewportSize({ width: 1280, height: 800 });
  const panels = page.locator('.neighbor-site-details');
  check(await panels.count() >= 3, 'both compact/detail and expanded disclosures');
  const seqPanel = page.locator('.chromosome-sequence .neighbor-site-details');
  await seqPanel.locator('summary').first().click();
  check(await seqPanel.locator('.neighbor-site-row').count() === 18, 'dense list complete');
  await page.locator('#neighbor-site-filter-without').check();
  check(page.url().includes('ns=without'), 'filter persists in URL');
  check(await seqPanel.locator('.neighbor-site-row').count() === 18, 'hidden source association preserved');
  await seqPanel.getByRole('button', { name: 'Open M744_RS01695', exact: true }).first().focus();
  await page.keyboard.press('Enter');
  check(page.url().includes('g=M744_RS01695'), 'keyboard associated-gene navigation');
  await open('&ns=with');
  check(await page.locator('#neighbor-site-filter-with').isChecked(), 'saved filter reload');
  // Inspect native chromosome marks without relying on hover or wide pixel spacing.
  const canvas = page.locator('#chromosome-view canvas');
  await canvas.focus(); await page.keyboard.press('n'); await page.keyboard.press('Enter');
  check(await page.locator('#chromosome-view .neighbor-site-details').first().getAttribute('open') !== null, 'chromosome keyboard inspector');
  await save('chromosome-keyboard-inspection');
  // Self-TSS visibility remains independent of neighbouring-site evidence.
  await open('&mk=tss.chromosome,tss.gene-controls,tss.gene-detail,tss.sequence');
  if (await page.locator('#panel-toggle-gene-viewer').getAttribute('aria-expanded') === 'false') await page.locator('#panel-toggle-gene-viewer').click();
  check(await page.locator('.gene-view-tss').count() === 0, 'self TSS choice kept');
  check(await page.locator('.neighbor-site-mark').count() === 0, 'hidden neighbour marks have no targets');
  check(await page.locator('.chromosome-sequence [data-sequence-action="gene-sequence-start-sites"]').count() === 1, 'neighbour-only expanded gene retains visibility toggle');
  check(await page.locator('[data-detail-action="gene-view-start-sites"]').count() === 2, 'neighbour-only compact mounts retain visibility toggles');
  await canvas.focus(); await page.keyboard.press('n');
  check(!(await page.locator('#chromosome-view .neighbor-site-details').first().getAttribute('open')), 'N cannot inspect hidden marker');
  await save('all-start-sites-hidden');
  // Selected-source removal suspends all consumers and never presents a false zero.
  await open('&ns=without&ds=GSE205444');
  check(await page.locator('#neighbor-site-filter-without').isDisabled(), 'unselected sources suspend filter');
  check(await page.locator('.neighbor-site-mark').count() === 0, 'source removal suspends marks');
  check(await page.locator('#chromosome-view .neighbor-site-legend').innerText().then((text) => text.includes('Evidence unavailable (2,715)')), 'source removal unknown colour bucket');
  await save('source-unavailable');
  // No native site layer in a different organism; no cross-strain joins.
  await open('&ns=without', '&org=ecoli-k12-mg1655');
  check(await page.locator('#neighbor-site-filter-without').isDisabled(), 'other organism unavailable');
  check(!(await page.locator('.neighbor-site-filter').innerText()).includes('Select a Tan'), 'undeclared organism never asked to select Tan');
  check(await page.locator('.neighbor-site-mark').count() === 0, 'other organism no marks');
  await save('organism-unavailable');
  await open('&p=native&ns=with');
  await page.getByRole('tab', { name: 'Native codon space', exact: true }).click();
  const scatterLegend = page.locator('#legend');
  check(await scatterLegend.innerText().then((text) => text.includes('Shortlisted: diamond outline') && text.includes('Pinned: ring with crosshairs')), 'scatter selection conventions retained');
  check(await scatterLegend.innerText().then((text) => text.includes('excluded by filters')), 'visible ghosts explained');
  await page.locator('#show-hidden').uncheck();
  check(!(await scatterLegend.innerText()).includes('excluded by filters'), 'hidden ghosts not described as drawn');
  await save('scatter-neighbour-colour');
  check(errors.length === 0, `Unexpected console/page errors: ${errors.join('; ')}`);
  check(failures.length === 0, `Unexpected failed requests: ${failures.join('; ')}`);
  return { passed: true, screenshots: evidence.map(({ state }) => `${root}/${state}.png`), semanticSnapshots: evidence, errors, failures };
}
