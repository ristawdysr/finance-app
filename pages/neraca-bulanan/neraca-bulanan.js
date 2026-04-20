let neracaTahunInstance = null

const NERACA_MONTHS = [
  { index: 1, name: "Jan" },
  { index: 2, name: "Feb" },
  { index: 3, name: "Mar" },
  { index: 4, name: "Apr" },
  { index: 5, name: "Mei" },
  { index: 6, name: "Jun" },
  { index: 7, name: "Jul" },
  { index: 8, name: "Agu" },
  { index: 9, name: "Sep" },
  { index: 10, name: "Okt" },
  { index: 11, name: "Nov" },
  { index: 12, name: "Des" }
]

function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function getActiveCompanyId() {
  return localStorage.getItem("activeCompanyId") || ""
}

function formatCurrency(num) {
  return "Rp " + new Intl.NumberFormat("id-ID").format(Number(num || 0))
}

function formatSignedCurrency(num) {
  const value = Number(num || 0)
  if (value < 0) return `(${formatCurrency(Math.abs(value))})`
  return formatCurrency(value)
}

function getNeracaYearOptions() {
  const currentYear = new Date().getFullYear()
  const years = []

  for (let y = currentYear - 5; y <= currentYear + 2; y++) {
    years.push(y)
  }

  return years
}

function renderNeracaYearOptions() {
  const el = document.getElementById("neracaTahun")
  if (!el) return

  const selectedYear =
    localStorage.getItem("neracaBulananTahun") || String(new Date().getFullYear())

  el.innerHTML = getNeracaYearOptions()
    .map(year => `
      <option value="${year}" ${String(year) === String(selectedYear) ? "selected" : ""}>
        ${year}
      </option>
    `)
    .join("")
}

function initNeracaYearSelect() {
  const el = document.getElementById("neracaTahun")
  if (!el) return

  if (neracaTahunInstance) {
    neracaTahunInstance.destroy()
    neracaTahunInstance = null
  }

  neracaTahunInstance = new TomSelect(el, {
    create: false,
    controlInput: null,
    placeholder: "Pilih Tahun",
    onChange: function(value) {
      localStorage.setItem("neracaBulananTahun", value)
      loadNeracaBulanan()
    }
  })
}

function renderNeracaTableHead(selectedYear) {
  const thead = document.getElementById("neracaTableHead")
  if (!thead) return

  const visibleMonths = getVisibleNeracaMonths(selectedYear)

  let row1 = `
    <tr>
        <th rowspan="2" class="w-[140px] min-w-[140px] px-4 py-3 text-left font-semibold whitespace-nowrap border-b border-r border-slate-200 bg-blue-50 lg:sticky lg:left-0 lg:z-30">
        Kode COA
        </th>
        <th rowspan="2" class="w-[220px] min-w-[220px] px-4 py-3 text-left font-semibold whitespace-nowrap border-b border-r border-slate-200 bg-blue-50 lg:sticky lg:left-[140px] lg:z-30">
        Nama COA
        </th>
        <th rowspan="2" class="w-[140px] min-w-[140px] px-4 py-3 text-left font-semibold whitespace-nowrap border-b border-r border-slate-200 bg-blue-50 lg:sticky lg:left-[360px] lg:z-30">
        Saldo Normal
        </th>
    `

  let row2 = `<tr>`

  visibleMonths.forEach(month => {
    row1 += `
      <th colspan="4" class="px-4 py-3 text-center font-semibold whitespace-nowrap border-b border-l border-slate-200">
        ${month.name}
      </th>
    `
    row2 += `
      <th class="px-3 py-2 text-right font-semibold whitespace-nowrap border-l border-slate-200">Opening</th>
      <th class="px-3 py-2 text-right font-semibold whitespace-nowrap">Debet</th>
      <th class="px-3 py-2 text-right font-semibold whitespace-nowrap">Kredit</th>
      <th class="px-3 py-2 text-right font-semibold whitespace-nowrap">Ending</th>
    `
  })

  row1 += `</tr>`
  row2 += `</tr>`

  thead.innerHTML = row1 + row2
}

