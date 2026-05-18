/**
 * TDD Tests - Domain Layer
 * Test-Driven Development for Equilibria Financial App
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  Transaction,
  createTransaction,
  calculateNextReminderDate,
  isValidTransaction,
  ValidationRules,
  Reminder,
} from '../../domain/entities';
import {
  TransactionType,
  Money,
  DateRange,
  Percentage,
  ValidId,
  TransactionFilter,
  createEmptyFilter,
  isTransactionType,
  isReminderFrequency,
} from '../../domain/value-objects';
import {
  BalanceService,
  CategoryService,
  BudgetService,
  TransactionFilterService,
  DateAggregationService,
  ExportService,
  ParsingService,
} from '../../domain/services';

// ============================================================
// TEST DATA
// ============================================================

const SAMPLE_TRANSACTIONS: Transaction[] = [
  { id: '1', userId: 'user1', desc: 'Salary', category: 'Income', amount: 5000000, date: '2026-05-01', type: 'income', createdAt: 1747555200000 },
  { id: '2', userId: 'user1', desc: 'Nasi Goreng', category: 'Food', amount: -25000, date: '2026-05-02', type: 'expense', createdAt: 1747641600000 },
  { id: '3', userId: 'user1', desc: 'Grab', category: 'Transport', amount: -15000, date: '2026-05-02', type: 'expense', createdAt: 1747641700000 },
  { id: '4', userId: 'user1', desc: 'Freelance', category: 'Income', amount: 1000000, date: '2026-05-03', type: 'income', createdAt: 1747728000000 },
  { id: '5', userId: 'user1', desc: 'Groceries', category: 'Food', amount: -150000, date: '2026-05-05', type: 'expense', createdAt: 1747814400000 },
  { id: '6', userId: 'user1', desc: 'Coffee', category: 'Food', amount: -20000, date: '2026-05-05', type: 'expense', createdAt: 1747814500000 },
];

const SAMPLE_REMINDER: Reminder = {
  id: '1',
  userId: 'user1',
  title: 'Netflix',
  amount: 150000,
  frequency: 'monthly',
  nextDate: '2026-05-18',
  isActive: true,
  createdAt: 1747555200000,
};

// ============================================================
// VALUE OBJECTS TESTS
// ============================================================

describe('TransactionType', () => {
  it('should accept valid transaction types', () => {
    expect(isTransactionType('income')).toBe(true);
    expect(isTransactionType('expense')).toBe(true);
  });

  it('should reject invalid transaction types', () => {
    expect(isTransactionType('refund')).toBe(false);
    expect(isTransactionType('invalid')).toBe(false);
    expect(isTransactionType('')).toBe(false);
  });
});

describe('ReminderFrequency', () => {
  it('should accept valid frequencies', () => {
    expect(isReminderFrequency('once')).toBe(true);
    expect(isReminderFrequency('daily')).toBe(true);
    expect(isReminderFrequency('weekly')).toBe(true);
    expect(isReminderFrequency('monthly')).toBe(true);
    expect(isReminderFrequency('yearly')).toBe(true);
  });

  it('should reject invalid frequencies', () => {
    expect(isReminderFrequency('hourly')).toBe(false);
    expect(isReminderFrequency('invalid')).toBe(false);
  });
});

describe('Money Value Object', () => {
  it('should create money with IDR currency', () => {
    const money = Money.create(50000);
    expect(money.amount).toBe(50000);
    expect(money.currency).toBe('IDR');
  });

  it('should round to 2 decimal places', () => {
    const money = Money.create(50000.999);
    expect(money.amount).toBe(50001);
  });

  it('should format IDR correctly', () => {
    const formatted = Money.formatIDR(5000000);
    expect(formatted).toBe('IDR 5.000.000');
  });

  it('should check if positive', () => {
    expect(Money.isPositive(Money.create(100))).toBe(true);
    expect(Money.isPositive(Money.create(-100))).toBe(false);
  });

  it('should check if negative', () => {
    expect(Money.isNegative(Money.create(-100))).toBe(true);
    expect(Money.isNegative(Money.create(100))).toBe(false);
  });

  it('should add money of same currency', () => {
    const result = Money.add(Money.create(100), Money.create(200));
    expect(result.amount).toBe(300);
    expect(result.currency).toBe('IDR');
  });

  it('should throw error when adding different currencies', () => {
    const idr = Money.create(100, 'IDR');
    const usd = Money.create(100, 'USD');
    expect(() => Money.add(idr, usd)).toThrow();
  });
});

describe('DateRange Value Object', () => {
  it('should create date range', () => {
    const range = DateRange.create('2026-05-01', '2026-05-31');
    expect(range.start).toBe('2026-05-01');
    expect(range.end).toBe('2026-05-31');
  });

  it('should check if date is within range', () => {
    const range = DateRange.create('2026-05-01', '2026-05-31');
    expect(DateRange.contains(range, '2026-05-15')).toBe(true);
    expect(DateRange.contains(range, '2026-04-30')).toBe(false);
    expect(DateRange.contains(range, '2026-06-01')).toBe(false);
  });

  it('should validate range', () => {
    expect(DateRange.isValid(DateRange.create('2026-05-01', '2026-05-31'))).toBe(true);
    expect(DateRange.isValid(DateRange.create('2026-05-31', '2026-05-01'))).toBe(false);
  });
});

describe('ValidId Value Object', () => {
  it('should create valid ID', () => {
    const id = ValidId.create('valid_id_123');
    expect(id?.value).toBe('valid_id_123');
  });

  it('should reject empty ID', () => {
    expect(ValidId.create('')).toBeNull();
    expect(ValidId.create('   ')).toBeNull();
  });

  it('should reject ID with invalid characters', () => {
    expect(ValidId.create('invalid id')).toBeNull();
    expect(ValidId.create('invalid@id')).toBeNull();
  });

  it('should enforce max length', () => {
    const longId = 'a'.repeat(129);
    expect(ValidId.create(longId)).toBeNull();
  });

  it('should allow alphanumeric, underscore, hyphen', () => {
    expect(ValidId.create('my-id_123')).not.toBeNull();
  });
});

describe('TransactionFilter', () => {
  it('should create empty filter', () => {
    const filter = createEmptyFilter();
    expect(filter.dateFrom).toBeUndefined();
    expect(filter.dateTo).toBeUndefined();
    expect(filter.category).toBeUndefined();
    expect(filter.type).toBe('all');
  });
});

// ============================================================
// ENTITY TESTS
// ============================================================

describe('Transaction Entity', () => {
  it('should create transaction with negative amount for expense', () => {
    const tx = createTransaction({
      userId: 'user1',
      desc: 'Test',
      category: 'Food',
      amount: 50000,
      date: '2026-05-18',
      type: 'expense',
    });
    expect(tx.amount).toBe(-50000);
    expect(tx.type).toBe('expense');
  });

  it('should create transaction with positive amount for income', () => {
    const tx = createTransaction({
      userId: 'user1',
      desc: 'Test',
      category: 'Income',
      amount: 5000000,
      date: '2026-05-18',
      type: 'income',
    });
    expect(tx.amount).toBe(5000000);
    expect(tx.type).toBe('income');
  });

  it('should validate transaction', () => {
    expect(isValidTransaction({
      userId: 'user1',
      desc: 'Test',
      category: 'Food',
      amount: 50000,
      date: '2026-05-18',
      type: 'expense',
    })).toBe(true);
  });

  it('should reject invalid transaction', () => {
    expect(isValidTransaction({
      userId: '',
      desc: 'Test',
      category: 'Food',
      amount: 50000,
      date: '2026-05-18',
      type: 'expense',
    })).toBe(false);
  });
});

describe('Reminder Entity', () => {
  it('should calculate next date for weekly frequency', () => {
    const result = calculateNextReminderDate('2026-05-18', 'weekly');
    expect(result.nextDate).toBe('2026-05-25');
    expect(result.isActive).toBe(true);
  });

  it('should calculate next date for monthly frequency', () => {
    const result = calculateNextReminderDate('2026-05-18', 'monthly');
    expect(result.nextDate).toBe('2026-06-18');
    expect(result.isActive).toBe(true);
  });

  it('should calculate next date for yearly frequency', () => {
    const result = calculateNextReminderDate('2026-05-18', 'yearly');
    expect(result.nextDate).toBe('2027-05-18');
    expect(result.isActive).toBe(true);
  });

  it('should deactivate once frequency', () => {
    const result = calculateNextReminderDate('2026-05-18', 'once');
    expect(result.nextDate).toBe('2026-05-18');
    expect(result.isActive).toBe(false);
  });

  it('should handle daily frequency', () => {
    const result = calculateNextReminderDate('2026-05-18', 'daily');
    expect(result.nextDate).toBe('2026-05-19');
    expect(result.isActive).toBe(true);
  });
});

// ============================================================
// DOMAIN SERVICES TESTS
// ============================================================

describe('BalanceService', () => {
  it('should calculate balance summary', () => {
    const result = BalanceService.calculate(SAMPLE_TRANSACTIONS);

    expect(result.balance).toBe(5790000);
    expect(result.totalIncome).toBe(6000000);
    expect(result.totalExpense).toBe(210000);
    expect(result.incomeCount).toBe(2);
    expect(result.expenseCount).toBe(4);
  });

  it('should handle empty transactions', () => {
    const result = BalanceService.calculate([]);
    expect(result.balance).toBe(0);
    expect(result.totalIncome).toBe(0);
    expect(result.totalExpense).toBe(0);
  });

  it('should handle only income', () => {
    const incomeOnly = SAMPLE_TRANSACTIONS.filter(t => t.type === 'income');
    const result = BalanceService.calculate(incomeOnly);
    expect(result.totalExpense).toBe(0);
  });

  it('should handle only expense', () => {
    const expenseOnly = SAMPLE_TRANSACTIONS.filter(t => t.type === 'expense');
    const result = BalanceService.calculate(expenseOnly);
    expect(result.totalIncome).toBe(0);
    expect(result.balance).toBe(-210000);
  });
});

describe('CategoryService', () => {
  it('should aggregate expenses by category', () => {
    const result = CategoryService.aggregateByCategory(SAMPLE_TRANSACTIONS, 'expense');

    expect(result.length).toBeGreaterThan(0);
    const foodCategory = result.find(c => c.category === 'Food');
    expect(foodCategory?.total).toBe(195000);
    expect(foodCategory?.count).toBe(3);
  });

  it('should calculate percentages correctly', () => {
    const result = CategoryService.aggregateByCategory(SAMPLE_TRANSACTIONS, 'expense');
    const totalPercentage = result.reduce((sum, c) => sum + c.percentage, 0);

    // Percentages should sum to approximately 100 (allowing for rounding)
    expect(totalPercentage).toBeGreaterThan(99);
    expect(totalPercentage).toBeLessThan(101);
  });

  it('should get unique categories sorted', () => {
    const result = CategoryService.getUniqueCategories(SAMPLE_TRANSACTIONS);
    expect(result).toEqual(['Food', 'Income', 'Transport']);
  });
});

describe('BudgetService', () => {
  it('should calculate utilization percentage', () => {
    const result = BudgetService.calculateUtilization(500000, 250000);
    expect(result.percentage).toBe(50);
    expect(result.isOverBudget).toBe(false);
  });

  it('should cap at 100%', () => {
    const result = BudgetService.calculateUtilization(500000, 600000);
    expect(result.percentage).toBe(100);
    expect(result.isOverBudget).toBe(true);
  });

  it('should handle zero budget', () => {
    const result = BudgetService.calculateUtilization(0, 100000);
    expect(result.percentage).toBe(0);
  });

  it('should calculate remaining amount', () => {
    const result = BudgetService.calculateRemaining(500000, 200000);
    expect(result).toBe(300000);
  });
});

describe('TransactionFilterService', () => {
  it('should filter by date range', () => {
    const result = TransactionFilterService.filter(SAMPLE_TRANSACTIONS, {
      dateFrom: '2026-05-02',
      dateTo: '2026-05-03',
    });
    expect(result.length).toBe(3);
  });

  it('should filter by category', () => {
    const result = TransactionFilterService.filter(SAMPLE_TRANSACTIONS, {
      category: 'Food',
    });
    expect(result.length).toBe(3);
    expect(result.every(t => t.category === 'Food')).toBe(true);
  });

  it('should filter by type', () => {
    const result = TransactionFilterService.filter(SAMPLE_TRANSACTIONS, {
      type: 'income',
    });
    expect(result.length).toBe(2);
    expect(result.every(t => t.type === 'income')).toBe(true);
  });

  it('should combine multiple filters', () => {
    const result = TransactionFilterService.filter(SAMPLE_TRANSACTIONS, {
      dateFrom: '2026-05-01',
      dateTo: '2026-05-05',
      category: 'Food',
      type: 'expense',
    });
    expect(result.length).toBe(3);
  });

  it('should search by description', () => {
    const result = TransactionFilterService.search(SAMPLE_TRANSACTIONS, 'goreng');
    expect(result.length).toBe(1);
    expect(result[0].desc).toBe('Nasi Goreng');
  });

  it('should search case-insensitive', () => {
    const result = TransactionFilterService.search(SAMPLE_TRANSACTIONS, 'SALARY');
    expect(result.length).toBe(1);
    expect(result[0].desc).toBe('Salary');
  });
});

describe('DateAggregationService', () => {
  it('should aggregate by day', () => {
    const result = DateAggregationService.aggregateByDay(SAMPLE_TRANSACTIONS, 7);
    expect(result.length).toBe(7);

    // Verify structure
    result.forEach(day => {
      expect(day).toHaveProperty('date');
      expect(day).toHaveProperty('income');
      expect(day).toHaveProperty('expense');
      expect(day).toHaveProperty('label');
    });
  });

  it('should handle empty transactions', () => {
    const result = DateAggregationService.aggregateByDay([], 7);
    expect(result.length).toBe(7);
    result.forEach(day => {
      expect(day.income).toBe(0);
      expect(day.expense).toBe(0);
    });
  });
});

describe('ExportService', () => {
  it('should convert to XLSX data format', () => {
    const result = ExportService.toXLSXData(SAMPLE_TRANSACTIONS);

    expect(result.length).toBe(SAMPLE_TRANSACTIONS.length);
    expect(result[0]).toHaveProperty('Date');
    expect(result[0]).toHaveProperty('Type');
    expect(result[0]).toHaveProperty('Category');
    expect(result[0]).toHaveProperty('Description');
    expect(result[0]).toHaveProperty('Amount');
  });

  it('should generate filename with date', () => {
    const filename = ExportService.generateFilename();
    expect(filename).toMatch(/^transactions_\d{4}-\d{2}-\d{2}\.xlsx$/);
  });
});

describe('ParsingService', () => {
  it('should parse simple expense', () => {
    const result = ParsingService.parseTelegramInput('50000 Nasi Goreng');
    expect(result?.type).toBe('expense');
    expect(result?.amount).toBe(50000);
    expect(result?.desc).toBe('Nasi Goreng');
    expect(result?.category).toBe('General');
  });

  it('should parse income with keyword', () => {
    const result = ParsingService.parseTelegramInput('income 2000000 Salary');
    expect(result?.type).toBe('income');
    expect(result?.amount).toBe(2000000);
    expect(result?.desc).toBe('Salary');
  });

  it('should parse expense with keyword', () => {
    const result = ParsingService.parseTelegramInput('expense 50000 Lunch');
    expect(result?.type).toBe('expense');
    expect(result?.amount).toBe(50000);
    expect(result?.desc).toBe('Lunch');
  });

  it('should handle amounts with commas', () => {
    const result = ParsingService.parseTelegramInput('150,000 Groceries');
    expect(result?.amount).toBe(150000);
  });

  it('should return null for invalid input', () => {
    expect(ParsingService.parseTelegramInput('')).toBeNull();
    expect(ParsingService.parseTelegramInput('50000')).toBeNull();
  });

  it('should normalize amount', () => {
    expect(ParsingService.normalizeAmount(50000, 'expense')).toBe(-50000);
    expect(ParsingService.normalizeAmount(50000, 'income')).toBe(50000);
  });

  it('should format date correctly', () => {
    const date = new Date('2026-05-18');
    const result = ParsingService.formatDate(date);
    expect(result).toBe('2026-05-18');
  });
});

// ============================================================
// VALIDATION RULES TESTS
// ============================================================

describe('ValidationRules', () => {
  it('should have correct max description length', () => {
    expect(ValidationRules.transaction.descMaxLength).toBe(1000);
  });

  it('should have correct max category length', () => {
    expect(ValidationRules.transaction.categoryMaxLength).toBe(50);
  });

  it('should have correct min amount', () => {
    expect(ValidationRules.general.minAmount).toBe(1);
  });
});