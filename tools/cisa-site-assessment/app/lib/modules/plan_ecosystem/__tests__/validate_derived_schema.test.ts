/**
 * Unit tests for validate_derived_schema: good examples pass; forbidden phrases and wrong endings fail.
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { validateDerivedSchema } from "../validate_derived_schema";

describe("validateDerivedSchema", () => {
  it("passes for valid schema with observation ending 'is not documented.'", () => {
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

  it("passes for valid schema with observation ending 'is not specified.'", () => {
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

  it("fails when observation does not end with allowed ending", () => {
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

  it("passes when observation contains 'facility' (allowed neutral noun)", () => {
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

  it("fails when impact exceeds 400 chars", () => {
    const invalid = {
      sections: [
        {
          section_title: "Evacuation",
          section_key: "evacuation",
          elements: [
            {
              element_title: "Assembly point",
              element_key: "assembly_point",
              observation: "The assembly point is not documented.",
              ofc: "Document the primary assembly point.",
              impact: "x".repeat(401),
            },
          ],
        },
      ],
    };
    assert.throws(
      () => validateDerivedSchema(invalid),
      (e: Error) => e.message.includes("impact") && e.message.includes("400")
    );
  });

  it("fails when ofc contains disallowed cost language (e.g. budget)", () => {
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
              ofc: "Include budget and cost options.",
              impact: "Planning requires cost visibility.",
            },
          ],
        },
      ],
    };
    assert.throws(
      () => validateDerivedSchema(invalid),
      (e: Error) => e.message.includes("ofc") && (e.message.includes("disallowed") || e.message.includes("cost-budget"))
    );
  });

  it("fails when impact contains $ (cost-currency)", () => {
    const invalid = {
      sections: [
        {
          section_title: "Evacuation",
          section_key: "evacuation",
          elements: [
            {
              element_title: "Assembly point",
              element_key: "assembly_point",
              observation: "The assembly point is not documented.",
              ofc: "Document the primary assembly point.",
              impact: "Responders need a known location. Budget is $50k.",
            },
          ],
        },
      ],
    };
    assert.throws(
      () => validateDerivedSchema(invalid),
      (e: Error) => e.message.includes("impact") && (e.message.includes("disallowed") || e.message.includes("cost-currency"))
    );
  });

  it("fails when impact contains 'within 6 months' (time-within-N)", () => {
    const invalid = {
      sections: [
        {
          section_title: "Evacuation",
          section_key: "evacuation",
          elements: [
            {
              element_title: "Assembly point",
              element_key: "assembly_point",
              observation: "The assembly point is not documented.",
              ofc: "Document the primary assembly point.",
              impact: "Responders need a known location within 6 months.",
            },
          ],
        },
      ],
    };
    assert.throws(
      () => validateDerivedSchema(invalid),
      (e: Error) => e.message.includes("impact") && (e.message.includes("disallowed") || e.message.includes("time-within"))
    );
  });

  it("fails when impact contains 'regulatory' (regulatory-compliance)", () => {
    const invalid = {
      sections: [
        {
          section_title: "Evacuation",
          section_key: "evacuation",
          elements: [
            {
              element_title: "Assembly point",
              element_key: "assembly_point",
              observation: "The assembly point is not documented.",
              ofc: "Document the primary assembly point.",
              impact: "Regulatory compliance with this requirement is essential.",
            },
          ],
        },
      ],
    };
    assert.throws(
      () => validateDerivedSchema(invalid),
      (e: Error) => e.message.includes("impact") && (e.message.includes("disallowed") || e.message.includes("regulatory"))
    );
  });

  it("fails when impact contains 'CFR' (regulatory-cfr)", () => {
    const invalid = {
      sections: [
        {
          section_title: "Evacuation",
          section_key: "evacuation",
          elements: [
            {
              element_title: "Assembly point",
              element_key: "assembly_point",
              observation: "The assembly point is not documented.",
              ofc: "Document the primary assembly point.",
              impact: "Refer to CFR for regulatory context.",
            },
          ],
        },
      ],
    };
    assert.throws(
      () => validateDerivedSchema(invalid),
      (e: Error) => e.message.includes("impact") && (e.message.includes("disallowed") || e.message.includes("regulatory"))
    );
  });

  it("passes when impact contains 'compliance' in neutral plan sense", () => {
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
              ofc: "Document the primary assembly point.",
              impact: "Compliance with the plan improves coordination.",
            },
          ],
        },
      ],
    };
    assert.doesNotThrow(() => validateDerivedSchema(valid));
  });

  it("passes when impact contains normal plan language like 'annual review'", () => {
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
              ofc: "Document the primary assembly point.",
              impact: "Annual review of assembly points ensures clarity for responders.",
            },
          ],
        },
      ],
    };
    assert.doesNotThrow(() => validateDerivedSchema(valid));
  });

  it("fails when a section has no elements", () => {
    const invalid = {
      sections: [
        {
          section_title: "Evacuation",
          section_key: "evacuation",
          elements: [],
        },
      ],
    };
    assert.throws(
      () => validateDerivedSchema(invalid),
      (e: Error) => (e as Error & { validationErrors?: string[] }).validationErrors?.some((s) => s.includes("at least one element")) ?? e.message.includes("element")
    );
  });
});
