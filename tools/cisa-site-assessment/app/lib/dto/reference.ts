export interface SectorDto {
  id: string;
  name?: string;
  sector_name?: string;
  description?: string;
  is_active?: boolean;
}

export interface SubsectorDto {
  id: string;
  sector_id?: string;
  name?: string;
  description?: string;
  is_active?: boolean;
}

export interface DisciplineSubtypeDto {
  id: string;
  discipline_id?: string;
  name: string;
  code?: string;
  description?: string;
  is_active?: boolean;
  overview?: string;
  indicators_of_risk?: string[] | string;
  common_failures?: string[] | string;
  assessment_questions?: string[] | string;
  mitigation_guidance?: string[] | string;
  standards_references?: string[] | string;
  psa_notes?: string;
  examples?: string[];
  use_cases?: string[];
  best_practices?: string[];
  key_features?: string[];
  related_standards?: string[];
  implementation_notes?: string;
}

export interface DisciplineDto {
  id: string;
  name: string;
  code: string;
  description?: string;
  category?: string;
  is_active?: boolean;
  examples?: string[];
  discipline_subtypes?: DisciplineSubtypeDto[];
}

export interface QuestionFocusPageDto {
  discipline: string;
  subtype: string;
  path: string;
}

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

const asBoolean = (value: unknown): boolean | undefined =>
  typeof value === 'boolean' ? value : undefined;

const asStringArray = (value: unknown): string[] | undefined =>
  Array.isArray(value) && value.every((v) => typeof v === 'string')
    ? (value as string[])
    : undefined;

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

export function parseSectorsPayload(json: Record<string, unknown>): { sectors: SectorDto[] } {
  const sectorsRaw = Array.isArray(json.sectors) ? json.sectors : [];
  const sectors: SectorDto[] = [];
  for (const row of sectorsRaw) {
    const record = asRecord(row);
    if (!record) continue;
    const id = asString(record.id);
    if (!id) continue;
    sectors.push({
      id,
      name: asString(record.name),
      sector_name: asString(record.sector_name),
      description: asString(record.description),
      is_active: asBoolean(record.is_active),
    });
  }
  return { sectors };
}

export function parseSubsectorsPayload(json: Record<string, unknown>): { subsectors: SubsectorDto[] } {
  const rows = Array.isArray(json.subsectors) ? json.subsectors : [];
  const subsectors: SubsectorDto[] = [];
  for (const row of rows) {
    const record = asRecord(row);
    if (!record) continue;
    const id = asString(record.id);
    if (!id) continue;
    subsectors.push({
      id,
      sector_id: asString(record.sector_id),
      name: asString(record.name),
      description: asString(record.description),
      is_active: asBoolean(record.is_active),
    });
  }
  return { subsectors };
}

function parseSubtype(row: unknown): DisciplineSubtypeDto | null {
  const record = asRecord(row);
  if (!record) return null;
  const id = asString(record.id);
  const name = asString(record.name);
  if (!id || !name) return null;

  return {
    id,
    discipline_id: asString(record.discipline_id),
    name,
    code: asString(record.code),
    description: asString(record.description),
    is_active: asBoolean(record.is_active),
    overview: asString(record.overview),
    indicators_of_risk: asStringArray(record.indicators_of_risk) ?? asString(record.indicators_of_risk),
    common_failures: asStringArray(record.common_failures) ?? asString(record.common_failures),
    assessment_questions: asStringArray(record.assessment_questions) ?? asString(record.assessment_questions),
    mitigation_guidance: asStringArray(record.mitigation_guidance) ?? asString(record.mitigation_guidance),
    standards_references: asStringArray(record.standards_references) ?? asString(record.standards_references),
    psa_notes: asString(record.psa_notes),
    examples: asStringArray(record.examples),
    use_cases: asStringArray(record.use_cases),
    best_practices: asStringArray(record.best_practices),
    key_features: asStringArray(record.key_features),
    related_standards: asStringArray(record.related_standards),
    implementation_notes: asString(record.implementation_notes),
  };
}

export function parseDisciplinesPayload(json: Record<string, unknown>): { success: boolean; disciplines: DisciplineDto[]; error?: string } {
  const rows = Array.isArray(json.disciplines) ? json.disciplines : [];
  const disciplines: DisciplineDto[] = [];
  for (const row of rows) {
    const record = asRecord(row);
    if (!record) continue;
    const id = asString(record.id);
    const name = asString(record.name);
    const code = asString(record.code);
    if (!id || !name || !code) continue;

    const subtypeRows = Array.isArray(record.discipline_subtypes) ? record.discipline_subtypes : [];
    const discipline_subtypes: DisciplineSubtypeDto[] = [];
    for (const subtypeRow of subtypeRows) {
      const subtype = parseSubtype(subtypeRow);
      if (subtype) {
        discipline_subtypes.push(subtype);
      }
    }

    disciplines.push({
      id,
      name,
      code,
      description: asString(record.description),
      category: asString(record.category),
      is_active: asBoolean(record.is_active),
      examples: asStringArray(record.examples),
      discipline_subtypes,
    });
  }

  return {
    success: json.success !== false,
    disciplines,
    error: asString(json.error),
  };
}

export function parseDisciplineSubtypesPayload(
  json: Record<string, unknown>
): { success: boolean; subtypes: DisciplineSubtypeDto[]; error?: string } {
  const rows = Array.isArray(json.subtypes) ? json.subtypes : [];
  const subtypes: DisciplineSubtypeDto[] = [];
  for (const row of rows) {
    const subtype = parseSubtype(row);
    if (subtype) {
      subtypes.push(subtype);
    }
  }

  return {
    success: json.success !== false,
    subtypes,
    error: asString(json.error),
  };
}

export function parseQuestionFocusPayload(json: Record<string, unknown>): { pages: QuestionFocusPageDto[] } {
  const rows = Array.isArray(json.pages) ? json.pages : [];
  const pages: QuestionFocusPageDto[] = [];
  for (const row of rows) {
    const record = asRecord(row);
    if (!record) continue;
    const discipline = asString(record.discipline);
    const subtype = asString(record.subtype);
    const path = asString(record.path);
    if (!discipline || !subtype || !path) continue;
    pages.push({ discipline, subtype, path });
  }

  return { pages };
}
