import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Browser } from '@capacitor/browser'
import { App as CapApp } from '@capacitor/app'
import { LocalNotifications } from '@capacitor/local-notifications'
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { BiometricAuth } from '@aparajita/capacitor-biometric-auth'
import {
  Activity,
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  Banknote,
  BarChart3,
  Bell,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  CreditCard,
  Download,
  Fingerprint,
  Gauge,
  Home,
  Landmark,
  ListPlus,
  LockKeyhole,
  Menu,
  Pencil,
  PiggyBank,
  Plus,
  Receipt,
  RefreshCw,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  Upload,
  WalletCards,
  X,
} from 'lucide-react'
import {
  REPO,
  STORAGE_KEY_V2,
  type Account,
  type CardAccount,
  type CardPurchase,
  type Category,
  type Debt,
  type FinanceState,
  type Goal,
  type IncomeSource,
  type RecurringExpense,
  type Transaction,
  accountBalance,
  calendarItems,
  categoryFor,
  categoryTotals,
  currentMonth,
  dateLabel,
  decryptBackup,
  emptyState,
  encryptBackup,
  hashText,
  loadState,
  money,
  monthLabel,
  monthlySummary,
  normalizeState,
  paymentKey,
  remainingDaysInMonth,
  shiftMonth,
  todayIso,
  uid,
} from './financeV2'
import { categoryReductionPlan, emergencyPlan, financialScore, generateInsights, projection } from './insightsV2'

declare const __APP_VERSION__: string

type Tab = 'home' | 'flow' | 'plan' | 'insights' | 'menu'
type Registry = 'menu' | 'incomes' | 'expenses' | 'categories' | 'accounts' | 'cards' | 'debts' | 'goals' | 'settings'
type EditorKind = 'transaction' | 'income' | 'expense' | 'category' | 'account' | 'card' | 'purchase' | 'debt' | 'goal'
type EditorState = { kind: EditorKind; id?: string } | null

