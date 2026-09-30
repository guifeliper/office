# Interior do lodge — o que o Tiny Farm tem

Verificação em 29 set 2026. Só o pack pago, lido no disco. Nenhum PNG foi copiado para o repositório.

Raiz:

`Farm RPG - Tiny Asset Pack - (All in One)/`

Arquivo local, fora do git. O pack FREE não foi aberto.

Folha de contato (também fora do git):

`/Users/guilhermereis/Library/Application Support/cursor-office-assets/tiny-farm/_inventory/interior-contact.png`

1100×4596. Recortes em escala 2× ou 4×, sem os pixels no git.

Tile base do pack: 16×16. Personagem: célula 32×32.

## Resumo

| Peça | Estado | Onde |
| --- | --- | --- |
| Piso e parede de interior | Existe | `Tileset/Tileset House.png` 832×384 |
| Tapete | Existe | `Tileset/carpet.png` 224×192 |
| Porta para clicar | Parcial | Porta externa estática. Sem animação de abrir |
| Janela e cortina | Existe | Folha de cortinas + janelas no tileset da casa |
| Lareira | Existe | `Objects/Interior/Fireplace.png` 256×256. Chama desenhada; ciclo curto só em alguns pares |
| Mesa longa | Existe | Slot 64×32, desenho ~51×21. Larga demais para 1 cadeira |
| Mesa pequena / banquinho | Existe | Fundo da mesma folha, ~22×22 e ~31×30 |
| Cadeira, 4 faces | Existe | `Objects/Interior/Chairs.png` 304×224. 1 frame por face |
| Computador | Parcial | `Objects/Interior/Part 2 copiar.png` 256×144. Modelos estáticos. Sem tela on/off/digitando |
| Estante | Existe | `Closet.png`, `School.png`, `Others.png` |
| Tapete, planta, abajur, caneca | Existe | Tapete na folha de carpete; o resto em `Part 1 copiar.png` e velas |
| Cama e sofá | Existe | 4 faces não. Frente e lado |
| Cozinha | Existe | `Part 9 copiar.png` 688×112 |
| Gato e cachorro | Existe | Folhas 32×32, 4 colunas |
| Sentar, 4 faces | Existe | 1 frame. Encaixa na cadeira norte com x −8 |
| Ler ou segurar caneca | Falta | Não há animação |
| Dormir | Existe | 6 frames na tira de camadas. Não é 4 faces |
| Layout de 12 mesas | Falta | Montar. A sala cabe em ~16×18 tiles |

## Piso, parede, porta, janela

`Tileset/Tileset House.png` — 832×384, grade 52×24 de tiles 16×16. Uma peça só, opaca. Não é animada.

- Fileiras 0–3: telhado, amostra de piso (madeira, tijolo, xadrez) e parede clara.
- Fileiras 4–23: faixas de parede de interior, com janela no meio. A faixa se repete em blocos de cerca de 4 tiles (64 px) por cor: madeira, branco, rosa, verde, azul, laranja.

Essa parede de ~64 px é mais alta que o corpo sentado (17 px) e que o corpo em pé (~20 px). É a vista de quem já está dentro da sala.

`Tileset/Path tiles.png` — 384×256, 24×16 tiles. Tijolo e pedra de chão externo. Não é o piso de madeira do lodge.

`Tileset/carpet.png` — 224×192. Três tapetes (vermelho, azul, roxo), cada um com miolo de 64×64 e tiras de borda 8 px. Estático. 1 face (visto de cima).

`Objects/Interior/Doors, windows and curtains.png` — 256×256. Estático.

- 4 varões, largura da folha, altura 17–21.
- Cortinas estreitas: 10×24, duas fileiras de 10.
- Cortinas abertas: 33×24, duas fileiras de 5.

Não há porta de interior que abre.

`Objects/Exterior/Houses/Door, windows, and chimney/Door.png` — 144×32. Três variantes de 48×32. Desenho opaco 48×23. As três diferem no desenho inteiro, não é um ciclo abrir/fechar.

`Double doors.png` — 128×64. `Broken door.png` — 48×48.

Janelas de fachada, estáticas, 1 face:

| Arquivo | Folha |
| --- | --- |
| `Windows/Window1.png` … `Window12.png` | 96×16 |
| `Window13.png`, `Window14.png` | 96×32 |
| `Window15.png` … `Window35.png` | 192×32 |

As janelas que entram na parede de interior estão no `Tileset House.png`, não nesses arquivos de fachada.

## Lareira e fogo

`Objects/Interior/Fireplace.png` — 256×256.

Primeira fileira, células de 32×48, 8 peças. Desenho entre 26×40 e 28×42.

