import Dexie, { type EntityTable } from 'dexie';
import type {
  Account,
  Transaction,
  Category,
  CategoryGroup,
  BudgetAllocation,
  Goal,
  GoalItem,
  ExchangeRate,
  Subscription,
  Debt,
  DebtPayment,
} from '../utils/types';

// Extendemos los tipos con id opcional para creación
export type NewAccount = Omit<Account, 'id' | 'createdAt'>;
export type NewTransaction = Omit<Transaction, 'id' | 'createdAt'>;
export type NewCategory = Omit<Category, 'id'>;
export type NewCategoryGroup = Omit<CategoryGroup, 'id' | 'createdAt'>;
export type NewBudgetAllocation = Omit<BudgetAllocation, 'id'>;
export type NewGoal = Omit<Goal, 'id' | 'createdAt'>;
export type NewGoalItem = Omit<GoalItem, 'id' | 'createdAt'>;
export type NewExchangeRate = Omit<ExchangeRate, 'id'>;
export type NewSubscription = Omit<Subscription, 'id' | 'createdAt'>;
export type NewDebt = Omit<Debt, 'id' | 'createdAt'>;
export type NewDebtPayment = Omit<DebtPayment, 'id' | 'createdAt'>;

class FinanzasDatabase extends Dexie {
  accounts!: EntityTable<Account, 'id'>;
  transactions!: EntityTable<Transaction, 'id'>;
  categories!: EntityTable<Category, 'id'>;
  categoryGroups!: EntityTable<CategoryGroup, 'id'>;
  budgetAllocations!: EntityTable<BudgetAllocation, 'id'>;
  goals!: EntityTable<Goal, 'id'>;
  goalItems!: EntityTable<GoalItem, 'id'>;
  exchangeRates!: EntityTable<ExchangeRate, 'id'>;
  subscriptions!: EntityTable<Subscription, 'id'>;
  debts!: EntityTable<Debt, 'id'>;
  debtPayments!: EntityTable<DebtPayment, 'id'>;

  constructor() {
    super('finanzas-app');

    this.version(1).stores({
      accounts: '++id, platform, currency, isActive, createdAt',
      transactions: '++id, accountId, categoryId, type, date, createdAt, [type+date], [accountId+date]',
      categories: '++id, type, groupId, sortOrder',
      categoryGroups: '++id, type, createdAt',
      budgetAllocations: '++id, categoryId, month, [categoryId+month]',
      goals: '++id, isActive, createdAt',
      goalItems: '++id, goalId, isCompleted, createdAt',
      exchangeRates: '++id, type, date',
      subscriptions: '++id, accountId, isActive, frequency, nextBillingDate, createdAt',
      debts: '++id, isActive, createdAt',
      debtPayments: '++id, debtId, createdAt',
    });

    this.version(2).stores({
      accounts: '++id, platform, currency, isActive, createdAt',
      transactions: '++id, accountId, categoryId, type, date, createdAt, [type+date], [accountId+date]',
      categories: '++id, type, groupId, sortOrder',
      categoryGroups: '++id, type, sortOrder, createdAt',
      budgetAllocations: '++id, categoryId, month, [categoryId+month]',
      goals: '++id, isActive, createdAt',
      goalItems: '++id, goalId, isCompleted, createdAt',
      exchangeRates: '++id, rateType, date',
      subscriptions: '++id, accountId, isActive, frequency, nextBillingDate, createdAt',
      debts: '++id, isActive, createdAt',
      debtPayments: '++id, debtId, createdAt',
    });
  }
}

export const db = new FinanzasDatabase();