function AppV2() {
  const [state, setState] = useState<FinanceState>(() => loadState())
  const [tab, setTab] = useState<Tab>('home')
  const [registry, setRegistry] = useState<Registry>('menu')
  const [month, setMonth] = useState(currentMonth())
  const [editor, setEditor] = useState<EditorState>(null)
  const [locked, setLocked] = useState(() => loadState().security.enabled)
  const [biometryAvailable, setBiometryAvailable] = useState(false)
  const [updateText, setUpdateText] = useState('')
  const importRef = useRef<HTMLInputElement>(null)
  const inactiveAt = useRef<number | null>(null)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(state))
  }, [state])

  useEffect(() => {
    BiometricAuth.checkBiometry().then((result) => setBiometryAvailable(Boolean(result.isAvailable || result.deviceIsSecure))).catch(() => setBiometryAvailable(false))
  }, [])

  useEffect(() => {
    let listener: { remove: () => Promise<void> } | undefined
    CapApp.addListener('appStateChange', ({ isActive }) => {
      if (!state.security.enabled) return
      if (!isActive) {
        inactiveAt.current = Date.now()
        if (state.security.autoLockMinutes === 0) setLocked(true)
      } else {
        if (inactiveAt.current && state.security.autoLockMinutes > 0 && (Date.now() - inactiveAt.current) / 60000 >= state.security.autoLockMinutes) setLocked(true)
        inactiveAt.current = null
      }
    }).then((value) => { listener = value })
    return () => { listener?.remove().catch(() => undefined) }
  }, [state.security.enabled, state.security.autoLockMinutes])

  const summary = useMemo(() => monthlySummary(state, month), [state, month])
  const insights = useMemo(() => generateInsights(state, month), [state, month])
  const reserve = useMemo(() => emergencyPlan(state, month), [state, month])
  const score = useMemo(() => financialScore(state, month), [state, month])

  const saveEntity = (kind: EditorKind, entity: any) => {
    const keyMap: Record<Exclude<EditorKind, 'transaction' | 'purchase'>, keyof FinanceState> = {
      income: 'incomeSources', expense: 'recurringExpenses', category: 'categories', account: 'accounts', card: 'cards', debt: 'debts', goal: 'goals',
    }
    if (kind === 'transaction') {
      setState((previous) => ({ ...previous, transactions: upsert(previous.transactions, entity) }))
    } else if (kind === 'purchase') {
      setState((previous) => ({ ...previous, cardPurchases: upsert(previous.cardPurchases, entity) }))
    } else {
      const key = keyMap[kind]
      setState((previous) => ({ ...previous, [key]: upsert(previous[key] as any[], entity) } as FinanceState))
    }
    setEditor(null)
  }

  const removeEntity = (kind: Exclude<EditorKind, 'transaction' | 'purchase'> | 'transaction' | 'purchase', id: string) => {
    if (!window.confirm('Excluir este cadastro?')) return
    const map: Record<string, keyof FinanceState> = { transaction: 'transactions', purchase: 'cardPurchases', income: 'incomeSources', expense: 'recurringExpenses', category: 'categories', account: 'accounts', card: 'cards', debt: 'debts', goal: 'goals' }
    const key = map[kind]
    setState((previous) => ({ ...previous, [key]: (previous[key] as any[]).filter((item) => item.id !== id) } as FinanceState))
  }

  const togglePayment = (itemId: string) => {
    const key = paymentKey(month, itemId)
    setState((previous) => ({ ...previous, payments: { ...previous.payments, [key]: !previous.payments[key] } }))
  }

  const authenticateBiometric = async () => {
    try {
      await BiometricAuth.authenticate({ reason: 'Acessar seus dados financeiros', cancelTitle: 'Cancelar', allowDeviceCredential: true, androidTitle: 'Desbloquear FINANCEIRO', androidSubtitle: 'Confirme sua identidade', androidConfirmationRequired: false })
      setLocked(false)
    } catch { /* user cancelled */ }
  }

  const unlockWithPin = async (pin: string) => {
    if (pin && state.security.pinHash && await hashText(pin) === state.security.pinHash) { setLocked(false); return true }
    return false
  }

  const checkUpdate = async () => {
    setUpdateText('Verificando...')
    try {
      const response = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } })
      if (!response.ok) throw new Error('release')
      const release = await response.json()
      const latest = String(release.tag_name ?? '').replace(/^v/, '')
      const current = String(__APP_VERSION__).replace(/^v/, '')
      const asset = Array.isArray(release.assets) ? release.assets.find((item: { name?: string }) => item.name?.toLowerCase().endsWith('.apk')) : null
      if (latest && latest !== current && asset?.browser_download_url) { setUpdateText(`Nova versão ${latest}`); await Browser.open({ url: asset.browser_download_url }) }
      else setUpdateText(`Você está na versão ${current}`)
    } catch { setUpdateText('Nenhuma atualização publicada no momento.') }
  }

  const exportPlain = () => downloadText(`financeiro-v2-${todayIso()}.json`, JSON.stringify(state, null, 2), 'application/json')
  const secureBackup = async () => {
    const password = window.prompt('Crie uma senha para proteger o backup. Guarde essa senha.')
    if (!password || password.length < 4) return
    try {
      const encrypted = await encryptBackup(state, password)
      const name = `financeiro-seguro-${todayIso()}.enc.json`
      const written = await Filesystem.writeFile({ path: name, data: encrypted, directory: Directory.Cache, encoding: Encoding.UTF8 })
      await Share.share({ title: 'Backup FINANCEIRO', text: 'Backup criptografado. Salve no Drive ou em outro local seguro.', files: [written.uri], dialogTitle: 'Salvar backup seguro' })
    } catch { window.alert('Não foi possível criar o backup seguro.') }
  }
  const importBackup = async (file?: File) => {
    if (!file) return
    try {
      const text = await file.text()
      let restored: FinanceState
      if (file.name.endsWith('.enc.json')) {
        const password = window.prompt('Senha do backup criptografado:')
        if (!password) return
        restored = await decryptBackup(text, password)
      } else restored = normalizeState(JSON.parse(text))
      setState(restored)
      window.alert('Backup restaurado.')
    } catch { window.alert('Não foi possível restaurar esse arquivo.') }
    finally { if (importRef.current) importRef.current.value = '' }
  }

  const syncNotifications = async () => {
    try {
      let permission = await LocalNotifications.checkPermissions()
      if (permission.display !== 'granted') permission = await LocalNotifications.requestPermissions()
      if (permission.display !== 'granted') throw new Error('permission')
      const pending = await LocalNotifications.getPending()
      if (pending.notifications.length) await LocalNotifications.cancel({ notifications: pending.notifications.map((item) => ({ id: item.id })) })
      if (!state.notifications.enabled) return window.alert('Lembretes desativados.')
      let id = 2000
      const notifications: any[] = []
      for (let offset = 0; offset < 3; offset += 1) {
        const target = shiftMonth(currentMonth(), offset)
        for (const item of calendarItems(state, target).filter((value) => value.kind === 'expense' && !value.paid)) {
          const at = new Date(`${item.date}T${String(state.notifications.hour).padStart(2, '0')}:00:00`)
          at.setDate(at.getDate() - state.notifications.daysBefore)
          if (at.getTime() > Date.now()) notifications.push({ id: id++, title: `Vencimento: ${item.title}`, body: `${money(item.amount)} • ${dateLabel(item.date)}`, schedule: { at } })
          if (notifications.length >= 55) break
        }
      }
      if (notifications.length) await LocalNotifications.schedule({ notifications })
      window.alert(`${notifications.length} lembrete(s) configurado(s).`)
    } catch { window.alert('Não foi possível configurar as notificações.') }
  }

  const closeMonth = () => {
    const items = calendarItems(state, month)
    const actualIncome = items.filter((item) => item.kind === 'income' && item.paid && item.categoryId !== 'benefit').reduce((sum, item) => sum + item.amount, 0)
    const actualExpenses = items.filter((item) => item.kind === 'expense' && item.paid).reduce((sum, item) => sum + item.amount, 0)
    const record = { month, closedAt: new Date().toISOString(), guaranteedIncome: summary.guaranteedIncome, plannedExpenses: summary.plannedExpenses, actualIncome, actualExpenses, margin: summary.marginGuaranteed, actualMargin: actualIncome - actualExpenses, categoryTotals: categoryTotals(state, month) }
    setState((previous) => ({ ...previous, closings: [...previous.closings.filter((item) => item.month !== month), record] }))
    window.alert(`Fechamento de ${monthLabel(month)} salvo.`)
  }

  if (locked && state.security.enabled) return <LockScreen biometric={state.security.biometric && biometryAvailable} onBiometric={authenticateBiometric} onPin={unlockWithPin} />
  if (!state.settings.setupComplete) return <WelcomeSetup state={state} onStart={() => setState((previous) => ({ ...previous, settings: { ...previous.settings, setupComplete: true } }))} />

  return (
    <div className="v2-shell">
      <header className="v2-topbar">
        <div><span>FINANCEIRO</span><h1>{tabTitle(tab, registry)}</h1></div>
        <div className={`score-orb ${score < 45 ? 'bad' : score < 70 ? 'mid' : 'good'}`}><b>{score}</b><small>score</small></div>
      </header>

      <main className="v2-main">
        {tab !== 'menu' && <MonthSwitcher month={month} onChange={setMonth} />}
        {tab === 'home' && <HomeView state={state} month={month} summary={summary} insights={insights} reserve={reserve} onAdd={() => setEditor({ kind: 'transaction' })} onGo={(target) => { setTab(target); if (target === 'menu') setRegistry('menu') }} onEditRegistry={(section) => { setTab('menu'); setRegistry(section) }} />}
        {tab === 'flow' && <FlowView state={state} month={month} onAdd={() => setEditor({ kind: 'transaction' })} onToggle={togglePayment} onEdit={(id) => setEditor({ kind: 'transaction', id })} onRemove={(id) => removeEntity('transaction', id)} />}
        {tab === 'plan' && <PlanView state={state} month={month} reserve={reserve} onAddGoal={() => setEditor({ kind: 'goal' })} onEditGoal={(id) => setEditor({ kind: 'goal', id })} onCloseMonth={closeMonth} />}
        {tab === 'insights' && <InsightsView state={state} month={month} insights={insights} reserve={reserve} score={score} />}
        {tab === 'menu' && <RegistryHub state={state} section={registry} setSection={setRegistry} setState={setState} editor={setEditor} removeEntity={removeEntity} updateText={updateText} biometryAvailable={biometryAvailable} onCheckUpdate={checkUpdate} onExport={exportPlain} onSecureBackup={secureBackup} onImport={() => importRef.current?.click()} onSyncNotifications={syncNotifications} onLock={() => setLocked(true)} />}
      </main>

      <input ref={importRef} hidden type="file" accept="application/json,.json" onChange={(event) => importBackup(event.target.files?.[0])} />
      {editor && <EditorModal kind={editor.kind} id={editor.id} state={state} onClose={() => setEditor(null)} onSave={saveEntity} />}

      <nav className="v2-nav">
        <NavButton active={tab === 'home'} label="Início" icon={<Home />} onClick={() => setTab('home')} />
        <NavButton active={tab === 'flow'} label="Fluxo" icon={<ListPlus />} onClick={() => setTab('flow')} />
        <NavButton active={tab === 'plan'} label="Planejar" icon={<CalendarDays />} onClick={() => setTab('plan')} />
        <NavButton active={tab === 'insights'} label="Análises" icon={<Sparkles />} onClick={() => setTab('insights')} />
        <NavButton active={tab === 'menu'} label="Menu" icon={<Menu />} onClick={() => { setTab('menu'); setRegistry('menu') }} />
      </nav>
    </div>
  )
}

