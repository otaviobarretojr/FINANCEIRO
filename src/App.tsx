import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Browser } from '@capacitor/browser'
import { App as CapApp } from '@capacitor/app'
import { LocalNotifications } from '@capacitor/local-notifications'
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { BiometricAuth } from '@aparajita/capacitor-biometric-auth'
import {
  AlertTriangle,
  BarChart3,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  CreditCard,
  Download,
  Fingerprint,
  Home,
  Landmark,
  ListPlus,
  LockKeyhole,
  MoreHorizontal,
  PiggyBank,
  Plus,
  Receipt,
  RefreshCw,
  Settings,
  ShieldCheck,
  Target,
  Trash2,
  Upload,
  WalletCards,
  X,
} from 'lucide-react'
import {
  REPO,
  STORAGE_KEY,
  type AppState,
  type BudgetConfig,
  type CardAccount,
  type CardPurchase,
  type Goal,
  type Movement,
  type Priority,
  calendarItems,
  cardCommittedLimit,
  cardInvoiceForMonth,
  categoryTotals,
  currentMonth,
  dateLabel,
  decryptBackup,
  defaultState,
  encryptBackup,
  expenseSummary,
  hashText,
  loadState,
  money,
  monthLabel,
  monthSnapshot,
  normalizeState,
  paymentKey,
  remainingDaysInMonth,
  shiftMonth,
  suggestedGoalContribution,
  todayIso,
  uid,
} from './domain'

declare const __APP_VERSION__: string

type Tab = 'dashboard' | 'movements' | 'cards' | 'calendar' | 'more' | 'projection' | 'analysis' | 'goals' | 'settings'

const numeric = (value: string) => Math.max(0, Number(value) || 0)

