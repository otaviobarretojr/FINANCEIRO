export type MoneyKind = 'income' | 'expense'
export type IncomeMode = 'fixed' | 'variable' | 'benefit'
export type Essentiality = 'essential' | 'flexible' | 'discretionary'
export type AccountKind = 'bank' | 'cash' | 'wallet'
export type Priority = 'high' | 'medium' | 'low'
export type GoalType = 'emergency' | 'move' | 'purchase' | 'travel' | 'custom'

export type Category = {
  id: string
  name: string
  kind: MoneyKind
  essentiality: Essentiality
  reducible: boolean
  monthlyBudget: number
  active: boolean
}

export type Account = {
  id: string
  name: string
  kind: AccountKind
  initialBalance: number
  active: boolean
}

export type IncomeSource = {
  id: string
  name: string
  mode: IncomeMode
  amount: number
  min: number
  max: number
  day: number
  categoryId: string
  accountId: string
  active: boolean
}

export type RecurringExpense = {
  id: string
  name: string
  amount: number
  dueDay: number
  categoryId: string
  accountId: string
  reducible: boolean
  active: boolean
  notes: string
}

export type Transaction = {
  id: string
  description: string
  amount: number
  type: MoneyKind
  categoryId: string
  accountId: string
  date: string
  paid: boolean
  notes: string
}

export type CardAccount = {
  id: string
  name: string
  limit: number
  closingDay: number
  dueDay: number
  active: boolean
}

export type CardPurchase = {
  id: string
  cardId: string
  description: string
  totalAmount: number
  purchaseDate: string
  installments: number
  recurring: boolean
  active: boolean
  categoryId: string
}

export type Debt = {
  id: string
  name: string
  totalBalance: number
  installment: number
  dueDay: number
  remainingInstallments: number
  categoryId: string
  active: boolean
}

export type Goal = {
  id: string
  name: string
  type: GoalType
  target: number
  current: number
  targetDate: string
  priority: Priority
  active: boolean
  monthlyOverride: number
}

export type MonthClosing = {
  month: string
  closedAt: string
  guaranteedIncome: number
  plannedExpenses: number
  actualIncome: number
  actualExpenses: number
  margin: number
  actualMargin: number
  categoryTotals: Record<string, number>
}

export type SecuritySettings = {
  enabled: boolean
  pinHash: string
  biometric: boolean
  autoLockMinutes: number
}

export type NotificationSettings = {
  enabled: boolean
  daysBefore: number
  hour: number
}

export type FinancialSettings = {
  setupComplete: boolean
  reserveMonths: number
  reserveContributionShare: number
  displayName: string
}

export type FinanceState = {
  schemaVersion: 3
  settings: FinancialSettings
  categories: Category[]
  accounts: Account[]
  incomeSources: IncomeSource[]
  recurringExpenses: RecurringExpense[]
  transactions: Transaction[]
  cards: CardAccount[]
  cardPurchases: CardPurchase[]
  debts: Debt[]
  goals: Goal[]
  payments: Record<string, boolean>
  closings: MonthClosing[]
  security: SecuritySettings
  notifications: NotificationSettings
}

export type CalendarItem = {
  id: string
  date: string
  title: string
  amount: number
  kind: MoneyKind
  source: 'income' | 'recurring' | 'transaction' | 'card' | 'debt'
  categoryId: string
  paid: boolean
}

export const STORAGE_KEY_V2 = 'financeiro-personal-v3'
export const LEGACY_V1_KEY = 'financeiro-personal-v2'
export const LEGACY_V0_KEY = 'financeiro-personal-v1'
export const REPO = 'otaviobarretojr/FINANCEIRO'

export const money = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number.isFinite(value) ? value : 0)

export const todayIso = () => new Date().toISOString().slice(0, 10)
export const currentMonth = () => todayIso().slice(0, 7)

export function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function clampDay(value: number) {
  return Math.max(1, Math.min(28, Math.round(Number(value) || 1)))
}

