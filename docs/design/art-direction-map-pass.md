# Direção de arte — passe do mapa

Trava deste passe. Não redesenha o consultor. Não muda a planta.

Referências: `docs/design/cursor-office-map-sketch-v2.png` (planta e silhueta), `docs/design/cursor-office-props.png` (leitura dos objetos), piloto `docs/design/pilot/consultant-south.png` (densidade e escala). O sketch é layout. O piloto é o pixel.

Medido em 29 set 2026:

| Sprite | Canvas | Desenho opaco | Cores |
| --- | --- | --- | --- |
| `consultant-south.png` | 48×68 | 13×43 | **15** |
| `tree-canopy.png` | 49×46 | 49×46 | **1508** |
| `garden-bed.png` | 47×34 | 47×34 | **1364** |
| `gatehouse-lintel.png` | 73×45 | 73×45 | **1757** |
| `desk.png` | 33×35 | 33×35 | **681** |
| `fence.png` | 33×18 | 33×18 | **259** |
| `woodpile.png` | 18×17 | 18×17 | **199 / 199 px** |

Alpha dos props já é 0 ou 255. O defeito não é halo. É rampa contínua: quase cada pixel é uma cor nova.

---

## 1. Diagnóstico

O ao vivo (`office-props-live.png`) perde o sketch em quatro lugares concretos.

**Silhueta e clusters.** No piloto, a massa é bloco: camisa clara, calça escura, cabelo em 2 tons, contorno implícito por valor. Na copa atual, 1629 pixels opacos usam 1508 cores. Não existe cluster de 2×2 da mesma cor. No zoom 1× a árvore vira mancha; no 2× vira ruído. O mesmo vale para mesa (681), cerca (259) e lenha (1 cor por pixel). O sketch lê porque cada folha é um bloco de verde, cada tábua é um retângulo. O ao vivo não tem esse bloco.

**Chão chapado com salpico.** `ground.ts` pinta cada célula com 2 tons (`TONES`) e, na grama e no caminho, dois retângulos de 2×2 em posição hasheada (`drawDetail`). Isso é o oposto de variação de tile. A ilha inteira é `#5B8F4E` com sujeira. O caminho é uma fita `#F3E8D4` de ~3 células (`onPath`, raio 1.4) com corte reto contra a grama: sem borda, sem canto, sem seixo. A água é uma elipse `#4A7C9B` (`inPond`) com um risco de 6×1 em 1/4 das células. O piso do lodge é uma faixa de 1 px a cada 8 px. No sketch, o chão carrega o cozy: tufos, flores, margem de areia, pedra na beira da água, grama mais escura debaixo da copa. No ao vivo essa informação não existe.

**Contraste e luz.** O piloto é mais claro em cima (luminância ~186 na metade norte do desenho, ~140 na sul; esquerda 161, direita 158). A luz do personagem vem do norte, não da esquerda. Os props não repetem isso: a copa clareia no centro, a cerca é um degradê horizontal, a mesa mistura dezenas de marrons sem face norte clara e face sul escura. Sem dois valores separados por um degrau visível, a forma não segura em 1×.

**Escala e vazio.** O consultor desenha ~44 px (~2,75 tiles de 16). A copa atual tem 46 px de altura e 49 de largura: quase do tamanho do corpo, e são 16 árvores (`TREES`) numa elipse de 80×45. O sudeste, o vão entre a fogueira e a mesa, e a margem do lago ficam gramado liso. Não há arbusto nem flor como prop. A praça (`PLAZA` r 4.2) é caminho vazio. A cerca só no arco sul está certa; o norte sem massa de árvore parece recorte, não campo.

**Copa sempre na frente.** `prop-view.ts` manda o foreground para `foregroundDepth` (100000 + Y da base). Qualquer consultor, mesmo encostado no sul da árvore, fica debaixo da folha. Trocar o PNG não corrige isso.

---

## 2. Regras do chão

Tile 16×16. Nearest-neighbor. Escala inteira. Um tile = uma célula de `terrainAt`. Acabar com o salpico de 2×2 dentro da célula.

### Luz (trava)

Norte. No sprite e no tile, o lado de cima (menor Y) usa o tom claro; o lado de baixo usa o tom escuro. Sem luz da esquerda.

Sombra de contato: 1 px de altura, cor = tom escuro do material de baixo, não `#201B0F`.

### Contorno (trava)

1 px `#201B0F` só na silhueta externa do prop. Tile de chão não leva contorno ink, senão a ilha vira grade. Interior sem contorno. Alpha só 0 ou 255.

### Rampa fechada

Não inventar cor fora desta lista.

| Material | Claro | Base | Escuro | Fundo |
| --- | --- | --- | --- | --- |
| Grama | `#7AAA62` | `#5B8F4E` | `#3E6A38` | `#2A4A26` |
| Caminho | `#FFF8F1` | `#F3E8D4` | `#D9C4A4` | — |
| Água | `#7AABCA` | `#4A7C9B` | `#2F5874` | — |
| Pedra (margem) | `#D4CBC0` | `#A3988C` | `#5E564E` | — |
| Madeira | `#E6C49A` | `#C4925A` | `#8A5A30` | `#4A3018` |
| Ouro (flor) | — | `#D4A04A` | — | — |
| Ink | — | `#201B0F` | — | — |

Cores por material, contando só o que aparece no tile:

| Tile | Máximo |
| --- | --- |
| Grama | 4 |
| Caminho | 3 |
| Água centro | 3 |
| Água borda | 4 (água + 1 pedra) |
| Piso lodge | 3 (madeira claro, base, escuro) |
| Parede | 3 (madeira claro, escuro, fundo) |

Prop: no máximo 16 cores da rampa, incluindo o ink da silhueta. Copa: 4 verdes + ink = 5.

### Cluster

Mínimo 2×2 da mesma cor. Exceção: centro da flor, 1 px `#D4A04A`, rodeado por `#FFF8F1`. Costura de tábua pode ser linha de 1×8. Proibido pixel solto de cor única.

Um tile de grama tem 1 cluster (tufo de 3×2 ou 2×2), não dois. Mais que 2 clusters no mesmo tile = ruído. Zero clusters no tile base = fill chapado. Os dois falham.

### Catálogo

Desenhar estes tiles. Nome = arquivo ou quadro no sheet.

| ID | O que é |
| --- | --- |
| `grass-0` | Base `#5B8F4E`. Um tufo 3×2: px norte `#7AAA62`, px sul `#3E6A38`. |
| `grass-1` | Igual, tufo no canto oposto ao de `grass-0`. |
| `grass-2` | Base + um tufo pequeno + uma flor (1 px ouro, 4 px cream em cruz). |
| `grass-dark` | Base `#3E6A38`, tufo com `#2A4A26`. Debaixo/sul da copa. |
| `path-0` | Centro `#F3E8D4`. Um seixo 2×2 `#D9C4A4` com 1 px `#FFF8F1` no norte do seixo. |
| `path-n` `path-e` `path-s` `path-w` | Borda. Faixa de 2 px do tom escuro no lado do vizinho grama. O resto é base. 1 px de grama `#5B8F4E` entra 1 px para dentro, para o corte não ser escada seca. |
| `path-ne` `path-nw` `path-se` `path-sw` | Canto externo. As duas faixas se encontram. |
| `path-in-ne` `path-in-nw` `path-in-se` `path-in-sw` | Canto interno, onde o caminho dobra (a praça e os entroncamentos). |
| `water-0` | Base `#4A7C9B`. Um risco 4×1 `#7AABCA` na metade norte. |
| `water-n/e/s/w` + 4 cantos | Borda. 3 px de pedra `#A3988C` no lado de fora, 1 px `#5E564E` na linha da água, resto água. O tile `water-n` ganha um tufo de junco 2×4 em `#3E6A38` / `#7AAA62`. |
| `floor-0` `floor-1` | Tábua horizontal de 8 px. Norte da tábua `#E6C49A`, miolo `#C4925A`, costura sul 1 px `#8A5A30`. `floor-1` desloca a emenda vertical 8 px. |
| `wall-top` | Face de cima da parede (fileira norte do lodge): `#E6C49A` com uma linha `#C4925A`. |
| `wall-face` | Face sul, vista de cima baixa: `#8A5A30` com linha `#4A3018`. |

A parede de trás do lodge já ocupa 2 fileiras (`rowIndex <= top + 1`). Fileira `top` = `wall-top`. Fileira `top+1` e as laterais = `wall-face`.

### Variação

O hash da célula escolhe o tile. Não escolhe pixel.

- Grama clara: `h % 10` → 0–6 `grass-0` (70%), 7–8 `grass-1` (20%), 9 `grass-2` (10%).
- Se o tile à esquerda saiu igual, avança uma variante. Flor não encosta em flor.
- `grass-dark` substitui a clara quando a célula está a distância de Chebyshev ≤ 2 de um tronco **e** a fileira é maior que a do tronco (sombra cai para o sul).
- Caminho: autotile pela máscara dos 4 vizinhos. Os 4 são caminho → `path-0`. Um vizinho é grama → borda daquele lado. Dois vizinhos ortogonais são grama → canto. Não desenhar ink entre caminho e grama.
- Água: a mesma máscara. Centro só quando os 4 vizinhos são água.

---

## 3. Escala

Consultor piloto: desenho 13×43, tratar como **44 px** de altura, tile 16. Todo número abaixo é o bbox opaco, não o canvas.

| Prop | Canvas | Desenho | Altura vs 44 px |
| --- | --- | --- | --- |
| Mesa + monitor | 48×40 | mesa 32×16; monitor 16×12 sentado no tampo | conjunto **30** |
| Cadeira (no mesmo PNG, à frente da mesa) | incluso | 12×16 | **16** (joelho) |
| Tronco | 32×24 | 12×18 | **18** |
| Copa | 64×48 | 52×40, elipse, base reta de ~16 px no centro | **40**; mais larga que alta |
| Árvore inteira (tronco + copa) | — | ~52×56 | **mais alta que o consultor** |
| Cerca (2 tiles) | 32×16 | 32×14, dois postes e dois trilhos | **14** |
| Folha do portão | 16×32 | 14×26 | **26** |
| Base do portão (4 tiles) | 64×40 | 64×32, vão central 24×28 | vão **28**, o consultor passa |
| Lintel / telhado do portão | 64×28 | 64×22 | **22**, sempre por cima de quem está no vão |
| Fogueira | 48×32 | pedras 36×14; chama sobe mais 12 | **28** com a chama |
| Lenha | 24×16 | 20×14 | **14** |
| Canteiro (3×2 tiles) | 48×32 | 48×24, seis tufos em grade | **24** |
| Ping-pong | 48×32 | tampo 36×18, rede 2 px | **22** |
| Porta do lodge | 32×48 | 22×40 | **40**, um pouco abaixo do consultor |
| Parede baixa | tile 16×16 | massa visual = 2 fileiras = 32 px | **32** |

A copa atual (49×46, 1508 cores) está no tamanho certo de altura e errada de desenho: falta largura de bloco e sobra cor. A porta atual (39×53) está alta demais: fica torre. A lenha (18×17, 199 cores) está pequena e suja.

Cadeira não é prop separado. Vai no PNG da mesa, encostada no sul do tampo, para o assento cair na célula de `seatCell`.

---

## 4. Densidade

Planta que fica: lodge leste (`LODGE` 49–68 × 9–24, porta nas cols 58–59), fogueira oeste (col 14, row 22), quatro canteiros sudoeste (cols 12 e 16, rows 29 e 33), lago norte (elipse cx 38, cy 5.5, rx 6.5, ry 2.5), portão sul (`GATE_COLS` 39–40). Cerca só no arco sul, como já está. Sem fonte no centro. A praça continua caminho; a borda dela é que ganha flor.

Nada em cima de caminho, praça, corredor do portão (cols 37–42, da row do portão até a praça), interior do lodge, nem célula de assento.

**Árvores, alvo 28.** Além das 16 atuais: amostrar a elipse a 0.92 do raio, a cada ~4 tiles de arco. Colocar se o terreno é grama, a distância ao eixo do caminho é > 2.2 células, está fora do lodge, e não há outro tronco a menos de 4 células. Pular o arco do portão. O norte do lago e o sudeste são os buracos visíveis.

**Arbustos, alvo 36.** Canvas 24×16, desenho 20×12, 4 verdes + ink. Não bloqueia célula (`blocks` vazio): é volume baixo, o consultor não desvia. Célula de grama com `h % 18 == 0`, distância ao caminho entre 2.2 e 5, distância a tronco > 2, fora do retângulo dos canteiros (cols 11–20, rows 27–36). Teto 36. Eles fecham o vão oeste (entre fogueira e mesa) e o gramado sudeste.

**Flores.** Não são prop. São `grass-2` (10% da grama clara) mais 8 tufos de flor, mesmo tamanho do arbusto, sem colisão, colados no lado de fora dos canteiros e nos ombros do caminho sul. Flor não entra no caminho.

