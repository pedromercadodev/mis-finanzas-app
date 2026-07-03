# 🏦 Mis Finanzas

Aplicación móvil de finanzas personales construida con **React Native (Expo)** para gestionar cuentas, transacciones, presupuestos, metas, suscripciones, deudas, billeteras digitales y más.

> **Diseñada para Venezuela** — Soporte nativo para **USD + BS** (Bolívares) con tasas de cambio automáticas (BCV/Paralelo) y múltiples fuentes de respaldo.

---

## 📋 Historial de Versiones

### v2.1.0 (Actual)
- 🐛 **Bugfix 1** — Selector de moneda (USD/BS/BOTH) en crear cuenta
- 🐛 **Bugfix 2** — Edición completa de cuenta (nombre, tipo, moneda, icono, color)
- 🐛 **Bugfix 3** — Selector de cuenta destino en transferencias
- 🐛 **Bugfix 4** — Validación de saldo suficiente en gastos y transferencias
- 🐛 **Bugfix 5** — Selector de moneda en suscripciones
- 🐛 **Bugfix 6** — Cálculo correcto de próxima facturación según frecuencia
- 🐛 **Bugfix 7** — Selector BCV/Paralelo para tasa manual
- 🐛 **Bugfix 8** — Botón "Quitar tasa manual (volver a automática)"
- 🏠 **Resumen de Metas** en el Dashboard con barra de progreso
- 🔔 **Alertas de Suscripciones** próximas a vencer en Dashboard
- 🤖 **System Prompt reforzado** — DeepSeek ahora SIEMPRE pide confirmación y usa `ACCION:` para TODA operación (17 acciones)
- 🌡️ **Temperature 0.1** — Respuestas más deterministas y disciplinadas

### v2.0.0
- ✨ **Exportación de Datos** — CSV y JSON con expo-sharing
- 📊 **Reportes Gráficos** — PieChart (gastos/ingresos por categoría) y LineChart (flujo de caja)
- 🔄 **Suscripciones** — Gastos recurrentes con frecuencia semanal/mensual/anual y procesamiento automático
- 💰 **Deudas y Préstamos** — Registro de pagos, barra de progreso, intereses, badges de estado
- 🪙 **Billeteras Digitales** — Cuentas agrupadas por plataforma (Binance, Coinbase, etc.) con widget en Dashboard
- 🐛 **Fix migración** — Columna `platform` con `PRAGMA table_info` para evitar errores en BD existentes

### v1.0.0
- 🏠 Dashboard con resumen de saldos y tasas de cambio
- 💳 Cuentas bancarias, efectivo y ahorro (USD/BS/BOTH)
- 💸 Transacciones con categorización y filtros por período
- 📊 Presupuestos estilo YNAB por grupos de categorías
- 🎯 Metas con sub-metas, progreso visual y celebración
- 🌐 Tasas de cambio automáticas (BCV + Paralelo + Binance)
- 🤖 Entrada por IA con DeepSeek
- 🌙 Modo oscuro/claro automático

---

##  Capturas

| Dashboard | Cuentas | Transacciones | Reportes |
|:---------:|:-------:|:-------------:|:--------:|
| Resumen general con saldos, tasas y accesos rápidos | Cuentas bancarias, efectivo y billeteras digitales | Ingresos, gastos y transferencias | Gráficos de gastos por categoría y flujo de caja |

---

## ✨ Funcionalidades

### 🏠 Dashboard
- Resumen de saldo total en USD y BS
- Widget de **tasas de cambio** (BCV y Paralelo) en tiempo real
- **Accesos Rápidos** a Deudas, Presupuestos y Metas
- **Billeteras Digitales** — cuentas agrupadas por plataforma (Binance, Coinbase, etc.)
- Lista de cuentas con saldos individuales
- Últimas transacciones
- Pull-to-refresh