export function shiftMonth(month: string, amount: number) {
  const [year, m] = month.split('-').map(Number)
  const date = new Date(year, m - 1 + amount, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function monthDiff(from: string, to: string) {
  const [fy, fm] = from.split('-').map(Number)
  const [ty, tm] = to.split('-').map(Number)
  return (ty - fy) * 12 + (tm - fm)
}

export function monthLabel(month: string) {
  const [year, m] = month.split('-').map(Number)
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date(year, m - 1, 1))
}

export function dateLabel(date: string) {
  const [y, m, d] = date.split('-').map(Number)
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(y, m - 1, d))
}

export function isoForDay(month: string, day: number) {
  return `${month}-${String(clampDay(day)).padStart(2, '0')}`
}

export function paymentKey(month: string, id: string) {
  return `${month}:${id}`
}

export const defaultCategories: Category[] = [
  { id: 'income-salary', name: 'Salário', kind: 'income', essentiality: 'essential', reducible: false, monthlyBudget: 0, active: true },
  { id: 'income-extra', name: 'Renda extra', kind: 'income', essentiality: 'flexible', reducible: false, monthlyBudget: 0, active: true },
  { id: 'benefit', name: 'Benefícios', kind: 'income', essentiality: 'essential', reducible: false, monthlyBudget: 0, active: true },
  { id: 'housing', name: 'Moradia', kind: 'expense', essentiality: 'essential', reducible: false, monthlyBudget: 0, active: true },
  { id: 'child', name: 'Filhos / pensão', kind: 'expense', essentiality: 'essential', reducible: false, monthlyBudget: 0, active: true },
  { id: 'utilities', name: 'Contas da casa', kind: 'expense', essentiality: 'essential', reducible: true, monthlyBudget: 0, active: true },
  { id: 'food', name: 'Alimentação', kind: 'expense', essentiality: 'essential', reducible: true, monthlyBudget: 0, active: true },
  { id: 'transport', name: 'Transporte', kind: 'expense', essentiality: 'essential', reducible: true, monthlyBudget: 0, active: true },
  { id: 'health', name: 'Saúde', kind: 'expense', essentiality: 'essential', reducible: false, monthlyBudget: 0, active: true },
  { id: 'fitness', name: 'Academia / esporte', kind: 'expense', essentiality: 'flexible', reducible: true, monthlyBudget: 0, active: true },
  { id: 'subscriptions', name: 'Assinaturas', kind: 'expense', essentiality: 'discretionary', reducible: true, monthlyBudget: 0, active: true },
  { id: 'leisure', name: 'Lazer', kind: 'expense', essentiality: 'discretionary', reducible: true, monthlyBudget: 0, active: true },
  { id: 'shopping', name: 'Compras', kind: 'expense', essentiality: 'discretionary', reducible: true, monthlyBudget: 0, active: true },
  { id: 'debt', name: 'Dívidas / parcelas', kind: 'expense', essentiality: 'essential', reducible: false, monthlyBudget: 0, active: true },
  { id: 'other-expense', name: 'Outras despesas', kind: 'expense', essentiality: 'flexible', reducible: true, monthlyBudget: 0, active: true },
]

export const emptyState: FinanceState = {
  schemaVersion: 3,
  settings: { setupComplete: false, reserveMonths: 6, reserveContributionShare: 50, displayName: '' },
  categories: defaultCategories,
  accounts: [{ id: 'main-account', name: 'Conta principal', kind: 'bank', initialBalance: 0, active: true }],
  incomeSources: [],
  recurringExpenses: [],
  transactions: [],
  cards: [],
  cardPurchases: [],
  debts: [],
  goals: [],
  payments: {},
  closings: [],
  security: { enabled: false, pinHash: '', biometric: false, autoLockMinutes: 0 },
  notifications: { enabled: false, daysBefore: 2, hour: 9 },
}

function categoryByName(categories: Category[], name: string, kind: MoneyKind) {
  const normalized = name.toLowerCase()
  const found = categories.find((item) => item.kind === kind && item.name.toLowerCase() === normalized)
  if (found) return found.id
  return kind === 'income' ? 'income-extra' : 'other-expense'
}

