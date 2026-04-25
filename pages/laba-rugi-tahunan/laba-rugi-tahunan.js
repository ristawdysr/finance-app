window.lrTahunanTahunInstance = window.lrTahunanTahunInstance || null

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
  const value = Number(num || 0)

  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value)
}

function formatSignedCurrency(num) {
  const value = Number(num || 0)

  if (value === 0) return "-"

  if (value < 0) {
    return `(${formatCurrency(Math.abs(value))})`
  }

  return formatCurrency(value)
}
function formatCurrencyCell(num) {
  const value = Number(num || 0)
  if (value === 0) return "-"
  if (value < 0) return `(${formatCurrency(Math.abs(value))})`
  return formatCurrency(value)
}

async function exportPDF() {
  if (typeof html2pdf === "undefined") {
    Swal.fire("Error", "Library PDF belum dimuat", "error")
    return
  }

  const source = document.getElementById("lrTahunanPrintArea")
  if (!source) {
    Swal.fire("Error", "Area PDF tidak ditemukan", "error")
    return
  }

  const wrapper = document.createElement("div")
  wrapper.style.position = "fixed"
  wrapper.style.left = "-99999px"
  wrapper.style.top = "0"
  wrapper.style.width = "210mm"
  wrapper.style.background = "#fff"
  wrapper.style.zIndex = "-1"

  const clone = source.cloneNode(true)
  clone.classList.add("pdf-export-mode")
  clone.style.width = "190mm"
  clone.style.minWidth = "0"
  clone.style.maxWidth = "190mm"
  clone.style.margin = "0 auto"
  clone.style.background = "#fff"
  clone.style.border = "0"
  clone.style.borderRadius = "0"
  clone.style.boxShadow = "none"
  clone.style.overflow = "visible"

  wrapper.appendChild(clone)
  document.body.appendChild(wrapper)

  const opt = {
    margin: [4, 6, 6, 6],
    filename: "Laba-Rugi-Tahunan.pdf",
    pagebreak: { mode: ["avoid-all", "css"] },
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      scrollX: 0,
      scrollY: 0
    },
    jsPDF: {
      unit: "mm",
      format: "a4",
      orientation: "portrait",
      compressPDF: true
    }
  }

  try {
    await html2pdf().set(opt).from(clone).save()
  } catch (err) {
    console.error("EXPORT PDF ERROR:", err)
    Swal.fire("Error", "Gagal export PDF", "error")
  } finally {
    wrapper.remove()
  }
}

function exportExcel() {
  const table = document.querySelector("#lrTahunanPrintArea table")

  const wb = XLSX.utils.table_to_book(table, { sheet: "Laba Rugi" })

  XLSX.writeFile(wb, "Laba-Rugi-Tahunan.xlsx")
}

function getLRTahunanYearOptions() {
  const currentYear = new Date().getFullYear()
  const years = []

  for (let y = currentYear - 5; y <= currentYear + 2; y++) {
    years.push(y)
  }

  return years
}

function renderLRTahunanYearOptions() {
  const el = document.getElementById("lrTahunanTahun")
  if (!el) return

  const selectedYear =
    localStorage.getItem("labaRugiTahunanTahun") || String(new Date().getFullYear())

  el.innerHTML = getLRTahunanYearOptions()
    .map(year => `
      <option value="${year}" ${String(year) === String(selectedYear) ? "selected" : ""}>
        ${year}
      </option>
    `)
    .join("")
}