**Pedras.** As 6 atuais ficam. Mais até 10 pedras de margem, canvas 16×16, desenho 12×10, 3 cinzas + ink, na grama que toca água, `h % 3 == 0`, fora do caminho que sobe ao lago (eixo de col ~38–40). Pedra de margem bloqueia a própria célula. Pedra no meio do campo, não.

**Cercas.** Não estender para leste, oeste ou norte. O norte fecha com árvore, pedra e água.

---

## 5. Profundidade da copa

Sort key da copa = Y mundial da **última fileira opaca da copa** (a base da folha). Não é o Y do tronco. Não é `foregroundDepth`.

- Consultor com `feetY` **maior** que essa linha (está ao sul, na frente da folha) desenha por cima da copa.
- Consultor com `feetY` **menor ou igual** (está debaixo ou atrás) desenha por baixo da copa.
- Copa contra copa: o mesmo Y de base. Quem está mais ao sul fica na frente.
- O tronco continua no Y da base do tronco.
- O lintel do portão **continua** sempre na frente (`foregroundDepth`). Telhado cobre quem está no vão. A copa não.

Teste: um consultor um tile ao sul da base da copa, a cabeça fica livre. Um tile ao norte, a folha cobre a cabeça.

---

## 6. Prompts

Um por asset prioritário. GenerateImage primeiro, como layout. Produção depois no PixelLab, com o mesmo texto. Fundo transparente nos props. Sheet de tile sobre `#FFF8F1`, células 16×16 sem gap, para cortar.

Estilo em todos: pixel art original, low top-down, cozy, clusters de 2×2, sem anti-alias, sem degradê, alpha só 0 ou 255. Não citar nem imitar Stardew Valley nem Tibia. Luz do norte. Contorno 1 px `#201B0F` só na silhueta do prop. Tiles sem contorno ink.

### 6.1 Grama — quatro tiles

```
Pixel art tile sheet, 64×16 px, four 16×16 tiles in a row, no gap, no labels.
Background cream #FFF8F1.
Low top-down grass. Palette only: #7AAA62, #5B8F4E, #3E6A38, #2A4A26.
Tile 1: flat #5B8F4E with one 3×2 tuft, top pixels #7AAA62, bottom pixels #3E6A38.
Tile 2: same, tuft in the opposite corner.
Tile 3: same base, one small tuft, one flower: single #D4A04A pixel ringed by #FFF8F1.
Tile 4: darker grass #3E6A38 with one tuft in #2A4A26.
No black outline. No speckles. No extra colors. Hard pixels, nearest neighbor.
```

### 6.2 Caminho — centro, borda, canto

```
Pixel art tile sheet, 48×48 px, nine 16×16 tiles, 3×3 grid, no gap, no labels.
Background cream #FFF8F1.
Low top-down dirt path. Palette only: #FFF8F1, #F3E8D4, #D9C4A4, plus #5B8F4E where grass overlaps the rim by 1 px.
Center tile: #F3E8D4 with one 2×2 pebble #D9C4A4 and one highlight pixel #FFF8F1 on the pebble's north edge.
Edge tiles (N, E, S, W): 2 px darker rim #D9C4A4 on the grass side, 1 px of #5B8F4E biting into the path.
Outer corners: the two rims meet.
No black grid lines. No noise. Hard pixels.
```

### 6.3 Copa

```
Pixel art sprite, canvas 64×48 px, transparent background.
One tree canopy, low top-down, drawn size about 52×40 px, round mass, flat bottom edge ~16 px wide at the center where the trunk would meet.
Palette only: #7AAA62 highlight on the north, #5B8F4E body, #3E6A38 south shadow, #2A4A26 deepest pockets, outline 1 px #201B0F on the outer silhouette only.
Clusters of at least 2×2. Five colors maximum. No anti-alias, no single-pixel leaves, no dither.
Original cozy shape. Not a copy of any existing game tree.
```

### 6.4 Arbusto

```
Pixel art sprite, canvas 24×16 px, transparent background.
Low top-down bush, drawn about 20×12 px, wider than tall, knee-high next to a 44 px character.
Palette only: #7AAA62, #5B8F4E, #3E6A38, #2A4A26, outline 1 px #201B0F on the silhouette.
North side lighter, south side darker. Clusters of 2×2. No flowers on this one. No anti-alias.
```

### 6.5 Borda de água

```
Pixel art tile sheet, 48×32 px, six 16×16 tiles, 3×2, no gap, no labels.
Background cream #FFF8F1.
Low top-down pond shore. Water colors only #7AABCA, #4A7C9B, #2F5874.
Stone rim only #D4CBC0, #A3988C, #5E564E.
One north-shore tile includes a 2×4 reed in #7AAA62 and #3E6A38.
Each shore tile: 3 px of stone on the outside, 1 px dark stone on the water line, rest water.
One center tile: flat #4A7C9B with a single 4×1 highlight #7AABCA.
No black outline. No ripples made of single pixels. Hard pixels.
```

---

## 7. Ordem de produção

Os cinco que mudam a tela primeiro. O resto (mesa, cerca, porta, fogueira) espera estes passarem.

1. **Grama** (`grass-0/1/2` + `grass-dark`). É a maior área da imagem.
2. **Caminho** (centro, borda, canto, canto interno). A fita bege é a segunda maior forma.
3. **Copa**, no tamanho 52×40 e em 5 cores, com o sortY da seção 5. Repete ~28 vezes.
4. **Arbusto**, ~36, sem colisão, nos vãos oeste e sudeste.
5. **Borda de água** + pedra de margem. O lago deixa de ser elipse chapada.

---

## 8. Pass / fail

Olhar em nearest-neighbor, zoom 1× e 2×. Um item falho reprova o asset. Não aprovar pelo sheet isolado: ver na cena, ao lado do consultor piloto.

**1×**

- A ilha não é um verde só. Dá para apontar tufo e, em algum lugar, flor.
- O caminho tem margem. O corte contra a grama não é um degrau de cor sólida.
- A copa lê como bola, mais larga que o consultor, mais baixa que o consultor sozinha, mais alta que ele com o tronco.
- A cerca fica na altura do joelho (14 px). A porta não passa de 40 px.
- Arbusto no gramado oeste e no sudeste. Lago com pedra na margem.
- Consultor um tile ao sul da copa: cabeça livre.

**2×**

- Nenhuma cor nova na borda. Se aparecer tom intermediário, é anti-alias: falha.
- Alpha só 0 ou 255.
- Grama ≤ 4 cores. Caminho ≤ 3. Copa ≤ 5. Qualquer prop ≤ 16, todas dentro da rampa da seção 2.
- Nenhum pixel solto, salvo o centro ouro da flor.
- Dois tiles de flor não se encostam.
- `grass-dark` só ao sul dos troncos, não espalhado no meio do campo.
- Copa não usa a faixa de foreground global. Lintel do portão continua usando.

Medida objetiva no PNG, antes de integrar: contar cores opacas. Copa acima de 5 cores, ou grama acima de 4, reprova sem olhar o resto.

---

## Revisão 2

Medido em 29 set 2026, depois do passe que aplicou a seção 2. O `scene-1x.png` é o mundo nativo, 1280×720, **34 cores**, todas na rampa. O sketch v2 é o mesmo canvas (1280×720). A planta não mudou. O que falta é leitura.

### 1. Por que ainda perde para o sketch

O passe anterior tirou o ruído (a copa caiu de 1508 cores para 5). O que ficou é um campo de um verde só, com detalhe pequeno demais para o zoom em que a cena é vista.

**Escala no fit.** `live-fit.png` é 2560×1544 e tem **4882 cores**. A grama `#5B8F4E` virou `#678e55`: o fit não está em escala inteira, o nearest-neighbor quebra. A elipse da ilha tem 672 px de altura no mundo (ry 21 × 16 × 2) e mede 1161 px nessa captura, **1,73 px de imagem por px de mundo**. Num screenshot 2×, o fit em CSS fica em **~0,86**. O tufo atual é 3×2. A 0,86 vira ~2,6 px e some. O consultor (44 px) ainda aparece (~38 px), mas qualquer cluster com lado menor que 4 px morre nesse zoom. O sketch lê no mesmo 1280×720 porque o bloco de folha, flor e telhado é grande.

**Vazio.** Das 3600 células: grama 1885, caminho 275, vazio 1066, piso 236, parede 84, água 54. A grama pintada é **93,9% `#5B8F4E`** (453161 px de base, 29399 de detalhe, 6,1%). No frame, `#5B8F4E` sozinho é **44,4%** dos pixels (408865) e **62,7%** do que não é creme. **925 células de grama (49%)** têm uma vizinhança 5×5 que também é só grama. O tufo de 3×2 são 6 px num tile de 256 (2,3%). O olho vê campo, não grama.

**Contraste de valor.** No conteúdo do sketch (fora o creme), a luminância se reparte em escuro 31% / meio 33% / claro 36%. No `scene-1x`, fora `#FFF8F1`, é **escuro 5,7% / meio 82,1% / claro 12,1%**. A cena é uma laje de valor médio. Sem massa escura (telhado, beira, sombra de verdade) o cozy não segura.

**Borda da ilha.** 172 células de grama tocam o vazio. A beira é uma linha de **1 px** `#3E6A38` e depois o degrau de 16 px do tile. No fit isso é uma escada. O sketch quebra a escada com arbusto, pedra e uma faixa escura de vários pixels. A cerca sul está certa e fica; o resto do contorno não tem massa.

**Caminho liso.** O caminho é 87,8% `#F3E8D4` (61815 px de base, 8585 de detalhe). O seixo de 2×2 só existe no tile com os 4 vizinhos em caminho. Luminância do areia: **233**. É a segunda coisa mais clara da imagem, uma fita chapada.

**Flores que viram faísca.** `grass-2` são 177 células (9,4% da grama), cada uma com 1 px `#D4A04A` e uma cruz de `#FFF8F1`. Isso soma **708 px creme em cima da grama**, luminância **249**. Os 6 `flower-tuft` (desenho 20×12, 6 cores) leem como uma barra verde com três pontos. Não há grupo. No crop 2× a grama está salpicada de losangos brancos.

**Lodge sem telhado.** O lodge é piso (236 células de tábua) com uma parede de 1 tile (84 células). No crop, a parede norte é uma faixa clara e as laterais uma faixa escura. Não existe plano de telhado. No sketch o lodge é o marco da ilha: telhado de duas águas, beiral, interior aberto. Aqui é um retângulo de tábua.

**Luz quente.** A fogueira existe (canvas 45×33, desenho 44×32, 9 cores) e não pinta o chão. `#D4A04A` na cena inteira são 299 px, quase todos a flor de 1 px. Não há poça de luz.

**Consultor sobre o chão.** O piloto south desenha 13×43, 15 cores. A camisa `#EBE1D6` tem luminância **226**; o highlight `#F0EDE8` tem **237**. Sobre a grama (127) a camisa separa bem (delta ~99). Sobre o caminho (233) a delta é **7**. A calça `#494E50` (77) e o cabelo (44) é que seguram a silhueta. Os 708 px creme da flor são mais claros que a camisa, então no fit o olho acha a faísca antes da pessoa. Não redesenhar o consultor neste passe. Tirar o creme solto da grama e quebrar o areia já devolve a leitura. Contorno ink no piloto fica para uma revisão dele, não desta.

### 2. Ajustes, em ordem

Cluster mínimo sobe de 2×2 para lado **≥ 4 px** em tudo que precisa sobreviver ao fit ~0,86. Rampa da seção 2 continua fechada. Sem cor nova.

**1. Grama com bloco, flor em par, zero faísca.** É a maior área e é o que apaga o consultor.

- `grass-0` e `grass-1`: um tufo **6×4**. Norte 6×2 `#7AAA62`, sul 6×2 `#3E6A38`. Some o tufo de 3×2.
- `grass-2` deixa de ser cruz de 1 px. A flor é um bloco **4×4**: 2×2 `#FFF8F1` no norte, 2×2 `#D4A04A` no sul. Os dois são cluster. Proibido 1 px creme.
- `grass-2` só se a distância ao caminho está entre 1 e 2,5 **ou** a célula toca o vazio. Se a célula vira flor, a célula a leste também vira, se for grama. Teto **48** células (24 pares). As 925 células de interior 5×5, com distância ao caminho > 3, não recebem flor.
- `grass-dark` debaixo da copa fica como está.
- Pass: detalhe da grama (tudo que não é `#5B8F4E`) entre **15% e 22%** dos px de grama. Hoje é 6,1%. Creme `#FFF8F1` dentro de tile de grama só no bloco 2×2 da flor, nunca cruz.

**2. Telhado do lodge.** É o marco que o sketch tem e o render não tem. Não cobre as 12 mesas.

