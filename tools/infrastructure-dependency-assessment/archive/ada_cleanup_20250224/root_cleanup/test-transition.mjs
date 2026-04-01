// Quick transition test
const clamp = (v, min, max) => v < min ? min : v > max ? max : v;

const testInput = {
  requires_service: true,
  time_to_impact_hours: 4,
  loss_fraction_no_backup: 0.85,
  has_backup_any: true,
  loss_fraction_with_backup: 0.25,
  backup_duration_hours: 24,
  recovery_time_hours: 4,
  outage_duration_hours: 72,
};

const T_impact = 4;
const T_backup = 24;
const T_backup_end = T_impact + T_backup; // 28
const L_no = 85;
const L_with = 25;
const T_outage = 72;
const T_recovery_end = T_outage + 4; // 76

const lossWithBackup = (t) => {
  if (t < T_impact) return 0;
  else if (t <= T_backup_end) return L_with;
  else if (t < T_outage) return L_no;
  else if (t < T_recovery_end) return L_no * (1 - (t - T_outage) / 4);
  else return 0;
};

console.log("Backup expiration transition:");
for (let t = 26; t <= 34; t += 0.5) {
  const loss = lossWithBackup(t);
  const cap = clamp(100 - loss, 0, 100);
  const phase = t <= 28 ? "BACKUP ACTIVE" : t < 72 ? "DEGRADED" : "RECOVERY";
  console.log(`  t=${t.toFixed(1)}h: loss=${loss.toFixed(1)}%, capacity=${cap.toFixed(1)}% [${phase}]`);
}
