/**
 * Unit tests for extract_plan_toc: TOC parsing, strict headings, no prose/fragments.
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { extractPlanToc, parseTocEntriesWithDepth, getTocEntriesFromChunks } from "../extract_plan_toc";

describe("extractPlanToc", () => {
  it("parses TABLE OF CONTENTS with numbered lines", () => {
    const chunks = [
      `
TABLE OF CONTENTS

1. Applicability and scope ............. 4
2. Roles and responsibilities ......... 5
3. Evacuation ......................... 6
4. Assembly points .................... 7
5. Communication ...................... 8

INTRODUCTION
Section 1 starts here.
`,
    ];
    const out = extractPlanToc(chunks);
    assert.ok(out.length >= 4, "expected at least 4 sections");
    assert.strictEqual(out[0].section_title, "Applicability and scope");
    assert.strictEqual(out[0].section_key, "applicability_and_scope");
    assert.strictEqual(out[0].confidence, "TOC");
    assert.ok(out.some((s) => s.section_title.includes("Evacuation")));
  });

  it("uses numbered headings fallback when no TOC", () => {
    const chunks = [
      `
Some intro text.

1. Introduction and scope
2. Roles and responsibilities
3. Evacuation procedures
4. Assembly points
`,
    ];
    const out = extractPlanToc(chunks);
    assert.ok(out.length >= 3);
    assert.strictEqual(out[0].section_title, "Introduction and scope");
    assert.strictEqual(out[2].section_title, "Evacuation procedures");
  });

  it("keeps ALL CAPS headings when they appear at least twice", () => {
    const chunks = [
      `
APPLICABILITY AND SCOPE
This section describes...

ROLES AND RESPONSIBILITIES
Assign roles...

APPLICABILITY AND SCOPE
(duplicate so count >= 2)

ROLES AND RESPONSIBILITIES
(duplicate)
`,
    ];
    const out = extractPlanToc(chunks);
    assert.ok(out.length >= 2);
    assert.ok(out.some((s) => s.section_key.includes("applicability") || s.section_title.includes("APPLICABILITY")));
    assert.ok(out.some((s) => s.section_key.includes("roles") || s.section_title.includes("ROLES")));
  });

  it("does not extract tactical sentences (no prose with sentence punctuation)", () => {
    const chunks = [
      `
1. Introduction

Staff should evacuate to the nearest exit. Call 911 if you see smoke.
Response procedures during an active incident may vary by floor.
Notify the incident commander when the building is clear.
`,
    ];
    const out = extractPlanToc(chunks);
    // Numbered "1. Introduction" may be kept; prose lines must not become sections
    assert.ok(!out.some((s) => s.section_title.includes("Call 911") || s.section_title.includes("when the building")));
    assert.ok(!out.some((s) => s.section_title.includes("Response procedures during an active incident may vary")));
  });

  it("drops truncated fragments (e.g. ending with AN, THE, OF)", () => {
    const chunks = [
      `
TABLE OF CONTENTS

1. Applicability and scope
2. Roles and responsibilities
3. RESPONSE PROCEDURES DURING AN
4. Evacuation procedures
5. ASSEMBLY POINTS AND THE
`,
    ];
    const out = extractPlanToc(chunks);
    assert.ok(!out.some((s) => /DURING AN\s*$/i.test(s.section_title)), "truncated 'DURING AN' should be dropped");
    assert.ok(!out.some((s) => /AND THE\s*$/i.test(s.section_title)), "truncated 'AND THE' should be dropped");
    assert.ok(out.some((s) => /evacuation|Evacuation/.test(s.section_title)));
  });

  it("returns empty array for empty input", () => {
    assert.deepStrictEqual(extractPlanToc([]), []);
    assert.deepStrictEqual(extractPlanToc([""]), []);
  });
});

describe("parseTocEntriesWithDepth / getTocEntriesFromChunks", () => {
  it("parses numbered TOC with depth (1 = section, 2 = element)", () => {
    const lines = [
      "1. Applicability and Scope ............. 4",
      "2. Roles and Responsibilities ......... 5",
      "2.1 Incident Commander ................ 5",
      "2.2 Evacuation Wardens ................ 6",
      "3. Evacuation ......................... 7",
    ];
    const entries = parseTocEntriesWithDepth(lines, 0, 50);
    const depth1 = entries.filter((e) => e.depth === 1);
    const depth2 = entries.filter((e) => e.depth === 2);
    assert.ok(depth1.length >= 3, "at least 3 level-1 sections");
    assert.ok(depth2.length >= 2, "at least 2 level-2 entries under 2");
    assert.strictEqual(depth1[0].numbering, "1");
    assert.strictEqual(depth1[0].title, "Applicability and Scope");
    assert.ok(depth2.some((e) => e.numbering === "2.1" && e.title === "Incident Commander"));
    assert.ok(depth2.some((e) => e.numbering === "2.2" && e.title === "Evacuation Wardens"));
  });

  it("getTocEntriesFromChunks returns entries after TOC marker when chunk has TOC + numbered lines", () => {
    const chunks = [
      "TABLE OF CONTENTS\n1. Applicability and Scope ............. 4\n2. Roles and Responsibilities ......... 5\n2.1 Incident Commander ................ 5",
    ];
    const entries = getTocEntriesFromChunks(chunks);
    assert.ok(entries.length >= 1, "expected at least one entry when TOC present");
    assert.ok(entries.some((e) => e.depth === 1), "expected at least one depth-1 section");
    assert.ok(entries.some((e) => e.depth === 2) || entries.length >= 2, "expected depth-2 sub-entry or multiple entries");
  });
});
