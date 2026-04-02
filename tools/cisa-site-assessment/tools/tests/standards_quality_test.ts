#!/usr/bin/env npx tsx
import {
  validateStandard,
  parseAndValidateStandardFromModelText,
  measureStandardQuality,
  type PlanStandard,
} from "../../app/lib/ollama/standards_validator";
import { scoreStandardCandidate } from "../../app/lib/ollama/standards_generator";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function makeStrongPlanStandard(): PlanStandard {
  return {
    standard_type: "plan",
    standard_title: "Emergency Action Plan Governance and Execution",
    required_elements: [
      {
        element_title: "Program Governance and Ownership",
        criteria: [
          "Plan ownership role is documented with accountable position titles.",
          "Plan approval authority is identified and recorded in governing documentation.",
        ],
        evidence_examples: [
          "Signed governance charter identifying plan owner and approver roles.",
          "Current responsibility matrix showing EAP stewardship assignments.",
        ],
      },
      {
        element_title: "Threat and Hazard Context",
        criteria: [
          "Relevant threat scenarios are identified with documented planning assumptions.",
          "Hazard impact considerations are mapped to prioritized response objectives.",
        ],
        evidence_examples: [
          "Hazard identification worksheet linked to planning assumptions.",
          "Scenario impact summary used during planning sessions.",
        ],
      },
      {
        element_title: "Roles and Response Structure",
        criteria: [
          "Response roles are defined with clear decision and escalation responsibilities.",
          "Coordination responsibilities are documented for internal and external partners.",
        ],
        evidence_examples: [
          "Role cards showing decision authority boundaries.",
          "Interface matrix listing partner coordination responsibilities.",
        ],
      },
      {
        element_title: "Communication and Notification Procedures",
        criteria: [
          "Communication pathways are documented for alerting affected stakeholders.",
          "Notification content requirements are defined for incident messaging consistency.",
        ],
        evidence_examples: [
          "Approved communication workflow map for incident notifications.",
          "Message template library with required content fields.",
        ],
      },
      {
        element_title: "Protective Actions and Accountability",
        criteria: [
          "Protective action procedures describe movement, accountability, and control points.",
          "Accountability process identifies how personnel status is verified and tracked.",
        ],
        evidence_examples: [
          "Protective action annex describing movement and control checkpoints.",
          "Personnel accountability checklist used during exercises.",
        ],
      },
      {
        element_title: "Resource and Capability Mapping",
        criteria: [
          "Required response resources are mapped to responsible custodians.",
          "Capability gaps are documented with corresponding mitigation actions.",
        ],
        evidence_examples: [
          "Resource registry linking assets to custodial owners.",
          "Capability gap register with mitigation ownership assignments.",
        ],
      },
      {
        element_title: "Exercise and Validation Workflow",
        criteria: [
          "Validation activities are defined to test plan execution responsibilities.",
          "After-action findings are documented and linked to corrective plan updates.",
        ],
        evidence_examples: [
          "Exercise design package with role-based validation objectives.",
          "After-action report with tracked corrective actions.",
        ],
      },
      {
        element_title: "Version Control and Continuous Improvement",
        criteria: [
          "Plan change process is documented with traceable revision rationale.",
          "Revision records demonstrate closure of identified planning deficiencies.",
        ],
        evidence_examples: [
          "Revision log with rationale and approval metadata.",
          "Corrective action closure report tied to plan revisions.",
        ],
      },
    ],
  };
}

function makeDuplicateCriteriaPlan(): PlanStandard {
  const base = makeStrongPlanStandard();
  base.required_elements[0].criteria = [
    "Plan ownership role is documented with accountable position titles.",
    "Plan ownership role is documented with accountable position titles.",
  ];
  return base;
}

function makeLowDiversityPlan(): PlanStandard {
  const repeatedCriteria = [
    "Control process is documented for control process control operations.",
    "Control process is documented for control process control operations.",
  ];

  return {
    standard_type: "plan",
    standard_title: "Control Process Control Plan",
    required_elements: Array.from({ length: 8 }).map((_, i) => ({
      element_title: `Control Process Element ${i + 1}`,
      criteria: [...repeatedCriteria],
      evidence_examples: [
        "Control process record for control process control operations.",
        "Control process worksheet for control process control operations.",
      ],
    })),
  };
}

function main(): number {
  const opts = {
    forbidCadence: true,
    forbidImplementationDetails: true,
    forbidCyberConfig: false,
    forbidScenarioSpecific: false,
  };

  const strong = makeStrongPlanStandard();
  const strongFailures = validateStandard(strong, "plan", opts);
  assert(
    strongFailures.length === 0,
    `Expected strong plan to pass validation, got ${strongFailures.length} failure(s): ${JSON.stringify(strongFailures)}`
  );

  const wrapped = `Model output prefix\n${JSON.stringify(strong, null, 2)}\nModel output suffix`;
  const parsed = parseAndValidateStandardFromModelText(wrapped, "plan", opts);
  assert(parsed.ok, "Expected parser to extract and validate first JSON object.");

  const duplicatePlan = makeDuplicateCriteriaPlan();
  const duplicateFailures = validateStandard(duplicatePlan, "plan", opts);
  assert(
    duplicateFailures.some((f) => f.code === "DUPLICATE_CRITERIA"),
    "Expected duplicate criteria to trigger DUPLICATE_CRITERIA failure."
  );

  const lowDiversityPlan = makeLowDiversityPlan();
  const lowDiversityFailures = validateStandard(lowDiversityPlan, "plan", opts);
  assert(
    lowDiversityFailures.some((f) => f.code === "LOW_DIVERSITY"),
    "Expected repetitive plan to trigger LOW_DIVERSITY failure."
  );

  const strongScore = scoreStandardCandidate(strong);
  const weakScore = scoreStandardCandidate(lowDiversityPlan);
  assert(
    strongScore > weakScore,
    `Expected strong candidate score (${strongScore.toFixed(2)}) to be greater than weak candidate score (${weakScore.toFixed(2)}).`
  );

  const strongMetrics = measureStandardQuality(strong);
  const weakMetrics = measureStandardQuality(lowDiversityPlan);

  console.log("[test:standards-quality] Passed");
  console.log(
    `[test:standards-quality] strong diversity=${strongMetrics.lexicalDiversity.toFixed(2)} weak diversity=${weakMetrics.lexicalDiversity.toFixed(2)}`
  );
  console.log(
    `[test:standards-quality] strong score=${strongScore.toFixed(2)} weak score=${weakScore.toFixed(2)}`
  );
  return 0;
}

try {
  process.exit(main());
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[test:standards-quality] Failed: ${message}`);
  process.exit(1);
}
