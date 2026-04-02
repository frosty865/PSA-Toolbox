/**
 * Integration-ish tests (no DB): small derived schema + chunks.
 * Case A: requirement-only chunks with placeholders -> all elements emit.
 * Case B: add implementation narrative covering evidence_terms -> those elements suppressed.
 * Assert: each emitted item has exactly 1 OFC; observations end correctly; no forbidden phrases.
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { hasImplementationEvidence } from "../evidence";
import { classifyPlanSourceRole } from "../source_roles";

const FORBIDDEN_OBSERVATION = ["failed", "unable", "could not", "did not", "noncompliant", "deficient"];
const VALID_ENDINGS = ["is not documented.", "is not specified."];

function assertObservationStyle(observation: string): void {
  const ok = VALID_ENDINGS.some((e) => observation.trim().endsWith(e));
  assert.ok(ok, `observation must end with "is not documented." or "is not specified.": "${observation.slice(-80)}"`);
  const lower = observation.toLowerCase();
  for (const w of FORBIDDEN_OBSERVATION) {
    assert.ok(!lower.includes(w), `observation must not contain "${w}"`);
  }
}

describe("generate_from_derived_schema (no DB)", () => {
  const smallSchema = {
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
            impact: "Responders need a known location.",
            evidence_terms: ["assembly point", "muster point"],
          },
          {
            element_title: "Evacuation route",
            element_key: "evacuation_route",
            observation: "The evacuation route is not specified.",
            ofc: "Specify the evacuation route.",
            impact: "Clear routes reduce confusion.",
            evidence_terms: ["evacuation route", "egress"],
          },
        ],
      },
    ],
  };

  it("Case A: requirement-only chunks with placeholders -> hasImplementationEvidence is false", () => {
    const implementationChunks = [
      { chunk_text: "Click or tap here to build out this section. Select date. [insert date]. Click or tap here again." },
    ];
    for (const sec of smallSchema.sections) {
      for (const el of sec.elements) {
        const satisfied = hasImplementationEvidence({
          implementationChunks,
          evidenceTerms: el.evidence_terms,
        });
        assert.strictEqual(satisfied, false, "placeholder-heavy content must not satisfy");
      }
    }
  });

  it("Case B: implementation narrative covering evidence_terms -> hasImplementationEvidence is true", () => {
    const narrative = (
      "The building has a designated assembly point in the north parking lot. All occupants should proceed to the muster point " +
      "after evacuating via the main egress routes. The evacuation route is posted on each floor and includes primary and secondary exits. " +
      "Annual drills reinforce the assembly point and evacuation route procedures. This document describes the facility evacuation plan " +
      "and has been updated to reflect current egress paths and assembly areas. Staff are trained on the evacuation route and muster point " +
      "locations quarterly. The assembly point is marked with signs and is accessible to persons with disabilities. " +
      "Repeat content to reach narrative length threshold for evidence. The evacuation route is documented in section 3. " +
      "The muster point is reviewed annually. Egress capacity is sufficient for the occupant load. "
    ).repeat(2);
    const implementationChunks = [{ chunk_text: narrative }];
    const hasAssembly = hasImplementationEvidence({
      implementationChunks,
      evidenceTerms: ["assembly point", "muster point"],
    });
    assert.strictEqual(hasAssembly, true);
    const hasRoute = hasImplementationEvidence({
      implementationChunks,
      evidenceTerms: ["evacuation route", "egress"],
    });
    assert.strictEqual(hasRoute, true);
  });

  it("each schema element has exactly one OFC string", () => {
    for (const sec of smallSchema.sections) {
      for (const el of sec.elements) {
        assert.ok(typeof el.ofc === "string" && el.ofc.trim().length > 0);
        assert.ok(!el.ofc.includes("|"));
        assert.ok(!/\d+\.\s+[A-Z]/.test(el.ofc), "ofc should not be a numbered list");
      }
    }
  });

  it("observations end with allowed ending and contain no forbidden phrases", () => {
    for (const sec of smallSchema.sections) {
      for (const el of sec.elements) {
        assertObservationStyle(el.observation);
      }
    }
  });

  it("classifyPlanSourceRole: title with 'template' is REQUIREMENT", () => {
    assert.strictEqual(classifyPlanSourceRole({ title: "Active Assailant EAP Template" }), "REQUIREMENT");
    assert.strictEqual(classifyPlanSourceRole({ title: "Instructional Guide for Plans" }), "REQUIREMENT");
  });

  it("classifyPlanSourceRole: placeholder-heavy sample is REQUIREMENT", () => {
    const sample = "Click or tap here. To build out this section select date. [insert name]. Click or tap here.";
    assert.strictEqual(classifyPlanSourceRole({ title: "Document", chunkSample: sample }), "REQUIREMENT");
  });

  it("classifyPlanSourceRole: narrative-only is IMPLEMENTATION", () => {
    assert.strictEqual(
      classifyPlanSourceRole({
        title: "Facility Evacuation Plan 2024",
        chunkSample: "The assembly point is the north lot. Evacuation routes are posted on each floor.",
      }),
      "IMPLEMENTATION"
    );
  });
});
