/**
 * Value Objects - Immutable objects defined by their attributes
 * These represent values in the domain that don't have identity
 */

// ============================================================
// TRANSACTION TYPE
// ============================================================

export type TransactionType = 'income' | 'expense';

export const TransactionTypes = {
  INCOME: 'income' as const,
  EXPENSE: 'expense' as const,
};

export function isTransactionType(value: string): value is TransactionType {
  return value === 'income' || value === 'expense';
}

// ============================================================
// REMINDER FREQUENCY
// ============================================================

export type ReminderFrequency = 'once' | 'daily' | 'weekly' | 'monthly' | 'yearly';

export const ReminderFrequencies: ReminderFrequency[] = [
  'once',
  'daily',
  'weekly',
  'monthly',
  'yearly',
];

export function isReminderFrequency(value: string): value is ReminderFrequency {
  return ReminderFrequencies.includes(value as ReminderFrequency);
}

// ============================================================
// MONEY VALUE OBJECT
// ============================================================

export interface Money {
  amount: number;
  currency: string;
}

export const Money = {
  create(amount: number, currency: string = 'IDR'): Money {
    return {
      amount: Math.round(amount * 100) / 100, // Round to 2 decimal places
      currency,
    };
  },

  add(a: Money, b: Money): Money {
    if (a.currency !== b.currency) {
      throw new Error('Cannot add money with different currencies');
    }
    return {
      amount: a.amount + b.amount,
      currency: a.currency,
    };
  },

  subtract(a: Money, b: Money): Money {
    if (a.currency !== b.currency) {
      throw new Error('Cannot subtract money with different currencies');
    }
    return {
      amount: a.amount - b.amount,
      currency: a.currency,
    };
  },

  format(money: Money): string {
    return `${money.currency} ${money.amount.toLocaleString('id-ID')}`;
  },

  formatIDR(amount: number): string {
    return `IDR ${Math.abs(amount).toLocaleString('id-ID')}`;
  },

  isPositive(money: Money): boolean {
    return money.amount > 0;
  },

  isNegative(money: Money): boolean {
    return money.amount < 0;
  },

  zero(currency: string = 'IDR'): Money {
    return { amount: 0, currency };
  },
};

// ============================================================
// DATE RANGE VALUE OBJECT
// ============================================================

export interface DateRange {
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
}

export const DateRange = {
  create(start: string, end: string): DateRange {
    return { start, end };
  },

  today(): DateRange {
    const today = new Date().toISOString().split('T')[0];
    return { start: today, end: today };
  },

  thisWeek(): DateRange {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - dayOfWeek);
    const endOfWeek = new Date(now);
    endOfWeek.setDate(now.getDate() + (6 - dayOfWeek));

    return {
      start: startOfWeek.toISOString().split('T')[0],
      end: endOfWeek.toISOString().split('T')[0],
    };
  },

  thisMonth(): DateRange {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    return {
      start: startOfMonth.toISOString().split('T')[0],
      end: endOfMonth.toISOString().split('T')[0],
    };
  },

  lastNDays(n: number): DateRange {
    const now = new Date();
    const end = now.toISOString().split('T')[0];
    const start = new Date(now);
    start.setDate(now.getDate() - n);

    return {
      start: start.toISOString().split('T')[0],
      end,
    };
  },

  contains(range: DateRange, date: string): boolean {
    return date >= range.start && date <= range.end;
  },

  isValid(range: DateRange): boolean {
    return range.start <= range.end;
  },
};

// ============================================================
// PERCENTAGE VALUE OBJECT
// ============================================================

export interface Percentage {
  value: number;
}

export const Percentage = {
  create(value: number): Percentage {
    return { value: Math.max(0, Math.min(100, value)) };
  },

  fromFraction(numerator: number, denominator: number): Percentage {
    if (denominator === 0) return { value: 0 };
    return { value: Math.round((numerator / denominator) * 100) };
  },

  format(percentage: Percentage): string {
    return `${percentage.value}%`;
  },

  isOverBudget(percentage: Percentage): boolean {
    return percentage.value > 100;
  },
};

// ============================================================
// ID VALUE OBJECT
// ============================================================

export interface ValidId {
  value: string;
}

export const ValidId = {
  create(id: string, maxLength: number = 128): ValidId | null {
    const trimmed = id.trim();
    if (trimmed.length === 0 || trimmed.length > maxLength) {
      return null;
    }
    // Allow alphanumeric, underscore, and hyphen
    if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
      return null;
    }
    return { value: trimmed };
  },

  isValid(id: string, maxLength: number = 128): boolean {
    return this.create(id, maxLength) !== null;
  },
};

// ============================================================
// FILTER VALUE OBJECT
// ============================================================

export interface TransactionFilter {
  dateFrom?: string;
  dateTo?: string;
  category?: string;
  type?: 'all' | TransactionType;
}

export function createEmptyFilter(): TransactionFilter {
  return {
    dateFrom: undefined,
    dateTo: undefined,
    category: undefined,
    type: 'all',
  };
}