/**
 * Module Import Validation Tests
 * 
 * Tests for mandatory validators:
 * - Discipline ownership validation
 * - Event trigger validation
 * - Risk driver normalization & deduplication
 */

import { validateDisciplineOwnership } from "../app/lib/admin/module_validators/discipline_ownership_validator";
import { validateEventTriggers } from "../app/lib/admin/module_validators/event_trigger_validator";
import { validateRiskDrivers } from "../app/lib/admin/module_validators/risk_driver_validator";
import type { ModuleQuestion } from "../app/lib/admin/module_import_v2";
import type { RiskDriver } from "../app/lib/admin/module_validators/risk_driver_validator";

// Mock UUIDs for testing (these would need to match actual database values in real tests)
const MOCK_ACS_DISCIPLINE_ID = "00000000-0000-0000-0000-000000000001";
const MOCK_VSS_DISCIPLINE_ID = "00000000-0000-0000-0000-000000000002";
const MOCK_EMR_DISCIPLINE_ID = "00000000-0000-0000-0000-000000000003";
const MOCK_SMG_DISCIPLINE_ID = "00000000-0000-0000-0000-000000000004";

const MOCK_ACS_SUBTYPE_ID = "10000000-0000-0000-0000-000000000001";
const MOCK_VSS_SUBTYPE_ID = "20000000-0000-0000-0000-000000000001";
const MOCK_EMR_SUBTYPE_ID = "30000000-0000-0000-0000-000000000001";
const MOCK_SMG_SUBTYPE_ID = "40000000-0000-0000-0000-000000000001";
const MOCK_CPTED_SUBTYPE_ID = "50000000-0000-0000-0000-000000000001"; // CPTED/Exterior Lighting

