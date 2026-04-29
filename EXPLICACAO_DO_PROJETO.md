# Explicacao do projeto MedStudy AI

Este arquivo resume como o projeto foi montado, como cada parte funciona e como os principais erros foram resolvidos.

## 1. Objetivo do site

O projeto e uma pagina de estudos com flashcards para medicina.

A ideia principal e:

1. A pessoa escolhe um tema ou uma pasta.
2. A IA cria perguntas e respostas em formato de flashcard.
3. Os flashcards ficam salvos em pastas.
4. A pessoa revisa os cards por repeticao espacada.
5. Ao virar um card, a pessoa classifica a resposta como:
   - De novo
   - Facil
   - Dificil
   - Errado
6. O sistema calcula quando cada card deve aparecer de novo.
7. O historico fica salvo no Supabase para aparecer em outro celular ou computador.

## 2. Arquivos principais

### `app/study/FlashStudyApp.tsx`

Este e o componente principal do site.

Ele controla:

- layout da pagina;
- abas do app;
- pastas;
- flashcards;
- revisao diaria;
- criacao manual;
- criacao com IA;
- biblioteca tipo Notion;
- salvamento local e remoto.

As abas atuais sao:

- `Revisao de hoje`: mostra os cards vencidos para revisar.
- `Biblioteca`: mostra todos os flashcards em listas por status.
- `Criar revisao`: gera cards com IA.
- `Criar manual`: permite escrever pergunta e resposta manualmente.

### `app/api/ai/flashcards/route.ts`

Esta rota e responsavel por chamar a IA.

Ela recebe:

- tema;
- contexto em texto;
- quantidade de flashcards.

Depois retorna uma lista de flashcards no formato:

```ts
{
  question: string;
  answer: string;
  topic: string;
  difficulty: "facil" | "medio" | "dificil";
  review_days: number;
}
```

### `app/api/study-state/route.ts`

Esta rota salva e carrega o estado completo do app no Supabase.

O estado salvo inclui:

- pastas;
- flashcards;
- historico de revisoes.

O site usa um unico documento compartilhado com a chave:

```txt
shared-study-state
```

### `app/api/health/route.ts`

Esta rota serve para diagnostico.

Ela mostra se:

- a chave da IA existe;
- o modelo da IA esta configurado;
- o Supabase esta conectado;
- a tabela do Supabase esta acessivel.

Foi muito util para descobrir se o problema estava no codigo, na Vercel ou nas variaveis.

### `supabase/schema.sql`

Este arquivo contem o SQL necessario para criar a tabela usada pelo app.

A tabela principal e:

```sql
public.studyagent_app_state
```

Ela guarda um JSON com todos os dados do app.

## 3. Como o salvamento funciona

O app salva em dois lugares:

1. `localStorage` do navegador.
2. Supabase.

O `localStorage` deixa o app continuar funcionando mesmo se a internet falhar.

O Supabase permite abrir em outro celular ou computador e ver os mesmos dados.

Fluxo:

1. Ao abrir o site, o app chama `GET /api/study-state`.
2. Se existir memoria no Supabase, ele carrega essa memoria.
3. Quando cria, edita, revisa ou apaga algo, o app salva no `localStorage`.
4. Depois chama `POST /api/study-state`.
5. A rota grava o JSON na tabela do Supabase.

Mensagem esperada quando tudo esta certo:

```txt
Memoria online salva no Supabase.
```

## 4. Como a IA funciona

O app usa OpenRouter como provedor principal.

As variaveis usadas sao:

```txt
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=...
OPENROUTER_MODEL=...
```

O codigo pede para a IA devolver JSON estruturado.

Quando a IA gratuita devolve um formato estranho, o codigo tenta tratar melhor o erro e mostra uma mensagem mais clara para a pessoa.

## 5. Como a revisao espacada funciona

Cada flashcard tem:

```ts
nextReviewAt: string;
reviewCount: number;
review_days: number;
```

Quando a pessoa responde:

- `De novo`: volta em 1 dia.
- `Facil`: volta em 6 dias.
- `Dificil`: volta em 2 dias.
- `Errado`: volta em 1 dia.

O card so aparece na sessao diaria quando `nextReviewAt` ja chegou.

A sessao diaria mostra 10 cards por vez, com botao para carregar mais 10.

## 6. Biblioteca tipo Notion

Foi criada uma aba chamada `Biblioteca`.

Ela mostra todos os cards em lista, separados por:

- Para revisar
- Errados
- De novo
- Dificeis
- Faceis
- Novos

Tambem tem busca por:

- pergunta;
- resposta;
- pasta;
- tema.

Cada item tem acoes rapidas:

- abrir a pasta;
- mandar o card para revisar hoje.

## 7. Principais erros e como foram resolvidos

### Erro 1: OpenAI recusou por limite ou cota

Mensagem parecida:

```txt
A OpenAI recusou por limite/cota.
```

Motivo:

A chave da OpenAI nao tinha credito, billing ou cota suficiente.

Solucao:

O projeto foi adaptado para usar OpenRouter, que possui modelos gratuitos ou mais baratos.

Tambem foram criadas mensagens de erro mais claras para diferenciar:

- chave ausente;
- chave invalida;
- cota estourada;
- modelo indisponivel;
- resposta em formato errado.