function App() {
  const [state, setState] = useState<AppState>(() => loadState())
  const [tab, setTab] = useState<Tab>('dashboard')
  const [month, setMonth] = useState(currentMonth())
  const [showMovement, setShowMovement] = useState(false)
  const [showPurchase, setShowPurchase] = useState(false)
  const [showGoal, setShowGoal] = useState(false)
  const [updateText, setUpdateText] = useState('')
  const [locked, setLocked] = useState(() => loadState().security.enabled)
  const [biometryAvailable, setBiometryAvailable] = useState(false)
  const importRef = useRef<HTMLInputElement>(null)
  const inactiveAt = useRef<number | null>(null)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  useEffect(() => {
    BiometricAuth.checkBiometry()
      .then((result) => setBiometryAvailable(Boolean(result.isAvailable || result.deviceIsSecure)))
      .catch(() => setBiometryAvailable(false))
  }, [])

  useEffect(() => {
    let handle: { remove: () => Promise<void> } | undefined
    CapApp.addListener('appStateChange', ({ isActive }) => {
      if (!state.security.enabled) return
      if (!isActive) {
        inactiveAt.current = Date.now()
        if (state.security.autoLockMinutes === 0) setLocked(true)
        return
      }
      if (inactiveAt.current && state.security.autoLockMinutes > 0) {
        const elapsed = (Date.now() - inactiveAt.current) / 60000
        if (elapsed >= state.security.autoLockMinutes) setLocked(true)
      }
      inactiveAt.current = null
    }).then((listener) => { handle = listener })
    return () => { handle?.remove().catch(() => undefined) }
  }, [state.security.enabled, state.security.autoLockMinutes])

  const snapshot = useMemo(() => monthSnapshot(state, month), [state, month])
  const daysLeft = remainingDaysInMonth(month)
  const dailySafe = Math.max(0, snapshot.guaranteedMargin) / daysLeft
  const health = snapshot.guaranteedMargin < 0 ? 'attention' : snapshot.guaranteedMargin < 300 ? 'tight' : 'good'

  const updateConfig = <K extends keyof BudgetConfig>(key: K, value: BudgetConfig[K]) => {
    setState((previous) => ({ ...previous, config: { ...previous.config, [key]: value } }))
  }

  const togglePayment = (itemId: string, targetMonth = month) => {
    const key = paymentKey(targetMonth, itemId)
    setState((previous) => ({ ...previous, payments: { ...previous.payments, [key]: !previous.payments[key] } }))
  }

  const removeMovement = (id: string) => {
    setState((previous) => ({ ...previous, movements: previous.movements.filter((item) => item.id !== id) }))
  }

  const authenticateBiometric = async () => {
    try {
      await BiometricAuth.authenticate({
        reason: 'Acessar seus dados financeiros',
        cancelTitle: 'Cancelar',
        allowDeviceCredential: true,
        androidTitle: 'Desbloquear FINANCEIRO',
        androidSubtitle: 'Confirme sua identidade',
        androidConfirmationRequired: false,
      })
      setLocked(false)
      return true
    } catch {
      return false
    }
  }

  const unlockWithPin = async (pin: string) => {
    if (!pin || !state.security.pinHash) return false
    const ok = (await hashText(pin)) === state.security.pinHash
    if (ok) setLocked(false)
    return ok
  }

  const checkUpdate = async () => {
    setUpdateText('Verificando...')
    try {
      const response = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } })
      if (!response.ok) throw new Error('Sem release')
      const release = await response.json()
      const latest = String(release.tag_name ?? '').replace(/^v/, '')
      const current = String(__APP_VERSION__).replace(/^v/, '')
      const asset = Array.isArray(release.assets)
        ? release.assets.find((item: { name?: string }) => item.name?.toLowerCase().endsWith('.apk'))
        : null
      if (latest && latest !== current && asset?.browser_download_url) {
        setUpdateText(`Nova versão ${latest} disponível`)
        await Browser.open({ url: asset.browser_download_url })
      } else setUpdateText(`Versão atual: ${current}`)
    } catch {
      setUpdateText('Nenhuma atualização publicada no momento.')
    }
  }

  const exportPlainBackup = () => downloadText(`financeiro-backup-${todayIso()}.json`, JSON.stringify(state, null, 2), 'application/json')

  const shareEncryptedBackup = async () => {
    const password = window.prompt('Crie uma senha para criptografar o backup. Guarde essa senha.')
    if (!password || password.length < 4) return window.alert('Use uma senha de pelo menos 4 caracteres.')
    try {
      const encrypted = await encryptBackup(state, password)
      const name = `financeiro-seguro-${todayIso()}.enc.json`
      const written = await Filesystem.writeFile({ path: name, data: encrypted, directory: Directory.Cache, encoding: Encoding.UTF8 })
      await Share.share({ title: 'Backup seguro FINANCEIRO', text: 'Backup criptografado. Salve no Google Drive ou em outro local seguro.', files: [written.uri], dialogTitle: 'Salvar backup seguro' })
    } catch {
      window.alert('Não foi possível compartilhar o backup criptografado.')
    }
  }

  const importBackup = async (file?: File) => {
    if (!file) return
    try {
      const text = await file.text()
      let restored: AppState
      if (file.name.endsWith('.enc.json')) {
        const password = window.prompt('Digite a senha usada para criptografar este backup.')
        if (!password) return
        restored = await decryptBackup(text, password)
      } else restored = normalizeState(JSON.parse(text) as Partial<AppState>)
      setState(restored)
      setLocked(restored.security.enabled)
      window.alert('Backup restaurado com sucesso.')
    } catch {
      window.alert('Não foi possível restaurar o backup. Confira o arquivo e a senha.')
    } finally {
      if (importRef.current) importRef.current.value = ''
    }
  }

  const syncNotifications = async () => {
    try {
      let permission = await LocalNotifications.checkPermissions()
      if (permission.display !== 'granted') permission = await LocalNotifications.requestPermissions()
      if (permission.display !== 'granted') throw new Error('Permissão negada')
      const pending = await LocalNotifications.getPending()
      if (pending.notifications.length) await LocalNotifications.cancel({ notifications: pending.notifications.map((item) => ({ id: item.id })) })
      if (!state.notifications.enabled) return window.alert('Lembretes foram desativados e os agendamentos antigos removidos.')

      const start = currentMonth()
      const notifications: { id: number; title: string; body: string; schedule: { at: Date }; extra: { date: string } }[] = []
      let id = 1000
      for (let offset = 0; offset < 3; offset += 1) {
        const targetMonth = shiftMonth(start, offset)
        for (const item of calendarItems(state, targetMonth)) {
          if (item.kind !== 'expense' || item.amount <= 0 || item.paid) continue
          const at = new Date(`${item.date}T${String(state.notifications.hour).padStart(2, '0')}:00:00`)
          at.setDate(at.getDate() - state.notifications.daysBefore)
          if (at.getTime() <= Date.now()) continue
          notifications.push({ id: id++, title: `Conta próxima: ${item.title}`, body: `${money(item.amount)} • vence ${dateLabel(item.date)}`, schedule: { at }, extra: { date: item.date } })
          if (notifications.length >= 55) break
        }
      }
      if (notifications.length) await LocalNotifications.schedule({ notifications })
      window.alert(`${notifications.length} lembrete(s) agendado(s).`)
    } catch {
      window.alert('Não foi possível configurar os lembretes. Verifique a permissão de notificações do aplicativo.')
    }
  }

  const closeMonth = () => {
    const categories = categoryTotals(state, month)
    const record = {
      month,
      closedAt: new Date().toISOString(),
      guaranteedIncome: snapshot.guaranteedIncome,
      plannedExpenses: snapshot.plannedExpenses,
      actualIncome: snapshot.actualIncome,
      actualExpenses: snapshot.actualExpenses,
      margin: snapshot.guaranteedMargin,
      actualMargin: snapshot.actualMargin,
      categories,
    }
    setState((previous) => ({ ...previous, closings: [...previous.closings.filter((item) => item.month !== month), record] }))
    window.alert(`Fechamento de ${monthLabel(month)} salvo.`)
  }

  if (locked && state.security.enabled) {
    return <LockScreen biometric={state.security.biometric && biometryAvailable} onBiometric={authenticateBiometric} onPin={unlockWithPin} />
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div><span className="eyebrow">FINANCEIRO PESSOAL</span><h1>{navTitle(tab)}</h1></div>
        <div className={`health-dot ${health}`} title="Saúde do orçamento" />
      </header>

      <main>
        {!['settings', 'more'].includes(tab) && <MonthSwitcher month={month} setMonth={setMonth} />}

        {tab === 'dashboard' && <Dashboard state={state} month={month} snapshot={snapshot} health={health} dailySafe={dailySafe} onAdd={() => setShowMovement(true)} onCards={() => setTab('cards')} onGoals={() => setTab('goals')} onCalendar={() => setTab('calendar')} />}
        {tab === 'movements' && <Movements state={state} month={month} onAdd={() => setShowMovement(true)} onToggle={(id) => togglePayment(`movement-${id}`)} onRemove={removeMovement} />}
        {tab === 'cards' && <Cards state={state} month={month} setState={setState} updateConfig={updateConfig} onAdd={() => setShowPurchase(true)} />}
        {tab === 'calendar' && <CalendarView state={state} month={month} onToggle={(id) => togglePayment(id)} />}
        {tab === 'projection' && <Projection state={state} month={month} />}
        {tab === 'analysis' && <Analysis state={state} month={month} onCloseMonth={closeMonth} />}
        {tab === 'goals' && <Goals state={state} month={month} setState={setState} onAdd={() => setShowGoal(true)} />}
        {tab === 'more' && <MoreMenu onOpen={setTab} />}
        {tab === 'settings' && <SettingsPanel state={state} setState={setState} updateConfig={updateConfig} updateText={updateText} biometryAvailable={biometryAvailable} onCheckUpdate={checkUpdate} onExport={exportPlainBackup} onSecureBackup={shareEncryptedBackup} onImport={() => importRef.current?.click()} onSyncNotifications={syncNotifications} onLock={() => setLocked(true)} />}
      </main>

      <input ref={importRef} hidden type="file" accept="application/json,.json" onChange={(event) => importBackup(event.target.files?.[0])} />
      {showMovement && <MovementModal month={month} onClose={() => setShowMovement(false)} onSave={(movement) => { setState((p) => ({ ...p, movements: [...p.movements, movement] })); setShowMovement(false) }} />}
      {showPurchase && <PurchaseModal state={state} onClose={() => setShowPurchase(false)} onSave={(purchase) => { setState((p) => ({ ...p, cardPurchases: [...p.cardPurchases, purchase] })); setShowPurchase(false) }} />}
      {showGoal && <GoalModal onClose={() => setShowGoal(false)} onSave={(goal) => { setState((p) => ({ ...p, goals: [...p.goals, goal] })); setShowGoal(false) }} />}

      <nav className="bottom-nav">
        <NavButton active={tab === 'dashboard'} label="Início" icon={<Home />} onClick={() => setTab('dashboard')} />
        <NavButton active={tab === 'movements'} label="Lançar" icon={<ListPlus />} onClick={() => setTab('movements')} />
        <NavButton active={tab === 'cards'} label="Cartões" icon={<CreditCard />} onClick={() => setTab('cards')} />
        <NavButton active={tab === 'calendar'} label="Agenda" icon={<CalendarDays />} onClick={() => setTab('calendar')} />
        <NavButton active={['more', 'projection', 'analysis', 'goals', 'settings'].includes(tab)} label="Mais" icon={<MoreHorizontal />} onClick={() => setTab('more')} />
      </nav>
    </div>
  )
}

