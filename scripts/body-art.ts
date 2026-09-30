/**
 * Round-2 base body as character matrices, one cell = one pixel.
 * Rubric: "Revisão rodada 1 — independente" in `docs/design/art-direction-map-pass.md`.
 */
export interface Rgba {
  width: number;
  height: number;
  data: Uint8Array;
}

function createImage(width: number, height: number): Rgba {
  return { width, height, data: new Uint8Array(width * height * 4) };
}

function setPixel(img: Rgba, x: number, y: number, color: number): void {
  if (x < 0 || y < 0 || x >= img.width || y >= img.height) return;
  const o = (y * img.width + x) * 4;
  img.data[o] = (color >>> 16) & 0xff;
  img.data[o + 1] = (color >>> 8) & 0xff;
  img.data[o + 2] = color & 0xff;
  img.data[o + 3] = 255;
}

export const INK = 0x201b0f;

export type Material = 'hair' | 'skin' | 'shirt' | 'pants' | 'shoe';
export type Tone = 0 | 1 | 2;

/** Light, mid, dark per material. Shadows lean blue: (B−R) climbs toward the dark tone. */
export const PALETTE: Record<Material, readonly [number, number, number]> = {
  hair: [0xc49a72, 0x74483a, 0x3a3044],
  skin: [0xf6d0a0, 0xdda88a, 0xa88880],
  shirt: [0x8a6a9a, 0x4e4a7e, 0x242e58],
  pants: [0xf0d8a8, 0xc8b08a, 0x827868],
  shoe: [0x7a5a4a, 0x5a3e36, 0x3a241c],
};

/** Matrix code → material and tone. `#` is ink, `.` is transparent. */
export const CODES: Record<string, [Material, Tone]> = {
  A: ['hair', 0], h: ['hair', 1], H: ['hair', 2],
  S: ['skin', 0], s: ['skin', 1], z: ['skin', 2],
  T: ['shirt', 0], t: ['shirt', 1], D: ['shirt', 2],
  P: ['pants', 0], p: ['pants', 1], q: ['pants', 2],
  O: ['shoe', 0], o: ['shoe', 1], Q: ['shoe', 2],
};

export interface BodyMatrix {
  /** Canvas x of the first column. */
  left: number;
  /** Canvas y of the first row. */
  top: number;
  rows: readonly string[];
}

/**
 * South, 16 columns from x16, 32 rows y24–55.
 * Head x17–30 y24–38, neck x20–27 y39–40, torso x19–28 y41–48,
 * legs x19–22 / x25–28 y49–52, shoes y53–55, hands x16–18 / x29–31 y45–47.
 */
export const SOUTH: BodyMatrix = {
  left: 16,
  top: 24,
  rows: [
    '....AAAAhhhh....', // 24 shine x20–23 only
    '....AAAAhhhhhH..', // 25 shine, right edge +2
    '..hhAAAAhhhhhhH.', // 26 shine, left edge −2 (x18)
    '.hhhhhhhhhhhhHH.', // 27 width 14, no highlight
    '.hhhhhhhhhhhhHH.', // 28
    '...hhhhhhhhhhH..', // 29 steps in to x19
    '.hhhhhhhhhhhhHH.', // 30 lock x17–18 steps back out by 2
    '.hhHSSSSSSSShHH.', // 31 forehead; x23 is skin, not a frown
    '.hhHHHSSSSHHHhH.', // 32 brows x19–21 and x26–28, gap x22–25
    '.hhs#Sssss#SshH.', // 33 eyes x20+21 and x26+27, lock x17–18
    '.hhsssssssssshH.', // 34 lock ends
    '.ssssssssssssHH.', // 35 right sideburn only
    '.zsssszzssssssz.', // 36 mouth x22–23
    '.zzsssssssssszz.', // 37
    '...zssssssssz...', // 38 chin
    '....zzzzzzzz....', // 39 neck, chin shadow
    '....zssssssz....', // 40
    '...TTTttttttt...', // 41 shoulder light x19–21
    '..tTTTtttttttt..', // 42 upper arm
    '.DDttttttttttDD.', // 43 sleeve
    'DDDttttttttttDDD', // 44 cuff
    'sSSttDDttttttSSs', // 45 hands; x20 stays mid so the hem does not push the fold past 12
    'ssstDDDtttDDtsss', // 46 fold x20–22 and x26–27
    'zzztDDttttDDtzzz', // 47 fold cut from the hem (x22 is mid)
    '...tttttttttt...', // 48 hem is mid — less dark on the south edge
    '...PPPp..pPPP...', // 49
    '...Ppqq..qqpP...', // 50 knees
    '...ppqq..qqpp...', // 51
    '...ppqq..qqpp...', // 52
    '..oOOOo..oOOOo..', // 53
    '..Qoooo..ooooQ..', // 54
    '..QQQQQ..QQQQQ..', // 55
  ],
};

