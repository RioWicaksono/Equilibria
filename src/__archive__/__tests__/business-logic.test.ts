/**
 * Business Logic Unit Tests for Equilibria
 * Tests: balance calculation, category aggregation, transaction parsing, date utilities
 */

import { describe, it, expect, beforeEach } from '@jest/globals';

// ============================================================
// TYPES
// ============================================================

interface Transaction {
  id: string;
  userId: string;
  desc: string;
  category: string;
  amount: number;
  date: string;
  type: 'income' | 'expense';
  createdAt: number;
}

interface Reminder {
  id: string;
  userId: string;
  title: string;
  amount: number;
  frequency: 'once' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  nextDate: string;
  isActive: boolean;
  createdAt: number;
}

// ============================================================
// BUSINESS LOGIC FUNCTIONS (Pure Functions)
// These mirror the calculations used in App.tsx
// ============================================================

/**
 * Calculate total balance from transactions
 * Income adds positive, expense subtracts negative
 */
function calculateBalance(transactions: Transaction[]): number {
  return transactions.reduce((acc, tx) => acc + tx.amount, 0);
}

/**
 * Calculate total income from transactions
 */
function calculateTotalIncome(transactions: Transaction[]): number {
  return transactions
    .filter(t => t.type === 'income')
    .reduce((acc, t) => acc + t.amount, 0);
}

/**
 * Calculate total expense from transactions (returns positive number)
 */
function calculateTotalExpense(transactions: Transaction[]): number {
  return Math.abs(
    transactions
      .filter(t => t.type === 'expense')
      .reduce((acc, t) => acc + t.amount, 0)
  );
}

/**
 * Calculate spending per category for a given month
 */
function calculateSpendingByCategory(
  transactions: Transaction[],
  month: string // format: "2026-05"
): Map<string, number> {
  const spending = new Map<string, number>();

  transactions
    .filter(t => t.type === 'expense' && t.date.startsWith(month))
    .forEach(tx => {
      const current = spending.get(tx.category) || 0;
      spending.set(tx.category, current + Math.abs(tx.amount));
    });

  return spending;
}

/**
 * Calculate budget utilization percentage
 */
function calculateBudgetUtilization(
  budgetAmount: number,
  spentAmount: number
): { percentage: number; isOverBudget: boolean } {
  const percentage = budgetAmount > 0
    ? Math.min(100, Math.round((spentAmount / budgetAmount) * 100))
    : 0;
  return {
    percentage,
    isOverBudget: spentAmount > budgetAmount
  };
}

/**
 * Filter transactions by date range, category, and type
 */
function filterTransactions(
  transactions: Transaction[],
  filters: {
    dateFrom?: string;
    dateTo?: string;
    category?: string;
    type?: 'all' | 'income' | 'expense';
  }
): Transaction[] {
  return transactions.filter(tx => {
    if (filters.dateFrom && tx.date < filters.dateFrom) return false;
    if (filters.dateTo && tx.date > filters.dateTo) return false;
    if (filters.category && filters.category !== 'all' && tx.category !== filters.category) return false;
    if (filters.type && filters.type !== 'all' && tx.type !== filters.type) return false;
    return true;
  });
}

/**
 * Aggregate transactions by date for charting (last N days)
 */
function aggregateByDay(
  transactions: Transaction[],
  days: number = 7
): Array<{
  date: string;
  income: number;
  expense: number;
  label: string;
}> {
  const result: Array<{
    date: string;
    income: number;
    expense: number;
    label: string;
  }> = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const dayTxs = transactions.filter(t => t.date === dateStr);

    result.push({
      date: dateStr,
      income: dayTxs.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0),
      expense: Math.abs(dayTxs.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0)),
      label: d.toLocaleDateString('en-US', { weekday: 'short' })
    });
  }

  return result;
}

/**
 * Parse Telegram text input to transaction
 * Format: "[income|expense] <amount> <desc>"
 */
