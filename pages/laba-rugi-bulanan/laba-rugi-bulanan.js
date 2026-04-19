let labaRugiBulananTahunInstance = null

const LR_MONTHS = [
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

function formatPercent(value) {
  const num = Number(value || 0)
  return `${new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num)}%`
}

function getVisibleLRMonths(selectedYear) {
  const currentDate = new Date()
  const currentYear = currentDate.getFullYear()
  const currentMonth = currentDate.getMonth() + 1

  if (Number(selectedYear) === currentYear) {
    return LR_MONTHS.filter(month => month.index <= currentMonth)
  }

  return LR_MONTHS
}

function getLRTahunOptions() {
  const currentYear = new Date().getFullYear()
  const years = []

  for (let y = currentYear - 5; y <= currentYear + 2; y++) {
    years.push(y)
  }

  return years
}

function renderLRTahunOptions() {
  const el = document.getElementById("labaRugiBulananTahun")
  if (!el) return

  const selectedYear =
    localStorage.getItem("labaRugiBulananTahun") || String(new Date().getFullYear())

  el.innerHTML = getLRTahunOptions()
    .map(year => `
      <option value="${year}" ${String(year) === String(selectedYear) ? "selected" : ""}>
        ${year}
      </option>
    `)
    .join("")
}

function initLRTahunSelect() {
  const el = document.getElementById("labaRugiBulananTahun")
  if (!el) return

  if (labaRugiBulananTahunInstance) {
    labaRugiBulananTahunInstance.destroy()
    labaRugiBulananTahunInstance = null
  }

  labaRugiBulananTahunInstance = new TomSelect(el, {
    create: false,
    controlInput: null,
    placeholder: "Pilih Tahun",
    onChange: function(value) {
      localStorage.setItem("labaRugiBulananTahun", value)
      loadLabaRugiBulanan()
    }
  })
}

function renderLabaRugiBulananHead(selectedYear) {
  const thead = document.getElementById("labaRugiBulananHead")
  if (!thead) return

  const visibleMonths = getVisibleLRMonths(selectedYear)

  let html = `
    <tr>
      <th class="w-[140px] min-w-[140px] px-4 py-3 text-left font-semibold whitespace-nowrap border-b border-r border-slate-200 bg-blue-50 sticky left-0 z-30">
        Kode COA
      </th>
      <th class="w-[260px] min-w-[260px] px-4 py-3 text-left font-semibold whitespace-nowrap border-b border-r border-slate-200 bg-blue-50 sticky left-[140px] z-30">
        Keterangan / Nama COA
      </th>
  `

  visibleMonths.forEach(month => {
    html += `
      <th class="px-4 py-3 text-right font-semibold whitespace-nowrap border-b border-r border-slate-200">
        ${month.name}
      </th>
    `
  })

  html += `
      <th class="px-4 py-3 text-right font-semibold whitespace-nowrap border-b bg-blue-50">
        Total
      </th>
    </tr>
  `

  thead.innerHTML = html
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

function buildLRLedgerMap(rows) {
  const map = {}

  ;(rows || []).forEach(row => {
    const kode = String(row.kode_coa || "").trim()
    const month = getMonthFromDate(row.tanggal)

    if (!kode || !month) return

    if (!map[kode]) map[kode] = {}
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

function buildAkunLabaRugiRows(masterCoaRows, ledgerMap) {
  return (masterCoaRows || []).map(coa => {
    const kode = String(coa.kode_akun || "").trim()
    const saldoNormal = String(coa.saldo_normal || "").trim().toLowerCase()

    const months = {}
    let total = 0

    LR_MONTHS.forEach(month => {
      const ledger = (ledgerMap[kode] && ledgerMap[kode][month.index]) || {
        debet: 0,
        kredit: 0
      }

      const value = saldoNormal === "kredit"
        ? Number(ledger.kredit || 0)
        : Number(ledger.debet || 0)

      months[month.index] = value
      total += value
    })

    return {
      kode_akun: coa.kode_akun || "",
      nama_akun: coa.nama_akun || "",
      saldo_normal: coa.saldo_normal || "",
      months,
      total
    }
  })
}

function sumSectionByMonth(rows) {
  const result = {}
  LR_MONTHS.forEach(month => {
    result[month.index] = 0
  })

  ;(rows || []).forEach(row => {
    LR_MONTHS.forEach(month => {
      result[month.index] += Number(row.months?.[month.index] || 0)
    })
  })

  return result
}

function sumGrandTotal(monthMap) {
  return Object.values(monthMap).reduce((acc, val) => acc + Number(val || 0), 0)
}

function renderSectionHeader(title, colspan) {
  return `
    <tr>
      <td colspan="${colspan}" class="px-4 py-3 bg-slate-200 text-slate-800 font-semibold uppercase tracking-wide">
        ${escapeHtml(title)}
      </td>
    </tr>
  `
}

function renderEmptyRow(colspan) {
  return `
    <tr>
      <td colspan="${colspan}" class="px-4 py-3 bg-white">&nbsp;</td>
    </tr>
  `
}

function renderAccountRows(rows, visibleMonths) {
  let html = ""

  rows.forEach((row, rowIndex) => {
    const rowBg = rowIndex % 2 === 0 ? "bg-white" : "bg-slate-50"

    html += `
      <tr class="${rowBg} hover:bg-blue-50 transition">
        <td class="w-[140px] min-w-[140px] px-4 py-3 whitespace-nowrap sticky left-0 ${rowBg} z-20 border-r border-slate-200">
          ${escapeHtml(row.kode_akun)}
        </td>
        <td class="w-[260px] min-w-[260px] px-4 py-3 whitespace-nowrap sticky left-[140px] ${rowBg} z-20 border-r border-slate-200">
          ${escapeHtml(row.nama_akun)}
        </td>
    `

    visibleMonths.forEach(month => {
      html += `
        <td class="px-4 py-3 text-right whitespace-nowrap ${row.saldo_normal?.toLowerCase() === "kredit" ? "text-blue-700" : "text-orange-700"}">
          ${formatCurrency(row.months[month.index])}
        </td>
      `
    })

    html += `
        <td class="px-4 py-3 text-right whitespace-nowrap font-semibold">
          ${formatCurrency(row.total)}
        </td>
      </tr>
    `
  })

  return html
}

function renderTotalRow(label, monthMap, visibleMonths, extraClass = "") {
  const grandTotal = sumGrandTotal(monthMap)

  let html = `
    <tr class="bg-slate-100 ${extraClass}">
      <td class="px-4 py-3 font-semibold border-t border-slate-200"></td>
      <td class="px-4 py-3 font-semibold border-t border-slate-200">
        ${escapeHtml(label)}
      </td>
  `

  visibleMonths.forEach(month => {
    html += `
      <td class="px-4 py-3 text-right font-semibold whitespace-nowrap border-t border-slate-200">
        ${formatCurrency(monthMap[month.index])}
      </td>
    `
  })

  html += `
      <td class="px-4 py-3 text-right font-bold whitespace-nowrap border-t border-slate-200">
        ${formatCurrency(grandTotal)}
      </td>
    </tr>
  `

  return html
}

function renderMarginRow(label, pendapatanMap, labaBersihMap, visibleMonths) {
  const pendapatanTotal = sumGrandTotal(pendapatanMap)
  const labaBersihTotal = sumGrandTotal(labaBersihMap)
  const totalMargin = pendapatanTotal > 0 ? (labaBersihTotal / pendapatanTotal) * 100 : 0

  let html = `
    <tr class="bg-blue-50">
      <td class="px-4 py-3 font-semibold border-t border-slate-200"></td>
      <td class="px-4 py-3 font-semibold border-t border-slate-200">
        ${escapeHtml(label)}
      </td>
  `

  visibleMonths.forEach(month => {
    const pendapatan = Number(pendapatanMap[month.index] || 0)
    const laba = Number(labaBersihMap[month.index] || 0)
    const margin = pendapatan > 0 ? (laba / pendapatan) * 100 : 0

    html += `
      <td class="px-4 py-3 text-right font-semibold whitespace-nowrap border-t border-slate-200">
        ${formatPercent(margin)}
      </td>
    `
  })

  html += `
      <td class="px-4 py-3 text-right font-bold whitespace-nowrap border-t border-slate-200">
        ${formatPercent(totalMargin)}
      </td>
    </tr>
  `

  return html
}

function renderLabaRugiBulananBody(pendapatanRows, bebanRows, selectedYear) {
  const tbody = document.getElementById("labaRugiBulananBody")
  if (!tbody) return

  const visibleMonths = getVisibleLRMonths(selectedYear)
  const colspan = 2 + visibleMonths.length + 1

  const pendapatanTotals = sumSectionByMonth(pendapatanRows)
  const bebanTotals = sumSectionByMonth(bebanRows)

  const labaBersihMap = {}
  LR_MONTHS.forEach(month => {
    labaBersihMap[month.index] =
      Number(pendapatanTotals[month.index] || 0) - Number(bebanTotals[month.index] || 0)
  })

  const hasAnyData = (pendapatanRows && pendapatanRows.length) || (bebanRows && bebanRows.length)

  if (!hasAnyData) {
    tbody.innerHTML = `
      <tr>
        <td colspan="${colspan}" class="px-4 py-6 text-center text-slate-400">
          Belum ada data laba rugi
        </td>
      </tr>
    `
    return
  }

  let html = ""

  html += renderSectionHeader("Pendapatan", colspan)
  html += renderAccountRows(pendapatanRows, visibleMonths)
  html += renderTotalRow("Pendapatan Bersih", pendapatanTotals, visibleMonths)

  html += renderSectionHeader("Beban Usaha", colspan)
  html += renderAccountRows(bebanRows, visibleMonths)
  html += renderTotalRow("Total Beban Usaha", bebanTotals, visibleMonths)

  html += renderEmptyRow(colspan)
  html += renderTotalRow("Laba Bersih", labaBersihMap, visibleMonths, "bg-green-50")
  html += renderMarginRow("Margin %", pendapatanTotals, labaBersihMap, visibleMonths)

  tbody.innerHTML = html
}

async function initLabaRugiBulanan() {
  const tahun = Number(
    localStorage.getItem("labaRugiBulananTahun") || new Date().getFullYear()
  )

  renderLRTahunOptions()
  initLRTahunSelect()
  renderLabaRugiBulananHead(tahun)
  await loadLabaRugiBulanan()
}

async function loadLabaRugiBulanan() {
  const tbody = document.getElementById("labaRugiBulananBody")
  if (!tbody) return

  const tahun = Number(
    localStorage.getItem("labaRugiBulananTahun") || new Date().getFullYear()
  )
  const companyId = getActiveCompanyId()
  const visibleMonths = getVisibleLRMonths(tahun)
  const colspan = 2 + visibleMonths.length + 1

  if (!companyId) {
    tbody.innerHTML = `
      <tr>
        <td colspan="${colspan}" class="px-4 py-6 text-center text-red-500">
          Company belum dipilih
        </td>
      </tr>
    `
    return
  }

  renderLabaRugiBulananHead(tahun)

  tbody.innerHTML = `
    <tr>
      <td colspan="${colspan}" class="px-4 py-6 text-center text-slate-400">
        Loading...
      </td>
    </tr>
  `

  const { data: masterCoaRows, error: coaError } = await supabaseClient
    .from("master_coa")
    .select("kode_akun, nama_akun, saldo_normal, laporan")
    .eq("company_id", companyId)
    .eq("laporan", "Laba Rugi")
    .order("kode_akun", { ascending: true })

  if (coaError) {
    console.error("LOAD MASTER COA LR BULANAN ERROR:", coaError)
    tbody.innerHTML = `
      <tr>
        <td colspan="${colspan}" class="px-4 py-6 text-center text-red-500">
          ${escapeHtml(coaError.message)}
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
    console.error("LOAD JURNAL LR BULANAN ERROR:", jurnalError)
    tbody.innerHTML = `
      <tr>
        <td colspan="${colspan}" class="px-4 py-6 text-center text-red-500">
          ${escapeHtml(jurnalError.message)}
        </td>
      </tr>
    `
    return
  }

  const ledgerMap = buildLRLedgerMap(jurnalRows || [])
  const allRows = buildAkunLabaRugiRows(masterCoaRows || [], ledgerMap)

  const pendapatanRows = allRows.filter(row =>
    String(row.saldo_normal || "").trim().toLowerCase() === "kredit"
  )

  const bebanRows = allRows.filter(row =>
    String(row.saldo_normal || "").trim().toLowerCase() === "debet"
  )

  renderLabaRugiBulananBody(pendapatanRows, bebanRows, tahun)
}