function WelcomeSetup({ onStart }: { state: FinanceState; onStart: () => void }) {
  return <div className="welcome-screen"><div className="welcome-logo"><CircleDollarSign size={34} /></div><span className="eyebrow">FINANCEIRO 2.0</span><h1>Seu financeiro começa do zero.</h1><p>Cadastre suas rendas, despesas, cartões, dívidas e metas no seu ritmo. O app passa a analisar seus próprios números e explicar o que merece atenção.</p><div className="welcome-points"><div><Check /> Nenhuma despesa vem obrigatoriamente pré-cadastrada</div><div><Check /> Você pode editar categorias e limites</div><div><Check /> Análises ficam no aparelho</div></div><button className="primary big" onClick={onStart}>Montar meu financeiro</button></div>
}

function HomeView({ state, month, summary, insights, reserve, onAdd, onGo, onEditRegistry }: any) {
  const checklist = [
    { ok: state.incomeSources.length > 0, label: 'Cadastrar sua renda', section: 'incomes' },
    { ok: state.recurringExpenses.length > 0, label: 'Cadastrar despesas recorrentes', section: 'expenses' },
    { ok: state.cards.length > 0 || state.debts.length > 0, label: 'Informar cartões ou dívidas (se houver)', section: 'cards' },
    { ok: state.goals.some((goal: Goal) => goal.type === 'emergency'), label: 'Configurar reserva de emergência', section: 'goals' },
  ]
  const complete = checklist.filter((item) => item.ok).length
  const topInsight = insights[0]
  const days = remainingDaysInMonth(month)
  const safeDay = Math.max(0, summary.marginGuaranteed - reserve.suggestedContribution) / days
  const upcoming = calendarItems(state, month).filter((item) => item.kind === 'expense' && !item.paid).slice(0, 5)
  return <div className="stack">
    {complete < checklist.length && <section className="setup-card"><div className="section-head"><div><span className="eyebrow">CONFIGURAÇÃO</span><h2>{complete}/{checklist.length} etapas concluídas</h2></div><b>{Math.round(complete / checklist.length * 100)}%</b></div><div className="progress"><i style={{ width: `${complete / checklist.length * 100}%` }} /></div>{checklist.filter((item) => !item.ok).map((item) => <button className="check-row" key={item.label} onClick={() => onEditRegistry(item.section)}><span>{item.label}</span><ChevronRight /></button>)}</section>}

    <section className={`assistant-card ${topInsight?.tone ?? 'info'}`}><div className="assistant-title"><Sparkles /><span>Analista financeiro</span></div><h2>{topInsight?.title ?? 'Cadastre seus dados para começar'}</h2><p>{topInsight?.message ?? 'Quanto mais completo o cadastro, melhores ficam as projeções e recomendações.'}</p><button onClick={() => onGo('insights')}>Ver análise completa</button></section>

    <div className="metric-grid"><Metric label="Renda garantida" value={money(summary.guaranteedIncome)} note={`Variável: ${money(summary.variableMin)}–${money(summary.variableMax)}`} icon={<ArrowUpCircle />} /><Metric label="Despesas planejadas" value={money(summary.plannedExpenses)} note={`${summary.plannedExpenses > summary.guaranteedIncome ? 'Acima' : 'Dentro'} da renda fixa`} icon={<ArrowDownCircle />} /><Metric label="Sobra garantida" value={money(summary.marginGuaranteed)} note="sem depender da renda variável" icon={<WalletCards />} tone={summary.marginGuaranteed < 0 ? 'bad' : 'good'} /><Metric label="Livre por dia" value={money(safeDay)} note="após aporte sugerido" icon={<Gauge />} /></div>

    <section className="panel"><div className="section-head"><div><span className="eyebrow">RESERVA</span><h2>Emergência</h2></div><PiggyBank /></div><div className="reserve-line"><div><b>{money(reserve.current)}</b><small>guardado</small></div><div><b>{money(reserve.recommendedTarget)}</b><small>alvo recomendado</small></div><div><b>{money(reserve.suggestedContribution)}</b><small>aporte sugerido</small></div></div><div className="progress"><i style={{ width: `${reserve.progress}%` }} /></div><button className="text-button" onClick={() => onEditRegistry('goals')}>Gerenciar metas</button></section>

    <section className="panel"><div className="section-head"><h2>Próximos compromissos</h2><button className="text-button" onClick={() => onGo('flow')}>Ver fluxo</button></div>{upcoming.length ? upcoming.map((item) => <div className="line-item" key={item.id}><div><b>{item.title}</b><small>{dateLabel(item.date)}</small></div><strong>{money(item.amount)}</strong></div>) : <Empty text="Nenhum compromisso pendente neste mês." />}</section>

    <div className="quick-grid"><button onClick={onAdd}><Plus /> Lançar agora</button><button onClick={() => onEditRegistry('expenses')}><Receipt /> Despesa fixa</button><button onClick={() => onEditRegistry('incomes')}><Banknote /> Renda</button><button onClick={() => onEditRegistry('cards')}><CreditCard /> Cartão</button></div>
  </div>
}

