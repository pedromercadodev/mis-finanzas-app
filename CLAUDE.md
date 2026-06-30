# Finanzas App - Documentación del Proyecto

App de finanzas personales para Venezuela con soporte multidivisa (USD/BS), tasas de cambio en tiempo real, presupuestos estilo YNAB, metas con sub-items, y más.

---

## Stack Técnico

| Tecnología | Versión | Uso |
|---|---|---|
| **Expo** | SDK 54 | Framework principal |
| **React Native** | 0.81.5 | UI nativa |
| **expo-router** | ~6.0.24 | Enrutamiento basado en archivos |
| **expo-sqlite** | ~16.0.10 | Base de datos local SQLite |
| **Zustand** | ^5.0.14 | Estado global |
| **NativeWind** | ^4.2.6 | Estilos con TailwindCSS |
| **react-native-reanimated** | ~4.1.1 | Animaciones |
| **TypeScript** | ~5.9.2 | Tipado estático |

---

## Estructura del Proyecto

```
finanzas-app/
├── app/                          # Pantallas (expo-router)
│   ├── _layout.tsx               # Layout raíz (StatusBar, tema)
│   ├── (tabs)/
│   │   ├── _layout.tsx           # Layout de tabs (AnimatedTabBar)
│   │   ├── index.tsx             # Dashboard / Resumen
│   │   ├── accounts.tsx          # Lista de cuentas
│   │   ├── transactions.tsx      # Movimientos con filtros
│   │   ├── budgets.tsx           # Presupuestos estilo YNAB
│   │   ├── goals.tsx             # Metas con sub-items
│   │   └── settings.tsx          # Ajustes
│   ├── account/
│   │   ├── new.tsx               # Crear cuenta
│   │   └── [id].tsx              # Detalle de cuenta
│   └── categories/
│       └── index.tsx             # Gestión de categorías y grupos
├── src/
│   ├── components/
│   │   ├── AnimatedTabBar.tsx     # Barra de tabs animada
│   │   └── AnimatedTransition.tsx # Transición entre pantallas
│   ├── db/
│   │   └── schema.ts             # Esquema SQLite + migraciones
│   ├── hooks/
│   │   ├── useExchangeRates.ts   # Hook de tasas de cambio
│   │   └── useThemeColors.ts     # Hook de colores del tema
│   ├── services/
│   │   ├── database.ts           # Singleton de conexión BD
│   │   ├── accounts.ts           # CRUD cuentas
│   │   ├── transactions.ts       # CRUD transacciones + resúmenes
│   │   ├── categories.ts         # CRUD categorías
│   │   ├── categoryGroups.ts     # CRUD grupos de categorías
│   │   ├── budgetAllocations.ts  # Asignaciones presupuestarias
│   │   ├── goals.ts              # CRUD metas
│   │   ├── goalItems.ts          # CRUD sub-items de metas
│   │   └── exchangeRate.ts       # Tasas de cambio + APIs
│   ├── store/
│   │   ├── useSettings.ts        # Estado global de ajustes
│   │   ├── useAccounts.ts        # Estado global de cuentas
│   │   └── useTransactions.ts    # Estado global de transacciones
│   ├── theme/
│   │   └── colors.ts             # Paleta de colores (claro/oscuro)
│   └── utils/
│       ├── types.ts              # Tipos e interfaces
│       └── format.ts             # Formateo de moneda/fechas
├── CLAUDE.md                     # Este archivo
├── AGENTS.md                     # Notas sobre cambios en Expo
├── app.json                      # Configuración Expo
└── package.json
```

---

## Funcionalidades Principales

### 1. Dashboard (`app/(tabs)/index.tsx`)
- **Saldo Total** con soporte multidivisa (USD + BS convertido y viceversa)
- **Filtro de cuentas** en tarjeta de saldo total: mantener presionado para elegir entre "Solo USD", "Solo BS" o "Multidivisa"
- **Widget de Tasas de Cambio** (BCV y Paralelo) con última actualización
- Tap en cada tasa para cambiar la tasa preferida de cálculo
- **Resumen del Mes**: ingresos y gastos combinados (USD+BS convertidos)
- **Últimos Movimientos**: últimos 5 registros
- **Tarjetas de Cuentas**: cada cuenta con su saldo principal y convertido
- Pull-to-refresh para recargar todo