function parseTelegramInput(text: string): {
  type: 'income' | 'expense';
  amount: number;
  desc: string;
  category: string;
} | null {
  const parts = text.trim().split(/\s+/);
  if (parts.length < 2) return null;

  let type: 'income' | 'expense' = 'expense';
  let amountStr = parts[0];
  let descParts: string[] = parts.slice(1);

  if (parts[0].toLowerCase() === 'income') {
    if (parts.length < 3) return null;
    type = 'income';
    amountStr = parts[1];
    descParts = parts.slice(2);
  } else if (parts[0].toLowerCase() === 'expense') {
    if (parts.length < 3) return null;
    type = 'expense';
    amountStr = parts[1];
    descParts = parts.slice(2);
  }

  const amount = Number(amountStr.replace(/[^0-9]/g, ''));
  if (isNaN(amount) || amount <= 0) return null;

  return {
    type,
    amount,
    desc: descParts.join(' '),
    category: type === 'income' ? 'Income' : 'General'
  };
}

/**
 * Calculate next reminder date based on frequency
 */
function calculateNextDate(
  currentDate: string,
  frequency: 'once' | 'daily' | 'weekly' | 'monthly' | 'yearly'
): { nextDate: string; isActive: boolean } {
  const parts = currentDate.split('-');
  if (parts.length !== 3) return { nextDate: currentDate, isActive: false };

  const year = parseInt(parts[0]);
  const month = parseInt(parts[1]) - 1;
  const day = parseInt(parts[2]);
  const next = new Date(year, month, day);

  if (frequency === 'once') {
    return { nextDate: currentDate, isActive: false };
  }

  if (frequency === 'daily') next.setDate(next.getDate() + 1);
  else if (frequency === 'weekly') next.setDate(next.getDate() + 7);
  else if (frequency === 'monthly') next.setMonth(next.getMonth() + 1);
  else if (frequency === 'yearly') next.setFullYear(next.getFullYear() + 1);

  const yyyy = next.getFullYear();
  const mm = String(next.getMonth() + 1).padStart(2, '0');
  const dd = String(next.getDate()).padStart(2, '0');

  return {
    nextDate: `${yyyy}-${mm}-${dd}`,
    isActive: true
  };
}

/**
 * Check if a reminder date matches a given day
 */
function hasReminderOnDay(reminder: Reminder, day: Date): boolean {
  const parts = reminder.nextDate.split('-');
  if (parts.length !== 3) return false;
  return (
    parseInt(parts[2]) === day.getDate() &&
    parseInt(parts[1]) - 1 === day.getMonth() &&
    parseInt(parts[0]) === day.getFullYear()
  );
}

/**
 * Get unique sorted categories from transactions
 */
function getUniqueCategories(transactions: Transaction[]): string[] {
  return Array.from(new Set(transactions.map(tx => tx.category))).sort();
}

/**
 * Format amount as IDR currency string
 */
function formatIDR(amount: number): string {
  return `IDR ${Math.abs(amount).toLocaleString('id-ID')}`;
}

/**
 * Convert amount to Firestore format (negative for expense, positive for income)
 */
function normalizeAmount(amount: number, type: 'income' | 'expense'): number {
  return type === 'expense' ? -Math.abs(amount) : Math.abs(amount);
}

// ============================================================
// TEST SUITES
// ============================================================

const SAMPLE_TRANSACTIONS: Transaction[] = [
  { id: '1', userId: 'user1', desc: 'Salary', category: 'Income', amount: 5000000, date: '2026-05-01', type: 'income', createdAt: 1747555200000 },
  { id: '2', userId: 'user1', desc: 'Nasi Goreng', category: 'Food', amount: -25000, date: '2026-05-02', type: 'expense', createdAt: 1747641600000 },
  { id: '3', userId: 'user1', desc: 'Grab', category: 'Transport', amount: -15000, date: '2026-05-02', type: 'expense', createdAt: 1747641700000 },
  { id: '4', userId: 'user1', desc: 'Freelance', category: 'Income', amount: 1000000, date: '2026-05-03', type: 'income', createdAt: 1747728000000 },
  { id: '5', userId: 'user1', desc: 'Groceries', category: 'Food', amount: -150000, date: '2026-05-05', type: 'expense', createdAt: 1747814400000 },
  { id: '6', userId: 'user1', desc: 'Coffee', category: 'Food', amount: -20000, date: '2026-05-05', type: 'expense', createdAt: 1747814500000 },
];

