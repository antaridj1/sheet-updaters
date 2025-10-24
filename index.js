import fetch from 'node-fetch'
import { google } from 'googleapis'

// --- Config from env ---
const SHEET_ID = process.env.SHEET_ID // required
const SOURCE_API_URL = process.env.SOURCE_API_URL // required
const SOURCE_API_KEY = process.env.SOURCE_API_KEY // required

// You can override these if your sheet/ranges change later:
const WRITE_RANGE = process.env.WRITE_RANGE || 'シート!A2' // where to start writing
const CLEAR_RANGE = process.env.CLEAR_RANGE || 'シート!A12:Z2000' // what to clear first

// Validate required env
if (!SHEET_ID || !SOURCE_API_URL || !SOURCE_API_KEY) {
  console.error(
    'Missing required env: SHEET_ID, SOURCE_API_URL, SOURCE_API_KEY'
  )
  process.exit(1)
}

async function fetchRows() {
  const resp = await fetch(SOURCE_API_URL, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'X-API-KEY': SOURCE_API_KEY
    }
    // Cloud Run has outbound egress; adjust if your API is private
  })

  if (!resp.ok) {
    throw new Error(`Source API HTTP ${resp.status}`)
  }

  const json = await resp.json()

  // Expecting { status: 200, data: [...] }
  if (!json || !Array.isArray(json.data)) {
    throw new Error('Invalid API response shape (missing data array).')
  }

  // Map to the same column order your PHP job used:
  // [
  //   shop_name, duration,
  //   today_available, today_percentage,
  //   seven_days_available, seven_days_percentage,
  //   one_month_available, one_month_percentage,
  //   next_month_available, next_month_percentage,
  //   updated_at, cpa, updated_daily_budget
  // ]
  const rows = json.data.map(item => [
    item.shop_name ?? '',
    item.duration ?? '',
    item.today_available ?? '',
    item.today_percentage ?? '',
    item.seven_days_available ?? '',
    item.seven_days_percentage ?? '',
    item.one_month_available ?? '',
    item.one_month_percentage ?? '',
    item.next_month_available ?? '',
    item.next_month_percentage ?? '',
    item.updated_at ?? '',
    item.cpa ?? '-',
    item.updated_daily_budget ?? '-'
  ])

  return { range: WRITE_RANGE, rows }
}

async function updateSheet({ range, rows }) {
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  })
  const client = await auth.getClient()
  const sheets = google.sheets({ version: 'v4', auth: client })

  // (1) Clear old contents
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SHEET_ID,
    range: CLEAR_RANGE,
    requestBody: {} // empty body for clear
  })

  // (2) Write new rows
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range,
    valueInputOption: 'RAW',
    requestBody: { values: rows }
  })
}

async function main() {
  console.log('Fetching rows from API...')
  const payload = await fetchRows()
  console.log(`Fetched ${payload.rows.length} rows. Updating sheet...`)
  await updateSheet(payload)
  console.log('✅ Update Google Sheets Successfully!')
}

main().catch(err => {
  console.error('❌ ERROR:', err.message)
  process.exit(2)
})
