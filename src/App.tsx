import { useEffect, useMemo, useRef, useState } from 'react'
import { Browser } from '@capacitor/browser'
import {
  ArrowDownCircle,
  ArrowUpCircle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  CreditCard,
  Download,
  Gauge,
  Home,
  Landmark,
  ListPlus,
  PiggyBank,
  Plus,
  RefreshCw,
  Settings,
  ShieldCheck,
  Trash2,
  Upload,
  WalletCards,
} from 'lucide-react'

declare const __APP_VERSION__: string

type Tab = 'dashboard' | 'movements' | 'projection' | 'planner' | 'settings'
type MovementType = 'income' | 'expense'
type Recurrence = 'none' | 'monthly'

type BudgetConfig = {
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
  reserveCurrent: number
  reserveMonths: number
}

type Movement = {
  id: string
  description: string
  amount: number
  type: MovementType
  category: string
  date: string
  recurrence: Recurrence
  paid: boolean
}

type AppState = {
  config: BudgetConfig
  movements: Movement[]
}

const STORAGE_KEY = 'financeiro-personal-v1'
const REPO = 'otaviobarretojr/FINANCEIRO'

const defaultState: AppState = {
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
    reserveCurrent: 0,
    reserveMonths: 3,
  },
  movements: [],
}

const money = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

const todayIso = () => new Date().toISOString().slice(0, 10)
const currentMonth = () => new Date().toISOString().slice(0, 7)

function monthFrom(date: string) {
  return date.slice(0, 7)
}

