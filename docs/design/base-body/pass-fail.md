# Corpo base em pé — sul (prova, não integrado)

Escrito antes do desenho. Medido por `scripts/paint-base-body.ts` sobre `base-south.png` (48×68).
Um item só passa com o número; "melhorou" não conta.

| # | Item | Medida | Passa se |
|---|------|--------|----------|
| 1 | Âncora | última linha opaca; linha 56 | última = 55, linha 56 vazia, centro x da caixa em 23.5 ± 0.5 |
| 2 | Cabeça grande | linhas cabelo+rosto ÷ altura opaca | ≥ 3/8, largura da cabeça ≥ 14 px |
| 3 | Olhos | marcas ink dentro do rosto | 2 marcas 1×2, espelhadas no centro, ≥ 3 px de pele entre elas |
| 4 | Contorno 1 px contínuo | ink que toca o exterior | 1 componente 8-conexo; todo pixel opaco que toca transparente é ink; nenhum 2×2 de ink |
| 5 | 3 tons por material | cores por região | pele, cabelo, camisa, calça, sapato: exatamente 3 cada |
| 6 | Luz norte / topo-esquerda | centróide do tom claro × tom de sombra | claro à esquerda (x menor) do sombra em todo material; e acima ou igual (y ≤) |
| 7 | Silhueta própria | IoU da máscara opaca com o piloto atual | < 0.8 |
| 8 | Mãos | componentes de pele abaixo do queixo | 2 (esquerda e direita), fora do tronco |
| 9 | Sapatos separados do chão | linha abaixo do sapato; entre os pés | linha 55 ink sob os dois sapatos; coluna ink entre os pés |
| 10 | Sem pixel solto | pixel não-ink sem vizinho 4-conexo da mesma cor | 0 |
| 11 | Alpha | valores | só 0 e 255 |
| 12 | Paleta fechada por material | cores totais; máscaras | 5 × 3 + ink = 16; máscaras cobrem todo pixel não-ink exatamente uma vez |
| 13 | Contraste com o chão | luminância Rec.709 do tom médio de cada material | Δ ≥ 40 contra o tom médio da grama e do caminho |
| 14 | Original | hex | nenhum hex copiado da referência; roupa não é camisa vermelha + macacão azul |

Renders: `compare-south-1x.png` e `compare-south-2x.png` (piloto atual × novo × recorte da referência na mesma escala de pixel, sobre grama e caminho).
