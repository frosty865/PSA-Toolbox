/**
 * Test suite for buildCurveDeterministic refactoring
 * Run: node test-curve-logic.mjs
 */

// Replicate the curve logic inline for testing
function clamp(value, min, max) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function buildCurveDeterministic(input) {
  const points = [];

  const T_impact = input.time_to_impact_hours ?? 0;
  const L_no = (input.loss_fraction_no_backup ?? 0) * 100;
  const L_with = (input.loss_fraction_with_backup ?? 0) * 100;
  const T_backup = input.backup_duration_hours ?? 0;
  const T_recovery = input.recovery_time_hours ?? 0;
  
  const hasBackup = (input.has_backup_any ?? input.has_backup) === true;
  const DEFAULT_OUTAGE_HOURS = 72;
  const T_outage = input.outage_duration_hours ?? DEFAULT_OUTAGE_HOURS;

  if (!input.requires_service) {
    points.push({
      t_hours: 0,
      capacity_without_backup: 100,
      capacity_with_backup: 100,
    });
    return points;
  }

  const T_backup_end = T_impact + T_backup;
  const T_recovery_start = T_outage;
  const T_recovery_end = T_recovery_start + T_recovery;
  const T_max = T_recovery_end;

  function lossWithoutBackupAtTime(t) {
    if (t < T_impact) {
      return 0;
    } else if (t < T_recovery_start) {
      return L_no;
    } else if (t < T_recovery_end && T_recovery > 0) {
      const recoveryProgress = (t - T_recovery_start) / T_recovery;
      return L_no * (1 - recoveryProgress);
    } else {
      return 0;
    }
  }

  function lossWithBackupAtTime(t) {
    if (!hasBackup) {
      return lossWithoutBackupAtTime(t);
    }
    if (t < T_impact) {
      return 0;
    } else if (t <= T_backup_end) {
      return L_with;
    } else if (t < T_recovery_start) {
      return L_no;
    } else if (t < T_recovery_end && T_recovery > 0) {
      const recoveryProgress = (t - T_recovery_start) / T_recovery;
      return L_no * (1 - recoveryProgress);
    } else {
      return 0;
    }
  }

  const criticalTimes = new Set();
  criticalTimes.add(0);
  if (T_impact > 0) criticalTimes.add(T_impact);
  if (hasBackup && T_backup_end > T_impact) criticalTimes.add(T_backup_end);
  criticalTimes.add(T_recovery_start);
  if (T_recovery > 0) criticalTimes.add(T_recovery_end);
  criticalTimes.add(T_max);

  const sortedCritical = Array.from(criticalTimes).sort((a, b) => a - b);
  const seenTimes = new Set();

  for (let i = 0; i < sortedCritical.length - 1; i++) {
    const t_start = sortedCritical[i];
    const t_end = sortedCritical[i + 1];
    const span = t_end - t_start;
    const step = span > 20 ? 3 : 1;

    for (let t = t_start; t <= t_end; t += step) {
      if (seenTimes.has(t)) continue;
      seenTimes.add(t);

      const lossNo = lossWithoutBackupAtTime(t);
      const lossWith = lossWithBackupAtTime(t);

      const capNo = clamp(100 - lossNo, 0, 100);
      const capWith = clamp(100 - lossWith, 0, 100);

      points.push({
        t_hours: t,
        capacity_without_backup: capNo,
        capacity_with_backup: capWith,
      });
    }
  }

  return points;
}

// Test scenario from spec
console.log("🧪 Testing buildCurveDeterministic with spec scenario...\n");

const testInput = {
  requires_service: true,
  time_to_impact_hours: 4,
  loss_fraction_no_backup: 0.85,  // 85%
  has_backup_any: true,
  loss_fraction_with_backup: 0.25, // 25%
  backup_duration_hours: 24,
  recovery_time_hours: 4,
  outage_duration_hours: 72,
};

const curve = buildCurveDeterministic(testInput);

console.log(`Generated ${curve.length} curve points\n`);

// Test key phases
const phaseTests = [
  { t: 0, name: "T=0 (Initial)", expectedNoBackup: 100, expectedWithBackup: 100, tolerance: 0.5 },
  { t: 4, name: "T=4h (Impact)", expectedNoBackup: 15, expectedWithBackup: 75, tolerance: 0.5 },  // 100 - 85%, 100 - 25%
  { t: 28, name: "T=28h (Backup End)", expectedNoBackup: 15, expectedWithBackup: 15, tolerance: 1 }, // Both at 15% after backup expires
  { t: 72, name: "T=72h (Outage End / Recovery Start)", expectedNoBackup: 15, expectedWithBackup: 15, tolerance: 1 },
  { t: 74, name: "T=74h (Mid-Recovery)", expectedNoBackup: 57.5, expectedWithBackup: 57.5, tolerance: 1 }, // 50% recovered of 85%
  { t: 76, name: "T=76h (Recovery Complete)", expectedNoBackup: 100, expectedWithBackup: 100, tolerance: 0.5 },
];

console.log("📊 Phase Verification:");
phaseTests.forEach(({ t, name, expectedNoBackup, expectedWithBackup, tolerance }) => {
  const point = curve.find(p => Math.abs(p.t_hours - t) < 0.5);
  if (!point) {
    console.log(`  ⚠ ${name}: No point found near t=${t}`);
    return;
  }
  
  const noBackupMatch = Math.abs(point.capacity_without_backup - expectedNoBackup) <= tolerance;
  const withBackupMatch = Math.abs(point.capacity_with_backup - expectedWithBackup) <= tolerance;
  const status = noBackupMatch && withBackupMatch ? "✓" : "❌";
  
  console.log(`  ${status} ${name}: without=${point.capacity_without_backup.toFixed(1)}% (exp ${expectedNoBackup}%), with=${point.capacity_with_backup.toFixed(1)}% (exp ${expectedWithBackup}%)`);
});

// Critical assertion: with-backup >= without-backup during backup window (t=4 to t=28)
console.log("\n🔍 Invariant Check (with-backup ≥ without-backup during backup window):");
const backupWindowViolations = curve.filter(p => 
  p.t_hours > 4 && p.t_hours < 28 && 
  p.capacity_with_backup < p.capacity_without_backup - 0.01
);
if (backupWindowViolations.length === 0) {
  console.log("  ✓ No violations during backup window");
} else {
  console.log(`  ❌ ${backupWindowViolations.length} violations found:`);
  backupWindowViolations.forEach(p => {
    console.log(`     t=${p.t_hours}h: with=${p.capacity_with_backup}% < without=${p.capacity_without_backup}%`);
  });
}

// Check against old behavior (cliff to ~0)
console.log("\n🎯 Old Behavior Check (cliff to ~0 after backup end at t=28):");
const pointAt28 = curve.find(p => Math.abs(p.t_hours - 28) < 0.5);
const pointAt28_1 = curve.find(p => Math.abs(p.t_hours - 28.1) < 1);
if (pointAt28 && pointAt28.capacity_with_backup > 10) {
  console.log("  ✓ No cliff to ~0: capacity stays at degraded level after backup expires");
  console.log(`    At t=28h (backup end): capacity_with_backup=${pointAt28.capacity_with_backup.toFixed(1)}%`);
} else {
  console.log("  ❌ ISSUE: Cliff detected (capacity dropped to near 0 at backup end)");
}

console.log("\n✅ Test complete!");