- Sprite `lodge-roof`, canvas **352×32**. Largura = lodge (20 tiles, cols 49–68) + 16 px de beiral de cada lado. Altura 2 tiles.
- Desenho: fileiras 0–15 do canvas, declive norte `#E6C49A` com uma faixa `#C4925A` na fileira 8. Fileiras 16–27, declive sul `#8A5A30`. Fileiras 28–31, beiral `#4A3018`. Contorno 1 px `#201B0F` só na silhueta. Cores: essas 4 madeiras + ink = 5.
- Âncora: base no centro da parede norte (fileira `LODGE.top`). O beiral sul termina na borda sul dessa fileira. Interior, porta e mesas continuam visíveis.
- Sort: `overhead`, igual ao lintel do portão. Caminha por cima de quem está encostado na parede norte. Não usa o sort da copa.
- Parede lateral (`wall-face`): além da linha `#4A3018`, uma faixa de **4 px** `#4A3018` na base do tile e **2 px** `#E6C49A` no topo. A parede norte continua `wall-top`, agora debaixo do telhado.

**3. Seixo de 4×3 em todo tile de caminho.** A fita bege é a segunda maior forma, e é onde o consultor fica em pé.

- Todo tile de caminho, inclusive borda e canto, ganha um seixo **4×3** `#D9C4A4` com o norte do seixo em **4×1** `#FFF8F1`. Posição pelo hash, dentro da área que não é a faixa de borda.
- A mordida de 1 px de grama na borda fica.
- Pass: px de caminho que não são `#F3E8D4` passam de 12% para **≥ 25%**. No 2× o seixo ainda é um bloco. A camisa (lum 226) passa a ter areia escura (lum 198) do lado, não um campo lum 233.

**4. Borda da ilha com faixa, arbusto no degrau.**

- Célula de grama que toca vazio: no lado do vazio, **4 px** `#3E6A38` e, no px externo, mais **2 px** `#2A4A26`. Substitui a linha de 1 px. Cantos somam as duas faixas.
- Dos arbustos (hoje 30, canvas 24×16, desenho 20×12, 4 cores — o desenho serve), **12** passam para célula de grama que toca o vazio, fora do arco do portão e fora do caminho. O resto fica nos vãos oeste e sudeste. Arbusto continua sem colisão.
- A cerca não cresce. Norte continua fechando com árvore e água.

**5. Poça quente na fogueira e tufo de flor que seja flor.**

- Células a distância de Chebyshev ≤ 2 da fogueira, se forem grama: o tufo 6×4 usa `#E6C49A` no norte e `#D4A04A` no sul, em vez dos verdes. Se forem caminho: o seixo 4×3 troca para `#E6C49A` / `#D4A04A`. Sem overlay, sem cor fora da rampa. Raio 2 para a poça não virar tapete.
- `flower-tuft.png` redesenha no mesmo canvas **24×16**, desenho **20×12**. Três flores em bloco, cada uma 4×4 (2×2 creme no norte, 2×2 ouro no sul), em cima de 4 verdes + ink. Hoje o sprite é uma barra com ponto de 1 px.
- Os 6 tufos atuais viram **3 pares** colados (célula ao lado, grama, fora do caminho): ombro do caminho sul, lado de fora dos canteiros, e um par na grama sudeste. Flor não entra no caminho.

### 3. O que não mexer

- Rampa, paleta, tile 16, perspectiva, alpha 0 ou 255. A cena em 1× já está em 34 cores. Não abrir cor.
- Copa **64×48**, desenho **52×40**, 5 cores. Tronco desenho **14×18**. As 27 árvores. O sort da copa pela base da folha: no crop, um consultor fica na frente da folha e outro atrás. Isso está certo.
- Cerca só no arco sul. Portão, lintel em `overhead`, vão por onde ele passa.
- Piloto. Não repintar camisa, cabelo nem adicionar contorno nele neste passe.
- Planta: lodge, lago, fogueira, quatro canteiros, praça, corredor do portão. Não mover mesa.
- Pedra de margem e o anel de pedra da água. O lago pode continuar uma elipse de tile. O highlight da água é pouco (84 px `#7AABCA`) e não é o próximo ganho.
- `grass-dark` ao sul do tronco.

### 4. Mesa e animação

A mesa atual **não serve** para sentar e trocar o monitor.

Medido em `desk.png`, canvas **48×40**, opaco 32×36 na origem (8, 4), 7 cores:

| Pedaço | Retângulo no canvas | Tamanho |
| --- | --- | --- |
| Monitor (bezel ink) | x 16–31, y 4–14 | **16×11** |
| Tela azul dentro dele | x 17–30, y 5–13 | 14×9 |
| Tampo + pernas | x 8–39, y 14–29 | **32×16** |
| Cadeira, no mesmo PNG | x 18–29, y 24–39 | **12×16** |

A cadeira começa na fileira 24 e atravessa as pernas da mesa. Um PNG só não troca o estado da tela e não deixa um corpo ocupar o assento: o sort é o da mesa, a cadeira não tem profundidade própria, e os 12 px dela são mais estreitos que o torso de 13 px — sentado, ela some atrás da camisa.

Separar em três sprites. O tampo não muda de medida.

**Mesa.** `desk.png` novo, canvas **48×24**. Desenho **32×16** (x 8–39, y 4–19). Pernas inclusas. Sem monitor, sem cadeira. No centro da borda norte do tampo, um apoio **4×2** `#8A5A30` onde o monitor senta. Âncora continua bottom-center no span de 2 tiles. Sort pela base da mesa.

**Monitor.** Um frame **16×12**. Sheet `monitor.png` **64×12**, quatro frames sem gap, x = 0, 16, 32, 48. Bezel de 1 px `#201B0F` nos quatro. Âncora bottom-center, em cima do apoio. Sort igual ao da mesa, para a tela não pular na frente de quem está ao sul.

| Frame | Tela 14×10 interna |
| --- | --- |
| 0 off | `#2F5874` chapada |
| 1 booting | `#4A7C9B`, barra **10×2** `#7AABCA` na fileira 5 |
| 2 working | `#7AABCA` chapada (o azul de hoje) |
| 3 standby | `#2F5874`, bloco **2×2** `#D4A04A` no canto sul-leste da tela |

**Cadeira.** Canvas **16×16**, desenho **16×14**, mais larga que o torso de 13 px para sobrar 1–2 px de madeira de cada lado. Encosto nas 6 fileiras norte (`#E6C49A` norte, `#C4925A` miolo), assento nas 8 fileiras sul (`#8A5A30`). Âncora bottom-center na `seatCell`. Desenha **antes** do consultor na mesma chave de Y, para o corpo cobrir o meio e a madeira aparecer nas laterais. Sem peça de foreground: um encosto na frente cobriria a camisa.

**Consultor sentado.** Olha o monitor, então é a face **north** (as costas). Canvas **48×68**, igual ao piloto. Âncora não muda: pés/assento na fileira **56** (`56/68`). O contato com a cadeira é essa fileira, não a sola.

- 4 frames: `consultant-sit-north-0.png` … `3.png`. Não é o walk de 6.
- Opaco: **x 15–31** (17 px, braço incluso), **y 28–55** (28 px). Cabeça na densidade do piloto, torso, sem perna. A base do torso encosta na fileira 56.
- Frames 0 e 2: mãos na altura do teclado. Frames 1 e 3: as mãos descem **1 px**.
- Paleta do piloto, as mesmas 15 cores. Sem bolsa, sem contorno novo, sem cor da rampa do chão.

A cabeça fica ao sul do monitor. Como o sprite inteiro sorteia pela fileira 56, e a mesa sorteia pela borda sul dela (8 px ao norte do centro do assento), o corpo desenha na frente do tampo e as mãos caem sobre o teclado. É o que se quer para digitar.

---

## Revisão paper-doll

Medido em 29 set 2026. Piloto `consultant-south.png`: canvas 48×68, opaco **13×43** (x 18–30, y 12–54), **15 cores**. O grid `grid-south-2x.png` são os seeds `doll-0` … `doll-11`, face south, em 2×. Os três stills são `seed-ada` `1.1.1.4.0.1`, `seed-nils` `0.2.1.2.0.3`, `seed-keiko` `1.2.2.3.1.0` (chave `pele.cabelo.forma.roupa.chapéu.acessório`). O crop do lodge é north sentado, quatro primeiros looks únicos dessa lista.

Catálogo em `paper-doll.ts`: 5 peles, 5 cabelos, 3 formatos, 6 roupas, 4 chapéus (0 = nenhum), 4 acessórios. 7200 chaves. A silhueta não acompanha a chave.

### 1. Veredito

Não. A 2× no preto, a camisa separa. A 1× no lodge, não são doze pessoas. Contra o concept `cursor-office-characters-12.png`, nota **3/10**.

O concept separa no primeiro olhar pela massa: rabo, afro, coque, boina, gorro, aba larga. O corpo também muda (macacão, moletom, saia). Aqui o corpo é um só. O ombro mais largo do piloto é **13 px** (y 36–41, x 18–30) em todos os doze.

O que o código acrescenta de verdade:

| Forma | Px novos | Caixa |
| --- | --- | --- |
| Cabelo 0, sem chapéu | 0 | 13×43 |
| Cabelo 1 (tufo) | 4 (bloco 2×2 em `minY−2`) | 13×45 |
| Cabelo 2 (fios) | 6 (1×3 de cada lado) | 15×43 |
| Chapéu 2 (gorro) | 0 — só repinta cabelo que já existe | 13×43 |
| Chapéu 1 (verde) | 6 de aba, 1 px de altura × 3 px | 19×43 |
| Chapéu 3 (palha) | 20 de aba, 2×5 de cada lado | 23×43 |

Três dos doze ficam na caixa do piloto (doll-2, doll-8, doll-11). A aba de palha (doll-1, doll-5, doll-9) é o único contorno que se lê a 2×. O tufo de 2×2 morre no fit ~0,86: o passe do mapa já mediu que cluster com lado menor que 4 px some nesse zoom.

No lodge o teste é mais duro, porque é a vista real (costas, sentado). `deriveSit` guarda 28 fileiras a partir de `box.minY` e no máximo 17 px de largura. O tufo está em `minY−2`, fora do corte. A aba de 5 px do chapéu 3 também cai fora: o stand de 24 px vira sit de 17. O chapéu 2, no north, pinta a banda de cabelo inteira (`hairEnd` = 14 fileiras) de `#201B0F`. No sit do doll-2 são **128 px** de tinta: a nuca é um bloco preto, não um gorro.

Ada é camisa do caminho (`outfit` 4) com óculos 2×2. Nils é camisa azul com um alfinete 2×2. Keiko é camisa de tábua (`#E6C49A`) e chapéu da grama (`#5B8F4E`). No preto os três funcionam. No chão, dois deles vestem o cenário.

A bolsa confirma o clone lateral. No east parado, 53 px da rampa de cabelo do piloto (`#523130 #4A2B29 #432624 #3C211F`) estão na banda da camisa e da calça (x 18–24, y 29–47) e o `roleAt` devolve `keep`. Recolorir o cabelo não mexe na bolsa. No south só escapam 6 px de alça. No walk a bolsa ainda some: east parado tem 44 px de cabelo na faixa y 38–50; `walk-east-0`, `1` e `2` têm **0**.

O walk quantizado perde **30 tons únicos, 3332 px**, fora da paleta do still da mesma direção (o risco citado era 31). São tons de borda (`#F5C4B8`, `#CA8B81`, `#898D97`), não uma segunda pessoa. Snap no still é o que mantém a máscara de recolor. Não é o defeito que impede os doze de se lerem.

### 2. Três ajustes

Os três são código, em cima do still 48×68. Sem PixelLab. Cluster novo com lado ≥ 4 px, senão o fit apaga.

**1. Silhueta, quatro carimbos.** O contorno deixa de ser o do piloto em todo mundo.

- Cabelo 1, coque: apagar o 2×2. Bloco **4×4** encostado na cabeça, x = centro−2 até centro+1, y = `minY−4` até `minY−1`. Norte do bloco `hair[0]`, sul `hair[2]`. Se houver chapéu, o chapéu cobre esse bloco.
- Cabelo 2, laterais: apagar o 1×3 na altura do pescoço (hoje cai em `minY+13`, ao lado do pescoço de 5 px). Duas mechas **2×8**, a partir de `minY + hairEnd` (no south, y 17, na face de 11 px). x = `minX−2` e `minX−1`, e o par em `maxX`. Quatro fileiras de cima `hair[1]`, quatro de baixo `hair[3]`. A caixa passa de 13 para **17** de largura.
- Ombro: nas fileiras em que o torso tem 13 px (south y 36–41, x 18–30), outfits **1, 3 e 5** ganham 1 px de cada lado em `shirt[3]`. Outfits 0 e 2 ficam 13. Dois corpos, não doze clones.
- Coroa: chapéus 1 e 3 deixam de só repintar cabelo. Quatro fileiras novas acima de `minY`, na largura do cabelo (11 px no south). Fileira de cima = tom claro do chapéu, as outras três = tom escuro. Chapéu 2 usa as mesmas 4 fileiras e **não** pinta `hairEnd` no north.

