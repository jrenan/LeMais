# LeMais

Webapp minimal para sincronizar um MP3 de audiolivro com o EPUB correspondente.

## Status

LeMais e um app estatico/PWA: nao precisa de backend para funcionar. Os arquivos de audio, EPUB, VTT, ancoras e progresso ficam no IndexedDB do navegador do usuario.

## Rodar localmente

```bash
python3 -m http.server 8000
```

Abra `http://localhost:8000`.

## PWA no iPhone

Depois de publicar em HTTPS:

1. Abra a URL no Safari.
2. Toque em compartilhar.
3. Escolha "Adicionar a Tela de Inicio".
4. Abra pelo icone do LeMais.

O service worker guarda o app shell offline. A biblioteca continua local no dispositivo; use "Exportar banco" como backup periodico.

## Como funciona

- A importação recebe o MP3, o EPUB e uma legenda `.vtt` do audiolivro.
- O app limpa a legenda, compara blocos de fala com o texto normalizado do EPUB e cria âncoras automaticamente.
- Livros ancorados ficam salvos na biblioteca local do navegador.
- A arte do livro é extraída da primeira página do EPUB quando disponível.
- Livros antigos sem arte podem recuperar capa selecionando novamente o EPUB correspondente.
- A biblioteca pode ser exportada e importada como backup JSON.
- A tela de sincronização permite revisar ou criar âncoras manualmente.
- O player estima o trecho do livro usando interpolação linear entre âncoras.
- O leitor estima o tempo do áudio a partir do trecho aberto.
- O ponto atual do áudio é salvo e restaurado ao reabrir o livro.
- Preferências de aparência agrupam modo noturno e tamanho de fonte.
- A velocidade do áudio fica como um chip ao lado do botão de reprodução.
- O timer de sono pausa o audio automaticamente depois do tempo escolhido.
- A navegação usa ícones Lucide vendorizados.
- O app pode ser instalado como PWA via `manifest.webmanifest` e `service-worker.js`.

Tudo fica local no navegador, em IndexedDB. O app usa cópias vendorizadas de `JSZip`, `Tailwind CSS` e `Lucide`.
O visual é construído com Tailwind CSS local, sem depender de CDN em runtime.

## Publicar no GitHub Pages

O repositorio pode ser publicado diretamente, sem build.

```bash
git init
git add .
git commit -m "Initial LeMais PWA"
git branch -M main
git remote add origin git@github.com:SEU_USUARIO/lemais.git
git push -u origin main
```

No GitHub:

1. Abra `Settings > Pages`.
2. Em `Build and deployment`, escolha `Deploy from a branch`.
3. Selecione `main` e `/root`.
4. Salve.

Depois de alguns minutos, a URL ficara parecida com:

```text
https://SEU_USUARIO.github.io/lemais/
```

## Publicar na Hostinger

Envie estes arquivos e pastas para o `public_html` do dominio/subdominio:

```text
index.html
app.js
styles.css
manifest.webmanifest
service-worker.js
.nojekyll
icons/
vendor/
```

Ative HTTPS/SSL no painel da Hostinger. O PWA precisa de HTTPS fora de `localhost`.

## Gerar icones novamente

```bash
node scripts/generate-icons.js
```

Isso recria:

```text
icons/apple-touch-icon.png
icons/icon-192.png
icons/icon-512.png
icons/maskable-512.png
```
