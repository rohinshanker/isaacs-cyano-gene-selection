/** Parse standard dot-bracket notation into exact 1-based pairs and partners.
 * Zero denotes an unpaired position. Extended brackets/pseudoknots are rejected.
 */
export function parseDotBracket(structure) {
  if (typeof structure !== 'string' || !structure.length || /[^().]/.test(structure)) {
    throw new Error('Expected a nonempty standard dot-bracket structure.');
  }
  const stack = [];
  const pairs = [];
  const partners = Array(structure.length).fill(0);
  for (let i = 0; i < structure.length; i += 1) {
    if (structure[i] === '(') stack.push(i);
    if (structure[i] === ')') {
      if (!stack.length) throw new Error('Unbalanced dot-bracket structure.');
      const left = stack.pop();
      partners[left] = i + 1;
      partners[i] = left + 1;
      pairs.push([left + 1, i + 1]);
    }
  }
  if (stack.length) throw new Error('Unbalanced dot-bracket structure.');
  pairs.sort((a, b) => a[0] - b[0]);
  return { pairs, partners };
}

/** Compare one predicted MFE structure per sequence; invalid output is unavailable.
 * Distance is the symmetric difference of exact index-pair sets (ViennaRNA).
 */
export function compareFoldingWindow(value) {
  if (!value || typeof value.wildSequence !== 'string' || typeof value.recodedSequence !== 'string'
      || !value.wildSequence.length || !value.recodedSequence.length
      || /[^ACGU]/.test(value.wildSequence) || /[^ACGU]/.test(value.recodedSequence)
      || value.wildSequence.length !== value.recodedSequence.length
      || value.length !== value.wildSequence.length
      || value.wildStructure?.length !== value.length
      || value.recodedStructure?.length !== value.length) return null;
  let wild;
  let recoded;
  try {
    wild = parseDotBracket(value.wildStructure);
    recoded = parseDotBracket(value.recodedStructure);
  } catch {
    return null;
  }
  const wildSet = new Set(wild.pairs.map(([a, b]) => `${a}:${b}`));
  const recodedSet = new Set(recoded.pairs.map(([a, b]) => `${a}:${b}`));
  const retained = wild.pairs.filter(([a, b]) => recodedSet.has(`${a}:${b}`));
  const lost = wild.pairs.filter(([a, b]) => !recodedSet.has(`${a}:${b}`));
  const gained = recoded.pairs.filter(([a, b]) => !wildSet.has(`${a}:${b}`));
  const pairingChanged = [];
  const sequenceChanged = [];
  for (let i = 0; i < value.length; i += 1) {
    if (wild.partners[i] !== recoded.partners[i]) pairingChanged.push(i + 1);
    if (value.wildSequence[i] !== value.recodedSequence[i]) sequenceChanged.push(i + 1);
  }
  return { retained, lost, gained, distance: lost.length + gained.length,
    pairingChanged, sequenceChanged, wildPartners: wild.partners, recodedPartners: recoded.partners };
}
