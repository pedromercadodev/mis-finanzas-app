import { z } from 'zod';

// ============================================================
// Esquemas Zod para validación de respuestas del LLM
// ============================================================
// Usamos z.coerce.number() para tolerar que el LLM envíe
// números como strings (ej: "50" en lugar de 50)
// ============================================================

/**
 * Esquema para crear/registrar una transacción (gasto o ingreso)
 */
export const TransactionSchema = z.object({
  actionType: z.literal('transaction'),
  type: z.enum(['expense', 'income']),
  amount: z.coerce.number().positive().max(999999),
  currency: z.enum(['USD', 'BS']),
  description: z.string().trim().min(1).max(200),
  category: z.string().trim().min(1),
  skip_confirmation: z.boolean().optional().default(false),
});

/**
 * Esquema para actualizar una transacción existente
 */
export const UpdateTransactionSchema = z.object({
  actionType: z.literal('update_transaction'),
  transactionId: z.coerce.number().int().positive(),
  type: z.enum(['expense', 'income']).optional(),
  amount: z.coerce.number().positive().max(999999).optional(),
  currency: z.enum(['USD', 'BS']).optional(),
  description: z.string().trim().min(1).max(200).optional(),
  category: z.string().trim().min(1).optional(),
});

/**
 * Esquema para eliminar una transacción
 */
export const DeleteTransactionSchema = z.object({
  actionType: z.literal('delete_transaction'),
  transactionId: z.coerce.number().int().positive(),
});

/**
 * Esquema para crear una cuenta
 */
export const CreateAccountSchema = z.object({
  actionType: z.literal('create_account'),
  name: z.string().trim().min(1).max(100),
  type: z.enum(['cash', 'bank', 'virtual_card', 'exchange', 'other']),
  currency: z.enum(['USD', 'BS', 'BOTH']),
  initialBalanceUSD: z.coerce.number().min(0).default(0),
  initialBalanceBS: z.coerce.number().min(0).default(0),
  icon: z.string().optional(),
  color: z.string().optional(),
  skip_confirmation: z.boolean().optional().default(false),
});

/**
 * Esquema para actualizar una cuenta
 */
export const UpdateAccountSchema = z.object({
  actionType: z.literal('update_account'),
  accountId: z.coerce.number().int().positive(),
  name: z.string().trim().min(1).max(100).optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
});

/**
 * Esquema para eliminar una cuenta
 */
export const DeleteAccountSchema = z.object({
  actionType: z.literal('delete_account'),
  accountId: z.coerce.number().int().positive(),
});

/**
 * Esquema para transferencia entre cuentas
 */
export const TransferSchema = z.object({
  actionType: z.literal('transfer'),
  fromAccountId: z.coerce.number().int().positive(),
  toAccountId: z.coerce.number().int().positive(),
  amount: z.coerce.number().positive().max(999999),
  currency: z.enum(['USD', 'BS']),
  description: z.string().trim().max(200).optional(),
  skip_confirmation: z.boolean().optional().default(false),
});

/**
 * Esquema para crear una meta (goal)
 */
export const CreateGoalSchema = z.object({
  actionType: z.literal('create_goal'),
  name: z.string().trim().min(1).max(100),
  targetAmount: z.coerce.number().positive().max(99999999),
  currency: z.enum(['USD', 'BS']),
  accountId: z.coerce.number().int().positive().optional(),
  deadline: z.string().optional(),
  skip_confirmation: z.boolean().optional().default(false),
});

/**
 * Esquema para actualizar progreso de meta
 */
export const UpdateGoalProgressSchema = z.object({
  actionType: z.literal('update_goal_progress'),
  goalId: z.coerce.number().int().positive(),
  amount: z.coerce.number().positive().max(999999),
});

/**
 * Esquema para eliminar meta
 */
export const DeleteGoalSchema = z.object({
  actionType: z.literal('delete_goal'),
  goalId: z.coerce.number().int().positive(),
});

/**
 * Esquema para crear suscripción
 */
export const CreateSubscriptionSchema = z.object({
  actionType: z.literal('create_subscription'),
  name: z.string().trim().min(1).max(100),
  amount: z.coerce.number().positive().max(999999),
  currency: z.enum(['USD', 'BS']),
  frequency: z.enum(['weekly', 'monthly', 'yearly', 'custom']),
  category: z.string().trim().min(1),
  accountId: z.coerce.number().int().positive(),
  billingDay: z.coerce.number().int().min(1).max(31),
  description: z.string().trim().max(200).optional(),
  skip_confirmation: z.boolean().optional().default(false),
});

/**
 * Esquema para actualizar suscripción
 */