/** Back view. Same silhouette as south; the hair covers the head down to a pointed nape. */
export const NORTH: BodyMatrix = {
  left: 16,
  top: 24,
  rows: [
    '....AAAAhhhh....', // 24 shine x20–23
    '....AAAAhhhhhH..', // 25 right edge +2
    '..hhAAAAhhhhhhH.', // 26 left edge −2
    '.hhhhhhhhhhhhHH.', // 27
    '.hhhhhhhhhhhhHH.', // 28
    '...hhhhhhhhhhH..', // 29 steps in
    '.hhhhhhhhhhhhHH.', // 30 lock x17–18, no 1px strand
    '.hhhhhhhhhhhhHH.', // 31
    '.hhhhhhhhhhhhHH.', // 32
    '.hhhhhhhhhhhhHH.', // 33
    '.hhhhhhhhhhhhHH.', // 34 lock ends
    '.hhhhhhhhhhhhhH.', // 35 nape, the 1px strands are gone
    '.HhhhHHhhHHhhhH.', // 36
    '.HHhHHHhhHHHhHH.', // 37 nape points
    '...zssssssssz...', // 38 nape skin
    '....zzzzzzzz....', // 39 hair shadow on the neck
    '....zssssssz....', // 40
    '...TTTttttttt...', // 41
    '..tTTTtttttttt..', // 42
    '.DDttttttttttDD.', // 43
    'DDDttttttttttDDD', // 44 cuff
    'sssttDDttttttsss', // 45 hands, back fold
    'ssstDDDtttDDtsss', // 46
    'zzztDDttttDDtzzz', // 47 fold cut from the hem
    '...tttttttttt...', // 48 hem is mid
    '...PPPp..pPPP...', // 49
    '...Ppqq..qqpP...', // 50 behind the knees
    '...ppqq..qqpp...', // 51
    '...ppqq..qqpp...', // 52
    '..oOOOo..oOOOo..', // 53 heels
    '..Qoooo..ooooQ..', // 54
    '..QQQQQ..QQQQQ..', // 55
  ],
};

/**
 * Facing east. One eye, brow, nose tip at x31, mouth at the front edge. The near arm hangs
 * forward with the hand 2 px past the chest; the far arm is hidden behind the torso.
 */
export const EAST: BodyMatrix = {
  left: 16,
  top: 24,
  rows: [
    '....hhAAAAhh....', // 24 shine x22–25
    '....hhAAAAhhhH..', // 25 shine, right edge +2
    '..hhhhAAAAhhhhH.', // 26 shine, left edge −2
    '.hhhhhhhhhhhhHH.', // 27 no highlight past y26
    '.hhhhhhhhhhhhHH.', // 28
    '...hhhhhhhhhhH..', // 29 steps in, so the lock can step out
    '.hhhhhhhhhhhhHH.', // 30 lock x17–18
    '.hhhhhhhhhHSSSS.', // 31 forehead, lock
    '.hhhhhhhhhSHHHS.', // 32 brow x27–29, lock
    '.hhhhhhsshss#Ss.', // 33 ear, eye, lock
    '.hhhhhhszhssssss', // 34 nose x31, lock ends
    '.hhhhhhzzHssssss', // 35 nose x31 again (2px tall)
    '.HhhHsssssssszz.', // 36 mouth x29–30
    '.HHHssssssssss..', // 37 chin
    '...zsssssssz....', // 38 jaw
    '......zzzzz.....', // 39 neck x22–26
    '......zsssz.....', // 40
    '....TTTTtttt....', // 41 chest x20–27
    '....TTTtttttt...', // 42 shoulder
    '....tttttttDD...', // 43 sleeve
    '....ttttttDDDD..', // 44 cuff
    '....tttttttSSs..', // 45 hand x27–29
    '....tDDttttsss..', // 46 back fold
    '....tDDttttzzz..', // 47
    '....tttttttt....', // 48 hem is mid — less dark on the south edge
    '....PPPPPPPp....', // 49 hip
    '....qqp.qqpp....', // 50 behind the knees
    '....qqp.qqpp....', // 51
    '....qqp.qqpp....', // 52
    '...oOOo.oOOOoo..', // 53 heel back, toe forward
    '...Qooo.oooooQ..', // 54
    '...QQQQ.QQQQQQ..', // 55
  ],
};

