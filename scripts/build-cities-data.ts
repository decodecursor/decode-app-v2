/**
 * Build script — generates lib/cities/data.json from GeoNames cities15000.
 *
 * Source: https://download.geonames.org/export/dump/cities15000.zip
 * License: CC-BY 4.0 (GeoNames). Attribution lives in README.md.
 *
 * Output shape: { "<lowercase city name or asciiname>": "<ISO-2>", ... }
 * Selection: cities with population >= 15,000, sorted by population desc,
 * top 5,000 globally retained. Both `name` and `asciiname` are indexed
 * separately (so "São Paulo" and "sao paulo" both resolve). On key
 * collision across different cities, the higher-population city wins
 * (first write wins, since we sort desc before iterating).
 *
 * Regen: `npm run build:cities`. Re-run when GeoNames updates land
 * (city → country mappings change very rarely; once or twice a year is
 * plenty).
 *
 * Dependencies: only Node built-ins + python3 for zip extraction (zipfile
 * is in python's stdlib so no install needed). Avoids adding adm-zip /
 * jszip as a devDependency.
 */

import { execSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const ZIP_URL = 'https://download.geonames.org/export/dump/cities15000.zip'
const TOP_N = 5000
const OUTPUT_PATH = join(__dirname, '..', 'lib', 'cities', 'data.json')

interface CityRow {
  name: string
  asciiname: string
  countryCode: string
  population: number
}

async function downloadZip(destPath: string): Promise<void> {
  console.log(`[build-cities] Downloading ${ZIP_URL}...`)
  const res = await fetch(ZIP_URL)
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  writeFileSync(destPath, buf)
  console.log(`[build-cities] Downloaded ${(buf.byteLength / 1024).toFixed(1)} KB`)
}

function extractZip(zipPath: string, destDir: string): string {
  console.log(`[build-cities] Extracting via python3 -m zipfile...`)
  execSync(`python3 -m zipfile -e "${zipPath}" "${destDir}"`, { stdio: 'inherit' })
  return join(destDir, 'cities15000.txt')
}

function parseTsv(txtPath: string): CityRow[] {
  const raw = readFileSync(txtPath, 'utf8')
  const lines = raw.split('\n').filter((l) => l.length > 0)
  // GeoNames cities15000.txt — TSV, 19 columns:
  // 0:geonameid 1:name 2:asciiname 3:alternatenames 4:lat 5:lng
  // 6:feature_class 7:feature_code 8:country_code 9:cc2 10:admin1
  // 11:admin2 12:admin3 13:admin4 14:population 15:elevation
  // 16:dem 17:timezone 18:modification_date
  return lines.map((line) => {
    const c = line.split('\t')
    return {
      name: c[1],
      asciiname: c[2],
      countryCode: c[8],
      population: parseInt(c[14], 10) || 0,
    }
  })
}

function buildMap(rows: CityRow[]): Record<string, string> {
  const sorted = [...rows].sort((a, b) => b.population - a.population)
  const top = sorted.slice(0, TOP_N)
  const map: Record<string, string> = {}
  let collisions = 0
  for (const row of top) {
    const nameKey = row.name.toLowerCase()
    if (!(nameKey in map)) map[nameKey] = row.countryCode
    else collisions++
    const asciiKey = row.asciiname.toLowerCase()
    if (asciiKey !== nameKey && !(asciiKey in map)) {
      map[asciiKey] = row.countryCode
    }
  }
  console.log(`[build-cities] ${collisions} key collisions resolved by population (first-write wins)`)
  return map
}

function writeOutput(map: Record<string, string>): void {
  // Sort keys alphabetically for deterministic diffs across regens.
  const sortedKeys = Object.keys(map).sort()
  const sortedMap: Record<string, string> = {}
  for (const k of sortedKeys) sortedMap[k] = map[k]
  const json = JSON.stringify(sortedMap, null, 0) // single-line, no whitespace — keep file size minimal
  writeFileSync(OUTPUT_PATH, json + '\n', 'utf8')
}

async function main() {
  const tmpRoot = join(tmpdir(), `geonames-cities-${Date.now()}`)
  mkdirSync(tmpRoot, { recursive: true })
  const zipPath = join(tmpRoot, 'cities15000.zip')

  try {
    await downloadZip(zipPath)
    const txtPath = extractZip(zipPath, tmpRoot)
    const rows = parseTsv(txtPath)
    console.log(`[build-cities] Parsed ${rows.length} city rows`)
    const map = buildMap(rows)

    // Ensure output dir exists.
    mkdirSync(join(__dirname, '..', 'lib', 'cities'), { recursive: true })
    writeOutput(map)

    const stat = statSync(OUTPUT_PATH)
    console.log('')
    console.log('========================================')
    console.log(`[build-cities] DONE`)
    console.log(`  Total entries: ${Object.keys(map).length}`)
    console.log(`  File size:     ${(stat.size / 1024).toFixed(1)} KB`)
    console.log(`  Path:          ${OUTPUT_PATH}`)
    console.log(`  Top-5 sample:`)
    const sortedRows = [...rows].sort((a, b) => b.population - a.population).slice(0, 5)
    for (const row of sortedRows) {
      console.log(`    ${row.name.padEnd(20)} ${row.countryCode}  pop=${row.population}`)
    }
    console.log('========================================')
  } finally {
    // Cleanup temp dir.
    try { rmSync(tmpRoot, { recursive: true, force: true }) } catch { /* ignore */ }
  }
}

main().catch((err) => {
  console.error('[build-cities] FAILED:', err)
  process.exit(1)
})
