# Changelog

## v2.5.0 (2026-07-17)

### 🐛 Fase 6 — Correcciones y Mejoras en Reportes

#### Corrección: Gráfico de torta (donut) no renderizaba correctamente
- **Archivo:** [`src/components/PieChartInteractive.tsx`](src/components/PieChartInteractive.tsx)
- Se corrigió la función `describeArc` para manejar ángulos de 360° (círculo completo). SVG no puede dibujar un arco completo con un solo comando `A`, por lo que se partió en dos arcos de 180°.
- Se agregó la prop `showLegend` (default `true`) para ocultar la leyenda del componente cuando el consumidor tiene su propia lista.
- Se agregó protección `innerR = Math.min(innerRadius, outerR * 0.85)` para evitar que el agujero de la dona sea más grande que el gráfico.

#### Corrección: Duplicación de leyenda en gráfico de torta
- **Archivo:** [`app/(tabs)/reports.tsx`](app/(tabs)/reports.tsx)
- Se pasó `showLegend={false}` al `PieChartInteractive` para evitar duplicación con la lista "Top 8 Categorías".

#### Corrección: Cálculo de porcentajes mezclando USD y BS
- **Archivo:** [`app/(tabs)/reports.tsx`](app/(tabs)/reports.tsx)
- Se corrigió el cálculo de `pieSlices` para usar `cat.percentage` del servicio (que ya convierte BS→USD) en lugar de recalcularlo mezclando valores sin conversión.

#### Corrección: Tarjetas de resumen no mostraban valores en BS
- **Archivo:** [`app/(tabs)/reports.tsx`](app/(tabs)/reports.tsx)
- Las tarjetas de Ingresos, Gastos y Neto ahora muestran el valor combinado: si hay USD muestra USD, si no convierte BS/100 como tasa aproximada.

#### Corrección: Iconos emoji no válidos para Ionicons
- **Archivos:** `app/(tabs)/reports.tsx`, `app/(tabs)/transactions.tsx`, `app/(tabs)/budgets.tsx`, `app/(tabs)/subscriptions.tsx`
- Se agregó mapeo `EMOJI_TO_ICON` (40+ emojis → Ionicons) y función `getIcon()` en los 4 archivos para evitar warnings `"🍔" is not a valid icon name`.

#### Corrección: Iconos de cuentas mostrando "?" en Mis Cuentas
- **Archivo:** [`app/(tabs)/accounts.tsx`](app/(tabs)/accounts.tsx)
- Se reescribió `getIconName()` para detectar automáticamente si el icono es un nombre Ionicons válido o un emoji, con mapeo completo de todos los emojis disponibles en el selector de iconos (24 emojis mapeados a Ionicons).

#### Mejora: Círculos decorativos convertidos a glows en Detalle de Cuenta
- **Archivo:** [`app/account/[id].tsx`](app/account/[id].tsx)
- Se reemplazaron los círculos decorativos estáticos por glows con `shadowColor`, `shadowRadius` y opacidad para un efecto de brillo más moderno y coherente con el diseño Kinetic Ledger.

#### Corrección: Botones de tipo de transacción con color incorrecto
- **Archivo:** [`app/(tabs)/transactions.tsx`](app/(tabs)/transactions.tsx)
- Se cambió el `backgroundColor` de los botones Gasto/Ingreso/Transferencia no seleccionados de `themeColors.surface` (gris) a `themeColors.secondary + '18'` (verde translúcido) para mantener la coherencia visual.

#### Mejora: Etiqueta dinámica de comparación de periodos en Reportes
- **Archivo:** [`app/(tabs)/reports.tsx`](app/(tabs)/reports.tsx)
- Se reemplazó el texto fijo "vs. trim ant." por una etiqueta dinámica `getPeriodLabel(period)` que muestra "vs. mes ant.", "vs. trim. ant.", "vs. año ant." o "vs. periodo ant." según el periodo seleccionado.

#### Mejora: Círculos decorativos convertidos a glows en Deudas
- **Archivo:** [`app/(tabs)/debts.tsx`](app/(tabs)/debts.tsx)
- Se reemplazaron los círculos decorativos estáticos de las tarjetas de resumen por glows con efecto de sombra y brillo, usando los colores secondary (me deben) y danger (yo debo).

