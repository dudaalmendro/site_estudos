# Instrucoes para salvar os flashcards no Firebase

O site agora usa Firebase Firestore para salvar a memoria online.
Assim, o historico aparece em outro celular ou computador.

## 1. Ativar o Firestore

1. Entre em https://console.firebase.google.com
2. Abra o projeto `site-maria-med`.
3. Va em `Build > Firestore Database`.
4. Clique em `Create database`.
5. Escolha uma regiao.
6. Pode iniciar em modo teste.

## 2. Regras do Firestore

Em `Firestore Database > Rules`, use:

```txt
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /studyState/shared {
      allow read, write: if true;
    }
  }
}
```

Depois clique em `Publish`.

Essas regras deixam qualquer pessoa que abre o site ler e escrever nesse documento
compartilhado. Para um app privado simples de estudos, isso resolve a sincronizacao
sem login. Se no futuro quiser separar usuarios, sera preciso adicionar autenticacao.

## 3. Publicar de novo

Depois de alterar as regras:

1. Faca um novo deploy na Vercel.
2. Abra o site no computador.
3. Crie uma pasta ou flashcard.
4. Espere aparecer `Memoria online salva no Firebase.`
5. Abra o mesmo site no celular.

Se aparecer `Nao consegui salvar no Firebase`, confira as regras do Firestore.
