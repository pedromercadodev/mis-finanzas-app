export type AccountType = 'exchange' | 'bank' | 'virtual_card' | 'cash' | 'other';
export type TransactionType = 'income' | 'expense' | 'transfer';
export type CurrencyType = 'USD' | 'BS' | 'BOTH';
export type RateType = 'BCV' | 'PARALLEL';
export type FrequencyType = 'weekly' | 'monthly' | 'yearly' | 'custom';

export interface Account {
  id: number;
  name: string;
  type: AccountType;
  currency: CurrencyType;
  initialBalanceUSD: number;
  initialBalanceBS: number;
  icon: string;
  color: string;
  isActive: number;
  platform: string | null;
  createdAt: string;
}

export interface Transaction {
  id: number;
  type: TransactionType;
  description: string;
  amountUSD: number | null;
  amountBS: number | null;
  currency: CurrencyType;
  exchangeRate: number | null;
  accountId: number;
  transferToAccountId: number | null;
  categoryId: number;
  date: string;
  createdAt: string;
  notes: string | null;
}

export interface Category {
  id: number;
  name: string;
  icon: string;
  color: string;
  type: 'income' | 'expense';
  budget: number | null;
}

export interface CategoryWithGroup extends Category {
  groupId: number | null;
  sortOrder: number;
  groupName?: string;
}

export interface CategoryGroup {
  id: number;
  name: string;
  icon: string;
  color: string;
  type: 'income' | 'expense';
  sortOrder: number;
  createdAt: string;
}

export interface BudgetAllocation {
  id: number;
  categoryId: number;
  month: string;
  amountUSD: number;
  amountBS: number;
  createdAt: string;
  updatedAt: string;
}

export interface CategorySpending {
  categoryId: number;
  spentUSD: number;
  spentBS: number;
}

export interface GroupWithCategories {
  group: CategoryGroup;
  categories: (CategoryWithGroup & { allocation?: BudgetAllocation; spending?: CategorySpending })[];
  totalBudgetUSD: number;
  totalSpentUSD: number;
}

export interface Goal {
  id: number;
  name: string;
  targetAmount: number;
  currentAmount: number;
  currency: 'USD' | 'BS';
  accountId: number | null;
  deadline: string | null;
  periodType: 'none' | 'weekly' | 'monthly';
  celebratedAt: string | null;
  lastProgressAt: string | null;
  createdAt: string;
}

export interface GoalItem {
  id: number;
  goalId: number;
  name: string;
  targetAmount: number;
  currentAmount: number;
  isCompleted: number;
  sortOrder: number;
  createdAt: string;
}

export interface GoalWithItems extends Goal {
  items: GoalItem[];
}

export interface ExchangeRate {
  id: number;
  rateType: RateType;
  rateUSDToBS: number;
  date: string;
  source: string;
}

export interface Subscription {
  id: number;
  name: string;
  description: string | null;
  amountUSD: number | null;
  amountBS: number | null;
  currency: CurrencyType;
  categoryId: number;
  accountId: number;
  frequency: FrequencyType;
  intervalDays: number | null;
  billingDay: number;
  nextBillingDate: string;
  isActive: number;
  autoGenerate: number;
  notes: string | null;
  createdAt: string;
}

export type DebtType = 'lent' | 'borrowed';
export type DebtStatus = 'active' | 'paid' | 'overdue';

export interface Debt {
  id: number;
  type: DebtType;
  personName: string;
  description: string | null;
  amountUSD: number | null;
  amountBS: number | null;
  currency: CurrencyType;
  interestRate: number;
  totalAmountUSD: number | null;
  totalAmountBS: number | null;
  paidAmountUSD: number;
  paidAmountBS: number;
  dueDate: string | null;
  status: DebtStatus;
  notes: string | null;
  createdAt: string;
}

export interface DebtPayment {
  id: number;
  debtId: number;
  amountUSD: number;
  amountBS: number;
  date: string;
  notes: string | null;
  createdAt: string;
}

export interface AIInputResult {
  type: TransactionType;
  amountUSD: number | null;
  amountBS: number | null;
  description: string;
  account: string;
  category: string;
  date: string;
}
