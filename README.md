# FINANCEIRO

Aplicativo pessoal de organização financeira, criado para funcionar primeiro no celular e manter os dados localmente no aparelho.

## O que a versão inicial faz

- Dashboard mensal com salário garantido, despesas-base e margem real.
- Renda extra variável em faixa mínima/máxima.
- Vale-refeição tratado como benefício, sem inflar o saldo bancário.
- Pensão calculada como percentual do salário líquido.
- Limite seguro de moradia calculado automaticamente.
- Lançamentos adicionais de entrada e saída, únicos ou recorrentes.
- Projeção dos próximos 12 meses em três cenários.
- Reserva de emergência com meta em meses.
- Backup e restauração local em JSON.
- Verificação de nova versão publicada no GitHub Releases.
- Build automático de APK pelo GitHub Actions.

## Orçamento inicial configurado

- Salário líquido: R$ 3.500
- Renda extra variável: R$ 150 a R$ 300
- Vale-refeição: R$ 500
- Moradia: R$ 1.200
- Pensão: R$ 1.200 (34,3% do salário líquido de R$ 3.500)
- Energia: R$ 250
- Internet: R$ 100
- Celular: R$ 49
- Academia: R$ 80
- Moto / manutenção: R$ 150
- Cartão de crédito: R$ 600

Os valores são editáveis dentro do próprio app.

## Desenvolvimento local

```bash
npm install
npm run dev
```

## Android

O projeto usa React + Vite + Capacitor 8. O Android é gerado no build, portanto a pasta `android/` não fica versionada.

```bash
npm install
npm run build
npx cap add android
npx cap sync android
```

## APK de teste

Todo push para `main` executa `.github/workflows/android.yml` e gera um APK de preview como artifact do GitHub Actions.

> O APK de preview serve para testar. Para atualizações instalarem por cima de uma versão existente com segurança, use o fluxo de release assinado abaixo.

## APK de release e atualização por cima da versão instalada

Android exige que todas as versões futuras usem o mesmo certificado de assinatura. Nunca publique a chave privada no repositório.

Crie uma única keystore de release e guarde uma cópia offline segura. Depois configure estes GitHub Actions Secrets:

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

Exemplo para gerar a chave localmente:

```bash
keytool -genkeypair -v -keystore financeiro-release.keystore -alias financeiro -keyalg RSA -keysize 2048 -validity 10000
```

Converter a keystore para Base64:

Linux:

```bash
base64 -w 0 financeiro-release.keystore
```

PowerShell:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("financeiro-release.keystore"))
```

No GitHub, abra **Settings > Secrets and variables > Actions** e cadastre os quatro Secrets.

Depois, para publicar uma nova versão:

1. Atualize `version` em `package.json`, por exemplo `0.2.0`.
2. Faça commit das mudanças.
3. Crie uma tag com o mesmo número precedido de `v`, por exemplo `v0.2.0`.
4. Envie a tag ao GitHub.
5. O workflow cria um APK release assinado e publica em **GitHub Releases**.
6. Dentro do app, use **Ajustes > Verificar atualização**. Se houver uma versão nova, o download do APK é aberto.
7. Como o package id permanece `com.otaviobarreto.financeiro` e a assinatura é a mesma, o Android instala a versão nova por cima da anterior e preserva os dados locais do app.

## Privacidade

Os dados financeiros não são enviados automaticamente ao GitHub. O repositório contém apenas código. Os dados do usuário ficam armazenados localmente no WebView do aplicativo e podem ser exportados manualmente como backup JSON.

Antes de trocar de aparelho, desinstalar o app ou limpar os dados do Android, exporte um backup.

## Próximas evoluções planejadas

- Controle completo de cartão: fechamento, vencimento, limite, compras e parcelas futuras.
- Calendário financeiro com contas por dia.
- Metas independentes (mudança, reserva, compras, viagem).
- Alertas locais antes de vencimentos.
- Relatório mensal planejado x realizado.
- Comparativo entre meses e tendência de gastos.
- Modo de cenários para simular aluguel, pensão e renda variável antes de assumir um compromisso.
- Backup opcional criptografado em nuvem sem perder o modo local-first.