function navTitle(tab: Tab) {
  const titles: Record<Tab, string> = { dashboard: 'Meu mês', movements: 'Lançamentos', cards: 'Cartões', calendar: 'Agenda financeira', more: 'Organização', projection: 'Próximos 12 meses', analysis: 'Análises', goals: 'Metas e reservas', settings: 'Ajustes' }
  return titles[tab]
}

function MonthSwitcher({ month, setMonth }: { month: string; setMonth: (month: string) => void }) {
  return <div className="month-switcher"><button onClick={() => setMonth(shiftMonth(month, -1))}><ChevronLeft size={20} /></button><strong>{monthLabel(month)}</strong><button onClick={() => setMonth(shiftMonth(month, 1))}><ChevronRight size={20} /></button></div>
}

function NavButton({ active, label, icon, onClick }: { active: boolean; label: string; icon: ReactNode; onClick: () => void }) {
  return <button className={active ? 'active' : ''} onClick={onClick}>{icon}<span>{label}</span></button>
}

function Dashboard({ state, month, snapshot, health, dailySafe, onAdd, onCards, onGoals, onCalendar }: { state: AppState; month: string; snapshot: ReturnType<typeof monthSnapshot>; health: string; dailySafe: number; onAdd: () => void; onCards: () => void; onGoals: () => void; onCalendar: () => void }) {
  const items = calendarItems(state, month).filter((item) => !item.paid && item.date >= todayIso()).slice(0, 4)
  const commitment = snapshot.guaranteedIncome > 0 ? (snapshot.plannedExpenses / snapshot.guaranteedIncome) * 100 : 0
  return <section className="stack">
    <article className={`hero-card ${health}`}><div className="hero-label"><CircleDollarSign size={18} /><span>Sobra sem depender de renda variável</span></div><strong className="hero-value">{money(snapshot.guaranteedMargin)}</strong><p>{health === 'attention' ? 'Seu orçamento garantido não fecha sozinho neste cenário.' : health === 'tight' ? 'O mês fecha, mas a margem para imprevistos está curta.' : 'Seu orçamento garantido mantém uma margem positiva.'}</p><div className="range-row"><span>Com renda extra variável</span><b>{money(snapshot.lowMargin)} a {money(snapshot.highMargin)}</b></div></article>
    <div className="grid-two"><Metric label="Renda garantida" value={money(snapshot.guaranteedIncome)} hint="salário + entradas planejadas" /><Metric label="Comprometido" value={`${commitment.toFixed(0)}%`} hint={money(snapshot.plannedExpenses)} /><Metric label="Margem por dia" value={money(dailySafe)} hint="sem usar renda extra" /><Metric label="Pago até agora" value={money(snapshot.actualExpenses)} hint={`saldo realizado ${money(snapshot.actualMargin)}`} /></div>
    {snapshot.guaranteedMargin < 0 && <article className="alert-card"><AlertTriangle size={20} /><div><b>Atenção ao teto de gastos</b><p>Faltam {money(Math.abs(snapshot.guaranteedMargin))} para o salário garantido cobrir tudo. Evite novas parcelas fixas até reequilibrar.</p></div></article>}
    <div className="quick-actions"><button onClick={onAdd}><Plus />Lançar</button><button onClick={onCards}><CreditCard />Cartão</button><button onClick={onCalendar}><CalendarDays />Agenda</button><button onClick={onGoals}><Target />Metas</button></div>
    <article className="section-card"><div className="section-heading"><div><span className="section-kicker">PRÓXIMOS</span><h2>Compromissos não pagos</h2></div></div>{items.length ? <div className="compact-list">{items.map((item) => <div className="compact-row" key={`${item.id}-${item.date}`}><div><b>{item.title}</b><small>{dateLabel(item.date)}</small></div><strong className={item.kind}>{item.kind === 'income' ? '+' : '-'} {money(item.amount)}</strong></div>)}</div> : <Empty text="Nada pendente para frente neste mês." />}</article>
    <article className="section-card"><div className="section-heading"><div><span className="section-kicker">BASE ATUAL</span><h2>Orçamento essencial</h2></div><b>{money(snapshot.fixed.fixed)}</b></div><div className="budget-lines">{Object.entries(snapshot.fixed.categories).map(([name, value]) => <div key={name}><span>{name}</span><b>{money(value)}</b></div>)}</div></article>
  </section>
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return <article className="metric-card"><span>{label}</span><strong>{value}</strong>{hint && <small>{hint}</small>}</article>
}

