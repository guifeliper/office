import {
  COLS,
  PROPS,
  ROWS,
  blockedCells,
  cellAt,
  cellCenter,
  lodgeShellSolid,
  terrainAt,
  type Cell,
  type PropPlacement,
} from './world-layout';

export interface GridSource {
  cols: number;
  rows: number;
  terrain: (col: number, row: number) => string;
  /** Solid cells from props or shells, on top of terrain. */
  solid: readonly Cell[];
}

/** The yard: 80×45, props solid, and the lodge shell closed except its door. */
export function yardSource(props: readonly PropPlacement[] = PROPS): GridSource {
  const solid: Cell[] = props.flatMap(blockedCells);
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) if (lodgeShellSolid(c, r)) solid.push({ col: c, row: r });
  }
  return { cols: COLS, rows: ROWS, terrain: terrainAt, solid };
}

/**
 * Walkability only. Draw order lives in depth.ts and never reads this grid.
 * Solid: void, water, walls, and each prop's base cells. Canopies and lintels never block.
 */
export class NavGrid {
  private readonly solid: Uint8Array;
  /** Step cost per cell. Grass costs more than sand or floor, so walks follow the paths. */
  private readonly cost: Float32Array;
  readonly cols: number;
  readonly rows: number;

  constructor(source: GridSource = yardSource()) {
    const { cols, rows } = source;
    this.cols = cols;
    this.rows = rows;
    this.solid = new Uint8Array(cols * rows);
    this.cost = new Float32Array(cols * rows).fill(1);
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const t = source.terrain(c, r);
        if (t === 'void' || t === 'water' || t === 'wall') this.solid[r * cols + c] = 1;
        if (t === 'grass') this.cost[r * cols + c] = GRASS_COST;
      }
    }
    for (const cell of source.solid) {
      if (this.inBounds(cell.col, cell.row)) this.solid[cell.row * cols + cell.col] = 1;
    }
  }

  walkable(col: number, row: number): boolean {
    return this.inBounds(col, row) && this.solid[row * this.cols + col] === 0;
  }

  private inBounds(col: number, row: number): boolean {
    return col >= 0 && row >= 0 && col < this.cols && row < this.rows;
  }

  /** Nearest walkable cell to a world point (ring search), for walkers caught mid-cell. */
  nearestWalkable(x: number, y: number): Cell {
    const start = cellAt(x, y);
    if (this.walkable(start.col, start.row)) return start;
    for (let radius = 1; radius < Math.max(this.cols, this.rows); radius += 1) {
      for (let dr = -radius; dr <= radius; dr += 1) {
        for (let dc = -radius; dc <= radius; dc += 1) {
          if (Math.max(Math.abs(dc), Math.abs(dr)) !== radius) continue;
          if (this.walkable(start.col + dc, start.row + dr)) {
            return { col: start.col + dc, row: start.row + dr };
          }
        }
      }
    }
    return start;
  }

  /**
   * A* over cells, 8-way, no corner cutting. Returns the cell chain from `from` to `to`
   * inclusive, or [] when unreachable.
   */
  findCells(from: Cell, to: Cell): Cell[] {
    if (!this.walkable(from.col, from.row) || !this.walkable(to.col, to.row)) return [];
    const COLS = this.cols;
    const size = COLS * this.rows;
    const g = new Float64Array(size).fill(Infinity);
    const came = new Int32Array(size).fill(-1);
    const closed = new Uint8Array(size);
    const startIdx = from.row * COLS + from.col;
    const goalIdx = to.row * COLS + to.col;
    g[startIdx] = 0;
    const open = new MinHeap();
    open.push(startIdx, octile(from, to));

    while (open.size > 0) {
      const current = open.pop();
      if (current === goalIdx) return this.unwind(came, goalIdx);
      if (closed[current]) continue;
      closed[current] = 1;
      const cc = current % COLS;
      const cr = (current - cc) / COLS;
      for (const [dc, dr, cost] of STEPS) {
        const nc = cc + dc;
        const nr = cr + dr;
        if (!this.walkable(nc, nr)) continue;
        if (dc !== 0 && dr !== 0 && (!this.walkable(cc + dc, cr) || !this.walkable(cc, cr + dr))) continue;
        const next = nr * COLS + nc;
        if (closed[next]) continue;
        const tentative = g[current]! + cost * this.cost[next]!;
        if (tentative < g[next]!) {
          g[next] = tentative;
          came[next] = current;
          open.push(next, tentative + octile({ col: nc, row: nr }, to));
        }
      }
    }
    return [];
  }

  /** World waypoints (cell centers) at each turn, ending on `to`'s center. */
  findPath(from: Cell, to: Cell): { x: number; y: number }[] {
    return simplify(this.findCells(from, to)).map(cellCenter);
  }

  private unwind(came: Int32Array, goal: number): Cell[] {
    const cells: Cell[] = [];
    for (let at = goal; at !== -1; at = came[at]!) {
      const col = at % this.cols;
      cells.push({ col, row: (at - col) / this.cols });
    }
    return cells.reverse();
  }
}

const GRASS_COST = 1.6;
const SQRT2 = Math.SQRT2;
const STEPS: readonly (readonly [number, number, number])[] = [
  [0, -1, 1], [1, 0, 1], [0, 1, 1], [-1, 0, 1],
  [1, -1, SQRT2], [1, 1, SQRT2], [-1, 1, SQRT2], [-1, -1, SQRT2],
];

function octile(a: Cell, b: Cell): number {
  const dx = Math.abs(a.col - b.col);
  const dy = Math.abs(a.row - b.row);
  return dx + dy + (SQRT2 - 2) * Math.min(dx, dy);
}

/** Drops the start cell and every cell that continues the previous direction. */
function simplify(cells: Cell[]): Cell[] {
  if (cells.length <= 1) return cells.slice(1);
  const out: Cell[] = [];
  for (let i = 1; i < cells.length; i += 1) {
    const next = cells[i + 1];
    if (!next) {
      out.push(cells[i]!);
      break;
    }
    const prev = cells[i - 1]!;
    const cur = cells[i]!;
    const sameDir = cur.col - prev.col === next.col - cur.col && cur.row - prev.row === next.row - cur.row;
    if (!sameDir) out.push(cur);
  }
  return out;
}

class MinHeap {
  private readonly items: number[] = [];
  private readonly keys: number[] = [];

  get size(): number {
    return this.items.length;
  }

  push(item: number, key: number): void {
    this.items.push(item);
    this.keys.push(key);
    let i = this.items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.keys[parent]! <= key) break;
      this.swap(i, parent);
      i = parent;
    }
  }

  pop(): number {
    const top = this.items[0]!;
    const lastItem = this.items.pop()!;
    const lastKey = this.keys.pop()!;
    if (this.items.length > 0) {
      this.items[0] = lastItem;
      this.keys[0] = lastKey;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < this.keys.length && this.keys[l]! < this.keys[m]!) m = l;
        if (r < this.keys.length && this.keys[r]! < this.keys[m]!) m = r;
        if (m === i) break;
        this.swap(i, m);
        i = m;
      }
    }
    return top;
  }

  private swap(a: number, b: number): void {
    [this.items[a], this.items[b]] = [this.items[b]!, this.items[a]!];
    [this.keys[a], this.keys[b]] = [this.keys[b]!, this.keys[a]!];
  }
}