- Colunas 3 e 4: mesma silhueta. Só a cor muda (330 px). 2 frames da mesma peça.
- Colunas 5, 6 e 7: mesma silhueta. Só a cor muda. 3 frames.
- Colunas 0–2 e o salto 4→5: a silhueta muda. São outros modelos, com chama desenhada.

Abaixo há lareiras maiores (faixa y 65–158, peças de até 189×94) e enfeite de natal (y 161–255). Sem índice de frame no nome do arquivo.

Fogo com ciclo limpo, forma idêntica entre frames:

| Arquivo | Folha | Frames | Desenho |
| --- | --- | --- | --- |
| `Objects/Interior/candle.png` | 64×16 | 4 × 16×16 | ~8×13. Chama muda 3–6 px |
| `Candle 1.png`, `Candle 2.png`, `Candle 5.png` | 64×32 | 4 × 16×32 | ~16×19 |
| `Candle 3.png`, `candle 4.png`, `Candle 6.png` | 64×32 | 4 × 16×32 | chama menor |
| `Objects/Work Benches/Furnace.png` | 160×32 | 5 × 32×32 | 18×28. 28–47 px de cor, forma igual |

A fornalha é forja, não lareira de sala. Serve como referência de fogo animado. A lareira de sala existe; o ciclo curto só vale para os pares da primeira fileira que compartilham a silhueta.

`Objects/Props/Smoke.png` — 288×64. Fumaça solta, não a lareira.

## Mesas, cadeiras, computadores

`Objects/Interior/Tables and desks.png` — 512×384. Estático.

- 7 fileiras de cor (y de 32 em 32). Cada uma: 6 mesas em slot de 64×32, desenho ~51×21, mais 1 mesa dupla em slot de 128×32.
- Fundo da folha (y ~225–382): mesas redondas ~22×22, peças ~31×30 e ~63×30, banquinhos. 1 face, 3/4.

A mesa de 51 px ocupa o slot de 4 tiles. A cadeira tem 16 px de largura. Uma mesa longa não é um posto de 1 pessoa.

`Objects/Interior/Chairs.png` — 304×224. Grade 19×7 de células 16×32. Estático. 1 frame por face.

Cada cor ocupa 4 colunas: sul, norte, leste, oeste. Leste e oeste são espelho (mesma contagem de pixels). Fileiras 4–6 têm células vazias. Há várias cores; a primeira fileira mede:

| Face | Coluna | Caixa na célula 16×32 | Assento | Pés |
| --- | --- | --- | --- | --- |
| Sul | 0 | x=2, y=10, 13×21 | y 19–25 | y 28–30 |
| Norte | 1 | x=2, y=12, 13×19 | y 21–25 | y 28–30 |
| Leste | 2 | x=2, y=11, 11×20. Poste à esquerda | y 16–25 | y 28–30 |
| Oeste | 3 | espelho do leste | igual | y 28–30 |

O fundo da cadeira é y=30. A célula tem 32 px. Sobra 1 px abaixo do pé.

`Objects/Interior/Part 2 copiar.png` — 256×144. Computadores. Estático. Sem ciclo de tela ligada, desligada ou digitando. As fileiras são modelos diferentes (centenas de pixels diferentes), não frames da mesma tela.

| Faixa y | Peças | Largura opaca |
| --- | --- | --- |
| 6–30 | 6 | 24, 24, 22, 25, 48, 48 |
| 40–62 | 6 | igual à de cima, outra cor |
| 66–94 | 7 | 12, 12, 16, 22, 25, 48, 48 |
| 96–142 | 7 | 31×47 e monitores de ~22–25 |

O monitor simples cabe numa célula de 32 px. O desenho desce até y≈29–30: é um sprite de chão (monitor + teclado), não um ícone em cima do tampo. O conjunto largo de 48 px é dois monitores.

Não há arquivo com nome computer, monitor, laptop ou screen em outro lugar do pack.

## Estante, planta, luz, cama, sofá, cozinha, bicho

`Objects/Interior/Closet.png` — 672×576. Grade 32 px, 21×18. Armários e estantes com livros, frente e lado, várias cores. Estático. A estante de livros está nessa folha.

`Objects/Interior/Dressers.png` — 256×160. Cômodas. Peças ~48×16–18 e gavetas ~27×12–14. Estático. 1 face.

`Objects/Interior/Others.png` — 144×112. Três janelas altas 14×25, duas estantes ~30×34, três teclados 29×18–20. Estático.

`Objects/Interior/School.png` — 400×256. Mesas de escola, cadeiras, estantes, dois vasos, lousa, pia. Estático. As peças se encostam; a folha inteira é a medida segura.

`Objects/Interior/Part 1 copiar.png` — 272×192. Abajur, planta, relógio, caneca, bolo, moldura. Props soltos, estáticos, a maioria menor que 16×22. Sem grade nomeada.

`Objects/Interior/Part 9 copiar.png` — 688×112. Quatro cozinhas (pia, fogão, geladeira), altura de balcão até ~76 px. Estático. Frente.

