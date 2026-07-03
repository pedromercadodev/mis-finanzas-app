# Changelog

## v2.2.0 (2026-07-03)

### 🎨 Animaciones y Experiencia de Usuario

#### Transición centralizada entre tabs
- **Archivo:** [`src/components/AnimatedTransition.tsx`](src/components/AnimatedTransition.tsx)
- Se centralizó `AnimatedTransition` en el layout de tabs (`(tabs)/_layout.tsx`) eliminándolo de las 9 pantallas individuales.
- Se agregó **bloqueo de animación** (`animatingRef`) para evitar doble ejecución por actualizaciones intermedias de `usePathname()`.
- Se completó el `tabOrder` con todas las rutas de tabs (incluyendo `reports`, `subscriptions`, `debts`).
- Se agregó **loading overlay** con ícono animado y texto "Cargando..." durante la transición entre pantallas.

#### Archivos modificados:
- [`app/(tabs)/_layout.tsx`](app/(tabs)/_layout.tsx) — Envuelve `<Tabs>` con `<AnimatedTransition>`
- [`app/(tabs)/index.tsx`](app/(tabs)/index.tsx) — Eliminado `AnimatedTransition` import y wrapper
- [`app/(tabs)/transactions.tsx`](app/(tabs)/transactions.tsx) — Eliminado `AnimatedTransition` import y wrapper
- [`app/(tabs)/reports.tsx`](app/(tabs)/reports.tsx) — Eliminado `AnimatedTransition` import y wrapper
- [`app/(tabs)/settings.tsx`](app/(tabs)/settings.tsx) — Eliminado `AnimatedTransition` import y wrapper
- [`app/(tabs)/accounts.tsx`](app/(tabs)/accounts.tsx) — Eliminado `AnimatedTransition` import y wrapper
- [`app/(tabs)/budgets.tsx`](app/(tabs)/budgets.tsx) — Eliminado `AnimatedTransition` import y wrapper
- [`app/(tabs)/goals.tsx`](app/(tabs)/goals.tsx) — Eliminado `AnimatedTransition` import y wrapper
- [`app/(tabs)/subscriptions.tsx`](app/(tabs)/subscriptions.tsx) — Eliminado `AnimatedTransition` import y wrapper
- [`app/(tabs)/debts.tsx`](app/(tabs)/debts.tsx) — Eliminado `AnimatedTransition` import y wrapper

### 🧹 Limpieza
- [`app/(tabs)/reports.tsx`](app/(tabs)/reports.tsx) — Eliminado import no usado de `PieChart` de `react-native-chart-kit`

---

## v2.1.0 (2026-07-03)

### 🐛 Bugfixes y Mejoras

#### Bugfix 1 — Selector de moneda en crear cuenta
- **Archivo:** [`app/account/new.tsx`](app/account/new.tsx)
- Se agregó selector de moneda (USD/BS/BOTH) que faltaba en el formulario de creación de cuentas.
- Ahora al crear una cuenta se puede elegir entre USD, BS o ambas monedas.

#### Bugfix 2 — Edición completa de cuenta
- **Archivo:** [`app/account/[id].tsx`](app/account/[id].tsx)
- Se amplió el modal de edición de cuenta para incluir todos los campos: nombre, tipo, moneda, icono y color.
- Anteriormente solo permitía editar el nombre.

#### Bugfix 3 — Selector de cuenta destino en transferencias
- **Archivo:** [`app/(tabs)/transactions.tsx`](app/(tabs)/transactions.tsx)
- Se agregó selector de cuenta destino al crear transferencias.
- Ahora se puede elegir la cuenta de origen y destino desde un listado.

#### Bugfix 4 — Validación de saldo suficiente
- **Archivo:** [`app/(tabs)/transactions.tsx`](app/(tabs)/transactions.tsx)
- Se agregó validación de saldo disponible antes de crear gastos y transferencias.
- Muestra alerta si el saldo es insuficiente.

#### Bugfix 5 — Selector de moneda en suscripciones
- **Archivo:** [`app/(tabs)/subscriptions.tsx`](app/(tabs)/subscriptions.tsx)
- Se agregó selector de moneda (USD/BS) en el modal de creación/edición de suscripciones.
- Ahora las suscripciones pueden crearse en USD o BS.