### 💳 Cuentas
- Crear cuentas con tipo (banco, efectivo, ahorro, inversión, cripto, etc.)
- Soporte para **USD**, **BS** o **BOTH** (doble moneda)
- **Plataforma** opcional para agrupar billeteras digitales
- Iconos y colores personalizables
- Saldo en tiempo real basado en transacciones
- Transferencias entre cuentas

### 💸 Transacciones
- Ingresos, gastos y transferencias
- Filtros por período: **Hoy**, **Semana**, **Mes**, **Año**
- Totales calculados por período
- Categorización con iconos y colores
- Modal de creación rápida

### 📊 Presupuestos (Estilo YNAB)
- Presupuesto mensual por **grupos de categorías**
- Progreso visual tipo dona con porcentaje
- Sobregiro resaltado en rojo
- Resumen de gasto vs presupuestado

### 🎯 Metas
- Metas con **sub-metas** (items)
- Progreso visual con círculo
- Tipo de plazo: **none**, **weekly**, **monthly**
- Depósitos directos desde una cuenta
- **Celebración** al completar la meta (modal con confeti)
- Mensajes alentadores según el progreso

### 📈 Reportes Gráficos
- **Gastos por categoría** (PieChart)
- **Ingresos por categoría** (PieChart)
- **Flujo de caja** histórico (LineChart)
- Selector de período
- Tarjetas de resumen (ingresos, gastos, neto)

### 🔄 Suscripciones y Gastos Recurrentes
- Suscripciones con frecuencia: **semanal**, **mensual**, **anual**, **personalizada**
- Cálculo automático de próxima fecha de facturación
- **Procesamiento automático** al abrir la pantalla (genera transacciones vencidas)
- Badges: **VENCIDA** (rojo), **PRONTO** (amarillo)
- Activar/desactivar suscripciones
- Procesamiento manual con botón

### 💰 Deudas y Préstamos
- Tipos: **Debo** (lo que debes) / **Me deben** (lo que te deben)
- Soporte USD, BS o BOTH
- Tasa de interés opcional
- **Registro de pagos** con fecha, monto y notas
- Barra de progreso de pago
- Badges de estado: **Al día**, **Atrasada**, **Pagada**
- Resumen: total prestado, total recibido, balance neto
- Filtros: Todas, Activas, Pagadas

### 🪙 Billeteras Digitales y Cripto
- Campo **"Plataforma"** al crear cuentas (Binance, Coinbase, Facebank, etc.)
- Widget en Dashboard que agrupa cuentas por plataforma
- Totales por plataforma en USD y BS

### 📤 Exportación de Datos
- Exportar a **CSV** o **JSON**
- Compartir mediante **expo-sharing**
- Exporta: cuentas, transacciones, categorías, presupuestos, metas, suscripciones, deudas

### ⚙️ Ajustes
- Configuración de **API Key de DeepSeek** para entrada por IA
- **Tasas de cambio** automáticas (BCV y Paralelo) con botón de actualización
- **Tasa manual** con selector BCV/Paralelo y opción "Quitar tasa manual" para volver a tasas automáticas
- Selector de tasa preferida para cálculo de BS total
- Exportar datos
- Navegación a: Categorías, Deudas y Préstamos
- Modo oscuro/claro (sigue al sistema)

---

## 🛠️ Stack Técnico

