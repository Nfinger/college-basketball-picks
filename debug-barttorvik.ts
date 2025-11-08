import * as cheerio from 'cheerio'

async function debugBartTorvik() {
  console.log('Fetching BartTorvik page...\n')

  const url = 'https://barttorvik.com/trank.php'
  const response = await fetch(url)
  const html = await response.text()

  console.log('Response status:', response.status)
  console.log('HTML length:', html.length)
  console.log('\n--- First 2000 chars of HTML ---')
  console.log(html.substring(0, 2000))
  console.log('\n--- Searching for tables ---')

  const $ = cheerio.load(html)
  const tables = $('table')
  console.log('Number of tables found:', tables.length)

  if (tables.length > 0) {
    tables.each((i, table) => {
      const id = $(table).attr('id') || 'no-id'
      const className = $(table).attr('class') || 'no-class'
      const rows = $(table).find('tr').length
      console.log(`Table ${i}: id="${id}", class="${className}", rows=${rows}`)
    })
  }

  console.log('\n--- Searching for common data containers ---')
  console.log('divs with id containing "table":', $('div[id*="table"]').length)
  console.log('divs with class containing "table":', $('div[class*="table"]').length)
  console.log('divs with id containing "data":', $('div[id*="data"]').length)
  console.log('script tags:', $('script').length)

  // Look for common JavaScript frameworks
  console.log('\n--- Checking for JS frameworks ---')
  if (html.includes('react')) console.log('Found: React')
  if (html.includes('vue')) console.log('Found: Vue')
  if (html.includes('angular')) console.log('Found: Angular')
  if (html.includes('DataTable')) console.log('Found: DataTables')
  if (html.includes('datatables')) console.log('Found: DataTables (lowercase)')
}

debugBartTorvik().catch(console.error)
