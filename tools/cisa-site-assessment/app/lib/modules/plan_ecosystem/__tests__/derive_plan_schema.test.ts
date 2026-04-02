/**
 * Unit tests for plan schema derivation (TOC extraction, intent seeds, LLM ofc/impact) and validator.
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { validateDerivedSchema } from "../validate_derived_schema";
import { extractSectionSkeleton, derivePlanSchema } from "../derive_plan_schema";

describe("validateDerivedSchema", () => {
  it("accepts valid schema with observation ending 'is not documented.'", () => {
    const valid = {
      sections: [
        {
          section_title: "Evacuation",
          section_key: "evacuation",
          elements: [
            {
              element_title: "Assembly point",
              element_key: "assembly_point",
              observation: "The assembly point is not documented.",
              ofc: "Document the primary assembly point in the plan.",
              impact: "Responders need a known location to account for occupants.",
            },
          ],
        },
      ],
    };
    assert.doesNotThrow(() => validateDerivedSchema(valid));
  });

  it("accepts valid schema with observation ending 'is not specified.'", () => {
    const valid = {
      sections: [
        {
          section_title: "Roles",
          section_key: "roles",
          elements: [
            {
              element_title: "Incident commander",
              element_key: "incident_commander",
              observation: "The incident commander role is not specified.",
              ofc: "Define the incident commander role in the plan.",
              impact: "Clear roles improve response coordination.",
            },
          ],
        },
      ],
    };
    assert.doesNotThrow(() => validateDerivedSchema(valid));
  });

  it("rejects observation that does not end with allowed ending", () => {
    const invalid = {
      sections: [
        {
          section_title: "Evacuation",
          section_key: "evacuation",
          elements: [
            {
              element_title: "Assembly point",
              element_key: "assembly_point",
              observation: "The assembly point is missing.",
              ofc: "Document the primary assembly point.",
              impact: "Responders need a known location.",
            },
          ],
        },
      ],
    };
    assert.throws(
      () => validateDerivedSchema(invalid),
      (e: Error) => e.message.includes("observation") && (e.message.includes("not documented") || e.message.includes("not specified"))
    );
  });

  it("allows observation containing 'facility' (approved neutral noun)", () => {
    const valid = {
      sections: [
        {
          section_title: "Evacuation",
          section_key: "evacuation",
          elements: [
            {
              element_title: "Assembly point",
              element_key: "assembly_point",
              observation: "The facility assembly point is not documented.",
              ofc: "Document the primary assembly point.",
              impact: "Responders need a known location.",
            },
          ],
        },
      ],
    };
    assert.doesNotThrow(() => validateDerivedSchema(valid));
  });

  it("rejects observation containing forbidden word 'failed'", () => {
    const invalid = {
      sections: [
        {
          section_title: "Drills",
          section_key: "drills",
          elements: [
            {
              element_title: "Drill schedule",
              element_key: "drill_schedule",
              observation: "The failed drill schedule is not documented.",
              ofc: "Document the drill schedule.",
              impact: "Drills indicate gaps if not documented.",
            },
          ],
        },
      ],
    };
    assert.throws(
      () => validateDerivedSchema(invalid),
      (e: Error) => (e as Error & { validationErrors?: string[] }).validationErrors?.some((s) => s.includes("failed")) ?? e.message.includes("failed")
    );
  });

  it("rejects ofc containing tier/cost language", () => {
    const invalid = {
      sections: [
        {
          section_title: "Budget",
          section_key: "budget",
          elements: [
            {
              element_title: "Cost estimate",
              element_key: "cost_estimate",
              observation: "The cost estimate is not specified.",
              ofc: "Include tier 1 and tier 2 cost options.",
              impact: "Budget planning requires cost visibility.",
            },
          ],
        },
      ],
    };
    assert.throws(
      () => validateDerivedSchema(invalid),
      (e: Error) => e.message.includes("ofc") || (e as Error & { validationErrors?: string[] }).validationErrors?.some((s) => s.includes("ofc"))
    );
  });

  it("rejects missing sections key", () => {
    const invalid = {};
    assert.throws(
      () => validateDerivedSchema(invalid as never),
      (e: Error) => e.message.includes("sections")
    );
  });

  it("rejects non-object", () => {
    assert.throws(
      () => validateDerivedSchema(null as never),
      (e: Error) => e.message.includes("object")
    );
  });
});

describe("extractSectionSkeleton", () => {
  it("extracts numbered TOC sections (1. ... 12.) when no TABLE OF CONTENTS region", () => {
    const chunks = [
      {
        chunk_text: `
1. Introduction and scope
2. Roles and responsibilities
3. Evacuation procedures
4. Assembly points
5. Communication
6. Training
`,
        source_title: "Plan Guide",
        page_range: null,
        locator: null,
        source_registry_id: null,
      },
    ];
    const sections = extractSectionSkeleton(chunks);
    assert.ok(sections.length >= 5, "expected at least 5 sections from numbered list");
    assert.strictEqual(sections[0].section_title, "Introduction and scope");
    assert.ok(sections[0].section_key.length > 0);
    assert.strictEqual(sections[2].section_title, "Evacuation procedures");
  });

  it("returns empty array when chunk text is empty", () => {
    const sections = extractSectionSkeleton([{ chunk_text: "", source_title: "", page_range: null, locator: null, source_registry_id: null }]);
    assert.strictEqual(sections.length, 0);
  });

  it("uses toc_parser when TABLE OF CONTENTS present with numbered lines", () => {
    const chunks = [
      {
        chunk_text: `
TABLE OF CONTENTS

1. Applicability and scope ............. 4
2. Roles and responsibilities ......... 5
3. Evacuation ......................... 6
4. Assembly points .................... 7
5. Communication ...................... 8
6. Training ........................... 9

INTRODUCTION
Section 1 starts here.
`,
        source_title: "Template",
        page_range: null,
        locator: null,
        source_registry_id: null,
      },
    ];
    const sections = extractSectionSkeleton(chunks);
    assert.ok(sections.length >= 1, "expected at least one section from TOC");
    const titles = sections.map((s) => s.section_title);
    assert.ok(titles.some((t) => /applicability|scope|roles|evacuation|assembly|communication|training/i.test(t)), "expected TOC section titles");
  });
});

describe("derivePlanSchema (mocked LLM)", () => {
  it("produces elements_count >= sections_count and preserves observations from seeds", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      const payload = [
        { element_key: "applicability_and_scope", ofc: "Document applicability and scope.", impact: "Clarity for readers.", evidence_terms: ["scope", "applicability"] },
        { element_key: "training_activities", ofc: "Document training activities.", impact: "Ensures readiness.", evidence_terms: ["training"] },
        { element_key: "exercises_or_drills", ofc: "Document exercises or drills.", impact: "Validates the plan.", evidence_terms: ["drill", "exercise"] },
      ];
      return new Response(
        JSON.stringify({ message: { content: JSON.stringify(payload) } }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      ) as unknown as Response;
    };

    try {
      const chunks = [
        {
          chunk_text: `
TABLE OF CONTENTS
1. Applicability and scope
2. Training and exercises
`,
          source_title: "Guide",
          page_range: null,
          locator: null,
          source_registry_id: null,
        },
      ];
      const schema = await derivePlanSchema(chunks);
      assert.ok(schema.sections.length >= 1);
      const totalElements = schema.sections.reduce((sum, s) => sum + s.elements.length, 0);
      assert.ok(totalElements >= schema.sections.length, "elements_count must be >= sections_count");

      for (const sec of schema.sections) {
        assert.ok(sec.elements.length >= 1, `section ${sec.section_title} must have at least one element`);
        for (const el of sec.elements) {
          assert.ok(el.observation.endsWith("not documented.") || el.observation.endsWith("not specified."), "observation must be flat doc statement");
          assert.ok((el.ofc ?? "").trim().length > 0, "ofc must be non-empty");
          assert.ok((el.impact ?? "").trim().length > 0, "impact must be non-empty");
        }
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("TOC-derived path: sections from depth 1, elements from depth>=2, __core when 0 children, is_vital true", async () => {
    const tocEntries: Array<{ rawLine: string; numbering: string | null; depth: number; title: string; pageToken: string | null }> = [
      { rawLine: "1. Applicability and Scope", numbering: "1", depth: 1, title: "Applicability and Scope", pageToken: "4" },
      { rawLine: "2. Roles and Responsibilities", numbering: "2", depth: 1, title: "Roles and Responsibilities", pageToken: "5" },
      { rawLine: "2.1 Incident Commander", numbering: "2.1", depth: 2, title: "Incident Commander", pageToken: "5" },
      { rawLine: "2.2 Evacuation Wardens", numbering: "2.2", depth: 2, title: "Evacuation Wardens", pageToken: "6" },
    ];
    const schema = await derivePlanSchema([], { tocEntries });
    assert.strictEqual(schema.sections.length, 2);
    assert.strictEqual(schema.sections[0].section_title, "Applicability and Scope");
    assert.strictEqual(schema.sections[1].section_title, "Roles and Responsibilities");
    const sec0 = schema.sections[0];
    const sec1 = schema.sections[1];
    assert.ok(sec0.elements.length >= 1, "section with 0 TOC children must get __core");
    const coreEl = sec0.elements[0];
    assert.ok(coreEl.element_key.endsWith("__core") || coreEl.element_title.includes("Core documentation"), "fallback __core element");
    assert.strictEqual(coreEl.is_vital, true);
    assert.strictEqual(sec1.elements.length, 2, "section 2 has 2.1 and 2.2");
    assert.ok(sec1.elements.some((e) => e.element_title === "Incident Commander"));
    assert.ok(sec1.elements.some((e) => e.element_title === "Evacuation Wardens"));
    for (const el of sec1.elements) {
      assert.strictEqual(el.is_vital, true);
      assert.ok(el.observation.endsWith("is not documented."));
    }
    const total = schema.sections.reduce((sum, s) => sum + s.elements.length, 0);
    assert.ok(total >= 3, "elementsTotal must be >= 3");
  });
});
