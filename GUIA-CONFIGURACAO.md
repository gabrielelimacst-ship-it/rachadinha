# Guia: colocar o Rachadinha no ar com login de verdade

O app (pasta `docs/`) funciona de dois jeitos:

- **Modo demonstração**: é o que acontece se nada for configurado. Os dados ficam só no aparelho,
  serve para conhecer o app.
- **Modo real**: com o Supabase configurado, cada pessoa tem login e senha, os dados ficam
  na nuvem e as duas veem tudo em tempo real.

> **Analogia:** o app é a "fachada da loja" (as telas). O Supabase é o "cofre dos fundos":
> guarda as contas, as senhas e as fotos. O GitHub Pages é o "terreno" onde a loja fica de pé,
> com um endereço que qualquer celular acessa.

São 3 etapas, umas 20 minutos no total.

---

## Etapa 1 · Criar o banco de dados (Supabase, gratuito)

1. Entre em **supabase.com**, clique em **Start your project** e crie uma conta.
2. Clique em **New project**:
   - *Name*: `rachadinha`
   - *Database Password*: crie uma senha forte e guarde (não vai precisar dela no app)
   - *Region*: **South America (São Paulo)**
3. Espere uns 2 minutos até o projeto ficar pronto.
4. No menu da esquerda, abra **SQL Editor** → **New query**.
5. Copie **todo** o conteúdo do arquivo `supabase/schema.sql` deste repositório, cole e clique em **Run**.
   Deve aparecer "Success". Esse script cria as tabelas, as regras de segurança
   (cada casa só vê os próprios dados) e o espaço privado para as fotos.

## Etapa 2 · Publicar o app (GitHub Pages, gratuito)

1. No GitHub, abra o repositório **rachadinha** → **Settings** → **Pages**.
2. Em *Build and deployment*:
   - *Source*: **Deploy from a branch**
   - *Branch*: `claude/zealous-mendel-exglo6`, pasta **/docs** → **Save**
3. Em 1 ou 2 minutos aparece o endereço, algo como
   `https://SEU-USUARIO.github.io/rachadinha/`. Guarde esse endereço.

> Se o repositório for privado, o GitHub Pages pode pedir plano pago. Alternativa gratuita:
> **app.netlify.com/drop**. Arraste a pasta `docs` para a página e ela gera o endereço na hora.

## Etapa 3 · Ligar o app ao banco

1. No Supabase, vá em **Authentication** → **URL Configuration**:
   - *Site URL*: cole o endereço da etapa 2
   - *Redirect URLs*: **Add URL** → cole o mesmo endereço
   (isso faz os links de confirmação de e-mail e de "esqueci a senha" voltarem para o app)
2. Vá em **Project Settings** → **API** (ou **Data API**) e copie:
   - **Project URL** (ex.: `https://abcdefgh.supabase.co`)
   - **anon public key** (um texto longo que começa com `eyJ...`)
3. Abra o arquivo `docs/config.js` e cole os dois valores entre as aspas:
   ```js
   window.RACHADINHA_CONFIG = {
     supabaseUrl: 'https://abcdefgh.supabase.co',
     supabaseAnonKey: 'eyJhbGciOi...'
   };
   ```
   Se preferir, me mande os dois valores que eu atualizo o arquivo e publico.
   A *anon key* é pública por natureza (ela vai para o navegador de qualquer forma). Quem protege
   os dados são as regras do banco da etapa 1. **Nunca** use a chave `service_role`.

### Opcional
- **Confirmação de e-mail**: por padrão, o Supabase manda um e-mail de confirmação no cadastro.
  Para entrar direto, sem confirmar: **Authentication** → **Providers** → **Email** →
  desligue *Confirm email*.
- **Limite de e-mails**: o envio gratuito do Supabase é limitado (poucos por hora). Para duas
  pessoas é suficiente.

---

## Como as duas pessoas começam

1. **Pessoa 1** abre o endereço → **Criar conta** → **Criar nossa casa**.
   O app mostra um **código** (ex.: `7F3K2A`) no Perfil, com o botão **Copiar convite**.
2. **Pessoa 1** preenche as rendas em **Perfil → Renda e divisão**.
3. **Pessoa 2** abre o endereço → **Criar conta** → **Tenho um código** → digita o código.
4. A partir daí, tudo que uma lança aparece em **Aprovações** para a outra.

### Instalar como app no celular
- **iPhone (Safari)**: botão de compartilhar → **Adicionar à Tela de Início**.
- **Android (Chrome)**: menu ⋮ → **Instalar app** / **Adicionar à tela inicial**.

O ícone fica na tela inicial e o app abre em tela cheia, sem a barra do navegador.
