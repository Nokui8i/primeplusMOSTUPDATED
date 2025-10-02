import { getFirestore } from 'firebase-admin/firestore';

export interface AuditLogEntry {
  action: string;
  userId: string;
  previousRole?: string;
  newRole?: string;
  performedBy: string;
  reason?: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export async function logAuditEvent(entry: AuditLogEntry): Promise<void> {
  const db = getFirestore();
  try {
    await db.collection('auditLogs').add({
      ...entry,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error logging audit event:', error);
    // Don't throw - we don't want audit logging failures to break the main functionality
  }
}

export async function getAuditLogs(
  userId?: string,
  action?: string,
  startDate?: Date,
  endDate?: Date,
  limit: number = 100
): Promise<AuditLogEntry[]> {
  const db = getFirestore();
  let query = db.collection('auditLogs').orderBy('timestamp', 'desc').limit(limit);

  if (userId) {
    query = query.where('userId', '==', userId);
  }
  if (action) {
    query = query.where('action', '==', action);
  }
  if (startDate) {
    query = query.where('timestamp', '>=', startDate.toISOString());
  }
  if (endDate) {
    query = query.where('timestamp', '<=', endDate.toISOString());
  }

  const snapshot = await query.get();
  return snapshot.docs.map(doc => doc.data() as AuditLogEntry);
} 