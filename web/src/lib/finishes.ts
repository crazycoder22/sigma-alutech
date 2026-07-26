/** Swatch colours for the finish chips on product pages. */
const SWATCHES: Array<[RegExp, string]> = [
  [/anodi/i, 'linear-gradient(135deg,#b9b4ac,#8d877d)'],
  [/wood/i, 'linear-gradient(135deg,#9a6b3f,#6e4526)'],
  [/powder/i, '#3b3b3b'],
  [/silver/i, 'linear-gradient(135deg,#d3d0ca,#a9a49a)'],
  [/black|graphite|anthracite/i, '#2b2b2b'],
  [/white|ivory/i, '#f2efe8'],
  [/bronze|champagne/i, 'linear-gradient(135deg,#b08d5a,#7d5c2e)'],
  [/gold|brass/i, 'linear-gradient(135deg,#d5b673,#a07c33)'],
];

export function finishSwatch(name: string): string {
  const hit = SWATCHES.find(([pattern]) => pattern.test(name));
  return hit ? hit[1] : 'linear-gradient(135deg,#c9c4ba,#9a9487)';
}
