# Tiny Farm — mapa de integração

Verificação em 29 set 2026. Só o pack pago.

Arquivo local, fora do git:

`/Users/guilhermereis/Library/Application Support/cursor-office-assets/tiny-farm/Farm RPG - Tiny Asset Pack - (All in One)/`

Origem: `Farm RPG - Tiny Asset Pack - (All in One).rar`. O pack FREE 16×16 não foi aberto e não entra no app.

Os PNGs crus ficam nesse diretório, ou numa pasta `Tiny Asset Pack*` ignorada pelo git. Um commit não pode adicionar o `.rar`, o pack inteiro, as folhas, nem os recortes. `npm run art:cut` gera os recortes em `.cache/tiny-farm/`, que também fica fora do git. Ver `docs/design/tiny-farm/ART-LICENSE.md`.

## Veredito: ADAPT

Vista 3/4 top-down, tile 16×16, personagens em 4 direções, machado, enxada e regador. Dá para usar. Não está pronto para trocar a cena inteira: o canvas do personagem, o pé, o portão e o lodge precisam de um corte nomeado. Não é bloqueio (vista errada, ausência de folhas, ou licença que proíba embutir no app).

## Licença

`Documentation.txt`: uso comercial e modificação liberados. Proibido revender ou redistribuir o pack, mesmo modificado. Crédito obrigatório: EmanuelleDev, https://emanuelledev.itch.io.

Embutir recortes no Electron é uso do pack, não redistribuição dele. Não publicar as folhas.

## O que o pack tem para o escritório

Medido nos PNGs, grade de 16 no chão e de 32 no personagem.

| Necessidade | Onde está | Medida |
| --- | --- | --- |
| Grama | `Tileset/Tileset Grass Spring.png` (também Summer, Fall, Winter, Deep Forest) | 384×640. Tile 16×16. Grama chapada em (9,2) e (21,2). Autotile de penhasco e de terra no mesmo arquivo |
| Caminho de terra | Dentro da folha de grama (faixa laranja), não em `Path tiles.png` | `Path tiles.png` (384×256) é piso de tijolo e madeira |
| Água | `Tileset/Water tile.png` e `Tileset/Tileset Grass Water Spring.png` | Água solta 16×16. A folha grande é autotile grama–água |
| Árvore | `Objects/Tree/Common/No Shadow/` (Pine, Maple, Birch, Mahogany) e a pasta `Shadow/` | Pine 256×96: estágios, tronco, toco, copa. Vista 3/4 |
| Cerca | `Objects/Exterior/Fence and Bridge/Fence Wood.png` | 96×160. Poste, vão, canto. Também Stone, Iron, White |
| Casa / lodge | `Tileset/Tileset House.png` (832×384) e `Objects/Exterior/Houses/1.png` (128×112) | Casa pronta é um chalé inteiro, maior que o lodge atual. Porta em `Houses/Door, windows, and chimney/` |
| Portão | Não existe arquivo com "gate" | Montar com pontas da cerca de madeira e a porta dupla |
| Personagem | `Character/Character/PNG/` em camadas; 5 prontos em `Pre-made/` (Alex, Josh, Lyria, Manu, Tori) | Ver grade abaixo |
| Sentar | `PNG/18. Setting/` e `Pre-made/*/Sitting.png` | 4 direções, 1 frame estático. Norte é o frame 1. Serve para a mesa |
| Machado | `PNG/5. Axe and Sickle/` + `Weapons/Axe/` | 4×6 frames de 32 |
| Enxada | `PNG/4. Pickaxe, Hoe and Catching insects/Weapons/Hoe/` | 4×6 |
| Regador | `PNG/7. Watering/Weapons/Watering/` | 4×8 |
| Fogueira | `Objects/Exterior/Mine and Dungeon/bonfire.png` | 96×32 |
| Canteiro | `Tileset/Tilled Soil and wet soil.png` e `Crops/` | Solo arado 384×128 |
| Monitor | Não há | Continua o `monitor.png` nosso |

Ícones soltos em `Objects/Exterior/Farm Tools.png` (48×16) são itens de inventário (enxada, pá, forcado), não o personagem empunhando a ferramenta.

## Personagem

Folha em tira, uma linha, célula 32×32. Ordem confirmada no composite (pele + roupa Farm azul + cabelo Josh + olhos):