function initLRTahunanYearSelect() {
  const el = document.getElementById("lrTahunanTahun")
  if (!el) return

  if (lrTahunanTahunInstance) {
    lrTahunanTahunInstance.destroy()
    lrTahunanTahunInstance = null
  }

  lrTahunanTahunInstance = new TomSelect(el, {
    create: false,
    controlInput: null,
    placeholder: "Pilih Tahun",
    onChange: function(value) {
      localStorage.setItem("labaRugiTahunanTahun", value)
      loadLabaRugiTahunan()
    }
  })
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

function buildTahunanLedgerMap(rows) {
  const map = {}

  ;(rows || []).forEach(row => {
    const kode = String(row.kode_coa || "").trim()
    if (!kode) return

    if (!map[kode]) {
      map[kode] = {
        debet: 0,
        kredit: 0
      }
    }

    map[kode].debet += Number(row.debet || 0)
    map[kode].kredit += Number(row.kredit || 0)
  })

  return map
}

/**
 * Silakan sesuaikan mapping ini sesuai isi kategori di master_coa kamu.
 * Default rules:
 * - Pendapatan utama: saldo normal kredit, bukan "lain"
 * - Pendapatan lain-lain: saldo normal kredit, kategori/seksi/nama mengandung "lain"
 * - Beban penjualan: saldo normal debet, kategori/seksi/nama mengandung "penjualan"
 * - Beban administrasi & umum: saldo normal debet, kategori/seksi/nama mengandung "administrasi" / "umum"
 * - Beban lain-lain: saldo normal debet, kategori/seksi/nama mengandung "lain"
 */
function classifyLabaRugiAccount(coa) {
  const saldoNormal = String(coa.saldo_normal || "").trim().toLowerCase()
  const kategori = String(coa.kategori || "").trim().toLowerCase()
  const seksi = String(coa.seksi || "").trim().toLowerCase()
  const nama = String(coa.nama_akun || "").trim().toLowerCase()

  const bucketText = `${kategori} ${seksi} ${nama}`

  const isLain = bucketText.includes("lain")
  const isPenjualan = bucketText.includes("penjualan")
  const isAdministrasi = bucketText.includes("administrasi") || bucketText.includes("umum")

  if (saldoNormal === "kredit") {
    if (isLain) return "pendapatan_lain"
    return "pendapatan"
  }

  if (saldoNormal === "debet") {
    if (isPenjualan) return "beban_penjualan"
    if (isAdministrasi) return "beban_administrasi"
    if (isLain) return "beban_lain"
    return "beban_administrasi"
  }

  return "unknown"
}

function buildLRTahunanRows(masterCoaRows, ledgerMap) {
  return (masterCoaRows || []).map(coa => {
    const kode = String(coa.kode_akun || "").trim()
    const ledger = ledgerMap[kode] || { debet: 0, kredit: 0 }

    return {
      kode_akun: coa.kode_akun || "",
      nama_akun: coa.nama_akun || "",
      saldo_normal: coa.saldo_normal || "",
      kategori: coa.kategori || "",
      seksi: coa.seksi || "",
      debet: Number(ledger.debet || 0),
      kredit: Number(ledger.kredit || 0),
      nilai: String(coa.saldo_normal || "").trim().toLowerCase() === "kredit"
        ? Number(ledger.kredit || 0)
        : Number(ledger.debet || 0),
      group: classifyLabaRugiAccount(coa)
    }
  })
}

function sumRows(rows) {
  return (rows || []).reduce((acc, row) => acc + Number(row.nilai || 0), 0)
}

function renderSectionHeader(title) {
  return `
    <tr>
      <td colspan="2" class="pt-0 pb-0 font-bold text-slate-900">
        ${escapeHtml(title)}
      </td>
    </tr>
  `
}

function renderAccountLine(label, amount, options = {}) {
  const {
    bold = false,
    underlineTop = false,
    extraSpacing = false
  } = options

  return `
    <tr>
      <td class="py-1 ${bold ? "font-bold" : ""} ${extraSpacing ? "pt-2" : ""}">
        ${escapeHtml(label)}
      </td>
      <td class="py-1 text-right ${bold ? "font-bold" : ""}">
        <div class="${underlineTop ? "border-t border-slate-800 pt-1 inline-block min-w-[180px] text-right" : "inline-block min-w-[180px] text-right"}">
          Rp ${formatCurrencyCell(amount)}
        </div>
      </td>
    </tr>
  `
}

function renderBlankRow() {
  return `
    <tr>
      <td colspan="2" class="py-0"></td>
    </tr>
  `
}

function renderLabaRugiTahunanBody(rows) {
  const tbody = document.getElementById("lrTahunanBody")
  if (!tbody) return

  if (!rows || !rows.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="2" class="py-6 text-center text-slate-400">
          Belum ada data laba rugi tahunan
        </td>
      </tr>
    `
    return
  }

  const pendapatanRows = rows.filter(row => row.group === "pendapatan")
  const pendapatanLainRows = rows.filter(row => row.group === "pendapatan_lain")
  const bebanPenjualanRows = rows.filter(row => row.group === "beban_penjualan")
  const bebanAdministrasiRows = rows.filter(row => row.group === "beban_administrasi")
  const bebanLainRows = rows.filter(row => row.group === "beban_lain")

  const totalPendapatan = sumRows(pendapatanRows)
  const totalBebanPenjualan = sumRows(bebanPenjualanRows)
  const totalBebanAdministrasi = sumRows(bebanAdministrasiRows)

  const totalPendapatanLain = sumRows(pendapatanLainRows)
  const totalBebanLain = sumRows(bebanLainRows)

  const totalPendapatanBebanLain = totalPendapatanLain - totalBebanLain
  const labaUsaha = totalPendapatan - totalBebanPenjualan - totalBebanAdministrasi
  const labaBersihTahunBerjalan = labaUsaha + totalPendapatanBebanLain

  let html = ""

  html += renderSectionHeader("Pendapatan")
  pendapatanRows.forEach(row => {
    html += renderAccountLine(row.nama_akun, row.nilai)
  })
  html += renderAccountLine("Total Pendapatan", totalPendapatan, {
    bold: true,
    underlineTop: true
  })

  html += renderBlankRow()

  html += renderSectionHeader("Beban Penjualan")
  bebanPenjualanRows.forEach(row => {
    html += renderAccountLine(row.nama_akun, row.nilai)
  })
  html += renderAccountLine("Total Beban Penjualan", totalBebanPenjualan, {
    bold: true,
    underlineTop: true
  })

  html += renderBlankRow()

  html += renderSectionHeader("Beban Administrasi & Umum")
  bebanAdministrasiRows.forEach(row => {
    html += renderAccountLine(row.nama_akun, row.nilai)
  })
  html += renderAccountLine("Total Beban Administrasi & Umum", totalBebanAdministrasi, {
    bold: true,
    underlineTop: true
  })

  html += renderBlankRow()

  html += renderAccountLine("Laba Usaha", labaUsaha, {
    bold: true,
    extraSpacing: true
  })

  html += renderBlankRow()

  html += renderSectionHeader("Pendapatan / (Beban) Lain-lain")
  pendapatanLainRows.forEach(row => {
    html += renderAccountLine(row.nama_akun, row.nilai)
  })
  bebanLainRows.forEach(row => {
    html += renderAccountLine(row.nama_akun, -row.nilai)
  })
  html += renderAccountLine("Total Pendapatan / (Beban) Lain-lain", totalPendapatanBebanLain, {
    bold: true,
    underlineTop: true
  })

  html += renderBlankRow()

  html += renderAccountLine("LABA BERSIH TAHUN BERJALAN", labaBersihTahunBerjalan, {
    bold: true,
    extraSpacing: true
  })

  tbody.innerHTML = html
}

async function initLabaRugiTahunan() {
  renderLRTahunanYearOptions()
  initLRTahunanYearSelect()
  initLRTahunanExportDropdown()
  await loadLabaRugiTahunan()
}

async function loadLabaRugiTahunan() {
  const tbody = document.getElementById("lrTahunanBody")
  const periodeEl = document.getElementById("lrTahunanPeriode")
  if (!tbody) return

  const companyEl = document.getElementById("lrCompanyName")
  if (companyEl) {
    companyEl.innerText = getActiveCompanyName()
  }

  const tahun = Number(
    localStorage.getItem("labaRugiTahunanTahun") || new Date().getFullYear()
  )
  const companyId = getActiveCompanyId()

  if (!companyId) {
    tbody.innerHTML = `
      <tr>
        <td colspan="2" class="py-6 text-center text-red-500">Company belum dipilih</td>
      </tr>
    `
    return
  }

  if (periodeEl) {
    periodeEl.innerText = `Untuk tahun yang berakhir 31 Desember ${tahun}`
  }

  tbody.innerHTML = `
    <tr>
      <td colspan="2" class="py-6 text-center text-slate-400">Loading...</td>
    </tr>
  `

  const { data: masterCoaRows, error: coaError } = await supabaseClient
    .from("master_coa")
    .select("kode_akun, nama_akun, saldo_normal, laporan, kategori, seksi")
    .eq("company_id", companyId)
    .eq("laporan", "Laba Rugi")
    .order("kode_akun", { ascending: true })

  if (coaError) {
    console.error("LOAD MASTER COA LR TAHUNAN ERROR:", coaError)
    tbody.innerHTML = `
      <tr>
        <td colspan="2" class="py-6 text-center text-red-500">
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
    console.error("LOAD JURNAL LR TAHUNAN ERROR:", jurnalError)
    tbody.innerHTML = `
      <tr>
        <td colspan="2" class="py-6 text-center text-red-500">
          ${escapeHtml(jurnalError.message)}
        </td>
      </tr>
    `
    return
  }

  const ledgerMap = buildTahunanLedgerMap(jurnalRows || [])
  const rows = buildLRTahunanRows(masterCoaRows || [], ledgerMap)

  renderLabaRugiTahunanBody(rows)
}

function toggleLRTahunanExportMenu() {
  const menu = document.getElementById("lrTahunanExportMenu")
  if (!menu) return
  menu.classList.toggle("hidden")
}

function closeLRTahunanExportMenu() {
  const menu = document.getElementById("lrTahunanExportMenu")
  if (!menu) return
  menu.classList.add("hidden")
}

function handleLRTahunanExport(type) {
  closeLRTahunanExportMenu()

  if (type === "print") {
    printLRTahunan()
    return
  }

  if (type === "pdf") {
    exportPDF()
    return
  }

  if (type === "xlsx") {
    exportExcel()
  }
}

function handleLRTahunanOutsideClick(event) {
  const menu = document.getElementById("lrTahunanExportMenu")
  const btn = document.getElementById("lrTahunanExportBtn")

  if (!menu || !btn) return

  if (!menu.contains(event.target) && !btn.contains(event.target)) {
    closeLRTahunanExportMenu()
  }
}

function initLRTahunanExportDropdown() {
  document.removeEventListener("click", handleLRTahunanOutsideClick)
  document.addEventListener("click", handleLRTahunanOutsideClick)
}

function printLRTahunan() {
  const style = document.createElement("style")
  style.id = "print-page-style"
  style.innerHTML = "@page { size: A4 portrait; margin: 6mm; }"
  document.head.appendChild(style)

  document.documentElement.classList.add("print-lr-tahunan")

  const cleanup = () => {
    document.documentElement.classList.remove("print-lr-tahunan")
    style.remove()
    window.removeEventListener("afterprint", cleanup)
  }

  window.addEventListener("afterprint", cleanup)
  window.print()
  setTimeout(cleanup, 1000)
}