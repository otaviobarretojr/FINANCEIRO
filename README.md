# FINANCEIRO

Aplicativo pessoal de organização financeira mobile-first e local-first.

## Versão 1.0

O app foi estruturado para responder primeiro à pergunta: **quanto posso assumir sem depender de renda variável?**

### Orçamento
- Salário líquido garantido.
- Renda extra tratada como faixa mínima/máxima.
- Vale-refeição separado do caixa disponível.
- Pensão calculada como percentual do salário líquido.
- Moradia, energia, internet, celular, academia e moto.
- Dias de vencimento configuráveis.
- Margem garantida, margem com renda variável e limite diário sugerido.

### Cartão de crédito
- Orçamento fixo ou modo de fatura real.
- Limite, fechamento e vencimento por cartão.
- Compras parceladas com distribuição automática nas faturas futuras.
- Cobranças recorrentes mensais.
- Projeção das próximas 6 faturas.
- Limite comprometido estimado.
- A lógica evita dupla contagem: no modo real, a fatura calculada substitui o orçamento fixo do cartão.

### Lançamentos e agenda
- Entradas e saídas avulsas.
- Recorrência mensal.
- Marcação de pago/recebido.
- Agenda mensal com compromissos por dia.
- Contas fixas, cartão e lançamentos no mesmo calendário.
- Lembretes locais no Android configuráveis por antecedência e horário.

### Análises
- Comprometimento da renda garantida.
- Resultado mensal projetado.
- Evolução de despesas em 6 meses.
- Distribuição por categoria.
- Fechamento mensal persistente para preservar histórico mesmo após mudanças futuras no orçamento.

### Metas e reservas
- Metas independentes com valor-alvo, data e prioridade.
- Reserva de emergência inicial.
- Sugestão de aporte mensal.
- Aportes entram automaticamente como saída do mês para não criar uma falsa sobra.

### Segurança e backup
- PIN local armazenado como hash SHA-256.
- Biometria/credencial segura do Android quando disponível.
- Bloqueio imediato ou após período configurável ao sair do app.
- Backup JSON simples.
- Backup criptografado com AES-GCM e chave derivada por PBKDF2.
- Compartilhamento do backup criptografado pelo Android para Google Drive, Files ou outro destino instalado.
- Restauração de backup simples ou criptografado.

### Atualizações
- Verificação de novas versões publicadas no GitHub Releases.
- Mesmo package id Android: `com.otaviobarreto.financeiro`.
- Dados do app são migrados da estrutura v0.1 para v1.0 automaticamente.

## Orçamento inicial configurado

- Salário líquido: R$ 3.500
- Renda extra variável: R$ 150 a R$ 300
- Vale-refeição: R$ 500
- Moradia: R$ 1.200
- Pensão: R$ 1.200 (34,2857% do salário líquido de R$ 3.500)
- Energia: R$ 250
- Internet: R$ 100
- Celular: R$ 49
- Academia: R$ 80
- Moto / manutenção: R$ 150
- Cartão: R$ 600 em modo de orçamento fixo

Todos esses valores podem ser alterados no próprio aplicativo.

## Desenvolvimento

```bash
npm install
npm run build
```

Android:

```bash
npx cap add android
npx cap sync android
cd android
./gradlew assembleDebug
```

## Build automático do APK

Todo push para `main` executa `.github/workflows/android.yml` e produz um APK de preview nos artifacts do GitHub Actions.

## Atualizações instaláveis por cima da versão atual

Para APKs definitivos, todas as versões precisam usar a mesma chave de assinatura. A chave **não deve** ser versionada no repositório.

Secrets esperados pelo workflow:

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

Exemplo para gerar uma chave uma única vez:

```bash
keytool -genkeypair -v -keystore financeiro-release.keystore -alias financeiro -keyalg RSA -keysize 2048 -validity 10000
```

Depois de cadastrar os Secrets, publique uma tag `v1.0.0`, `v1.0.1`, etc. O GitHub Actions gera o APK release assinado e publica em Releases. O app consegue verificar a nova versão em **Ajustes > Atualizações**.

## Privacidade

O repositório contém código, não os dados financeiros do usuário. Os registros ficam localmente no aparelho. Para troca de aparelho, desinstalação ou limpeza de dados, faça um backup antes.