function legacyCategoryFor(name: string) {
  const text = name.toLowerCase()
  if (text.includes('morad') || text.includes('alug') || text.includes('condom')) return 'housing'
  if (text.includes('pensão') || text.includes('pensao') || text.includes('filh')) return 'child'
  if (text.includes('energia') || text.includes('internet') || text.includes('celular') || text.includes('água') || text.includes('agua')) return 'utilities'
  if (text.includes('academ')) return 'fitness'
  if (text.includes('moto') || text.includes('transport')) return 'transport'
  if (text.includes('salár') || text.includes('salar')) return 'income-salary'
  if (text.includes('extra')) return 'income-extra'
  return 'other-expense'
}

function migrateLegacy(raw: any): FinanceState {
  const state: FinanceState = structuredClone(emptyState)
  const config = raw?.config ?? {}
  state.settings.setupComplete = true

  if (Number(config.salaryNet) > 0) {
    state.incomeSources.push({ id: 'legacy-salary', name: 'Salário líquido', mode: 'fixed', amount: Number(config.salaryNet), min: 0, max: 0, day: 5, categoryId: 'income-salary', accountId: 'main-account', active: true })
  }
  if (Number(config.extraMax) > 0 || Number(config.extraMin) > 0) {
    state.incomeSources.push({ id: 'legacy-extra', name: 'Renda extra', mode: 'variable', amount: 0, min: Number(config.extraMin) || 0, max: Number(config.extraMax) || 0, day: 25, categoryId: 'income-extra', accountId: 'main-account', active: true })
  }
  if (Number(config.mealVoucher) > 0) {
    state.incomeSources.push({ id: 'legacy-benefit', name: 'Vale-refeição', mode: 'benefit', amount: Number(config.mealVoucher), min: 0, max: 0, day: 1, categoryId: 'benefit', accountId: 'main-account', active: true })
  }

  const due = config.dueDays ?? {}
  const addExpense = (id: string, name: string, amount: number, dueDay: number, categoryId: string, reducible: boolean) => {
    if (amount > 0) state.recurringExpenses.push({ id, name, amount, dueDay: clampDay(dueDay), categoryId, accountId: 'main-account', reducible, active: true, notes: '' })
  }
  addExpense('legacy-housing', 'Moradia', Number(config.housing) || 0, Number(due.housing) || 10, 'housing', false)
  const pension = Number(config.salaryNet || 0) * (Number(config.pensionPercent || 0) / 100)
  addExpense('legacy-pension', 'Pensão', pension, Number(due.pension) || 10, 'child', false)
  addExpense('legacy-energy', 'Energia', Number(config.energy) || 0, Number(due.energy) || 15, 'utilities', true)
  addExpense('legacy-internet', 'Internet', Number(config.internet) || 0, Number(due.internet) || 20, 'utilities', true)
  addExpense('legacy-phone', 'Celular', Number(config.phone) || 0, Number(due.phone) || 25, 'utilities', true)
  addExpense('legacy-gym', 'Academia', Number(config.gym) || 0, Number(due.gym) || 5, 'fitness', true)
  addExpense('legacy-motorcycle', 'Moto / manutenção', Number(config.motorcycle) || 0, Number(due.motorcycle) || 1, 'transport', true)
  if (Number(config.cardBudget) > 0 && config.cardMode !== 'actual') addExpense('legacy-card-budget', 'Orçamento do cartão', Number(config.cardBudget), 9, 'shopping', true)

  state.cards = Array.isArray(raw?.cards) ? raw.cards.map((card: any) => ({ id: String(card.id || uid()), name: String(card.name || 'Cartão'), limit: Number(card.limit) || 0, closingDay: clampDay(card.closingDay || 2), dueDay: clampDay(card.dueDay || 9), active: card.active !== false })) : []
  state.cardPurchases = Array.isArray(raw?.cardPurchases) ? raw.cardPurchases.map((purchase: any) => ({ id: String(purchase.id || uid()), cardId: String(purchase.cardId || state.cards[0]?.id || ''), description: String(purchase.description || 'Compra'), totalAmount: Number(purchase.totalAmount) || 0, purchaseDate: String(purchase.purchaseDate || todayIso()), installments: Math.max(1, Number(purchase.installments) || 1), recurring: Boolean(purchase.recurring), active: purchase.active !== false, categoryId: legacyCategoryFor(String(purchase.category || '')) })) : []

  const oldMovements = Array.isArray(raw?.movements) ? raw.movements : []
  state.transactions = oldMovements.map((item: any) => ({ id: String(item.id || uid()), description: String(item.description || 'Lançamento'), amount: Number(item.amount) || 0, type: item.type === 'income' ? 'income' : 'expense', categoryId: item.type === 'income' ? categoryByName(state.categories, String(item.category || ''), 'income') : legacyCategoryFor(String(item.category || '')), accountId: 'main-account', date: String(item.date || todayIso()), paid: Boolean(item.paid), notes: '' }))

  const oldGoals = Array.isArray(raw?.goals) ? raw.goals : []
  state.goals = oldGoals.map((goal: any) => ({ id: String(goal.id || uid()), name: String(goal.name || 'Meta'), type: String(goal.id || '').includes('reserve') ? 'emergency' : 'custom', target: Number(goal.target) || 0, current: Number(goal.current) || 0, targetDate: String(goal.targetDate || ''), priority: ['high', 'medium', 'low'].includes(goal.priority) ? goal.priority : 'medium', active: goal.active !== false, monthlyOverride: 0 }))
  if (!state.goals.some((goal) => goal.type === 'emergency')) state.goals.push({ id: 'emergency', name: 'Reserva de emergência', type: 'emergency', target: 0, current: 0, targetDate: '', priority: 'high', active: true, monthlyOverride: 0 })

  state.payments = raw?.payments && typeof raw.payments === 'object' ? raw.payments : {}
  state.closings = Array.isArray(raw?.closings) ? raw.closings.map((item: any) => ({ month: String(item.month || currentMonth()), closedAt: String(item.closedAt || new Date().toISOString()), guaranteedIncome: Number(item.guaranteedIncome) || 0, plannedExpenses: Number(item.plannedExpenses) || 0, actualIncome: Number(item.actualIncome) || 0, actualExpenses: Number(item.actualExpenses) || 0, margin: Number(item.margin) || 0, actualMargin: Number(item.actualMargin) || 0, categoryTotals: item.categoryTotals ?? item.categories ?? {} })) : []
  state.security = { ...state.security, ...(raw?.security ?? {}) }
  state.notifications = { ...state.notifications, ...(raw?.notifications ?? {}) }
  return state
}