| Tecnología | Versión | Propósito |
|-----------|---------|-----------|
| **React Native** | 0.81.5 | Framework móvil |
| **Expo** | SDK 54 | Plataforma de desarrollo |
| **TypeScript** | ~5.9.2 | Tipado estático |
| **expo-router** | ~6.0.24 | Enrutamiento basado en archivos |
| **expo-sqlite** | ^16.0.10 | Base de datos local SQLite |
| **Zustand** | ^5.0.14 | Estado global con persistencia |
| **@react-native-async-storage/async-storage** | ^2.2.0 | Almacenamiento persistente para Zustand y chat |
| **react-native-reanimated** | ~4.1.1 | Animaciones |
| **react-native-gesture-handler** | ~2.28.0 | Gestos táctiles |
| **react-native-safe-area-context** | ~5.6.0 | Área segura del dispositivo |
| **react-native-screens** | ~4.16.0 | Optimización de pantallas |
| **react-native-chart-kit** | ^7.0.1 | Gráficos (PieChart, LineChart) |
| **react-native-svg** | 15.12.1 | Renderizado SVG para gráficos |
| **react-native-markdown-display** | ^7.0.2 | Renderizado Markdown en chat IA |
| **expo-file-system** | ~19.0.23 | Exportación de archivos |
| **expo-sharing** | ~14.0.8 | Compartir archivos exportados |
| **expo-constants** | ~18.0.13 | Constantes de Expo |
| **expo-linking** | ~8.0.12 | Enlaces profundos |
| **expo-status-bar** | ~3.0.9 | Barra de estado |
| **expo-system-ui** | ~6.0.9 | UI del sistema |
| **@expo/vector-icons** | ^15.1.1 | Iconos (Ionicons) |
| **NativeWind** | ^4.2.6 | Estilos con Tailwind CSS |
| **tailwindcss-react-native** | ^1.7.10 | Integración Tailwind + React Native |
| **react-native-css-interop** | ^0.2.6 | Interoperabilidad CSS |
| **react-native-worklets** | 0.8.3 | Worklets para Reanimated |
| **drizzle-orm** | ^0.45.2 | ORM ligero (uso parcial) |

---

## 🗄️ Gestión de Datos

### Base de Datos Local (SQLite)

La aplicación utiliza **SQLite** como base de datos local a través de [`expo-sqlite`](finanzas-app/src/services/database.ts:17). No requiere conexión a internet para funcionar — todos los datos se almacenan en el dispositivo.

#### Inicialización y Migraciones

La base de datos se inicializa en [`schema.ts`](finanzas-app/src/db/schema.ts:3) con:

- **WAL mode** (Write-Ahead Logging) para mejor rendimiento en lecturas concurrentes
- **Foreign keys** activadas para integridad referencial
- **Migraciones automáticas** con `PRAGMA table_info` — detecta columnas faltantes y las agrega sin perder datos existentes
- **Seed inicial** de categorías y grupos de categorías por defecto

#### Tablas

| Tabla | Descripción | Columnas clave |
|-------|-------------|----------------|
| [`accounts`](finanzas-app/src/utils/types.ts:7) | Cuentas bancarias, efectivo, billeteras digitales | `name`, `type`, `currency`, `initialBalanceUSD`, `initialBalanceBS`, `platform`, `icon`, `color` |
| [`category_groups`](finanzas-app/src/utils/types.ts:52) | Grupos de categorías (Ej: "Vivienda", "Transporte") | `name`, `icon`, `color` |
| [`categories`](finanzas-app/src/utils/types.ts:37) | Categorías de transacciones | `name`, `type` (income/expense), `icon`, `color`, `groupId` |
| [`transactions`](finanzas-app/src/utils/types.ts:21) | Ingresos, gastos y transferencias | `type`, `amount`, `currency`, `description`, `categoryId`, `accountId`, `date`, `toAccountId` |
| [`goals`](finanzas-app/src/utils/types.ts:85) | Metas de ahorro | `name`, `targetAmount`, `currency`, `currentAmount`, `deadline`, `accountId`, `plazo` |
| [`goal_items`](finanzas-app/src/utils/types.ts:99) | Sub-metas o items de cada meta | `goalId`, `name`, `amount`, `isCompleted` |
| [`exchange_rates`](finanzas-app/src/utils/types.ts:114) | Histórico de tasas de cambio | `rateType` (BCV/PARALLEL), `rateUSDToBS`, `date`, `source` |
| [`budget_allocations`](finanzas-app/src/utils/types.ts:62) | Presupuestos mensuales por categoría | `categoryId`, `month`, `amountUSD`, `amountBS` |
| [`subscriptions`](finanzas-app/src/utils/types.ts:122) | Suscripciones y gastos recurrentes | `name`, `amount`, `currency`, `frequency`, `nextBillingDate`, `categoryId`, `accountId`, `billingDay`, `isActive` |
| [`debts`](finanzas-app/src/utils/types.ts:144) | Deudas y préstamos | `type` (lent/borrowed), `personName`, `amount`, `currency`, `interestRate`, `dueDate`, `status` |
| [`debt_payments`](finanzas-app/src/utils/types.ts:163) | Pagos registrados de deudas | `debtId`, `amount`, `currency`, `date`, `notes` |