describe('Balance Calculations', () => {
  it('should calculate correct total balance', () => {
    // 5000000 + (-25000) + (-15000) + 1000000 + (-150000) + (-20000) = 5790000
    expect(calculateBalance(SAMPLE_TRANSACTIONS)).toBe(5790000);
  });

  it('should calculate correct total income', () => {
    expect(calculateTotalIncome(SAMPLE_TRANSACTIONS)).toBe(6000000);
  });

  it('should calculate correct total expense as positive', () => {
    expect(calculateTotalExpense(SAMPLE_TRANSACTIONS)).toBe(210000);
  });

  it('should return 0 for empty transactions', () => {
    expect(calculateBalance([])).toBe(0);
    expect(calculateTotalIncome([])).toBe(0);
    expect(calculateTotalExpense([])).toBe(0);
  });

  it('should handle only income transactions', () => {
    const incomeOnly = SAMPLE_TRANSACTIONS.filter(t => t.type === 'income');
    expect(calculateBalance(incomeOnly)).toBe(6000000);
    expect(calculateTotalExpense(incomeOnly)).toBe(0);
  });

  it('should handle only expense transactions', () => {
    const expenseOnly = SAMPLE_TRANSACTIONS.filter(t => t.type === 'expense');
    expect(calculateBalance(expenseOnly)).toBe(-210000);
    expect(calculateTotalIncome(expenseOnly)).toBe(0);
  });
});

describe('Category Aggregation', () => {
  it('should aggregate spending by category for a month', () => {
    const spending = calculateSpendingByCategory(SAMPLE_TRANSACTIONS, '2026-05');

    expect(spending.get('Food')).toBe(195000); // 25000 + 150000 + 20000
    expect(spending.get('Transport')).toBe(15000);
    expect(spending.get('Income')).toBeUndefined();
  });

  it('should return empty map for month with no expenses', () => {
    const spending = calculateSpendingByCategory(SAMPLE_TRANSACTIONS, '2026-04');
    expect(spending.size).toBe(0);
  });

  it('should get unique sorted categories', () => {
    const categories = getUniqueCategories(SAMPLE_TRANSACTIONS);
    expect(categories).toEqual(['Food', 'Income', 'Transport']);
  });

  it('should handle empty transactions for categories', () => {
    const categories = getUniqueCategories([]);
    expect(categories).toEqual([]);
  });
});

describe('Budget Utilization', () => {
  it('should calculate correct percentage', () => {
    const result = calculateBudgetUtilization(500000, 250000);
    expect(result.percentage).toBe(50);
    expect(result.isOverBudget).toBe(false);
  });

  it('should cap percentage at 100', () => {
    const result = calculateBudgetUtilization(500000, 600000);
    expect(result.percentage).toBe(100);
    expect(result.isOverBudget).toBe(true);
  });

  it('should handle zero budget', () => {
    const result = calculateBudgetUtilization(0, 100000);
    expect(result.percentage).toBe(0);
    expect(result.isOverBudget).toBe(true);
  });

  it('should handle zero spent', () => {
    const result = calculateBudgetUtilization(500000, 0);
    expect(result.percentage).toBe(0);
    expect(result.isOverBudget).toBe(false);
  });

  it('should round to nearest integer', () => {
    // Math.round(100001/300000*100) = Math.round(33.333...) = 33 in JS
    const result = calculateBudgetUtilization(300000, 100001);
    expect(result.percentage).toBe(33);
  });
});

