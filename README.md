# Urologger

Aplicativo web que lê o volume, a coloração e o débito urinário a partir de uma
foto do coletor rígido. Roda inteiramente no navegador, sem servidor, sem
backend e sem serviço externo: os dados ficam apenas no aparelho, em
`localStorage`, e o próprio OCR está dentro do repositório.

## Como funciona a leitura

A medida sai de três evidências independentes, na ordem em que o pipeline as
obtém:

1. **Bordas do coletor.** Projeções de gradiente localizam a caixa do
   recipiente no quadro.
2. **Traços da escala.** A impressão é procurada por contraste local em
   qualquer polaridade — tinta escura sobre fundo claro, clara sobre escuro ou
   colorida — e o conjunto é filtrado pela periodicidade: só sobra o maior
   subconjunto compatível com um passo constante. O passo em pixels equivale
   exatamente ao intervalo em mL declarado no cadastro do coletor.
3. **Números impressos.** O OCR (Tesseract, servido deste repositório) confirma
   a âncora absoluta da escala. Dois números coerentes e suficientemente
   distantes já bastam.
4. **Nível hidroaéreo.** A interface ar-líquido é procurada por consenso de
   contraste em três faixas horizontais independentes; ao menos duas precisam
   concordar.

O volume é sempre arredondado para baixo, para o traço inferior da escala.

### Graus de confiança

| Grau | O que sustentou a leitura |
|---|---|
| **alta** | traços regulares + números confirmados por OCR + menisco em ≥2 faixas |
| **média** | traços regulares + menisco, ancorados no fundo do coletor e conferidos contra a altura total |
| **baixa** | apenas bordas do coletor + menisco (regra de 3 na altura) |

O valor proposto aparece num campo editável. **O que é salvo é o que a pessoa
confirma** — o aplicativo propõe, não decide.

## Crivo de qualidade da imagem

Antes de medir: variância do laplaciano (nitidez), histograma (sub e
superexposição) e inclinação dos próprios traços, com limite de 3° em relação
à horizontal.

## Débito urinário

A diurese de cada registro é o que foi produzido desde a medida anterior: o
próprio volume se o coletor foi esvaziado na medida anterior, ou a diferença
entre os volumes se não foi. O débito é essa diurese dividida pelo peso e pelo
intervalo, em mL/kg/h. A curva marca a linha de 0,5 mL/kg/h.

## Estrutura

```text
index.html                 interface e todo o processamento de imagem
service-worker.js          cache offline
manifest.json              instalação como aplicativo
icon-192.png  icon-512.png  icon-512-maskable.png
vendor/tesseract/          OCR local (Tesseract.js, Apache-2.0)
  tesseract.min.js  worker.min.js
  core/                    núcleo WebAssembly
  lang/eng.traineddata.gz  modelo de dígitos
```

## Publicação

Repositório público, **Settings → Pages → Branch `main`, pasta `/ (root)`**.
Nada mais precisa ser configurado; não há passo de build.

O primeiro acesso baixa cerca de 11 MB (o OCR). A partir daí o service worker
serve tudo do cache e o aplicativo funciona sem rede, inclusive o OCR. Para
instalar no celular: abrir no navegador e escolher "Adicionar à tela inicial".

Se o aparelho não tiver suporte a WebAssembly SIMD, o OCR fica indisponível e
a leitura cai para o grau **média**, que não depende dele.

## Privacidade

Nenhuma imagem e nenhum dado sai do aparelho. Não há requisição de rede depois
do carregamento. Limpar os dados do navegador apaga o histórico — exporte o CSV
antes.

## Aviso

Ferramenta de apoio ao cuidado domiciliar. Não substitui avaliação clínica nem
medição volumétrica direta quando a decisão terapêutica depender do valor.

## Licença

Código sob a licença do arquivo `LICENSE`. O Tesseract.js e os dados de idioma
em `vendor/` são Apache-2.0, com as licenças originais preservadas.
