export interface SubscriptionAccessRecord {
  status: string;
  start_date: string;
  end_date: string;
  plan?: string;
}

/** Matches the existing date-based contract: end_date is the last included UTC day. */
export function subscriptionAccess(record: SubscriptionAccessRecord, today = new Date().toISOString().slice(0, 10)) {
  const inPeriod = record.start_date <= today && record.end_date >= today;
  const isActive = inPeriod && (record.status === 'trial' || record.status === 'active');
  return {
    isActive,
    isTrial: isActive && record.status === 'trial',
    isExpired: record.end_date < today || ['expired', 'cancelled', 'suspended'].includes(record.status),
  };
}