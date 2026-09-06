export type MovementType = 'income' | 'expense'
export type Recurrence = 'none' | 'monthly'
export type CardMode = 'budget' | 'actual'
export type Priority = 'high' | 'medium' | 'low'

export type DueDays = {
  housing: number
  pension: number
  energy: number
  internet: number
  phone: number
  gym: number
  motorcycle: number
}

export type BudgetConfig = {
  salaryNet: number
  extraMin: number
  extraMax: number
  mealVoucher: number
  housing: number
  pensionPercent: number
  energy: number
  internet: number
  phone: number
  gym: number
  motorcycle: number
  cardBudget: number
  cardMode: CardMode
  dueDays: DueDays
}

export type Movement = {
  id: string
  description: string
  amount: number
  type: MovementType
  category: string
  date: string
  recurrence: Recurrence
  paid: boolean
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
  category: string
}

export type Goal = {
  id: string
  name: string
  target: number
  current: number
  targetDate: string
  priority: Priority
  active: boolean
}

export type MonthClosing = {
  month: string
  closedAt: string
  guaranteedIncome: number
  variableIncome: number
  plannedExpenses: number
  paidMovements: number
  margin: number
  categories: Record<string, number>
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

export type AppState = {
  config: BudgetConfig
  movements: Movement[]
  cards: CardAccount[]
  cardPurchases: CardPurchase[]
  goals: Goal[]
  closings: MonthClosing[]
  security: SecuritySettings
  notifications: NotificationSettings
}

export const STORAGE_KEY = 'financeiro-personal-v2'
export const LEGACY_STORAGE_KEY = 'financeiro-personal-v1'
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

export function monthFrom(date: string) {
  return date.slice(0, 7)
}

export function shiftMonth(month: string, amount: number) {
  const [year, m] = month.split('-').map(Number)
  const date = new Date(year, m - 1 + amount, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
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

export function appliesToMonth(movement: Movement, month: string) {
  const movementMonth = monthFrom(movement.date)
  return movement.recurrence === 'monthly' ? movementMonth <= month : movementMonth === month
}

export const defaultState: AppState = {
  config: {
    salaryNet: 3500,
    extraMin: 150,
    extraMax: 300,
    mealVoucher: 500,
    housing: 1200,
    pensionPercent: (1200 / 3500) * 100,
    energy: 250,
    internet: 100,
    phone: 49,
    gym: 80,
    motorcycle: 150,
    cardBudget: 600,
    cardMode: 'budget',
    dueDays: { housing: 10, pension: 10, energy: 15, internet: 20, phone: 25, gym: 5, motorcycle: 1 },
  },
  movements: [],
  cards: [
    { id: 'main-card', name: 'Cartão principal', limit: 0, closingDay: 2, dueDay: 9, active: true },
  ],
  cardPurchases: [],
  goals: [
    { id: 'reserve', name: 'Reserva de emergência', target: 10887, current: 0, targetDate: '', priority: 'high', active: true },
  ],
  closings: [],
  security: { enabled: false, pinHash: '', biometric: false, autoLockMinutes: 0 },
  notifications: { enabled: false, daysBefore: 2, hour: 9 },
}

function safeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

export function normalizeState(value: Partial<AppState> | null | undefined): AppState {
  const legacyConfig = value?.config ?? {}
  return {
    config: {
      ...defaultState.config,
      ...legacyConfig,
      dueDays: { ...defaultState.config.dueDays, ...(legacyConfig as BudgetConfig).dueDays },
    },
    movements: safeArray<Movement>(value?.movements),
    cards: safeArray<CardAccount>(value?.cards).length ? safeArray<CardAccount>(value?.cards) : defaultState.cards,
    cardPurchases: safeArray<CardPurchase>(value?.cardPurchases),
    goals: safeArray<Goal>(value?.goals).length ? safeArray<Goal>(value?.goals) : defaultState.goals,
    closings: safeArray<MonthClosing>(value?.closings),
    security: { ...defaultState.security, ...(value?.security ?? {}) },
    notifications: { ...defaultState.notifications, ...(value?.notifications ?? {}) },
  }
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY)
    return raw ? normalizeState(JSON.parse(raw) as Partial<AppState>) : defaultState
  } catch {
    return defaultState
  }
}

export function movementTotals(movements: Movement[], month: string, paidOnly = false) {
  return movements.reduce(
    (acc, movement) => {
      if (!appliesToMonth(movement, month) || (paidOnly && !movement.paid)) return acc
      if (movement.type === 'income') acc.income += movement.amount
      else acc.expense += movement.amount
      return acc
    },
    { income: 0, expense: 0 },
  )
}

export function firstInvoiceMonth(purchase: CardPurchase, card: CardAccount) {
  const purchaseMonth = monthFrom(purchase.purchaseDate)
  const day = Number(purchase.purchaseDate.slice(8, 10))
  const afterClosing = day > clampDay(card.closingDay)
  const dueAfterClosing = clampDay(card.dueDay) > clampDay(card.closingDay)
  if (afterClosing) return shiftMonth(purchaseMonth, 1)
  return dueAfterClosing ? purchaseMonth : shiftMonth(purchaseMonth, 1)
}

export function cardPurchaseForMonth(purchase: CardPurchase, card: CardAccount, month: string) {
  if (!purchase.active) return 0
  const first = firstInvoiceMonth(purchase, card)
  if (month < first) return 0
  if (purchase.recurring) return purchase.totalAmount
  const diff = monthDiff(first, month)
  if (diff < 0 || diff >= Math.max(1, purchase.installments)) return 0
  return purchase.totalAmount / Math.max(1, purchase.installments)
}

export function cardInvoiceForMonth(state: Pick<AppState, 'cards' | 'cardPurchases'>, month: string, cardId?: string) {
  return state.cardPurchases.reduce((total, purchase) => {
    if (cardId && purchase.cardId !== cardId) return total
    const card = state.cards.find((item) => item.id === purchase.cardId && item.active)
    return card ? total + cardPurchaseForMonth(purchase, card, month) : total
  }, 0)
}

export function cardCommittedLimit(state: Pick<AppState, 'cards' | 'cardPurchases'>, cardId: string) {
  return state.cardPurchases.reduce((total, purchase) => {
    if (!purchase.active || purchase.cardId !== cardId || purchase.recurring) return total
    const card = state.cards.find((item) => item.id === cardId)
    if (!card) return total
    const first = firstInvoiceMonth(purchase, card)
    const elapsed = Math.max(0, monthDiff(first, currentMonth()))
    const remainingInstallments = Math.max(0, Math.max(1, purchase.installments) - elapsed)
    return total + (purchase.totalAmount / Math.max(1, purchase.installments)) * remainingInstallments
  }, 0)
}

export function monthDiff(from: string, to: string) {
  const [fy, fm] = from.split('-').map(Number)
  const [ty, tm] = to.split('-').map(Number)
  return (ty - fy) * 12 + (tm - fm)
}

export function expenseSummary(state: AppState, month: string) {
  const c = state.config
  const pension = c.salaryNet * (c.pensionPercent / 100)
  const card = c.cardMode === 'actual' ? cardInvoiceForMonth(state, month) : c.cardBudget
  const categories: Record<string, number> = {
    Moradia: c.housing,
    Pensão: pension,
    Energia: c.energy,
    Internet: c.internet,
    Celular: c.phone,
    Academia: c.gym,
    Moto: c.motorcycle,
    Cartão: card,
  }
  const fixed = Object.values(categories).reduce((a, b) => a + b, 0)
  const excludingHousing = fixed - c.housing
  const safeHousing = Math.max(0, c.salaryNet - excludingHousing)
  return { pension, card, fixed, excludingHousing, safeHousing, categories }
}

export function monthSnapshot(state: AppState, month: string) {
  const fixed = expenseSummary(state, month)
  const totals = movementTotals(state.movements, month)
  const guaranteedIncome = state.config.salaryNet + totals.income
  const plannedExpenses = fixed.fixed + totals.expense
  const guaranteedMargin = guaranteedIncome - plannedExpenses
  return {
    guaranteedIncome,
    variableMin: state.config.extraMin,
    variableMax: state.config.extraMax,
    plannedExpenses,
    guaranteedMargin,
    lowMargin: guaranteedMargin + state.config.extraMin,
    highMargin: guaranteedMargin + state.config.extraMax,
    fixed,
    totals,
  }
}

export function categoryTotals(state: AppState, month: string) {
  const base = { ...expenseSummary(state, month).categories }
  for (const movement of state.movements) {
    if (movement.type !== 'expense' || !appliesToMonth(movement, month)) continue
    base[movement.category || 'Outros'] = (base[movement.category || 'Outros'] ?? 0) + movement.amount
  }
  return base
}

export function daysInMonth(month: string) {
  const [year, m] = month.split('-').map(Number)
  return new Date(year, m, 0).getDate()
}

export function remainingDaysInMonth(month: string) {
  if (month !== currentMonth()) return daysInMonth(month)
  return Math.max(1, daysInMonth(month) - new Date().getDate() + 1)
}

export type CalendarItem = {
  id: string
  date: string
  title: string
  amount: number
  kind: 'income' | 'expense'
  source: 'fixed' | 'movement' | 'card' | 'goal'
  paid: boolean
}

export function calendarItems(state: AppState, month: string): CalendarItem[] {
  const c = state.config
  const summary = expenseSummary(state, month)
  const items: CalendarItem[] = [
    { id: 'fixed-housing', date: isoForDay(month, c.dueDays.housing), title: 'Moradia', amount: c.housing, kind: 'expense', source: 'fixed', paid: false },
    { id: 'fixed-pension', date: isoForDay(month, c.dueDays.pension), title: 'Pensão', amount: summary.pension, kind: 'expense', source: 'fixed', paid: false },
    { id: 'fixed-energy', date: isoForDay(month, c.dueDays.energy), title: 'Energia', amount: c.energy, kind: 'expense', source: 'fixed', paid: false },
    { id: 'fixed-internet', date: isoForDay(month, c.dueDays.internet), title: 'Internet', amount: c.internet, kind: 'expense', source: 'fixed', paid: false },
    { id: 'fixed-phone', date: isoForDay(month, c.dueDays.phone), title: 'Celular', amount: c.phone, kind: 'expense', source: 'fixed', paid: false },
    { id: 'fixed-gym', date: isoForDay(month, c.dueDays.gym), title: 'Academia', amount: c.gym, kind: 'expense', source: 'fixed', paid: false },
    { id: 'fixed-motorcycle', date: isoForDay(month, c.dueDays.motorcycle), title: 'Moto / manutenção', amount: c.motorcycle, kind: 'expense', source: 'fixed', paid: false },
  ].filter((item) => item.amount > 0) as CalendarItem[]

  if (c.cardMode === 'budget') {
    const card = state.cards.find((item) => item.active)
    items.push({ id: 'card-budget', date: isoForDay(month, card?.dueDay ?? 9), title: 'Cartão (orçamento)', amount: c.cardBudget, kind: 'expense', source: 'card', paid: false })
  } else {
    for (const card of state.cards.filter((item) => item.active)) {
      const amount = cardInvoiceForMonth(state, month, card.id)
      if (amount > 0) items.push({ id: `card-${card.id}`, date: isoForDay(month, card.dueDay), title: `Fatura ${card.name}`, amount, kind: 'expense', source: 'card', paid: false })
    }
  }

  for (const movement of state.movements) {
    if (!appliesToMonth(movement, month)) continue
    const day = Number(movement.date.slice(8, 10)) || 1
    items.push({
      id: `movement-${movement.id}`,
      date: isoForDay(month, day),
      title: movement.description,
      amount: movement.amount,
      kind: movement.type,
      source: 'movement',
      paid: movement.paid,
    })
  }
  return items.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title))
}

