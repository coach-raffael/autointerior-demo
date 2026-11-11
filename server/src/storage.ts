import fs from 'node:fs/promises'
import path from 'node:path'
import net from 'node:net'
import dns from 'node:dns/promises'
import sharp, { type Metadata, type OutputInfo } from 'sharp'
import { badRequest } from './lib.js'

export const SIZES = [400, 800, 1600] as const
export type Size = (typeof SIZES)[number]
const MAX_BYTES = 15 * 1024 * 1024
const ALLOWED = new Set(['jpeg', 'png', 'webp', 'avif', 'heif', 'gif', 'tiff'])

export interface ProcessedImage { width: number; height: number; bytes: number; mime: string }

/**
 * Local-disk media store. Every upload is normalised to sRGB WebP in three widths,
 * EXIF-rotated and stripped of metadata (phone photos carry GPS).
 * Swap for an S3 implementation with the same two methods when needed.
 */
export class MediaStore {
  constructor(private dir: string) {}

  async put(id: string, input: Buffer): Promise<ProcessedImage> {
    if (input.length > MAX_BYTES) throw badRequest('Image is larger than 15 MB')
    let meta: Metadata
    try { meta = await sharp(input).metadata() } catch { throw badRequest('That file is not an image') }
    if (!meta.format || !ALLOWED.has(meta.format)) throw badRequest(`Unsupported image format: ${meta.format ?? 'unknown'}`)
    const folder = path.join(this.dir, id)
    await fs.mkdir(folder, { recursive: true })
    let first: OutputInfo | undefined
    for (const w of [...SIZES].reverse()) {
      const info = await sharp(input).rotate().resize({ width: w, withoutEnlargement: true }).toColourspace('srgb')
        .webp({ quality: w >= 1600 ? 80 : 78 }).toFile(path.join(folder, `${w}.webp`))
      first ??= info
    }
    return { width: first!.width, height: first!.height, bytes: first!.size, mime: 'image/webp' }
  }

  filePath(id: string, size: Size) {
    if (!/^[A-Z]+-[0-9A-Z]+$/.test(id)) throw badRequest('Bad media id')
    return path.join(this.dir, id, `${size}.webp`)
  }

  async remove(id: string) {
    await fs.rm(path.join(this.dir, id), { recursive: true, force: true })
  }
}

/* ---------- fetching images from the web (MCP: image_url) ---------- */

function isPrivateIp(ip: string) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number)
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127)
  }
  const l = ip.toLowerCase()
  return l === '::1' || l.startsWith('fc') || l.startsWith('fd') || l.startsWith('fe80') || l.startsWith('::ffff:127.') || l === '::'
}

/** Downloads an image over https only, refusing internal addresses (no SSRF into the server's network). */
export async function fetchImage(url: string): Promise<Buffer> {
  let u: URL
  try { u = new URL(url) } catch { throw badRequest('image_url is not a valid URL') }
  if (u.protocol !== 'https:') throw badRequest('image_url must use https')
  const addrs = await dns.lookup(u.hostname, { all: true }).catch(() => [])
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) throw badRequest('image_url points to a host that is not allowed')
  const res = await fetch(u, { redirect: 'error', signal: AbortSignal.timeout(15_000) })
  if (!res.ok) throw badRequest(`Could not download the image (HTTP ${res.status})`)
  const len = Number(res.headers.get('content-length') ?? 0)
  if (len > MAX_BYTES) throw badRequest('Image is larger than 15 MB')
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length > MAX_BYTES) throw badRequest('Image is larger than 15 MB')
  return buf
}
