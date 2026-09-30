# Pack limits for the island

The renderer now paints two ground layers. A grass, dirt, sand, or water tile is the base. A cliff or grass-ledge tile is drawn on top, and its hole shows the base. That was the round-6 mistake: the ledge was flattened into one tile, so the hole became a black void or a thin lip.

## What the sheets actually contain

Measured locally. Nothing was uploaded.

Cliff faces, every season, 16px tiles. A hole is a transparent or near-black pixel in the outer 4px of a side (64 pixels max):

| File | Size | Tiles with a dirt face | Max hole N | E | S | W |
| --- | --- | --- | --- | --- | --- | --- |
| `Tileset/Tileset Grass Cliff Tileset Spring.png` | 320×192 | 170 | 20 | 16 | 36 | 16 |
| `Tileset/Tileset Grass Cliff Tileset Summer.png` | 320×192 | 170 | 20 | 16 | 36 | 16 |
| `Tileset/Tileset Grass Cliff Tileset Fall.png` | 320×192 | 170 | 20 | 16 | 36 | 16 |
| `Tileset/Tileset Grass Cliff Tileset Winter.png` | 384×304 | 276 | 20 | 11 | 26 | 11 |

The open side is south. East, west, and north never open. A rock wall can run along a south coast. It cannot turn a corner into an east or west face, and it cannot face north. The grass ledge in `Tileset/Tileset Grass Spring.png` rows 20–23 does face all four sides, and that is what the other coasts use. It is a lip, not a rock wall.

Grass has two base tones on that same spring sheet: `(9,2)` `79bf56` and `(21,2)` `32ad53`. There is no third ground green.

## Correction: the two greens do blend

An earlier version of this file said "no tile blends the two greens" and called that a pack limit. That was wrong. It was a mistake in how tiles were selected.

Rows 0–3 of the grass sheet are a full 12×4 autotile with a transparent hole. Cols 0–11 draw the light green and cols 12–23 draw the dark green. The blend comes from layering: lay the dark autotile over the light flat, and the jagged rim is the transition. Scene B does exactly this. The same light block laid over water is B's pond bank. The same holds for the cliff: B uses the dirt face in cols 0–11 of the cliff sheet, not the dark arches in cols 12–16.

| Piece | Tile |
| --- | --- |
| Cap: straight, west end, east end | (9,3), (1,3), (3,3) |
| Wall | (9,4) |
| Wave foot | (0,5) and (2,5), alternated by column, over water |

Proof: `calibration-b-v3.png` scored 8 and 6. The island at `island-rounds/r13-1x.png`, compared blind with r12 at the same 2× crop, scored 7 and 6 against r12's 3 and 4.

B itself uses the summer sheets: grass `7ec433` / `54b033`, `Tileset Grass Cliff Tileset Summer.png`, and `Summer Waterfall.png`. Its lawn texture is the ground-cover decals in `Tileset/ALL props seasons.png`: rows 0–1 on grass, row 6 pebbles on dirt, row 7 dots on water. From r14 the island uses the summer sheets.

## How B shapes the dark grass (r14)

Counted cell by cell, about 15–20% of B's grass is dark. It is not scattered blobs. It forms a few large masses on raised ground and on wild ground away from the paths. The yard around the house and the path margins stay light. Every mass carries the dark autotile rim all the way round. B has no straight tone seams.

r14 builds the dark mask the same way:
- a seed is any grass cell more than 3.5 cells from a path, or any terrace top;
- the house yard, the garden, the ring right under a terrace, and the shore bank cells are excluded;
- the mask is cleaned so every dark cell has a dark neighbour on both axes, which prevents one-tile strips.

The terrace ledge overlay is gone. Its mostly transparent crops drew light blocks with hard edges.

Decals follow B's count per 10×10 tiles: about 8 on the lawn and 4 dirt spots on paths. They are only placed on interior cells, never across a rim. Lone dirt specks (the island autotile tile) are gone; B does not use them.

The dirt path is rows 8–11 of the same sheet. It is the pale autotile. There is no darker footprint tile.

No lighthouse file. No fern file. Flowers in the field are the sunflower, plus the strawberry crop.

## What is in the pack and not in the scene

These files exist and were not placed. They are not a pack limit:

- `Objects/Exterior/Beach/Beach Umbrella.png`
- `Objects/Exterior/Beach/Lounge Chair.png`
- `Objects/Exterior/Beach/Beach Chair.png`
- `Objects/Exterior/Houses/NPCS houses/Fishman/`

## Why the review stopped

Rounds 9–11 stayed at 3–4 against the Tiny Farm close-up and 3–5 against the Island Hub drawing. The south cliff is a real three-tile wall where the coast runs straight for four columns. The drawing's cliffs face every direction and fill much more of the frame. The sheets above cannot build that.

The close-up quality bar is the same tiles at a much tighter camera. At the 80×45 world, reviewers who see the whole 1× frame still read the ground as flat fills. r13 scored 4 and 3 that way. Review ground at 2×.