## v2.3.0 (2026-07-09)

### 🤖 Fase 4 — Agente Inteligente (Valor Agregado)

#### T10-T12: Tools de consulta a la BD
- **Archivo:** [`src/services/deepseek.ts`](src/services/deepseek.ts)
- Se agregaron **6 herramientas de consulta** que el asistente ejecuta directamente contra SQLite:
  - `consultar_saldo` — Saldo de cuentas activas
  - `consultar_presupuesto` — Presupuesto vs gastado por categoría
  - `obtener_resumen_financiero` — Ingresos, gastos y neto en un período
  - `top_gastos` — Top N gastos más altos en un período
  - `comparar_gastos` — Comparación entre dos períodos con cambio porcentual
  - `detectar_recurrencia` — Detecta gastos recurrentes por descripción
- Las consultas se ejecutan server-side y el modelo devuelve la respuesta en lenguaje natural.
- Se implementó el patrón **execute-and-follow-up**: ejecuta → retroalimenta al modelo → responde en texto.

#### T13: Identidad FinBot + Reglas Financieras
- **Archivo:** [`src/services/deepseek.ts`](src/services/deepseek.ts)
- Se le asignó al asistente la identidad **FinBot** con personalidad clara.
- Se agregaron reglas de educación financiera en el system prompt:
  - **50/30/20**: 50% necesidades, 30% deseos, 20% ahorro
  - **Fondo de emergencia**: 3-6 meses de gastos
  - **Método de nieve (snowball)**: Pagar deudas de menor a mayor
- Se diferencian explícitamente dos tipos de herramientas: **consulta** (ejecuta y responde) vs **acción** (pide confirmación).

### 💻 Fase 5 — Mejoras Menores

#### T14: Manejo granular de errores
- **Archivo:** [`app/ai-chat.tsx`](app/ai-chat.tsx)
- Se creó la función `getErrorMessage()` que analiza el mensaje de error y devuelve texto específico según el patrón:
  - `Network request failed` / `fetch` → "No se pudo conectar con el servidor"
  - `401` / `Unauthorized` → "La clave API no es válida"
  - `429` / `Rate limit` → "Demasiadas solicitudes. Espera unos segundos"
  - `5xx` → "El servidor de DeepSeek tiene problemas"
  - `database` / `SQL` → "Error interno de base de datos"
  - `validation` / `Zod` / `parse` → "El asistente generó datos inválidos"
  - `JSON` / `JSONParse` → "Error al procesar la respuesta"
  - Códigos HTTP específicos (400, 403, 404, 408, 413, 422) con mensajes personalizados
- Se aplicó en `sendMessage()` y `confirmAction()` reemplazando mensajes genéricos.

#### T15: UI de razonamiento (thinking steps)
- **Archivo:** [`app/ai-chat.tsx`](app/ai-chat.tsx)
- Se implementaron las funciones `startThinking()` y `stopThinking()` que rotan cada 2.5s por:
  - 🔍 Analizando tu mensaje...
  - 🤔 Procesando solicitud...
  - 📊 Consultando datos...
  - ✍️ Preparando respuesta...
- El indicador de carga cambió de "Pensando..." estático a mostrar el paso actual dinámico.

### 🔐 Fase 2 — Seguridad

#### T6: Migración a expo-secure-store
- **Archivo:** [`src/store/useSettings.ts`](src/store/useSettings.ts)
- Se migró el almacenamiento de la API Key de AsyncStorage a `expo-secure-store`.
- La key se almacena cifrada en el enclave seguro del dispositivo.

### 🛠️ Otras mejoras

#### Selector de cuenta en asistente (T8)
- **Archivo:** [`app/ai-chat.tsx`](app/ai-chat.tsx)
- Cuando hay múltiples cuentas, el asistente muestra un modal para que el usuario seleccione la cuenta.

#### CATEGORY_MAP dinámico (T9)
- **Archivo:** [`src/services/deepseek.ts`](src/services/deepseek.ts)
- El mapa de categorías se construye desde la BD en lugar de estar hardcodeado.

#### Corrección de diseño en metas
- **Archivo:** [`app/(tabs)/goals.tsx`](app/(tabs)/goals.tsx)
- Se corrigió el solapamiento del botón "Abonar" con nombres largos de metas.

---

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