### Erro 2: `OPENROUTER_API_KEY nao configurada`

Motivo:

A variavel existia localmente, mas nao estava configurada no ambiente certo da Vercel.

Solucao:

Adicionar na Vercel em:

```txt
Settings > Environment Variables
```

E marcar:

- Production
- Preview

Depois disso foi necessario fazer redeploy.

### Erro 3: Supabase nao salvava em outro dispositivo

Motivo:

Inicialmente o app salvava principalmente no navegador. Isso funciona apenas no mesmo aparelho.

Solucao:

Criamos a rota:

```txt
/api/study-state
```

Ela salva o estado no Supabase.

Assim, outro celular ou computador consegue carregar os mesmos flashcards.

### Erro 4: `Invalid API key` no Supabase

Motivo:

A Vercel tinha variaveis antigas e novas ao mesmo tempo.

O codigo estava misturando uma URL de um projeto com uma chave de outro projeto.

Solucao:

O codigo foi alterado para priorizar as variaveis criadas pela integracao Supabase/Vercel:

```txt
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
```

Depois disso o endpoint `/api/health` passou a mostrar:

```txt
supabase.table: "ok"
```

### Erro 5: O site parecia antigo mesmo depois do deploy

Sintoma:

Aparecia uma mensagem antiga:

```txt
Salvamento remoto indisponivel; usando este navegador.
```

Motivo:

O dominio principal da Vercel ainda apontava para um deployment antigo.

Solucao:

O alias da Vercel foi atualizado para apontar para o deploy novo.

Tambem foi recomendado dar refresh forte no navegador:

```txt
Mac: Cmd + Shift + R
Windows: Ctrl + F5
```

### Erro 6: Upload/leitura de PDF nao funcionava bem

Sintoma:

Erro relacionado ao worker do PDF:

```txt
Cannot find module pdf.worker.mjs
```

Motivo:

O processamento de PDF no ambiente do Next/Vercel pode falhar por causa do worker do `pdfjs`.

Solucao inicial:

Foi ajustado o carregamento do worker.

Solucao final de produto:

Como a funcao de arquivos ainda causava friccao, ela foi removida da interface.

Agora a IA trabalha com texto colado no campo de contexto, que e mais estavel.

### Erro 7: Firebase parecia pedir pagamento

Motivo:

O Firebase/Firestore pode pedir ativacao de billing dependendo da configuracao.

Solucao:

Removemos Firebase e voltamos para Supabase gratuito.

O Supabase ficou mais simples para esse projeto.

## 8. Variaveis importantes

Na Vercel, as variaveis principais sao:

```txt
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=...
OPENROUTER_MODEL=...
SUPABASE_URL=...
SUPABASE_PUBLISHABLE_KEY=...
NEXT_PUBLIC_SITE_URL=...
```

Observacao:

Nao e recomendado colocar chaves secretas no codigo ou em arquivos que vao para o GitHub.

## 9. Como publicar alteracoes

Fluxo usado:

1. Alterar o codigo.
2. Rodar validacoes:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

3. Fazer commit:

```bash
git add .
git commit -m "Mensagem do commit"
```

4. Subir para o GitHub:

```bash
git push origin main
git push origin main:master
```

5. A Vercel faz deploy automaticamente.

## 10. Como testar se esta funcionando

### Testar Supabase

Abrir:

```txt
https://seu-site.vercel.app/api/health
```

O esperado:

```txt
hasSupabaseUrl: true
hasSupabasePublicKey: true
supabase.configured: true
supabase.table: "ok"
```

### Testar salvamento

1. Abrir o site.
2. Criar uma pasta ou flashcard.
3. Ver a mensagem:

```txt
Memoria online salva no Supabase.
```

4. Abrir o mesmo link em outro navegador/celular.
5. Confirmar que os dados aparecem.

### Testar IA

1. Abrir a aba `Criar revisao`.
2. Escolher pasta existente ou nova pasta.
3. Colar um texto de contexto.
4. Clicar em `Gerar flashcards`.

Se der erro, abrir:

```txt
/api/health
```

e verificar se `hasOpenRouterKey` esta como `true`.

## 11. Decisoes importantes do projeto

### Sem login

O app foi feito sem senha/login porque o objetivo era simplicidade.

Isso significa que todos usam o mesmo banco compartilhado.

Se no futuro quiser separar usuarios, o proximo passo e adicionar autenticacao.

### Um JSON unico no Supabase

Em vez de criar varias tabelas para pastas, cards e historico, foi usado um JSON unico.

Isso deixou a implementacao mais rapida e simples.

Para um app pequeno de estudos, isso funciona bem.

Se o app crescer muito, pode valer separar em tabelas relacionais.

### Texto em vez de arquivos

O upload de arquivo foi removido porque gerava instabilidade.

O fluxo atual e mais confiavel:

1. A pessoa copia o texto do material.
2. Cola no campo de contexto.
3. A IA cria os flashcards.

## 12. Estado atual

O projeto atualmente tem:

- layout com cara de medicina;
- cores azul/roxo;
- revisao diaria;
- pastas;
- exclusao de pastas;
- criacao manual;
- criacao por IA;
- IA salvando em pasta existente ou nova;
- biblioteca estilo Notion;
- Supabase conectado;
- memoria compartilhada entre dispositivos;
- deploy pela Vercel.