function getMonthFromDate(dateValue) {
  if (!dateValue) return null

  const text = String(dateValue)

  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    return Number(text.slice(5, 7))
  }

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(text)) {
    return Number(text.slice(3, 5))
  }

  const dateObj = new Date(text)
  if (!Number.isNaN(dateObj.getTime())) {
    return dateObj.getMonth() + 1
  }

  return null
}

function buildLedgerMap(rows) {
  const map = {}

  ;(rows || []).forEach(row => {
    const kode = String(row.kode_coa || "").trim()
    const month = getMonthFromDate(row.tanggal)

    if (!kode || !month) return

    if (!map[kode]) {
      map[kode] = {}
    }

    if (!map[kode][month]) {
      map[kode][month] = {
        debet: 0,
        kredit: 0
      }
    }

    map[kode][month].debet += Number(row.debet || 0)
    map[kode][month].kredit += Number(row.kredit || 0)
  })

  return map
}

function buildSaldoAwalMap(rows) {
  const map = {}

  ;(rows || []).forEach(row => {
    const kode = String(row.kode_coa || "").trim()
    if (!kode) return

    map[kode] = {
      opening_debit: Number(row.opening_debit || 0),
      opening_kredit: Number(row.opening_kredit || 0)
    }
  })

  return map
}

function buildNeracaRows(masterCoaRows, saldoAwalMap, ledgerMap) {
  return (masterCoaRows || []).map(coa => {
    const kode = String(coa.kode_akun || "").trim()

    const saldoAwal = saldoAwalMap[kode] || {
      opening_debit: 0,
      opening_kredit: 0
    }

    let openingRunning =
      Number(saldoAwal.opening_debit || 0) - Number(saldoAwal.opening_kredit || 0)

    const months = {}

    NERACA_MONTHS.forEach(month => {
      const ledger = (ledgerMap[kode] && ledgerMap[kode][month.index]) || {
        debet: 0,
        kredit: 0
      }

      const opening = openingRunning
      const debet = Number(ledger.debet || 0)
      const kredit = Number(ledger.kredit || 0)
      const ending = opening + debet - kredit

      months[month.index] = {
        opening,
        debet,
        kredit,
        ending
      }

      openingRunning = ending
    })

    return {
      kode_akun: coa.kode_akun || "",
      nama_akun: coa.nama_akun || "",
      saldo_normal: coa.saldo_normal || "",
      months
    }
  })
}

