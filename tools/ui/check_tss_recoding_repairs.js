/** Delayed dependency, constraint and performance checks for DEM-423 repairs. */
async (page) => {
  const { root, base } = await page.evaluate(() => ({ root: new URL(location.href).searchParams.get('uiArtifacts'), base: new URL('index.html', location.href).href }));
  if (!root?.startsWith('/')) throw new Error('Pass an absolute ignored uiArtifacts directory.');
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  const errors = []; const failures = []; const evidence = []; const dependencies = [];
  const onError = (error) => errors.push(error.message);
  const onConsole = (message) => { if (message.type() === 'error') errors.push(message.text()); };
  const onFailed = (request) => failures.push(request.url());
  page.on('pageerror', onError); page.on('console', onConsole); page.on('requestfailed', onFailed);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    if (window.__tssTimingHookInstalled) return;
    window.__tssTimingHookInstalled = true;
    window.__tssHandlerTimings = [];
    const original = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function(type, listener, options) {
      if (type === 'click' && this.tagName === 'BUTTON' && typeof listener === 'function'
        && ['No scheme', 'Syn61 original design', 'Amber only'].includes(this.textContent)) {
        const label = this.textContent;
        return original.call(this, type, function(event) {
          const start = performance.now();
          try { return listener.call(this, event); }
          finally { window.__tssHandlerTimings.push({ label, ms: performance.now() - start }); }
        }, options);
      }
      return original.call(this, type, listener, options);
    };
  });
  const keys = ['editedTssSitesInCds', 'evaluatedTssSitesInCds'];
  const files = ['tss_evidence.json', 'regulatory_tss.json'];
  const scheme = 'TAG-TAA.TCA-AGT.TCG-AGC';
  const nonce = Date.now(); let run = 0; let release; let continuations = [];
  const frames = () => page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const open = (hash) => page.goto(`${base}?uiArtifacts=${encodeURIComponent(root)}&tssRepair=${nonce}-${++run}#ver=9&s=${scheme}&${hash}`);
  const ready = () => page.waitForFunction(() => !document.body.classList.contains('is-loading'));
  const save = async (name, component = null) => {
    await page.screenshot({ path: `${root}/${name}.png` });
    if (component) await component.screenshot({ path: `${root}/${name}-component.png` });
    evidence.push({ name, url: page.url(), snapshot: await page.locator('body').ariaSnapshot() });
  };
  const hold = async (file) => {
    continuations = [];
    const gate = new Promise((resolve) => { release = resolve; });
    await page.route(`**/data/${file}*`, async (route) => {
      const continuation = gate.then(() => route.continue());
      continuations.push(continuation); await continuation;
    });
  };
  const settle = async (file) => {
    release(); await Promise.all(continuations); await page.unroute(`**/data/${file}*`); await ready();
    await page.waitForFunction(() => document.querySelector('.neighbor-site-filter')?.textContent.includes('With recorded overlap (603)'));
  };
  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    // Every saved color, X/Y axis and custom-filter path promotes both payloads.
    for (const key of keys) for (const mode of ['color', 'x-axis', 'y-axis', 'filter']) for (const file of files) {
      await hold(file);
      const view = mode === 'color' ? `p=native&c=${key}`
        : mode === 'x-axis' ? `p=axes&c=functionCategory&ax=${key}&ay=lengthNt`
          : mode === 'y-axis' ? `p=axes&c=functionCategory&ax=lengthNt&ay=${key}`
            : `p=native&c=functionCategory&f=${key}:1::0`;
      await open(view);
      await page.waitForFunction((key) => document.querySelector(`#color-by option[value="${key}"]`), key);
      await frames();
      check(continuations.length > 0, `${mode} requested ${file}`);
      check(await page.evaluate(() => document.body.classList.contains('is-loading')), `${key} ${mode} must await ${file}`);
      check(!page.url().includes('csc='), `${key} ${mode} must not persist a pending default`);
      await settle(file); await frames();
      let scale = null;
      if (mode === 'color') {
        scale = await page.locator('#color-scale').inputValue();
        await page.locator('#color-by').selectOption('lengthNt');
        await page.locator('#color-by').selectOption(key); await frames();
        check(await page.locator('#color-scale').inputValue() === scale, `${key}: initial and after-load defaults must agree`);
        check(page.url().includes(`csc=${scale}`), 'settled default saved');
      } else if (mode.endsWith('axis')) {
        check(await page.locator(mode === 'x-axis' ? '#axis-x' : '#axis-y').inputValue() === key, 'saved axis preserved');
        check((await page.locator('#axis-note').textContent()).includes('2,715 genes have values on both axes'), 'both axis payloads ready');
      } else check(page.url().includes(`${key}%3A1`) || decodeURIComponent(page.url()).includes(`${key}:1`), 'saved numeric filter retained');
      dependencies.push({ key, mode, delayedFile: file, scale, passed: true });
    }
    // Late selection while a payload is pending defers the automatic preference too.
    for (const key of keys) for (const file of files) {
      await hold(file); await open('p=native&c=functionCategory'); await ready();
      await page.locator('#color-by').selectOption(key); await frames();
      check(!page.url().includes('csc='), `${key} late selection defers ${file}`);
      await settle(file); await frames();
      const automatic = await page.locator('#color-scale').inputValue();
      await page.locator('#color-by').selectOption('lengthNt'); await page.locator('#color-by').selectOption(key); await frames();
      check(await page.locator('#color-scale').inputValue() === automatic, 'late pending default equals ready default');
      await page.locator('#color-scale').selectOption('linear');
      check(page.url().includes('csc=linear'), 'reader explicitly chooses linear on loaded values');
      await hold(file); await open(`p=native&c=${key}&csc=linear`);
      await page.waitForFunction((key) => document.querySelector(`#color-by option[value="${key}"]`), key);
      await settle(file); await frames();
      check(await page.locator('#color-scale').inputValue() === 'linear', 'saved explicit scale preserved');
      dependencies.push({ key, delayedFile: file, lateSelection: true, explicitScalesPreserved: true });
    }
    await open('p=native&c=editedTssSitesInCds'); await ready();
    await page.getByText('Configure and generate a diverse 6–10-gene panel', { exact: true }).click();
    check(await page.locator('#panel-range-add option[value="editedTssSitesInCds"]').count() === 0, 'edited count absent from panel constraints');
    check(await page.locator('#panel-range-add option[value="evaluatedTssSitesInCds"]').count() === 0, 'source-dependent denominator excluded from fixed constraints');
    check(await page.locator('#filter-add option[value="editedTssSitesInCds"]').count() === 1, 'ordinary interactive filter still offered');
    check((await page.locator('#panel-range-note').textContent()).includes('scheme-independent published or permitted derived metrics'), 'truthful fixed-metric note');
    for (const [width, height] of [[375,812],[768,1024],[959,900],[961,900],[1239,900],[1241,900],[1280,800],[1440,900]]) {
      await page.setViewportSize({ width, height });
      await page.locator('#panel-range-note').scrollIntoViewIfNeeded();
      check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `constraint note overflow ${width}`);
      await save(`repair-constraints-${width}`, page.locator('#panel-range-note'));
    }
    const modelTimings = await page.evaluate(async () => {
      const core = new URL('js/core/', location.href).href;
      const [{ loadDataset }, { tssRecodingModel }, { neighborSiteModel }, { compileScheme }] = await Promise.all([
        import(`${core}dataset.js`), import(`${core}tss-recoding.js`), import(`${core}neighbor-sites.js`), import(`${core}scheme.js`),
      ]);
      const dataset = await loadDataset({ baseUrl: new URL('data/', location.href).href });
      const evidence = neighborSiteModel(dataset, { sources: ['TAN2018_TSS_CONTROL'] });
      const maps = [{}, { TAG: 'TAA' }, { TCG: 'AGC', TCA: 'AGT', TAG: 'TAA' }, { TCG: [['TCC',50],['TCT',50]] }];
      const samples = [];
      for (let i = 0; i < 25; i++) {
        const scheme = compileScheme(maps[i % maps.length], dataset.table);
        const start = performance.now(); tssRecodingModel(dataset, scheme, { evidence }); samples.push(performance.now() - start);
      }
      const repeated = samples.slice(1).sort((a,b) => a-b);
      return { initialMs: samples[0], repeatMedianMs: repeated[12], repeatMinMs: repeated[0], repeatMaxMs: repeated.at(-1), samples };
    });
    const handlerTimings = []; const profiles = [];
    await cdp.send('Profiler.enable');
    for (const panel of ['native', 'chromosome']) {
      await open(`p=${panel}&c=editedTssSitesInCds&g=M744_RS00135`); await ready();
      await cdp.send('Profiler.start');
      for (let i = 0; i < 3; i++) {
        await page.getByRole('button', { name: 'No scheme', exact: true }).click();
        await page.getByRole('button', { name: 'Syn61 original design', exact: true }).click();
      }
      handlerTimings.push({ panel, samples: await page.evaluate(() => window.__tssHandlerTimings) });
      profiles.push((await cdp.send('Profiler.stop')).profile);
    }
    await cdp.send('Profiler.disable');
    const times = new Map();
    for (const profile of profiles) {
      const nodes = new Map(profile.nodes.map((node) => [node.id, node]));
      profile.samples?.forEach((id, i) => {
        const frame = nodes.get(id).callFrame; const key = `${frame.functionName} ${frame.url}:${frame.lineNumber}`;
        const previous = times.get(key) ?? { name: frame.functionName, url: frame.url, line: frame.lineNumber + 1, selfMs: 0 };
        previous.selfMs += (profile.timeDeltas?.[i] ?? 0) / 1000; times.set(key, previous);
      });
    }
    const cpuProfile = [...times.values()].sort((a,b) => b.selfMs - a.selfMs).slice(0,25);
    check(errors.length === 0, `Unexpected console/page errors: ${errors.join('; ')}`);
    check(failures.length === 0, `Unexpected failed requests: ${failures.join('; ')}`);
    return { passed: true, dependencies, modelTimings, handlerTimings, cpuProfile, errors, failures, semanticSnapshots: evidence };
  } finally {
    release?.(); await Promise.allSettled(continuations);
    for (const file of files) await page.unroute(`**/data/${file}*`);
    page.off('pageerror', onError); page.off('console', onConsole); page.off('requestfailed', onFailed);
  }
}
