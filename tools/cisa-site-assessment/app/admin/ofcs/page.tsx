import { redirect } from "next/navigation";

/**
 * OFC Review (CORPUS Review Queue) has been moved to Assessment Management.
 * Redirect to the OFC Review tab.
 */
export default function AdminOFCQueuePage() {
  redirect("/admin/assessments?tab=ofc-review");
}