describe('Transaction Filtering', () => {
  it('should filter by date range', () => {
    // Filter for 2026-05-02 to 2026-05-03 (inclusive)
    // Should include: id 2 (2026-05-02), id 3 (2026-05-02), id 4 (2026-05-03)
    const result = filterTransactions(SAMPLE_TRANSACTIONS, {
      dateFrom: '2026-05-02',
      dateTo: '2026-05-03'
    });
    expect(result.length).toBe(3);
  });

  it('should filter by category', () => {
    const result = filterTransactions(SAMPLE_TRANSACTIONS, {
      category: 'Food'
    });
    expect(result.length).toBe(3);
    expect(result.every(t => t.category === 'Food')).toBe(true);
  });

  it('should filter by type', () => {
    const income = filterTransactions(SAMPLE_TRANSACTIONS, { type: 'income' });
    expect(income.length).toBe(2);
    expect(income.every(t => t.type === 'income')).toBe(true);

    const expense = filterTransactions(SAMPLE_TRANSACTIONS, { type: 'expense' });
    expect(expense.length).toBe(4);
    expect(expense.every(t => t.type === 'expense')).toBe(true);
  });

  it('should combine multiple filters', () => {
    const result = filterTransactions(SAMPLE_TRANSACTIONS, {
      dateFrom: '2026-05-01',
      dateTo: '2026-05-05',
      category: 'Food',
      type: 'expense'
    });
    expect(result.length).toBe(3);
  });

  it('should return all when no filters applied', () => {
    const result = filterTransactions(SAMPLE_TRANSACTIONS, {});
    expect(result.length).toBe(SAMPLE_TRANSACTIONS.length);
  });

  it('should return empty for impossible filters', () => {
    const result = filterTransactions(SAMPLE_TRANSACTIONS, {
      dateFrom: '2026-06-01'
    });
    expect(result.length).toBe(0);
  });
});

describe('Date Aggregation', () => {
  it('should aggregate transactions by day for last N days', () => {
    // Test with a known set of transactions
    const result = aggregateByDay(SAMPLE_TRANSACTIONS, 7);
    expect(result).toHaveLength(7);

    // Verify structure - all days have labels and numeric values
    result.forEach(day => {
      expect(day.label).toBeDefined();
      expect(typeof day.income).toBe('number');
      expect(typeof day.expense).toBe('number');
    });
  });

  it('should handle empty transactions', () => {
    const result = aggregateByDay([], 7);
    expect(result).toHaveLength(7);
    result.forEach(day => {
      expect(day.income).toBe(0);
      expect(day.expense).toBe(0);
    });
  });
});

describe('Telegram Input Parsing', () => {
  it('should parse simple expense format', () => {
    const result = parseTelegramInput('50000 Nasi Goreng');
    expect(result).not.toBeNull();
    expect(result!.type).toBe('expense');
    expect(result!.amount).toBe(50000);
    expect(result!.desc).toBe('Nasi Goreng');
    expect(result!.category).toBe('General');
  });

  it('should parse income format with keyword', () => {
    const result = parseTelegramInput('income 2000000 Salary');
    expect(result).not.toBeNull();
    expect(result!.type).toBe('income');
    expect(result!.amount).toBe(2000000);
    expect(result!.desc).toBe('Salary');
  });

  it('should parse expense format with keyword', () => {
    const result = parseTelegramInput('expense 50000 Lunch');
    expect(result).not.toBeNull();
    expect(result!.type).toBe('expense');
    expect(result!.amount).toBe(50000);
    expect(result!.desc).toBe('Lunch');
  });

  it('should handle amount with commas', () => {
    const result = parseTelegramInput('150,000 Groceries');
    expect(result).not.toBeNull();
    expect(result!.amount).toBe(150000);
  });

  it('should return null for invalid input', () => {
    expect(parseTelegramInput('')).toBeNull();
    expect(parseTelegramInput('50000')).toBeNull(); // no description
    expect(parseTelegramInput('invalid')).toBeNull();
  });

  it('should handle amounts with leading minus sign (extracts digits)', () => {
    // Current behavior: extracts digits, so -50000 becomes 50000
    const result = parseTelegramInput('-50000 Something');
    expect(result).not.toBeNull();
    expect(result!.amount).toBe(50000);
    expect(result!.desc).toBe('Something');
  });

  it('should handle multi-word descriptions', () => {
    const result = parseTelegramInput('75000 Monthly Subscription Netflix Premium');
    expect(result).not.toBeNull();
    expect(result!.desc).toBe('Monthly Subscription Netflix Premium');
  });
});