**2. Contraste pele / camisa.** A massa da camisa são os **88 px** `#EBE1D6` (índice 1 de `SHIRT_SRC`, lum 226). O miolo do rosto (`skin[1]`) nas peles 0, 1 e 2 está entre lum 171 e 191. Contra o miolo da camisa a delta cai a 2 (pele 1 × roupa 2), 6 (pele 0 × roupa 5) e 8 (pele 0 × roupa 1). O rosto entra na camisa.

Regra, só para pele 0–2: esses 88 px passam a `shirt[3]`, e os 15 px de highlight `#F0EDE8` passam a `shirt[2]`. Peles 3 e 4 já separam (delta ≥ 46) e não mudam. Exemplo, roupa 2: o torso vai para `#2F5874` (lum ~81). Delta contra pele 0 sobe de 17 para ~90, e contra o caminho (lum 233) também segura.

**3. Chapéu no sit, e a bolsa fora do marrom do piloto.** É o que a cena mostra: costas na mesa, e o lado quando anda.

- `deriveSit`: o corte sobe **4 px** (`box.minY − 4`) e a largura passa a ser a caixa inteira, teto **24 px**, para a aba de 5 px entrar. Hoje `cropW = min(17, …)` come a aba e o coque.
- Chapéu 2: teto de **4 fileiras** em qualquer facing. No north as 14 fileiras de cabelo viram tinta; é o bloco de 128 px do doll-2.
- Aba do chapéu 1: de 1×3 para **2 fileiras × 4 px** de cada lado, tom escuro. Aba do chapéu 3 continua 2×5.
- Bolsa: os px da rampa `HAIR_SRC` que caem na banda `shirt` ou `pants` são a bolsa, não o cabelo. East: x 18–24, y 29–47, 53 px. West: o lado oposto, x 27–30. South: a alça, 6 px (y 38–42). Pintar com rampa própria, a mesma em todo doll: `#C4925A`, `#8A5A30`, `#5C382C`, `#3A241C`. Nenhum desses quatro está nas cinco rampas de cabelo. O frame de walk que tem 0 px nessa faixa continua sem bolsa — isso o código não inventa (item 4).

### 3. O que sai do catálogo

Sai o que é o chão, não o slot de pele.

- **Roupa 4 sai inteira.** Os quatro tons são o caminho e a pedra: `#FFF8F1`, `#F3E8D4`, `#D9C4A4`, `#A3988C`. Ada está nesse índice. No areia (lum 233) a camisa é o chão. Não há tom sobrando nessa rampa que não seja o tile.
- **Roupa 3 sai inteira.** `#E6C49A`, `#C4925A` e `#8A5A30` são a madeira do lodge, e o lodge é onde eles sentam. Keiko veste a mesa. Não há quente livre na rampa que não seja tábua.
- **Roupa 1, dois hexes.** `#5B8F4E` e `#3E6A38` são a grama, distância 0. Trocar por `#2A4A26` e `#1C3018` (já são a calça dessa roupa). O corpo `#8FB06E` fica.
- **Chapéu 1, um hex.** `#5B8F4E` sai. O verde do chapéu passa a `#7AAA62` / `#2A4A26`, para a aba não ser tufo.
- **Pele 2, um hex.** O claro `#E8C39A` está a distância 2 de `#E6C49A` (madeira). O pescoço some na tábua. O slot fica; o claro desce para `#D4A574`, que já é o segundo tom, e `#E8C39A` sai.

Ficam as cinco peles, os cinco cabelos, as roupas 0, 1 (sem os dois verdes do tile), 2 e 5, e os quatro chapéus com o verde deslocado. Cabelo 4 (grisalho) fica: o problema dele era a roupa 4, que sai.

Pares que o ajuste 2 não precisa mais resolver, porque a roupa sai: pele 1 × roupa 3 (delta 9) e qualquer pele clara × roupa 4.

### 4. PixelLab, se um dia

Não gastar agora. Os doze se resolvem no código. Os 30 tons do walk também não justificam geração: são anti-alias, e o snap é o que faz a máscara acertar.

Se sobrar uma geração, o asset é um só: **`walk-east-0.png`**. É o frame em que a bolsa do piloto não existe (0 px na faixa y 38–50; o east parado tem 44). Sem esse pixel, o ajuste 3 não tem o que repintar, e o buraco continua nos frames 0, 1 e 2.

Passa só se os quatro forem verdade:

- Canvas 48×68, alpha só 0 ou 255, altura opaca 44, a sola na mesma fileira dos outros `walk-east`.
- Na faixa y 38–50, pelo menos **24 px** opacos do lado da bolsa (x ≤ 24), em cluster, nenhum deles na rampa `HAIR_SRC`.
- O resto do corpo continua nos tons do still east (as 15 cores). Sem tom novo na borda.
- Largura opaca entre 13 e 16. Abaixo de 13 a bolsa não entrou.

Falhou um item, não gera o frame 1. O ciclo east 1–3 usa o mesmo teste. West fica para depois: os frames 1, 2, 4 e 5 já estão em 1–5 px, mas só entram se o east-0 passar. Não é lote de doze, nem tileset.

---

## Comparação com referência — estação de trabalho

Medido em 29 set 2026. A referência é um screenshot de qualidade de leitura. Não se copia pixel, personagem, mapa, UI, paleta exata nem IP.

Cena nativa: `scene-1x.png` (1280×720, **34 cores**, alpha 255), `map-pass/crop-lodge-2x.png` (400×360, 21 cores), `paper-doll/crop-lodge-1x.png` (280×160, **45 cores, 0 fora da rampa**). QA ao vivo: `03-desk.png` e `08-return-desk.png`, os dois **2560×1544, 6115 cores**. Sprites: `sit-north-0.png` canvas 48×68, opaco **14×28** em (17, 28), 296 px, **10 cores**, alpha só 0 ou 255. `chair.png` 16×16, desenho 16×14, 224 px, **56 deles `#201B0F`**.

### 1. Veredito

Estação no crop nativo: **3/10** contra a leitura do sentado na referência. No app ao vivo: **2/10**. A referência separa a pessoa do chão no primeiro olhar. Aqui a cadeira lê antes do corpo.

O fantasma, no pixel, é isto:

- `deriveSit` copia o north em pé. `north.png` opaco y 12–55 (14×44). O sit é esse desenho 16 px abaixo, cortado na fileira 55: caixa **14×28**. Calça `#494E50`: **0 px** no sit-0. A fileira 55 é o torso no ponto mais largo e acaba. Não há quadril.
- A cadeira é um retângulo fechado. Fileiras 2 e 15, e as colunas 0 e 15, são `#201B0F`. No `crop-lodge-2x`, a barra de cima cruza a altura do pescoço (5 px de pescoço no meio de uma linha de ink). No crop 1×, **373 px de ink tocam a camisa**. A cabeça fica por cima da caixa. O torso claro fica dentro.
- Valor. Maior cluster do sit-0: **114 px `#EBE1D6`**, luminância **226**. Encosto `#E6C49A` luminância **200**. Delta **26**. No mesmo crop, cabelo `#C8C2B8` (195) contra o encosto: delta **5**. Camisa `#E0A888` (178) contra o encosto: delta **22**. O corpo não tem contorno.

Ordem de draw não é a causa. A cadeira usa `feetY − 0.25`; o corpo usa `feetY`. Um texture por pessoa. O badge é um ponto em y −62. O roster é HTML.

O crop nativo está com alpha 255 e 0 cor fora da rampa. O fantasma já existe opaco. O app acrescenta dois agravantes. `presence.ts` põe `alpha 0.45` em `hold` (`STALE_ALPHA`); `consultant-view.ts` aplica isso no sprite. Colaborador fica em alpha 0.95 ou 0.5, escala 0.55, still em pé. O QA abre com o observer em STALE, e o frame inteiro tem 6115 cores porque `camera.scale` no fit não é inteiro (`#5B8F4E` vira `#678E55`). A borda borrada em cima do torso sem contraste é o que parece translúcido.

### 2. Seis eixos

| Eixo | Referência | Estação atual |
| --- | --- | --- |
| Densidade / clusters | Folha, tábua e roupa em blocos de poucos tons. | Cadeira 5 cores, mesa 5, sit 10, alpha limpo. O bloco existe e é o bloco errado: um retângulo de camisa. |
| Paleta / valor | A roupa é o maior contraste local contra o chão. | Rampa fechada, 34 cores em 1×. Na cadeira, delta 26, 5 e 22 contra a madeira. 373 px de ink viram moldura. |
| Silhueta / anatomia | Uma peça sentada: tronco, braço, perna, contato com o assento. | Bust em pé cortado. Pescoço de 5 px. Corte reto na fileira 55. Sem braço na mesa. A barra de ink parte o pescoço. |
| Perspectiva / escala | Low top-down. O sentado é mais baixo que o em pé e encosta no assento. | Mapa e piloto (44 px) estão na escala. O sit tem 28 px. A cadeira sobe 14 px e o pescoço não a cobre. Monitor em `deskBase − 22`; topo da cabeça em `seatY − 28`. |
| Ambiente / material | Tufo, seixo e veio sem competir com a pessoa. | Piso de tábua lê (`#C4925A` domina o crop). A cadeira é faixa dentro de moldura. O piso ganha da pessoa. |
| Luz / profundidade | Uma direção, face clara, face escura, contato no chão. | Faixa norte da cadeira está certa. O corpo tem 4 px de barra `#B8B5B3`. Sem sombra de contato. A ordem de draw está certa; a silhueta não ocupa o assento. |

### 3. Princípios, sem copiar

Não levar pixel, personagem, telhado, árvore, cerca, UI nem hex da referência.

- A pessoa sentada é o maior contraste local. A roupa não usa o tom do móvel que ela toca.
- Sentar é outra silhueta, mais baixa, quadril no assento, braço no tampo. Cortar a perna do sprite em pé não senta.
- Contorno de 1 px só na silhueta externa. Sem retângulo de ink fechado em volta de quem senta.
- O assento aparece dos dois lados do quadril, em madeira opaca.
- Cluster, luz do norte, alpha 0 ou 255. A cena nativa já cumpre isso e continua valendo.

### 4. Plano

1. **Corpo opaco.** `ConsultantSprite` não aplica `snap.alpha` no sprite. Stale fica no badge. `STALE_ALPHA` sai do pixel. Colaborador: alpha 1, sem still em pé a 0.55 na mesma âncora.
2. **Cadeira sem moldura.** Canvas 16×16, desenho 16×14. Apagar a barra de ink do topo (y 2). Encosto y 2–7: 2 px `#E6C49A`, miolo `#C4925A`. Assento y 8–13 `#8A5A30`, sul 2 px `#4A3018`. Ink 1 px só no perímetro externo. Vão x 3–12, y 6–13 transparente. 4 madeiras + ink.
3. **Corpo sentado novo.** Não é `deriveSit`. Canvas 48×68, âncora na fileira 56. Opaco x 16–31 (16 px), y 28–55 (28 px). Cabeça y 28–41. Ombro 16 px nas fileiras 44–50. Quadril 12 px nas fileiras 51–55. Braço 4×6 de cada lado, fileiras 46–51, 2 px sobre a borda sul da mesa. 4 frames; nos ímpares as mãos descem 1 px. Contorno 1 px `#201B0F`. Alpha 0 ou 255.
4. **Camisa contra a madeira.** O maior cluster da camisa no sit: delta de luminância ≥ 40 contra `#E6C49A` (200) e contra `#C4925A` (153). `#EBE1D6` (226) fica de fora desse cluster. `#C8C2B8` (195) não é a massa da nuca contra o encosto.
5. **Uma estação, lado a lado.** As outras 11 esperam esta passar. Critério na seção 5.

### 5. Experimento mínimo

Uma estação: mesa 48×24 (desenho 32×16), monitor 16×12, cadeira nova 16×16, sit novo 48×68. Nearest-neighbor, zoom 1× e 2×, ao lado do assento atual. Fundo do teste = piso `#C4925A` / `#E6C49A`, não preto.

**1×.** Os quatro:

- Dá para apontar cabeça, ombro e os dois lados de madeira. Nenhuma linha `#201B0F` atravessa o pescoço.
- Maior cluster da camisa com delta ≥ 40 contra a madeira que ele toca.
- Alpha só 0 ou 255. Nenhuma cor fora da rampa. Madeira só nas laterais, 2–3 px de cada lado.
- Pelo menos 4 px de camisa sobre a borda sul da mesa.

**2×.** Os quatro:

- O pescoço continua inteiro.
- Uma cabeça só, alpha 1. Sem segunda cópia.
- Cluster mínimo 2×2, salvo o contorno de 1 px.
- A fileira 56 encosta no assento.

Falhou um item, a estação não replica.

### 6. Paper-doll

Recolor deste north não chega. `deriveSit` copia 32 fileiras e, nos frames ímpares, desce 1 px as 4 colunas de fora. Não inventa quadril, braço nem contorno. Trocar a rampa troca a cor do fantasma; o grisalho (delta 5) e o creme (delta 26) continuam a ser a cadeira. O corpo sentado do passo 3 vem antes. O recolor volta em cima dessa máscara, com o delta do passo 4.

---

## Revisão rodada 1 — independente

29 set 2026. Revisão só de leitura. Não altera sprite, script nem paleta. O autor passou nos 14 itens de `docs/design/base-body/pass-fail.md` e nos itens da estação. Isso não é nível da referência.

Medido no pixel, não no JSON:

- `base-south.png`: opaco 16×39 (x16–31, y17–55), 518 px, 116 deles `#201B0F`. Cabeça até a primeira camisa = 15/39 = 38,5%. Sem a fileira do pescoço (y31) = 14/39 = 36%. Largura da cabeça = largura do ombro = 16. Piloto ao lado: 13×43.
- 131 dos 402 px de preenchimento não cabem num bloco 2×2 da mesma cor. O maior “brilho” do cabelo é uma cunha à esquerda (`#6B4A3A`, 16 px), não um cluster no topo.
- Olhos: 1×2 em x21 e x26, y26–27, 4 px de pele no meio. Sem branco, sem sobrancelha, sem boca.
- Mãos: 2 px de pele dentro do retângulo do tronco (y38–41). A silhueta nesse trecho é uma parede reta.
- Sola y55: 12 px de ink contínuos. Os pés se fundem. Fileira 56 vazia. Sombra de contato: 0 px.
- Hue, luz → sombra: camisa 244° → 246° (+2°), calça 39° → 35°, pele 27° → 19°, cabelo 20° → 14°. A sombra fica mais vermelha, não mais fria. `(B−R)` da sombra da pele é −93; o do claro é −74. Escurecer.
- Estação nova (`docs/design/station/sit-north-0.png`, não o `art/sit-north-0.png`, que ainda é o fantasma creme): 16×28, grade de células 2×2. Tronco = duas faixas (`#4A7C9B`, `#2F5874`). O tom escuro só aparece na costura do quadril. Mãos 2×2 na costela. Monitor: base da mesa opaca em y = `base.y − 16`, fundo do monitor em `base.y − 22`. Vão = **6 px**. `MONITOR_LIFT` 22 com `desk` opaco a partir de minY 8.

O recorte “na mesma escala” em `compare-south-*.png` não serve para medir a referência. O screenshot anexo não está num grid inteiro (o vizinho quase nunca repete a cor). O recorte do autor, período 3,4 em volta do **sentado** (pés de tela 838, 488), enche 48×68 com centenas de cores. Comparar proporção de um corpo em pé com um fazendeiro sentado e filtrado é um teste fraco. A leitura abaixo usa o screenshot e os crops 2× do em pé e do sentado.

### 1. Notas

**Corpo base south: 4/10.**

Dá para ver uma pessoa original, alpha limpo, três tons por material. A 2× o cabelo tem um lado claro. Aí para. Na referência, em pé, a cabeça é a massa mais larga, o cabelo tem um brilho em bloco, o olho lê, a roupa quebra em massas (camisa / macacão), a mão sai do tronco, e não há anel preto. O nosso é um retângulo de 16×39 com degradê esquerda→direita, dois riscos no rosto e uma sola preta. O autor descreveu isso: pouco volume, pouca dobra. A nota não sobe porque os números passaram.

**Estação: 3/10.**

O fantasma saiu. A camisa `#2F5874` (L81) separa da madeira `#C4925A` (L153). Cabeça, pescoço e quadril existem, e a madeira aparece dos dois lados. O sentado da referência ocupa o chão: chapéu com aba desenhada, braço, massa de roupa, contato. O nosso é uma pilha de retângulos 2×2, o monitor flutua 6 px, o braço não chega na mesa. O critério “≥ 4 px de camisa sobre a mesa” conta o tronco atravessando a borda, não um antebraço. Por isso fica abaixo do corpo em pé: a grade 2×2 impede dobra, e o vão do monitor quebra a estação no primeiro olhar.

O limiar de cabeça ≥ 3/8 **não** descreve essa proporção. 38,5% é o desenho medido contra a própria régua, e a régua inclui o pescoço. Na referência o em pé é atarracado: cabeça perto de metade da altura visível e mais larga que o peito. 15 px de cabeça em 39 px de corpo, com o ombro na mesma largura, é um poste. O piloto travado (≈13×44) é ainda mais alto; este corpo encurtou pouco e alargou até 1 tile, sem chegar na massa da referência.

### 2. A régua do autor não chega em “nível referência”

Cada item pode passar com um sprite que a 1× ainda é um decalque.

| Item do autor | Por que passa fácil |
| --- | --- |
| Cabeça ≥ 3/8 e largura ≥ 14 | 15/39 passa. Não exige cabeça mais larga que o tronco, nem altura perto de 2 tiles (32 px). |
| Olhos 1×2 espelhados, gap ≥ 3 | Dois riscos. Não exige catchlight, sobrancelha, boca, nem leitura a 1×. |
| Todo pixel da borda é `#201B0F`, sem 2×2 de ink | Obriga o anel preto. A referência faz o contrário: sel-out. |
| Exatamente 3 tons, centróide do claro à esquerda e acima | Premia degradê lateral. Pune brilho no topo (luz norte, já travada no passe do mapa) e dobra que não esteja na direita. |
| 2 componentes de pele “fora do tronco” | 2 px de pele dentro da caixa da camisa passam. Não exige mão 3×3 nem quebra de silhueta. |
| Sola ink na fileira 55 e ink entre os pés | A sola contínua **cola** os dois pés. Não há sombra no chão. |
| Pixel solto = sem vizinho 4-conexo | 131 px em fita de 1 px passam. Cluster de verdade é 2×2. |
| ΔL ≥ 40 do tom médio contra grama e caminho | O anel preto é que separa. O número não testa leitura. |
| IoU < 0,8 com o piloto | Originalidade de máscara. Não é qualidade. |
| 0 hex igual ao recorte | O recorte é filtrado. Quase qualquer paleta passa. |

O que a régua acerta e fica: alpha só 0/255, paleta fechada, não copiar hex nem a roupa vermelha+azul, âncora na fileira 55 com a 56 vazia.

### Rubrica de produção

“Igual à referência em qualidade” = os 10 abaixo, no sprite em pé sul, olhado a 1× em cima de `grass-0` e de `path-0`. Um item falho = a rodada não sobe de nota.

1. **Proporção.** Altura opaca 32 px (y24–55), cabeça cabelo+rosto 15 px (47%), pescoço fora dessa conta. Largura da cabeça ≥ largura do tronco + 4 px. Tronco ≤ 11 px. Como medir: caixa opaca e a primeira fileira de camisa. Passa se altura = 32, cabeça/altura ∈ [0,44, 0,52], cabeça mais larga que o tronco por ≥ 4.

2. **Cabelo com massa e brilho.** Um cluster 4-conexo do tom claro, ≥ 4×3 px, encostado no norte do cabelo (não uma cunha que ocupa o lado esquerdo inteiro). O tom médio do cabelo cobre mais px que o claro e que o escuro. Passa se esse cluster existe e o claro é < 30% dos px de cabelo.

3. **Rosto a 1×.** Cada olho é 2×1: 1 px `#201B0F` + 1 px do tom claro da pele, na mesma fileira. Sobrancelha de 1×3 no tom escuro do cabelo, encostada em cima. Boca 2×1 no tom escuro da pele, no centro, sem ink. Gap entre os olhos 3–4 px de pele. Passa se os seis grupos existem e, a 1× na grama, dá para apontar olho e boca sem zoom.

4. **Braço e mão.** Cada mão é um bloco de pele ≥ 3×3 que sai ≥ 2 px para fora da caixa do tronco. A manga acaba 1 px antes da mão, no tom escuro da camisa. Passa se a silhueta tem dois dentes laterais e nenhuma mão é uma mancha de 2 px dentro do retângulo.

5. **Dobras.** Camisa e calça: 2 ou 3 clusters do tom escuro, cada um ≥ 2×2 e ≥ 4 px, no sul da forma (luz norte). Proibido faixa vertical de 1 px. Passa se a contagem de clusters escuros por material está em [2, 3] e nenhum deles tem largura 1.

6. **Hue shift.** Por material, `(B−R)` do tom escuro ≥ `(B−R)` do tom claro + 15, e a luminância cai claro → médio → escuro. Não basta multiplicar o RGB. Alvos desta base, sem copiar a referência: pele claro `#F6D0A0` / escuro `#A88880`; camisa claro `#8A6A9A` / escuro `#242E58`; calça claro `#F0D8A8` / escuro `#827868`; cabelo claro `#C49A72` / escuro `#3A3044`. Passa se os quatro materiais cumprem o `(B−R)` e nenhum escuro é só o claro × k.

7. **Sel-out.** `#201B0F` só no olho e na fresta entre os sapatos. Contorno externo = tom escuro do material que ele toca. Aresta norte iluminada pode encontrar o transparente no tom claro ou médio. Passa se os px de ink são ≤ 16 (hoje são 116) e existe aresta norte sem ink.

8. **Sombra de contato.** Fora do PNG do corpo (a fileira 56 continua vazia). No composto do teste: 12×2 px centrados no pé, fileiras 56–57, `#3E6A38` em cima e `#2A4A26` embaixo na grama; no caminho, `#D9C4A4`. Sem ink. Passa se esse bloco existe nos dois fundos e não cola nos sapatos.

9. **Leitura a 1×.** Sobre grama e sobre caminho, sem zoom: aponta-se cabeça, dois olhos, duas mãos, dois pés separados e o chão embaixo. O corpo não pode ser um retângulo de uma cor com borda preta. Passa só com os itens 1–8 já verdadeiros e os dois compostos (`compare` 1×) mostrando isso. “Melhorou” não conta.

10. **Original e limpo.** Nenhum hex da referência. Roupa não é camisa vermelha + macacão azul. Alpha só 0 ou 255. ≤ 16 cores. O desenho não é o piloto (IoU < 0,8 fica como trava de cópia interna, não como qualidade).

### 3. Cinco ajustes do corpo south, em ordem

A âncora não muda: último opaco na fileira 55, fileira 56 vazia, centro x = 23,5.

1. **Silhueta, antes de pintar dobra.** Altura 32 px, topo y24. Cabeça x17–30 (14 px), y24–38. Pescoço x20–27, y39–40. Tronco x19–28 (10 px), y41–48. Pernas x19–22 e x25–28, y49–52, com x23–24 transparentes. Sapatos y53–55, separados por 1 coluna transparente em x23. Cabeça 4 px mais larga que o tronco. Sem este passo, dobra nenhuma salva o poste de 16×39.

2. **Apagar o anel e separar os pés.** Tirar `#201B0F` da silhueta. Aresta sul e lateral = tom escuro do material (`#3A3044` no cabelo, `#A88880` na pele, `#242E58` na camisa, `#827868` na calça, `#3A241C` no sapato). Aresta norte do cabelo fica no tom claro, sem contorno. Ink só nos olhos e na coluna x23 entre os sapatos. A fileira 55 deixa de ser uma barra de 12 px. Sombra de contato 12×2 no composto, como na rubrica 8, não dentro do PNG.

3. **Rosto e brilho do cabelo.** Brilho `#C49A72` em x18–21, y25–27 (4×3). Olhos na y33: esquerdo x20 ink + x21 pele clara; direito x26 ink + x27 pele clara. Sobrancelha y32, 3 px de `#3A3044`, em cima de cada olho. Boca y36, x22–23, `#A88880`. Sem isto o 1× continua um oval com dois riscos.

4. **Dobras no sul + hue.** Trocar a rampa lateral pelos hex da rubrica 6. Camisa: cluster escuro 3×4 em x20–22, y45–48; cluster claro 3×2 no ombro norte, y41–42, x19–21. Calça: 2×3 escuro atrás de cada joelho, y50–52, nas colunas internas da perna. Apagar as fitas de 1 px (`9` na camisa, `C` na borda da calça). Luz norte: o claro tem centróide y menor que o escuro. O teste antigo “claro à esquerda” sai.

5. **Mãos.** Cada uma 3×3 de pele, y45–47, esquerda x16–18, direita x29–31 (2 px fora do tronco). Polegar 1×2 no norte da mão, tom claro. A manga (tom escuro da camisa) ocupa só y44 nessa coluna. A silhueta deixa de ser reta na altura do cotovelo.