function renderNeracaTableBody(rows, selectedYear) {
  const tbody = document.getElementById("neracaTableBody")
  if (!tbody) return

  const visibleMonths = getVisibleNeracaMonths(selectedYear)
  const colspan = 3 + (visibleMonths.length * 4)

  if (!rows || !rows.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="${colspan}" class="text-center text-slate-400 py-6">
          Belum ada data neraca
        </td>
      </tr>
    `
    return
  }

  let html = ""

  rows.forEach((row, rowIndex) => {
    const rowBg = rowIndex % 2 === 0 ? "bg-white" : "bg-slate-50"

    html += `
        <tr class="${rowBg} hover:bg-blue-50 transition">
            <td class="w-[140px] min-w-[140px] px-4 py-3 whitespace-nowrap lg:sticky lg:left-0 ${rowBg} lg:z-20 border-r border-slate-200">
            ${escapeHtml(row.kode_akun)}
            </td>
            <td class="w-[220px] min-w-[220px] px-4 py-3 whitespace-nowrap lg:sticky lg:left-[140px] ${rowBg} lg:z-20 border-r border-slate-200">
            ${escapeHtml(row.nama_akun)}
            </td>
            <td class="w-[140px] min-w-[140px] px-4 py-3 whitespace-nowrap lg:sticky lg:left-[360px] ${rowBg} lg:z-20 border-r border-slate-200">
            ${escapeHtml(row.saldo_normal)}
            </td>
    `

    visibleMonths.forEach(month => {
      const item = row.months[month.index]

      html += `
        <td class="px-3 py-3 text-right whitespace-nowrap border-l border-slate-200">
          ${formatSignedCurrency(item.opening)}
        </td>
        <td class="px-3 py-3 text-right whitespace-nowrap text-green-700">
          ${formatCurrency(item.debet)}
        </td>
        <td class="px-3 py-3 text-right whitespace-nowrap text-red-700">
          ${formatCurrency(item.kredit)}
        </td>
        <td class="px-3 py-3 text-right whitespace-nowrap font-semibold">
          ${formatSignedCurrency(item.ending)}
        </td>
      `
    })

    html += `</tr>`
  })

  tbody.innerHTML = html
}

async function initNeracaBulanan() {
  const tahun = Number(
    localStorage.getItem("neracaBulananTahun") || new Date().getFullYear()
  )

  renderNeracaYearOptions()
  initNeracaYearSelect()
  renderNeracaTableHead(tahun)
  await loadNeracaBulanan()
}

async function loadNeracaBulanan() {
  const tbody = document.getElementById("neracaTableBody")
  if (!tbody) return

  const tahun = Number(
    localStorage.getItem("neracaBulananTahun") || new Date().getFullYear()
  )

  const companyId = getActiveCompanyId()
  const visibleMonths = getVisibleNeracaMonths(tahun)
  const colspan = 3 + (visibleMonths.length * 4)

  if (!companyId) {
    tbody.innerHTML = `
      <tr>
        <td colspan="${colspan}" class="text-center text-red-500 py-6">
          Company belum dipilih
        </td>
      </tr>
    `
    return
  }

  tbody.innerHTML = `
    <tr>
      <td colspan="${colspan}" class="text-center text-slate-400 py-6">Loading...</td>
    </tr>
  `
  renderNeracaTableHead(tahun)

  const { data: masterCoaRows, error: coaError } = await supabaseClient
    .from("master_coa")
    .select("kode_akun, nama_akun, saldo_normal, laporan")
    .eq("company_id", companyId)
    .eq("laporan", "Neraca")
    .order("kode_akun", { ascending: true })

  if (coaError) {
    console.error("LOAD MASTER COA NERACA ERROR:", coaError)
    tbody.innerHTML = `
      <tr>
        <td colspan="${colspan}" class="text-center text-red-500 py-6">
          ${escapeHtml(coaError.message)}
        </td>
      </tr>
    `
    return
  }

  const { data: saldoAwalRows, error: saldoError } = await supabaseClient
    .from("saldo_awal_snapshot")
    .select("kode_coa, opening_debit, opening_kredit")
    .eq("company_id", companyId)
    .eq("tahun", tahun)

  if (saldoError) {
    console.error("LOAD SALDO AWAL SNAPSHOT NERACA ERROR:", saldoError)
    tbody.innerHTML = `
      <tr>
        <td colspan="${colspan}" class="text-center text-red-500 py-6">
          ${escapeHtml(saldoError.message)}
        </td>
      </tr>
    `
    return
  }

  const { data: jurnalRows, error: jurnalError } = await supabaseClient
    .from("jurnal_detail")
    .select("kode_coa, tanggal, debet, kredit")
    .eq("company_id", companyId)
    .gte("tanggal", `${tahun}-01-01`)
    .lte("tanggal", `${tahun}-12-31`)

  if (jurnalError) {
    console.error("LOAD JURNAL NERACA ERROR:", jurnalError)
    tbody.innerHTML = `
      <tr>
        <td colspan="${colspan}" class="text-center text-red-500 py-6">
          ${escapeHtml(jurnalError.message)}
        </td>
      </tr>
    `
    return
  }

  const saldoAwalMap = buildSaldoAwalMap(saldoAwalRows || [])
  const ledgerMap = buildLedgerMap(jurnalRows || [])
  const finalRows = buildNeracaRows(masterCoaRows || [], saldoAwalMap, ledgerMap)

  renderNeracaTableBody(finalRows, tahun)
}

function getVisibleNeracaMonths(selectedYear) {
  const currentDate = new Date()
  const currentYear = currentDate.getFullYear()
  const currentMonth = currentDate.getMonth() + 1

  if (Number(selectedYear) === currentYear) {
    return NERACA_MONTHS.filter(month => month.index <= currentMonth)
  }

  return NERACA_MONTHS
}