export function suggestedGoalContribution(goal: Goal, month = currentMonth()) {
  if (!goal.active || goal.current >= goal.target) return 0
  if (!goal.targetDate) return Math.max(0, goal.target - goal.current)
  const targetMonth = monthFrom(goal.targetDate)
  const months = Math.max(1, monthDiff(month, targetMonth) + 1)
  return Math.max(0, goal.target - goal.current) / months
}

export async function hashText(value: string) {
  const bytes = new TextEncoder().encode(value)
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function toBase64(bytes: Uint8Array) {
  let binary = ''
  bytes.forEach((byte) => { binary += String.fromCharCode(byte) })
  return btoa(binary)
}

function fromBase64(value: string) {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function deriveBackupKey(password: string, salt: Uint8Array) {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: 150000, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function encryptBackup(state: AppState, password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveBackupKey(password, salt)
  const plain = new TextEncoder().encode(JSON.stringify(state))
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, plain)
  return JSON.stringify({ version: 1, salt: toBase64(salt), iv: toBase64(iv), data: toBase64(new Uint8Array(encrypted)) })
}

export async function decryptBackup(payload: string, password: string) {
  const parsed = JSON.parse(payload) as { version: number; salt: string; iv: string; data: string }
  if (parsed.version !== 1 || !parsed.salt || !parsed.iv || !parsed.data) throw new Error('Backup inválido')
  const salt = fromBase64(parsed.salt)
  const iv = fromBase64(parsed.iv)
  const data = fromBase64(parsed.data)
  const key = await deriveBackupKey(password, salt)
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, data as BufferSource)
  return normalizeState(JSON.parse(new TextDecoder().decode(plain)) as Partial<AppState>)
}