### 4. Método

Matriz de caracteres revisável, a que o corpo south já é (`ROWS_ART` em `paint-base-body.ts`). Uma célula = um pixel. A rodada 2 edita essa matriz e só passa na rubrica nova.

Desenhar por código que preenche retângulo não chega. O sentado é isso: `SIT_CELLS` em blocos 2×2 mais `fillRect`. Essa grade tem teto, e o teto é a nota 3 da estação. Centróide, “exatamente 3 tons” e “borda = ink” empurram o desenho para o degradê que já está na tela.

PixelLab, mesmo maior e depois limpo, não é o próximo passo. A rubrica é posição de cluster em px e hue medido. Geração gasta o trial, escorrega paleta e contorno, e a limpeza volta a ser a mesma matriz. O screenshot da referência já mostrou o custo de reamostrar: o recorte de comparação não está em pixel inteiro.

Quando a matriz do sul passar nos 10 itens a 1×, o sentado usa outra matriz, não a grade 2×2. O vão de 6 px do monitor é layout (`MONITOR_LIFT` 22 contra o tampo opaco), e se resolve no mesmo passe da estação, fora desta rodada do corpo.

---

## Revisão rodada 2 — independente

29 set 2026. Só leitura. Pixel medido na matriz (`scripts/body-art.ts`) e no layout, não no `pass: true`.

O corpo opaco é 16×32 (x16–31, y24–55). A referência original também é um frame de 16×32. O recorte do compare continua amostrado com período 3,4 num screenshot filtrado: serve para ver a pessoa, não para contar hex.

### 1. Notas

| | Rodada 1 | Rodada 2 |
| --- | --- | --- |
| South | 4 | **6** |
| North | — | **5** |
| East / west | — | **5** |
| Estação | 3 | **4** |

South subiu de verdade: proporção 32 px, sel-out, hue, joelhos, mãos 3×3, pés separados, sombra no chão. Ao lado da referência o cabelo ainda é um oval e a camisa ainda é um tubo com barra escura.

North não tem rosto. Isso está certo: é a nuca. A nota não sobe porque o cabelo é o mesmo capacete, com fios de 1 px (y30–31, y35–37) que somem a 1×.

East e west têm um olho. Isso também está certo de perfil. O nariz é 1 px (east, x31 y34 só). A 1× não quebra a silhueta. West é o espelho; a luz é norte, então o flip não inverte a luz.

Estação: o monitor encosta no tampo (vão 0; antes 6). O braço esquerdo sobe à mesa (mão 3×3 em x14–16, y39–41). A cena perde porque a cadeira e o corpo estão 8 px à direita do monitor. Mesa `span: 2`, centro em `(col+1)×16`. `seatCell` é `col+1`, centro em `(col+1,5)×16`. Diferença fixa de meio tile. O JSON não mede esse alinhamento.

### 2. Rubrica, item a item

| # | Veredito | Por quê |
| --- | --- | --- |
| 1 Proporção | Passa | 32 px, cabeça 15/32 = 0,47, cabeça 14 × tronco 10. Conferido na matriz. |
| 2 Cabelo | Passa frouxo | Existe um 4×3 dentro do claro, e o claro é 17/119 px (14%). O claro é uma cunha x18–23 × y24–27, o lado esquerdo da coroa. A rubrica pedia para não ser essa cunha. O checker só testa `hasBlock(4,3)`. |
| 3 Rosto south | Passa a geometria, falha a leitura | Olhos x20+21 e x26+27 na y33, boca x22–23 y36, gap 4. A carranca é o `H` em x23 y31, no vão das sobrancelhas. |
| 3 North | Passa | Sem ink na cabeça. Não é limite da escala. |
| 3 Perfil | Passa | Um olho é o certo. “Impossível fazer melhor” não cola: o nariz já existe e tem 1 px; falta altura, não resolução. |
| 4 Mãos | Passa | 3×3, 3 px fora do tronco, punho `D` na y44. Luva sem polegar separado. Na rubrica, passa. |
| 5 Dobras | Calça passa; camisa frouxa | Joelhos `q` são 2×3 de cada lado, separados. Na camisa, y48 é `DDDDDDDDDD` (10 px) e cola o bloco x20–22 com o x26–27. O “cluster de 23 px, largura 10” é a barra, não uma dobra. O checker aceita porque são 3 componentes e a largura é ≥ 2. |
| 6 Hue | Passa | Paleta é a da rubrica. `(B−R)` sobe e a luminância cai. Não é o claro × k. |
| 7 Sel-out | Passa o ink; a borda fica curta | South: 2 px de ink (os olhos). 58/76 da borda sul e lateral estão no tom escuro. 18 px não estão (o `o` da y53, por exemplo). O checker não olha a fração. |
| 8 Sombra | Passa | 12×2 no composto, `#3E6A38` / `#2A4A26` na grama, `#D9C4A4` no caminho. Fileira 56 do PNG vazia. |
| 9 Leitura 1× | South passa a olho. North não | Dá para apontar cabeça, olhos, mãos e pés no sul. O JSON das quatro direções repete a mesma frase, inclusive “olhos apontáveis” nas costas. O checker liga isso com `READS_1X`, não com pixel. |
| 10 Original | Passa | ≤ 16 cores, alpha 0/255, IoU com o piloto &lt; 0,8, roupa índigo + cáqui. |

### 3. Veredito

Não está no nível de produção pedido. Não é “APROVADO PARA RODADA 3”.

Paper-doll e walk continuam no corpo velho. Mesmo com o sul a 6, eles não herdam esta matriz.

Ajustes que faltam, em ordem:

1. **Cabelo deixa de ser oval.** Brilho só x20–23, y24–26 (4×3). Apagar a cunha x18–19 y25–27. Um mechão 2×5 só de um lado (south: x17–18, y30–34, tom `h`), sem espelhar. Apagar os fios `H` de 1 px na nuca (north y30–31 e y35). Contorno em degrau de 2 px, não em arco simétrico.

2. **Sobrancelha neutra.** Apagar `H` em x23 y31. Sobrancelhas y32 em x19–21 e x26–28. Vão x22–25 só pele `S`.

3. **Separar a dobra da barra.** y48 vira `t`, com `D` só em x22–25. O bloco x20–22 y45–47 fica um componente; o x26–27 y46–47 fica outro. Os dois ≥ 2×2, nenhum com largura 10.

4. **Nariz de perfil com 2 px.** East: x31 opaco em y34 e y35 (pele `s`), não só na y34. West espelha. Continua um olho.

5. **Estação, −8 px.** Monitor fica em `base.x`. Cadeira e corpo sentado também, não em `seat.x`. O `seatCell` (`col+1`) pode continuar para o caminho; a âncora do sprite é o centro da mesa. Sem isso o braço novo aponta para o lado da tela.

### 4. Escala

32 px de altura não é o teto. O frame da referência é 16×32, cabeça na casa dos 15 px, tile do mundo 16. Estamos nessa densidade. O que a referência tem a mais cabe nesse retângulo: contorno de cabelo irregular, quebra de roupa, nariz de 2 px. Não é um sprite de 32×64 espremido.

Subir o corpo para ~48 px (o piloto, ~3 tiles) ou o tile para 24 dá pixel para fio de cabelo, e custa o mapa. A mesa tem 2 tiles (32 px): a pessoa volta a ser maior que o tampo. As rotas e o vão da porta estão cortados para um corpo de ~1 tile de largura. Não é o próximo passo. O próximo passo são os cinco ajustes acima, na mesma matriz 16×32.

---

## Revisão rodada 2b — independente

29 set 2026. Só leitura. Conferido na matriz de `scripts/body-art.ts` e em `seatAnchor`, não no `pass: true`.

### 1. Notas

| | Rodada 2 | Rodada 2b |
| --- | --- | --- |
| South | 6 | **7** |
| North | 5 | **6** |
| East / west | 5 | **6** |
| Estação | 4 | **6** |

### 2. Os cinco ajustes

1. **Cabelo.** Resolvido. Brilho é `A` só em x20–23, y24–26 (12 px, um componente). Mechão `h` em x17–18, y30–34 (2×5), sem espelho. y29 entra 2 px e y30 sai. North y30–31 e y35 não têm mais o fio de 1 px.
2. **Sobrancelha.** Resolvido. x23 y31 é `S`. Barras y32 em x19–21 e x26–28. Vão x22–25 é pele.
3. **Dobra da camisa.** Resolvido na leitura, com sobra. A barra de 10 px acabou: y48 escuro só em x22–25. O bloco direito x26–27 y46–47 está solto (4 px). O esquerdo ainda encosta na barra por x22 y47, então vira um cluster de 12 px e largura 6, não dois. Não é mais o tubo. Não bloqueia.
4. **Nariz.** Resolvido. East x31 opaco em y34 e y35. West é o espelho. Continua um olho.
5. **Âncora.** Resolvido. `seatAnchor` devolve `x` do centro da mesa e `y` da cadeira. O compare 2b desenha cadeira e corpo nesse x (832 = 832). O painel da esquerda ainda usa `seat.x` e fica 8 px à direita.

### 3. Veredito

**APROVADO PARA RODADA 3.** Paper-doll, walk, lazer e a integração no app partem deste corpo.

O que falta é polimento, não estrutura. Um derivado que respeitar as três regras abaixo chega no nível da referência. Um que redesenhar o oval, achatar o tom ou recentrar no tile da cadeira não chega.

Polimento para depois, sem segurar a rodada 3:

- Separar a dobra esquerda da barra (cortar o `D` em x22 y47).
- Borda sul/lateral ainda está 46/75 no tom escuro. O `o` da y53 é o caso.
- Mais um mechão por formato de cabelo fica no paper-doll, não numa quarta revisão desta matriz.

### 4. Três regras para não degradar

1. **Recolor não move pixel.** Troca a rampa de 3 tons. O escuro mantém `(B−R)` pelo menos 15 acima do claro. Olho `#201B0F` e boca no tom escuro da pele não entram na cor da camisa.
2. **Walk nasce desta matriz.** 6 frames, último opaco na fileira 55, fileira 56 vazia. Cada frame guarda pés separados, mão de pelo menos 3×3 (ou o braço alongado no lugar dela) e o degrau do cabelo. Não voltar ao oval liso.
3. **Sentar usa `seatAnchor`.** Cadeira e corpo no x da mesa, não no centro do `seatCell`. A sombra de contato continua decalque no chão, fora do PNG.

---

## Revisão rodada 3 — cena inteira

29 set 2026. Só leitura. `scene-1x.png` é das 18:55; o lodge da rodada 3 é das 20:38. O mapa inteiro ainda mostra o still antigo de camisa clara. O chão e os props não mudaram desde as 16:50, então a ilha desse arquivo vale para grama, caminho, copa e cerca. Personagem, walk, lazer e estação foram julgados em `docs/design/r3/`. Não rodei o render: ele grava PNG.

### 1. Notas

A nota geral pesa a área. O corpo a 7 não levanta um campo que é a maior parte do quadro.

| Categoria | Nota | Contra a referência |
| --- | --- | --- |
| Personagem parado | **7** | O sul aprovado. O elenco lê chapéu, pele e roupa. O cabelo ainda é um formato só. |
| Walk | **5** | 6 frames. O pé sobe 2–3 px (`liftRun`) e a cabeça 1 px. A 1× o passo some. Na referência a perna troca de lado e o braço acompanha. |
| Lazer | **4** | Fogueira é o mesmo banco. O machado desloca o braço −1/−3 px e o ferro é carimbo. Ajoelhar corta 6 fileiras (`top + 6`, `slice(0, -6)`). |
| Estação | **6** | O sentado da 2b, no centro da mesa. A parede atrás é a mesma tábua repetida. |
| Chão | **4** | Grama: base `#5B8F4E` e um tufo 6×4. Caminho: retângulo 8×8 de `#D9C4A4` em todo tile (o comentário no código pede a faixa de 25%). Água: elipse azul com faixa de pedra. |
| Árvores | **3** | Uma copa. `paintMass` soma círculos e quantiza em 4 verdes, com anel `#201B0F`. A referência é um grupo de folhas separadas, sem anel. |
| Props | **5** | A cerca tem poste 4×14 e dois trilhos com luz. O arbusto é o mesmo círculo da copa. A flor é três barras. |
| Lodge | **4** | Parede = faixa de 16 px (`woodDark` + 2 px claros + faixa funda). Sem plano de telhado. A porta é o único objeto. |
| Composição | **4** | Portão, lago, fogueira, horta e lodge estão no lugar. Entre eles, grama igual e a mesma copa em anel. |
| **Geral** | **4** | Dá para ler o escritório. Não está no nível da referência. |

### 2. Elo mais fraco