function Movements({ state, month, onAdd, onToggle, onRemove }: { state: AppState; month: string; onAdd: () => void; onToggle: (id: string) => void; onRemove: (id: string) => void }) {
  const movements = state.movements.filter((item) => item.recurrence === 'monthly' ? item.date.slice(0, 7) <= month : item.date.startsWith(month)).sort((a, b) => a.date.localeCompare(b.date))
  const income = movements.filter((m) => m.type === 'income').reduce((s, m) => s + m.amount, 0)
  const expense = movements.filter((m) => m.type === 'expense').reduce((s, m) => s + m.amount, 0)
  const isPaid = (movement: Movement) => state.payments[paymentKey(month, `movement-${movement.id}`)] ?? (movement.recurrence === 'none' ? movement.paid : false)
  return <section className="stack"><div className="grid-two"><Metric label="Entradas adicionais" value={money(income)} /><Metric label="Saídas adicionais" value={money(expense)} /></div><button className="primary full" onClick={onAdd}><Plus size={18} /> Novo lançamento</button><article className="section-card"><div className="section-heading"><div><span className="section-kicker">MÊS</span><h2>Movimentações</h2></div><b>{movements.length}</b></div>{movements.length ? <div className="movement-list">{movements.map((movement) => { const paid = isPaid(movement); return <div className={`movement-row ${paid ? 'paid' : ''}`} key={movement.id}><button className="status-check" onClick={() => onToggle(movement.id)}>{paid ? <CheckCircle2 size={22} /> : <span />}</button><div className="movement-copy"><b>{movement.description}</b><small>{movement.category} • {dateLabel(movement.date)}{movement.recurrence === 'monthly' ? ' • mensal' : ''}</small></div><strong className={movement.type}>{movement.type === 'income' ? '+' : '-'} {money(movement.amount)}</strong><button className="icon-button danger" onClick={() => onRemove(movement.id)}><Trash2 size={17} /></button></div>})}</div> : <Empty text="Nenhum lançamento adicional neste mês." />}</article></section>
}

function Cards({ state, month, setState, updateConfig, onAdd }: { state: AppState; month: string; setState: React.Dispatch<React.SetStateAction<AppState>>; updateConfig: <K extends keyof BudgetConfig>(key: K, value: BudgetConfig[K]) => void; onAdd: () => void }) {
  const total = state.config.cardMode === 'actual' ? cardInvoiceForMonth(state, month) : state.config.cardBudget
  const future = Array.from({ length: 6 }, (_, index) => { const m = shiftMonth(month, index); return { month: m, total: cardInvoiceForMonth(state, m) } })
  const updateCard = (id: string, patch: Partial<CardAccount>) => setState((p) => ({ ...p, cards: p.cards.map((card) => card.id === id ? { ...card, ...patch } : card) }))
  const addCard = () => { const name = window.prompt('Nome do novo cartão'); if (!name?.trim()) return; setState((p) => ({ ...p, cards: [...p.cards, { id: uid(), name: name.trim(), limit: 0, closingDay: 2, dueDay: 9, active: true }] })) }
  return <section className="stack">
    <article className="hero-card blue"><div className="hero-label"><Receipt size={18} /><span>Fatura considerada em {monthLabel(month)}</span></div><strong className="hero-value">{money(total)}</strong><p>{state.config.cardMode === 'actual' ? 'Calculada pelas compras, recorrências e parcelas cadastradas.' : 'Usando o orçamento fixo definido para cartão.'}</p></article>
    <article className="section-card"><div className="section-heading"><div><span className="section-kicker">MODO</span><h2>Como considerar cartão</h2></div></div><div className="segmented"><button className={state.config.cardMode === 'budget' ? 'active' : ''} onClick={() => updateConfig('cardMode', 'budget')}>Orçamento fixo</button><button className={state.config.cardMode === 'actual' ? 'active' : ''} onClick={() => updateConfig('cardMode', 'actual')}>Fatura real</button></div>{state.config.cardMode === 'budget' && <MoneyField label="Orçamento mensal do cartão" value={state.config.cardBudget} onChange={(v) => updateConfig('cardBudget', v)} />}</article>
    {state.cards.map((card) => { const invoice = cardInvoiceForMonth(state, month, card.id); const committed = cardCommittedLimit(state, card.id); const available = card.limit > 0 ? Math.max(0, card.limit - committed) : 0; return <article className="section-card" key={card.id}><div className="section-heading"><div><span className="section-kicker">CARTÃO</span><h2>{card.name}</h2></div><b>{money(invoice)}</b></div><div className="form-grid two"><TextField label="Nome" value={card.name} onChange={(v) => updateCard(card.id, { name: v })} /><MoneyField label="Limite" value={card.limit} onChange={(v) => updateCard(card.id, { limit: v })} /><NumberField label="Fecha dia" value={card.closingDay} onChange={(v) => updateCard(card.id, { closingDay: v })} /><NumberField label="Vence dia" value={card.dueDay} onChange={(v) => updateCard(card.id, { dueDay: v })} /></div>{card.limit > 0 && <div className="limit-box"><span>Comprometido em parcelas</span><b>{money(committed)}</b><small>Limite estimado disponível: {money(available)}</small><div className="progress"><i style={{ width: `${Math.min(100, (committed / card.limit) * 100)}%` }} /></div></div>}</article> })}
    <div className="grid-two"><button className="secondary full" onClick={addCard}><Plus size={18} /> Novo cartão</button><button className="primary full" onClick={onAdd}><Plus size={18} /> Registrar compra</button></div>
    <article className="section-card"><div className="section-heading"><div><span className="section-kicker">6 MESES</span><h2>Faturas projetadas</h2></div></div><div className="projection-list">{future.map((item) => <div key={item.month}><span>{monthLabel(item.month)}</span><b>{money(item.total)}</b><div className="bar"><i style={{ width: `${Math.min(100, item.total / Math.max(1, ...future.map((f) => f.total)) * 100)}%` }} /></div></div>)}</div></article>
    <article className="section-card"><div className="section-heading"><div><span className="section-kicker">COMPRAS</span><h2>Parcelas e recorrências</h2></div><b>{state.cardPurchases.filter((p) => p.active).length}</b></div>{state.cardPurchases.length ? <div className="movement-list">{state.cardPurchases.map((purchase) => <div className="movement-row" key={purchase.id}><div className="movement-copy"><b>{purchase.description}</b><small>{purchase.recurring ? 'recorrente mensal' : `${purchase.installments}x de ${money(purchase.totalAmount / Math.max(1, purchase.installments))}`} • {dateLabel(purchase.purchaseDate)}</small></div><strong>{money(purchase.totalAmount)}</strong><button className="icon-button danger" onClick={() => setState((p) => ({ ...p, cardPurchases: p.cardPurchases.filter((item) => item.id !== purchase.id) }))}><Trash2 size={17} /></button></div>)}</div> : <Empty text="Nenhuma compra cadastrada." />}</article>
  </section>
}

