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
| **manual** | a leitura automática não saiu; o volume foi digitado |

O valor proposto aparece num campo editável. **O que é salvo é o que a pessoa
confirma** — o aplicativo propõe, não decide. O número digitado é gravado
exatamente como digitado, sem arredondar para a escala.

### Quando a leitura automática não sai

Nenhuma foto é descartada. Abre-se sozinha uma **caixa de diálogo de registro
manual**, já preenchida com o que a foto entregou — data e hora da aquisição,
aparelho, coloração estimada — deixando só o volume para você. O registro
entra no histórico como qualquer outro, marcado como **manual**, e conta para
o débito. Dentro dela fica o diagnóstico do que falhou: nitidez medida,
proporção do coletor no quadro, traços encontrados, números lidos pelo OCR e
faixas em que o nível foi confirmado.

### Por que a leitura automática às vezes não sai — de propósito

A escada de traços dá o passo da escala, não a âncora absoluta. Ancorá-la no
fundo do coletor só vale quando o fundo do coletor é o fundo do quadro; numa
bolsa pendurada com chão e móvel atrás, a caixa detectada não é o recipiente, e
a conferência pela proporção de altura — que usa **a mesma caixa** — concorda
com o erro em vez de denunciá-lo. Duas estimativas que compartilham a premissa
falsa não são duas estimativas.

Por isso a única âncora independente são os números impressos: a reta
`volume(y)` é ajustada sobre as posições em pixel onde o OCR os leu. Só há
leitura automática quando essa reta e a escada de traços concordam dentro de um
intervalo da escala. Sem concordância, o aplicativo **não arrisca um número**:
abre o registro manual e mostra as estimativas apenas como referência, cada uma
identificada pela sua origem. Numa medida de diurese, um valor plausível e
errado é pior que nenhum — subestimar volume esconde oligúria.

Em bolsa flexível fotografada à mão isso acontece com frequência. O caminho da
leitura confiável é o coletor rígido em suporte padronizado, com a escala
inteira e nítida no quadro.

### Como o nível é localizado

Seis faixas verticais estreitas à direita dos traços procuram, cada uma por si,
a transição claro→escuro com reforço de amarelo. O que decide não é a
intensidade: é a **concordância**. Um nível de líquido é horizontal e aparece
na mesma altura em várias faixas; uma torneira, uma etiqueta ou o vinco da
bolsa aparecem só na sua. Vence o maior aglomerado de faixas que apontam a
mesma altura — empate se decide pela largura coberta e depois pela pontuação.

Duas correções desta versão nasceram de uma foto real de bolsa B|BRAUN que era
reprovada com o nível perfeitamente visível: a área de busca do nível não pode
ser derivada da janela do OCR (que é larga de propósito, e sobrava só a tira da
extrema direita, onde ficam marca, selo CE e pictogramas); e o consenso não
pode ser por mediana, porque os artefatos pontuam mais alto que a interface
ar-líquido e arrastavam a mediana para uma altura onde ninguém concordava.

### Data e hora: os metadados da foto são aproveitados

Mesmo quando a leitura automática não sai, a foto continua valendo como
documento. O que ela carrega é aproveitado — **só o volume é digitado**:

| Do que vem | Como |
|---|---|
| data e hora | `DateTimeOriginal` do EXIF; se faltar, o padrão `AAAAMMDD_HHMM` do nome do arquivo; se faltar, a data do arquivo |
| aparelho | `Make` e `Model` do EXIF, gravados no registro e no CSV |
| coloração | estimada do terço inferior do coletor na própria imagem |

A origem do horário fica declarada na tela e no CSV, e o campo continua
editável. Isso importa porque EXIF não sobrevive a WhatsApp nem a cópia entre
aparelhos: quando o horário vem da data do arquivo em vez do EXIF, ele pode ser
o da cópia, e uma data errada contamina o débito, que depende do intervalo
entre medidas. Declarar a procedência deixa isso visível em vez de silencioso.
Foto HEIC (iPhone) não traz EXIF legível aqui e cai para o nome do arquivo.

O botão **Registrar sem foto** é o único caso sem metadado: usa o horário
atual, também editável.

## Crivo de qualidade da imagem

Antes de medir: variância do laplaciano (nitidez), histograma (sub e
superexposição) e inclinação dos próprios traços, com limite de 3° em relação
à horizontal. Reprovar em qualquer um desses critérios não descarta a foto —
leva ao modo manual, com o motivo declarado.

## Débito urinário

O débito é calculado igual para registros automáticos e manuais.

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

## Selo de integridade

O distintivo no alto da tela começa como **"v7.4 — carregando…"** e só vira
**"v7.4 ✓"** na última instrução do arquivo. Se ele não mudar, o `index.html`
que chegou ao servidor está incompleto — cortado no envio — e nenhum botão vai
responder. É a primeira coisa a conferir quando o aplicativo parece morto.

Qualquer erro em tempo de execução também aparece numa caixa vermelha na área
de mensagens, em vez de deixar os botões mudos.

A tela de instruções é um overlay comum, não o elemento `<dialog>`: se ela
falhar por qualquer motivo, a captura acontece do mesmo jeito. E o campo de
arquivo é zerado antes de cada abertura, para que escolher a mesma foto duas
vezes seguidas continue disparando o processamento.

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
