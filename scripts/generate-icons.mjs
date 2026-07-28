/**
 * Gera todos os PNGs do PWA (ícones, apple-touch-icon e splash screens do iOS)
 * sem depender de nenhuma biblioteca externa: rasteriza a arte com laços de
 * pixel e escreve o PNG na mão (zlib do próprio Node).
 *
 * Rode com:  node scripts/generate-icons.mjs
 */
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// ---------------------------------------------------------------- PNG writer

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

/** rgba: Uint8Array com width*height*4 bytes. */
function encodePng(rgba, width, height) {
  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0 // filtro "None"
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ------------------------------------------------------------------- canvas

class Canvas {
  constructor(width, height) {
    this.w = width
    this.h = height
    this.px = new Uint8Array(width * height * 4)
  }

  /** Mistura uma cor no pixel respeitando a cobertura (antialiasing). */
  blend(x, y, [r, g, b], coverage) {
    if (coverage <= 0 || x < 0 || y < 0 || x >= this.w || y >= this.h) return
    const a = Math.min(1, coverage)
    const i = (y * this.w + x) * 4
    const dstA = this.px[i + 3] / 255
    const outA = a + dstA * (1 - a)
    if (outA === 0) return
    for (let c = 0; c < 3; c++) {
      const src = [r, g, b][c]
      this.px[i + c] = Math.round((src * a + this.px[i + c] * dstA * (1 - a)) / outA)
    }
    this.px[i + 3] = Math.round(outA * 255)
  }

  /**
   * Preenche a área onde `sdf(x, y) <= 0`, usando o valor da distância com
   * sinal para suavizar a borda — é o que dá o acabamento limpo nos cantos
   * arredondados sem precisar de supersampling.
   */
  fillShape(sdf, color) {
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const d = sdf(x + 0.5, y + 0.5)
        this.blend(x, y, typeof color === 'function' ? color(x, y) : color, 0.5 - d)
      }
    }
  }

  toPng() {
    return encodePng(this.px, this.w, this.h)
  }
}

/** Distância com sinal para um retângulo de cantos arredondados. */
function roundedRect(x0, y0, w, h, radius) {
  const cx = x0 + w / 2
  const cy = y0 + h / 2
  const hw = w / 2 - radius
  const hh = h / 2 - radius
  return (x, y) => {
    const dx = Math.max(Math.abs(x - cx) - hw, 0)
    const dy = Math.max(Math.abs(y - cy) - hh, 0)
    const outside = Math.hypot(dx, dy) - radius
    const inside = Math.min(Math.max(Math.abs(x - cx) - hw, Math.abs(y - cy) - hh), 0)
    return outside + inside
  }
}

// --------------------------------------------------------------------- arte

const BG_TOP = [16, 185, 129] // emerald-500
const BG_BOTTOM = [5, 122, 85] // emerald-700 puxado para o escuro
const WHITE = [255, 255, 255]

const gradient = (h) => (_x, y) => {
  const t = y / h
  return [
    Math.round(BG_TOP[0] + (BG_BOTTOM[0] - BG_TOP[0]) * t),
    Math.round(BG_TOP[1] + (BG_BOTTOM[1] - BG_TOP[1]) * t),
    Math.round(BG_TOP[2] + (BG_BOTTOM[2] - BG_TOP[2]) * t),
  ]
}

/**
 * Desenha o símbolo do app: três barras crescentes (o gráfico de gastos) com
 * uma seta de tendência subindo por cima. `size` é o lado da caixa do glifo e
 * (ox, oy) o canto superior esquerdo dela.
 */