### 2. Cuentas (`app/(tabs)/accounts.tsx`)
- Lista de cuentas con saldo en USD y BS
- **Visualización simétrica**: si la cuenta tiene USD → muestra USD grande + BS pequeño estimado. Si solo tiene BS → BS grande + USD pequeño estimado
- Tap en una cuenta para ver detalle
- Botón flotante para crear nueva cuenta

### 3. Detalle de Cuenta (`app/account/[id].tsx`)
- Saldo principal grande + convertido pequeño
- Balance cards: ingresos, gastos, transfers
- Lista de transacciones de la cuenta
- Botones: editar cuenta, nueva transacción, eliminar cuenta
- Auto-refresh al recibir foco

### 4. Crear Cuenta (`app/account/new.tsx`)
- Nombre, tipo (exchange/bank/virtual_card/cash/other), ícono, color
- Saldo inicial en USD y/o BS
- Soporte multidivisa desde la creación

### 5. Transacciones (`app/(tabs)/transactions.tsx`)
- **Filtros por período**: Hoy, Semana, Mes, Año (zona horaria UTC-4 Venezuela)
- **Resumen del período**: ingresos, gastos y balance neto combinados (USD+BS)
- Lista de transacciones con ícono, descripción, categoría, montos
- Modal para crear: tipo (ingreso/gasto/transferencia), cuenta, categoría, montos USD/BS
- Soporte para transferencias entre cuentas
- Auto-refresh al recibir foco

### 6. Presupuestos (`app/(tabs)/budgets.tsx`)
- **Sistema estilo YNAB**: grupos de categorías con asignaciones mensuales
- Grupos expandibles con progreso general
- Cada categoría muestra: asignado, gastado, porcentaje, barra de progreso
- Alerta visual (rojo) cuando el gasto supera el 80%
- Modal para asignar presupuesto mensual a cada categoría
- Auto-refresh al recibir foco

### 7. Categorías (`app/categories/index.tsx`)
- **Gestión de Grupos**: crear, editar, eliminar grupos (icono, color, tipo)
- Grupos por defecto: Necesidades, Estilo de Vida, Ahorro, Otros Gastos, Ingresos
- Categorías organizadas por tipo (gasto/ingreso) con su grupo asignado
- Modal para crear/editar categorías: nombre, tipo, grupo, ícono, color
- Grupos separados por tipo (expense/income)

### 8. Metas (`app/(tabs)/goals.tsx`)
- **Sub-items (meta items)**: crear items dentro de cada meta (ej: "Compu" → "Placa base", "Procesador")
- **Tipos de plazo**: Sin fecha, Semanal, Mensual
- **Círculo de progreso** con dos semicírculos (soporta 0-100%)
- **Celebración**: modal con confeti virtual al completar una meta
- **Mensajes alentadores**: aparecen al alcanzar 10%, 25%, 50%, 75%, 90%
- **Recordatorios semanales**: si no hay progreso en una semana, muestra mensaje motivacional
- **Abonar a meta**: botón verde para depositar dinero directamente a la meta
- Progreso de items se sincroniza automáticamente con el progreso de la meta
- Auto-refresh al recibir foco

### 9. Ajustes (`app/(tabs)/settings.tsx`)
- **Tasas de Cambio**: ver BCV y Paralelo con fuente y última actualización
- **Actualizar tasas**: botón para refrescar desde las APIs
- **Tasa manual**: opción de ingresar tasa personalizada
- **Selector de tasa preferida**: BCV o Paralelo para cálculos de BS total
- **Modo Oscuro**: toggle para cambiar entre tema claro/oscuro
- **DeepSeek API**: configuración para entrada por IA (opcional)

---

## Base de Datos (SQLite)

### Tablas

#### `accounts`
| Columna | Tipo | Descripción |
|---|---|---|
| id | INTEGER PK | Auto-increment |
| name | TEXT | Nombre de la cuenta |
| type | TEXT | exchange, bank, virtual_card, cash, other |
| currency | TEXT | USD, BS, BOTH |
| initialBalanceUSD | REAL | Saldo inicial en USD |
| initialBalanceBS | REAL | Saldo inicial en BS |
| icon | TEXT | Emoji del ícono |
| color | TEXT | Color hex |
| isActive | INTEGER | Soft delete (0/1) |
| createdAt | TEXT | Fecha de creación |

