// Пересобирает картинки README из страницы docs/story/src/story.html.
// Запуск из корня репозитория: node docs/story/src/capture.mjs [каталог для картинок]
// Каждая «плита» страницы снимается в светлой и тёмной теме с двойной плотностью пикселей.
import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const out = resolve(process.argv[2] ?? resolve(here, '..'))
await mkdir(out, { recursive: true })

// Сжатие необязательно. Без пакета sharp картинки получаются в два-три раза тяжелее,
// но выглядят так же. В зависимости проекта sharp не входит: он нужен только здесь.
const sharp = await import('sharp').then(
  (module) => module.default,
  () => null,
)

const browser = await chromium.launch()
let count = 0
for (const theme of ['light', 'dark']) {
  const context = await browser.newContext({
    viewport: { width: 1040, height: 900 },
    deviceScaleFactor: 2,
    colorScheme: theme,
  })
  const page = await context.newPage()
  await page.goto(`file://${resolve(here, 'story.html')}`)
  await page.evaluate((value) => {
    document.documentElement.dataset.theme = value
  }, theme)
  // Углы плит остаются прозрачными: картинка ложится на любой фон GitHub.
  await page.addStyleTag({ content: 'html, body { background: transparent !important; }' })
  await page.evaluate(() => document.fonts.ready)
  await page.waitForLoadState('networkidle')

  for (const plate of await page.locator('.plate[data-name]').all()) {
    const name = await plate.getAttribute('data-name')
    const png = await plate.screenshot({ omitBackground: true })
    const image = sharp
      ? await sharp(png).png({ palette: true, colours: 256, effort: 10, dither: 0.4 }).toBuffer()
      : png
    await writeFile(resolve(out, `${name}.${theme}.png`), image)
    count += 1
  }
  await context.close()
}
await browser.close()
console.log(`Снято картинок: ${count}. Сжатие: ${sharp ? 'да' : 'нет, пакет sharp не найден'}.`)