export function normalizeState(raw: Partial<FinanceState> | null | undefined): FinanceState {
  if (!raw) return structuredClone(emptyState)
  const base = structuredClone(emptyState)
  return {
    ...base,
    ...raw,
    schemaVersion: 3,
    settings: { ...base.settings, ...(raw.settings ?? {}) },
    categories: Array.isArray(raw.categories) && raw.categories.length ? raw.categories : base.categories,
    accounts: Array.isArray(raw.accounts) && raw.accounts.length ? raw.accounts : base.accounts,
    incomeSources: Array.isArray(raw.incomeSources) ? raw.incomeSources : [],
    recurringExpenses: Array.isArray(raw.recurringExpenses) ? raw.recurringExpenses : [],
    transactions: Array.isArray(raw.transactions) ? raw.transactions : [],
    cards: Array.isArray(raw.cards) ? raw.cards : [],
    cardPurchases: Array.isArray(raw.cardPurchases) ? raw.cardPurchases : [],
    debts: Array.isArray(raw.debts) ? raw.debts : [],
    goals: Array.isArray(raw.goals) ? raw.goals : [],
    payments: raw.payments && typeof raw.payments === 'object' ? raw.payments : {},
    closings: Array.isArray(raw.closings) ? raw.closings : [],
    security: { ...base.security, ...(raw.security ?? {}) },
    notifications: { ...base.notifications, ...(raw.notifications ?? {}) },
  }
}

export function loadState(): FinanceState {
  try {
    const current = localStorage.getItem(STORAGE_KEY_V2)
    if (current) return normalizeState(JSON.parse(current))
    const legacy = localStorage.getItem(LEGACY_V1_KEY) ?? localStorage.getItem(LEGACY_V0_KEY)
    if (legacy) return migrateLegacy(JSON.parse(legacy))
  } catch {
    // ignore corrupted local state and start fresh
  }
  return structuredClone(emptyState)
}

