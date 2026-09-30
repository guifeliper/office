# Alvo v4 — ilha compacta

Contrato de composição. A imagem alvo (`image-86243c10`, 1024×760) foi normalizada no mundo 64×64 com `col = x / 1024 × 64` e `row = y / 760 × 64`. O norte é a fileira 0.

Cada peça cita o arquivo do Tiny Farm e o retângulo em pixels, ou `MISSING`. Nada aqui é desenhado à mão. Recortes saem de `scripts/cut-courtyard.ts` para `.cache/tiny-farm/`.

O chão não muda de regra: grama de verão, autotile escuro por cima do claro, penhasco só das colunas 0–11 da folha de cliff (face sul), barranco de grama sobre a água, pé de onda só sobre água, decalques na densidade B, sem aresta órfã, sem prop em cima de prop.

## Silhueta

Ilha arredondada, água nos quatro lados, ilhotas nos cantos.

| Peça | Células | Arte |
| --- | --- | --- |
| Ilha | centro (32, 33), raios 22 × 21 | elipse + duas passadas de suavização |
| Lóbulo leste (Fishman) | elipse (52, 42) raios 7 × 5.5 | terra, não penhasco |
| Baías | (16, 54) r 3 e (48, 55) r 2.6 | água, para a praia não virar retângulo |
| Ilhotas | (2, 8), (4, 50), (58, 6), (58, 54), (60, 26) | 3×2 + `Objects/Props/Spring/Stones.png` 6,4 25×19 |
| Costa que não é o norte | barranco de grama + pedras | a folha de cliff não abre leste, oeste nem norte |

## Norte — platô, queda, lago

| Peça | Células | Arte |
| --- | --- | --- |
| Platô | elipse (32, 13) raios 13 × 4 | grama escura no topo |
| Face sul | fileira 16, colunas 26–40, vão 30–33 | `Tileset/Tileset Grass Cliff Tileset Summer.png`, colunas 0–11 (terra, não o arco 12–16) |
| Lago | fileiras 16–19, colunas 26–40, afunila para o sul | `Tileset/Water tile.png` |
| Queda | âncora (30, 18), 4×3 tiles | `Tileset/Summer Waterfall.png` 0,64 64×48 |
| Lírios | (27, 19), (28, 19), (36, 19), (37, 19) | `Objects/Props/Spring/props water.png` 0,34 16×16 |
| Pinheiros do topo | (24, 13), (36, 13), (20, 15), (42, 16) | ver Árvores |

O penhasco só existe onde há água ao sul. Por isso a face é a largura do lago, não um anel em volta da ilha. O resto da costa norte leva pedra (`Stones.png`) e barranco.

## Centro — casa laranja

A casa abre a Cabana Norte. A chegada continua portão sul → porta → cabana.

| Peça | Células | Arte |
| --- | --- | --- |
| Casa | shell 30–33 × 27–32, porta na coluna 32 | `Objects/Exterior/Houses/10.png` inteiro (72×95 depois do corte justo) |
| Floreiras e lanternas da fachada | dentro do sprite da casa | mesmo arquivo. Não há sprite solto de floreira |
| Caixa de correio | (29, porta) | `Objects/Exterior/Mailbox.png` 0,14 16×18 |
| Postes do caminho | (28, 34), (35, 33), (41, 36), (47, 40) | `Objects/Exterior/Street Lamp 2.png` 0,1 16×37 |

## Oeste — estufa e canteiros

| Peça | Células | Arte |
| --- | --- | --- |
| Estufa | (10, 40), 4 tiles | `Objects/Exterior/Houses/Farm Buildings/Greenhouse/Greenhouse.png` 15,7 60×81 |
| Quatro canteiros | (14, 36), (18, 36), (14, 40), (18, 40) | solo `Tileset/Tilled Soil and wet soil.png` (9, 1) + planta `Crops/Spring/Spring Crops.png` 96,240 16×16 |
| Cerca | fileiras 34 e 42, colunas 14–21 | `Objects/Exterior/Fence and Bridge/Fence Wood.png` 64,0 32×14 |

`MISSING`: trilho vertical. A folha só entra com o trilho deitado. A cerca do alvo é uma linha, não um curral fechado.

## Noroeste — casinha, manta, varal, banco

| Peça | Células | Arte |
| --- | --- | --- |
| Casinha vermelha | (18, 24) | `Objects/Exterior/Houses/dog house.png` 7,2 34×42 (a casinha vermelha da folha) |
| Manta xadrez | (22, 25) | `Objects/Exterior/Picnic.png` 2,2 44×44 (o quadrado vermelho e branco) |
| Varal | (25, 28) | `Objects/Exterior/Village Clotheslines.png` 6,10 36×20 |
| Banco | (20, 31) | `Objects/Exterior/Beach/Wooden Bench.png` 36,7 24×18 |
| Machado, lenha, fogueira | (12, 28), (15, 28), (13, 30) | `Pine Tree.png` 203,37 10×10; `Objects/Props/wood.png` 32,1 16×14; `Objects/Exterior/Mine and Dungeon/bonfire.png` frame 0 |

