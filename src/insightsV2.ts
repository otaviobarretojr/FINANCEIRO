import { type FinanceState, categoryFor, currentMonth, money, monthDiff, monthlySummary, shiftMonth } from './financeV2'

export type InsightTone = 'good' | 'info' | 'warning' | 'critical'
export type FinancialInsight = {
  id: string
  tone: InsightTone
  title: string
  message: string
  impact?: number
  action?: string
}

export type EmergencyPlan = {
  essentialMonthly: number
  recommendedTarget: number
  current: number
  gap: number
  suggestedContribution: number
  monthsToTarget: number
  progress: number
  affordable: boolean
}

export function emergencyPlan(state: FinanceState, month = currentMonth()): EmergencyPlan {
  const summary = monthlySummary(state, month)
  const emergency = state.goals.find((goal) => goal.type === 'emergency' && goal.active)
  const recommendedTarget = Math.max(summary.essentialExpenses * Math.max(1, state.settings.reserveMonths), emergency?.target ?? 0)
  const current = emergency?.current ?? 0
  const gap = Math.max(0, recommendedTarget - current)
  const margin = Math.max(0, summary.marginGuaranteed)
  let monthsToTarget = 12
  if (emergency?.targetDate) {
    monthsToTarget = Math.max(1, monthDiff(month, emergency.targetDate.slice(0, 7)))
  } else if (gap > 0 && margin > 0) {
    monthsToTarget = Math.max(1, Math.ceil(gap / Math.max(1, margin * (state.settings.reserveContributionShare / 100))))
  }
  const desired = emergency?.monthlyOverride && emergency.monthlyOverride > 0
    ? emergency.monthlyOverride
    : gap / Math.max(1, monthsToTarget)
  const affordableShare = margin * (state.settings.reserveContributionShare / 100)
  const suggestedContribution = gap <= 0 ? 0 : Math.min(gap, desired, affordableShare || desired)
  return {
    essentialMonthly: summary.essentialExpenses,
    recommendedTarget,
    current,
    gap,
    suggestedContribution: summary.marginGuaranteed > 0 ? Math.max(0, suggestedContribution) : 0,
    monthsToTarget,
    progress: recommendedTarget > 0 ? Math.min(100, (current / recommendedTarget) * 100) : 0,
    affordable: summary.marginGuaranteed >= desired,
  }
}

export function categoryReductionPlan(state: FinanceState, month: string, needed: number) {
  if (needed <= 0) return [] as { categoryId: string; category: string; current: number; suggestedCut: number; percent: number }[]
  const totals = monthlySummary(state, month).categories
  const candidates = Object.entries(totals)
    .map(([categoryId, current]) => ({ categoryId, current, category: categoryFor(state, categoryId) }))
    .filter((item) => item.current > 0 && item.category && item.category.reducible)
    .sort((a, b) => {
      const rank = (value?: string) => value === 'discretionary' ? 3 : value === 'flexible' ? 2 : 1
      return rank(b.category?.essentiality) - rank(a.category?.essentiality) || b.current - a.current
    })

  let remaining = needed
  const result: { categoryId: string; category: string; current: number; suggestedCut: number; percent: number }[] = []
  for (const item of candidates) {
    if (remaining <= 0) break
    const maxRate = item.category?.essentiality === 'discretionary' ? 0.3 : item.category?.essentiality === 'flexible' ? 0.18 : 0.08
    const cut = Math.min(remaining, item.current * maxRate)
    if (cut < 10) continue
    result.push({ categoryId: item.categoryId, category: item.category?.name ?? 'Categoria', current: item.current, suggestedCut: cut, percent: (cut / item.current) * 100 })
    remaining -= cut
  }
  return result
}

export function financialScore(state: FinanceState, month: string) {
  const summary = monthlySummary(state, month)
  const reserve = emergencyPlan(state, month)
  const guaranteed = Math.max(1, summary.guaranteedIncome)
  const commitment = summary.plannedExpenses / guaranteed
  const debtRatio = summary.debtInstallments / guaranteed
  let score = 35
  if (summary.marginGuaranteed >= 0) score += 20
  else score -= Math.min(20, Math.abs(summary.marginGuaranteed) / guaranteed * 40)
  if (commitment <= 0.7) score += 20
  else if (commitment <= 0.85) score += 10
  else if (commitment > 1) score -= 15
  score += reserve.progress * 0.15
  if (debtRatio <= 0.1) score += 10
  else if (debtRatio > 0.3) score -= 10
  return Math.max(0, Math.min(100, Math.round(score)))
}

