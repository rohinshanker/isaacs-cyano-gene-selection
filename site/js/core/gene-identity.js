/** Use only the symbol and product supplied by the pinned gene annotation. */
export function geneIdentity(gene) {
  const symbol = typeof gene?.name === 'string' ? gene.name.trim() : '';
  if (symbol) return { kind: 'Gene symbol', text: symbol };
  const product = typeof gene?.product === 'string' ? gene.product.trim() : '';
  if (product) return { kind: 'Product', text: product };
  return null;
}

/** A map label may be shortened to fit, but starts with the exact locus tag. */
export function geneMapLabel(gene) {
  const identity = geneIdentity(gene);
  return identity ? `${gene.id} ${identity.text}` : gene.id;
}

/** Full description for focused and hovered locus tags. */
export function geneIdentityDescription(gene) {
  const identity = geneIdentity(gene);
  return identity ? `${identity.kind}: ${identity.text}` : 'No gene symbol or product annotated';
}
