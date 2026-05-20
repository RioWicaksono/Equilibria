/**
 * Domain Entities - Core business objects
 * These represent the core concepts of the Equilibria domain
 */

import { TransactionType, ReminderFrequency } from '../value-objects';

// ============================================================
// BASE ENTITY
// ============================================================

export interface BaseEntity {
  id: string;
  createdAt: number;
  updatedAt?: number;
}

// ============================================================
// USER ENTITY
// ============================================================

export interface User extends BaseEntity {
  telegramChatId?: string;
}

export interface UserCreate {
  telegramChatId?: string;
}

export interface UserUpdate {
  telegramChatId?: string;
  updatedAt: number;
}

// ============================================================
// TRANSACTION ENTITY
// ============================================================

export interface Transaction extends BaseEntity {
  userId: string;
  desc: string;
  category: string;
  amount: number; // negative for expense, positive for income
  date: string;    // format: YYYY-MM-DD
  type: TransactionType;
}

export interface TransactionCreate {
  userId: string;
  desc: string;
  category: string;
  amount: number;
  date: string;
  type: TransactionType;
}

export interface TransactionUpdate {
  desc?: string;
  category?: string;
  amount?: number;
  date?: string;
  type?: TransactionType;
  updatedAt: number;
}

// Transaction entity factory
export function createTransaction(data: TransactionCreate): Transaction {
  const now = Date.now();
  return {
    id: '', // Will be set by Firestore
    userId: data.userId,
    desc: data.desc,
    category: data.category,
    amount: data.type === 'expense' ? -Math.abs(data.amount) : Math.abs(data.amount),
    date: data.date,
    type: data.type,
    createdAt: now,
  };
}

// ============================================================
// REMINDER ENTITY
// ============================================================

export interface Reminder extends BaseEntity {
  userId: string;
  title: string;
  amount: number;
  frequency: ReminderFrequency;
  nextDate: string;  // format: YYYY-MM-DD
  isActive: boolean;
}

export interface ReminderCreate {
  userId: string;
  title: string;
  amount: number;
  frequency: ReminderFrequency;
  nextDate: string;
}

export interface ReminderUpdate {
  title?: string;
  amount?: number;
  frequency?: ReminderFrequency;
  nextDate?: string;
  isActive?: boolean;
  updatedAt: number;
}

// Calculate next reminder date
export function calculateNextReminderDate(
  currentDate: string,
  frequency: ReminderFrequency
): { nextDate: string; isActive: boolean } {
  const parts = currentDate.split('-');
  if (parts.length !== 3) {
    return { nextDate: currentDate, isActive: false };
  }

  const year = parseInt(parts[0]);
  const month = parseInt(parts[1]) - 1;
  const day = parseInt(parts[2]);
  const next = new Date(year, month, day);

  if (frequency === 'once') {
    return { nextDate: currentDate, isActive: false };
  }

  switch (frequency) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      break;
    case 'weekly':
      next.setDate(next.getDate() + 7);
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      break;
    case 'yearly':
      next.setFullYear(next.getFullYear() + 1);
      break;
  }

  const yyyy = next.getFullYear();
  const mm = String(next.getMonth() + 1).padStart(2, '0');
  const dd = String(next.getDate()).padStart(2, '0');

  return {
    nextDate: `${yyyy}-${mm}-${dd}`,
    isActive: true,
  };
}

// ============================================================
// CATEGORY ENTITY
// ============================================================

export interface Category extends BaseEntity {
  userId: string;
  name: string;
  type: TransactionType;
}

export interface CategoryCreate {
  userId: string;
  name: string;
  type: TransactionType;
}

// ============================================================
// BUDGET ENTITY
// ============================================================

export interface Budget extends BaseEntity {
  userId: string;
  category: string;
  amount: number;
  month: string; // format: YYYY-MM
}

export interface BudgetCreate {
  userId: string;
  category: string;
  amount: number;
  month: string;
}

export interface BudgetUpdate {
  category?: string;
  amount?: number;
  month?: string;
  updatedAt: number;
}

// ============================================================
// ENTITY VALIDATIONS
// ============================================================

export const ValidationRules = {
  // Transaction validations
  transaction: {
    descMaxLength: 1000,
    categoryMaxLength: 50,
    idMaxLength: 128,
  },

  // Reminder validations
  reminder: {
    titleMaxLength: 100,
  },

  // Category validations
  category: {
    nameMaxLength: 50,
  },

  // General validations
  general: {
    minAmount: 1,
    maxAmount: Number.MAX_SAFE_INTEGER,
  },
} as const;

// Validate transaction
export function isValidTransaction(data: Partial<Transaction>): boolean {
  if (!data.userId || !data.desc || !data.category || data.amount === undefined || !data.date || !data.type) {
    return false;
  }
  if (data.desc.length > ValidationRules.transaction.descMaxLength) return false;
  if (data.category.length > ValidationRules.transaction.categoryMaxLength) return false;
  if (Math.abs(data.amount) < ValidationRules.general.minAmount) return false;
  return true;
}