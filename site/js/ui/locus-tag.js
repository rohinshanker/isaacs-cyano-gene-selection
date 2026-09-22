import { geneIdentityDescription } from '../core/gene-identity.js';

/** Build a locus tag whose source-backed description works with hover and focus. */
export function createLocusTag(gene, { focusable = true } = {}) {
  const tag = document.createElement('span');
  tag.className = 'locus-tag identity-tag';
  tag.textContent = gene.id;
  const description = geneIdentityDescription(gene);
  tag.title = description;
  tag.setAttribute('aria-label', gene.id);
  tag.setAttribute('aria-description', description);
  if (focusable) tag.tabIndex = 0;
  return tag;
}