A copa. É o maior objeto repetido e o que a referência resolve primeiro: cada árvore é um punhado de massas de folha, claro no norte, escuro no sul, buraco entre massas, sem contorno preto. A nossa é um blob de círculos com anel. A grama é a maior área, mas um tufo a mais não muda o quadro enquanto dezesseis copas iguais continuarem iguais.

### 3. Plano da rodada 4

1. **Copa, em matriz, duas variantes.** Canvas 64×48. Cinco massas, cada uma entre 8×8 e 14×10, com 2 px de transparente entre pelo menos duas, para não fundir. Norte da massa `#7AAA62` (2 px), miolo `#5B8F4E`, sul `#3E6A38` (3 px). `#2A4A26` só na fresta, no máximo 8 px. Sem `#201B0F`. `canopy-b` espelha duas massas. O tronco ganha 2 px de `#C4925A` na face norte; a largura de 8 px fica.
2. **Grama.** `grass-0` e `grass-1`: dois tufos 3×2, cantos opostos, não um bloco 6×4. `grass-2` continua a flor 2×2. A sombra do tronco que já existe fica. Nenhuma cor nova.
3. **Caminho.** Apagar o `rect(4, 4, 8, 8)` de todo tile. No lugar, um seixo 4×3 numa posição do hash, com 1 px `#FFF8F1` no norte. A mordida de 6×1 de grama na borda fica.
4. **Arbusto com o mesmo método da copa**, 24×16, três massas, sem anel. Onde a grama corre mais de 8 tiles sem prop, entra um arbusto. Isso é o que enche o vão entre os marcos.
5. **Lodge.** A cada 4 tiles de parede, um poste de 2 px `#4A3018` de cima a baixo. O topo (`LODGE.top`) ganha uma segunda fileira `#E6C49A` para ler como plano, não como faixa.

O passo de 4 px no walk e a ferramenta desenhada (cabo 2×10 `#5A3A2A`, cabeça 4×3 `#8A5A30`) vêm na sequência. Não sobem a nota geral enquanto a copa for blob.

### 4. Gate final

A cena está no nível da referência quando tudo isto for verdade, medido a 1×:

- Parado ≥ 7. Walk ≥ 7: o pé sobe ≥ 4 px nos frames de contato e isso se vê sem zoom.
- Chão ≥ 7: nenhum tile de caminho tem um retângulo ≥ 6×6 da mesma cor; a grama tem 3 variantes que mudam a posição do cluster, não só uma faixa.
- Árvores ≥ 7: duas copas, zero anel de ink, cada uma com ≥ 4 massas de folha ≥ 6×6 separadas por transparente.
- Props ≥ 6. Lodge ≥ 6: a parede não é um tile só repetido; o topo lê como plano.
- Composição ≥ 6: não há retângulo de grama maior que 8×8 tiles sem tufo, flor ou arbusto.
- **Geral ≥ 7.** Abaixo disso, a rodada não para.

---

## Rodada 5

29 set 2026. Julgado a 1× no mapa inteiro (`docs/design/r5/scene-1x.png`), não no crop. A rampa de folhagem, grama e caminho passa a 5 tons. Luz mais quente, sombra mais fria. Sem anti-alias. Alpha só 0 ou 255. As seis âncoras Daylit Commons não mudam.

Tons novos:

| Tom | Hex | Papel |
| --- | --- | --- |
| `grassSun` | `#A8D07A` | Norte do tufo e da folha. Mais quente que `#7AAA62`. |
| `pathWorn` | `#C6AE90` | Campo do caminho. Mais escuro que `#F3E8D4`. |
| `pathShade` | `#7A756C` | Borda e seixo. Mais frio e mais escuro que `#D9C4A4`. |

### Notas

| Categoria | R4 | R5 | Gate |
| --- | --- | --- | --- |
| Parado | 7 | **7** | 7 |
| Walk | 7 | **7** | 7 |
| Chão | 5 | **6** | 7 |
| Árvores | 6 | **7** | 7 |
| Props | 5 | **6** | 6 |
| Lodge | 5 | **6** | 6 |
| Composição | 5 | **6** | 6 |
| **Geral** | — | **6** | 7 |

O chão é a maior área. Com ele em 6, o geral não passa.

### O que mudou

- Grama: quatro layouts (`grass-0`, `grass-1`, `grass-3`, `grass-4`) mais flor e sombra. O hash escolhe o layout e empurra o tufo. Tufo com brilho no norte, 5–8 px, não a faixa de 3×2.
- Caminho: o campo é `#C6AE90`, não o creme. Borda `#7A756C`. Mancha clara e seixo mudam de tile. A mordida de grama fica.
- Copa: tufos de 6–8 px, brilho no canto norte de cada um, silhueta recortada, contorno `#2A4A26`. Sem `#201B0F`. Três variantes.
- Arbusto: dois lobos com um vale no meio, o mesmo sel-out.
- Telhado: fiadas de telha, norte claro, sul escuro, beiral `#4A3018`. A parede lateral são dois troncos.
- Sombra de contato em elipse ao sul de árvore, arbusto e pedra. A grama que toca caminho ou água ganha uma faixa escura.

Parado e walk não foram redesenhados. O pé do walk continua subindo 4–6 px. Colisão, nav-grid, 12 mesas e âncoras não mudaram.

### O que segura cada nota abaixo do gate

- **Chão, 6.** A 1× o caminho deixou de ser laje creme: é uma fita tan com borda escura, e a grama tem tufo. Não chega a 7 porque o miolo ainda é um pontilhado miúdo. Dá para ver textura, não dá para apontar centro gasto contra borda.
- **Geral, 6.** Árvore, prop, lodge e composição batem o gate. O chão puxa o quadro para baixo.

---

## Revisão rodada 5 — independente

29 set 2026. Só leitura. Não altera sprite nem código. Julgado a 1× em `docs/design/r5/scene-1x.png` (1280×720) e depois nos crops 2×. Walk e lazer em `docs/design/r4/`, porque o corpo não foi redesenhado. A nota do autor (parado 7, walk 7, chão 6, árvores 7, props 6, lodge 6, composição 6, geral 6) não entra na conta.

### 1. Notas

| Categoria | Autor | Esta revisão | Gate |
| --- | --- | --- | --- |
| Parado | 7 | **7** | 7 |
| Walk | 7 | **7** | 7 |
| Chão | 6 | **5** | 7 |
| Árvores | 7 | **6** | 7 |
| Props | 6 | **6** | 6 |
| Lodge | 6 | **6** | 6 |
| Composição | 6 | **6** | 6 |
| **Geral** | 6 | **5** | 7 |

**FAIL.** Parado, walk, props, lodge e composição passam. Chão, árvores e o geral não.

### 2. Medido no pixel

Cena: **45 cores**, alpha só 0 ou 255. Fora do creme, a luminância é **escuro 9,7% / meio 76,7% / claro 13,6%**. Na revisão 2 era 5,7 / 82 / 12. O telhado e a borda do caminho escureceram um pouco. Continua uma laje de valor médio. A referência de leitura reparte escuro, meio e claro perto de um terço cada.

**Chão, 5.** A grama da rampa são 462516 px; `#5B8F4E` é **64%**. O tile 24,28 (grama aberta) tem dois tufos na metade norte e as fileiras 10–15 vazias, só base. No crop do chão, os clusters claros (`#A8D07A` + `#7AAA62`) são 108; a mediana tem 8 px; 52 têm menos de 8. A 1× isso é sal, não folha que se aponta.

Caminho: 247 células dominadas por `#C6AE90`, 220 delas interiores. Nessas células o campo gasto é **73%** do tile. Creme 3%, areia 3%. Dos 387 clusters claros interiores, **211 têm ≤ 4 px** e a mediana é **4×1**. O tile 38,20 é o caso: campo vazio, um traço `CCCCC` de 5×1 e um seixo de 2×2 debaixo de outro traço. A borda `#7A756C` é um fio de 2 px. Dá para ver textura. Não dá para apontar centro gasto contra borda. Por isso não é 6.

**Árvores, 6.** Três variantes, zero `#201B0F`, silhueta recortada. Aí para. `tree-canopy.png` é **um** componente, 53×37, 1296 px. `#3E6A38` são 760 px (**59%**). O sol `#A8D07A` são **45 px** em 9 tufos, o maior 4×2. `#2A4A26` são 219 px, 99 deles encostados no transparente: o sel-out virou aro. O arbusto é o mesmo caso, um componente de 21×12, 8 px de sol. A folha não está separada. Não é 7.

**Walk, 7.** No sheet 2×, em 1×: south frame 0, uma sola na fileira 55 e a outra na 51 (sobe **4**). Frame 2, a sola que anda está na 49 (sobe **6**). East repete 4 no contato e 6 no passe. O braço acompanha. O gate do pé está cumprido. Lazer continua o mesmo ciclo curto; não entra nesta nota.

**O que passa e fica.** Parado é o corpo da 2b, 32 px, e lê no mapa. Lodge: o topo é plano de telha, norte claro, sul escuro, beiral escuro; a lateral são dois troncos. Não sobe a 7 porque o piso ainda é a mesma tábua. Props: cerca, fogueira, canteiro e pedra se separam. Composição: portão, lago, lodge, fogueira e horta estão no lugar. O maior retângulo só de grama é 16×9 tiles, mas cada célula tem tufo — o vazio da rodada 3 saiu. O que falta nele é valor, e isso é o chão, não um segundo defeito de planta.

A margem do lago é um retângulo cinza e a água é traço. Não é o próximo ganho: caminho e grama ocupam mais quadro.

### 3. Três ajustes, em ordem

Rampa fechada, inclusive `grassSun` `#A8D07A`, `pathWorn` `#C6AE90` e `pathShade` `#7A756C`. Sem cor nova. Sem mexer no corpo, no walk, na planta nem nas 12 mesas.

**1. Caminho: apagar o traço, pintar bloco.** É onde o consultor pisa, e é o defeito do crop 2×.

- No tile interior (4 vizinhos caminho), apagar o `rect` de 5×1 ou 7×1 em `#FFF8F1`. Esse traço é o pontilhado.
- No lugar, um scuff **6×4** `#7A756C` na metade sul, posição pelo hash, fora da borda. A fileira norte desse scuff é **6×1** `#D9C4A4`.
- Um seixo **4×3**: fileira norte `#FFF8F1`, as duas de baixo `#D9C4A4`. Altura 3, não 1.
- Na borda com grama, a faixa `#7A756C` passa de 2 px para **3 px**, só do lado da grama. Os 8 px do miolo continuam `#C6AE90`, para o centro e a borda serem duas coisas.
- Passa se, num tile interior, `#C6AE90` ≤ 60% e nenhum cluster de `#FFF8F1` tem altura 1. A 2× aponta-se o seixo e o scuff sul.

**2. Grama: um tufo por tile, e um terço dos tiles mais escuro.** É a maior área. Dois tufos de 5–8 px em campo chapado viram sal a 1×.

- `grass-0` e `grass-1`: um tufo só, **8×5**. Norte 8×2 `#A8D07A`, miolo `#7AAA62`, sul 8×2 `#3E6A38`. O hash só desloca. Apagar o segundo `paintClump` e o spill em x = 14.
- Quando `(col + row) % 3 === 0` e a célula é grama clara, a base do tile inteiro é `#3E6A38` e o tufo não leva sol: norte `#7AAA62`, sul `#2A4A26`. Um em três. Vira mancha, não adesivo.
- `grass-2` continua a flor 4×4. Duas flores não se encostam.
- Passa se, num recorte 64×64 de grama aberta, cada componente claro tem ≥ 12 px e cada tile tem no máximo um. A 1× a mancha escura se aponta sem zoom.

**3. Copa: cinco massas, sem aro.** O objeto repetido. Hoje é um blob escuro com faísca de 3×2.

- Canvas 64×48. Cinco lóbulos, cada um entre **10×8** e **14×10**. Entre pelo menos dois, **2 px transparentes**. `weldSprite` não fecha vão de 2 px. O buraco não se preenche com `#3E6A38`.
- Cada lóbulo: norte **3×2** `#A8D07A`, miolo `#7AAA62`, sul **3 px** `#3E6A38`. `#2A4A26` só na fresta, ≤ 12 px no sprite. Aresta norte encontra o transparente em `#A8D07A` ou `#7AAA62`. Sem `selOut` escuro no perímetro.
- Variante B espelha dois lóbulos. Variante C troca um lóbulo norte por flor 4×4 (`#FFF8F1` em cima, `#D4A04A` embaixo).
- O arbusto repete o método em 24×16, três massas, o vale de 3 px fica transparente.
- Passa se a copa tem ≥ 4 componentes opacos de pelo menos 6×6, `#A8D07A` + `#7AAA62` ≥ 45% dos px opacos, `#2A4A26` ≤ 8%, zero `#201B0F`.

## Rodada 6