| Animação | Folha | Frames |
| --- | --- | --- |
| Idle | `1. Idle` 512×32 | 4 direções × 4 |
| Walk | `2. Walk` 768×32 | 4 × 6 |
| Run | `3. Run` 1024×32 | 4 × 8 |
| Machado | `5. Axe and Sickle` 768×32 | 4 × 6 |
| Enxada | `4. Pickaxe, Hoe…` 768×32 | 4 × 6 |
| Regador | `7. Watering` 1024×32 | 4 × 8 |
| Sentar | `18. Setting` 128×32 | 4 × 1 |

Direção na tira: sul, norte, leste, oeste. Leste e oeste estão desenhados. Não precisa espelhar se a fonte for a tira.

O pronto (`Pre-made/Josh/Walk.png`, 192×96) é outra organização: 6 colunas × 3 linhas (sul, norte, lado direito). Oeste só por espelho. Usar a tira, não o pronto, para as 4 faces.

Corpo opaco dentro da célula de 32: cerca de 12×20 px. A cabeça começa por volta de y=8. O pé acaba por volta de y=25, não no fim da célula. A âncora de pé do escritório tem de usar esse y, não o fundo do frame de 32.

Paper-doll na mesma tira, pastas `Skins`, `Clothers` (grafia do pack), `Hair's`, `Eyes`, `Acc`, e `Weapons` nas ações. Roupa de fazenda: 5 cores. `Important notice.txt` diz que a separação das roupas ainda não terminou. Cabelo tem vários cortes (Josh, Lyria, Standard, e outros).

Sentar não é ciclo. Um frame por face. O norte (de costas) é o que a mesa pede. A cadeira continua a nossa, ou um recorte futuro de `Objects/Interior/Chairs.png`.

## Adaptações

1. Pé em y≈25 dentro do frame 32. Não esticar o bonequinho para 16×32.
2. Lodge: recortar telhado, parede e porta do tileset de casa para a planta que já existe. Não soltar o chalé `Houses/1.png` em cima das 12 mesas.
3. Portão: não há sprite de portão. Primeira troca não mexe no portão.
4. Monitor: custom, fica.
5. A rampa de cor em `art-direction-map-pass.md` não é a paleta deste pack. No recorte, usar a cor do pack. Não recolorir para a rampa antiga.
6. `Paletta.txt`: a paleta do autor está incompleta. Não depender dela para quantizar.

## Problemas de organização

- Sem índice de tiles. O corte é por coordenada medida, não por nome de frame.
- Tira (4 direções) e pronto (3 direções) não batem.
- Sentar se chama `Setting`. Roupa se chama `Clothers`.
- Nomes com espaço (`Sitting .png`) e caixa diferente na Lyria.
- Arquivos `copiar` duplicados.
- Aviso de roupa incompleta, embora o set Farm exista.

## Primeiro corte

Não trocar a cena. Não mexer em nav, colisão, 12 mesas, y-sort, sentar nem lazer.

Só chão e uma árvore, que foram o que reprovou no portão de qualidade.

1. Fora do repo, recortar da grama de primavera: 2 gramas chapadas, 1 borda grama–terra, 1 centro de caminho de terra, 1 água 16×16, 1 borda grama–água.
2. Recortar um pinheiro maduro de `Tree/Common/No Shadow/Pine Tree.png` em tronco + copa, para o y-sort que já separa `tree-trunk` e `tree-canopy`.
3. Copiar para o app somente esses recortes, com nome nosso (`grass-0.png`, `path-0.png`, `water-0.png`, `tree-trunk.png`, `tree-canopy.png`). Não copiar a folha.
4. Ligar em `ground-tiles.ts` e no prop `tree` de `art.ts`. Monitor, mesa, cadeira, cerca, portão e lodge ficam como estão.
5. Personagem, sentar e ferramentas ficam para o corte seguinte, com a âncora de pé em y≈25 e a tira sul/norte/leste/oeste.

Crédito na UI: "Pixel art: Tiny Farm RPG by Maeve Devs".

## Corte 1

Chão e um pinheiro. Água, lodge, cerca, portão, personagens e o resto dos props ficam.

Arquivos da folha `Tileset/Tileset Grass Spring.png` (384×640, tile 16): grama chapada `(9,2)` `79bf56` e `(21,2)` `32ad53`. Terra e as transições nas linhas 8–11, colunas 0–11: centro `(9,10)`, bordas, cantos externos, faixa, ponta e cantos internos `(5,9)` `(6,9)` `(6,10)` `(5,10)`. A grama ao lado do caminho usa a chapada clara, para a franja da terra não mudar de verde. Recortes gerados em `.cache/tiny-farm/tiles/`, fora do git.