function FlowView({ state, month, onAdd, onToggle, onEdit, onRemove }: any) {
  const items = calendarItems(state, month)
  const transactions = state.transactions.filter((item: Transaction) => item.date.slice(0, 7) === month).sort((a: Transaction, b: Transaction) => b.date.localeCompare(a.date))
  const pending = items.filter((item) => !item.paid && item.kind === 'expense').reduce((sum, item) => sum + item.amount, 0)
  return <div className="stack"><section className="flow-summary"><div><span>Pendente no mês</span><b>{money(pending)}</b></div><button className="primary" onClick={onAdd}><Plus /> Novo lançamento</button></section><section className="panel"><div className="section-head"><div><span className="eyebrow">AGENDA</span><h2>Previsto e realizado</h2></div></div>{items.length ? items.map((item) => <button key={item.id} className={`schedule-row ${item.paid ? 'paid' : ''}`} onClick={() => onToggle(item.id)}><span className={`kind-dot ${item.kind}`} /> <div><b>{item.title}</b><small>{dateLabel(item.date)} • {item.source}</small></div><strong>{money(item.amount)}</strong><span className="status-pill">{item.paid ? item.kind === 'income' ? 'recebido' : 'pago' : 'pendente'}</span></button>) : <Empty text="Cadastre rendas e despesas para montar sua agenda." />}</section><section className="panel"><div className="section-head"><h2>Lançamentos avulsos</h2></div>{transactions.length ? transactions.map((item: Transaction) => <div className="crud-row" key={item.id}><div><b>{item.description}</b><small>{dateLabel(item.date)} • {categoryFor(state, item.categoryId)?.name ?? 'Sem categoria'}</small></div><strong className={item.type}>{item.type === 'income' ? '+' : '-'} {money(item.amount)}</strong><button onClick={() => onEdit(item.id)}><Pencil /></button><button onClick={() => onRemove(item.id)}><Trash2 /></button></div>) : <Empty text="Nenhum lançamento avulso neste mês." />}</section></div>
}

function PlanView({ state, month, reserve, onAddGoal, onEditGoal, onCloseMonth }: any) {
  const future = projection(state, month, 12)
  return <div className="stack"><section className="panel"><div className="section-head"><div><span className="eyebrow">12 MESES</span><h2>Projeção do caixa</h2></div><BarChart3 /></div><div className="future-list">{future.map((item) => <div className={`future-item ${item.guaranteed < 0 ? 'negative' : ''}`} key={item.month}><div><b>{monthLabel(item.month)}</b><small>despesas {money(item.expenses)}</small></div><div><span>garantido</span><b>{money(item.guaranteed)}</b></div><div><span>com variável</span><b>{money(item.low)} – {money(item.high)}</b></div></div>)}</div></section><section className="panel"><div className="section-head"><div><span className="eyebrow">METAS</span><h2>Próximos aportes</h2></div><button className="icon-button" onClick={onAddGoal}><Plus /></button></div>{state.goals.filter((goal: Goal) => goal.active).length ? state.goals.filter((goal: Goal) => goal.active).map((goal: Goal) => <button className="goal-row" key={goal.id} onClick={() => onEditGoal(goal.id)}><div><b>{goal.name}</b><small>{money(goal.current)} de {money(goal.target || (goal.type === 'emergency' ? reserve.recommendedTarget : 0))}</small></div><strong>{goal.type === 'emergency' ? money(reserve.suggestedContribution) : goal.monthlyOverride > 0 ? money(goal.monthlyOverride) : 'definir'}</strong></button>) : <Empty text="Crie sua primeira meta financeira." />}</section><section className="panel"><div className="section-head"><div><span className="eyebrow">HISTÓRICO</span><h2>Fechamento mensal</h2></div></div><p className="muted">Salve o fechamento para o analisador comparar evolução e detectar aumentos fora do padrão.</p><button className="secondary wide" onClick={onCloseMonth}>Fechar {monthLabel(month)}</button>{state.closings.slice().sort((a: any, b: any) => b.month.localeCompare(a.month)).slice(0, 5).map((item: any) => <div className="line-item" key={item.month}><div><b>{monthLabel(item.month)}</b><small>realizado</small></div><strong className={item.actualMargin < 0 ? 'expense' : 'income'}>{money(item.actualMargin)}</strong></div>)}</section></div>
}

function InsightsView({ state, month, insights, reserve, score }: any) {
  const summary = monthlySummary(state, month)
  const needed = Math.max(0, -summary.marginGuaranteed + reserve.suggestedContribution)
  const cuts = categoryReductionPlan(state, month, needed)
  const totals = Object.entries(summary.categories).sort((a, b) => b[1] - a[1])
  const max = Math.max(1, ...totals.map(([, value]) => value))
  return <div className="stack"><section className="score-card"><div className={`big-score ${score < 45 ? 'bad' : score < 70 ? 'mid' : 'good'}`}>{score}</div><div><span className="eyebrow">SAÚDE FINANCEIRA</span><h2>{score >= 70 ? 'Estrutura saudável' : score >= 45 ? 'Atenção à margem' : 'Orçamento sob pressão'}</h2><p>O score usa margem, comprometimento, dívidas e reserva. Não é nota de crédito.</p></div></section><section className="panel"><div className="section-head"><div><span className="eyebrow">ANALISTA</span><h2>O que seus números estão dizendo</h2></div><Sparkles /></div><div className="insight-list">{insights.map((item: any) => <article key={item.id} className={`insight ${item.tone}`}><div>{item.tone === 'critical' || item.tone === 'warning' ? <AlertTriangle /> : item.tone === 'good' ? <Check /> : <Activity />}</div><div><b>{item.title}</b><p>{item.message}</p>{item.action && <small>{item.action}</small>}</div></article>)}</div></section>{cuts.length > 0 && <section className="panel"><div className="section-head"><h2>Plano de redução sugerido</h2></div>{cuts.map((item) => <div className="cut-row" key={item.categoryId}><div><b>{item.category}</b><small>atual {money(item.current)}</small></div><strong>-{money(item.suggestedCut)}</strong></div>)}</section>}<section className="panel"><div className="section-head"><h2>Despesas por categoria</h2></div>{totals.length ? totals.map(([id, value]) => <div className="bar-row" key={id}><div><span>{categoryFor(state, id)?.name ?? id}</span><b>{money(value)}</b></div><div className="bar"><i style={{ width: `${value / max * 100}%` }} /></div></div>) : <Empty text="Ainda não há despesas para analisar." />}</section></div>
}