#### `category_groups`
| Columna | Tipo | Descripción |
|---|---|---|
| id | INTEGER PK | Auto-increment |
| name | TEXT | Nombre del grupo |
| icon | TEXT | Emoji del ícono |
| color | TEXT | Color hex |
| type | TEXT | expense o income |
| sortOrder | INTEGER | Orden de visualización |
| createdAt | TEXT | Fecha de creación |

#### `categories`
| Columna | Tipo | Descripción |
|---|---|---|
| id | INTEGER PK | Auto-increment |
| name | TEXT | Nombre de la categoría |
| icon | TEXT | Emoji del ícono |
| color | TEXT | Color hex |
| type | TEXT | expense o income |
| budget | REAL | Presupuesto (legacy, migrado a budget_allocations) |
| groupId | INTEGER FK | Referencia a category_groups(id) |
| sortOrder | INTEGER | Orden de visualización |

#### `transactions`
| Columna | Tipo | Descripción |
|---|---|---|
| id | INTEGER PK | Auto-increment |
| type | TEXT | income, expense, transfer |
| description | TEXT | Descripción |
| amountUSD | REAL | Monto en USD (nullable) |
| amountBS | REAL | Monto en BS (nullable) |
| currency | TEXT | USD, BS, BOTH |
| exchangeRate | REAL | Tasa usada al momento |
| accountId | INTEGER FK | Cuenta origen |
| transferToAccountId | INTEGER FK | Cuenta destino (solo transfers) |
| categoryId | INTEGER FK | Categoría |
| date | TEXT | Fecha de la transacción |
| createdAt | TEXT | Fecha de creación |
| notes | TEXT | Notas adicionales |

#### `goals`
| Columna | Tipo | Descripción |
|---|---|---|
| id | INTEGER PK | Auto-increment |
| name | TEXT | Nombre de la meta |
| targetAmount | REAL | Monto objetivo |
| currentAmount | REAL | Monto actual |
| currency | TEXT | USD o BS |
| accountId | INTEGER FK | Cuenta asociada |
| deadline | TEXT | Fecha límite |
| periodType | TEXT | none, weekly, monthly |
| celebratedAt | TEXT | Fecha de celebración (null si no celebrada) |
| lastProgressAt | TEXT | Última vez que hubo progreso |
| createdAt | TEXT | Fecha de creación |

#### `goal_items`
| Columna | Tipo | Descripción |
|---|---|---|
| id | INTEGER PK | Auto-increment |
| goalId | INTEGER FK | Meta padre (CASCADE DELETE) |
| name | TEXT | Nombre del item |
| targetAmount | REAL | Monto objetivo del item |
| currentAmount | REAL | Monto actual del item |
| isCompleted | INTEGER | 0/1 |
| sortOrder | INTEGER | Orden de visualización |
| createdAt | TEXT | Fecha de creación |

#### `exchange_rates`
| Columna | Tipo | Descripción |
|---|---|---|
| id | INTEGER PK | Auto-increment |
| rateType | TEXT | BCV o PARALLEL |
| rateUSDToBS | REAL | Tasa (USD → BS) |
| date | TEXT | Fecha de la tasa |
| source | TEXT | Fuente (dolarapi.com, Binance P2P, etc.) |

#### `budget_allocations`
| Columna | Tipo | Descripción |
|---|---|---|
| id | INTEGER PK | Auto-increment |
| categoryId | INTEGER FK | Categoría (CASCADE DELETE) |
| month | TEXT | Mes en formato YYYY-MM |
| amountUSD | REAL | Monto asignado en USD |
| amountBS | REAL | Monto asignado en BS |
| createdAt | TEXT | Fecha de creación |
| updatedAt | TEXT | Fecha de actualización |
| **UNIQUE**(categoryId, month) | | Una asignación por categoría/mes |

### Migración automática
En [`schema.ts`](finanzas-app/src/db/schema.ts), la función `initializeDatabase()`:
1. Crea todas las tablas con `CREATE TABLE IF NOT EXISTS`
2. Intenta agregar columnas faltantes con `ALTER TABLE` envuelto en `try-catch` (para BD existentes)
3. Crea grupos por defecto si no existen
4. Migra `budget` de categorías a `budget_allocations` para el mes actual
5. Elimina categorías duplicadas
6. Inserta categorías por defecto solo si la tabla está vacía (usando flag `_SEEDED_`)

