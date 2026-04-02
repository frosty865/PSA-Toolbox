"use client";

import Link from "next/link";

export default function ModuleImportHelpPage() {
  return (
    <div style={{ padding: 24, maxWidth: 1200 }}>
      <div style={{ marginBottom: 16, display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
        <Link href="/admin/modules/import" style={{ color: "#0066cc" }}>
          ← Back to Import
        </Link>
        <Link
          href="/admin/modules/import/builder"
          style={{
            padding: "8px 16px",
            backgroundColor: "#1a4480",
            color: "white",
            textDecoration: "none",
            borderRadius: 4,
            fontSize: "14px",
          }}
        >
          Open JSON builder
        </Link>
      </div>

      <h1>Module Import Guide</h1>

      <section style={{ marginTop: 32 }}>
        <h2>Overview</h2>
        <p>
          Modules are <strong>additive content bundles</strong> that extend the baseline PSA assessment 
          with technology-specific or situation-specific questions and recommendations. Modules are 
          completely independent of baseline content.
        </p>
        <p style={{ marginTop: 12 }}>
          To avoid hand-editing UUIDs and IDs, use the{" "}
          <Link href="/admin/modules/import/builder" style={{ color: "#0066cc", fontWeight: 600 }}>
            module import JSON builder
          </Link>
          {" "}
          (discipline/subtype pickers, auto-generated <code>MODULEQ_*</code> / <code>MOD_OFC_*</code> IDs, then copy or open on the Import page).
        </p>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2>Key Principles</h2>
        <ul>
          <li><strong>Modules are additive</strong>: Module questions and OFCs are NOT baseline. They are stored in module-owned tables and displayed only when the module is attached to an assessment.</li>
          <li><strong>No baseline references</strong>: Module content must NOT link to baseline question IDs (<code>BASE-*</code>) or baseline OFCs.</li>
          <li><strong>Technology/situation dependent</strong>: Module questions must be specific to a technology or situation, not generic &quot;supports physical security&quot; phrasing.</li>
          <li><strong>PSA scope only</strong>: Module content must focus on physical security. Cyber controls (encryption, 2FA, authentication) do NOT become module questions or OFCs—they are stored as risk drivers (context only).</li>
        </ul>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2>Required Fields</h2>
        <pre style={{ backgroundColor: "#f5f5f5", padding: 16, borderRadius: 4, overflow: "auto" }}>
{`{
  "module_code": "MODULE_EXAMPLE",
  "title": "Example Module Title",
  "module_questions": [],
  "module_ofcs": []
}`}
        </pre>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2>Module Questions</h2>
        
        <h3>Requirements</h3>
        <ul>
          <li><strong>Question ID</strong>: Must follow pattern <code>MODULEQ_&lt;MODULE_CODE&gt;_###</code> (e.g., <code>MODULEQ_EV_CHARGING_001</code>)</li>
          <li><strong>Question Text</strong>: Must be non-generic, technology/situation specific</li>
          <li><strong>Discipline/Subtype</strong>: Must match semantic content (validated automatically)</li>
          <li><strong>Event Trigger</strong>: Must match semantic content (validated automatically)</li>
          <li><strong>Asset/Location</strong>: Required, non-empty string</li>
        </ul>

        <h3>Getting Discipline/Subtype UUIDs</h3>
        <p>
          Run the helper script to get valid UUIDs:
        </p>
        <pre style={{ backgroundColor: "#f5f5f5", padding: 16, borderRadius: 4 }}>
{`node scripts/get_discipline_uuids_for_modules.js`}
        </pre>

        <h3>Discipline Assignment Rules</h3>
        <p>The system validates that questions are assigned to appropriate disciplines based on semantic keywords:</p>
        <ul>
          <li><strong>Lighting questions</strong> → Cannot be VSS (Video Surveillance). Should use CPTED/Exterior Lighting subtypes.</li>
          <li><strong>Camera/video questions</strong> → Must be VSS (Video Surveillance Systems)</li>
          <li><strong>Panic/assistance questions</strong> → Must be EMR (Emergency Management & Resilience)</li>
          <li><strong>Procedure/coordination questions</strong> → Must be SMG (Security Management & Governance)</li>
          <li><strong>Access questions</strong> → Must be ACS (Access Control Systems)</li>
        </ul>

        <h3>Event Trigger Rules</h3>
        <ul>
          <li><strong>TAMPERING</strong>: Required for access, inspection, hardware, lighting/visibility questions</li>
          <li><strong>OTHER</strong>: Required for panic, duress, assistance, emergency questions</li>
          <li><strong>OUTAGE</strong>: Required for recovery, restoration, continuity questions</li>
          <li><strong>FIRE</strong>: For fire-related questions</li>
          <li><strong>IMPACT</strong>: For impact-related questions</li>
        </ul>

        <h3>Example Question</h3>
        <pre style={{ backgroundColor: "#f5f5f5", padding: 16, borderRadius: 4, overflow: "auto" }}>
{`{
  "id": "MODULEQ_EV_CHARGING_001",
  "text": "Is physical access to EV charging equipment components restricted to authorized personnel?",
  "order": 1,
  "discipline_id": "18d45ffa-6a44-4817-becb-828231b9e1e7",
  "discipline_subtype_id": "3227ab36-7f31-4be4-a0c2-0f838518fa96",
  "asset_or_location": "EV charging equipment components",
  "event_trigger": "TAMPERING"
}`}
        </pre>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2>Module OFCs</h2>
        
        <h3>Requirements</h3>
        <ul>
          <li><strong>OFC ID</strong>: Must follow pattern <code>MOD_OFC_&lt;MODULE_CODE&gt;_###</code> (e.g., <code>MOD_OFC_EV_CHARGING_001</code>)</li>
          <li><strong>OFC Text</strong>: Must be physical security focused (no cyber controls)</li>
          <li><strong>Sources</strong>: Optional but recommended for traceability</li>
        </ul>

        <h3>OFC Text Rules</h3>
        <ul>
          <li>Must describe physical security measures</li>
          <li>Cyber controls (encryption, 2FA, authentication, network monitoring) are NOT allowed</li>
          <li>Should be specific and actionable</li>
        </ul>

        <h3>Example OFC</h3>
        <pre style={{ backgroundColor: "#f5f5f5", padding: 16, borderRadius: 4, overflow: "auto" }}>
{`{
  "ofc_id": "MOD_OFC_EV_CHARGING_001",
  "ofc_text": "Consider implementing adequate lighting at EV charging station locations to reduce opportunities for vandalism and theft.",
  "order_index": 1,
  "sources": [
    {
      "url": "",
      "label": "Source Document Title (Author, Date)"
    }
  ]
}`}
        </pre>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2>Risk Drivers</h2>
        
        <p>
          Risk drivers provide context about cyber/fraud vulnerabilities that may impact physical security. 
          They are <strong>read-only context</strong> and never become questions or OFCs.
        </p>

        <h3>Requirements</h3>
        <ul>
          <li><strong>Driver Type</strong>: Either <code>&quot;CYBER_DRIVER&quot;</code> or <code>&quot;FRAUD_DRIVER&quot;</code></li>
          <li><strong>Driver Text</strong>: Must describe a single initiating cause with physical-security impact</li>
          <li><strong>One per vulnerability</strong>: Only one driver per vulnerability per type is allowed</li>
        </ul>

        <h3>Example Risk Drivers</h3>
        <pre style={{ backgroundColor: "#f5f5f5", padding: 16, borderRadius: 4, overflow: "auto" }}>
{`{
  "risk_drivers": [
    {
      "driver_type": "CYBER_DRIVER",
      "driver_text": "Unauthorized access to EV charging systems may enable physical tampering or unsafe conditions at charging stations."
    },
    {
      "driver_type": "FRAUD_DRIVER",
      "driver_text": "Payment skimming or data theft at EV charging stations may increase criminal targeting of charging locations and associated users."
    }
  ]
}`}
        </pre>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2>Common Mistakes</h2>
        <ul>
          <li><strong>Using baseline question IDs</strong>: Module questions must use <code>MODULEQ_*</code> IDs, not <code>BASE-*</code></li>
          <li><strong>Generic question text</strong>: Questions must be specific and technology/situation dependent</li>
          <li><strong>Wrong discipline assignment</strong>: Lighting questions assigned to VSS, panic questions assigned to wrong discipline</li>
          <li><strong>Cyber controls in OFCs</strong>: OFCs must be physical security only</li>
          <li><strong>Duplicate risk drivers</strong>: Only one driver per vulnerability per type</li>
          <li><strong>Missing required fields</strong>: All question fields (discipline_id, subtype_id, asset_or_location, event_trigger) are required</li>
        </ul>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2>Complete Example Template</h2>
        <p>
          Copy this template and fill in your module details:
        </p>
        <pre style={{ backgroundColor: "#f5f5f5", padding: 16, borderRadius: 4, overflow: "auto", maxHeight: "600px" }}>
{`{
  "module_code": "MODULE_EXAMPLE",
  "title": "Example Module",
  "description": "Example module demonstrating the required structure",
  "import_source": "example_module_import.json",
  "mode": "REPLACE",
  "module_questions": [
    {
      "id": "MODULEQ_EXAMPLE_001",
      "text": "Is physical access to [specific asset] restricted to authorized personnel?",
      "order": 1,
      "discipline_id": "00000000-0000-0000-0000-000000000000",
      "discipline_subtype_id": "00000000-0000-0000-0000-000000000000",
      "asset_or_location": "Specific asset or location",
      "event_trigger": "TAMPERING"
    },
    {
      "id": "MODULEQ_EXAMPLE_002",
      "text": "Is video coverage implemented for [specific location] to support incident detection?",
      "order": 2,
      "discipline_id": "00000000-0000-0000-0000-000000000000",
      "discipline_subtype_id": "00000000-0000-0000-0000-000000000000",
      "asset_or_location": "Specific location",
      "event_trigger": "TAMPERING"
    },
    {
      "id": "MODULEQ_EXAMPLE_003",
      "text": "Is a user-accessible method provided to request assistance or report an emergency?",
      "order": 3,
      "discipline_id": "00000000-0000-0000-0000-000000000000",
      "discipline_subtype_id": "00000000-0000-0000-0000-000000000000",
      "asset_or_location": "Specific location",
      "event_trigger": "OTHER"
    }
  ],
  "module_ofcs": [
    {
      "ofc_id": "MOD_OFC_EXAMPLE_001",
      "ofc_text": "Consider implementing [specific physical security measure] at [location] to [achieve outcome].",
      "order_index": 1,
      "sources": [
        {
          "url": "https://example.com/source.pdf",
          "label": "Source Document Title (Author, Date)"
        }
      ]
    },
    {
      "ofc_id": "MOD_OFC_EXAMPLE_002",
      "ofc_text": "An option for consideration is [specific measure] to [achieve outcome].",
      "order_index": 2,
      "sources": []
    }
  ],
  "risk_drivers": [
    {
      "driver_type": "CYBER_DRIVER",
      "driver_text": "Unauthorized access to [system] may enable physical tampering or unsafe conditions at [location]."
    },
    {
      "driver_type": "FRAUD_DRIVER",
      "driver_text": "Payment skimming or data theft at [location] may increase criminal targeting of [location] and associated users."
    }
  ]
}`}
        </pre>
        <p style={{ marginTop: 16 }}>
          <strong>Note:</strong> Replace all placeholder UUIDs with actual discipline/subtype UUIDs from your database. 
          Use <code>node scripts/get_discipline_uuids_for_modules.js</code> to get valid UUIDs.
        </p>
      </section>

      <div style={{ marginTop: 32, padding: 16, backgroundColor: "#e7f3ff", border: "1px solid #b3d9ff", borderRadius: 4 }}>
        <strong>💡 Tip:</strong> The import system will show detailed validation errors if your JSON doesn&apos;t meet the requirements. 
        Review the errors carefully—they indicate exactly what needs to be fixed.
      </div>

      <section style={{ marginTop: 32 }}>
        <h2>Real-Time Validation & Auto-Fix</h2>
        <p>
          The import page includes <strong>real-time validation</strong> that highlights errors as you paste or type your JSON.
          Common mistakes are automatically detected and suggestions are provided.
        </p>
        <ul>
          <li><strong>Invalid event triggers</strong> (e.g., &quot;THEFT&quot;, &quot;SAFETY_EVENT&quot;) → Auto-fixable</li>
          <li><strong>Invalid risk driver types</strong> (e.g., &quot;HACKING&quot;, &quot;PROPERTY_CRIME&quot;) → Auto-fixable</li>
          <li><strong>Wrong ID prefixes</strong> (BASE-*, IST_OFC_*) → Auto-fixable</li>
          <li><strong>Placeholder UUIDs</strong> → Shows helpful message with command to get real UUIDs</li>
          <li><strong>Missing required fields</strong> → Clear error messages</li>
        </ul>
        <p>
          Click the <strong>&quot;🔧 Auto-Fix Issues&quot;</strong> button to automatically correct fixable errors.
        </p>
        <p>
          <strong>CLI Tool:</strong> You can also validate JSON files from the command line (use &quot;validate_module_json&quot;):
        </p>
        <pre style={{ backgroundColor: "#f5f5f5", padding: 16, borderRadius: 4 }}>
{`node tools/validate_module_json.js module.json
node tools/validate_module_json.js module.json --fix --output module_fixed.json`}
        </pre>
      </section>
    </div>
  );
}