function RegistryHub({ state, section, setSection, setState, editor, removeEntity, updateText, biometryAvailable, onCheckUpdate, onExport, onSecureBackup, onImport, onSyncNotifications, onLock }: any) {
  if (section === 'menu') return <div className="stack"><section className="panel"><div className="section-head"><div><span className="eyebrow">CADASTROS</span><h2>Minha estrutura financeira</h2></div></div><MenuLink icon={<Banknote />} title="Fontes de renda" note={`${state.incomeSources.length} cadastrada(s)`} onClick={() => setSection('incomes')} /><MenuLink icon={<Receipt />} title="Despesas recorrentes" note={`${state.recurringExpenses.length} cadastrada(s)`} onClick={() => setSection('expenses')} /><MenuLink icon={<WalletCards />} title="Contas e saldos" note={`${state.accounts.length} conta(s)`} onClick={() => setSection('accounts')} /><MenuLink icon={<CreditCard />} title="Cartões" note={`${state.cards.length} cartão(ões)`} onClick={() => setSection('cards')} /><MenuLink icon={<Landmark />} title="Dívidas e parcelas" note={`${state.debts.length} cadastro(s)`} onClick={() => setSection('debts')} /><MenuLink icon={<Target />} title="Metas e reserva" note={`${state.goals.length} meta(s)`} onClick={() => setSection('goals')} /><MenuLink icon={<BarChart3 />} title="Categorias e limites" note={`${state.categories.filter((item: Category) => item.active).length} ativas`} onClick={() => setSection('categories')} /></section><section className="panel"><MenuLink icon={<Settings />} title="Configurações" note="segurança, alertas, backup e análise" onClick={() => setSection('settings')} /></section></div>

  const titles: Record<string, string> = { incomes: 'Fontes de renda', expenses: 'Despesas recorrentes', categories: 'Categorias e limites', accounts: 'Contas e saldos', cards: 'Cartões', debts: 'Dívidas e parcelas', goals: 'Metas e reserva' }
  if (section === 'settings') return <SettingsView state={state} setState={setState} setSection={setSection} updateText={updateText} biometryAvailable={biometryAvailable} onCheckUpdate={onCheckUpdate} onExport={onExport} onSecureBackup={onSecureBackup} onImport={onImport} onSyncNotifications={onSyncNotifications} onLock={onLock} />

  const config: Record<string, { kind: EditorKind; data: any[]; describe: (item: any) => string }> = {
    incomes: { kind: 'income', data: state.incomeSources, describe: (item: IncomeSource) => item.mode === 'variable' ? `${money(item.min)}–${money(item.max)} • dia ${item.day}` : `${money(item.amount)} • ${item.mode}` },
    expenses: { kind: 'expense', data: state.recurringExpenses, describe: (item: RecurringExpense) => `${money(item.amount)} • vence dia ${item.dueDay} • ${categoryFor(state, item.categoryId)?.name ?? ''}` },
    categories: { kind: 'category', data: state.categories, describe: (item: Category) => `${item.kind === 'expense' ? item.essentiality : 'receita'}${item.monthlyBudget > 0 ? ` • limite ${money(item.monthlyBudget)}` : ''}` },
    accounts: { kind: 'account', data: state.accounts, describe: (item: Account) => `${item.kind} • saldo calculado ${money(accountBalance(state, item.id))}` },
    cards: { kind: 'card', data: state.cards, describe: (item: CardAccount) => `limite ${money(item.limit)} • fecha ${item.closingDay} • vence ${item.dueDay}` },
    debts: { kind: 'debt', data: state.debts, describe: (item: Debt) => `${money(item.installment)}/mês • ${item.remainingInstallments || '∞'} parcela(s) restante(s)` },
    goals: { kind: 'goal', data: state.goals, describe: (item: Goal) => `${money(item.current)} de ${money(item.target)} • ${item.priority}` },
  }
  const current = config[section]
  return <div className="stack"><button className="back-button" onClick={() => setSection('menu')}><ChevronLeft /> Voltar ao menu</button><section className="panel"><div className="section-head"><div><span className="eyebrow">CADASTRO</span><h2>{titles[section]}</h2></div><button className="icon-button" onClick={() => editor({ kind: current.kind })}><Plus /></button></div>{current.data.length ? current.data.map((item: any) => <div className={`crud-row ${item.active === false ? 'inactive' : ''}`} key={item.id}><div><b>{item.name}</b><small>{current.describe(item)}</small></div><button onClick={() => editor({ kind: current.kind, id: item.id })}><Pencil /></button><button onClick={() => removeEntity(current.kind, item.id)}><Trash2 /></button></div>) : <Empty text={`Nenhum cadastro em ${titles[section].toLowerCase()}.`} />}{section === 'cards' && state.cards.length > 0 && <button className="secondary wide" onClick={() => editor({ kind: 'purchase' })}><Plus /> Registrar compra no cartão</button>}</section></div>
}

