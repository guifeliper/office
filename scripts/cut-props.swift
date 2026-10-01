// Cuts the approved prop sheet (and the few generated singles) into one PNG per prop.
// Background is keyed by flood fill from the crop border, then the art is box-downscaled
// to the pilot's density (tile 16×16, consultant ~13×44 drawn).
//
// Usage: swift scripts/cut-props.swift docs/design/props-generated
// That folder holds prop-tree.png, prop-fence.png, prop-rock.png, prop-gatehouse.png.

import AppKit
import Foundation

let repo = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let outDir = repo.appendingPathComponent("src/renderer/office/art/props")
let sheetPath = repo.appendingPathComponent("docs/design/cursor-office-props.png").path
let assets = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : ""

struct RGBA { var r: UInt8; var g: UInt8; var b: UInt8; var a: UInt8 }

final class Bitmap {
  let width: Int
  let height: Int
  var px: [RGBA]

  init(width: Int, height: Int) {
    self.width = width
    self.height = height
    px = Array(repeating: RGBA(r: 0, g: 0, b: 0, a: 0), count: width * height)
  }

  init?(path: String) {
    guard let image = NSImage(contentsOfFile: path),
          let tiff = image.tiffRepresentation,
          let rep = NSBitmapImageRep(data: tiff) else { return nil }
    width = rep.pixelsWide
    height = rep.pixelsHigh
    px = []
    px.reserveCapacity(width * height)
    for y in 0..<height {
      for x in 0..<width {
        let c = rep.colorAt(x: x, y: y)?.usingColorSpace(.deviceRGB) ?? .clear
        px.append(RGBA(
          r: UInt8(max(0, min(255, c.redComponent * 255))),
          g: UInt8(max(0, min(255, c.greenComponent * 255))),
          b: UInt8(max(0, min(255, c.blueComponent * 255))),
          a: 255))
      }
    }
  }

  subscript(x: Int, y: Int) -> RGBA {
    get { px[y * width + x] }
    set { px[y * width + x] = newValue }
  }

  func crop(_ x0: Int, _ y0: Int, _ x1: Int, _ y1: Int) -> Bitmap {
    let out = Bitmap(width: x1 - x0, height: y1 - y0)
    for y in 0..<out.height { for x in 0..<out.width { out[x, y] = self[x0 + x, y0 + y] } }
    return out
  }

  /// Light, low-saturation pixels reachable from the border become transparent.
  func keyBackground() {
    func isBackground(_ c: RGBA) -> Bool {
      let r = Int(c.r), g = Int(c.g), b = Int(c.b)
      let lum = (r * 3 + g * 6 + b) / 10
      return lum > 196 && r - b < 70 && r >= b
    }
    var seen = [Bool](repeating: false, count: width * height)
    var stack: [(Int, Int)] = []
    for x in 0..<width { stack.append((x, 0)); stack.append((x, height - 1)) }
    for y in 0..<height { stack.append((0, y)); stack.append((width - 1, y)) }
    while let (x, y) = stack.popLast() {
      if x < 0 || y < 0 || x >= width || y >= height { continue }
      let i = y * width + x
      if seen[i] { continue }
      seen[i] = true
      if !isBackground(px[i]) { continue }
      px[i].a = 0
      stack.append((x + 1, y)); stack.append((x - 1, y))
      stack.append((x, y + 1)); stack.append((x, y - 1))
    }
    // Enclosed gaps (between fence rails, gate slats) never touch the border.
    let bg = px[0]
    for i in 0..<px.count where px[i].a > 0 {
      let c = px[i]
      let d = abs(Int(c.r) - Int(bg.r)) + abs(Int(c.g) - Int(bg.g)) + abs(Int(c.b) - Int(bg.b))
      if d < 24 { px[i].a = 0 }
    }
  }

  func trimmed() -> Bitmap {
    var minX = width, minY = height, maxX = -1, maxY = -1
    for y in 0..<height {
      for x in 0..<width where self[x, y].a > 0 {
        minX = min(minX, x); maxX = max(maxX, x)
        minY = min(minY, y); maxY = max(maxY, y)
      }
    }
    if maxX < 0 { return self }
    return crop(minX, minY, maxX + 1, maxY + 1)
  }

