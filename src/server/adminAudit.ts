import { query } from "./db.js";

export async function writeAdminAudit(
  actorUserId: string,
  action: string,
  targetType?: string,
  targetId?: string,
  metadata: Record<string, unknown> = {}
) {
  await query(
    `insert into admin_audit_logs (actor_user_id, action, target_type, target_id, metadata)
     values ($1, $2, $3, $4, $5)`,
    [actorUserId, action, targetType ?? null, targetId ?? null, metadata]
  );
}