function SettingsView({ state, setState, setSection, updateText, biometryAvailable, onCheckUpdate, onExport, onSecureBackup, onImport, onSyncNotifications, onLock }: any) {
  const [pin, setPin] = useState('')
  const savePin = async () => {
    if (pin.length < 4) return window.alert('Use pelo menos 4 dígitos.')
    const pinHash = await hashText(pin)
    setState((previous: FinanceState) => ({ ...previous, security: { ...previous.security, enabled: true, pinHash } }))
    setPin('')
  }
  return <div className="stack"><button className="back-button" onClick={() => setSection('menu')}><ChevronLeft /> Voltar ao menu</button><section className="panel"><div className="section-head"><h2>Inteligência e reserva</h2><Sparkles /></div><label className="form-field"><span>Meses de despesas essenciais na reserva</span><input type="number" min="1" max="24" value={state.settings.reserveMonths} onChange={(event) => setState((p: FinanceState) => ({ ...p, settings: { ...p.settings, reserveMonths: Number(event.target.value) || 1 } }))} /></label><label className="form-field"><span>% da sobra disponível para aportar</span><input type="number" min="0" max="100" value={state.settings.reserveContributionShare} onChange={(event) => setState((p: FinanceState) => ({ ...p, settings: { ...p.settings, reserveContributionShare: Number(event.target.value) || 0 } }))} /></label></section><section className="panel"><div className="section-head"><h2>Lembretes</h2><Bell /></div><label className="switch-row"><span>Notificações de vencimento</span><input type="checkbox" checked={state.notifications.enabled} onChange={(event) => setState((p: FinanceState) => ({ ...p, notifications: { ...p.notifications, enabled: event.target.checked } }))} /></label><div className="form-grid"><label className="form-field"><span>Dias antes</span><input type="number" min="0" max="14" value={state.notifications.daysBefore} onChange={(event) => setState((p: FinanceState) => ({ ...p, notifications: { ...p.notifications, daysBefore: Number(event.target.value) || 0 } }))} /></label><label className="form-field"><span>Horário</span><input type="number" min="0" max="23" value={state.notifications.hour} onChange={(event) => setState((p: FinanceState) => ({ ...p, notifications: { ...p.notifications, hour: Number(event.target.value) || 0 } }))} /></label></div><button className="secondary wide" onClick={onSyncNotifications}>Sincronizar lembretes</button></section><section className="panel"><div className="section-head"><h2>Privacidade</h2><ShieldCheck /></div><div className="form-grid"><label className="form-field"><span>Novo PIN</span><input type="password" inputMode="numeric" value={pin} onChange={(event) => setPin(event.target.value)} /></label><button className="secondary align-end" onClick={savePin}>Salvar PIN</button></div><label className="switch-row"><span>Bloqueio do app</span><input type="checkbox" checked={state.security.enabled} onChange={(event) => setState((p: FinanceState) => ({ ...p, security: { ...p.security, enabled: event.target.checked } }))} /></label><label className="switch-row"><span>Biometria / credencial Android</span><input type="checkbox" disabled={!biometryAvailable} checked={state.security.biometric} onChange={(event) => setState((p: FinanceState) => ({ ...p, security: { ...p.security, biometric: event.target.checked } }))} /></label>{state.security.enabled && <button className="secondary wide" onClick={onLock}><LockKeyhole /> Bloquear agora</button>}</section><section className="panel"><div className="section-head"><h2>Backup e atualização</h2><RefreshCw /></div><div className="action-stack"><button className="secondary" onClick={onExport}><Download /> Exportar JSON</button><button className="secondary" onClick={onSecureBackup}><ShieldCheck /> Backup criptografado</button><button className="secondary" onClick={onImport}><Upload /> Restaurar backup</button><button className="secondary" onClick={onCheckUpdate}><RefreshCw /> Verificar atualização</button>{updateText && <small className="muted">{updateText}</small>}</div></section><section className="panel danger-zone"><h2>Recomeçar</h2><p>Apaga todos os cadastros deste aparelho e volta para a configuração inicial.</p><button className="danger" onClick={() => { if (window.confirm('Apagar todo o financeiro local e começar do zero?')) setState(structuredClone(emptyState)) }}><Trash2 /> Começar do zero</button></section></div>
}

