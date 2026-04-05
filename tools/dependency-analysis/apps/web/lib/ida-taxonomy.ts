import taxonomy from '@/data/ida_sector_subsectors.json';

export type IdaTaxonomySubsector = {
  code: string;
  name: string;
};

export type IdaTaxonomySector = {
  code: string;
  name: string;
  subsectors: IdaTaxonomySubsector[];
};

type IdaTaxonomyFile = {
  sectors: IdaTaxonomySector[];
};

export const IDA_TAXONOMY = (taxonomy as IdaTaxonomyFile).sectors;

export function getIdaSubsectors(sectorName: string): IdaTaxonomySubsector[] {
  return IDA_TAXONOMY.find((sector) => sector.name === sectorName)?.subsectors ?? [];
}