---

## Servicios

### `database.ts`
- [`getDatabase()`](finanzas-app/src/services/database.ts:6) - Singleton que abre/conecta SQLite y ejecuta `initializeDatabase()` una sola vez

### `accounts.ts`
- [`getAccounts()`](finanzas-app/src/services/accounts.ts:4) - Obtiene cuentas activas
- [`getAccountById(id)`](finanzas-app/src/services/accounts.ts:11) - Obtiene una cuenta por ID
- [`createAccount(account)`](finanzas-app/src/services/accounts.ts:19) - Crea nueva cuenta
- [`updateAccount(id, partial)`](finanzas-app/src/services/accounts.ts:38) - Actualiza campos de cuenta
- [`deleteAccount(id)`](finanzas-app/src/services/accounts.ts:61) - Soft delete (isActive = 0)
- [`getAccountBalance(id)`](finanzas-app/src/services/accounts.ts:66) - Calcula balance actual (saldo inicial + ingresos - gastos - transfers out + transfers in)

### `transactions.ts`
- [`getTransactions(options?)`](finanzas-app/src/services/transactions.ts:4) - Lista transacciones con filtros opcionales (accountId, month, limit)
- [`getTransactionById(id)`](finanzas-app/src/services/transactions.ts:32) - Obtiene una transacción
- [`createTransaction(tx)`](finanzas-app/src/services/transactions.ts:37) - Crea transacción
- [`updateTransaction(id, partial)`](finanzas-app/src/services/transactions.ts:59) - Actualiza campos
- [`deleteTransaction(id)`](finanzas-app/src/services/transactions.ts:81) - Elimina transacción
- [`getMonthlySummary(month)`](finanzas-app/src/services/transactions.ts:86) - Resumen de ingresos/gastos USD+BS de un mes (YYYY-MM)
- [`getPeriodSummary(startDate, endDate)`](finanzas-app/src/services/transactions.ts:112) - Resumen para un rango de fechas

### `categories.ts`
- [`getCategories(type?)`](finanzas-app/src/services/categories.ts:4) - Lista categorías (opcional: filtrar por tipo)
- [`getCategoriesWithGroups(type?)`](finanzas-app/src/services/categories.ts:18) - Categorías con nombre del grupo (JOIN)
- [`getCategoriesByGroup(groupId)`](finanzas-app/src/services/categories.ts:36) - Categorías de un grupo específico
- [`createCategory(category)`](finanzas-app/src/services/categories.ts:48) - Crea categoría con groupId y sortOrder
- [`updateCategory(id, partial)`](finanzas-app/src/services/categories.ts:57) - Actualiza categoría
- [`deleteCategory(id)`](finanzas-app/src/services/categories.ts:76) - Elimina categoría

### `categoryGroups.ts`
- [`getGroups(type?)`](finanzas-app/src/services/categoryGroups.ts:4) - Lista grupos (opcional: filtrar por tipo)
- [`getGroupById(id)`](finanzas-app/src/services/categoryGroups.ts:18) - Obtiene un grupo
- [`createGroup(data)`](finanzas-app/src/services/categoryGroups.ts:26) - Crea grupo
- [`updateGroup(id, partial)`](finanzas-app/src/services/categoryGroups.ts:35) - Actualiza grupo
- [`deleteGroup(id)`](finanzas-app/src/services/categoryGroups.ts:52) - Elimina grupo (reasigna categorías a null)

### `budgetAllocations.ts`
- [`getAllocation(categoryId, month)`](finanzas-app/src/services/budgetAllocations.ts:6) - Obtiene asignación de una categoría en un mes
- [`setAllocation(categoryId, month, amountUSD, amountBS?)`](finanzas-app/src/services/budgetAllocations.ts:14) - Crea o actualiza asignación (UPSERT)
- [`getMonthAllocations(month)`](finanzas-app/src/services/budgetAllocations.ts:32) - Todas las asignaciones de un mes
- [`getSpendingByCategory(month)`](finanzas-app/src/services/budgetAllocations.ts:40) - Gasto real por categoría en un mes
- [`getGroupSummaries(month)`](finanzas-app/src/services/budgetAllocations.ts:55) - Resumen completo: grupos con categorías, asignaciones y gastos