describe("Module Import Validation", () => {
  describe("Discipline Ownership Validator", () => {
    it("should FAIL when lighting question is assigned to VSS", async () => {
      const question: ModuleQuestion = {
        id: "MODULEQ_EV_CHARGING_003",
        text: "Is adequate lighting implemented at EV charging station locations?",
        order: 3,
        discipline_id: MOCK_VSS_DISCIPLINE_ID,
        discipline_subtype_id: MOCK_VSS_SUBTYPE_ID,
        asset_or_location: "EV charging station",
        event_trigger: "TAMPERING"
      };

      // Note: This test requires database access, so it may need to be mocked
      // In a real test environment, you would mock getRuntimePool() to return
      // appropriate discipline/subtype codes
      const result = await validateDisciplineOwnership([question]);
      
      // Expected: Should fail because lighting questions cannot be VSS
      // The actual error message format: "MODULEQ_EV_CHARGING_003: lighting-related questions must use CPTED / Exterior Lighting. Found: VSS / ..."
      expect(result.ok).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain("MODULEQ_EV_CHARGING_003");
      expect(result.errors[0]).toContain("lighting");
    });

    it("should FAIL when panic button question is assigned to EM&R incorrectly", async () => {
      // This test would check that panic/assistance questions must use EMR discipline
      // and appropriate subtype
      const question: ModuleQuestion = {
        id: "MODULEQ_TEST_001",
        text: "Is a user-accessible method provided to request assistance or report an emergency?",
        order: 1,
        discipline_id: MOCK_SMG_DISCIPLINE_ID, // Wrong discipline
        discipline_subtype_id: MOCK_SMG_SUBTYPE_ID,
        asset_or_location: "EV charging station",
        event_trigger: "OTHER"
      };

      const result = await validateDisciplineOwnership([question]);
      
      expect(result.ok).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain("MODULEQ_TEST_001");
    });

    it("should PASS for correct EV Charging module questions", async () => {
      // This would test with actual valid discipline/subtype UUIDs from the database
      // For now, this is a placeholder that shows the expected structure
      const questions: ModuleQuestion[] = [
        {
          id: "MODULEQ_EV_CHARGING_001",
          text: "Is physical access to EV charging equipment components restricted?",
          order: 1,
          discipline_id: MOCK_ACS_DISCIPLINE_ID,
          discipline_subtype_id: MOCK_ACS_SUBTYPE_ID,
          asset_or_location: "EV charging equipment",
          event_trigger: "TAMPERING"
        }
      ];

      // In a real test, mock the database to return correct discipline codes
      // const result = await validateDisciplineOwnership(questions);
      // expect(result.ok).toBe(true);
    });
  });

  describe("Event Trigger Validator", () => {
    it("should FAIL when access question has wrong event trigger", () => {
      const question: ModuleQuestion = {
        id: "MODULEQ_TEST_002",
        text: "Is physical access to EV charging equipment components restricted?",
        order: 1,
        discipline_id: MOCK_ACS_DISCIPLINE_ID,
        discipline_subtype_id: MOCK_ACS_SUBTYPE_ID,
        asset_or_location: "EV charging equipment",
        event_trigger: "FIRE" // Wrong - should be TAMPERING
      };

      const result = validateEventTriggers([question]);
      
      expect(result.ok).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain("MODULEQ_TEST_002");
      expect(result.errors[0]).toContain("TAMPERING");
    });

    it("should FAIL when panic/assistance question has wrong event trigger", () => {
      const question: ModuleQuestion = {
        id: "MODULEQ_TEST_003",
        text: "Is a user-accessible method provided to request assistance?",
        order: 1,
        discipline_id: MOCK_EMR_DISCIPLINE_ID,
        discipline_subtype_id: MOCK_EMR_SUBTYPE_ID,
        asset_or_location: "EV charging station",
        event_trigger: "TAMPERING" // Wrong - should be OTHER
      };

      const result = validateEventTriggers([question]);
      
      expect(result.ok).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should PASS for correct event triggers", () => {
      const questions: ModuleQuestion[] = [
        {
          id: "MODULEQ_EV_CHARGING_001",
          text: "Is physical access to EV charging equipment components restricted?",
          order: 1,
          discipline_id: MOCK_ACS_DISCIPLINE_ID,
          discipline_subtype_id: MOCK_ACS_SUBTYPE_ID,
          asset_or_location: "EV charging equipment",
          event_trigger: "TAMPERING" // Correct
        },
        {
          id: "MODULEQ_EV_CHARGING_004",
          text: "Is a user-accessible method provided to request assistance?",
          order: 4,
          discipline_id: MOCK_EMR_DISCIPLINE_ID,
          discipline_subtype_id: MOCK_EMR_SUBTYPE_ID,
          asset_or_location: "EV charging station",
          event_trigger: "OTHER" // Correct
        }
      ];

      const result = validateEventTriggers(questions);
      expect(result.ok).toBe(true);
    });
  });

  describe("Risk Driver Validator", () => {
    it("should FAIL on duplicate cyber drivers", () => {
      const drivers: RiskDriver[] = [
        {
          driver_type: "CYBER_DRIVER",
          driver_text: "Unauthorized access to EV charging systems may enable physical tampering."
        },
        {
          driver_type: "CYBER_DRIVER",
          driver_text: "Unauthorized access to EV charging systems may enable physical tampering.", // Duplicate
          source_locator: {
            vulnerability: "Unauthorized Access",
            vulnerability_index: 0
          }
        }
      ];

      const result = validateRiskDrivers(drivers);
      
      expect(result.ok).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain("Duplicate risk driver");
    });

    it("should FAIL on multiple drivers per vulnerability", () => {
      const drivers: RiskDriver[] = [
        {
          driver_type: "CYBER_DRIVER",
          driver_text: "Unauthorized access may enable tampering.",
          source_locator: {
            vulnerability: "Unauthorized Access",
            vulnerability_index: 0
          }
        },
        {
          driver_type: "CYBER_DRIVER",
          driver_text: "Unauthorized access may cause safety issues.",
          source_locator: {
            vulnerability: "Unauthorized Access", // Same vulnerability
            vulnerability_index: 0
          }
        }
      ];

      const result = validateRiskDrivers(drivers);
      
      expect(result.ok).toBe(false);
      expect(result.errors.some(e => e.includes("Multiple drivers") && e.includes("Unauthorized Access"))).toBe(true);
    });

    it("should FAIL on garbage concatenation", () => {
      const drivers: RiskDriver[] = [
        {
          driver_type: "CYBER_DRIVER",
          driver_text: "Implement encryption, Install 2FA, Conduct security audit, Deploy monitoring" // Garbage list
        }
      ];

      const result = validateRiskDrivers(drivers);
      
      expect(result.ok).toBe(false);
      expect(result.errors.some(e => e.includes("garbage concatenation") || e.includes("single initiating cause"))).toBe(true);
    });

    it("should PASS for correct EV Charging module risk drivers", () => {
      const drivers: RiskDriver[] = [
        {
          driver_type: "CYBER_DRIVER",
          driver_text: "Unauthorized access to EV charging systems may enable physical tampering or unsafe conditions at charging stations."
        },
        {
          driver_type: "FRAUD_DRIVER",
          driver_text: "Payment skimming or data theft at EV charging stations may increase criminal targeting of charging locations and associated users."
        }
      ];

      const result = validateRiskDrivers(drivers);
      
      expect(result.ok).toBe(true);
      expect(result.normalized_drivers.length).toBe(2);
    });
  });
});