// Función para inicializar datos por defecto (categorías y grupos)
export async function initializeDefaultData(): Promise<void> {
  const groupCount = await db.categoryGroups.count();
  if (groupCount > 0) return;

  // Grupos de gastos
  const expenseGroups: Omit<CategoryGroup, 'id' | 'createdAt'>[] = [
    { name: 'Vivienda', type: 'expense', icon: 'home', color: '#FF6B6B', sortOrder: 1 },
    { name: 'Alimentación', type: 'expense', icon: 'fast-food', color: '#FFA94D', sortOrder: 2 },
    { name: 'Transporte', type: 'expense', icon: 'car', color: '#74C0FC', sortOrder: 3 },
    { name: 'Servicios', type: 'expense', icon: 'flash', color: '#FFD43B', sortOrder: 4 },
    { name: 'Salud', type: 'expense', icon: 'medkit', color: '#69DB7C', sortOrder: 5 },
    { name: 'Entretenimiento', type: 'expense', icon: 'film', color: '#DA77F2', sortOrder: 6 },
    { name: 'Educación', type: 'expense', icon: 'book', color: '#4DABF7', sortOrder: 7 },
    { name: 'Otros Gastos', type: 'expense', icon: 'ellipsis-horizontal', color: '#ADB5BD', sortOrder: 8 },
  ];

  // Grupos de ingresos
  const incomeGroups: Omit<CategoryGroup, 'id' | 'createdAt'>[] = [
    { name: 'Salario', type: 'income', icon: 'cash', color: '#69DB7C', sortOrder: 1 },
    { name: 'Freelance', type: 'income', icon: 'laptop', color: '#74C0FC', sortOrder: 2 },
    { name: 'Inversiones', type: 'income', icon: 'trending-up', color: '#FFD43B', sortOrder: 3 },
    { name: 'Otros Ingresos', type: 'income', icon: 'ellipsis-horizontal', color: '#ADB5BD', sortOrder: 4 },
  ];

  const now = new Date().toISOString();

  // Crear grupos de gastos
  const expenseGroupIds = await db.categoryGroups.bulkAdd(
    expenseGroups.map(g => ({ ...g, createdAt: now })),
    { allKeys: true }
  );

  // Crear grupos de ingresos
  const incomeGroupIds = await db.categoryGroups.bulkAdd(
    incomeGroups.map(g => ({ ...g, createdAt: now })),
    { allKeys: true }
  );

  // Categorías de gastos
  const expenseCategories: Omit<Category, 'id'>[] = [
    { name: 'Alquiler', type: 'expense', groupId: expenseGroupIds[0] as number, icon: 'home', color: '#FF6B6B', sortOrder: 1, budget: null },
    { name: 'Hipoteca', type: 'expense', groupId: expenseGroupIds[0] as number, icon: 'home', color: '#FF8787', sortOrder: 2, budget: null },
    { name: 'Condominio', type: 'expense', groupId: expenseGroupIds[0] as number, icon: 'business', color: '#FFA8A8', sortOrder: 3, budget: null },
    { name: 'Supermercado', type: 'expense', groupId: expenseGroupIds[1] as number, icon: 'cart', color: '#FFA94D', sortOrder: 1, budget: null },
    { name: 'Restaurantes', type: 'expense', groupId: expenseGroupIds[1] as number, icon: 'restaurant', color: '#FFC078', sortOrder: 2, budget: null },
    { name: 'Gasolina', type: 'expense', groupId: expenseGroupIds[2] as number, icon: 'car', color: '#74C0FC', sortOrder: 1, budget: null },
    { name: 'Taxi/Uber', type: 'expense', groupId: expenseGroupIds[2] as number, icon: 'car-sport', color: '#A5D8FF', sortOrder: 2, budget: null },
    { name: 'Electricidad', type: 'expense', groupId: expenseGroupIds[3] as number, icon: 'flash', color: '#FFD43B', sortOrder: 1, budget: null },
    { name: 'Agua', type: 'expense', groupId: expenseGroupIds[3] as number, icon: 'water', color: '#4DABF7', sortOrder: 2, budget: null },
    { name: 'Internet', type: 'expense', groupId: expenseGroupIds[3] as number, icon: 'globe', color: '#69DB7C', sortOrder: 3, budget: null },
    { name: 'Teléfono', type: 'expense', groupId: expenseGroupIds[3] as number, icon: 'phone-portrait', color: '#DA77F2', sortOrder: 4, budget: null },
    { name: 'Médico', type: 'expense', groupId: expenseGroupIds[4] as number, icon: 'medkit', color: '#69DB7C', sortOrder: 1, budget: null },
    { name: 'Seguro', type: 'expense', groupId: expenseGroupIds[4] as number, icon: 'shield-checkmark', color: '#8CE99A', sortOrder: 2, budget: null },
    { name: 'Cine', type: 'expense', groupId: expenseGroupIds[5] as number, icon: 'film', color: '#DA77F2', sortOrder: 1, budget: null },
    { name: 'Streaming', type: 'expense', groupId: expenseGroupIds[5] as number, icon: 'tv', color: '#B197FC', sortOrder: 2, budget: null },
    { name: 'Cursos', type: 'expense', groupId: expenseGroupIds[6] as number, icon: 'book', color: '#4DABF7', sortOrder: 1, budget: null },
    { name: 'Libros', type: 'expense', groupId: expenseGroupIds[6] as number, icon: 'library', color: '#74C0FC', sortOrder: 2, budget: null },
    { name: 'Otros', type: 'expense', groupId: expenseGroupIds[7] as number, icon: 'ellipsis-horizontal', color: '#ADB5BD', sortOrder: 1, budget: null },
  ];

  // Categorías de ingresos
  const incomeCategories: Omit<Category, 'id'>[] = [
    { name: 'Salario Mensual', type: 'income', groupId: incomeGroupIds[0] as number, icon: 'cash', color: '#69DB7C', sortOrder: 1, budget: null },
    { name: 'Bonos', type: 'income', groupId: incomeGroupIds[0] as number, icon: 'gift', color: '#8CE99A', sortOrder: 2, budget: null },
    { name: 'Proyectos', type: 'income', groupId: incomeGroupIds[1] as number, icon: 'laptop', color: '#74C0FC', sortOrder: 1, budget: null },
    { name: 'Dividendos', type: 'income', groupId: incomeGroupIds[2] as number, icon: 'trending-up', color: '#FFD43B', sortOrder: 1, budget: null },
    { name: 'Intereses', type: 'income', groupId: incomeGroupIds[2] as number, icon: 'cash', color: '#FFA94D', sortOrder: 2, budget: null },
    { name: 'Otros Ingresos', type: 'income', groupId: incomeGroupIds[3] as number, icon: 'ellipsis-horizontal', color: '#ADB5BD', sortOrder: 1, budget: null },
  ];

  await db.categories.bulkAdd([...expenseCategories, ...incomeCategories]);
}

export default db;