  /// Box downscale. A destination pixel is opaque when most of its block is opaque.
  func downscaled(by factor: Double) -> Bitmap {
    let w = max(1, Int((Double(width) / factor).rounded()))
    let h = max(1, Int((Double(height) / factor).rounded()))
    let out = Bitmap(width: w, height: h)
    for dy in 0..<h {
      for dx in 0..<w {
        let sx0 = Int(Double(dx) * Double(width) / Double(w))
        let sx1 = max(sx0 + 1, Int(Double(dx + 1) * Double(width) / Double(w)))
        let sy0 = Int(Double(dy) * Double(height) / Double(h))
        let sy1 = max(sy0 + 1, Int(Double(dy + 1) * Double(height) / Double(h)))
        var r = 0, g = 0, b = 0, n = 0, total = 0
        for sy in sy0..<min(sy1, height) {
          for sx in sx0..<min(sx1, width) {
            total += 1
            let c = self[sx, sy]
            if c.a > 0 { r += Int(c.r); g += Int(c.g); b += Int(c.b); n += 1 }
          }
        }
        if n * 2 >= total && n > 0 {
          out[dx, dy] = RGBA(r: UInt8(r / n), g: UInt8(g / n), b: UInt8(b / n), a: 255)
        }
      }
    }
    return out
  }

  func write(_ name: String) {
    guard let rep = NSBitmapImageRep(
      bitmapDataPlanes: nil, pixelsWide: width, pixelsHigh: height,
      bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
      colorSpaceName: .deviceRGB, bytesPerRow: width * 4, bitsPerPixel: 32),
      let data = rep.bitmapData else { fatalError("rep") }
    for y in 0..<height {
      for x in 0..<width {
        let c = self[x, y]
        let i = (y * width + x) * 4
        // Premultiplied storage: alpha is 0 or 255, so straight copy is safe.
        data[i] = c.a == 0 ? 0 : c.r
        data[i + 1] = c.a == 0 ? 0 : c.g
        data[i + 2] = c.a == 0 ? 0 : c.b
        data[i + 3] = c.a
      }
    }
    let png = rep.representation(using: .png, properties: [:])!
    try! png.write(to: outDir.appendingPathComponent(name))
    print("\(name) \(width)x\(height)")
  }
}

try FileManager.default.createDirectory(at: outDir, withIntermediateDirectories: true)

guard let sheet = Bitmap(path: sheetPath) else { fatalError("sheet") }

/// Sheet props share one density, so they share one factor.
let SHEET_FACTOR = 5.0

func cutSheet(_ name: String, _ x0: Int, _ y0: Int, _ x1: Int, _ y1: Int) {
  let piece = sheet.crop(x0, y0, x1, y1)
  piece.keyBackground()
  piece.trimmed().downscaled(by: SHEET_FACTOR).trimmed().write(name)
}

cutSheet("desk.png", 78, 140, 256, 332)
cutSheet("meeting-table.png", 322, 160, 542, 336)
cutSheet("campfire.png", 592, 156, 832, 336)
cutSheet("stump-axe.png", 880, 160, 996, 326)
cutSheet("woodpile.png", 998, 200, 1100, 326)
cutSheet("pingpong.png", 66, 468, 250, 660)
cutSheet("garden-bed.png", 305, 476, 550, 660)
cutSheet("gate-left.png", 575, 490, 694, 648)
cutSheet("gate-right.png", 732, 490, 840, 648)
cutSheet("lodge-door.png", 885, 395, 1095, 670)

/// Generated singles: one factor each, so the result lands on the tile grid.
func single(_ file: String, factor: Double) -> Bitmap? {
  guard !assets.isEmpty, let bmp = Bitmap(path: "\(assets)/\(file)") else {
    print("skip \(file)")
    return nil
  }
  bmp.keyBackground()
  return bmp.trimmed().downscaled(by: factor).trimmed()
}

/// Splits a tall prop into base (feet, collision) and foreground (occluder).
func split(_ bmp: Bitmap, atFraction fraction: Double, base: String, foreground: String) {
  let row = Int((Double(bmp.height) * fraction).rounded())
  bmp.crop(0, 0, bmp.width, row).write(foreground)
  bmp.crop(0, row, bmp.width, bmp.height).write(base)
}

if let tree = single("prop-tree.png", factor: 11) {
  // Trunk emerges under the canopy around 72% of the height.
  split(tree, atFraction: 0.72, base: "tree-trunk.png", foreground: "tree-canopy.png")
}
if let gatehouse = single("prop-gatehouse.png", factor: 7) {
  // Roof and lintel sit above the stone pillars.
  split(gatehouse, atFraction: 0.5, base: "gatehouse-base.png", foreground: "gatehouse-lintel.png")
}
single("prop-fence.png", factor: 14.5)?.write("fence.png")
single("prop-rock.png", factor: 13)?.write("rock.png")
