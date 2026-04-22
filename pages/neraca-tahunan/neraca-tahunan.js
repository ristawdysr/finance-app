window.neracaTahunanTahunInstance = window.neracaTahunanTahunInstance || null

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

function formatBalanceCell(num) {
  const value = Number(num || 0)

  if (value === 0) return "-"

  if (value < 0) {
    return `<span class="text-red-600">(Rp ${formatCurrency(Math.abs(value))})</span>`
  }

  return `Rp ${formatCurrency(value)}`
}

function getNeracaTahunanYearOptions() {
  const currentYear = new Date().getFullYear()
  const years = []

  for (let y = currentYear - 5; y <= currentYear + 2; y++) {
    years.push(y)
  }

  return years
}

function renderNeracaTahunanYearOptions() {
  const el = document.getElementById("neracaTahunanTahun")
  if (!el) return

  const selectedYear =
    localStorage.getItem("neracaTahunanTahun") || String(new Date().getFullYear())

  el.innerHTML = getNeracaTahunanYearOptions()
    .map(year => `
      <option value="${year}" ${String(year) === String(selectedYear) ? "selected" : ""}>
        ${year}
      </option>
    `)
    .join("")
}

function initNeracaTahunanYearSelect() {
  const el = document.getElementById("neracaTahunanTahun")
  if (!el) return

  if (neracaTahunanTahunInstance) {
    neracaTahunanTahunInstance.destroy()
    neracaTahunanTahunInstance = null
  }

  neracaTahunanTahunInstance = new TomSelect(el, {
    create: false,
    controlInput: null,
    placeholder: "Pilih Tahun",
    onChange: function(value) {
      localStorage.setItem("neracaTahunanTahun", value)
      loadNeracaTahunan()
    }
  })
}