export function appliesToMonth(date: string, month: string) {
  return date.slice(0, 7) === month
}

export function firstInvoiceMonth(purchase: CardPurchase, card: CardAccount) {
  const purchaseMonth = purchase.purchaseDate.slice(0, 7)
  const day = Number(purchase.purchaseDate.slice(8, 10))
  if (day > clampDay(card.closingDay)) return shiftMonth(purchaseMonth, 1)
  return clampDay(card.dueDay) > clampDay(card.closingDay) ? purchaseMonth : shiftMonth(purchaseMonth, 1)
}

export function cardPurchaseForMonth(purchase: CardPurchase, card: CardAccount, month: string) {
  if (!purchase.active) return 0
  const first = firstInvoiceMonth(purchase, card)
  const diff = monthDiff(first, month)
  if (diff < 0) return 0
  if (purchase.recurring) return purchase.totalAmount
  if (diff >= Math.max(1, purchase.installments)) return 0
  return purchase.totalAmount / Math.max(1, purchase.installments)
}

export function cardInvoiceForMonth(state: FinanceState, month: string, cardId?: string) {
  return state.cardPurchases.reduce((sum, purchase) => {
    if (cardId && purchase.cardId !== cardId) return sum
    const card = state.cards.find((item) => item.id === purchase.cardId && item.active)
    return card ? sum + cardPurchaseForMonth(purchase, card, month) : sum
  }, 0)
}

export function categoryFor(state: FinanceState, id: string) {
  return state.categories.find((item) => item.id === id)
}

export function categoryTotals(state: FinanceState, month: string) {
  const totals: Record<string, number> = {}
  const add = (categoryId: string, value: number) => { totals[categoryId] = (totals[categoryId] ?? 0) + value }
  state.recurringExpenses.filter((item) => item.active).forEach((item) => add(item.categoryId, item.amount))
  state.debts.filter((item) => item.active && item.remainingInstallments !== 0).forEach((item) => add(item.categoryId, item.installment))
  state.transactions.filter((item) => item.type === 'expense' && appliesToMonth(item.date, month)).forEach((item) => add(item.categoryId, item.amount))
  state.cardPurchases.forEach((purchase) => {
    const card = state.cards.find((item) => item.id === purchase.cardId && item.active)
    if (card) add(purchase.categoryId, cardPurchaseForMonth(purchase, card, month))
  })
  return totals
}

export function monthlySummary(state: FinanceState, month: string) {
  let fixedIncome = 0
  let variableMin = 0
  let variableMax = 0
  let benefits = 0
  for (const source of state.incomeSources.filter((item) => item.active)) {
    if (source.mode === 'fixed') fixedIncome += source.amount
    else if (source.mode === 'variable') { variableMin += source.min; variableMax += source.max }
    else benefits += source.amount
  }
  const oneOffIncome = state.transactions.filter((item) => item.type === 'income' && appliesToMonth(item.date, month)).reduce((sum, item) => sum + item.amount, 0)
  const recurring = state.recurringExpenses.filter((item) => item.active).reduce((sum, item) => sum + item.amount, 0)
  const debtInstallments = state.debts.filter((item) => item.active && item.remainingInstallments !== 0).reduce((sum, item) => sum + item.installment, 0)
  const cardInvoice = cardInvoiceForMonth(state, month)
  const oneOffExpenses = state.transactions.filter((item) => item.type === 'expense' && appliesToMonth(item.date, month)).reduce((sum, item) => sum + item.amount, 0)
  const guaranteedIncome = fixedIncome + oneOffIncome
  const plannedExpenses = recurring + debtInstallments + cardInvoice + oneOffExpenses
  const marginGuaranteed = guaranteedIncome - plannedExpenses
  const categories = categoryTotals(state, month)
  const essentialExpenses = Object.entries(categories).reduce((sum, [categoryId, value]) => categoryFor(state, categoryId)?.essentiality === 'essential' ? sum + value : sum, 0)
  return { fixedIncome, variableMin, variableMax, benefits, oneOffIncome, recurring, debtInstallments, cardInvoice, oneOffExpenses, guaranteedIncome, plannedExpenses, marginGuaranteed, lowMargin: marginGuaranteed + variableMin, highMargin: marginGuaranteed + variableMax, essentialExpenses, categories }
}