`Objects/Interior/Part 10 copiar.png` — 256×192. Banheiro (vaso, pia, box). Não é o escritório.

`Objects/Interior/Part 11 copiar.png` — 304×224. Retalhos de tecido e tapete pequeno. Estático.

`Objects/Interior/Beds.png` — 384×512. Estático.

- Solteiro, de cima: 18×34, 12 por fileira, 3 fileiras de cor.
- Solteiro de lado: 32×24, 6 por fileira, 3 fileiras.
- Casal, de cima: 33×34, 8 por fileira.
- Casal de lado: 32×37–38.

Frente e lado. Não são 4 faces.

`Objects/Interior/Sofa and armchair.png` — 320×192. Estático.

- Sofá de frente: 29×18–20, 10 por fileira, 2 cores de fileira.
- Sofá de lado: 13×29.
- Poltrona: 17×18–20 e 13×20.

Frente e lado.

`Objects/Interior/cats furniture.png` — 400×128. Arranhador, cama de gato, pote. Peças ~17×11 a 22×31. Estático.

`Objects/Work Benches/Kitchen pot.png` — 160×32. Panela, 5 slots de 32. Não é ciclo limpo (a forma muda).

`Objects/Work Benches/Workbench.png` — 32×32. Bancada 16×18. Estático.

Gato: `Animals/Pets/Cats/`. 20 folhas de 128×416 (4×13 células de 32×32) e `Box.png` 32×32. Cores em `Cats/1/` (Black, Brown, Ginger, Gray, Light Brown, Light Gray, Pink, White) e outros corpos em `Cats/2` … `Cats/7`.

Cachorro: `Animals/Pets/Dogs/`. 16 folhas de 128×416 e 15 de 128×384 (4×12). Vários corpos em `Dogs/1` … `Dogs/9`.

As 4 colunas de cada linha diferem. É animação (andar, sentar, deitar), não um frame único. A última linha do gato `Cats/1/Black.png` é a caixa, não o bicho. Sem nome de frame no arquivo: a linha é a animação, a coluna é o passo.

Ícones, não sprite de mundo:

- `Icons/Food Icons/Coffee cup.png` — 32×16
- `Icons/RPG icons/Extras/Books.png` — 240×64
- `UI/Inventory/Book.png` — 256×288

## Personagem dentro da sala

Ordem da tira, já medida no mapa de integração: sul, norte, leste, oeste. Célula 32×32.

### Sentar

`Character/Character/PNG/18. Setting/` — cada camada 128×32. 4 faces × 1 frame. Não é ciclo.

Camadas: `Skins/1.png` … `4.png`, `Clothers/Farm/` (Blue, Green, Pink, Purple, Red), `Hair's/` (Josh, Lyria, Standard, e outros), `Eyes/`.

O pronto (`Pre-made/Josh/Sitting.png` e os outros quatro) é 96×32: 3 faces. Oeste só por espelho. Usar a tira.

Composite medido: pele `Skins/1` + roupa Farm azul + cabelo Josh marrom + olhos masculinos castanhos.

| Face | Caixa na célula | Fundo do corpo |
| --- | --- | --- |
| Sul | x=10, y=6, 12×19 | y=24 |
| Norte | x=11, y=6, 12×17 | y=22 |
| Leste | x=11, y=6, 12×17 | y=22 |
| Oeste | x=10, y=6, 12×17 | y=22 |

O norte não tem perna abaixo de y=22. A cabeça ocupa y=6–12. O quadril ocupa y=17–22.

### Encaixe na cadeira norte

Cadeira norte (coluna 1): centro em x=8 da célula de 16. Personagem norte: centro em x=16,5 da célula de 32.

Os dois já nascem no centro da própria célula. Para coincidir: origem do frame 32 = origem da cadeira **−8 px**. Depois disso o erro horizontal é 0. O corpo tem 12 px; a cadeira tem 13.

Vertical, com o fundo das duas células de 32 na mesma linha de chão:

- Cabeça em y=6. Encosto norte começa em y=12. A cabeça fica 6 px acima do encosto.
- O corpo termina em y=22. O assento da cadeira é y=21–25. O quadril cai dentro do assento.
- Os pés da cadeira ficam em y=28–30, 8 px abaixo do corpo, à vista.

Não precisa de empurrão em y. O norte sentado alinha com a cadeira norte do pack.

A mesa de 51 px não alinha com essa cadeira: ela ocupa 4 tiles e é mesa compartilhada. O computador de `Part 2` (~24×22, fundo em y≈30) é sprite de chão. Fica no tile ao norte da cadeira, não em cima da mesa longa.

### Dormir, ler, caneca

`Character/Character/PNG/19. Sleep/` — camadas 192×32. 6 frames de 32. Não é 4 faces.