function CalendarView({ state, month, onToggle }: { state: AppState; month: string; onToggle: (id: string) => void }) {
  const items = calendarItems(state, month)
  const grouped = items.reduce<Record<string, typeof items>>((acc, item) => { const day = item.date.slice(8, 10); (acc[day] ||= []).push(item); return acc }, {})
  const pending = items.filter((i) => i.kind === 'expense' && !i.paid).reduce((s, i) => s + i.amount, 0)
  const paid = items.filter((i) => i.kind === 'expense' && i.paid).reduce((s, i) => s + i.amount, 0)
  return <section className="stack"><div className="grid-two"><Metric label="Pago no mês" value={money(paid)} /><Metric label="Ainda pendente" value={money(pending)} /></div><article className="section-card"><div className="section-heading"><div><span className="section-kicker">AGENDA</span><h2>Contas e entradas por dia</h2></div><b>{items.length}</b></div>{Object.keys(grouped).length ? <div className="calendar-list">{Object.entries(grouped).map(([day, dayItems]) => <div className="calendar-day" key={day}><div className="day-badge"><b>{day}</b><small>{month.slice(5)}</small></div><div className="day-items">{dayItems.map((item) => <div className={`calendar-entry ${item.paid ? 'paid' : ''}`} key={`${item.id}-${item.date}`}><div><b>{item.title}</b><small>{item.source === 'fixed' ? 'fixo' : item.source === 'card' ? 'cartão' : 'lançamento'}</small></div><strong className={item.kind}>{item.kind === 'income' ? '+' : '-'} {money(item.amount)}</strong><button className="mini" onClick={() => onToggle(item.id)}>{item.paid ? 'Desfazer' : item.kind === 'income' ? 'Recebido' : 'Pago'}</button></div>)}</div></div>)}</div> : <Empty text="Nenhum compromisso para este mês." />}</article><article className="info-card"><Bell size={20} /><div><b>Lembretes locais</b><p>Ative em Ajustes para receber avisos antes dos vencimentos. Itens já pagos não geram novos lembretes quando a agenda é sincronizada.</p></div></article></section>
}

function Projection({ state, month }: { state: AppState; month: string }) {
  const months = Array.from({ length: 12 }, (_, index) => shiftMonth(month, index))
  const data = months.map((m) => ({ month: m, ...monthSnapshot(state, m) }))
  const negative = data.filter((item) => item.guaranteedMargin < 0).length
  return <section className="stack"><article className={`hero-card ${negative ? 'attention' : 'good'}`}><div className="hero-label"><CalendarDays size={18} /><span>Visão dos próximos 12 meses</span></div><strong className="hero-value">{negative ? `${negative} mês(es)` : '12 meses'}</strong><p>{negative ? 'Há meses em que a renda garantida não cobre os compromissos projetados.' : 'Nenhum dos próximos 12 meses depende obrigatoriamente da renda variável no cenário atual.'}</p></article><article className="section-card"><div className="section-heading"><div><span className="section-kicker">PROJEÇÃO</span><h2>Garantido x variável</h2></div></div><div className="future-table">{data.map((item) => <div className={`future-row ${item.guaranteedMargin < 0 ? 'negative' : ''}`} key={item.month}><div><b>{monthLabel(item.month)}</b><small>Despesas {money(item.plannedExpenses)}</small></div><div><span>Sem extra</span><b>{money(item.guaranteedMargin)}</b></div><div><span>Com extra</span><b>{money(item.lowMargin)}–{money(item.highMargin)}</b></div></div>)}</div></article></section>
}

function Analysis({ state, month, onCloseMonth }: { state: AppState; month: string; onCloseMonth: () => void }) {
  const months = Array.from({ length: 6 }, (_, i) => shiftMonth(month, i - 5))
  const data = months.map((m) => ({ month: m, ...monthSnapshot(state, m) }))
  const maxExpense = Math.max(1, ...data.map((item) => item.plannedExpenses))
  const categories = Object.entries(categoryTotals(state, month)).sort((a, b) => b[1] - a[1])
  const closing = state.closings.find((item) => item.month === month)
  const commitment = data[5].guaranteedIncome ? data[5].plannedExpenses / data[5].guaranteedIncome * 100 : 0
  return <section className="stack"><div className="grid-two"><Metric label="Comprometimento" value={`${commitment.toFixed(1)}%`} hint="despesas / renda garantida" /><Metric label="Planejado" value={money(data[5].guaranteedMargin)} hint="resultado sem renda variável" /><Metric label="Já pago" value={money(data[5].actualExpenses)} hint="saídas marcadas como pagas" /><Metric label="Saldo realizado" value={money(data[5].actualMargin)} hint="renda garantida + recebidos - pagos" /></div><article className="section-card"><div className="section-heading"><div><span className="section-kicker">EVOLUÇÃO</span><h2>Últimos 6 meses</h2></div></div><div className="chart-bars">{data.map((item) => <div className="chart-column" key={item.month}><div className="chart-value">{money(item.plannedExpenses)}</div><div className="chart-track"><i style={{ height: `${Math.max(5, item.plannedExpenses / maxExpense * 100)}%` }} /></div><small>{item.month.slice(5)}</small></div>)}</div></article><article className="section-card"><div className="section-heading"><div><span className="section-kicker">CATEGORIAS</span><h2>Para onde vai o dinheiro</h2></div></div><div className="category-list">{categories.map(([name, value]) => <div key={name}><div><span>{name}</span><b>{money(value)}</b></div><div className="bar"><i style={{ width: `${Math.min(100, value / Math.max(1, categories[0]?.[1] ?? 1) * 100)}%` }} /></div></div>)}</div></article><article className="section-card"><div className="section-heading"><div><span className="section-kicker">FECHAMENTO</span><h2>Planejado x realizado</h2></div>{closing && <span className="tag success">Fechado</span>}</div><p className="muted">Salve um retrato do mês para preservar o histórico mesmo se o orçamento-base mudar depois.</p>{closing && <div className="closing-grid"><div><span>Planejado</span><b>{money(closing.plannedExpenses)}</b></div><div><span>Realizado pago</span><b>{money(closing.actualExpenses)}</b></div><div><span>Margem planejada</span><b>{money(closing.margin)}</b></div><div><span>Saldo realizado</span><b>{money(closing.actualMargin)}</b></div></div>}<button className="secondary full" onClick={onCloseMonth}><RefreshCw size={17} /> {closing ? 'Atualizar fechamento' : 'Fechar este mês'}</button></article></section>
}

