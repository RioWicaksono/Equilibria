/**
 * Domain Services - Business logic operations
 * These services encapsulate complex domain logic
 */

import {
  Transaction,
} from '../entities';
import {
  TransactionType,
  Money,
  DateRange,
  Percentage,
  TransactionFilter,
} from '../value-objects';

// ============================================================
// BALANCE CALCULATION SERVICE
// ============================================================

export interface BalanceSummary {
  balance: number;
  totalIncome: number;
  totalExpense: number;
  incomeCount: number;
  expenseCount: number;
}

export const BalanceService = {
  calculate(transactions: Transaction[]): BalanceSummary {
    const income = transactions.filter((t) => t.type === 'income');
    const expense = transactions.filter((t) => t.type === 'expense');

    return {
      balance: transactions.reduce((sum, t) => sum + t.amount, 0),
      totalIncome: income.reduce((sum, t) => sum + t.amount, 0),
      totalExpense: Math.abs(expense.reduce((sum, t) => sum + t.amount, 0)),
      incomeCount: income.length,
      expenseCount: expense.length,
    };
  },

  calculateFromAmounts(amounts: number[]): number {
    return amounts.reduce((sum, amount) => sum + amount, 0);
  },
};

// ============================================================
// CATEGORY AGGREGATION SERVICE
// ============================================================

export interface CategorySummary {
  category: string;
  total: number;
  count: number;
  percentage: number;
}

export const CategoryService = {
  aggregateByCategory(
    transactions: Transaction[],
    type: TransactionType = 'expense'
  ): CategorySummary[] {
    const filtered = transactions.filter((t) => t.type === type);
    const totalAmount = filtered.reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const categoryMap = new Map<string, { total: number; count: number }>();

    filtered.forEach((t) => {
      const existing = categoryMap.get(t.category) || { total: 0, count: 0 };
      categoryMap.set(t.category, {
        total: existing.total + Math.abs(t.amount),
        count: existing.count + 1,
      });
    });

    const result: CategorySummary[] = [];
    categoryMap.forEach((value, key) => {
      result.push({
        category: key,
        total: value.total,
        count: value.count,
        percentage: totalAmount > 0 ? (value.total / totalAmount) * 100 : 0,
      });
    });

    return result.sort((a, b) => b.total - a.total);
  },

  getSpendingByCategory(
    transactions: Transaction[],
    month: string
  ): Map<string, number> {
    const spending = new Map<string, number>();

    transactions
      .filter((t) => t.type === 'expense' && t.date.startsWith(month))
      .forEach((t) => {
        const current = spending.get(t.category) || 0;
        spending.set(t.category, current + Math.abs(t.amount));
      });

    return spending;
  },

  getUniqueCategories(transactions: Transaction[]): string[] {
    return Array.from(new Set(transactions.map((t) => t.category))).sort();
  },
};

// ============================================================
// BUDGET SERVICE
// ============================================================

export interface BudgetUtilization {
  budgetId: string;
  category: string;
  budgetAmount: number;
  spentAmount: number;
  percentage: number;
  isOverBudget: boolean;
  remaining: number;
}

export const BudgetService = {
  calculateUtilization(
    budgetAmount: number,
    spentAmount: number
  ): { percentage: number; isOverBudget: boolean } {
    const percentage =
      budgetAmount > 0
        ? Math.min(100, Math.round((spentAmount / budgetAmount) * 100))
        : 0;

    return {
      percentage,
      isOverBudget: spentAmount > budgetAmount,
    };
  },

  calculateRemaining(budgetAmount: number, spentAmount: number): number {
    return budgetAmount - spentAmount;
  },

  getBudgetUtilization(
    budget: { id: string; category: string; amount: number; month: string },
    transactions: Transaction[],
    month: string
  ): BudgetUtilization {
    const spent = transactions
      .filter(
        (t) =>
          t.type === 'expense' &&
          t.category.toLowerCase() === budget.category.toLowerCase() &&
          t.date.startsWith(month)
      )
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const { percentage, isOverBudget } = this.calculateUtilization(
      budget.amount,
      spent
    );

    return {
      budgetId: budget.id,
      category: budget.category,
      budgetAmount: budget.amount,
      spentAmount: spent,
      percentage,
      isOverBudget,
      remaining: this.calculateRemaining(budget.amount, spent),
    };
  },
};

