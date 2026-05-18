/**
 * Centralized TypeScript Types for Equilibria
 * Replaces scattered 'any' types with proper type definitions
 */

// ============================================================
// FIRESTORE DOCUMENT TYPES
// ============================================================

export interface UserDocument {
  telegramChatId?: string;
  createdAt: number;
  updatedAt?: number;
}

export type TransactionType = 'income' | 'expense';

export interface TransactionDocument {
  userId: string;
  desc: string;
  category: string;
  amount: number; // negative for expense, positive for income
  date: string; // format: "YYYY-MM-DD"
  type: TransactionType;
  createdAt: number;
}

export type ReminderFrequency = 'once' | 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface ReminderDocument {
  userId: string;
  title: string;
  amount: number;
  frequency: ReminderFrequency;
  nextDate: string; // format: "YYYY-MM-DD"
  isActive: boolean;
  createdAt: number;
  updatedAt?: number;
}

export interface CategoryDocument {
  userId: string;
  name: string;
  type: TransactionType;
  createdAt: number;
}

export interface BudgetDocument {
  userId: string;
  category: string;
  amount: number;
  month: string; // format: "YYYY-MM"
  createdAt: number;
}

// ============================================================
// UI STATE TYPES
// ============================================================

export interface ReminderFormState {
  title: string;
  amount: string;
  frequency: ReminderFrequency;
}

export interface TransactionFormState {
  desc: string;
  amount: string;
  category: string;
  type: TransactionType;
}

export interface TransactionFilters {
  dateFrom: string;
  dateTo: string;
  category: string;
  type: 'all' | TransactionType;
}

export interface VerificationStatus {
  loading: boolean;
  success: boolean | null;
  message: string;
}

// ============================================================
// TELEGRAM BOT TYPES
// ============================================================

export interface TelegramParsedTransaction {
  type: TransactionType;
  amount: number;
  desc: string;
  category: string;
}

export interface TelegramVerifyResponse {
  success: boolean;
  message?: string;
  error?: string;
}

// ============================================================
// API RESPONSE TYPES
// ============================================================

export interface HealthCheckResponse {
  status: 'ok' | 'error';
  botActive: boolean;
}

export interface CronRemindersResponse {
  message: string;
  processedCount: number;
}

export interface CronRemindersError {
  error: string;
}

// ============================================================
// CALCULATION RESULT TYPES
// ============================================================

export interface BalanceSummary {
  balance: number;
  totalIncome: number;
  totalExpense: number;
}

export interface BudgetUtilization {
  percentage: number;
  isOverBudget: boolean;
}

export interface DayAggregation {
  date: string;
  income: number;
  expense: number;
  label: string;
}

// ============================================================
// FIREBASE TYPES
// ============================================================

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
  firestoreDatabaseId?: string;
}

// ============================================================
// UTILITY TYPE HELPERS
// ============================================================

/** Make all properties optional recursively */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/** Make specific properties required */
export type RequireOnly<T, K extends keyof T> = Required<Pick<T, K>> & Omit<T, K>;

// ============================================================
// CONSTANTS
// ============================================================

export const TRANSACTION_TYPES: TransactionType[] = ['income', 'expense'];

export const REMINDER_FREQUENCIES: ReminderFrequency[] = ['once', 'daily', 'weekly', 'monthly', 'yearly'];

export const MAX_DESCRIPTION_LENGTH = 1000;
export const MAX_CATEGORY_LENGTH = 50;
export const MAX_DOC_ID_LENGTH = 128;
export const MIN_AMOUNT = 1;
export const MAX_AMOUNT = Number.MAX_SAFE_INTEGER;