#### Servicios CRUD

Cada tabla tiene su propio archivo de servicio en [`src/services/`](finanzas-app/src/services/) con operaciones asíncronas que usan consultas SQL parametrizadas:

| Archivo | Operaciones |
|---------|-------------|
| [`accounts.ts`](finanzas-app/src/services/accounts.ts) | CRUD + balance en tiempo real + agrupación por plataforma |
| [`transactions.ts`](finanzas-app/src/services/transactions.ts) | CRUD + filtros por período + totales |
| [`categories.ts`](finanzas-app/src/services/categories.ts) | CRUD + listado por tipo |
| [`categoryGroups.ts`](finanzas-app/src/services/categoryGroups.ts) | CRUD + grupos con categorías |
| [`budgetAllocations.ts`](finanzas-app/src/services/budgetAllocations.ts) | Asignación + gasto real + resumen por grupo |
| [`goals.ts`](finanzas-app/src/services/goals.ts) | CRUD + progreso |
| [`goalItems.ts`](finanzas-app/src/services/goalItems.ts) | CRUD de sub-metas |
| [`exchangeRate.ts`](finanzas-app/src/services/exchangeRate.ts) | Tasas desde APIs + guardado en BD |
| [`subscriptions.ts`](finanzas-app/src/services/subscriptions.ts) | CRUD + próximas facturaciones + procesamiento automático |
| [`debts.ts`](finanzas-app/src/services/debts.ts) | CRUD + pagos + resumen |
| [`reports.ts`](finanzas-app/src/services/reports.ts) | Estadísticas + flujo de caja + desglose por categoría |
| [`deepseek.ts`](finanzas-app/src/services/deepseek.ts) | Integración con DeepSeek API + parseo de acciones |
| [`chatHistory.ts`](finanzas-app/src/services/chatHistory.ts) | Historial de chat en AsyncStorage |

### Estado Global (Zustand)

Se usa **Zustand** con middleware `persist` para mantener el estado en AsyncStorage:

| Store | Propósito | Persistencia |
|-------|-----------|-------------|
| [`useAccounts`](finanzas-app/src/store/useAccounts.ts) | Lista de cuentas en memoria | ✅ AsyncStorage |
| [`useTransactions`](finanzas-app/src/store/useTransactions.ts) | Transacciones cacheadas | ✅ AsyncStorage |
| [`useSettings`](finanzas-app/src/store/useSettings.ts) | API Key, tasa manual, preferencias, modo oscuro | ✅ AsyncStorage |

### Historial de Chat

El historial del asistente IA se almacena en **AsyncStorage** mediante [`chatHistory.ts`](finanzas-app/src/services/chatHistory.ts):
- Límite: 100 mensajes máximo
- Sesiones agrupadas por inactividad de 30 minutos
- Soporte para limpiar historial completo

---

## 🌐 APIs Externas

### 1. DeepSeek API (Asistente IA)

- **Endpoint**: `https://api.deepseek.com/v1/chat/completions`
- **Modelo**: `deepseek-chat`
- **Configuración**:
  - `temperature: 0.1` (bajo para respuestas deterministas)
  - `max_tokens: 1500`