// ============================================================
// TRANSACTION FILTER SERVICE
// ============================================================

export const TransactionFilterService = {
  filter(transactions: Transaction[], filter: TransactionFilter): Transaction[] {
    return transactions.filter((t) => {
      if (filter.dateFrom && t.date < filter.dateFrom) return false;
      if (filter.dateTo && t.date > filter.dateTo) return false;
      if (filter.category && filter.category !== 'all' && t.category !== filter.category)
        return false;
      if (filter.type && filter.type !== 'all' && t.type !== filter.type) return false;
      return true;
    });
  },

  search(transactions: Transaction[], query: string): Transaction[] {
    const lowerQuery = query.toLowerCase();
    return transactions.filter(
      (t) =>
        t.desc.toLowerCase().includes(lowerQuery) ||
        t.category.toLowerCase().includes(lowerQuery)
    );
  },
};

// ============================================================
// DATE AGGREGATION SERVICE
// ============================================================

export interface DayAggregation {
  date: string;
  income: number;
  expense: number;
  label: string;
}

export const DateAggregationService = {
  aggregateByDay(
    transactions: Transaction[],
    days: number = 7
  ): DayAggregation[] {
    const result: DayAggregation[] = [];

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayTxs = transactions.filter((t) => t.date === dateStr);

      result.push({
        date: dateStr,
        income: dayTxs.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0),
        expense: Math.abs(
          dayTxs.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0)
        ),
        label: d.toLocaleDateString('en-US', { weekday: 'short' }),
      });
    }

    return result;
  },

  aggregateByMonth(
    transactions: Transaction[],
    month: string
  ): DayAggregation[] {
    return transactions
      .filter((t) => t.date.startsWith(month))
      .reduce((acc, t) => {
        const existing = acc.find((a) => a.date === t.date);
        if (existing) {
          if (t.type === 'income') {
            existing.income += t.amount;
          } else {
            existing.expense += Math.abs(t.amount);
          }
        } else {
          acc.push({
            date: t.date,
            income: t.type === 'income' ? t.amount : 0,
            expense: t.type === 'expense' ? Math.abs(t.amount) : 0,
            label: new Date(t.date).toLocaleDateString('en-US', {
              weekday: 'short',
              day: 'numeric',
            }),
          });
        }
        return acc;
      }, [] as DayAggregation[])
      .sort((a, b) => a.date.localeCompare(b.date));
  },
};

// ============================================================
// EXPORT SERVICE
// ============================================================

export const ExportService = {
  toXLSXData(transactions: Transaction[]): Record<string, string | number>[] {
    return transactions.map((t) => ({
      Date: t.date,
      Type: t.type,
      Category: t.category,
      Description: t.desc,
      Amount: t.amount,
    }));
  },

  generateFilename(): string {
    return `transactions_${new Date().toISOString().split('T')[0]}.xlsx`;
  },
};

// ============================================================
// PARSING SERVICE (for Telegram input)
// ============================================================

export interface ParsedTransaction {
  type: TransactionType;
  amount: number;
  desc: string;
  category: string;
}

export const ParsingService = {
  parseTelegramInput(text: string): ParsedTransaction | null {
    const parts = text.trim().split(/\s+/);
    if (parts.length < 2) return null;

    let type: TransactionType = 'expense';
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
      category: type === 'income' ? 'Income' : 'General',
    };
  },

  normalizeAmount(amount: number, type: TransactionType): number {
    return type === 'expense' ? -Math.abs(amount) : Math.abs(amount);
  },

  formatDate(date: Date = new Date()): string {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  },
};