function EditorModal({ kind, id, state, onClose, onSave }: { kind: EditorKind; id?: string; state: FinanceState; onClose: () => void; onSave: (kind: EditorKind, entity: any) => void }) {
  const existing = findEntity(state, kind, id)
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const fd = new FormData(event.currentTarget)
    const n = (name: string) => Math.max(0, Number(fd.get(name)) || 0)
    const s = (name: string) => String(fd.get(name) ?? '')
    const checked = (name: string) => fd.get(name) === 'on'
    const base = { id: existing?.id ?? uid() }
    let entity: any
    if (kind === 'transaction') entity = { ...base, description: s('name'), amount: n('amount'), type: s('type'), categoryId: s('categoryId'), accountId: s('accountId'), date: s('date') || todayIso(), paid: checked('paid'), notes: s('notes') }
    if (kind === 'income') entity = { ...base, name: s('name'), mode: s('mode'), amount: n('amount'), min: n('min'), max: n('max'), day: Math.min(28, Math.max(1, n('day') || 1)), categoryId: s('categoryId'), accountId: s('accountId'), active: checked('active') }
    if (kind === 'expense') entity = { ...base, name: s('name'), amount: n('amount'), dueDay: Math.min(28, Math.max(1, n('day') || 1)), categoryId: s('categoryId'), accountId: s('accountId'), reducible: checked('reducible'), active: checked('active'), notes: s('notes') }
    if (kind === 'category') entity = { ...base, name: s('name'), kind: s('type'), essentiality: s('essentiality'), reducible: checked('reducible'), monthlyBudget: n('budget'), active: checked('active') }
    if (kind === 'account') entity = { ...base, name: s('name'), kind: s('accountKind'), initialBalance: n('balance'), active: checked('active') }
    if (kind === 'card') entity = { ...base, name: s('name'), limit: n('limit'), closingDay: Math.min(28, Math.max(1, n('closingDay') || 1)), dueDay: Math.min(28, Math.max(1, n('dueDay') || 1)), active: checked('active') }
    if (kind === 'purchase') entity = { ...base, cardId: s('cardId'), description: s('name'), totalAmount: n('amount'), purchaseDate: s('date') || todayIso(), installments: Math.max(1, n('installments') || 1), recurring: checked('recurring'), active: checked('active'), categoryId: s('categoryId') }
    if (kind === 'debt') entity = { ...base, name: s('name'), totalBalance: n('balance'), installment: n('installment'), dueDay: Math.min(28, Math.max(1, n('day') || 1)), remainingInstallments: n('remaining'), categoryId: s('categoryId'), active: checked('active') }
    if (kind === 'goal') entity = { ...base, name: s('name'), type: s('goalType'), target: n('target'), current: n('current'), targetDate: s('targetDate'), priority: s('priority'), active: checked('active'), monthlyOverride: n('monthlyOverride') }
    if (!entity?.name && kind !== 'purchase' && kind !== 'transaction') return
    if ((kind === 'transaction' || kind === 'purchase') && !(entity.description)) return
    onSave(kind, entity)
  }
  const expenseCats = state.categories.filter((item) => item.kind === 'expense' && item.active)
  const incomeCats = state.categories.filter((item) => item.kind === 'income' && item.active)
  const defaultActive = existing ? existing.active !== false : true
  return <div className="modal-backdrop"><div className="editor-modal"><div className="modal-head"><div><span className="eyebrow">{existing ? 'EDITAR' : 'NOVO'}</span><h2>{editorTitle(kind)}</h2></div><button onClick={onClose}><X /></button></div><form onSubmit={submit} className="editor-form">
    {(kind === 'transaction' || kind === 'income' || kind === 'expense' || kind === 'category' || kind === 'account' || kind === 'card' || kind === 'debt' || kind === 'goal') && <label className="form-field"><span>Nome</span><input name="name" defaultValue={existing?.name ?? existing?.description ?? ''} required /></label>}
    {kind === 'purchase' && <label className="form-field"><span>Compra</span><input name="name" defaultValue={existing?.description ?? ''} required /></label>}
    {kind === 'transaction' && <><div className="form-grid"><label className="form-field"><span>Tipo</span><select name="type" defaultValue={existing?.type ?? 'expense'}><option value="expense">Despesa</option><option value="income">Entrada</option></select></label><MoneyField name="amount" label="Valor" value={existing?.amount} /></div><label className="form-field"><span>Categoria</span><select name="categoryId" defaultValue={existing?.categoryId ?? 'other-expense'}>{[...expenseCats, ...incomeCats].map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><AccountSelect state={state} value={existing?.accountId} /><label className="form-field"><span>Data</span><input type="date" name="date" defaultValue={existing?.date ?? todayIso()} /></label><CheckField name="paid" label="Já foi pago/recebido" checked={existing?.paid ?? true} /><label className="form-field"><span>Observação</span><textarea name="notes" defaultValue={existing?.notes ?? ''} /></label></>}
    {kind === 'income' && <><label className="form-field"><span>Tipo de renda</span><select name="mode" defaultValue={existing?.mode ?? 'fixed'}><option value="fixed">Fixa / garantida</option><option value="variable">Variável</option><option value="benefit">Benefício (não entra no saldo em dinheiro)</option></select></label><div className="form-grid"><MoneyField name="amount" label="Valor fixo/benefício" value={existing?.amount} /><label className="form-field"><span>Dia previsto</span><input name="day" type="number" min="1" max="28" defaultValue={existing?.day ?? 5} /></label></div><div className="form-grid"><MoneyField name="min" label="Variável mínima" value={existing?.min} /><MoneyField name="max" label="Variável máxima" value={existing?.max} /></div><label className="form-field"><span>Categoria</span><select name="categoryId" defaultValue={existing?.categoryId ?? 'income-salary'}>{incomeCats.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><AccountSelect state={state} value={existing?.accountId} /><CheckField name="active" label="Cadastro ativo" checked={defaultActive} /></>}
    {kind === 'expense' && <><div className="form-grid"><MoneyField name="amount" label="Valor mensal" value={existing?.amount} /><label className="form-field"><span>Vencimento</span><input name="day" type="number" min="1" max="28" defaultValue={existing?.dueDay ?? 10} /></label></div><CategorySelect categories={expenseCats} value={existing?.categoryId} /><AccountSelect state={state} value={existing?.accountId} /><CheckField name="reducible" label="Pode ser reduzida/renegociada" checked={existing?.reducible ?? true} /><CheckField name="active" label="Cadastro ativo" checked={defaultActive} /><label className="form-field"><span>Observação</span><textarea name="notes" defaultValue={existing?.notes ?? ''} /></label></>}
    {kind === 'category' && <><div className="form-grid"><label className="form-field"><span>Tipo</span><select name="type" defaultValue={existing?.kind ?? 'expense'}><option value="expense">Despesa</option><option value="income">Entrada</option></select></label><label className="form-field"><span>Classificação</span><select name="essentiality" defaultValue={existing?.essentiality ?? 'flexible'}><option value="essential">Essencial</option><option value="flexible">Flexível</option><option value="discretionary">Discricionária</option></select></label></div><MoneyField name="budget" label="Limite mensal (opcional)" value={existing?.monthlyBudget} /><CheckField name="reducible" label="Pode receber sugestão de corte" checked={existing?.reducible ?? true} /><CheckField name="active" label="Categoria ativa" checked={defaultActive} /></>}
    {kind === 'account' && <><label className="form-field"><span>Tipo</span><select name="accountKind" defaultValue={existing?.kind ?? 'bank'}><option value="bank">Banco</option><option value="cash">Dinheiro</option><option value="wallet">Carteira digital</option></select></label><MoneyField name="balance" label="Saldo inicial" value={existing?.initialBalance} /><CheckField name="active" label="Conta ativa" checked={defaultActive} /></>}
    {kind === 'card' && <><MoneyField name="limit" label="Limite total" value={existing?.limit} /><div className="form-grid"><label className="form-field"><span>Fecha dia</span><input name="closingDay" type="number" min="1" max="28" defaultValue={existing?.closingDay ?? 2} /></label><label className="form-field"><span>Vence dia</span><input name="dueDay" type="number" min="1" max="28" defaultValue={existing?.dueDay ?? 9} /></label></div><CheckField name="active" label="Cartão ativo" checked={defaultActive} /></>}
    {kind === 'purchase' && <><label className="form-field"><span>Cartão</span><select name="cardId" defaultValue={existing?.cardId ?? state.cards[0]?.id}>{state.cards.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><MoneyField name="amount" label="Valor total" value={existing?.totalAmount} /><div className="form-grid"><label className="form-field"><span>Data</span><input name="date" type="date" defaultValue={existing?.purchaseDate ?? todayIso()} /></label><label className="form-field"><span>Parcelas</span><input name="installments" type="number" min="1" max="60" defaultValue={existing?.installments ?? 1} /></label></div><CategorySelect categories={expenseCats} value={existing?.categoryId} /><CheckField name="recurring" label="Cobrança recorrente mensal" checked={existing?.recurring ?? false} /><CheckField name="active" label="Compra ativa" checked={defaultActive} /></>}
    {kind === 'debt' && <><MoneyField name="balance" label="Saldo devedor" value={existing?.totalBalance} /><MoneyField name="installment" label="Parcela mensal" value={existing?.installment} /><div className="form-grid"><label className="form-field"><span>Vence dia</span><input name="day" type="number" min="1" max="28" defaultValue={existing?.dueDay ?? 10} /></label><label className="form-field"><span>Parcelas restantes</span><input name="remaining" type="number" min="0" defaultValue={existing?.remainingInstallments ?? 1} /></label></div><CategorySelect categories={expenseCats} value={existing?.categoryId ?? 'debt'} /><CheckField name="active" label="Dívida ativa" checked={defaultActive} /></>}
    {kind === 'goal' && <><label className="form-field"><span>Tipo</span><select name="goalType" defaultValue={existing?.type ?? 'custom'}><option value="emergency">Reserva de emergência</option><option value="move">Mudança / moradia</option><option value="purchase">Compra</option><option value="travel">Viagem</option><option value="custom">Outra meta</option></select></label><div className="form-grid"><MoneyField name="target" label="Meta" value={existing?.target} /><MoneyField name="current" label="Já guardado" value={existing?.current} /></div><div className="form-grid"><label className="form-field"><span>Data desejada</span><input name="targetDate" type="date" defaultValue={existing?.targetDate ?? ''} /></label><label className="form-field"><span>Prioridade</span><select name="priority" defaultValue={existing?.priority ?? 'medium'}><option value="high">Alta</option><option value="medium">Média</option><option value="low">Baixa</option></select></label></div><MoneyField name="monthlyOverride" label="Aporte mensal manual (opcional)" value={existing?.monthlyOverride} /><CheckField name="active" label="Meta ativa" checked={defaultActive} /></>}
    <div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button className="primary" type="submit">Salvar</button></div>
  </form></div></div>
}

function findEntity(state: FinanceState, kind: EditorKind, id?: string): any {
  if (!id) return null
  const map: Record<string, any[]> = { transaction: state.transactions, income: state.incomeSources, expense: state.recurringExpenses, category: state.categories, account: state.accounts, card: state.cards, purchase: state.cardPurchases, debt: state.debts, goal: state.goals }
  return map[kind]?.find((item) => item.id === id) ?? null
}
function editorTitle(kind: EditorKind) { return ({ transaction: 'Lançamento', income: 'Fonte de renda', expense: 'Despesa recorrente', category: 'Categoria', account: 'Conta', card: 'Cartão', purchase: 'Compra no cartão', debt: 'Dívida / parcela', goal: 'Meta financeira' } as Record<EditorKind, string>)[kind] }
function upsert<T extends { id: string }>(items: T[], entity: T) { return items.some((item) => item.id === entity.id) ? items.map((item) => item.id === entity.id ? entity : item) : [...items, entity] }
function MoneyField({ name, label, value }: { name: string; label: string; value?: number }) { return <label className="form-field"><span>{label}</span><div className="money-field"><span>R$</span><input name={name} type="number" min="0" step="0.01" defaultValue={value ?? 0} /></div></label> }
function CategorySelect({ categories, value }: { categories: Category[]; value?: string }) { return <label className="form-field"><span>Categoria</span><select name="categoryId" defaultValue={value ?? categories[0]?.id}>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label> }
function AccountSelect({ state, value }: { state: FinanceState; value?: string }) { return <label className="form-field"><span>Conta</span><select name="accountId" defaultValue={value ?? state.accounts[0]?.id}>{state.accounts.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label> }
function CheckField({ name, label, checked }: { name: string; label: string; checked: boolean }) { return <label className="switch-row"><span>{label}</span><input type="checkbox" name={name} defaultChecked={checked} /></label> }
function Metric({ label, value, note, icon, tone }: { label: string; value: string; note: string; icon: ReactNode; tone?: string }) { return <article className={`metric ${tone ?? ''}`}><div>{icon}</div><span>{label}</span><b>{value}</b><small>{note}</small></article> }
function Empty({ text }: { text: string }) { return <div className="empty-state"><CircleDollarSign /><p>{text}</p></div> }
function MenuLink({ icon, title, note, onClick }: { icon: ReactNode; title: string; note: string; onClick: () => void }) { return <button className="menu-link" onClick={onClick}><div className="menu-icon">{icon}</div><div><b>{title}</b><small>{note}</small></div><ChevronRight /></button> }
function MonthSwitcher({ month, onChange }: { month: string; onChange: (month: string) => void }) { return <div className="month-switch"><button onClick={() => onChange(shiftMonth(month, -1))}><ChevronLeft /></button><b>{monthLabel(month)}</b><button onClick={() => onChange(shiftMonth(month, 1))}><ChevronRight /></button></div> }
function NavButton({ active, label, icon, onClick }: { active: boolean; label: string; icon: ReactNode; onClick: () => void }) { return <button className={active ? 'active' : ''} onClick={onClick}>{icon}<span>{label}</span></button> }
function tabTitle(tab: Tab, registry: Registry) { if (tab === 'menu' && registry !== 'menu') return ({ incomes: 'Rendas', expenses: 'Despesas', categories: 'Categorias', accounts: 'Contas', cards: 'Cartões', debts: 'Dívidas', goals: 'Metas', settings: 'Ajustes', menu: 'Menu' } as Record<Registry, string>)[registry]; return ({ home: 'Meu mês', flow: 'Fluxo financeiro', plan: 'Planejamento', insights: 'Análises', menu: 'Organização' } as Record<Tab, string>)[tab] }

function LockScreen({ biometric, onBiometric, onPin }: { biometric: boolean; onBiometric: () => void; onPin: (pin: string) => Promise<boolean> }) {
  const [pin, setPin] = useState(''); const [error, setError] = useState(false)
  return <div className="lock-screen"><LockKeyhole size={38} /><h1>FINANCEIRO</h1><p>Seus dados estão protegidos.</p><input type="password" inputMode="numeric" placeholder="PIN" value={pin} onChange={(event) => setPin(event.target.value)} /><button className="primary wide" onClick={async () => { const ok = await onPin(pin); setError(!ok) }}>Desbloquear</button>{biometric && <button className="secondary wide" onClick={onBiometric}><Fingerprint /> Usar biometria</button>}{error && <small className="error-text">PIN incorreto.</small>}</div>
}

function downloadText(filename: string, content: string, type: string) { const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url) }

export default AppV2