Na pele `Skins/1.png`:

| Frames | Caixa | O que é |
| --- | --- | --- |
| 0–1 | ~13×10 em y=7 | um pose, 2 frames (diff ~24 px) |
| 2–3 | ~9×12 em y=12 | outro pose |
| 4–5 | espelho de 2–3 | o mesmo pose para o outro lado |

O pronto `Pre-made/Josh/Sleep.png` (e Alex, Manu, Tori) é 64×32, 2 frames. `Pre-made/Lyria/sleep.png` é 64×32, nome em minúsculo.

Não existe pasta de leitura, de livro na mão, nem de caneca. Caneca é prop em `Part 1 copiar.png` e ícone `Coffee cup.png`. Carregar (`13. Carrying - Idle`, pele 512×32, 4 faces × 4 frames) é braço ocupado com item genérico, não uma caneca desenhada.

Para ocioso dentro da sala o pack oferece: sentar (a mesa), dormir (a cama), e o gato. Não oferece ler nem beber.

### Flauta

`Character/Character/PNG/22. Flute/` mede 576×32. 576 / 32 = 18 frames. 18 não divide por 4, então a tira não é sul / norte / leste / oeste. São três grupos de 6 frames; a quarta face não está na pasta. Oeste não é espelhado. Os olhos dessa pasta são só `Green.png` — `resolveLayer` cobriria a cor, mas o recorte das faces é o motivo de não entrar no cast.

Dormir (`19. Sleep`) também não tem quatro faces (192×32, 6 frames) e não tem pasta `Clothers`. Os frames são só cabeça e mãos: foram desenhados para ficar sob o cobertor de uma cama. A cabana não tem cama, então o cochilo é a pose sentada virada para o sul na poltrona, com o balão "=_=" de `UI/speech bubble, emojis, reaction.png` (célula 32,128).

Carregar (`13.*`) também não traz o objeto na mão. A tora carregada é o tronco solto de `Objects/Tree/TREE TRUNKS copiar.png`. A pilha do pátio é a pilha de três troncos da mesma folha. `Objects/Props/wood.png` é um tronco boiando na água e não entra no chão.

## O que continua custom

- Tela do monitor em três estados: ligada, desligada, digitando. O pack tem o gabinete e um desenho fixo na tela.
- Ciclo de lareira para um modelo só, se o par de 2 ou 3 frames da primeira fileira não bastar. A peça existe.
- Porta abrindo. A porta externa é variante estática. Abrir a sala é troca de cena, não sprite.
- Planta de 12 postos. Não há sala pronta.
- Cadeira de escritório com rodinha em 4 faces já existe na folha de cadeiras (há modelos escuros de rodinha nas fileiras de cima). Não falta a cadeira. Falta a tela do computador.

## Escala da sala de 12

O lodge de fora, hoje, é 20×16 tiles (`LODGE` 49–68 × 9–24), com 12 mesas em pitch de 4 tiles e vão de 2 tiles (`DESK_COLS` 51, 55, 59, 63 e `DESK_ROWS` 12, 16, 20).

| Posto | Cabe no pitch atual de 4×4 |
| --- | --- |
| Monitor de `Part 2`, ~24 px (2 tiles) | Sim |
| Mesa longa, slot 64×32 (4×2 tiles) | Não sobra corredor. A mesa come o pitch inteiro |

Sala legível para 12 postos com o monitor pequeno, tile 16:

- 4 colunas × 3 fileiras.
- Cada posto: 3 tiles de largura (mesa 2 + vão 1) e 4 de profundidade (mesa 2 + cadeira 1 + corredor 1).
- Chão: 12×12.
- Parede do fundo: 3 ou 4 tiles (a faixa do tileset tem ~4 tiles, 64 px).
- Sala inteira: cerca de **16×18 tiles**.

Em 2× isso é ~512×576 px. Dá para ler numa janela. Em 3× fica confortável.

Doze mesas longas de 64 px pediriam pitch de 5 tiles e uma sala perto de 24×20. Não é o poste de uma pessoa.

## Sala separada, não telhado cortado

O pack empurra a sala separada.

- As casas de fora (`Objects/Exterior/Houses/1.png` 128×112, e as outras) são chalés fechados, com telhado. Não há versão sem telhado.
- A parede de interior tem ~64 px. O personagem sentado tem 17 px. Essa proporção é a de quem está dentro, olhando a parede do fundo.
- O lodge de fora, hoje, usa parede de 2 tiles (32 px) para ver o interior por cima. A arte deste pack não foi desenhada para essa câmera.
- A porta de 48×32 é o botão. O clique troca de cena. A folha de interior não tem porta animada.

Um corte do telhado no mapa de fora usaria o piso e jogaria fora a altura da parede. A sala separada usa o tileset como ele foi montado.