### `goals.ts`
- [`getGoals()`](finanzas-app/src/services/goals.ts:4) - Lista todas las metas
- [`createGoal(goal)`](finanzas-app/src/services/goals.ts:9) - Crea meta (incluye periodType, celebratedAt, lastProgressAt)
- [`updateGoalProgress(id, amount)`](finanzas-app/src/services/goals.ts:19) - Incrementa currentAmount y actualiza lastProgressAt
- [`deleteGoal(id)`](finanzas-app/src/services/goals.ts:27) - Elimina meta
- [`markGoalCelebrated(id)`](finanzas-app/src/services/goals.ts:32) - Marca meta como celebrada

### `goalItems.ts`
- [`getItemsByGoalId(goalId)`](finanzas-app/src/services/goalItems.ts:4) - Items de una meta
- [`createItem(data)`](finanzas-app/src/services/goalItems.ts:12) - Crea item
- [`updateItemProgress(id, amount)`](finanzas-app/src/services/goalItems.ts:22) - Incrementa currentAmount del item
- [`toggleItemCompleted(id)`](finanzas-app/src/services/goalItems.ts:30) - Alterna isCompleted
- [`deleteItem(id)`](finanzas-app/src/services/goalItems.ts:38) - Elimina item
- [`recalculateGoalProgress(goalId)`](finanzas-app/src/services/goalItems.ts:43) - Suma currentAmount de todos los items y actualiza currentAmount de la meta

### `exchangeRate.ts`
- [`getLatestRate()`](finanzas-app/src/services/exchangeRate.ts:4) - Última tasa guardada
- [`getLatestRateByType(type)`](finanzas-app/src/services/exchangeRate.ts:11) - Última tasa por tipo (BCV/PARALLEL)
- [`saveRate(rate)`](finanzas-app/src/services/exchangeRate.ts:19) - Guarda tasa en BD
- [`fetchDolarApiRates()`](finanzas-app/src/services/exchangeRate.ts:38) - API principal: GET https://ve.dolarapi.com/v1/dolares (devuelve BCV y Paralelo)
- [`fetchBinanceRate()`](finanzas-app/src/services/exchangeRate.ts:69) - Fallback paralelo: POST Binance P2P (mejor precio de 5 resultados)
- [`fetchYadioRate()`](finanzas-app/src/services/exchangeRate.ts:103) - Fallback paralelo: GET https://api.yadio.io/exrates/USD
- [`fetchParallelRate()`](finanzas-app/src/services/exchangeRate.ts:122) - Cadena: DolarAPI → Binance → Yadio
- [`fetchBCVFromExchangeRateAPI()`](finanzas-app/src/services/exchangeRate.ts:144) - Fallback BCV: GET https://api.exchangerate-api.com/v4/latest/USD
- [`fetchBCVRate()`](finanzas-app/src/services/exchangeRate.ts:162) - Cadena: DolarAPI → ExchangeRate-API
- [`updateExchangeRates()`](finanzas-app/src/services/exchangeRate.ts:181) - Actualiza ambas tasas y las guarda en BD

---

## Stores (Zustand)

### `useSettings`
- `deepseekKey: string` - Clave API de DeepSeek
- `manualRate: number | null` - Tasa manual ingresada por el usuario
- `useDarkMode: boolean` - Modo oscuro
- `preferredRateType: 'BCV' | 'PARALLEL'` - Tasa preferida para cálculos de BS total
- Setters: `setDeepseekKey`, `setManualRate`, `setUseDarkMode`, `setPreferredRateType`

### `useAccounts`
- `accounts: Account[]` - Lista de cuentas
- `loading: boolean` - Estado de carga
- `loadAccounts()` - Carga cuentas desde BD
- `addAccount(account)` - Crea cuenta y refresca
- `removeAccount(id)` - Soft delete y refresca

### `useTransactions`
- `transactions: Transaction[]` - Lista de transacciones
- `loading: boolean` - Estado de carga
- `loadTransactions(options?)` - Carga transacciones con filtros
- `addTransaction(tx)` - Crea transacción y refresca
- `removeTransaction(id)` - Elimina y refresca

