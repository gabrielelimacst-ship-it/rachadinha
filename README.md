# 🏠 Rachadinha

App para dividir as contas da casa entre 2 pessoas, proporcional à renda de cada uma,
com login individual e aprovação mútua dos lançamentos.

## Como usar

Use a versão publicada como página do Claude (cada pessoa entra com o próprio login).
O `index.html` também abre direto no navegador, em "modo local", sem login, com um seletor
"Usando como" para simular as duas pessoas.

1. **Entrar**: na primeira vez, cada pessoa toca em "Sou Fulana" para ligar o login dela.
   A segunda pessoa precisa receber a página compartilhada como **Editor**.
2. **Pessoas & renda**: nomes e renda mensal. O percentual é calculado sozinho
   (ex.: 6.000 e 4.000 → 60% / 40%), ou definido manualmente.
3. **+ (nova despesa)**: descrição, valor, data, categoria, quem paga, tipo
   (única, mensal ou parcelada), como dividir e foto da nota (opcional).
4. **Pagamento**: toque no quadradinho da despesa e informe quem pagou, o valor real,
   a data e a foto do comprovante (opcional).
5. **Aprovações**: tudo que mexe no dinheiro precisa do OK da outra pessoa: despesa nova,
   edição, exclusão, pagamento, mudança de renda e acerto do mês. Até ser aprovado,
   não entra na conta (numa edição, continua valendo a versão aprovada anterior).
   Quem recusa pode escrever o motivo; quem lançou corrige e reenvia.
6. **Mês**: mostra a parte de cada pessoa, quanto cada uma pagou e quem deve quanto para quem.
7. **Próximos meses**: projeção de 12 meses com o total e a parte de cada pessoa.

## Dados

Na página do Claude, os dados ficam na nuvem da página (um registro por despesa/pagamento)
e as fotos como anexos da página. No modo local, ficam só no navegador.
