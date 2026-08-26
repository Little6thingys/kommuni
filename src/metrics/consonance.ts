const PENTATONIC = new Set([0, 2, 4, 7, 9]);

export function isConsonantPitchClass(note: number): boolean {
  const pc = ((note % 12) + 12) % 12;
  return PENTATONIC.has(pc);
}

export function computeConsonanceRate(notes: readonly number[]): number {
  if (notes.length === 0) {
    return 1;
  }

  const consonantCount = notes.filter(isConsonantPitchClass).length;
  return consonantCount / notes.length;
}