export const UpdateSubscriptionSchema = z.object({
  actionType: z.literal('update_subscription'),
  subscriptionId: z.coerce.number().int().positive(),
  name: z.string().trim().min(1).max(100).optional(),
  amount: z.coerce.number().positive().max(999999).optional(),
  currency: z.enum(['USD', 'BS']).optional(),
  frequency: z.enum(['weekly', 'monthly', 'yearly', 'custom']).optional(),
  isActive: z.boolean().optional(),
});

/**
 * Esquema para eliminar suscripción
 */
export const DeleteSubscriptionSchema = z.object({
  actionType: z.literal('delete_subscription'),
  subscriptionId: z.coerce.number().int().positive(),
});

/**
 * Esquema para asignar presupuesto
 */
export const SetBudgetSchema = z.object({
  actionType: z.literal('set_budget'),
  category: z.string().trim().min(1),
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Formato debe ser YYYY-MM'),
  amountUSD: z.coerce.number().min(0).max(999999),
  amountBS: z.coerce.number().min(0).max(999999).optional(),
  skip_confirmation: z.boolean().optional().default(false),
});

/**
 * Esquema para crear deuda
 * NOTA: personName y type son opcionales aquí porque la validación
 * de que el usuario los haya mencionado se hace en deepseek.ts
 * (validateDebtArgs). Si el modelo inventa datos, el self-healing
 * los rechazará.
 */
export const CreateDebtSchema = z.object({
  actionType: z.literal('create_debt'),
  type: z.enum(['lent', 'borrowed']).optional(),
  personName: z.string().trim().min(1).max(100).optional(),
  amount: z.coerce.number().positive().max(999999),
  currency: z.enum(['USD', 'BS']),
  description: z.string().trim().max(200).optional(),
  dueDate: z.string().optional(),
  skip_confirmation: z.boolean().optional().default(false),
});

/**
 * Esquema para registrar pago de deuda
 */
export const PayDebtSchema = z.object({
  actionType: z.literal('pay_debt'),
  debtId: z.coerce.number().int().positive(),
  amount: z.coerce.number().positive().max(999999),
  currency: z.enum(['USD', 'BS']),
  skip_confirmation: z.boolean().optional().default(false),
});

/**
 * Esquema para eliminar deuda
 */
export const DeleteDebtSchema = z.object({
  actionType: z.literal('delete_debt'),
  debtId: z.coerce.number().int().positive(),
});

// ============================================================
// Tipo unión de todas las acciones validadas
// ============================================================

/**
 * Tipo inferido de todos los esquemas Zod combinados.
 * Se usa para tipar el resultado después de la validación.
 */
export type ValidatedAction =
  | z.infer<typeof TransactionSchema>
  | z.infer<typeof UpdateTransactionSchema>
  | z.infer<typeof DeleteTransactionSchema>
  | z.infer<typeof CreateAccountSchema>
  | z.infer<typeof UpdateAccountSchema>
  | z.infer<typeof DeleteAccountSchema>
  | z.infer<typeof TransferSchema>
  | z.infer<typeof CreateGoalSchema>
  | z.infer<typeof UpdateGoalProgressSchema>
  | z.infer<typeof DeleteGoalSchema>
  | z.infer<typeof CreateSubscriptionSchema>
  | z.infer<typeof UpdateSubscriptionSchema>
  | z.infer<typeof DeleteSubscriptionSchema>
  | z.infer<typeof SetBudgetSchema>
  | z.infer<typeof CreateDebtSchema>
  | z.infer<typeof PayDebtSchema>
  | z.infer<typeof DeleteDebtSchema>;

// ============================================================
// Mapa de actionType -> esquema Zod
// ============================================================

/**
 * Mapa que asocia cada actionType con su esquema Zod correspondiente.
 * Se usa para validar dinámicamente según el tipo de acción.
 */
export const ACTION_SCHEMA_MAP: Record<string, z.ZodTypeAny> = {
  transaction: TransactionSchema,
  update_transaction: UpdateTransactionSchema,
  delete_transaction: DeleteTransactionSchema,
  create_account: CreateAccountSchema,
  update_account: UpdateAccountSchema,
  delete_account: DeleteAccountSchema,
  transfer: TransferSchema,
  create_goal: CreateGoalSchema,
  update_goal_progress: UpdateGoalProgressSchema,
  delete_goal: DeleteGoalSchema,
  create_subscription: CreateSubscriptionSchema,
  update_subscription: UpdateSubscriptionSchema,
  delete_subscription: DeleteSubscriptionSchema,
  set_budget: SetBudgetSchema,
  create_debt: CreateDebtSchema,
  pay_debt: PayDebtSchema,
  delete_debt: DeleteDebtSchema,
};