export function generateInsights(state: FinanceState, month: string): FinancialInsight[] {
  const summary = monthlySummary(state, month)
  const reserve = emergencyPlan(state, month)
  const insights: FinancialInsight[] = []
  const guaranteed = Math.max(1, summary.guaranteedIncome)
  const commitment = summary.plannedExpenses / guaranteed

  if (summary.marginGuaranteed < 0) {
    const gap = Math.abs(summary.marginGuaranteed)
    insights.push({ id: 'negative-margin', tone: 'critical', title: 'Seu orçamento garantido não fecha sozinho', message: `Faltam ${money(gap)} antes de considerar sua renda variável. O ideal é reduzir compromissos ou aumentar renda fixa antes de assumir novas parcelas.`, impact: gap })
    const cuts = categoryReductionPlan(state, month, gap)
    if (cuts.length) {
      insights.push({ id: 'cuts', tone: 'warning', title: 'Onde eu começaria a reduzir', message: cuts.map((item) => `${item.category}: ${money(item.suggestedCut)}`).join(' • '), impact: cuts.reduce((sum, item) => sum + item.suggestedCut, 0), action: 'Revise primeiro categorias flexíveis e discricionárias.' })
    }
  } else if (summary.marginGuaranteed < guaranteed * 0.1) {
    insights.push({ id: 'thin-margin', tone: 'warning', title: 'Sua margem está muito curta', message: `Sobram ${money(summary.marginGuaranteed)}, menos de 10% da renda garantida. Um imprevisto pequeno pode fazer o mês depender da renda variável.` })
  } else {
    insights.push({ id: 'positive-margin', tone: 'good', title: 'O mês fecha com a renda garantida', message: `Sua margem planejada é de ${money(summary.marginGuaranteed)} antes da renda variável.` })
  }

  if (commitment > 1) insights.push({ id: 'commitment', tone: 'critical', title: 'Comprometimento acima de 100%', message: `As despesas planejadas equivalem a ${(commitment * 100).toFixed(0)}% da sua renda garantida.` })
  else if (commitment > 0.85) insights.push({ id: 'commitment', tone: 'warning', title: 'Renda muito comprometida', message: `${(commitment * 100).toFixed(0)}% da renda garantida já está comprometida. Tente levar esse número gradualmente para abaixo de 80%.` })

  if (reserve.recommendedTarget > 0 && reserve.gap > 0) {
    if (reserve.suggestedContribution > 0) {
      insights.push({ id: 'reserve', tone: reserve.affordable ? 'info' : 'warning', title: 'Aporte sugerido para a reserva', message: `Com despesas essenciais de ${money(reserve.essentialMonthly)}, sua reserva-alvo é ${money(reserve.recommendedTarget)}. Neste mês, um aporte de ${money(reserve.suggestedContribution)} é compatível com sua margem planejada.`, impact: reserve.suggestedContribution })
    } else {
      insights.push({ id: 'reserve-blocked', tone: 'warning', title: 'Reserva precisa esperar o orçamento respirar', message: `Sua reserva ainda precisa de ${money(reserve.gap)}, mas o orçamento garantido não tem margem positiva. Primeiro precisamos liberar caixa.` })
    }
  } else if (reserve.recommendedTarget > 0) {
    insights.push({ id: 'reserve-done', tone: 'good', title: 'Reserva de emergência no alvo', message: `Você já alcançou o nível de reserva definido para ${state.settings.reserveMonths} meses de despesas essenciais.` })
  }

  const totals = summary.categories
  for (const category of state.categories.filter((item) => item.kind === 'expense' && item.active && item.monthlyBudget > 0)) {
    const spent = totals[category.id] ?? 0
    if (spent > category.monthlyBudget * 1.1) {
      insights.push({ id: `budget-${category.id}`, tone: 'warning', title: `${category.name} passou do limite`, message: `Planejado/lançado: ${money(spent)}. Seu limite para a categoria é ${money(category.monthlyBudget)}, um excesso de ${money(spent - category.monthlyBudget)}.`, impact: spent - category.monthlyBudget })
    }
  }

  const history = state.closings.filter((item) => item.month < month).sort((a, b) => b.month.localeCompare(a.month)).slice(0, 3)
  if (history.length >= 2) {
    for (const [categoryId, current] of Object.entries(totals)) {
      const values = history.map((item) => item.categoryTotals?.[categoryId] ?? 0).filter((value) => value > 0)
      if (values.length < 2) continue
      const average = values.reduce((a, b) => a + b, 0) / values.length
      if (current > average * 1.25 && current - average >= 50) {
        const category = categoryFor(state, categoryId)
        insights.push({ id: `trend-${categoryId}`, tone: 'info', title: `${category?.name ?? 'Uma categoria'} subiu`, message: `Está ${money(current - average)} acima da média dos últimos fechamentos (+${((current / average - 1) * 100).toFixed(0)}%). Vale conferir se foi pontual ou virou novo padrão.` })
      }
    }
  }

  if (summary.variableMax > 0 && summary.marginGuaranteed < 0 && summary.highMargin >= 0) {
    insights.push({ id: 'variable-dependency', tone: 'warning', title: 'Você depende da renda variável para fechar o mês', message: `No melhor cenário variável, o saldo chega a ${money(summary.highMargin)}. Trate essa renda como bônus até o orçamento fixo ficar positivo.` })
  }

  return insights.slice(0, 10)
}

export function projection(state: FinanceState, startMonth: string, count = 12) {
  return Array.from({ length: count }, (_, index) => {
    const month = shiftMonth(startMonth, index)
    const summary = monthlySummary(state, month)
    return { month, guaranteed: summary.marginGuaranteed, low: summary.lowMargin, high: summary.highMargin, expenses: summary.plannedExpenses }
  })
}
