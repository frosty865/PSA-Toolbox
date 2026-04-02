/**
 * TOC parse tests: markers (CONTENTS, TABLE OF CONTENTS, TOC), dot leaders,
 * page numbers, multi-chunk window, prose rejection.
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import {
  extractTocSectionsOrThrow,
  isTocMarker,
  PlanTocTrustError,
  PLAN_TOC_NOT_FOUND,
  PLAN_TOC_TOO_SMALL,
} from "../extract_plan_toc";

describe("isTocMarker", () => {
  it("returns true for 'table of contents'", () => {
    assert.strictEqual(isTocMarker("TABLE OF CONTENTS"), true);
    assert.strictEqual(isTocMarker("Table of Contents"), true);
  });
  it("returns true for 'contents'", () => {
    assert.strictEqual(isTocMarker("CONTENTS"), true);
    assert.strictEqual(isTocMarker("Contents"), true);
  });
  it("returns true for 'toc'", () => {
    assert.strictEqual(isTocMarker("TOC"), true);
  });
  it("returns false for random line", () => {
    assert.strictEqual(isTocMarker("Introduction"), false);
    assert.strictEqual(isTocMarker("Emergency Communications"), false);
  });
});

describe("extractTocSectionsOrThrow", () => {
  it("F1: TABLE OF CONTENTS with dot leaders and page numbers", () => {
    const chunks = [
      "TABLE OF CONTENTS\n\n" +
        "1. INTRODUCTION .......... 2\n" +
        "2. SCOPE .......... 3\n" +
        "3. ROLES AND RESPONSIBILITIES .......... 5\n" +
        "4. COMMUNICATIONS .......... 7\n" +
        "5. EMERGENCY COMMUNICATIONS .......... 12\n" +
        "6. TRAINING AND EXERCISES .......... 15\n" +
        "7. EVACUATION ROUTES .......... 18",
    ];
    const { sections, debug } = extractTocSectionsOrThrow(chunks);
    assert.ok(sections.length >= 3, "expected at least 3 sections");
    assert.ok(debug.clusterFound === true || debug.tocFound === true || (debug.acceptedCount != null && debug.acceptedCount >= 3), "expected TOC found or acceptedCount");
    assert.ok(debug.acceptedCount == null || debug.acceptedCount >= 3);
    const titles = sections.map((s) => s.section_title);
    assert.ok(titles.some((t) => t.includes("EMERGENCY COMMUNICATIONS")), "should have EMERGENCY COMMUNICATIONS");
    assert.ok(titles.some((t) => t.includes("TRAINING AND EXERCISES")), "should have TRAINING AND EXERCISES");
  });

  it("F2: CONTENTS marker and unnumbered ALL CAPS entries with page numbers", () => {
    const chunks = [
      "CONTENTS\n\n" +
        "INTRODUCTION AND SCOPE 2\n" +
        "ROLES AND RESPONSIBILITIES 4\n" +
        "TRAINING AND EXERCISES 31\n" +
        "EVACUATION ROUTES 14\n" +
        "EMERGENCY COMMUNICATIONS 16\n" +
        "DRILLS AND EXERCISES 20",
    ];
    const { sections, debug } = extractTocSectionsOrThrow(chunks);
    assert.ok(sections.length >= 3);
    assert.ok(debug.clusterFound === true || debug.tocFound === true || (debug.acceptedCount != null && debug.acceptedCount >= 3));
    assert.ok(debug.acceptedCount == null || debug.acceptedCount >= 3);
    const titles = sections.map((s) => s.section_title);
    assert.ok(titles.some((t) => /TRAINING AND EXERCISES/.test(t)), "should keep TRAINING AND EXERCISES");
    assert.ok(titles.some((t) => /EVACUATION ROUTES/.test(t)));
  });

  it("F3: TOC spans multiple chunks (marker in chunk i, entries in chunk i+1)", () => {
    const chunks = [
      "Some intro text. End of first chunk.",
      "TABLE OF CONTENTS",
      "1. INTRODUCTION .......... 2\n2. SCOPE .......... 3\n3. EVACUATION .......... 5\n4. DRILLS .......... 8\n5. COMMUNICATIONS .......... 10\n6. ROLES AND RESPONSIBILITIES .......... 12",
    ];
    const { sections, debug } = extractTocSectionsOrThrow(chunks);
    assert.ok(sections.length >= 3);
    assert.ok(debug.clusterFound === true || debug.tocFound === true || (debug.acceptedCount != null && debug.acceptedCount >= 3));
    assert.ok(debug.markerChunkIndex !== undefined);
    assert.ok(debug.acceptedCount == null || debug.acceptedCount >= 3);
  });

  it("F4: Rejects prose lines in TOC region", () => {
    const chunks = [
      "CONTENTS\n\n" +
        "1. INTRODUCTION .......... 2\n" +
        "2. SCOPE .......... 3\n" +
        "Plan your exit route thoughtfully 14\n" +
        "3. EVACUATION .......... 5\n" +
        "4. DRILLS .......... 8\n" +
        "5. COMMUNICATIONS .......... 10\n" +
        "6. ROLES AND RESPONSIBILITIES .......... 12",
    ];
    const { sections } = extractTocSectionsOrThrow(chunks);
    const titles = sections.map((s) => s.section_title);
    assert.ok(sections.length >= 3, "expected at least 3 sections");
    assert.ok(!titles.some((t) => /thoughtfully/.test(t)), "prose line should be rejected");
    assert.ok(titles.some((t) => /EVACUATION/.test(t)) || titles.some((t) => /DRILLS/.test(t)), "expected EVACUATION or DRILLS in section titles");
  });

  it("throws PLAN_TOC_NOT_FOUND when no marker and no density", () => {
    const chunks = ["Random paragraph with no TOC.", "Another paragraph."];
    assert.throws(
      () => extractTocSectionsOrThrow(chunks),
      (e) => {
        const err = e as PlanTocTrustError;
        return err.code === PLAN_TOC_NOT_FOUND && err.debug?.tocFound === false;
      }
    );
  });

  it("throws PLAN_TOC_TOO_SMALL when marker found but <3 sections", () => {
    const chunks = ["CONTENTS\n\nOnly one valid line here: EMERGENCY PROCEDURES 1"];
    assert.throws(
      () => extractTocSectionsOrThrow(chunks),
      (e) => {
        const err = e as PlanTocTrustError;
        return err.code === PLAN_TOC_TOO_SMALL && (err.debug?.acceptedCount ?? 0) < 3;
      }
    );
  });

  it("parses 'Internal Alert Notification Procedures 12' without truncating leading character (output starts with Internal)", () => {
    const chunks = [
      "TABLE OF CONTENTS\n\n" +
        "1. Introduction .......... 2\n" +
        "2. Internal Alert Notification Procedures 12\n" +
        "3. Training and Exercises .......... 15\n" +
        "4. Evacuation Routes .......... 18\n" +
        "5. Communications .......... 20",
    ];
    const { sections } = extractTocSectionsOrThrow(chunks);
    const internalEntry = sections.find(
      (s) =>
        s.section_title.includes("Internal Alert") ||
        s.section_title.includes("Internal") ||
        s.section_title.includes("Alert Notification")
    );
    assert.ok(internalEntry != null, "expected an entry derived from 'Internal Alert Notification Procedures 12'");
    assert.ok(
      internalEntry!.section_title.startsWith("Internal"),
      `title must start with 'Internal', got: ${JSON.stringify(internalEntry!.section_title)} (no leading character truncation)`
    );
  });
});