- **Propósito**: Procesar comandos en lenguaje natural para gestionar finanzas
- **Cómo funciona**:
  1. El usuario escribe un mensaje (ej: "Gasté $50 en uber")
  2. Se envía a DeepSeek con un **system prompt** que incluye las cuentas y categorías del usuario
  3. DeepSeek responde con texto explicativo + `ACCION: {JSON}` si es una operación
  4. La app parsea la acción y muestra una tarjeta de confirmación con botones **Confirmar** / **Cancelar**
  5. Al confirmar, se ejecuta la operación en SQLite
- **17 acciones disponibles**: transacciones (crear/actualizar/eliminar), cuentas (crear/actualizar/eliminar), transferencias, metas (crear/progreso/eliminar), suscripciones (crear/actualizar/eliminar), presupuestos, deudas (crear/pagar/eliminar)
- **Reglas estrictas del system prompt**:
  - ✅ SIEMPRE usar `ACCION:` con JSON para operaciones
  - ✅ SIEMPRE pedir confirmación antes de ejecutar
  - ✅ SIEMPRE preguntar si faltan datos
  - ❌ NUNCA ejecutar sin preguntar
  - ❌ NUNCA asumir valores por defecto
- **Configuración**: Se requiere API Key en Ajustes → DeepSeek

### 2. APIs de Tasas de Cambio

La app obtiene tasas de cambio automáticas de **múltiples fuentes** con sistema de **fallback en cadena**:

#### Flujo de obtención de tasas

```
Tasa Paralela (USDT/BS):
  1. DolarAPI (ve.dolarapi.com) → tasa "paralelo"
  2. Binance P2P (p2p.binance.com) → USDT → BS
  3. Yadio (api.yadio.io) → USD → VES

Tasa BCV (Oficial):
  1. DolarAPI (ve.dolarapi.com) → tasa "oficial"
  2. ExchangeRate-API (v6.exchangerate-api.com) → USD → VES
  3. BCV directo (bcv.org.ve) → scraping
  4. Monitordolar (monitordolarvenezuela.com) → scraping
  5. ExchangeRate Host (api.exchangerate.host) → USD → VES
```

#### Fuentes detalladas

| Fuente | Endpoint | Tasas | Prioridad |
|--------|----------|-------|-----------|
| **DolarAPI** | `GET https://ve.dolarapi.com/v1/dolares` | BCV + Paralelo | Principal |
| **Binance P2P** | `POST https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search` | Paralelo (USDT) | Fallback 1 |
| **Yadio** | `GET https://api.yadio.io/exrates/USD` | Paralelo (VES) | Fallback 2 |
| **ExchangeRate-API** | `GET https://v6.exchangerate-api.com/v6/{API_KEY}/latest/USD` | BCV (VES) | Fallback BCV 1 |
| **BCV directo** | `GET https://www.bcv.org.ve/` | BCV (scraping) | Fallback BCV 2 |
| **Monitordolar** | `GET https://monitordolarvenezuela.com/` | BCV (scraping) | Fallback BCV 3 |
| **ExchangeRate Host** | `GET https://api.exchangerate.host/latest?base=USD` | BCV (VES) | Fallback BCV 4 |

#### Sistema de tasa manual

El usuario puede establecer una **tasa manual** en Ajustes:
- Selector de tipo: **BCV** o **Paralelo**
- Input numérico para el valor
- Cuando `manualRate` no es `null`, **sobrescribe** todas las tasas automáticas
- Botón **"Quitar tasa manual (volver a automática)"** para restaurar las tasas automáticas

#### Hook useExchangeRates

El hook [`useExchangeRates`](finanzas-app/src/hooks/useExchangeRates.ts:21) proporciona:
- Carga inicial desde la BD (últimas tasas guardadas)
- `refresh()` para actualizar desde APIs
- Auto-refresh opcional con intervalo configurable
- Manejo de estados: `loading`, `rates`, `lastUpdated`, `error`

