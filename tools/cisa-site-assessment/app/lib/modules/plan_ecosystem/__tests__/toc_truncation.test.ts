/**
 * Regression tests: TOC/outline parser must never drop the first character of a section title
 * (e.g. "Internal..." must not become "ternal...").
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { cleanTocLine, extractTocSectionsOrThrow } from "../extract_plan_toc";

describe("TOC title truncation (no leading character drop)", () => {
  it('"Internal Alert Notification Procedures 12" => title starts with "I", no "ternal"', () => {
    const result = cleanTocLine("Internal Alert Notification Procedures 12");
    assert.ok(result.title != null, "expected a title");
    assert.strictEqual(
      result.title!.charAt(0),
      "I",
      `title must start with "I", got: ${JSON.stringify(result.title)}`
    );
    assert.strictEqual(
      result.title,
      "Internal Alert Notification Procedures",
      "trailing page token 12 must be stripped; title must not be truncated"
    );
    assert.ok(!result.title!.startsWith("ternal"), '"ternal" must never appear (leading char was dropped)');
  });

  it('"Internal Alert Notification Procedures .......... 12" => same title (dot leaders + page)', () => {
    const result = cleanTocLine("Internal Alert Notification Procedures .......... 12");
    assert.ok(result.title != null, "expected a title");
    assert.strictEqual(result.title!.charAt(0), "I", "title must start with I");
    assert.strictEqual(
      result.title,
      "Internal Alert Notification Procedures",
      "dot leaders and page number must be stripped"
    );
    assert.ok(!result.title!.startsWith("ternal"), "no leading truncation");
  });

  it('"External Alert Notification Procedures 13" => "External Alert Notification Procedures"', () => {
    const result = cleanTocLine("External Alert Notification Procedures 13");
    assert.ok(result.title != null, "expected a title");
    assert.strictEqual(result.title!.charAt(0), "E", "title must start with E");
    assert.strictEqual(
      result.title,
      "External Alert Notification Procedures",
      "trailing 13 must be stripped"
    );
  });

  it("extractTocSectionsOrThrow: section from 'Internal Alert... 12' line has title starting with I", () => {
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
    assert.ok(internalEntry != null, "expected an entry from Internal Alert Notification Procedures 12");
    assert.strictEqual(
      internalEntry!.section_title.charAt(0),
      "I",
      `section_title must start with "I", got: ${JSON.stringify(internalEntry!.section_title)}`
    );
    assert.ok(
      !internalEntry!.section_title.startsWith("ternal"),
      '"ternal" must never appear (regression: first character dropped)'
    );
  });
});