function Goals({ state, month, setState, onAdd }: { state: AppState; month: string; setState: React.Dispatch<React.SetStateAction<AppState>>; onAdd: () => void }) {
  const addContribution = (goal: Goal) => { const raw = window.prompt(`Quanto deseja guardar em ${goal.name}?`); const amount = numeric(raw ?? ''); if (!amount) return; const movementId = uid(); setState((p) => ({ ...p, goals: p.goals.map((g) => g.id === goal.id ? { ...g, current: Math.min(g.target, g.current + amount) } : g), movements: [...p.movements, { id: movementId, description: `Aporte: ${goal.name}`, amount, type: 'expense', category: 'Metas e reserva', date: todayIso(), recurrence: 'none', paid: true }], payments: { ...p.payments, [paymentKey(currentMonth(), `movement-${movementId}`)]: true } })) }
  return <section className="stack"><article className="info-card"><PiggyBank size={21} /><div><b>Metas fazem parte do orçamento</b><p>Quando você registra um aporte, ele também entra como saída paga do mês. Assim a sobra não fica artificialmente maior.</p></div></article><button className="primary full" onClick={onAdd}><Plus size={18} /> Criar meta</button>{state.goals.map((goal) => { const progress = goal.target > 0 ? Math.min(100, goal.current / goal.target * 100) : 0; const suggested = suggestedGoalContribution(goal, month); return <article className="goal-card" key={goal.id}><div className="goal-top"><div><span className={`priority ${goal.priority}`}>{goal.priority === 'high' ? 'Alta prioridade' : goal.priority === 'medium' ? 'Média prioridade' : 'Baixa prioridade'}</span><h2>{goal.name}</h2></div><button className="icon-button danger" onClick={() => setState((p) => ({ ...p, goals: p.goals.filter((g) => g.id !== goal.id) }))}><Trash2 size={17} /></button></div><strong>{money(goal.current)} <small>de {money(goal.target)}</small></strong><div className="progress large"><i style={{ width: `${progress}%` }} /></div><div className="goal-details"><span>{progress.toFixed(0)}% concluído</span><span>Sugestão mensal: <b>{money(suggested)}</b></span></div>{goal.targetDate && <small className="muted">Objetivo até {new Date(`${goal.targetDate}T12:00:00`).toLocaleDateString('pt-BR')}</small>}<button className="secondary full" disabled={progress >= 100} onClick={() => addContribution(goal)}><PiggyBank size={17} /> Registrar aporte</button></article> })}</section>
}

function MoreMenu({ onOpen }: { onOpen: (tab: Tab) => void }) {
  return <section className="menu-grid"><button onClick={() => onOpen('projection')}><CalendarDays /><div><b>Próximos 12 meses</b><small>Cenários garantido e variável</small></div></button><button onClick={() => onOpen('analysis')}><BarChart3 /><div><b>Análises</b><small>Evolução, categorias e fechamento</small></div></button><button onClick={() => onOpen('goals')}><Target /><div><b>Metas e reservas</b><small>Reserva, mudança e objetivos</small></div></button><button onClick={() => onOpen('settings')}><Settings /><div><b>Ajustes</b><small>Orçamento, alertas, segurança e backup</small></div></button></section>
}