---

## Hooks

### `useExchangeRates(autoRefreshInterval?)`
Hook para obtener y gestionar tasas de cambio en tiempo real.
- `bcv: ExchangeRate | null` - Última tasa BCV
- `parallel: ExchangeRate | null` - Última tasa Paralelo
- `loading: boolean` - Estado de carga
- `lastUpdated: Date | null` - Última actualización
- `error: string | null` - Mensaje de error
- `refresh()` - Actualiza desde APIs
- `loadFromDB()` - Carga desde BD
- Auto-refresh opcional con intervalo en ms

### `useThemeColors()`
Retorna el objeto de colores según el tema actual (claro/oscuro).
- `useDarkMode` de `useSettings` determina qué paleta usar
- Colores: background, surface, primary, text, textSecondary, success, danger, warning, usd, bs, border, shadow, etc.

---

## APIs de Tasas de Cambio

### Principal: DolarAPI
- **Endpoint**: `GET https://ve.dolarapi.com/v1/dolares`
- **Respuesta**: Array con objetos que tienen `fuente` ("oficial" | "paralelo") y `promedio`
- **Uso**: Obtiene BCV y Paralelo en una sola llamada

### Fallback Paralelo
1. **Binance P2P**: `POST https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search` - Mejor precio de compra USDT/VES
2. **Yadio.io**: `GET https://api.yadio.io/exrates/USD` - Tasa del mercado paralelo

### Fallback BCV
1. **ExchangeRate-API**: `GET https://api.exchangerate-api.com/v4/latest/USD` - Tasa oficial VES

---

## Temas (Claro/Oscuro)

### Modo Claro
- Fondo: `#F8F9FA`
- Superficie: `#FFFFFF`
- Primario: `#6366F1`
- Texto: `#1A1A2E`

### Modo Oscuro
- Fondo: `#0F172A`
- Superficie: `#1E293B`
- Primario: `#818CF8`
- Texto: `#F1F5F9`

---

## Componentes UI

### `AnimatedTabBar`
Barra de navegación inferior con 6 tabs (Resumen, Cuentas, Movimientos, Presupuestos, Metas, Ajustes).
- Indicador deslizante animado
- Escala de icono al seleccionar
- Fondo con `overflow: 'hidden'` para bordes redondeados
- Sombra superior (elevation)

### `AnimatedTransition`
Transición entre pantallas con animación combinada:
- Slide horizontal (dirección según orden de tabs)
- Fade simultáneo
- Scale sutil (0.97 → 1.0)
- Fondo sincronizado con el tema

---

## Flujo de Navegación

```
Root Layout (_layout.tsx)
├── StatusBar (light/dark según tema)
└── Stack
    ├── (tabs) - Layout de pestañas
    │   ├── index        → Dashboard
    │   ├── accounts     → Lista de cuentas
    │   ├── transactions → Movimientos
    │   ├── budgets      → Presupuestos
    │   ├── goals        → Metas
    │   └── settings     → Ajustes
    ├── account/new      → Modal: Crear cuenta
    └── account/[id]     → Modal: Detalle de cuenta
```

## Patrones y Convenciones

- **Auto-refresh**: Todas las pantallas usan `useFocusEffect` de expo-router para recargar datos al recibir foco
- **Cálculo multidivisa**: `totalUSD = rawTotalUSD + (rawTotalBS / rate)`, `totalBS = rawTotalBS + (rawTotalUSD * rate)`
- **Tasa activa**: Se obtiene con `getActiveRate()` que prioriza: tasa manual → tasa preferida (BCV/Paralelo) → null
- **Filtro de período**: `getPeriodDates()` con zona horaria UTC-4 (Venezuela) para Hoy/Semana/Mes/Año
- **Mensajes alentadores (Metas)**: Sistema con umbrales (10/25/50/75/90%) y recordatorios semanales usando `lastProgressAt`
- **Círculo de progreso**: Dos semicírculos (derecho 0-50%, izquierdo 50-100%) para visualización completa
- **Migración BD**: `try-catch` alrededor de `ALTER TABLE` para compatibilidad con BD existentes
- **Toast**: Sistema simple con estado `toastVisible`, `toastMessage`, `toastType` ('success' | 'info' | 'error')