Pinheiro maduro em `Objects/Tree/Common/No Shadow/Pine Tree.png`, caixa `x=96 y=2`, 34×45. O pack não tem três copas (há estágios, pinheiro de neve e árvore morta). Uma copa só. Tronco marrom 8×7. O sprite do tronco fica com os 18 px de baixo, copa com os 27 px de cima, para o pé continuar no fundo e `TRUNK_HEIGHT` continuar na junção. Colisão, nav e posição das árvores não mudaram.

## Corte 2 — Cabana Norte

Interior e personagens só com Tiny Farm (`scripts/cut-cabin.ts`).

## Pátio

O pátio em runtime usa só recortes deste pack (`scripts/cut-courtyard.ts` → `.cache/tiny-farm/yard/`). O chão de grama/terra e o pinheiro do corte 1 ficam. A cabana não foi revertida. Prova: `docs/design/tiny-farm/courtyard-1x.png` e o recorte 2× `courtyard-2x.png` (lago, ponte e casca do lodge).

| Peça | Arquivo do pack | Recorte |
| --- | --- | --- |
| Água chapada | `Tileset/Water tile.png` | 16×16 |
| Margem grama–água | `Tileset/Tileset Grass Water Spring.png` | norte `(2,2)`, sul `(0,6)`, oeste `(7,1)`, leste `(4,1)`, cantos `(3,0)` e `(1,0)`. O furo transparente da folha leva a grama chapada do corte 1 |
| Telhado da casca | `Tileset/Tileset House.png` | miolo `(1,1)` e `(2,1)`, borda `(4,0)`. O vão da porta usa o degrau `(17,2)` |
| Porta do lodge | `Objects/Exterior/Houses/Door, windows, and chimney/Door.png` | primeira variante, 48×23 |
| Cerca | `Objects/Exterior/Fence and Bridge/Fence Wood.png` | vão horizontal 32×14 |
| Portão | o mesmo `Fence Wood.png` | poste 13×18 de cada lado do vão. Não há sprite de portão |
| Guarita | o mesmo `Fence Wood.png` | dois postes e um lintel de duas seções do vão. Não há guarita |
| Fogueira | `Objects/Exterior/Mine and Dungeon/bonfire.png` | 6 frames. Fica cenário; ninguém patha até ela |
| Toco | `Objects/Tree/Common/No Shadow/Pine Tree.png` | toco 10×10 |
| Lenha | `Objects/Props/wood.png` | uma pilha 16×14 |
| Horta | `Tileset/Tilled Soil and wet soil.png` `(9,1)` + `Crops/Spring/Spring Crops.png` | canteiro 48×32 |
| Mesa | `Objects/Exterior/Picnic.png` | mesa 44×44 |
| Pedra | `Objects/Props/Spring/Stones.png` | 25×19 |
| Pedra da margem | `Objects/Props/Spring/Ground stones.png` | 12×13 |
| Arbusto | `Objects/Tree/Deep Forest/bushes.png` | dois cortes, 32×22 e 25×31. É o único arbusto do pack |
| Ponte | `Objects/Exterior/Fence and Bridge/Bridge.png` | 70×48, na margem sul do lago |
| Caixa de correio | `Objects/Exterior/Mailbox.png` | a da esquerda, ao lado do portão |
| Lampião | `Objects/Exterior/Street Lamp 2.png` | o poste estreito, quatro ao longo do caminho (o quinto caía em cima da areia) |

Saíram porque o pack não tem equivalente:

- Mesa de pingue-pongue.
- Tufos de flor. O arbusto e a horta cobrem o verde miúdo.
- Margem de pedra desenhada à mão, piso e parede de tora do lodge, e os PNGs antigos de cerca, portão, guarita, telhado e porta. Os arquivos Daylit podem continuar no disco; o runtime não importa `art/props`. O pinheiro do pack também sai do cache, não do git.

Chegada (portão → guarita → porta → cabana), lazer (machado no toco, enxada na horta) e Escape/porta não mudaram de contrato. A colisão da ponte, da caixa e dos lampiões acompanha o sprite. O reducer não mudou.