---

## 📁 Estructura del Proyecto

```
finanzas-app/
├── app/                          # Pantallas (expo-router)
│   ├── (tabs)/                   # Pestañas principales
│   │   ├── _layout.tsx           # Layout de pestañas
│   │   ├── index.tsx             # Dashboard
│   │   ├── accounts.tsx          # Lista de cuentas
│   │   ├── transactions.tsx      # Transacciones
│   │   ├── budgets.tsx           # Presupuestos
│   │   ├── goals.tsx             # Metas
│   │   ├── reports.tsx           # Reportes gráficos
│   │   ├── subscriptions.tsx     # Suscripciones
│   │   ├── debts.tsx             # Deudas y préstamos
│   │   └── settings.tsx          # Ajustes
│   ├── account/
│   │   ├── [id].tsx              # Detalle de cuenta
│   │   └── new.tsx               # Crear cuenta
│   ├── categories/
│   │   └── index.tsx             # Gestión de categorías
│   └── ai-chat.tsx               # Chat con asistente IA
├── src/
│   ├── components/
│   │   ├── AnimatedTabBar.tsx    # Barra de pestañas animada
│   │   └── AnimatedTransition.tsx # Transiciones animadas
│   ├── db/
│   │   └── schema.ts             # Esquema SQLite + migraciones
│   ├── hooks/
│   │   ├── useExchangeRates.ts   # Hook de tasas de cambio
│   │   └── useThemeColors.ts     # Hook de colores del tema
│   ├── services/
│   │   ├── database.ts           # Conexión a BD
│   │   ├── accounts.ts           # CRUD cuentas
│   │   ├── transactions.ts       # CRUD transacciones
│   │   ├── categories.ts         # CRUD categorías
│   │   ├── categoryGroups.ts     # CRUD grupos de categorías
│   │   ├── budgetAllocations.ts  # Presupuestos
│   │   ├── goals.ts              # Metas
│   │   ├── goalItems.ts          # Sub-metas
│   │   ├── exchangeRate.ts       # Tasas de cambio (BCV, Paralelo, Binance)
│   │   ├── subscriptions.ts      # Suscripciones recurrentes
│   │   ├── debts.ts              # Deudas y préstamos
│   │   ├── reports.ts            # Reportes y estadísticas
│   │   ├── deepseek.ts           # Integración con DeepSeek AI
│   │   ├── chatHistory.ts        # Historial de chat IA
│   │   └── export.ts             # Exportación CSV/JSON
│   ├── store/
│   │   ├── useAccounts.ts        # Estado global de cuentas
│   │   ├── useTransactions.ts    # Estado global de transacciones
│   │   └── useSettings.ts        # Estado global de ajustes
│   ├── theme/
│   │   └── colors.ts             # Paleta de colores (claro/oscuro)
│   └── utils/
│       ├── types.ts              # Tipos e interfaces
│       └── format.ts             # Formateo de moneda y fechas
├── assets/                       # Iconos y recursos
├── App.tsx                       # Entry point
├── app.json                      # Configuración Expo
├── package.json                  # Dependencias
└── tsconfig.json                 # Configuración TypeScript
```

---

## 🤖 ¿Qué Puedes Hacer con el Asistente IA?

El asistente IA (DeepSeek) puede gestionar **casi todas las funciones de la app** mediante lenguaje natural. Aquí tienes una guía completa de lo que **SÍ** y **NO** puede hacer.

### ✅ LO QUE SÍ PUEDE HACER

#### 💸 Transacciones (Gastos e Ingresos)