29 set 2026. Julgado a 1× no mapa inteiro (`docs/design/r6/scene-1x.png`). Três correções, nessa ordem. Parado, walk, props, lodge e composição não foram redesenhados.

Corte de valor, o mesmo da revisão: fora de `#FFF8F1`, luminância BT.709. Escuro abaixo de 90, claro a partir de 170. Nesse corte a rodada 5 lê 9,7% / 76,7% / 13,6%.

### Medido

| Medida | R5 | R6 |
| --- | --- | --- |
| Fora do creme: escuro / meio / claro | 9,7% / 76,7% / 13,6% | **8,3% / 77,7% / 14,0%** |
| Caminho interior em `#C6AE90` | 73% | **83,6%** (99 tiles) |
| Copa, `#A8D07A` + `#7AAA62` | 45 px de sol | **58,4%** (A e B), **56,4%** (C) |

`#3E6A38` tem L≈93. A mancha de grama escura fica no balde do meio. Por isso o escuro da cena desceu, não subiu.

### Notas

| Categoria | Revisão R5 | R6 | Gate |
| --- | --- | --- | --- |
| Parado | 7 | **7** | 7 |
| Walk | 7 | **7** | 7 |
| Chão | 5 | **6** | 7 |
| Árvores | 6 | **6** | 7 |
| Props | 6 | **6** | 6 |
| Lodge | 6 | **6** | 6 |
| Composição | 6 | **6** | 6 |
| **Geral** | 5 | **6** | 7 |

### O que mudou

- Caminho interior: o traço 5×1 de `#FFF8F1` saiu. No lugar, scuff 6×4 `#7A756C` na metade sul, fileira norte 6×1 `#D9C4A4`, e um seixo 4×3 (norte `#FFF8F1`, corpo `#D9C4A4`). O hash espalha os dois. Onde o caminho encontra grama ou água, faixa de 3 px `#7A756C`. O miolo continua `#C6AE90`.
- Grama: um tufo 8×5 por tile. Nos quatro layouts o hash só empurra. Norte `#A8D07A`, uma fileira `#7AAA62`, sul `#3E6A38`. Cerca de um terço dos tiles, em blocos de 5×4 com a borda falhada, tem a base inteira `#3E6A38` e o tufo sem sol. `grass-dark` não entra nisso, para a sombra do tronco ainda voltar a `#5B8F4E` no sul.
- Copa: cinco lóbulos, 10×8 a 14×10, vão transparente de 2 px entre vizinhos. Sem sel-out. A aresta sul é `#3E6A38`, a norte é o tom claro. Canvas 64×48, última fileira opaca no fundo. Variante B espelha. Variante C troca o lóbulo norte por uma flor 4×4. O arbusto não mudou.

A bíblia agora diz que o contorno sem sel-out vale só para folhagem. O arbusto ainda tem o sel-out antigo.

### O que segura a nota

- **Chão, 6.** O scuff e o seixo são blocos, não um traço de 4×1. A mancha escura da grama se aponta a 1×. Não chega a 7: o interior do caminho é 83,6% um tan só, e o terço de valor da cena não andou.
- **Árvores, 6.** A copa deixou de ser um blob 59% `#3E6A38`. São cinco lóbulos e o claro passa de 45%. A 1× ainda some na grama, porque usa a mesma família de verde.
- **Geral, 6.** O que já passava continua. O chão subiu de 5 para 6 e puxa o quadro junto. O gate é 7.

---

## Revisão rodada 6 — independente

29 set 2026. Só leitura. Não altera sprite nem código. Julgado a 1× em `docs/design/r6/scene-1x.png` (1280×720), depois nos crops 2× (`crop-ground-2x.png`, `crop-tree-2x.png`) e no `compare-r5-r6.png`. Props, lodge e composição conferidos no mesmo mapa e em `crop-lodge-2x.png`. Walk medido na matriz atual (`shoeRise`), não no JSON da rodada 4. A nota do autor (parado 7, walk 7, chão 6, árvores 6, props 6, lodge 6, composição 6, geral 6) não entra na conta.

### 1. Notas

| Categoria | Autor | Esta revisão | Gate |
| --- | --- | --- | --- |
| Parado | 7 | **7** | 7 |
| Walk | 7 | **7** | 7 |
| Chão | 6 | **6** | 7 |
| Árvores | 6 | **6** | 7 |
| Props | 6 | **6** | 6 |
| Lodge | 6 | **6** | 6 |
| Composição | 6 | **6** | 6 |
| **Geral** | 6 | **6** | 7 |

**FAIL.** Parado, walk, props, lodge e composição passam o gate. Chão, árvores e o geral não.

### 2. Medido no pixel

Cena: **45 cores**. Fora de `#FFF8F1`, luminância BT.709 (escuro &lt; 90, claro ≥ 170): **8,28% / 77,72% / 14,01%**. O autor escreveu 8,3 / 77,7 / 14,0. Confere. A rodada 5, no mesmo corte, era 9,72 / 76,68 / 13,60. O escuro desceu. O meio subiu. A laje de valor médio ficou.

As outras duas medidas também conferem, e as duas são o defeito:

- Caminho interior, `paintCell`, 4 vizinhos caminho: **99 tiles**, `#C6AE90` = **83,59%**. Os 99 têm um retângulo ≥ 6×6 dessa cor. O pior é 16×9 (144 px) em col 39, row 16. O teste da revisão 5 pedia `#C6AE90` ≤ 60% e nenhum traço de altura 1. A altura 1 saiu. A área não.
- Copa A e B: 486 px opacos, `#A8D07A` + `#7AAA62` = **58,4%**, cinco componentes (14×9, 14×10, 12×8, 12×9, 14×10), zero `#201B0F`, zero `#2A4A26`. Copa C: **56,4%** claro, quatro massas ≥ 6×6 mais a flor 4×4. O teste numérico da revisão 5 passa. A 1× não.

`#3E6A38` tem L = 93,0. A mancha “escura” da grama (580 de 1885 tiles, base com menos de 100 px de `#5B8F4E`) cai no balde do meio. `#C6AE90` tem L = 176,9 e cai no claro. Por isso pintar mais mancha e manter o tan como fill empurra o histograma para o lado errado.

**Chão, 6.** A 1× a grama deixou de ser um verde só: a mancha `#3E6A38` se aponta no mapa inteiro, e o compare contra a rodada 5 mostra isso. O caminho ganhou borda de 3 px. Não chega a 7. No crop 2× o miolo continua uma laje tan com traços de 6×4. Centro gasto e borda não são duas massas. A base da grama ainda é 57% `#5B8F4E`.

**Árvores, 6.** Os lóbulos existem e estão separados. No crop 2× cada um usa `#A8D07A`, `#7AAA62` e `#3E6A38` — os três tons do tufo ao lado. No mapa a 1× a copa é um tufo maior, com tronco. Não é outro material.

**O que passa e fica.** Parado é o corpo de 32 px e lê no mapa. Walk, nas quatro direções, frames 0–5: o pé sobe **4, 5, 6, 4, 5, 6**. O gate de 4 px está cumprido. Lodge: o topo continua plano de telha, norte claro, sul escuro; o piso é a mesma tábua. Props: cerca, fogueira, canteiro e pedra se separam. Composição: portão, lago, lodge, fogueira e horta no lugar. Nada disso subiu, e nada disso caiu.

### 3. Veredito

Não para. O geral pesa a área, e a área é chão mais copa. Os dois estão em 6.

Iterar o tamanho do tufo, do seixo ou do lóbulo está em retorno decrescente. Da revisão 2 até aqui o escuro fora do creme foi 5,7% → 9,7% → 8,3%. Quatro rodadas mexeram no cluster e o terço de valor não andou. Integrar o pack licenciado Tiny Farm, recolorido na rampa Daylit Commons e no tile 16, separa caminho, grama e copa por valor de uma vez. Vale mais do que uma sétima rodada do mesmo desenho. A rodada 7 abaixo é a última mão que ainda muda o fill das áreas grandes. Se depois dela o 1× continuar uma laje verde e uma fita tan, para a mão e entra o pack.

### 4. Três ajustes, em ordem

Rampa fechada. Sem cor nova. Sem mexer no corpo, no walk, na planta nem nas 12 mesas.

**1. O fill do caminho muda de valor.** É a fita onde o consultor pisa. Um scuff de 6×4 em cima de 83% `#C6AE90` não é centro gasto.

- No tile interior, a metade sul (8×16, ou um bloco ≥ 8×8) é `#7A756C`. `#C6AE90` fica na metade norte e não passa de **50%** do tile.
- O seixo 4×3 continua, dentro da metade norte. A faixa de 3 px na borda com grama continua `#7A756C`.
- Passa se nenhum dos 99 interiores tem retângulo ≥ 6×6 de `#C6AE90`. A 1× a fita tem dois valores, não um.

**2. A mancha de grama entra no balde escuro.** É a maior área. `#3E6A38` (L 93) não é escuro neste corte.

- Nos tiles que já são mancha (o bloco 5×4), a base passa de `#3E6A38` para `#2A4A26` (L 65). O tufo desses tiles: norte `#3E6A38`, sul `#2A4A26`. Sem sol.
- A grama clara continua `#5B8F4E` com o tufo 8×5. Não espalhar `#2A4A26` no campo claro.
- Passa se, fora do creme, escuro ≥ **20%**. A 1× a mancha é um buraco de valor, não um verde vizinho.

**3. A copa sai da rampa do tufo.** O teste de “cinco lóbulos e 45% claro” passou e a árvore sumiu na grama.

- Cada lóbulo: norte um bloco **4×3** `#A8D07A`, o resto `#2A4A26`. `#7AAA62` e `#3E6A38` saem da copa. O vão de 2 px entre lóbulos fica.
- Variante B espelha. Variante C troca um lóbulo norte pela flor 4×4 que já existe.
- Passa se `#A8D07A` ≤ 20% dos px opacos, `#2A4A26` ≥ 60%, ainda ≥ 4 componentes ≥ 6×6, zero `#201B0F`. No crop 2× a copa é mais escura que o `#5B8F4E` em volta.

## Rodada 7

29 set 2026. Última mão no ambiente. Julgado a 1× em `docs/design/r7/scene-1x.png`. Corte igual ao da revisão: fora de `#FFF8F1`, BT.709, escuro abaixo de 90, claro a partir de 170.

### Medido

| Medida | R6 | R7 |
| --- | --- | --- |
| Fora do creme: escuro / meio / claro | 8,3% / 77,7% / 14,0% | **22,5% / 69,2% / 8,3%** |
| `#C6AE90` no pior tile de caminho | 83,6% interior | **31,3%** (interior e pior tile, 99 interiores) |
| Maior retângulo de `#C6AE90` | 16×9 | **16×5** |
| Copa clara (`#A8D07A` + creme da flor) | 58,4% / 58,4% / 56,4% | **12,3% / 12,3% / 13,9%** |

O escuro passou de 20%. Nenhum tile de caminho tem retângulo 6×6 de `#C6AE90`. A copa fica abaixo de 20% claro.

### Notas

| Categoria | Revisão R6 | R7 | Gate |
| --- | --- | --- | --- |
| Parado | 7 | **7** | 7 |
| Walk | 7 | **7** | 7 |
| Chão | 6 | **6** | 7 |
| Árvores | 6 | **7** | 7 |
| Props | 6 | **6** | 6 |
| Lodge | 6 | **6** | 6 |
| Composição | 6 | **6** | 6 |
| **Geral** | 6 | **6** | 7 |

### O que mudou

- Caminho: a metade sul de cada tile é `#7A756C`. Uma faixa de 3 px na metade norte, deslocada pelo hash, impede um bloco 6×6 de `#C6AE90`. O seixo 4×3 ficou na metade norte. A borda de 3 px com grama ou água continua.
- Grama: só o tile que já era mancha troca a base para `#2A4A26`. O tufo desses tiles fica norte `#3E6A38`, sul `#2A4A26`, sem sol. O resto da grama não mudou.
- Copa: cada lóbulo é `#2A4A26` com um bloco 4×3 `#A8D07A` no norte. Variante B espelha. Variante C mantém a flor 4×4. Tamanho, vão, âncora e ordenação não mudaram.

Props, lodge, walk, colisão, nav e as 12 mesas não foram mexidos.

### O que segura a nota

- **Chão, 6.** Os números passam: escuro 22,5%, tan no máximo 31,3%, maior retângulo 16×5. A 1× a mancha de grama é um buraco de valor. O caminho não chega a 7: a metade sul de cada tile empilha e a fita lê como fiada, não como um sul escuro contínuo.
- **Árvores, 7.** A copa saiu da rampa do tufo. No crop ela é mais escura que a grama em volta, com o claro só no bloco de 4×3.
- **Geral, 6.** A área maior continua o chão. O gate é 7.

A mão para aqui. O próximo passo é integrar o Tiny Farm depois da compra, recolorido na rampa Daylit Commons e no tile 16.

