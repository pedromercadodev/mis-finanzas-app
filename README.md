# 🏦 Mis Finanzas

Aplicación móvil de finanzas personales construida con **React Native (Expo)** para gestionar cuentas, transacciones, presupuestos, metas, suscripciones, deudas, billeteras digitales y más.

> **Diseñada para Venezuela** — Soporte nativo para **USD + BS** (Bolívares) con tasas de cambio automáticas (BCV/Paralelo).

---

## 📱 Capturas

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
- **Tasas de cambio** automáticas (BCV y Paralelo)
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
| **TypeScript** | 5.9.2 | Tipado estático |
| **expo-router** | 6.x | Enrutamiento basado en archivos |
| **expo-sqlite** | 16.x | Base de datos local SQLite |
| **Zustand** | 5.x | Estado global |
| **react-native-reanimated** | 4.x | Animaciones |
| **react-native-chart-kit** | 7.x | Gráficos (PieChart, LineChart) |
| **react-native-svg** | 15.x | Renderizado SVG |
| **expo-file-system** | 19.x | Exportación de archivos |
| **expo-sharing** | 14.x | Compartir archivos |
| **NativeWind** | 4.x | Estilos con Tailwind |

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
│   └── categories/
│       └── index.tsx             # Gestión de categorías
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

## 🗄️ Base de Datos

SQLite local con las siguientes tablas:

| Tabla | Descripción |
|-------|-------------|
| `accounts` | Cuentas bancarias, efectivo, billeteras digitales |
| `category_groups` | Grupos de categorías (Ej: "Vivienda", "Transporte") |
| `categories` | Categorías de transacciones |
| `transactions` | Ingresos, gastos y transferencias |
| `goals` | Metas de ahorro |
| `goal_items` | Sub-metas o items de cada meta |
| `exchange_rates` | Histórico de tasas de cambio |
| `budget_allocations` | Presupuestos mensuales por categoría |
| `subscriptions` | Suscripciones y gastos recurrentes |
| `debts` | Deudas y préstamos |
| `debt_payments` | Pagos registrados de deudas |

### Migración Automática
El esquema incluye migraciones automáticas para agregar columnas nuevas a tablas existentes sin perder datos (ej: columna `platform` en `accounts`).

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

## 🌐 Tasas de Cambio

La app obtiene tasas de cambio automáticas de múltiples fuentes con sistema de **fallback en cadena**:

1. **DolarAPI** — Fuente principal (BCV + Paralelo)
2. **Binance P2P** — Fallback para tasa paralela (USDT → BS)
3. **Yadio** — Fallback secundario
4. **ExchangeRate-API** — Fallback para BCV
5. **BCV directo** — Último recurso

El usuario puede seleccionar su tasa preferida (BCV o Paralelo) en Ajustes para el cálculo del saldo total en BS.

---

## 🤖 Entrada por IA

La app soporta entrada de transacciones mediante **DeepSeek AI**. Configura tu API Key en Ajustes y escribe en lenguaje natural:

> *"Gasté 20$ en pizza hoy"*
> *"Recibí 500$ de pago de freelance"*
> *"Transferí 100$ de banco a binance"*

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