describe('Reminder Date Calculation', () => {
  it('should calculate next date for weekly frequency', () => {
    const result = calculateNextDate('2026-05-18', 'weekly');
    expect(result.nextDate).toBe('2026-05-25');
    expect(result.isActive).toBe(true);
  });

  it('should calculate next date for monthly frequency', () => {
    const result = calculateNextDate('2026-05-18', 'monthly');
    expect(result.nextDate).toBe('2026-06-18');
    expect(result.isActive).toBe(true);
  });

  it('should calculate next date for yearly frequency', () => {
    const result = calculateNextDate('2026-05-18', 'yearly');
    expect(result.nextDate).toBe('2027-05-18');
    expect(result.isActive).toBe(true);
  });

  it('should handle once frequency (deactivates)', () => {
    const result = calculateNextDate('2026-05-18', 'once');
    expect(result.nextDate).toBe('2026-05-18');
    expect(result.isActive).toBe(false);
  });

  it('should calculate daily frequency correctly', () => {
    const result = calculateNextDate('2026-05-18', 'daily');
    expect(result.nextDate).toBe('2026-05-19');
    expect(result.isActive).toBe(true);
  });
});

describe('Reminder Day Matching', () => {
  const sampleReminder: Reminder = {
    id: '1',
    userId: 'user1',
    title: 'Netflix',
    amount: 150000,
    frequency: 'monthly',
    nextDate: '2026-05-18',
    isActive: true,
    createdAt: 1747555200000
  };

  it('should match correct day', () => {
    const day = new Date(2026, 4, 18); // May 18, 2026
    expect(hasReminderOnDay(sampleReminder, day)).toBe(true);
  });

  it('should not match different day', () => {
    const day = new Date(2026, 4, 19);
    expect(hasReminderOnDay(sampleReminder, day)).toBe(false);
  });

  it('should not match different month', () => {
    const day = new Date(2026, 3, 18); // April 18
    expect(hasReminderOnDay(sampleReminder, day)).toBe(false);
  });

  it('should handle invalid date format', () => {
    const badReminder: Reminder = { ...sampleReminder, nextDate: 'invalid' };
    const day = new Date(2026, 4, 18);
    expect(hasReminderOnDay(badReminder, day)).toBe(false);
  });
});

describe('Currency Formatting', () => {
  it('should format IDR correctly', () => {
    expect(formatIDR(50000)).toBe('IDR 50.000');
    expect(formatIDR(1000000)).toBe('IDR 1.000.000');
    expect(formatIDR(1234567)).toBe('IDR 1.234.567');
  });

  it('should format negative as positive', () => {
    expect(formatIDR(-50000)).toBe('IDR 50.000');
  });

  it('should format zero', () => {
    expect(formatIDR(0)).toBe('IDR 0');
  });
});

describe('Amount Normalization', () => {
  it('should make expense amounts negative', () => {
    expect(normalizeAmount(50000, 'expense')).toBe(-50000);
  });

  it('should make income amounts positive', () => {
    expect(normalizeAmount(50000, 'income')).toBe(50000);
  });

  it('should preserve decimal places', () => {
    expect(normalizeAmount(50000.99, 'expense')).toBe(-50000.99);
  });
});