function shiftMonth(month: string, amount: number) {
  const [year, m] = month.split('-').map(Number)
  const date = new Date(year, m - 1 + amount, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(month: string) {
  const [year, m] = month.split('-').map(Number)
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(
    new Date(year, m - 1, 1),
  )
}

function appliesToMonth(movement: Movement, month: string) {
  const movementMonth = monthFrom(movement.date)
  if (movement.recurrence === 'monthly') return movementMonth <= month
  return movementMonth === month
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultState
    const parsed = JSON.parse(raw) as Partial<AppState>
    return {
      config: { ...defaultState.config, ...(parsed.config ?? {}) },
      movements: Array.isArray(parsed.movements) ? parsed.movements : [],
    }
  } catch {
    return defaultState
  }
}

function fixedSummary(config: BudgetConfig) {
  const pension = config.salaryNet * (config.pensionPercent / 100)
  const excludingHousing =
    pension +
    config.energy +
    config.internet +
    config.phone +
    config.gym +
    config.motorcycle +
    config.cardBudget
  const fixed = excludingHousing + config.housing
  const safeHousing = Math.max(0, config.salaryNet - excludingHousing)
  return { pension, fixed, excludingHousing, safeHousing }
}

function movementTotals(movements: Movement[], month: string) {
  return movements.reduce(
    (acc, movement) => {
      if (!appliesToMonth(movement, month)) return acc
      if (movement.type === 'income') acc.income += movement.amount
      else acc.expense += movement.amount
      return acc
    },
    { income: 0, expense: 0 },
  )
}

function Field({
  label,
  value,
  onChange,
  hint,
  step = 1,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  hint?: string
  step?: number
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <div className="money-input">
        <span>R$</span>
        <input
          inputMode="decimal"
          type="number"
          min="0"
          step={step}
          value={Number.isFinite(value) ? value : 0}
          onChange={(event) => onChange(Math.max(0, Number(event.target.value)))}
        />
      </div>
      {hint && <small>{hint}</small>}
    </label>
  )
}

function App() {
  const [state, setState] = useState<AppState>(() => loadState())
  const [tab, setTab] = useState<Tab>('dashboard')
  const [month, setMonth] = useState(currentMonth())
  const [showAdd, setShowAdd] = useState(false)
  const [updateText, setUpdateText] = useState('')
  const importRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  const { config, movements } = state
  const summary = useMemo(() => fixedSummary(config), [config])
  const selectedMovementTotals = useMemo(() => movementTotals(movements, month), [movements, month])

  const guaranteedMargin =
    config.salaryNet + selectedMovementTotals.income - summary.fixed - selectedMovementTotals.expense
  const lowMargin = guaranteedMargin + config.extraMin
  const highMargin = guaranteedMargin + config.extraMax
  const reserveTarget = summary.fixed * config.reserveMonths
  const reserveProgress = reserveTarget > 0 ? Math.min(100, (config.reserveCurrent / reserveTarget) * 100) : 0

  const health = guaranteedMargin < 0 ? 'attention' : guaranteedMargin < 300 ? 'tight' : 'good'

  const updateConfig = <K extends keyof BudgetConfig>(key: K, value: BudgetConfig[K]) => {
    setState((previous) => ({ ...previous, config: { ...previous.config, [key]: value } }))
  }

  const removeMovement = (id: string) => {
    setState((previous) => ({
      ...previous,
      movements: previous.movements.filter((movement) => movement.id !== id),
    }))
  }

  const togglePaid = (id: string) => {
    setState((previous) => ({
      ...previous,
      movements: previous.movements.map((movement) =>
        movement.id === id ? { ...movement, paid: !movement.paid } : movement,
      ),
    }))
  }

  const exportBackup = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `financeiro-backup-${todayIso()}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const importBackup = async (file?: File) => {
    if (!file) return
    try {
      const parsed = JSON.parse(await file.text()) as AppState
      if (!parsed.config || !Array.isArray(parsed.movements)) throw new Error('Formato inválido')
      setState({
        config: { ...defaultState.config, ...parsed.config },
        movements: parsed.movements,
      })
    } catch {
      window.alert('Não foi possível importar esse backup.')
    }
  }

  const checkUpdate = async () => {
    setUpdateText('Verificando...')
    try {
      const response = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
        headers: { Accept: 'application/vnd.github+json' },
      })
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
      } else {
        setUpdateText(`Você está na versão atual (${current})`)
      }
    } catch {
      setUpdateText('Ainda não existe uma atualização publicada.')
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <span className="eyebrow">FINANCEIRO PESSOAL</span>
          <h1>{tab === 'dashboard' ? 'Meu mês' : navTitle(tab)}</h1>
        </div>
        <div className={`health-dot ${health}`} title="Saúde do orçamento" />
      </header>

      <main>
        {tab !== 'settings' && (
          <div className="month-switcher">
            <button onClick={() => setMonth((value) => shiftMonth(value, -1))} aria-label="Mês anterior">
              <ChevronLeft size={20} />
            </button>
            <strong>{monthLabel(month)}</strong>
            <button onClick={() => setMonth((value) => shiftMonth(value, 1))} aria-label="Próximo mês">
              <ChevronRight size={20} />
            </button>
          </div>
        )}

        {tab === 'dashboard' && (
          <Dashboard
            config={config}
            summary={summary}
            movements={movements}
            month={month}
            guaranteedMargin={guaranteedMargin}
            lowMargin={lowMargin}
            highMargin={highMargin}
            reserveTarget={reserveTarget}
            reserveProgress={reserveProgress}
            health={health}
            onAdd={() => setShowAdd(true)}
            onPlanner={() => setTab('planner')}
          />
        )}

        {tab === 'movements' && (
          <Movements
            movements={movements}
            month={month}
            onAdd={() => setShowAdd(true)}
            onRemove={removeMovement}
            onTogglePaid={togglePaid}
          />
        )}

        {tab === 'projection' && <Projection config={config} movements={movements} startMonth={month} />}

        {tab === 'planner' && (
          <Planner
            config={config}
            summary={summary}
            onChange={updateConfig}
            reserveTarget={reserveTarget}
            reserveProgress={reserveProgress}
          />
        )}

        {tab === 'settings' && (
          <SettingsPanel
            updateText={updateText}
            onCheckUpdate={checkUpdate}
            onExport={exportBackup}
            onImport={() => importRef.current?.click()}
            onReset={() => {
              if (window.confirm('Apagar lançamentos e voltar ao orçamento inicial?')) setState(defaultState)
            }}
          />
        )}
      </main>

      <input
        ref={importRef}
        hidden
        type="file"
        accept="application/json"
        onChange={(event) => importBackup(event.target.files?.[0])}
      />

      {showAdd && (
        <MovementModal
          month={month}
          onClose={() => setShowAdd(false)}
          onSave={(movement) => {
            setState((previous) => ({ ...previous, movements: [...previous.movements, movement] }))
            setShowAdd(false)
          }}
        />
      )}

      <nav className="bottom-nav">
        <NavButton active={tab === 'dashboard'} label="Início" icon={<Home />} onClick={() => setTab('dashboard')} />
        <NavButton active={tab === 'movements'} label="Lançamentos" icon={<WalletCards />} onClick={() => setTab('movements')} />
        <NavButton active={tab === 'projection'} label="Projeção" icon={<CalendarDays />} onClick={() => setTab('projection')} />
        <NavButton active={tab === 'planner'} label="Planejar" icon={<Gauge />} onClick={() => setTab('planner')} />
        <NavButton active={tab === 'settings'} label="Ajustes" icon={<Settings />} onClick={() => setTab('settings')} />
      </nav>
    </div>
  )
}

function navTitle(tab: Tab) {
  const titles: Record<Tab, string> = {
    dashboard: 'Meu mês',
    movements: 'Lançamentos',
    projection: 'Próximos meses',
    planner: 'Planejamento',
    settings: 'Ajustes',
  }
  return titles[tab]
}

function NavButton({
  active,
  label,
  icon,
  onClick,
}: {
  active: boolean
  label: string
  icon: React.ReactNode
  onClick: () => void
}) {
  return (
    <button className={active ? 'active' : ''} onClick={onClick}>
      {icon}
      <span>{label}</span>
    </button>
  )
}

function Dashboard({
  config,
  summary,
  movements,
  month,
  guaranteedMargin,
  lowMargin,
  highMargin,
  reserveTarget,
  reserveProgress,
  health,
  onAdd,
  onPlanner,
}: {
  config: BudgetConfig
  summary: ReturnType<typeof fixedSummary>
  movements: Movement[]
  month: string
  guaranteedMargin: number
  lowMargin: number
  highMargin: number
  reserveTarget: number
  reserveProgress: number
  health: string
  onAdd: () => void
  onPlanner: () => void
}) {
  const upcoming = movements
    .filter((movement) => !movement.paid && movement.date >= `${month}-01`)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 4)

  const healthCopy =
    health === 'attention'
      ? 'Seu orçamento garantido depende da renda extra neste cenário.'
      : health === 'tight'
        ? 'O mês fecha positivo, mas com pouca margem para imprevistos.'
        : 'Seu orçamento garantido mantém uma margem positiva.'

  return (
    <section className="stack">
      <article className={`hero-card ${health}`}>
        <div className="hero-label">
          <CircleDollarSign size={18} />
          <span>Sobra sem depender da renda extra</span>
        </div>
        <strong className="hero-value">{money(guaranteedMargin)}</strong>
        <p>{healthCopy}</p>
        <div className="range-row">
          <span>Com renda extra de {money(config.extraMin)} a {money(config.extraMax)}</span>
          <b>{money(lowMargin)} a {money(highMargin)}</b>
        </div>
      </article>

      <div className="grid-two">
        <article className="metric-card">
          <span>Salário líquido</span>
          <strong>{money(config.salaryNet)}</strong>
          <small>renda garantida</small>
        </article>
        <article className="metric-card">
          <span>Despesas-base</span>
          <strong>{money(summary.fixed)}</strong>
          <small>antes de extras do mês</small>
        </article>
      </div>

      <article className="insight-card">
        <div className="icon-box"><Home size={20} /></div>
        <div>
          <span className="eyebrow">LIMITE SEGURO DE MORADIA</span>
          <strong>{money(summary.safeHousing)}</strong>
          <p>É o máximo de aluguel + condomínio para o salário líquido fechar em zero sem usar renda variável.</p>
        </div>
        <button className="text-button" onClick={onPlanner}>Simular</button>
      </article>

      <article className="card">
        <div className="section-head">
          <div>
            <span className="eyebrow">ORÇAMENTO-BASE</span>
            <h2>Para onde vai o dinheiro</h2>
          </div>
        </div>
        <div className="budget-list">
          <BudgetRow label="Moradia" value={config.housing} icon={<Home />} />
          <BudgetRow label={`Pensão (${config.pensionPercent.toFixed(1)}%)`} value={summary.pension} icon={<Landmark />} />
          <BudgetRow label="Cartão de crédito" value={config.cardBudget} icon={<CreditCard />} />
          <BudgetRow label="Energia" value={config.energy} />
          <BudgetRow label="Internet" value={config.internet} />
          <BudgetRow label="Celular" value={config.phone} />
          <BudgetRow label="Academia" value={config.gym} />
          <BudgetRow label="Moto / manutenção" value={config.motorcycle} />
        </div>
      </article>

      <article className="benefit-card">
        <ShieldCheck size={23} />
        <div>
          <strong>Benefícios fora do caixa</strong>
          <p>Vale-refeição: {money(config.mealVoucher)} · Transporte coberto pela empresa.</p>
        </div>
      </article>

      <article className="card">
        <div className="section-head">
          <div>
            <span className="eyebrow">RESERVA</span>
            <h2>Proteção financeira</h2>
          </div>
          <PiggyBank size={22} />
        </div>
        <div className="progress-track"><div style={{ width: `${reserveProgress}%` }} /></div>
        <div className="progress-copy">
          <span>{money(config.reserveCurrent)} guardados</span>
          <b>Meta: {money(reserveTarget)}</b>
        </div>
      </article>

      <article className="card">
        <div className="section-head">
          <div>
            <span className="eyebrow">PRÓXIMOS</span>
            <h2>Compromissos lançados</h2>
          </div>
          <button className="icon-button" onClick={onAdd}><Plus size={20} /></button>
        </div>
        {upcoming.length === 0 ? (
          <div className="empty-state">Nenhum lançamento futuro ainda. Use o + para registrar contas, compras ou entradas.</div>
        ) : (
          <div className="compact-list">
            {upcoming.map((movement) => (
              <div key={movement.id}>
                <span>{movement.description}<small>{new Date(`${movement.date}T12:00:00`).toLocaleDateString('pt-BR')}</small></span>
                <b className={movement.type}>{movement.type === 'expense' ? '-' : '+'}{money(movement.amount)}</b>
              </div>
            ))}
          </div>
        )}
      </article>

      <button className="primary-button" onClick={onAdd}><ListPlus size={20} /> Novo lançamento</button>
    </section>
  )
}

function BudgetRow({ label, value, icon }: { label: string; value: number; icon?: React.ReactNode }) {
  return (
    <div className="budget-row">
      <span>{icon && <i>{icon}</i>}{label}</span>
      <b>{money(value)}</b>
    </div>
  )
}

function Movements({
  movements,
  month,
  onAdd,
  onRemove,
  onTogglePaid,
}: {
  movements: Movement[]
  month: string
  onAdd: () => void
  onRemove: (id: string) => void
  onTogglePaid: (id: string) => void
}) {
  const visible = movements
    .filter((movement) => appliesToMonth(movement, month))
    .sort((a, b) => a.date.localeCompare(b.date))
  const totals = movementTotals(movements, month)

  return (
    <section className="stack">
      <div className="grid-two">
        <article className="metric-card positive">
          <span>Entradas lançadas</span>
          <strong>{money(totals.income)}</strong>
        </article>
        <article className="metric-card negative">
          <span>Saídas lançadas</span>
          <strong>{money(totals.expense)}</strong>
        </article>
      </div>

      <article className="card">
        <div className="section-head">
          <div><span className="eyebrow">MOVIMENTAÇÕES</span><h2>{monthLabel(month)}</h2></div>
          <button className="icon-button" onClick={onAdd}><Plus size={20} /></button>
        </div>
        {visible.length === 0 ? (
          <div className="empty-state">Nenhuma movimentação adicional registrada neste mês.</div>
        ) : (
          <div className="movement-list">
            {visible.map((movement) => (
              <div className={`movement ${movement.paid ? 'paid' : ''}`} key={movement.id}>
                <button className={`movement-icon ${movement.type}`} onClick={() => onTogglePaid(movement.id)} title="Marcar pago/recebido">
                  {movement.type === 'income' ? <ArrowUpCircle /> : <ArrowDownCircle />}
                </button>
                <div className="movement-copy">
                  <strong>{movement.description}</strong>
                  <span>{movement.category} · {new Date(`${movement.date}T12:00:00`).toLocaleDateString('pt-BR')}</span>
                  {movement.recurrence === 'monthly' && <small>Repete mensalmente</small>}
                </div>
                <div className="movement-value">
                  <b className={movement.type}>{movement.type === 'expense' ? '-' : '+'}{money(movement.amount)}</b>
                  <button onClick={() => onRemove(movement.id)}><Trash2 size={16} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </article>
      <button className="primary-button" onClick={onAdd}><Plus size={20} /> Adicionar</button>
    </section>
  )
}

function Projection({ config, movements, startMonth }: { config: BudgetConfig; movements: Movement[]; startMonth: string }) {
  const summary = fixedSummary(config)
  const months = Array.from({ length: 12 }, (_, index) => shiftMonth(startMonth, index))

  return (
    <section className="stack">
      <article className="card projection-intro">
        <span className="eyebrow">VISÃO DE 12 MESES</span>
        <h2>Veja antes de comprometer</h2>
        <p>Três cenários: sem renda extra, usando o mínimo esperado e usando o máximo esperado. Lançamentos mensais também entram na projeção.</p>
      </article>
      <div className="projection-list">
        {months.map((month) => {
          const totals = movementTotals(movements, month)
          const base = config.salaryNet + totals.income - summary.fixed - totals.expense
          const low = base + config.extraMin
          const high = base + config.extraMax
          return (
            <article className="projection-card" key={month}>
              <div className="projection-title">
                <strong>{monthLabel(month)}</strong>
                <span className={base < 0 ? 'badge danger' : 'badge ok'}>{base < 0 ? 'depende do extra' : 'fecha no salário'}</span>
              </div>
              <div className="scenario-row"><span>Sem renda extra</span><b className={base < 0 ? 'expense' : 'income'}>{money(base)}</b></div>
              <div className="scenario-row"><span>Extra mínimo</span><b className={low < 0 ? 'expense' : 'income'}>{money(low)}</b></div>
              <div className="scenario-row"><span>Extra máximo</span><b className={high < 0 ? 'expense' : 'income'}>{money(high)}</b></div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

function Planner({
  config,
  summary,
  onChange,
  reserveTarget,
  reserveProgress,
}: {
  config: BudgetConfig
  summary: ReturnType<typeof fixedSummary>
  onChange: <K extends keyof BudgetConfig>(key: K, value: BudgetConfig[K]) => void
  reserveTarget: number
  reserveProgress: number
}) {
  const margin = config.salaryNet - summary.fixed
  return (
    <section className="stack">
      <article className={`hero-card ${margin < 0 ? 'attention' : margin < 300 ? 'tight' : 'good'}`}>
        <div className="hero-label"><Gauge size={18} /><span>Resultado do cenário</span></div>
        <strong className="hero-value">{money(margin)}</strong>
        <p>{margin < 0 ? 'O salário sozinho não cobre o orçamento-base.' : 'Sobra estimada usando apenas o salário líquido.'}</p>
        <div className="range-row"><span>Moradia máxima sem depender do extra</span><b>{money(summary.safeHousing)}</b></div>
      </article>

      <article className="card form-card">
        <div className="section-head"><div><span className="eyebrow">ENTRADAS</span><h2>Renda mensal</h2></div></div>
        <Field label="Salário líquido" value={config.salaryNet} onChange={(value) => onChange('salaryNet', value)} />
        <div className="field-grid">
          <Field label="Renda extra mínima" value={config.extraMin} onChange={(value) => onChange('extraMin', value)} />
          <Field label="Renda extra máxima" value={config.extraMax} onChange={(value) => onChange('extraMax', value)} />
        </div>
        <Field label="Vale-refeição" value={config.mealVoucher} onChange={(value) => onChange('mealVoucher', value)} hint="Benefício: não entra como dinheiro livre." />
      </article>

      <article className="card form-card">
        <div className="section-head"><div><span className="eyebrow">DESPESAS-BASE</span><h2>Compromissos do mês</h2></div></div>
        <Field label="Moradia (aluguel + condomínio)" value={config.housing} onChange={(value) => onChange('housing', value)} hint={`Teto seguro atual: ${money(summary.safeHousing)}`} />
        <label className="field">
          <span>Pensão (% do salário líquido)</span>
          <div className="percent-input">
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={Number(config.pensionPercent.toFixed(2))}
              onChange={(event) => onChange('pensionPercent', Math.max(0, Number(event.target.value)))}
            />
            <span>%</span>
          </div>
          <small>Valor calculado agora: <b>{money(summary.pension)}</b></small>
        </label>
        <Field label="Cartão de crédito" value={config.cardBudget} onChange={(value) => onChange('cardBudget', value)} />
        <Field label="Energia" value={config.energy} onChange={(value) => onChange('energy', value)} />
        <Field label="Internet" value={config.internet} onChange={(value) => onChange('internet', value)} />
        <Field label="Celular" value={config.phone} onChange={(value) => onChange('phone', value)} />
        <Field label="Academia" value={config.gym} onChange={(value) => onChange('gym', value)} />
        <Field label="Moto / manutenção" value={config.motorcycle} onChange={(value) => onChange('motorcycle', value)} />
      </article>

      <article className="card form-card">
        <div className="section-head"><div><span className="eyebrow">RESERVA</span><h2>Fundo de segurança</h2></div></div>
        <Field label="Quanto já tenho guardado" value={config.reserveCurrent} onChange={(value) => onChange('reserveCurrent', value)} />
        <label className="field">
          <span>Meta de meses protegidos</span>
          <select value={config.reserveMonths} onChange={(event) => onChange('reserveMonths', Number(event.target.value))}>
            <option value={1}>1 mês</option>
            <option value={3}>3 meses</option>
            <option value={6}>6 meses</option>
            <option value={12}>12 meses</option>
          </select>
          <small>Meta atual: <b>{money(reserveTarget)}</b></small>
        </label>
        <div className="progress-track"><div style={{ width: `${reserveProgress}%` }} /></div>
      </article>
    </section>
  )
}

function SettingsPanel({
  updateText,
  onCheckUpdate,
  onExport,
  onImport,
  onReset,
}: {
  updateText: string
  onCheckUpdate: () => void
  onExport: () => void
  onImport: () => void
  onReset: () => void
}) {
  return (
    <section className="stack settings-stack">
      <article className="card">
        <div className="section-head"><div><span className="eyebrow">VERSÃO</span><h2>Atualizações</h2></div><RefreshCw size={22} /></div>
        <p className="muted">Versão instalada: <b>{__APP_VERSION__}</b></p>
        <button className="secondary-button" onClick={onCheckUpdate}><RefreshCw size={18} /> Verificar atualização</button>
        {updateText && <div className="info-strip">{updateText}</div>}
      </article>

      <article className="card">
        <div className="section-head"><div><span className="eyebrow">DADOS</span><h2>Backup e restauração</h2></div><ShieldCheck size={22} /></div>
        <p className="muted">Seus dados ficam salvos neste aparelho. Faça backup antes de trocar de celular ou limpar os dados do app.</p>
        <div className="button-stack">
          <button className="secondary-button" onClick={onExport}><Download size={18} /> Exportar backup</button>
          <button className="secondary-button" onClick={onImport}><Upload size={18} /> Importar backup</button>
        </div>
      </article>

      <article className="card danger-zone">
        <div><span className="eyebrow">RECOMEÇAR</span><h2>Restaurar orçamento inicial</h2></div>
        <p>Apaga lançamentos locais e volta para os valores iniciais do planejamento.</p>
        <button className="danger-button" onClick={onReset}><Trash2 size={18} /> Restaurar dados</button>
      </article>

      <p className="privacy-note">Sem conta, sem anúncios e sem envio automático dos seus dados financeiros para o GitHub.</p>
    </section>
  )
}

function MovementModal({
  month,
  onClose,
  onSave,
}: {
  month: string
  onClose: () => void
  onSave: (movement: Movement) => void
}) {
  const [type, setType] = useState<MovementType>('expense')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState(0)
  const [category, setCategory] = useState('Outros')
  const [date, setDate] = useState(`${month}-${String(new Date().getDate()).padStart(2, '0')}`)
  const [recurrence, setRecurrence] = useState<Recurrence>('none')

  const save = () => {
    if (!description.trim() || amount <= 0 || !date) return
    onSave({ id: uid(), description: description.trim(), amount, type, category, date, recurrence, paid: false })
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal-card">
        <div className="section-head"><div><span className="eyebrow">NOVO</span><h2>Lançamento</h2></div><button className="close-button" onClick={onClose}>×</button></div>
        <div className="type-toggle">
          <button className={type === 'expense' ? 'active expense' : ''} onClick={() => setType('expense')}><ArrowDownCircle size={18} /> Saída</button>
          <button className={type === 'income' ? 'active income' : ''} onClick={() => setType('income')}><ArrowUpCircle size={18} /> Entrada</button>
        </div>
        <label className="field"><span>Descrição</span><input type="text" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Ex.: farmácia, venda extra..." /></label>
        <Field label="Valor" value={amount} onChange={setAmount} step={0.01} />
        <div className="field-grid">
          <label className="field"><span>Data</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
          <label className="field"><span>Categoria</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option>Outros</option><option>Casa</option><option>Filho</option><option>Cartão</option><option>Lazer</option><option>Saúde</option><option>Moto</option><option>Renda extra</option><option>Reserva</option></select></label>
        </div>
        <label className="field"><span>Repetição</span><select value={recurrence} onChange={(event) => setRecurrence(event.target.value as Recurrence)}><option value="none">Somente este mês</option><option value="monthly">Todo mês a partir desta data</option></select></label>
        <button className="primary-button" onClick={save}>Salvar lançamento</button>
      </div>
    </div>
  )
}

export default App