export function calendarItems(state: FinanceState, month: string): CalendarItem[] {
  const paid = (id: string, fallback = false) => state.payments[paymentKey(month, id)] ?? fallback
  const items: CalendarItem[] = []
  for (const source of state.incomeSources.filter((item) => item.active && item.mode !== 'variable')) {
    const value = source.mode === 'benefit' ? source.amount : source.amount
    items.push({ id: `income-${source.id}`, date: isoForDay(month, source.day), title: source.name, amount: value, kind: 'income', source: 'income', categoryId: source.categoryId, paid: paid(`income-${source.id}`) })
  }
  for (const expense of state.recurringExpenses.filter((item) => item.active)) {
    items.push({ id: `recurring-${expense.id}`, date: isoForDay(month, expense.dueDay), title: expense.name, amount: expense.amount, kind: 'expense', source: 'recurring', categoryId: expense.categoryId, paid: paid(`recurring-${expense.id}`) })
  }
  for (const debt of state.debts.filter((item) => item.active && item.remainingInstallments !== 0)) {
    items.push({ id: `debt-${debt.id}`, date: isoForDay(month, debt.dueDay), title: debt.name, amount: debt.installment, kind: 'expense', source: 'debt', categoryId: debt.categoryId, paid: paid(`debt-${debt.id}`) })
  }
  for (const card of state.cards.filter((item) => item.active)) {
    const invoice = cardInvoiceForMonth(state, month, card.id)
    if (invoice > 0) items.push({ id: `card-${card.id}`, date: isoForDay(month, card.dueDay), title: `Fatura ${card.name}`, amount: invoice, kind: 'expense', source: 'card', categoryId: 'shopping', paid: paid(`card-${card.id}`) })
  }
  for (const transaction of state.transactions.filter((item) => appliesToMonth(item.date, month))) {
    items.push({ id: `transaction-${transaction.id}`, date: transaction.date, title: transaction.description, amount: transaction.amount, kind: transaction.type, source: 'transaction', categoryId: transaction.categoryId, paid: paid(`transaction-${transaction.id}`, transaction.paid) })
  }
  return items.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title))
}

export function accountBalance(state: FinanceState, accountId: string) {
  const account = state.accounts.find((item) => item.id === accountId)
  if (!account) return 0
  return state.transactions.reduce((balance, transaction) => {
    if (transaction.accountId !== accountId || !transaction.paid) return balance
    return balance + (transaction.type === 'income' ? transaction.amount : -transaction.amount)
  }, account.initialBalance)
}

export function remainingDaysInMonth(month: string) {
  const [year, m] = month.split('-').map(Number)
  const total = new Date(year, m, 0).getDate()
  if (month !== currentMonth()) return total
  return Math.max(1, total - new Date().getDate() + 1)
}

export async function hashText(value: string) {
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(buffer)).map((item) => item.toString(16).padStart(2, '0')).join('')
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = ''
  bytes.forEach((byte) => { binary += String.fromCharCode(byte) })
  return btoa(binary)
}

function base64ToBytes(value: string) {
  const binary = atob(value)
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

export async function encryptBackup(state: FinanceState, password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const baseKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey'])
  const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 120000, hash: 'SHA-256' }, baseKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt'])
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(state)))
  return JSON.stringify({ version: 2, salt: bytesToBase64(salt), iv: bytesToBase64(iv), data: bytesToBase64(new Uint8Array(encrypted)) })
}

export async function decryptBackup(payload: string, password: string): Promise<FinanceState> {
  const parsed = JSON.parse(payload)
  const salt = base64ToBytes(parsed.salt)
  const iv = base64ToBytes(parsed.iv)
  const data = base64ToBytes(parsed.data)
  const baseKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey'])
  const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 120000, hash: 'SHA-256' }, baseKey, { name: 'AES-GCM', length: 256 }, false, ['decrypt'])
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data)
  return normalizeState(JSON.parse(new TextDecoder().decode(decrypted)))
}
