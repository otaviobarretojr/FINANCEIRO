# Auditoria geral — FINANCEIRO 2.0

## Diagnóstico da versão anterior

A v1 funcionava para o orçamento inicialmente informado, mas o domínio ainda era rígido: salário, moradia, pensão, energia, internet, celular, academia, moto e orçamento de cartão eram campos especiais. Isso dificulta mudanças de vida, novos gastos e uma análise realmente completa.

## Princípio da v2

O aplicativo agora parte de cadastros genéricos. A tela inicial é consequência dos dados cadastrados, não uma lista fixa de despesas.

### Cadastros mestres

- Contas/saldos
- Fontes de renda: fixa, variável ou benefício
- Categorias editáveis
- Despesas recorrentes
- Lançamentos avulsos
- Cartões
- Compras parceladas/recorrentes
- Dívidas e parcelas
- Metas financeiras
- Reserva de emergência

## Navegação principal

1. **Início** — resumo do mês, analista financeiro, margem, reserva, compromissos e atalhos.
2. **Fluxo** — agenda do mês, pago/pendente/recebido e lançamentos avulsos.
3. **Planejar** — projeção de 12 meses, metas e fechamentos mensais.
4. **Análises** — score interno, alertas, recomendações, cortes e categorias.
5. **Menu** — todos os cadastros e configurações.

## Motor inteligente local

A v2 não usa um chatbot para inventar recomendações. O motor é determinístico e explicável, usando apenas os dados do aparelho.

Analisa:

- margem apenas com renda garantida;
- dependência de renda variável;
- comprometimento da renda;
- despesas essenciais;
- reserva recomendada em meses de despesas essenciais;
- aporte mensal compatível com a margem;
- categorias acima de limites definidos;
- categorias flexíveis/discricionárias com potencial de redução;
- crescimento de categorias comparado aos últimos fechamentos;
- projeção dos próximos 12 meses;
- peso de dívidas e parcelas.

## Reserva de emergência

O alvo recomendado é calculado por:

`despesas essenciais mensais × quantidade de meses definida nas configurações`

O aporte sugerido respeita a sobra garantida e a porcentagem da sobra que o usuário deseja destinar à reserva. Uma meta manual pode substituir o ritmo automático.

## Benefícios

Vale-refeição, vale-transporte e benefícios similares ficam separados da renda em dinheiro. Eles aparecem como recursos, mas não inflam o saldo bancário ou a margem de caixa.

## Migração

Ao atualizar de uma versão anterior, os valores existentes são convertidos para os novos cadastros. Em uma instalação sem dados, o app abre zerado e apresenta um checklist de configuração.

## Privacidade e segurança

- Dados locais no aparelho.
- PIN.
- Biometria/credencial Android.
- Backup JSON.
- Backup criptografado AES-GCM compartilhável.
- Notificações locais para vencimentos.

## Regra de evolução

Novas funções financeiras devem ser adicionadas como novos tipos de cadastro/relacionamentos, evitando voltar a criar campos especiais para uma despesa específica.
