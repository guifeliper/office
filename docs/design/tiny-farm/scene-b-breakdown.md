# Scene B, pack coordinates

Tile columns and rows are 16px. Pixel rects are `x,y,w,h` on the sheet. Measured from the local pack. Nothing here is a redraw.

## Ground

`Tileset/Tileset Grass Spring.png` is 24×40 tiles. The same 12×4 autotile is drawn twice: cols 0–11 on light grass `79bf56`, cols 12–23 on dark grass `32ad53`.

| Piece | Where |
| --- | --- |
| Light flat | tile (9,2) |
| Dark flat | tile (21,2) |
| Light ledge, hole shows the base | cols 0–11, rows 20–23. Index `(row-20)*12+col`. |
| Dark ledge | cols 12–23, rows 20–23. |
| Light dirt path | cols 0–11, rows 8–11. Index below. |
| Dark dirt path | cols 12–23, rows 8–11. Same index, col+12. |

Dirt index, light block. A bit in the mask means that side is grass, not dirt. N=8 E=4 S=2 W=1.

| Mask | Tile | Mask | Tile |
| --- | --- | --- | --- |
| 0 center | (9,10) | 0 inner NW | (5,9) |
| 0 inner NE | (6,9) | 0 inner SE | (6,10) |
| 0 inner SW | (5,10) | 8 north edge | (10,8) |
| 4 east edge | (11,10) | 2 south edge | (9,11) |
| 1 west edge | (1,9) | 12 NE corner | (11,8) |
| 9 NW corner | (1,8) | 6 SE corner | (11,11) |
| 3 SW corner | (8,11) | 5 vertical | (0,9) |
| 10 horizontal | (2,11) | 7 end, opens north | (0,10) |
| 11 end, opens east | (1,11) | 13 end, opens south | (0,8) |
| 14 end, opens west | (3,11) | 15 dirt speck | (0,11) |

## Water, cliff, waterfall

| Piece | Where |
| --- | --- |
| Open water | `Tileset/Water tile.png` (0,0) 16×16 |
| Grass bank | `Tileset/Tileset Grass Spring.png` cols 0–11, rows 0–3, laid over water. Same mask index as the dirt table, origin (0,0), so dirt (col,row) becomes (col, row-8). The water sheet's cols 24–35 draw a brown dither that B does not use. |
| Straight south cliff | `Tileset/Tileset Grass Cliff Tileset Spring.png` dirt face, cols 0–11: cap (9,3), west (1,3), east (3,3), wall (9,4), wave foot (0,5)/(2,5) over water. Cols 12–16 are dark arches; B does not use them. |
| Waterfall, one fall | `Tileset/Spring Waterfall.png` (0,0) 64×64. Next fall is +64 on x. Second frame is y=64. |

East, west, and north of the cliff sheet do not open. A coast that is not a south face uses the grass bank, not this sheet.

Rows 0–3 of the grass sheet are autotile edges, 140–250 opaque pixels each. They are not flowers. Stamping them as lawn fill draws a maze. They blend the two greens by layering: cols 12–23 over the light flat, with the hole showing the light grass.

B's pixels match the summer sheets, not spring: grass `7ec433` / `54b033`, the summer cliff, and `Summer Waterfall.png`. The layout is the same, so every coordinate here applies. Lawn texture is decals from `Tileset/ALL props seasons.png`: rows 0–1 ground cover, row 6 pebbles on dirt, row 7 dots on water.

## Objects

| Piece | Where |
| --- | --- |
| House | `Objects/Exterior/Houses/10.png` full sheet, 80×112 |
| Mailbox | `Objects/Exterior/Mailbox.png` (0,14) 16×18 |
| Fence rail | `Objects/Exterior/Fence and Bridge/Fence Wood.png` (48,0) 48×14 |
| Fence post | same sheet (48,28) 13×18 |
| Fence rail, second frame | same sheet (48,80) 48×14 |
| Round tree | `Objects/Tree/Common/No Shadow/Maple Tree.png` (0,49) 32×45, and (32,49), (64,49), (96,49) |
| Blossom maple | same sheet (128,49) 32×45 and (160,49) 32×45 |
| Stump | same sheet (9,131) 14×11 and (144,119) 12×13 |
| Orange tree | `Crops/Fruits Tree/Summer/Orange Tree - no shadow.png` (128,1) 32×44 |
| Cherry | `Crops/Fruits Tree/Spring/Cherry Tree.png` (96,1) 32×45 |
| Banana | `Crops/Fruits Tree/Summer/Banana Tree - no Shadow.png` (130,0) 29×45 |
| Doghouse | `Objects/Exterior/Houses/dog house.png` (7,2) 34×42 |
| Laundry | `Objects/Exterior/Village Clotheslines.png` (6,10) 36×20 |
| Hay | `Objects/Exterior/Hay Bales.png` (0,0) 32×16 |
| Crate | `Objects/Exterior/Box.png` (50,77) 14×19 |
| Lantern | `Objects/Exterior/Street Lamp 2.png` (0,1) 16×37 |
| Sunflower | `Crops/Summer/Sunflower.png` (81,5) 15×26 |
| Small bloom | `Crops/Spring/Spring Crops.png` (114,18) 13×13 |
| Mushroom | `Objects/Tree/Deep Forest/Fantasy Mushroom.png` (40,20) 15×24 |
| Lily | `Objects/Props/Spring/props water.png` (0,34) 16×16 |
| Butterfly | `Animals/Forest/Bugs/Butterfly/Monarch Butterfly.png` (0,0) 16×16 |
| Wood pile | `Objects/Props/wood.png` (32,1) 16×14 |
| Sand | `Tileset/Beach animations tiles.png` tile (12,12) |
| Bonfire | `Objects/Exterior/Mine and Dungeon/bonfire.png` (0,0) 16×32 |
