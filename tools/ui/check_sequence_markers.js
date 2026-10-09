/**
 * The sequence close-up's marker contract, checked in a real browser.
 *
 * Run on the real app with `?uiArtifacts=<absolute ignored directory>` via
 * playwright-cli. Two things here cannot be checked under a fake document and
 * are what this file exists for:
 *
 * - **Focus.** A fake DOM keeps `document.activeElement` pointing at a node
 *   that has been detached, so a unit test can assert focus "survived" a
 *   rebuild that in a browser dropped it to `<body>`. Only a browser resets it.
 * - **Drawn geometry.** Overflow, clipping and where an outline actually lands
 *   are laid out, not computed.
 *
 * Pass `?uiFixture=<base url of a patched copy of site/>` to also check the two
 * marker cases the shipped file contains no row for: a row published with a
 * native coordinate and no source-gene-model distance, and an interval that
 * wraps the circular origin so that the bases it covers reach this window in
 * two disjoint stretches. Both need data, not a different renderer, so the
 * fixture is a copy of `site/` with rows added to `data/tss_evidence.json`.
 */
async (page) => {
  const { root, base, fixture } = await page.evaluate(() => {
    const params = new URL(location.href).searchParams;
    return {
      root: params.get('uiArtifacts'),
      base: location.href.split('#')[0],
      fixture: params.get('uiFixture'),
    };
  });
  if (!root?.startsWith('/')) throw new Error('An absolute uiArtifacts directory is required.');
  const errors = [];
  const check = (condition, label) => { if (!condition) throw new Error(label); };
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('requestfailed', (request) => errors.push(request.url()));
  // Modules are cached aggressively, and a stale one makes a repaired view
  // report the defect it no longer has.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await page.emulateMedia({ reducedMotion: 'reduce' });

  const CONTROL = '[data-sequence-action="gene-sequence-start-sites"]';
  const WITH_MARKS = 'M744_RS09575';
  const SHORT_WINDOW_MISS = 'M744_RS00025';
  const evidence = [];

  // A navigation that differs only in the hash does not reload the document,
  // so each case would start from the last one's open disclosures and hidden
  // marks. A counter in the query makes every `open` a real load.
  let loads = 0;
  /** A hash the app will apply, reached by a real reload. */
  const open = async (hash) => {
    loads += 1;
    const query = `${base.includes('?') ? '&' : '?'}uiRun=${loads}`;
    await page.goto(`${base}${query}#ver=6&p=chromosome${hash}`);
    await page.waitForSelector('.gene-sequence-strip', { timeout: 30000 });
  };
  /** A hash applied live, the way a shared link pasted into the bar arrives. */
  const navigate = async (hash) => {
    await page.evaluate((next) => { location.hash = next; }, `#ver=6&p=chromosome${hash}`);
    await page.waitForTimeout(400);
  };
  const focused = () => page.evaluate(() => {
    const node = document.activeElement;
    if (!node || node === document.body) return { tag: 'BODY', label: null };
    return {
      tag: node.tagName,
      label: node.getAttribute('aria-label'),
      action: node.dataset?.sequenceAction ?? null,
      classes: String(node.className ?? ''),
    };
  });

  await page.setViewportSize({ width: 1440, height: 900 });

  /* --- the control disappearing must not take the reader with it --- */
  for (const [what, go] of [['the gene unpinned', () => navigate('')]]) {
    await open(`&g=${WITH_MARKS}`);
    await page.waitForSelector(CONTROL, { timeout: 30000 });
    await page.locator(CONTROL).focus();
    check((await focused()).action === 'gene-sequence-start-sites', `${what}: held first`);
    await go();
    check(await page.locator(CONTROL).count() === 0, `${what}: the control is gone`);
    const after = await focused();
    check(after.tag !== 'BODY', `${what}: focus was not dropped to the document`);
    check(Boolean(after.label), `${what}: and landed somewhere labelled, not ${after.classes}`);
    evidence.push({ transition: what, focusedLabel: after.label });
  }

  /* --- a row beyond 30 nt keeps its control and has a truthful reveal path --- */
  await open(`&g=${SHORT_WINDOW_MISS}`);
  await page.waitForSelector(CONTROL, { timeout: 30000 });
  check(await page.locator('g.gene-sequence-marker').count() === 0,
    'the 30 nt sequence does not move an out-of-range site onto a base');
  const shortState = await page.locator('.gene-sequence-marker-navigation').innerText();
  check(shortState.includes('beyond the current 30 nt sequence'),
    'the short sequence says why the site is not drawn');
  await page.getByRole('button', { name: 'Show the nearest start site in the sequence' }).click();
  check(await page.locator('.gene-sequence-upstream-control select').inputValue() === '60',
    'the reveal uses the smallest existing exact upstream window');
  check(await page.locator('g.gene-sequence-marker').count() === 1,
    'the revealed site is drawn at its native coordinate');
  evidence.push({ shortWindowReveal: '30 to 60 nt', marks: 1 });

  /* --- the gene's own start/stop marks have outward padding, not stolen neighbours --- */
  await open(`&g=${WITH_MARKS}`);
  const verifyPaddingHover = async (hit, mark, label, edge = 'top') => {
    await hit.scrollIntoViewIfNeeded();
    // Let the scroll dismissal settle before starting a fresh hover.
    await page.evaluate(() => new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    }));
    const [hitBox, markBox] = await Promise.all([hit.boundingBox(), mark.boundingBox()]);
    check(Boolean(hitBox && markBox), `${label}: the target and visible mark are measurable`);
    const x = markBox.x + markBox.width / 2;
    const insideY = edge === 'bottom' ? hitBox.y + hitBox.height - 1 : hitBox.y + 1;
    const outsideY = edge === 'bottom' ? hitBox.y + hitBox.height + 1 : hitBox.y - 1;
    await page.mouse.move(x, insideY);
    check(await mark.evaluate((node) => getComputedStyle(node).stroke === 'rgb(26, 115, 232)'),
      `${label}: padding-only hover outlines the visible biological mark`);
    const expectedHint = await mark.evaluate((node) => (
      node.closest('[aria-label]').getAttribute('aria-label')
    ));
    const hint = page.locator('.instant-hint');
    check(await hint.isVisible() && await hint.textContent() === expectedHint,
      `${label}: padding-only hover exposes the visible annotation's details`);
    await page.mouse.move(x, outsideY);
    check(await mark.evaluate((node) => getComputedStyle(node).stroke !== 'rgb(26, 115, 232)'),
      `${label}: immediately outside the target removes the outline`);
    check(!await hint.isVisible() || await hint.textContent() !== expectedHint,
      `${label}: leaving the padded target dismisses its details`);
  };
  await verifyPaddingHover(
    page.locator('g.gene-sequence-codon-start rect.gene-sequence-codon-hit-target'),
    page.locator('g.gene-sequence-codon-start rect.gene-sequence-bases'),
    'sequence cell start',
  );
  await page.locator('g.gene-sequence-codon-start').focus();
  await page.keyboard.press('End');
  await page.waitForSelector('g.gene-sequence-codon-stop', { timeout: 30000 });
  await verifyPaddingHover(
    page.locator('g.gene-sequence-codon-stop rect.gene-sequence-codon-hit-target'),
    page.locator('g.gene-sequence-codon-stop rect.gene-sequence-bases'),
    'sequence cell stop',
  );
  await page.getByRole('button', { name: 'Fit the whole gene into the strip' }).click();
  await page.waitForSelector('rect.gene-sequence-stop-mark', { timeout: 30000 });
  const codonTargets = await page.evaluate(() => {
    const box = (node) => node?.getBoundingClientRect();
    const sequence = ['start', 'stop'].map((kind) => {
      const mark = document.querySelector(`rect.gene-sequence-${kind}-mark`);
      const hit = document.querySelector(
        `g.gene-sequence-bars rect.gene-sequence-codon-hit-target[data-codon-index="${kind === 'start' ? '0' : mark?.dataset.codonIndex}"]`,
      );
      return { kind, mark: box(mark), hit: box(hit) };
    });
    const small = ['start', 'stop'].map((kind) => ({
      kind,
      mark: box(document.querySelector(`rect.gene-view-codon-${kind}`)),
      hit: box(document.querySelector(`rect.gene-view-codon-hit-target[data-codon-kind="${kind}"]`)),
    }));
    return { sequence, small };
  });
  for (const { kind, mark, hit } of [...codonTargets.sequence, ...codonTargets.small]) {
    check(Boolean(mark && hit), `${kind}: the visible codon and its target both exist`);
    check(hit.width > mark.width && hit.height > mark.height,
      `${kind}: the codon target expands beyond the visible mark`);
    check(kind === 'start' ? hit.left < mark.left && hit.right <= mark.right + 1
      : hit.left >= mark.left - 1 && hit.right > mark.right,
    `${kind}: padding stays on the outward edge and leaves the neighbouring base exact`);
  }
  const [sequenceStart, sequenceStop] = codonTargets.sequence;
  await verifyPaddingHover(
    page.locator('g.gene-sequence-bars rect.gene-sequence-codon-hit-target').first(),
    page.locator('rect.gene-sequence-start-mark'),
    'sequence bar start',
  );
  await verifyPaddingHover(
    page.locator('g.gene-sequence-bars rect.gene-sequence-codon-hit-target').last(),
    page.locator('rect.gene-sequence-stop-mark'),
    'sequence bar stop',
  );
  for (const kind of ['start', 'stop']) {
    await verifyPaddingHover(
      page.locator(`rect.gene-view-codon-hit-target[data-codon-kind="${kind}"]`),
      page.locator(`rect.gene-view-codon-${kind}`),
      `small-view ${kind}`,
      'bottom',
    );
  }
  await page.mouse.click(sequenceStart.hit.left + 1,
    sequenceStart.mark.top + sequenceStart.mark.height / 2);
  check(await page.evaluate(() => document.activeElement?.matches('.gene-sequence-start-mark')),
    'start padding selects and focuses the visible start mark');
  await page.mouse.click(sequenceStop.mark.left + sequenceStop.mark.width / 2,
    sequenceStop.hit.top + 1);
  check(await page.evaluate(() => document.activeElement?.matches('.gene-sequence-stop-mark')),
    'stop padding selects and focuses the visible stop mark');
  evidence.push({
    codonTargets: 'small and sequence start/stop padding',
    codonHover: 'padding-only and immediately-outside checks in cell and bar modes',
  });

  /* --- the open list keeps its identity, its state and its focus --- */
  await open(`&g=${WITH_MARKS}`);
  await page.waitForSelector('.gene-sequence-sites summary', { timeout: 30000 });
  await page.locator('.gene-sequence-sites summary').click();
  const probe = await page.evaluate(() => {
    const details = document.querySelector('.gene-sequence-sites');
    details.dataset.probe = 'sequence-sites';
    return details.open;
  });
  check(probe === true, 'the list opened');
  await page.locator('.gene-sequence-sites summary').focus();
  // Another view's marker visibility: nothing to do with this list, and it
  // re-renders this whole view.
  await navigate(`&g=${WITH_MARKS}&mk=tss.chromosome`);
  const kept = await page.evaluate(() => {
    const details = document.querySelector('.gene-sequence-sites');
    return { open: details?.open, probe: details?.dataset.probe };
  });
  check(kept.probe === 'sequence-sites', 'the same disclosure node survived');
  check(kept.open === true, 'and it is still open');
  check((await focused()).tag === 'SUMMARY', 'and the reader is still on its summary');

  /* --- keyboard: hiding the marks from the control --- */
  await page.locator(CONTROL).focus();
  await page.keyboard.press('Space');
  await page.waitForTimeout(400);
  check((await focused()).action === 'gene-sequence-start-sites', 'Space kept focus on the control');
  check(await page.locator('.gene-sequence-sites').evaluate((node) => node.open),
    'hiding the marks did not close the list');
  check(await page.locator('g.gene-sequence-marker').count() === 0, 'and the marks are gone');
  check(await page.locator('.gene-sequence-sites li').count() > 0, 'while every row stays listed');
  check((await page.evaluate(() => location.hash)).includes('tss.sequence'), 'the link records it');
  await page.keyboard.press('Space');
  await page.waitForTimeout(400);
  check(await page.locator('g.gene-sequence-marker').count() > 0, 'and Space again brings them back');

  /* --- focus outside the view is not taken --- */
  await open(`&g=${WITH_MARKS}`);
  await page.waitForSelector(CONTROL, { timeout: 30000 });
  await page.locator('.chromosome-toolbar-row button').first().focus();
  const outside = await focused();
  await navigate(`&g=${SHORT_WINDOW_MISS}`);
  const still = await focused();
  check(still.tag === outside.tag && still.label === outside.label,
    'a reader outside this view was left alone');

  /* --- touch: the control answers a tap on its words --- */
  // Only where the context has touch at all. A context without it cannot tap,
  // and reporting that as a pass would be the quietest possible lie: run this
  // file again in a touch session (`open --mobile`) to cover it.
  const hasTouch = await page.evaluate(() => 'ontouchstart' in window
    || navigator.maxTouchPoints > 0);
  if (hasTouch) {
    await page.setViewportSize({ width: 375, height: 812 });
    await open(`&g=${WITH_MARKS}`);
    await page.waitForSelector(CONTROL, { timeout: 30000 });
    // Just to the right of the box, which is the label's words and not the
    // box itself: the words are the part a finger actually lands on.
    await page.locator('.gene-sequence-layer').scrollIntoViewIfNeeded();
    const box = await page.locator(`${CONTROL}`).boundingBox();
    await page.touchscreen.tap(box.x + box.width + 12, box.y + box.height / 2);
    await page.waitForTimeout(400);
    check(await page.locator('g.gene-sequence-marker').count() === 0,
      'a tap on the label hid the marks');
    check((await focused()).tag !== 'BODY', 'and the tap left focus inside the view');
  }
  evidence.push({ touchTapChecked: hasTouch });

  /* --- geometry, at every width the workspace is checked at --- */
  for (const [width, height] of [[375, 812], [768, 1024], [960, 900], [1240, 900],
    [1280, 800], [1440, 900]]) {
    await page.setViewportSize({ width, height });
    await open(`&g=${WITH_MARKS}`);
    await page.waitForSelector('g.gene-sequence-marker', { timeout: 30000 });
    const geometry = await page.evaluate(() => {
      const strip = document.querySelector('.gene-sequence-strip').getBoundingClientRect();
      const columns = [...document.querySelectorAll('rect.gene-sequence-marker-column')]
        .map((node) => node.getBoundingClientRect());
      const targets = [...document.querySelectorAll('rect.gene-sequence-marker-hit-target')]
        .map((node) => node.getBoundingClientRect());
      const smallTargets = [...document.querySelectorAll('g.gene-view-marker')]
        .map((mark) => ({
          head: mark.querySelector('circle')?.getBoundingClientRect(),
          hit: mark.querySelector('rect.gene-view-marker-hit-target')?.getBoundingClientRect(),
        }));
      return {
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        marks: document.querySelectorAll('g.gene-sequence-marker').length,
        columns: columns.length,
        paddedTargets: targets.length,
        minimumTargetWidth: Math.min(...targets.map((box) => box.width)),
        smallMarks: smallTargets.length,
        smallTargetsPadded: smallTargets.filter(({ head, hit }) => (
          head && hit && hit.width > head.width && hit.height > head.height * 2
        )).length,
        outside: columns.filter((box) => box.left < strip.left - 1 || box.right > strip.right + 1).length,
      };
    });
    check(geometry.overflow <= 0, `${width}: no page overflow, saw ${geometry.overflow}`);
    check(geometry.marks > 0 && geometry.columns >= geometry.marks, `${width}: the marks are drawn`);
    check(geometry.paddedTargets >= geometry.marks && geometry.minimumTargetWidth >= 19,
      `${width}: every point mark keeps its 19 px padded target`);
    check(geometry.smallMarks > 0 && geometry.smallTargetsPadded === geometry.smallMarks,
      `${width}: every small-view target expands beyond its head while partitioning neighbour padding`);
    check(geometry.outside === 0, `${width}: every outline is inside the strip`);
    // The close-up sits at the foot of a long figure, so a viewport shot of the
    // top of the page is a picture of something else.
    await page.locator('.gene-sequence-figure').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${root}/sequence-markers-${width}.png` });
    await page.locator('.gene-sequence-figure')
      .screenshot({ path: `${root}/sequence-markers-${width}-strip.png` });
    evidence.push({ width, height, ...geometry });
  }

  /* --- the two cases the shipped file publishes no row for --- */
  if (fixture) {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${fixture}#ver=6&p=chromosome&g=M744_RS01695`);
    await page.waitForSelector('g.gene-sequence-marker', { timeout: 30000 });
    const marks = await page.evaluate(() => Object.fromEntries(
      [...document.querySelectorAll('g.gene-sequence-marker')].map((mark) => [
        mark.dataset.markerId,
        {
          // `instant-hints.js` moves every SVG `<title>` into a description
          // node and points `aria-describedby` at it, so that is where a
          // mark's own text lives once the app is running.
          title: (mark.getAttribute('aria-describedby') ?? '').split(/\s+/)
            .filter(Boolean)
            .map((id) => document.getElementById(id)?.textContent ?? '')
            .join(' ') || mark.querySelector('title')?.textContent || '',
          columns: [...mark.querySelectorAll('rect.gene-sequence-marker-column')]
            .map((node) => node.getBoundingClientRect())
            .sort((a, b) => a.left - b.left)
            .map((box) => [Math.round(box.left), Math.round(box.right)]),
          stems: mark.querySelectorAll('line.gene-sequence-marker-stem').length,
        },
      ]),
    ));
    const description = await page.locator('.gene-sequence-strip svg').getAttribute('aria-label');
    const note = await page.locator('.gene-sequence-sites .panel-note').textContent();

    const native = marks['fixture-native-only'];
    check(Boolean(native), 'the native-only row is marked');
    check(!/same base/.test(native.title) && !/agree/.test(native.title),
      `the native-only mark claims no agreement: ${native.title}`);
    check(/No distance against the study's own gene model is published/.test(native.title),
      'and says which mapping is missing');
    check(!/agree/.test(description), `the accessible description claims no agreement: ${description}`);
    check(/no distance published against the study's own gene model/.test(note),
      'and the visible list note says so too');

    const wrap = marks['fixture-wrap'];
    check(Boolean(wrap), 'the wrapping interval is marked');
    check(wrap.columns.length === 2, `two outlines, one per covered run, saw ${wrap.columns.length}`);
    check(wrap.stems === 2, 'and one stem per run');
    const gap = wrap.columns[1][0] - wrap.columns[0][1];
    check(gap > 1, `the five uncovered bases are left unpainted, saw a ${gap} px gap`);
    check(/2 separate stretches/.test(wrap.title), 'and the mark says the stretches are separate');
    // The letters under the gap are real bases this strip shows; the outline
    // simply does not cover them.
    const lettersInGap = await page.evaluate(([left, right]) => [...document
      .querySelectorAll('.gene-sequence-strip text')]
      .filter((node) => {
        const box = node.getBoundingClientRect();
        return box.left >= left && box.right <= right && /^[ACGT]$/.test(node.textContent);
      }).length, [wrap.columns[0][1], wrap.columns[1][0]]);
    check(lettersInGap >= 5, `the uncovered bases are still shown, saw ${lettersInGap}`);
    await page.locator('.gene-sequence-figure').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${root}/sequence-markers-fixture.png` });
    await page.locator('.gene-sequence-figure')
      .screenshot({ path: `${root}/sequence-markers-fixture-strip.png` });
    evidence.push({ fixture: true, wrapColumns: wrap.columns, gap, lettersInGap });
  }

  // Back to the app, so a second run of this file reads its parameters from
  // the address it started at rather than from the fixture copy.
  await open(`&g=${WITH_MARKS}`);
  if (errors.length > 0) throw new Error(`browser reported: ${errors.join(' | ')}`);
  return { ok: true, evidence };
}