A fogueira não está no desenho. Fica no claro a oeste porque o lazer (machado e lenha) continua no contrato do jogo. O celeiro grande (`Barn/Barn.png`) não entra: a casinha vermelha é a peça do desenho.

## Leste da casa — banca

| Peça | Células | Arte |
| --- | --- | --- |
| Banca | (43, 37) | `MISSING` a banca de lona listrada vermelha e branca. No lugar: `Objects/Exterior/Newsstand.png` 0,0 32×48, a banca de vendedor do pack |

`ice cream cart.png` e `Cotton candy cart.png` têm toldo, mas são carrinhos rosa. A newsstand é a peça de banca.

## Leste — Fishman

| Peça | Células | Arte |
| --- | --- | --- |
| Casa | (49, 44), 5 tiles | `Objects/Exterior/Houses/NPCS houses/Fishman/Fishman house.png` 0,0 80×112 (a metade esquerda, branca, com a boia) |
| Barris | (47, 46), (55, 45) | `Objects/Exterior/Beach/Fish Barrel.png` 9,8 15×18 |
| Palmeira | (48, 36), em terra | o par inteiro, 72×35 |

## Sul — costa de grama, píer, barco

O desenho do TARGET tem areia. O Guilherme pediu o contrário: grama até a água, com o bank do pack (lábio marrom). Sem areia e sem o portão visual ao lado do barco. A chegada continua nas colunas 31–32, como células, sem posts nem lintel.

| Peça | Células | Arte |
| --- | --- | --- |
| Costa | grama até a água | bank do pack; areia não é pintada |
| Píer | (31, south+1), 3 tiles | `Bridge Beach.png` 0,96 48×14, as tábuas fechadas |
| Barco | (31, south+1), amarrado no píer | `wood canoe.png` 1,2 29×43, o casco inteiro |
| Palmeira | (22, south-2) | par de coqueiros com rede, 72×35 |
| Vitória-régia e juncos | água rasa, fora do píer | `props water.png` |
| Pedras | borda da terra | rock e shoreRock |

`MISSING` como sprite único: o píer estreito com estacas e corrente. A doca larga (128×74) traz grama junto; ficam as tábuas de 48×14. `Wood Boat.png` tem barcos de 152×98; a canoa é o barco.

## Caminhos

Terra, `Tileset` de grama, fileiras 8–11, autotile claro. Segmentos:

1. Píer → encruzilhada: (32, 62) → (34, 48) → (32, 40)
2. Encruzilhada → porta: (32, 40) → (32, 33)
3. Porta → lago, contornando a casa: (32, 33) → (27, 30) → (30, 22) → (32, 20)
4. Casa → casinha: (28, 32) → (22, 26) → (19, 23)
5. Casa → horta → estufa: (30, 36) → (20, 34) → (14, 38) → (12, 40)
6. Casa → banca → Fishman: (34, 34) → (40, 35) → (44, 37) → (50, 42)

Praça de terra em (32, 39), raio 2.2.

## Árvores e flores

| Peça | Onde | Arte |
| --- | --- | --- |
| Copa redonda | ~28 no bordo, anéis 0.86 / 0.74 / 0.62 | `Objects/Tree/Common/No Shadow/Maple Tree.png` copas 0,49 / 32,49 / 128,49 de 32×27; tronco 0,76 32×18 |
| Pinheiro | platô e bordas listados no yaml | `MISSING` o pinheiro grande de verão. A folha tem o verde pequeno em `Pine Tree.png` 68,14 23×32. O grande em 96,2 é neve; 162,4 é seco. Os dois ficam de fora |
| Fruta | (16, 20), (44, 24), (46, 32), (18, 44) | `Crops/Fruits Tree/Summer/Orange Tree - no shadow.png` 128,1 32×44 |
| Flor de cerejeira | (8, 32) e (40, 22) | `Crops/Fruits Tree/Spring/Cherry Tree.png` 96,1 32×45 |
| Palmeira | praia e leste do Fishman | `Objects/Exterior/Beach/Coconut Tree.png` 4,9 28×36 (a palmeira esquerda, antes da rede). A folha não tem palmeira solta |
| Arbusto | 24–32, oito na água | `Objects/Tree/Deep Forest/bushes.png` 32,4 32×22 e 64,0 25×31 |
| Girassol e cogumelo | um acento na maioria dos blocos 5×5 | `Crops/Summer/Sunflower.png` 81,5 15×26; `Fantasy Mushroom.png` 40,20 15×24 |
| Borboleta | até 5, afastadas | `Animals/Forest/Bugs/Butterfly/Monarch Butterfly.png` |

`MISSING`: manchas de flor branca e rosa como sprite de chão. O campo usa girassol. O rosa do desenho é a cerejeira.

Morango não entra no chão.
