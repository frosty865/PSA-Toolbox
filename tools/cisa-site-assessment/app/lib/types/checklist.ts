/**
 * Checklist Types
 * 
 * Types for capability checklists that drive branching questions.
 */

export type ChecklistItem = {
  id: string;
  label: string;
  description: string;
  tags: string[]; // internal match keys
};

export type SubtypeChecklist = {
  version: "1.0";
  subtype_code: string;
  discipline_code: string;
  title: string;
  items: ChecklistItem[];
};

export type SubtypeChecklistsFile = {
  version: "1.0";
  generated_at: string;
  checklists: SubtypeChecklist[];
};

export type Depth2QuestionTagsFile = {
  version: "1.0";
  generated_at: string;
  questions: Array<{
    canon_id: string;
    subtype_code: string;
    discipline_code: string;
    tags: string[];
  }>;
};
