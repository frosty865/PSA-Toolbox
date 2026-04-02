export type Evidence = {
  page: number;
  excerpt: string;
  source_offset: null;
};

export type ClassifiedEvidence = {
  primary: Evidence[];
  reference: Evidence[];
  duplicatesHidden: number;
};

const normalize = (s: string) =>
  s.trim().toLowerCase().replace(/\s+/g, " ");

export function isReferenceExcerpt(excerpt: string): boolean {
  const s = normalize(excerpt);
  return (
    s.startsWith("option for consideration references") ||
    s === "references" ||
    s.startsWith("references\n")
  );
}

export function isUrlHeavy(excerpt: string): boolean {
  const matches = excerpt.match(/https?:\/\//g);
  return matches !== null && matches.length >= 2;
}

export function classifyEvidence(evidence: Evidence[]): ClassifiedEvidence {
  const seen = new Set<string>();
  const unique: Evidence[] = [];
  let duplicatesHidden = 0;

  for (const e of evidence) {
    const key = normalize(e.excerpt);
    if (seen.has(key)) {
      duplicatesHidden++;
    } else {
      seen.add(key);
      unique.push(e);
    }
  }

  const primary: Evidence[] = [];
  const reference: Evidence[] = [];

  for (const e of unique) {
    if (isReferenceExcerpt(e.excerpt) || isUrlHeavy(e.excerpt)) {
      reference.push(e);
    } else {
      primary.push(e);
    }
  }

  return { primary, reference, duplicatesHidden };
}
