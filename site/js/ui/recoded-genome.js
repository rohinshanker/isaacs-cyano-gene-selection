/** Render the deposited recoded-genome facts above the interactive controls. */

function fact(term, value) {
  const row = document.createElement('div');
  row.className = 'recoded-genome-fact';
  const name = document.createElement('dt');
  name.textContent = term;
  const detail = document.createElement('dd');
  detail.textContent = value;
  row.append(name, detail);
  return row;
}

/**
 * A missing model hides and empties the panel, so native or incomplete records
 * leave no recoding claim in the layout or accessibility tree.
 */
export function renderRecodedGenomePanel(host, model) {
  host.replaceChildren();
  host.hidden = true;
  if (!model) return;

  const heading = document.createElement('h2');
  heading.id = 'recoded-genome-heading';
  heading.textContent = 'Recoded Genome Scheme';
  host.setAttribute('aria-labelledby', heading.id);

  const lead = document.createElement('p');
  lead.className = 'recoded-genome-lead';
  lead.textContent = model.recordType === 'design'
    ? `${model.schemeName}. This selected dataset is the complete published design; it is not a measured isolate.`
    : `${model.schemeName}. This selected dataset is the deposited recoded strain.`;

  const facts = document.createElement('dl');
  facts.className = 'recoded-genome-facts';
  facts.append(
    fact('Targeted codons', model.targets.join(', ')),
    fact('Observed residuals', `${model.total.toLocaleString('en-US')} across `
      + `${model.includedGeneCount.toLocaleString('en-US')} included coding genes`),
    fact('Record status', model.recordType === 'design'
      ? 'Design only · no omics, growth, or fitness measurements are attached.'
      : 'Deposited strain genome · measured layers must name this exact strain.'),
    fact('Genome scope', model.recordType === 'design'
      ? `${model.scope}; complete design, not a measured isolate.`
      : `${model.scope}; not a partial Ec_Syn57 segment set.`),
    fact(model.recordType === 'design' ? 'Design and scheme source' : 'Strain and scheme source', model.source),
    fact(model.recordType === 'design' ? 'Design replacements' : 'Historical replacements',
      model.replacements ?? model.replacementNote),
  );

  const convention = document.createElement('p');
  convention.className = 'panel-note recoded-genome-convention';
  convention.textContent = 'Counting convention: each actual decoded CDS codon body is counted '
    + 'including its annotated start triplet; a terminal TAG is then counted once. Zero is an '
    + 'observed zero, not missing data.';

  const axes = document.createElement('p');
  axes.className = 'panel-note';
  axes.textContent = 'Native codon space refits its axes to the deposited recoded genome; separation reflects '
    + 'surviving synonymous variation.';

  host.append(heading, lead, facts, convention, axes);
  host.hidden = false;
}