| Comando | Ejemplo | ¿Cómo funciona? |
|---------|---------|-----------------|
| **Registrar un gasto** | *"Gasté 50 dólares en uber"* | DeepSeek identifica monto, moneda, descripción y categoría. Muestra tarjeta con **Confirmar**/**Cancelar**. Al confirmar, crea la transacción en la cuenta por defecto. |
| **Registrar un ingreso** | *"Recibí 200 dólares de salario"* | Similar al gasto, pero como ingreso. Pregunta la categoría si no la especificas. |
| **Actualizar una transacción** | *"Cambia la descripción de la transacción 5 a 'Netflix'"* | Busca la transacción por ID y muestra los cambios a realizar. Pide confirmación. |
| **Eliminar una transacción** | *"Elimina la transacción 12"* | Muestra advertencia con los detalles de la transacción a eliminar. Pide confirmación. |

#### 🏦 Cuentas

| Comando | Ejemplo | ¿Cómo funciona? |
|---------|---------|-----------------|
| **Crear una cuenta** | *"Crea una cuenta de banco llamada Mi Ahorro con $100"* | Pregunta tipo de cuenta (cash, bank, virtual_card, exchange, other), moneda y saldo inicial si no los diste. Muestra resumen y pide confirmación. |
| **Actualizar una cuenta** | *"Cambia el nombre de mi cuenta de banco a Ahorros"* | Busca la cuenta por nombre o ID. Muestra los cambios. Pide confirmación. |
| **Eliminar una cuenta** | *"Elimina la cuenta llamada 'Prueba'"* | Muestra advertencia con el nombre y saldo de la cuenta. Pide confirmación. |

#### 🔄 Transferencias

| Comando | Ejemplo | ¿Cómo funciona? |
|---------|---------|-----------------|
| **Transferir entre cuentas** | *"Transfiere $30 de mi cuenta de banco a binance"* | Identifica las cuentas de origen y destino por nombre. Pregunta monto si no lo diste. Muestra resumen y pide confirmación. |

#### 🎯 Metas de Ahorro

| Comando | Ejemplo | ¿Cómo funciona? |
|---------|---------|-----------------|
| **Crear una meta** | *"Crea una meta de ahorro de $500 para un viaje"* | Pregunta nombre, monto objetivo, moneda, fecha límite (opcional) y cuenta asociada (opcional). Muestra resumen y pide confirmación. |
| **Actualizar progreso** | *"Agrega $100 al progreso de mi meta 'Viaje'"* | Busca la meta por nombre. Pregunta monto a agregar. Muestra el nuevo progreso y pide confirmación. |
| **Eliminar una meta** | *"Elimina la meta 3"* | Muestra advertencia con el nombre y progreso de la meta. Pide confirmación. |

#### 📅 Suscripciones

| Comando | Ejemplo | ¿Cómo funciona? |
|---------|---------|-----------------|
| **Crear suscripción** | *"Agrega suscripción de Netflix de $15 mensual"* | Pregunta nombre, monto, moneda, frecuencia, categoría, cuenta y día de facturación. Muestra resumen y pide confirmación. |
| **Actualizar suscripción** | *"Actualiza el precio de mi suscripción de Spotify a $10"* | Busca por nombre. Muestra los cambios. Pide confirmación. |
| **Eliminar suscripción** | *"Elimina la suscripción 2"* | Muestra advertencia. Pide confirmación. |

#### 📊 Presupuestos

| Comando | Ejemplo | ¿Cómo funciona? |
|---------|---------|-----------------|
| **Asignar presupuesto** | *"Pon presupuesto de $200 en Comida para julio 2026"* | Pregunta categoría, mes, monto USD y/o BS. Muestra resumen y pide confirmación. |

#### 💳 Deudas y Préstamos

| Comando | Ejemplo | ¿Cómo funciona? |
|---------|---------|-----------------|
| **Registrar deuda** | *"Registra una deuda de $100 con Juan"* | Pregunta tipo (lent/borrowed), persona, monto, moneda, descripción y fecha de vencimiento. Muestra resumen y pide confirmación. |
| **Pagar deuda** | *"Pagué $50 de la deuda con María"* | Busca la deuda por persona. Pregunta monto y moneda. Muestra resumen y pide confirmación. |
| **Eliminar deuda** | *"Elimina la deuda 1"* | Muestra advertencia. Pide confirmación. |

#### 📊 Consultas Informativas (sin acción)

| Pregunta | Ejemplo | Respuesta |
|----------|---------|-----------|
| **Saldo total** | *"¿Cuánto dinero tengo en total?"* | Resumen de saldos en USD y BS con desglose por cuenta |
| **Gastos del mes** | *"¿Cuáles son mis gastos del mes?"* | Lista de gastos agrupados por categoría con totales |
| **Estado de metas** | *"¿Cómo voy con mis metas?"* | Progreso de cada meta con porcentajes |
| **Próximas suscripciones** | *"¿Qué suscripciones vencen pronto?"* | Lista de suscripciones próximas a facturar |
| **Resumen de deudas** | *"¿Cuánto debo?"* | Total de deudas activas con progreso de pago |

### ❌ LO QUE NO PUEDE HACER

| Acción | Motivo |
|--------|--------|
| **Modificar categorías o grupos de categorías** | No hay acciones definidas para CRUD de categorías. Debes hacerlo desde Ajustes → Categorías. |
| **Exportar datos** | La exportación es manual desde Ajustes → Exportar. |
| **Configurar ajustes** (API Key, tasa manual, modo oscuro) | Los ajustes se configuran manualmente en la pantalla de Ajustes. |
| **Procesar suscripciones vencidas** | El procesamiento automático ocurre al abrir la pantalla de Suscripciones. |
| **Ver reportes gráficos** | Los reportes se ven en la pestaña Reportes. El asistente solo da resúmenes textuales. |
| **Operaciones con múltiples monedas en una sola acción** | Cada acción maneja una sola moneda (USD o BS). Para doble moneda, usa la interfaz manual. |
| **Recordatorios o notificaciones push** | La app no tiene sistema de notificaciones. |
| **Sincronización en la nube** | Todos los datos son locales en SQLite. No hay sync. |
| **Autenticación de usuarios** | App de un solo usuario, sin login. |
| **Soporte multi-moneda internacional** | Solo USD y BS (Bolívares). No soporta EUR, COP, etc. |

### 🔒 Comportamiento del Asistente

- **Siempre pide confirmación** antes de crear, modificar o eliminar cualquier dato
- **Muestra una tarjeta de vista previa** con los detalles de la operación
- **Botones Confirmar/Cancelar** en cada tarjeta de acción
- **Si faltan datos**, pregunta antes de continuar (nunca asume valores)
- **Las consultas informativas** responden directamente sin tarjeta de acción
- **Historial de chat** guardado en el dispositivo, accesible desde el icono de historial

---

## 🚀 Instalación y Uso

### Prerrequisitos
- Node.js 18+
- Expo CLI
- Dispositivo físico o emulador (Android/iOS)

### Instalación

```bash
# Clonar el repositorio
git clone https://github.com/tuusuario/mis-finanzas.git
cd mis-finanzas

# Instalar dependencias
cd finanzas-app
npm install

# Iniciar la app
npx expo start
```

### Escanea el QR
Escanea el código QR con la app **Expo Go** en tu dispositivo físico, o presiona `a` para emulador Android / `i` para simulador iOS.

---

## 📄 Licencia

MIT © 2025 — Hecho con ❤️ para Venezuela

---

## 🤝 Contribuir

Las contribuciones son bienvenidas. Por favor:

1. Haz fork del proyecto
2. Crea una rama (`git checkout -b feature/nueva-funcionalidad`)
3. Commit (`git commit -m 'Agrega nueva funcionalidad'`)
4. Push (`git push origin feature/nueva-funcionalidad`)
5. Abre un Pull Request
