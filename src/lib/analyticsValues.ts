import { isValid, parseISO } from 'date-fns';
export function analyticsNumber(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}
export function analyticsDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !value) return null;
  const date = parseISO(value);
  return isValid(date) ? date : null;
}