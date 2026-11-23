# 🏠 Rachadinha

App simples para dividir as contas da casa entre 2 pessoas, proporcional à renda de cada uma.

## Como usar

Abra o `index.html` no navegador (celular ou computador). Não precisa instalar nada.

1. **Pessoas & renda**: informe os nomes e a renda mensal. O percentual é calculado sozinho
   (ex.: 6.000 e 4.000 → 60% / 40%). Também dá para definir o percentual manualmente.
2. **+ (nova despesa)**: descrição, valor, data, categoria, quem pagou e o tipo:
   - **Única**: aparece só no mês da data.
   - **Mensal**: repete todo mês até você encerrar (aluguel, internet…).
   - **Parcelada**: informe o valor de cada parcela e o número de parcelas.
   - Divisão: proporcional à renda, 50/50 ou despesa pessoal de uma das duas pessoas.
3. **Mês**: marque a caixinha quando a conta for paga. O app mostra quem deve quanto para quem.
4. **Próximos meses**: projeção de 12 meses com o total e a parte de cada pessoa.

## Dados

Ficam salvos só no navegador (localStorage). Use **Exportar/Importar** em
"Pessoas & renda" para fazer backup ou levar para outro aparelho.