#### Bugfix 6 — Cálculo correcto de próxima facturación
- **Archivo:** [`src/services/subscriptions.ts`](src/services/subscriptions.ts)
- Se corrigió el cálculo de `nextBillingDate` para respetar la frecuencia seleccionada (semanal, mensual, anual, personalizada).
- La función `calculateNextBillingDate` ahora calcula correctamente según la frecuencia.

#### Bugfix 7 — Selector BCV/Paralelo para tasa manual
- **Archivo:** [`app/(tabs)/settings.tsx`](app/(tabs)/settings.tsx)
- Se agregó selector de tipo de tasa (BCV o Paralelo) para la tasa manual en Ajustes.
- El Dashboard muestra "MANUAL BCV" o "MANUAL PARALELO" según la selección.

#### Bugfix 8 — Botón para volver a tasas automáticas
- **Archivo:** [`app/(tabs)/settings.tsx`](app/(tabs)/settings.tsx)
- Se agregó botón "Quitar tasa manual (volver a automática)" en rojo.
- Aparece solo cuando hay una tasa manual configurada.
- Al presionarlo, limpia la tasa manual y restaura las tasas automáticas de la BD.

### 🚀 Nuevas Funcionalidades

#### Resumen de Metas en Dashboard
- **Archivo:** [`app/(tabs)/index.tsx`](app/(tabs)/index.tsx)
- Se agregó sección de resumen de metas de ahorro en el Dashboard.
- Muestra hasta 4 metas con barra de progreso visual.

#### Acceso a Suscripciones en Dashboard
- **Archivo:** [`app/(tabs)/index.tsx`](app/(tabs)/index.tsx)
- Se agregó "Suscripciones" como acceso rápido en el Dashboard.
- Alerta de suscripciones próximas a vencer con badges VENCIDA (rojo) y PRONTO (amarillo).

### 🤖 Mejoras al Asistente IA (DeepSeek)

#### System Prompt reforzado
- **Archivo:** [`src/services/deepseek.ts`](src/services/deepseek.ts)
- Se reescribió el system prompt con reglas más estrictas:
  - **Regla #1 Absoluta**: DeepSeek DEBE usar `ACCION:` con JSON para TODA operación.
  - **Regla #2**: SIEMPRE debe pedir confirmación antes de ejecutar cualquier acción.
  - **Regla #3**: Si faltan datos, debe preguntar. Nunca asumir valores.
- Se bajó `temperature` de 0.3 a 0.1 para respuestas más deterministas.
- Se agregó formato de respuesta obligatorio: explicación → "¿Confirmas?" → `ACCION:`.

#### Las 17 acciones completas del asistente:
| Categoría | Acciones |
|-----------|----------|
| Transacciones | Crear, Actualizar, Eliminar |
| Cuentas | Crear, Actualizar, Eliminar |
| Transferencias | Entre cuentas |
| Metas | Crear, Actualizar progreso, Eliminar |
| Suscripciones | Crear, Actualizar, Eliminar |
| Presupuestos | Asignar |
| Deudas | Crear, Pagar, Eliminar |

---

## v2.0.0

- ✨ Exportación de Datos — CSV y JSON con expo-sharing
- 📊 Reportes Gráficos — PieChart y LineChart
- 🔄 Suscripciones — Gastos recurrentes con procesamiento automático
- 💰 Deudas y Préstamos — Registro de pagos, barra de progreso
- 🪙 Billeteras Digitales — Cuentas agrupadas por plataforma
- 🐛 Fix migración — Columna `platform` con `PRAGMA table_info`

## v1.0.0

- 🏠 Dashboard con resumen de saldos y tasas de cambio
- 💳 Cuentas bancarias, efectivo y ahorro (USD/BS/BOTH)
- 💸 Transacciones con categorización y filtros
- 📊 Presupuestos estilo YNAB
- 🎯 Metas con sub-metas y progreso visual
- 🌐 Tasas de cambio automáticas (BCV + Paralelo + Binance)
- 🤖 Entrada por IA con DeepSeek
- 🌙 Modo oscuro/claro automático