function SettingsPanel({ state, setState, updateConfig, updateText, biometryAvailable, onCheckUpdate, onExport, onSecureBackup, onImport, onSyncNotifications, onLock }: { state: AppState; setState: React.Dispatch<React.SetStateAction<AppState>>; updateConfig: <K extends keyof BudgetConfig>(key: K, value: BudgetConfig[K]) => void; updateText: string; biometryAvailable: boolean; onCheckUpdate: () => void; onExport: () => void; onSecureBackup: () => void; onImport: () => void; onSyncNotifications: () => void; onLock: () => void }) {
  const c = state.config
  const summary = expenseSummary(state, currentMonth())
  const setDue = (key: keyof BudgetConfig['dueDays'], value: number) => updateConfig('dueDays', { ...c.dueDays, [key]: Math.max(1, Math.min(28, Math.round(value || 1))) })
  const setPin = async () => { const pin = window.prompt('Crie um PIN com pelo menos 4 números.'); if (!pin || !/^\d{4,8}$/.test(pin)) return window.alert('Use de 4 a 8 números.'); const confirm = window.prompt('Repita o PIN.'); if (confirm !== pin) return window.alert('Os PINs não conferem.'); const pinHash = await hashText(pin); setState((p) => ({ ...p, security: { ...p.security, pinHash, enabled: true } })); window.alert('PIN ativado.') }
  const toggleBiometric = async () => { if (!state.security.pinHash) return window.alert('Crie um PIN antes de ativar a biometria. Ele será sua forma de recuperação.'); if (!biometryAvailable) return window.alert('Biometria ou credencial segura não está disponível para este app neste aparelho.'); if (!state.security.biometric) { try { await BiometricAuth.authenticate({ reason: 'Ativar proteção biométrica', allowDeviceCredential: true, androidTitle: 'Ativar biometria', androidConfirmationRequired: false }) } catch { return } } setState((p) => ({ ...p, security: { ...p.security, biometric: !p.security.biometric, enabled: true } })) }
  return <section className="stack"><article className="section-card"><div className="section-heading"><div><span className="section-kicker">ORÇAMENTO</span><h2>Valores-base</h2></div><b>{money(summary.fixed)}</b></div><div className="form-grid two"><MoneyField label="Salário líquido" value={c.salaryNet} onChange={(v) => updateConfig('salaryNet', v)} /><MoneyField label="Vale-refeição" value={c.mealVoucher} onChange={(v) => updateConfig('mealVoucher', v)} /><MoneyField label="Renda extra mínima" value={c.extraMin} onChange={(v) => updateConfig('extraMin', v)} /><MoneyField label="Renda extra máxima" value={c.extraMax} onChange={(v) => updateConfig('extraMax', v)} /><MoneyField label="Moradia" value={c.housing} onChange={(v) => updateConfig('housing', v)} /><PercentField label="Pensão (% do líquido)" value={c.pensionPercent} onChange={(v) => updateConfig('pensionPercent', v)} /><MoneyField label="Energia" value={c.energy} onChange={(v) => updateConfig('energy', v)} /><MoneyField label="Internet" value={c.internet} onChange={(v) => updateConfig('internet', v)} /><MoneyField label="Celular" value={c.phone} onChange={(v) => updateConfig('phone', v)} /><MoneyField label="Academia" value={c.gym} onChange={(v) => updateConfig('gym', v)} /><MoneyField label="Moto / manutenção" value={c.motorcycle} onChange={(v) => updateConfig('motorcycle', v)} /></div><div className="formula-note"><Landmark size={19} /><div><b>Pensão calculada: {money(summary.pension)}</b><small>{c.pensionPercent.toFixed(2)}% de {money(c.salaryNet)}</small></div></div></article><article className="section-card"><div className="section-heading"><div><span className="section-kicker">VENCIMENTOS</span><h2>Dias padrão</h2></div></div><div className="form-grid four"><NumberField label="Moradia" value={c.dueDays.housing} onChange={(v) => setDue('housing', v)} /><NumberField label="Pensão" value={c.dueDays.pension} onChange={(v) => setDue('pension', v)} /><NumberField label="Energia" value={c.dueDays.energy} onChange={(v) => setDue('energy', v)} /><NumberField label="Internet" value={c.dueDays.internet} onChange={(v) => setDue('internet', v)} /><NumberField label="Celular" value={c.dueDays.phone} onChange={(v) => setDue('phone', v)} /><NumberField label="Academia" value={c.dueDays.gym} onChange={(v) => setDue('gym', v)} /><NumberField label="Moto" value={c.dueDays.motorcycle} onChange={(v) => setDue('motorcycle', v)} /></div></article><article className="section-card"><div className="section-heading"><div><span className="section-kicker">ALERTAS</span><h2>Lembretes no aparelho</h2></div><Bell /></div><Toggle label="Ativar lembretes" checked={state.notifications.enabled} onChange={(checked) => setState((p) => ({ ...p, notifications: { ...p.notifications, enabled: checked } }))} /><div className="form-grid two"><NumberField label="Avisar dias antes" value={state.notifications.daysBefore} onChange={(v) => setState((p) => ({ ...p, notifications: { ...p.notifications, daysBefore: Math.min(14, v) } }))} /><NumberField label="Horário (0–23h)" value={state.notifications.hour} onChange={(v) => setState((p) => ({ ...p, notifications: { ...p.notifications, hour: Math.min(23, v) } }))} /></div><button className="secondary full" onClick={onSyncNotifications}><RefreshCw size={17} /> Atualizar lembretes</button></article><article className="section-card"><div className="section-heading"><div><span className="section-kicker">SEGURANÇA</span><h2>Proteção do aplicativo</h2></div><ShieldCheck /></div><div className="settings-actions"><button onClick={setPin}><LockKeyhole /><div><b>{state.security.pinHash ? 'Alterar PIN' : 'Criar PIN'}</b><small>O PIN é armazenado somente como hash no aparelho.</small></div></button><button onClick={toggleBiometric} disabled={!biometryAvailable}><Fingerprint /><div><b>{state.security.biometric ? 'Desativar biometria' : 'Ativar biometria'}</b><small>{biometryAvailable ? 'Usa biometria ou credencial segura do Android.' : 'Não disponível neste aparelho.'}</small></div></button></div>{state.security.enabled && <><label className="field"><span>Bloquear após sair do app</span><select value={state.security.autoLockMinutes} onChange={(e) => setState((p) => ({ ...p, security: { ...p.security, autoLockMinutes: Number(e.target.value) } }))}><option value={0}>Imediatamente</option><option value={1}>1 minuto</option><option value={5}>5 minutos</option><option value={15}>15 minutos</option></select></label><button className="secondary full" onClick={onLock}><LockKeyhole size={17} /> Bloquear agora</button></>}</article><article className="section-card"><div className="section-heading"><div><span className="section-kicker">BACKUP</span><h2>Proteja seus dados</h2></div><PiggyBank /></div><p className="muted">O backup seguro é criptografado antes de sair do aplicativo. Ao compartilhar, você pode escolher Google Drive, Files ou outro destino instalado.</p><div className="settings-actions"><button onClick={onSecureBackup}><ShieldCheck /><div><b>Backup criptografado</b><small>Recomendado para nuvem ou outro aparelho.</small></div></button><button onClick={onExport}><Download /><div><b>Exportar JSON</b><small>Cópia simples, sem criptografia.</small></div></button><button onClick={onImport}><Upload /><div><b>Restaurar backup</b><small>Aceita JSON simples ou criptografado.</small></div></button></div></article><article className="section-card"><div className="section-heading"><div><span className="section-kicker">VERSÃO</span><h2>Atualizações</h2></div><b>v{__APP_VERSION__}</b></div><button className="secondary full" onClick={onCheckUpdate}><RefreshCw size={17} /> Verificar atualização</button>{updateText && <p className="muted center">{updateText}</p>}</article><button className="danger-zone" onClick={() => { if (window.confirm('Apagar todos os dados do FINANCEIRO e voltar aos valores iniciais?')) setState(defaultState) }}><Trash2 size={18} /> Apagar dados e reiniciar</button></section>
}