/** West mirrors east. Light is north with no side component, so the flip keeps it coherent. */
export const WEST: BodyMatrix = { ...EAST, rows: EAST.rows.map((row) => [...row].reverse().join('')) };

/**
 * Seated at the desk, seen from behind. 20 columns from x14, rows y27–55, seat on row 56.
 * Head = standing north head (x17–30) moved to y27–41, so the screen (bottom y26 in this
 * canvas) stays clear. Left forearm rises beside the neck to a 3×3 hand x14–16 y39–41 on
 * the desk edge; the desk ends at x31, so the right arm hangs to a hand x29–31 y50–52 on
 * the thigh. Torso x19–28 y44–51 with a 3×3 back fold; hip x19–28 y52–55 covers the open
 * chair back, wood beside it.
 */
export const SIT_NORTH: BodyMatrix = {
  left: 14,
  top: 27,
  rows: [
    '......AAAAhhhh......', // 27 shine, same crown as standing north
    '......AAAAhhhhhH....', // 28 right edge +2
    '....hhAAAAhhhhhhH...', // 29 left edge −2
    '...hhhhhhhhhhhhHH...', // 30
    '...hhhhhhhhhhhhHH...', // 31
    '.....hhhhhhhhhhH....', // 32 steps in
    '...hhhhhhhhhhhhHH...', // 33 lock x17–18
    '...hhhhhhhhhhhhHH...', // 34
    '...hhhhhhhhhhhhHH...', // 35
    '...hhhhhhhhhhhhHH...', // 36
    '...hhhhhhhhhhhhHH...', // 37 lock ends
    '...hhhhhhhhhhhhhH...', // 38
    'sSSHhhhHHhhHHhhhH...', // 39 left hand on the desk edge
    'sssHHhHHHhhHHHhHH...', // 40
    'zzz..zssssssssz.....', // 41 nape
    'DDD...zzzzzzzz......', // 42 cuff, neck in shadow
    'ttt...zssssssz......', // 43
    'ttt..TTTttttTTTtt...', // 44 shoulders
    'tttttTTTttttTTTttt..', // 45 upper arms
    'DDDDDttttttttttttt..', // 46 under the left arm
    '.....ttttttttttttt..', // 47 right arm hangs
    '.....tDDDttttttttt..', // 48 back fold
    '.....tDDDttDDttDDD..', // 49 back fold, right cuff
    '.....tDDDttDDttSSs..', // 50 right hand on the thigh
    '.....ttttttttttsss..', // 51 hem is mid
    '.....PPPPPPPPPPzzz..', // 52 hip
    '.....ppppqqpppp.....', // 53
    '.....ppppqqpppp.....', // 54
    '.....qqqqqqqqqq.....', // 55 on the seat
  ],
};

export interface Painted {
  image: Rgba;
  /** Index y*48+x → material. */
  material: Map<number, Material>;
  tone: Map<number, Tone>;
}

export function paintMatrix(
  matrix: BodyMatrix,
  palette: Record<Material, readonly [number, number, number]> = PALETTE,
): Painted {
  const image = createImage(48, 68);
  const material = new Map<number, Material>();
  const tone = new Map<number, Tone>();
  const width = matrix.rows[0]!.length;
  matrix.rows.forEach((row, j) => {
    if (row.length !== width) throw new Error(`row ${matrix.top + j} has ${row.length} columns, expected ${width}`);
    [...row].forEach((ch, i) => {
      if (ch === '.') return;
      const x = matrix.left + i;
      const y = matrix.top + j;
      if (ch === '#') return setPixel(image, x, y, INK);
      const code = CODES[ch];
      if (!code) throw new Error(`unknown code ${ch} at ${x},${y}`);
      setPixel(image, x, y, palette[code[0]][code[1]]);
      material.set(y * 48 + x, code[0]);
      tone.set(y * 48 + x, code[1]);
    });
  });
  return { image, material, tone };
}
