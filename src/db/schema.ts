import { type SQLiteDatabase } from 'expo-sqlite';

export async function initializeDatabase(db: SQLiteDatabase) {
  // Configurar PRAGMAs por separado (importante para evitar NullPointerException)
  try {
    await db.execAsync('PRAGMA journal_mode = WAL;');
  } catch (_) {}
  try {
    await db.execAsync('PRAGMA foreign_keys = ON;');
  } catch (_) {}

  // Crear todas las tablas
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'other',
      currency TEXT NOT NULL DEFAULT 'USD',
      initialBalanceUSD REAL NOT NULL DEFAULT 0,
      initialBalanceBS REAL NOT NULL DEFAULT 0,
      icon TEXT NOT NULL DEFAULT '💰',
      color TEXT NOT NULL DEFAULT '#6366F1',
      isActive INTEGER NOT NULL DEFAULT 1,
      platform TEXT,
      createdAt TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS category_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      icon TEXT NOT NULL DEFAULT '📁',
      color TEXT NOT NULL DEFAULT '#6B7280',
      type TEXT NOT NULL DEFAULT 'expense',
      sortOrder INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      icon TEXT NOT NULL DEFAULT '📦',
      color TEXT NOT NULL DEFAULT '#6366F1',
      type TEXT NOT NULL DEFAULT 'expense',
      budget REAL,
      groupId INTEGER REFERENCES category_groups(id),
      sortOrder INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      description TEXT NOT NULL,
      amountUSD REAL,
      amountBS REAL,
      currency TEXT NOT NULL DEFAULT 'USD',
      exchangeRate REAL,
      accountId INTEGER NOT NULL,
      transferToAccountId INTEGER,
      categoryId INTEGER NOT NULL,
      date TEXT NOT NULL,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      notes TEXT,
      FOREIGN KEY (accountId) REFERENCES accounts(id),
      FOREIGN KEY (transferToAccountId) REFERENCES accounts(id),
      FOREIGN KEY (categoryId) REFERENCES categories(id)
    );

    CREATE TABLE IF NOT EXISTS goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      targetAmount REAL NOT NULL,
      currentAmount REAL NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'USD',
      accountId INTEGER,
      deadline TEXT,
      periodType TEXT NOT NULL DEFAULT 'none',
      celebratedAt TEXT,
      lastProgressAt TEXT,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (accountId) REFERENCES accounts(id)
    );

    CREATE TABLE IF NOT EXISTS goal_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      goalId INTEGER NOT NULL,
      name TEXT NOT NULL,
      targetAmount REAL NOT NULL,
      currentAmount REAL NOT NULL DEFAULT 0,
      isCompleted INTEGER NOT NULL DEFAULT 0,
      sortOrder INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (goalId) REFERENCES goals(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS exchange_rates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rateType TEXT NOT NULL,
      rateUSDToBS REAL NOT NULL,
      date TEXT NOT NULL,
      source TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      amountUSD REAL,
      amountBS REAL,
      currency TEXT NOT NULL DEFAULT 'USD',
      categoryId INTEGER NOT NULL,
      accountId INTEGER NOT NULL,
      frequency TEXT NOT NULL DEFAULT 'monthly',
      intervalDays INTEGER,
      billingDay INTEGER,
      nextBillingDate TEXT NOT NULL,
      isActive INTEGER NOT NULL DEFAULT 1,
      autoGenerate INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (categoryId) REFERENCES categories(id),
      FOREIGN KEY (accountId) REFERENCES accounts(id)
    );

    CREATE TABLE IF NOT EXISTS debts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      personName TEXT NOT NULL,
      description TEXT,
      amountUSD REAL,
      amountBS REAL,
      currency TEXT NOT NULL DEFAULT 'USD',
      interestRate REAL DEFAULT 0,
      totalAmountUSD REAL,
      totalAmountBS REAL,
      paidAmountUSD REAL NOT NULL DEFAULT 0,
      paidAmountBS REAL NOT NULL DEFAULT 0,
      dueDate TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      notes TEXT,
      createdAt TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS debt_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      debtId INTEGER NOT NULL,
      amountUSD REAL NOT NULL DEFAULT 0,
      amountBS REAL NOT NULL DEFAULT 0,
      date TEXT NOT NULL,
      notes TEXT,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (debtId) REFERENCES debts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS budget_allocations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      categoryId INTEGER NOT NULL,
      month TEXT NOT NULL,
      amountUSD REAL NOT NULL DEFAULT 0,
      amountBS REAL NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (categoryId) REFERENCES categories(id) ON DELETE CASCADE,
      UNIQUE(categoryId, month)
    );
  `);

  // --- Migración: Agregar columnas faltantes (para BD creadas antes de esta actualización) ---
  // Usamos try-catch porque CREATE TABLE IF NOT EXISTS ya pudo haber creado las columnas
  try {
    await db.execAsync('ALTER TABLE categories ADD COLUMN groupId INTEGER REFERENCES category_groups(id)');
  } catch (_) {
    // Columna ya existe, ignorar
  }
  try {
    await db.execAsync('ALTER TABLE categories ADD COLUMN sortOrder INTEGER NOT NULL DEFAULT 0');
  } catch (_) {
    // Columna ya existe, ignorar
  }
  try {
    await db.execAsync('ALTER TABLE goals ADD COLUMN periodType TEXT NOT NULL DEFAULT \'none\'');
  } catch (_) {
    // Columna ya existe, ignorar
  }
  try {
    await db.execAsync('ALTER TABLE goals ADD COLUMN celebratedAt TEXT');
  } catch (_) {
    // Columna ya existe, ignorar
  }
  try {
    await db.execAsync('ALTER TABLE goals ADD COLUMN lastProgressAt TEXT');
  } catch (_) {
    // Columna ya existe, ignorar
  }

  // --- Migración: Crear grupos por defecto si no existen ---
  const groupCount = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM category_groups'
  );

  if (groupCount?.count === 0) {
    // Crear grupos de gastos
    await db.runAsync(
      `INSERT INTO category_groups (name, icon, color, type, sortOrder) VALUES
        ('Necesidades', '📋', '#EF4444', 'expense', 1),
        ('Estilo de Vida', '🎯', '#8B5CF6', 'expense', 2),
        ('Ahorro e Inversión', '💰', '#10B981', 'expense', 3),
        ('Otros Gastos', '📦', '#6B7280', 'expense', 4),
        ('Ingresos', '💼', '#10B981', 'income', 5)`
    );

    // Asignar categorías existentes a grupos según su nombre
    await db.execAsync(`
      UPDATE categories SET groupId = (SELECT id FROM category_groups WHERE name = 'Necesidades')
      WHERE name IN ('Comida', 'Transporte', 'Salud', 'Vivienda', 'Servicios') AND type = 'expense';

      UPDATE categories SET groupId = (SELECT id FROM category_groups WHERE name = 'Estilo de Vida')
      WHERE name IN ('Educación', 'Entretenimiento', 'Ropa') AND type = 'expense';

      UPDATE categories SET groupId = (SELECT id FROM category_groups WHERE name = 'Otros Gastos')
      WHERE name IN ('Otros') AND type = 'expense';

      UPDATE categories SET groupId = (SELECT id FROM category_groups WHERE name = 'Ingresos')
      WHERE name IN ('Salario', 'Freelance', 'Inversiones') AND type = 'income';
    `);
  }

  // --- Migración: Migrar budget de categorías a budget_allocations para el mes actual ---
  const currentMonth = new Date().toISOString().substring(0, 7);
  const allocCount = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM budget_allocations WHERE month = ?',
    [currentMonth]
  );

  if (allocCount?.count === 0) {
    await db.execAsync(`
      INSERT OR IGNORE INTO budget_allocations (categoryId, month, amountUSD)
      SELECT id, '${currentMonth}', budget
      FROM categories
      WHERE budget IS NOT NULL AND budget > 0
    `);
  }

  // Eliminar categorías duplicadas (por si ya se insertaron antes del fix)
  await db.execAsync(`
    DELETE FROM categories WHERE id NOT IN (
      SELECT MIN(id) FROM categories GROUP BY name, type
    );
  `);

  // Insertar categorías por defecto SOLO si la tabla está completamente vacía
  // y no se han insertado antes (usamos una marca en exchange_rates como flag)
  const categoryCount = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM categories');
  const seedFlag = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM exchange_rates WHERE source = '_SEEDED_'"
  );
  if ((categoryCount?.count === 0) && (!seedFlag || seedFlag.count === 0)) {
    // Obtener IDs de grupos
    const necesidades = await db.getFirstAsync<{ id: number }>(
      "SELECT id FROM category_groups WHERE name = 'Necesidades'"
    );
    const estiloVida = await db.getFirstAsync<{ id: number }>(
      "SELECT id FROM category_groups WHERE name = 'Estilo de Vida'"
    );
    const otrosGastos = await db.getFirstAsync<{ id: number }>(
      "SELECT id FROM category_groups WHERE name = 'Otros Gastos'"
    );
    const ingresos = await db.getFirstAsync<{ id: number }>(
      "SELECT id FROM category_groups WHERE name = 'Ingresos'"
    );

    await db.runAsync(
      `INSERT INTO categories (name, icon, color, type, groupId) VALUES
        ('Comida', '🍔', '#EF4444', 'expense', ?),
        ('Transporte', '🚗', '#F59E0B', 'expense', ?),
        ('Salud', '💊', '#10B981', 'expense', ?),
        ('Educación', '📚', '#6366F1', 'expense', ?),
        ('Entretenimiento', '🎮', '#8B5CF6', 'expense', ?),
        ('Vivienda', '🏠', '#EC4899', 'expense', ?),
        ('Servicios', '💡', '#F97316', 'expense', ?),
        ('Ropa', '👕', '#14B8A6', 'expense', ?),
        ('Salario', '💼', '#10B981', 'income', ?),
        ('Freelance', '💻', '#6366F1', 'income', ?),
        ('Inversiones', '📈', '#8B5CF6', 'income', ?),
        ('Otros', '📦', '#6B7280', 'expense', ?)`,
      [
        necesidades?.id || null,
        necesidades?.id || null,
        necesidades?.id || null,
        estiloVida?.id || null,
        estiloVida?.id || null,
        necesidades?.id || null,
        necesidades?.id || null,
        estiloVida?.id || null,
        ingresos?.id || null,
        ingresos?.id || null,
        ingresos?.id || null,
        otrosGastos?.id || null,
      ]
    );
    // Marcar que ya se sembraron las categorías para no repetir
    await db.runAsync(
      "INSERT INTO exchange_rates (rateType, rateUSDToBS, date, source) VALUES ('BCV', 0, datetime('now'), '_SEEDED_')"
    );
  }
}