function drawGlyph(canvas, ox, oy, size) {
  const u = size / 100 // unidade relativa, para o desenho escalar sozinho
  const barW = 18 * u
  const radius = barW / 2
  const gap = 11 * u
  const heights = [40, 62, 86].map((v) => v * u)

  heights.forEach((barH, i) => {
    const x = ox + i * (barW + gap)
    const y = oy + size - barH
    canvas.fillShape(roundedRect(x, y, barW, barH, radius), WHITE)
  })

  // Seta de tendência: um segmento diagonal com ponta, acima das barras.
  const thickness = 7 * u
  const ax = ox + 4 * u
  const ay = oy + 34 * u
  const bx = ox + size - 12 * u
  const by = oy + 2 * u
  canvas.fillShape(segment(ax, ay, bx, by, thickness / 2), WHITE)
  canvas.fillShape(segment(bx, by, bx - 20 * u, by + 2 * u, thickness / 2), WHITE)
  canvas.fillShape(segment(bx, by, bx - 2 * u, by + 20 * u, thickness / 2), WHITE)
}

/** Distância com sinal para um segmento de reta de espessura `r` (cápsula). */
function segment(ax, ay, bx, by, r) {
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy
  return (x, y) => {
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2))
    return Math.hypot(x - (ax + t * dx), y - (ay + t * dy)) - r
  }
}

function makeIcon(size, { maskable = false } = {}) {
  const canvas = new Canvas(size, size)
  if (maskable) {
    // Android recorta a imagem: o fundo precisa sangrar até a borda e o
    // símbolo ficar dentro da "safe zone" central (80% do lado).
    canvas.fillShape(() => -1, gradient(size))
    const glyph = size * 0.46
    drawGlyph(canvas, (size - glyph) / 2, (size - glyph) / 2, glyph)
  } else {
    canvas.fillShape(roundedRect(0, 0, size, size, size * 0.22), gradient(size))
    const glyph = size * 0.56
    drawGlyph(canvas, (size - glyph) / 2, (size - glyph) / 2, glyph)
  }
  return canvas.toPng()
}

function makeSplash(width, height) {
  const canvas = new Canvas(width, height)
  canvas.fillShape(() => -1, [15, 23, 42]) // slate-900, igual ao background_color
  const box = Math.min(width, height) * 0.3
  const canvasIcon = new Canvas(Math.round(box), Math.round(box))
  canvasIcon.fillShape(roundedRect(0, 0, box, box, box * 0.22), gradient(box))
  const glyph = box * 0.56
  drawGlyph(canvasIcon, (box - glyph) / 2, (box - glyph) / 2, glyph)

  // Cola o ícone no centro do splash.
  const ox = Math.round((width - box) / 2)
  const oy = Math.round((height - box) / 2)
  for (let y = 0; y < canvasIcon.h; y++) {
    for (let x = 0; x < canvasIcon.w; x++) {
      const i = (y * canvasIcon.w + x) * 4
      const alpha = canvasIcon.px[i + 3] / 255
      if (alpha > 0) {
        canvas.blend(ox + x, oy + y, [canvasIcon.px[i], canvasIcon.px[i + 1], canvasIcon.px[i + 2]], alpha)
      }
    }
  }
  return canvas.toPng()
}

// --------------------------------------------------------------------- saída

const write = (relPath, buffer) => {
  const full = resolve(ROOT, relPath)
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, buffer)
  console.log(`  ${relPath}  (${(buffer.length / 1024).toFixed(1)} kB)`)
}

console.log('Gerando ícones…')
write('public/icons/icon-192.png', makeIcon(192))
write('public/icons/icon-512.png', makeIcon(512))
write('public/icons/icon-maskable-512.png', makeIcon(512, { maskable: true }))
write('public/icons/apple-touch-icon.png', makeIcon(180))
write('public/favicon.png', makeIcon(64))

console.log('Gerando splash screens do iOS…')
const SPLASHES = [
  [1290, 2796], // iPhone 14/15/16 Pro Max
  [1179, 2556], // iPhone 14/15/16 Pro
  [1284, 2778], // iPhone 12/13 Pro Max
  [1170, 2532], // iPhone 12/13/14
  [1242, 2688], // iPhone XS Max / 11 Pro Max
  [1125, 2436], // iPhone X / XS / 11 Pro
  [828, 1792], // iPhone XR / 11
  [750, 1334], // iPhone SE / 8
]
for (const [w, h] of SPLASHES) write(`public/splash/splash-${w}x${h}.png`, makeSplash(w, h))

console.log('\nPronto.')