function buildNeracaLedgerMap(rows) {
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

function classifyNeracaAccount(coa) {
  const kategori = String(coa.kategori || "").trim().toLowerCase()
  const seksi = String(coa.seksi || "").trim().toLowerCase()
  const nama = String(coa.nama_akun || "").trim().toLowerCase()
  const bucket = `${kategori} ${seksi} ${nama}`

  if (bucket.includes("aset lancar")) return "aset_lancar"
  if (bucket.includes("aset tetap")) return "aset_tetap"
  if (bucket.includes("akumulasi")) return "aset_tetap"
  if (bucket.includes("kewajiban lancar")) return "kewajiban_lancar"
  if (bucket.includes("ekuitas")) return "ekuitas"

  if (String(coa.saldo_normal || "").trim().toLowerCase() === "kredit") {
    if (bucket.includes("hutang") || bucket.includes("utang")) return "kewajiban_lancar"
    return "ekuitas"
  }

  return "aset_lancar"
}

function buildNeracaTahunanRows(masterCoaRows, saldoAwalMap, ledgerMap) {
  return (masterCoaRows || []).map(coa => {
    const kode = String(coa.kode_akun || "").trim()
    const saldoAwal = saldoAwalMap[kode] || {
      opening_debit: 0,
      opening_kredit: 0
    }
    const ledger = ledgerMap[kode] || {
      debet: 0,
      kredit: 0
    }

    const opening = Number(saldoAwal.opening_debit || 0) - Number(saldoAwal.opening_kredit || 0)
    const ending = opening + Number(ledger.debet || 0) - Number(ledger.kredit || 0)

    return {
      kode_akun: coa.kode_akun || "",
      nama_akun: coa.nama_akun || "",
      kategori: coa.kategori || "",
      seksi: coa.seksi || "",
      saldo_normal: coa.saldo_normal || "",
      group: classifyNeracaAccount(coa),
      value: ending
    }
  })
}

function buildLabaRugiTahunanRows(masterCoaRows, ledgerMap) {
  return (masterCoaRows || []).map(coa => {
    const kode = String(coa.kode_akun || "").trim()
    const ledger = ledgerMap[kode] || { debet: 0, kredit: 0 }

    return {
      kode_akun: coa.kode_akun || "",
      nama_akun: coa.nama_akun || "",
      saldo_normal: coa.saldo_normal || "",
      kategori: coa.kategori || "",
      seksi: coa.seksi || "",
      nilai: String(coa.saldo_normal || "").trim().toLowerCase() === "kredit"
        ? Number(ledger.kredit || 0)
        : Number(ledger.debet || 0),
      group: classifyLabaRugiTahunanAccount(coa)
    }
  })
}

function classifyLabaRugiTahunanAccount(coa) {
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

function sumRows(rows) {
  return (rows || []).reduce((acc, row) => acc + Number(row.value || row.nilai || 0), 0)
}

function computeLabaBersihTahunBerjalan(lrRows) {
  const pendapatan = lrRows.filter(row => row.group === "pendapatan")
  const pendapatanLain = lrRows.filter(row => row.group === "pendapatan_lain")
  const bebanPenjualan = lrRows.filter(row => row.group === "beban_penjualan")
  const bebanAdministrasi = lrRows.filter(row => row.group === "beban_administrasi")
  const bebanLain = lrRows.filter(row => row.group === "beban_lain")

  const totalPendapatan = pendapatan.reduce((a, b) => a + Number(b.nilai || 0), 0)
  const totalPendapatanLain = pendapatanLain.reduce((a, b) => a + Number(b.nilai || 0), 0)
  const totalBebanPenjualan = bebanPenjualan.reduce((a, b) => a + Number(b.nilai || 0), 0)
  const totalBebanAdministrasi = bebanAdministrasi.reduce((a, b) => a + Number(b.nilai || 0), 0)
  const totalBebanLain = bebanLain.reduce((a, b) => a + Number(b.nilai || 0), 0)

  const labaUsaha = totalPendapatan - totalBebanPenjualan - totalBebanAdministrasi
  return labaUsaha + (totalPendapatanLain - totalBebanLain)
}

function renderSectionHeader(title) {
  return `
    <tr>
      <td colspan="2" class="pt-4 pb-2 font-bold text-slate-900 uppercase tracking-wide">
        ${escapeHtml(title)}
      </td>
    </tr>
  `
}

function renderSubHeader(title) {
  return `
    <tr>
      <td colspan="2" class="pt-2 pb-2 font-bold text-slate-900">
        ${escapeHtml(title)}
      </td>
    </tr>
  `
}

function renderAccountLine(label, amount, options = {}) {
  const { bold = false, underlineTop = false } = options

  return `
    <tr>
      <td class="py-1 ${bold ? "font-bold" : ""}">
        ${escapeHtml(label)}
      </td>
      <td class="py-1 text-right ${bold ? "font-bold" : ""}">
        <div class="${underlineTop ? "border-t border-slate-800 pt-1 inline-block min-w-[180px] text-right" : "inline-block min-w-[180px] text-right"}">
          ${formatBalanceCell(amount)}
        </div>
      </td>
    </tr>
  `
}

function renderBlankRow() {
  return `
    <tr>
      <td colspan="2" class="py-2">&nbsp;</td>
    </tr>
  `
}

function buildLeftSideRows(asetLancarRows, asetTetapRows, totalAsetLancar, totalAsetTetap, totalAset) {
  let html = ""

  html += renderSectionHeader("ASET")
  html += renderSubHeader("Aset Lancar")
  asetLancarRows.forEach(row => {
    html += renderAccountLine(row.nama_akun, row.value)
  })
  html += renderAccountLine("Total Aset Lancar", totalAsetLancar, {
    bold: true,
    underlineTop: true
  })

  html += renderBlankRow()

  html += renderSubHeader("Aset Tetap")
  asetTetapRows.forEach(row => {
    html += renderAccountLine(row.nama_akun, row.value)
  })
  html += renderAccountLine("Total Aset Tetap", totalAsetTetap, {
    bold: true,
    underlineTop: true
  })

  html += renderBlankRow()

  html += renderAccountLine("TOTAL ASET", totalAset, {
    bold: true,
    underlineTop: true
  })

  return html
}

function buildRightSideRows(kewajibanRows, ekuitasRows, labaBersih, totalKewajiban, totalEkuitas, totalKewajibanEkuitas) {
  let html = ""

  html += renderSectionHeader("KEWAJIBAN DAN EKUITAS")
  html += renderSubHeader("Kewajiban Lancar")
  kewajibanRows.forEach(row => {
    html += renderAccountLine(row.nama_akun, row.value)
  })
  html += renderAccountLine("Total Kewajiban Lancar", totalKewajiban, {
    bold: true,
    underlineTop: true
  })

  html += renderBlankRow()

  html += renderSubHeader("Ekuitas")
  ekuitasRows.forEach(row => {
    html += renderAccountLine(row.nama_akun, row.value)
  })
  html += renderAccountLine("Laba Bersih Tahun Berjalan", labaBersih)
  html += renderAccountLine("Total Ekuitas", totalEkuitas, {
    bold: true,
    underlineTop: true
  })

  html += renderBlankRow()

  html += renderAccountLine("TOTAL KEWAJIBAN + EKUITAS", totalKewajibanEkuitas, {
    bold: true,
    underlineTop: true
  })

  return html
}

function countVisualRows(sectionRows, includeExtra = 0) {
  return (sectionRows?.length || 0) + includeExtra
}

function buildPadRows(count) {
  let html = ""
  for (let i = 0; i < count; i++) {
    html += `
      <tr>
        <td class="py-1">&nbsp;</td>
        <td class="py-1 text-right">&nbsp;</td>
      </tr>
    `
  }
  return html
}

function renderNeracaTahunan(leftHtml, rightHtml) {
  const leftBody = document.getElementById("neracaTahunanLeftBody")
  const rightBody = document.getElementById("neracaTahunanRightBody")

  if (leftBody) leftBody.innerHTML = leftHtml
  if (rightBody) rightBody.innerHTML = rightHtml
}

async function exportNeracaTahunanPDF() {
  if (typeof html2pdf === "undefined") {
    Swal.fire("Error", "Library PDF belum dimuat", "error")
    return
  }

  const source = document.getElementById("neracaTahunanPrintArea")
  if (!source) {
    Swal.fire("Error", "Area PDF tidak ditemukan", "error")
    return
  }

  const wrapper = document.createElement("div")
  wrapper.style.position = "fixed"
  wrapper.style.left = "-99999px"
  wrapper.style.top = "0"
  wrapper.style.width = "297mm"
  wrapper.style.background = "#fff"
  wrapper.style.zIndex = "-1"

  const clone = source.cloneNode(true)
  clone.classList.add("pdf-export-mode")
  clone.style.width = "277mm"
  clone.style.minWidth = "0"
  clone.style.maxWidth = "277mm"
  clone.style.margin = "0 auto"
  clone.style.background = "#fff"
  clone.style.border = "0"
  clone.style.borderRadius = "0"
  clone.style.boxShadow = "none"
  clone.style.overflow = "visible"

  wrapper.appendChild(clone)
  document.body.appendChild(wrapper)

  const opt = {
    margin: [6, 6, 6, 6],
    filename: "Neraca-Tahunan.pdf",
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
      orientation: "landscape",
      compressPDF: true
    }
  }

  try {
    await html2pdf().set(opt).from(clone).save()
  } catch (err) {
    console.error("EXPORT NERACA PDF ERROR:", err)
    Swal.fire("Error", "Gagal export PDF", "error")
  } finally {
    wrapper.remove()
  }
}
function exportNeracaTahunanExcel() {
  const tahun = Number(localStorage.getItem("neracaTahunanTahun") || new Date().getFullYear())
  const wb = XLSX.utils.book_new()

  const leftRows = [["CV RODA JAYA TRANSPORTASI"], ["NERACA"], [`Per 31 Desember ${tahun}`], []]
  const rightRows = []

  const leftBody = document.getElementById("neracaTahunanLeftBody")
  const rightBody = document.getElementById("neracaTahunanRightBody")

  if (leftBody) {
    leftBody.querySelectorAll("tr").forEach(tr => {
      const row = []
      tr.querySelectorAll("td").forEach(td => {
        row.push(td.innerText.trim())
      })
      leftRows.push(row)
    })
  }

  if (rightBody) {
    rightBody.querySelectorAll("tr").forEach(tr => {
      const row = []
      tr.querySelectorAll("td").forEach(td => {
        row.push(td.innerText.trim())
      })
      rightRows.push(row)
    })
  }

  const wsLeft = XLSX.utils.aoa_to_sheet(leftRows)
  const wsRight = XLSX.utils.aoa_to_sheet(rightRows)

  XLSX.utils.book_append_sheet(wb, wsLeft, "Neraca Kiri")
  XLSX.utils.book_append_sheet(wb, wsRight, "Neraca Kanan")

  XLSX.writeFile(wb, `Neraca-Tahunan-${tahun}.xlsx`)
}

function toggleNeracaTahunanExportMenu() {
  const menu = document.getElementById("neracaTahunanExportMenu")
  if (!menu) return
  menu.classList.toggle("hidden")
}

function closeNeracaTahunanExportMenu() {
  const menu = document.getElementById("neracaTahunanExportMenu")
  if (!menu) return
  menu.classList.add("hidden")
}

function handleNeracaTahunanExport(type) {
  closeNeracaTahunanExportMenu()

  if (type === "print") {
    printNeracaTahunan()
    return
    }

  if (type === "pdf") {
    exportNeracaTahunanPDF()
    return
  }

  if (type === "xlsx") {
    exportNeracaTahunanExcel()
  }
}

function handleNeracaTahunanOutsideClick(event) {
  const menu = document.getElementById("neracaTahunanExportMenu")
  const btn = document.getElementById("neracaTahunanExportBtn")

  if (!menu || !btn) return

  if (!menu.contains(event.target) && !btn.contains(event.target)) {
    closeNeracaTahunanExportMenu()
  }
}

function initNeracaTahunanExportDropdown() {
  document.removeEventListener("click", handleNeracaTahunanOutsideClick)
  document.addEventListener("click", handleNeracaTahunanOutsideClick)
}

async function initNeracaTahunan() {
  renderNeracaTahunanYearOptions()
  initNeracaTahunanYearSelect()
  initNeracaTahunanExportDropdown()
  await loadNeracaTahunan()
}

async function loadNeracaTahunan() {
  const leftBody = document.getElementById("neracaTahunanLeftBody")
  const rightBody = document.getElementById("neracaTahunanRightBody")
  const periodeEl = document.getElementById("neracaTahunanPeriode")
  const companyEl = document.getElementById("neracaCompanyName")
  if (companyEl) {
    companyEl.innerText = getActiveCompanyName()
  }

  if (!leftBody || !rightBody) return

  const tahun = Number(
    localStorage.getItem("neracaTahunanTahun") || new Date().getFullYear()
  )
  const companyId = getActiveCompanyId()

  if (!companyId) {
    leftBody.innerHTML = `<tr><td class="py-6 text-center text-red-500">Company belum dipilih</td></tr>`
    rightBody.innerHTML = `<tr><td class="py-6 text-center text-red-500">Company belum dipilih</td></tr>`
    return
  }

  if (periodeEl) {
    periodeEl.innerText = `Per 31 Desember ${tahun}`
  }

  leftBody.innerHTML = `<tr><td class="py-6 text-center text-slate-400">Loading...</td></tr>`
  rightBody.innerHTML = `<tr><td class="py-6 text-center text-slate-400">Loading...</td></tr>`

  const { data: neracaCoaRows, error: neracaCoaError } = await supabaseClient
    .from("master_coa")
    .select("kode_akun, nama_akun, saldo_normal, laporan, kategori, seksi")
    .eq("company_id", companyId)
    .eq("laporan", "Neraca")
    .order("kode_akun", { ascending: true })

  if (neracaCoaError) {
    leftBody.innerHTML = `<tr><td class="py-6 text-center text-red-500">${escapeHtml(neracaCoaError.message)}</td></tr>`
    rightBody.innerHTML = `<tr><td class="py-6 text-center text-red-500">${escapeHtml(neracaCoaError.message)}</td></tr>`
    return
  }

  const { data: saldoAwalRows, error: saldoAwalError } = await supabaseClient
    .from("saldo_awal_snapshot")
    .select("kode_coa, opening_debit, opening_kredit")
    .eq("company_id", companyId)
    .eq("tahun", tahun)

  if (saldoAwalError) {
    leftBody.innerHTML = `<tr><td class="py-6 text-center text-red-500">${escapeHtml(saldoAwalError.message)}</td></tr>`
    rightBody.innerHTML = `<tr><td class="py-6 text-center text-red-500">${escapeHtml(saldoAwalError.message)}</td></tr>`
    return
  }

  const { data: jurnalRows, error: jurnalError } = await supabaseClient
    .from("jurnal_detail")
    .select("kode_coa, debet, kredit, tanggal")
    .eq("company_id", companyId)
    .gte("tanggal", `${tahun}-01-01`)
    .lte("tanggal", `${tahun}-12-31`)

  if (jurnalError) {
    leftBody.innerHTML = `<tr><td class="py-6 text-center text-red-500">${escapeHtml(jurnalError.message)}</td></tr>`
    rightBody.innerHTML = `<tr><td class="py-6 text-center text-red-500">${escapeHtml(jurnalError.message)}</td></tr>`
    return
  }

  const { data: lrCoaRows, error: lrCoaError } = await supabaseClient
    .from("master_coa")
    .select("kode_akun, nama_akun, saldo_normal, laporan, kategori, seksi")
    .eq("company_id", companyId)
    .eq("laporan", "Laba Rugi")
    .order("kode_akun", { ascending: true })

  if (lrCoaError) {
    leftBody.innerHTML = `<tr><td class="py-6 text-center text-red-500">${escapeHtml(lrCoaError.message)}</td></tr>`
    rightBody.innerHTML = `<tr><td class="py-6 text-center text-red-500">${escapeHtml(lrCoaError.message)}</td></tr>`
    return
  }

  const saldoAwalMap = buildSaldoAwalMap(saldoAwalRows || [])
  const ledgerMap = buildNeracaLedgerMap(jurnalRows || [])

  const neracaRows = buildNeracaTahunanRows(neracaCoaRows || [], saldoAwalMap, ledgerMap)
  const lrRows = buildLabaRugiTahunanRows(lrCoaRows || [], ledgerMap)
  const labaBersihTahunBerjalan = computeLabaBersihTahunBerjalan(lrRows)

  const asetLancarRows = neracaRows.filter(row => row.group === "aset_lancar")
  const asetTetapRows = neracaRows.filter(row => row.group === "aset_tetap")
  const kewajibanRows = neracaRows.filter(row => row.group === "kewajiban_lancar")
  const ekuitasRows = neracaRows.filter(row => row.group === "ekuitas")

  const totalAsetLancar = sumRows(asetLancarRows)
  const totalAsetTetap = sumRows(asetTetapRows)
  const totalKewajiban = sumRows(kewajibanRows)
  const totalEkuitas = sumRows(ekuitasRows) + labaBersihTahunBerjalan

  const totalAset = totalAsetLancar + totalAsetTetap
  const totalKewajibanEkuitas = totalKewajiban + totalEkuitas

  let leftHtml = buildLeftSideRows(
    asetLancarRows,
    asetTetapRows,
    totalAsetLancar,
    totalAsetTetap,
    totalAset
  )

  let rightHtml = buildRightSideRows(
    kewajibanRows,
    ekuitasRows,
    labaBersihTahunBerjalan,
    totalKewajiban,
    totalEkuitas,
    totalKewajibanEkuitas
  )

  const leftVisualCount =
    1 + 1 + asetLancarRows.length + 1 + 1 +
    1 + asetTetapRows.length + 1 + 1 +
    1

  const rightVisualCount =
    1 + 1 + kewajibanRows.length + 1 + 1 +
    1 + ekuitasRows.length + 1 + 1 +
    1

  if (leftVisualCount > rightVisualCount) {
    rightHtml += buildPadRows(leftVisualCount - rightVisualCount)
  } else if (rightVisualCount > leftVisualCount) {
    leftHtml += buildPadRows(rightVisualCount - leftVisualCount)
  }

  renderNeracaTahunan(leftHtml, rightHtml)
}

function printNeracaTahunan() {
  window.print()
}