function MovementModal({ month, onClose, onSave }: { month: string; onClose: () => void; onSave: (movement: Movement) => void }) { const [description, setDescription] = useState(''); const [amount, setAmount] = useState(0); const [type, setType] = useState<'income' | 'expense'>('expense'); const [category, setCategory] = useState('Outros'); const [date, setDate] = useState(`${month}-${todayIso().startsWith(month) ? todayIso().slice(8, 10) : '01'}`); const [monthly, setMonthly] = useState(false); return <Modal title="Novo lançamento" onClose={onClose}><div className="form-grid"><TextField label="Descrição" value={description} onChange={setDescription} /><MoneyField label="Valor" value={amount} onChange={setAmount} /><label className="field"><span>Tipo</span><select value={type} onChange={(e) => setType(e.target.value as 'income' | 'expense')}><option value="expense">Saída</option><option value="income">Entrada</option></select></label><label className="field"><span>Categoria</span><select value={category} onChange={(e) => setCategory(e.target.value)}>{['Moradia', 'Filho', 'Transporte', 'Saúde', 'Lazer', 'Assinaturas', 'Renda extra', 'Metas e reserva', 'Outros'].map((item) => <option key={item}>{item}</option>)}</select></label><DateField label="Data" value={date} onChange={setDate} /><Toggle label="Repetir todo mês" checked={monthly} onChange={setMonthly} /></div><button className="primary full" disabled={!description.trim() || amount <= 0} onClick={() => onSave({ id: uid(), description: description.trim(), amount, type, category, date, recurrence: monthly ? 'monthly' : 'none', paid: false })}>Salvar lançamento</button></Modal> }

function PurchaseModal({ state, onClose, onSave }: { state: AppState; onClose: () => void; onSave: (purchase: CardPurchase) => void }) { const [cardId, setCardId] = useState(state.cards[0]?.id ?? ''); const [description, setDescription] = useState(''); const [totalAmount, setTotalAmount] = useState(0); const [purchaseDate, setPurchaseDate] = useState(todayIso()); const [installments, setInstallments] = useState(1); const [recurring, setRecurring] = useState(false); const [category, setCategory] = useState('Compras'); return <Modal title="Compra no cartão" onClose={onClose}><div className="form-grid"><label className="field"><span>Cartão</span><select value={cardId} onChange={(e) => setCardId(e.target.value)}>{state.cards.filter((c) => c.active).map((card) => <option value={card.id} key={card.id}>{card.name}</option>)}</select></label><TextField label="Descrição" value={description} onChange={setDescription} /><MoneyField label={recurring ? 'Valor mensal' : 'Valor total'} value={totalAmount} onChange={setTotalAmount} /><DateField label="Data da compra" value={purchaseDate} onChange={setPurchaseDate} /><Toggle label="Cobrança recorrente mensal" checked={recurring} onChange={setRecurring} />{!recurring && <NumberField label="Parcelas" value={installments} onChange={(v) => setInstallments(Math.max(1, Math.min(48, v)))} />}<TextField label="Categoria" value={category} onChange={setCategory} /></div><button className="primary full" disabled={!cardId || !description.trim() || totalAmount <= 0} onClick={() => onSave({ id: uid(), cardId, description: description.trim(), totalAmount, purchaseDate, installments: recurring ? 1 : Math.max(1, installments), recurring, active: true, category })}>Salvar compra</button></Modal> }

function GoalModal({ onClose, onSave }: { onClose: () => void; onSave: (goal: Goal) => void }) { const [name, setName] = useState(''); const [target, setTarget] = useState(0); const [current, setCurrent] = useState(0); const [targetDate, setTargetDate] = useState(''); const [priority, setPriority] = useState<Priority>('medium'); return <Modal title="Nova meta" onClose={onClose}><div className="form-grid"><TextField label="Nome da meta" value={name} onChange={setName} /><MoneyField label="Valor-alvo" value={target} onChange={setTarget} /><MoneyField label="Já guardado" value={current} onChange={setCurrent} /><DateField label="Data desejada" value={targetDate} onChange={setTargetDate} /><label className="field"><span>Prioridade</span><select value={priority} onChange={(e) => setPriority(e.target.value as Priority)}><option value="high">Alta</option><option value="medium">Média</option><option value="low">Baixa</option></select></label></div><button className="primary full" disabled={!name.trim() || target <= 0} onClick={() => onSave({ id: uid(), name: name.trim(), target, current: Math.min(current, target), targetDate, priority, active: true })}>Criar meta</button></Modal> }

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) { return <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}><div className="modal"><div className="modal-head"><h2>{title}</h2><button onClick={onClose}><X /></button></div>{children}</div></div> }

function LockScreen({ biometric, onBiometric, onPin }: { biometric: boolean; onBiometric: () => Promise<boolean>; onPin: (pin: string) => Promise<boolean> }) { const [pin, setPin] = useState(''); const [error, setError] = useState(''); return <div className="lock-screen"><div className="lock-card"><div className="lock-logo"><ShieldCheck /></div><span className="eyebrow">FINANCEIRO</span><h1>Dados protegidos</h1><p>Confirme sua identidade para acessar o aplicativo.</p>{biometric && <button className="primary full" onClick={onBiometric}><Fingerprint /> Usar biometria</button>}<label className="field"><span>PIN</span><input inputMode="numeric" type="password" maxLength={8} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} placeholder="••••" /></label><button className="secondary full" onClick={async () => { const ok = await onPin(pin); if (!ok) { setError('PIN incorreto.'); setPin('') } }}>Desbloquear com PIN</button>{error && <small className="error-text">{error}</small>}</div></div> }

function MoneyField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) { return <label className="field"><span>{label}</span><div className="money-input"><span>R$</span><input inputMode="decimal" type="number" min="0" step="1" value={Number.isFinite(value) ? value : 0} onChange={(e) => onChange(numeric(e.target.value))} /></div></label> }
function PercentField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) { return <label className="field"><span>{label}</span><div className="money-input"><span>%</span><input inputMode="decimal" type="number" min="0" max="100" step="0.01" value={Number.isFinite(value) ? value : 0} onChange={(e) => onChange(Math.min(100, numeric(e.target.value)))} /></div></label> }
function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) { return <label className="field"><span>{label}</span><input inputMode="numeric" type="number" min="0" value={Number.isFinite(value) ? value : 0} onChange={(e) => onChange(Math.round(numeric(e.target.value)))} /></label> }
function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="field"><span>{label}</span><input value={value} onChange={(e) => onChange(e.target.value)} /></label> }
function DateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="field"><span>{label}</span><input type="date" value={value} onChange={(e) => onChange(e.target.value)} /></label> }
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) { return <label className="toggle-row"><span>{label}</span><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /><i /></label> }
function Empty({ text }: { text: string }) { return <div className="empty"><WalletCards size={28} /><p>{text}</p></div> }
function downloadText(name: string, content: string, type: string) { const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click(); URL.revokeObjectURL(url) }

export default App
