let dashboardTahunInstance = null
let dashboardProfitLossChartInstance = null
let dashboardAllRows = []
let dashboardTanggalAwalInstance = null
let dashboardTanggalAkhirInstance = null
let dashboardChartInstance = null

const DASHBOARD_MONTHS = [
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

function getActiveCompanyId() {
  return localStorage.getItem("activeCompanyId") || ""
}

async function loadNotificationCount() {
  if (!canSeeBell()) return

  const session = getSessionUser()
  const companyId = getActiveCompanyId()

  const badge = document.getElementById("notificationBadge")
  if (!badge) return

  let query = supabaseClient
    .from("app_notifications")
    .select("*", { count: "exact", head: true })
    .or(`target_role.eq.${getUserRole()},target_user_id.eq.${session.id}`)
    .eq("is_read", false)

  if (companyId) {
    query = query.or(`company_id.is.null,company_id.eq.${companyId}`)
  } else {
    query = query.is("company_id", null)
  }

  const { count, error } = await query

  if (error) return

  if (count > 0) {
    badge.classList.remove("hidden")
    badge.innerText = count > 99 ? "99+" : String(count)
  } else {
    badge.classList.add("hidden")
    badge.innerText = "0"
  }
}

function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function formatCurrency(num) {
  return "Rp " + new Intl.NumberFormat("id-ID").format(Number(num || 0))
}

function formatSignedCurrency(num) {
  const value = Number(num || 0)
  if (value < 0) {
    return `(Rp ${new Intl.NumberFormat("id-ID").format(Math.abs(value))})`
  }
  return "Rp " + new Intl.NumberFormat("id-ID").format(value)
}

function formatCompactCurrency(num) {
  const value = Number(num || 0)

  if (Math.abs(value) >= 1000000000) {
    return "Rp " + (value / 1000000000).toFixed(1).replace(".0", "") + " M"
  }

  if (Math.abs(value) >= 1000000) {
    return "Rp " + (value / 1000000).toFixed(1).replace(".0", "") + " Jt"
  }

  if (Math.abs(value) >= 1000) {
    return "Rp " + (value / 1000).toFixed(0) + " Rb"
  }

  return "Rp " + new Intl.NumberFormat("id-ID").format(value)
}

function getDashboardYearOptions() {
  const currentYear = new Date().getFullYear()
  const years = []

  for (let y = currentYear - 5; y <= currentYear + 2; y++) {
    years.push(y)
  }

  return years
}

function renderDashboardYearOptions() {
  const el = document.getElementById("dashboardTahun")
  if (!el) return

  const selectedYear =
    localStorage.getItem("dashboardTahun") || String(new Date().getFullYear())

  el.innerHTML = getDashboardYearOptions()
    .map(year => `
      <option value="${year}" ${String(year) === String(selectedYear) ? "selected" : ""}>
        ${year}
      </option>
    `)
    .join("")
}

function getDefaultDashboardDateRange(year) {
  return {
    start: `${year}-01-01`,
    end: `${year}-12-31`
  }
}

function renderDashboardDateInputs() {
  const tahun =
    Number(localStorage.getItem("dashboardTahun") || new Date().getFullYear())

  const defaultRange = getDefaultDashboardDateRange(tahun)

  const startEl = document.getElementById("dashboardTanggalAwal")
  const endEl = document.getElementById("dashboardTanggalAkhir")

  const startValue =
    localStorage.getItem("dashboardTanggalAwal") || defaultRange.start

  const endValue =
    localStorage.getItem("dashboardTanggalAkhir") || defaultRange.end

  if (startEl) {
    startEl.value = formatDateToDisplay(startValue)
  }

  if (endEl) {
    endEl.value = formatDateToDisplay(endValue)
  }
}

function toDbDate(value) {
  if (!value) return null

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value

  const parts = String(value).split("/")
  if (parts.length !== 3) return null

  const [dd, mm, yyyy] = parts
  return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`
}

function getDashboardSelectedDateRange() {
  const tahun =
    Number(localStorage.getItem("dashboardTahun") || new Date().getFullYear())

  const defaultRange = getDefaultDashboardDateRange(tahun)

  const startInput =
    document.getElementById("dashboardTanggalAwal")?.value ||
    formatDateToDisplay(localStorage.getItem("dashboardTanggalAwal") || defaultRange.start)

  const endInput =
    document.getElementById("dashboardTanggalAkhir")?.value ||
    formatDateToDisplay(localStorage.getItem("dashboardTanggalAkhir") || defaultRange.end)

  let start = toDbDate(startInput) || defaultRange.start
  let end = toDbDate(endInput) || defaultRange.end

  if (start > end) {
    ;[start, end] = [end, start]
  }

  return { start, end }
}

function initDashboardDateFilters() {
  const startEl = document.getElementById("dashboardTanggalAwal")
  const endEl = document.getElementById("dashboardTanggalAkhir")

  if (startEl && typeof flatpickr !== "undefined") {
    if (dashboardTanggalAwalInstance) {
      dashboardTanggalAwalInstance.destroy()
      dashboardTanggalAwalInstance = null
    }

    dashboardTanggalAwalInstance = flatpickr(startEl, {
      dateFormat: "d/m/Y",
      allowInput: true,
      disableMobile: true,
      defaultDate: startEl.value || null,
      onChange: function(selectedDates, dateStr) {
        const dbDate = toDbDate(dateStr)
        if (dbDate) {
          localStorage.setItem("dashboardTanggalAwal", dbDate)
        }
        loadDashboard()
      }
    })
  }

  if (endEl && typeof flatpickr !== "undefined") {
    if (dashboardTanggalAkhirInstance) {
      dashboardTanggalAkhirInstance.destroy()
      dashboardTanggalAkhirInstance = null
    }

    dashboardTanggalAkhirInstance = flatpickr(endEl, {
      dateFormat: "d/m/Y",
      allowInput: true,
      disableMobile: true,
      defaultDate: endEl.value || null,
      onChange: function(selectedDates, dateStr) {
        const dbDate = toDbDate(dateStr)
        if (dbDate) {
          localStorage.setItem("dashboardTanggalAkhir", dbDate)
        }
        loadDashboard()
      }
    })
  }
}

function initDashboardYearSelect() {
  const el = document.getElementById("dashboardTahun")
  if (!el) return

  if (dashboardTahunInstance) {
    dashboardTahunInstance.destroy()
    dashboardTahunInstance = null
  }

  dashboardTahunInstance = new TomSelect(el, {
    create: false,
    controlInput: null,
    placeholder: "Pilih Tahun",
    onChange: function(value) {
    localStorage.setItem("dashboardTahun", value)

    const defaultRange = getDefaultDashboardDateRange(Number(value))
    localStorage.setItem("dashboardTanggalAwal", defaultRange.start)
    localStorage.setItem("dashboardTanggalAkhir", defaultRange.end)

    renderDashboardDateInputs()
    initDashboardDateFilters()
    loadDashboard()
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

function setText(id, value) {
  const el = document.getElementById(id)
  if (el) el.innerText = value
}

function getCompareText(currentValue, previousValue, label) {
  const current = Number(currentValue || 0)
  const previous = Number(previousValue || 0)

  if (previous === 0 && current === 0) return `Tidak ada perubahan vs ${label}`
  if (previous === 0 && current > 0) return `Naik dari 0 vs ${label}`

  const diff = current - previous
  const pct = previous !== 0 ? (diff / previous) * 100 : 0
  const direction = diff > 0 ? "Naik" : diff < 0 ? "Turun" : "Tetap"

  return `${direction} ${Math.abs(pct).toFixed(1)}% vs ${label}`
}

function isAsetLancarAccount(row) {
  const kategori = String(row.kategori || "").toLowerCase()
  return kategori.includes("aset lancar")
}

function isAsetTetapAccount(row) {
  const kategori = String(row.kategori || "").toLowerCase()
  const nama = String(row.nama_akun || "").toLowerCase()
  return kategori.includes("aset tetap") || nama.includes("akm. peny") || nama.includes("akumulasi")
}

function isKewajibanLancarAccount(row) {
  const kategori = String(row.kategori || "").toLowerCase()
  const nama = String(row.nama_akun || "").toLowerCase()
  return kategori.includes("kewajiban lancar") || nama.includes("hutang") || nama.includes("utang")
}

function isEkuitasAccount(row) {
  const kategori = String(row.kategori || "").toLowerCase()
  return kategori.includes("ekuitas")
}

function classifyDashboardLRAccount(coa) {
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

function renderDashboardChart(monthlyDebet, monthlyKredit) {
  const canvas = document.getElementById("dashboardChart")
  if (!canvas || typeof Chart === "undefined") return

  if (dashboardChartInstance) {
    dashboardChartInstance.destroy()
    dashboardChartInstance = null
  }

  const netData = DASHBOARD_MONTHS.map(month =>
    Number(monthlyDebet[month.index] || 0) - Number(monthlyKredit[month.index] || 0)
  )

  dashboardChartInstance = new Chart(canvas, {
    data: {
      labels: DASHBOARD_MONTHS.map(m => m.name),
      datasets: [
        {
          type: "bar",
          label: "Debet",
          data: DASHBOARD_MONTHS.map(m => Number(monthlyDebet[m.index] || 0)),
          borderRadius: 8,
          barThickness: 18
        },
        {
          type: "bar",
          label: "Kredit",
          data: DASHBOARD_MONTHS.map(m => Number(monthlyKredit[m.index] || 0)),
          borderRadius: 8,
          barThickness: 18
        },
        {
          type: "line",
          label: "NET",
          data: netData,
          tension: 0.35,
          borderWidth: 3,
          pointRadius: 4,
          pointHoverRadius: 5,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index",
        intersect: false
      },
      plugins: {
        legend: {
          position: "top",
          labels: {
            usePointStyle: true,
            boxWidth: 10
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return `${context.dataset.label}: ${formatCurrency(context.raw)}`
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            display: false
          }
        },
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              return formatCompactCurrency(value)
            }
          }
        }
      }
    }
  })
}

function renderDashboardProfitLossChart(monthlyPendapatan, monthlyBeban, monthlyLabaBersih, startDate, endDate) {
  const canvas = document.getElementById("dashboardProfitLossChart")
  if (!canvas || typeof Chart === "undefined") return

  if (dashboardProfitLossChartInstance) {
    dashboardProfitLossChartInstance.destroy()
    dashboardProfitLossChartInstance = null
  }

  const visibleMonths = getMonthRangeFromDates(startDate, endDate)

  dashboardProfitLossChartInstance = new Chart(canvas, {
    data: {
      labels: visibleMonths.map(m => m.name),
      datasets: [
        {
          type: "bar",
          label: "Pendapatan",
          data: visibleMonths.map(m => Number(monthlyPendapatan[m.index] || 0)),
          borderRadius: 8,
          barThickness: 18
        },
        {
          type: "bar",
          label: "Beban",
          data: visibleMonths.map(m => Number(monthlyBeban[m.index] || 0)),
          borderRadius: 8,
          barThickness: 18
        },
        {
          type: "line",
          label: "Profit",
          data: visibleMonths.map(m => Number(monthlyLabaBersih[m.index] || 0)),
          tension: 0.35,
          borderWidth: 3,
          pointRadius: 4,
          pointHoverRadius: 5,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index",
        intersect: false
      },
      plugins: {
        legend: {
          position: "top",
          labels: {
            usePointStyle: true,
            boxWidth: 10
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return `${context.dataset.label}: ${formatCurrency(context.raw)}`
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            display: false
          }
        },
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              return formatCompactCurrency(value)
            }
          }
        }
      }
    }
  })
}

function renderDashboardCoaTable(rows) {
  const tableEl = document.getElementById("dashboardCoaTable")
  if (!tableEl) return

  if (!rows || !rows.length) {
    tableEl.innerHTML = `
      <tr>
        <td colspan="5" class="px-4 py-6 text-center text-slate-400">
          Belum ada data
        </td>
      </tr>
    `
    return
  }

  let html = ""

  rows.forEach((row, index) => {
    const rowBg = index % 2 === 0 ? "bg-white" : "bg-slate-50"
    const netClass = Number(row.net || 0) < 0 ? "text-red-600" : "text-slate-800"

    html += `
      <tr class="${rowBg} hover:bg-blue-50 transition">
        <td class="px-4 py-3 whitespace-nowrap">${escapeHtml(row.kode_akun || "")}</td>
        <td class="px-4 py-3 whitespace-nowrap">${escapeHtml(row.nama_akun || "")}</td>
        <td class="px-4 py-3 text-right whitespace-nowrap text-green-700 font-medium">
          ${formatCurrency(row.total_debet)}
        </td>
        <td class="px-4 py-3 text-right whitespace-nowrap text-red-700 font-medium">
          ${formatCurrency(row.total_kredit)}
        </td>
        <td class="px-4 py-3 text-right whitespace-nowrap font-semibold ${netClass}">
          ${formatSignedCurrency(row.net)}
        </td>
      </tr>
    `
  })

  tableEl.innerHTML = html
}

function applyDashboardSearch() {
  const keyword = String(document.getElementById("dashboardSearch")?.value || "")
    .trim()
    .toLowerCase()

  if (!keyword) {
    renderDashboardCoaTable(dashboardAllRows)
    return
  }

  const filtered = dashboardAllRows.filter(row => {
    const kode = String(row.kode_akun || "").toLowerCase()
    const nama = String(row.nama_akun || "").toLowerCase()
    return kode.includes(keyword) || nama.includes(keyword)
  })

  renderDashboardCoaTable(filtered)
}

function initDashboardSearch() {
  const input = document.getElementById("dashboardSearch")
  if (!input) return

  input.oninput = applyDashboardSearch
}

async function loadDashboard() {
  const companyId = getActiveCompanyId()

  if (!companyId) {
    return
  }
  const tahun = Number(
    localStorage.getItem("dashboardTahun") || new Date().getFullYear()
  )

  const { start: currentStart, end: currentEnd } = getDashboardSelectedDateRange()

  const prevYear = tahun - 1
  const prevStart = `${prevYear}-01-01`
  const prevEnd = `${prevYear}-12-31`

  setText("dashTotalTransaksi", "0")
  setText("dashTotalDebet", "Rp 0")
  setText("dashTotalKredit", "Rp 0")
  setText("dashNet", "Rp 0")
  setText("dashAsetLancar", "Rp 0")
  setText("dashAsetTetap", "Rp 0")
  setText("dashKewajibanLancar", "Rp 0")
  setText("dashEkuitas", "Rp 0")
  setText("dashCompareTransaksi", "-")
  setText("dashCompareDebet", "-")
  setText("dashCompareKredit", "-")

  const tableEl = document.getElementById("dashboardCoaTable")
  if (tableEl) {
    tableEl.innerHTML = `
      <tr>
        <td colspan="5" class="px-4 py-6 text-center text-slate-400">
          Loading...
        </td>
      </tr>
    `
  }

  const { data: coaRows, error: coaError } = await supabaseClient
    .from("master_coa")
    .select("kode_akun, nama_akun, kategori, saldo_normal, laporan, seksi")
    .eq("company_id", companyId)
    .order("kode_akun", { ascending: true })

  if (coaError) {
    console.error("DASHBOARD COA ERROR:", coaError)
    return
  }

  const { data: jurnalRows, error: jurnalError } = await supabaseClient
    .from("jurnal_detail")
    .select("kode_coa, nama_coa, debet, kredit, tanggal")
    .eq("company_id", companyId)
    .gte("tanggal", currentStart)
    .lte("tanggal", currentEnd)

  if (jurnalError) {
    console.error("DASHBOARD JURNAL ERROR:", jurnalError)
    return
  }

  const { data: prevJurnalRows, error: prevJurnalError } = await supabaseClient
    .from("jurnal_detail")
    .select("debet, kredit, tanggal")
    .eq("company_id", companyId)
    .gte("tanggal", prevStart)
    .lte("tanggal", prevEnd)

  if (prevJurnalError) {
    console.error("DASHBOARD PREV JURNAL ERROR:", prevJurnalError)
  }

  const coaMap = {}

  ;(coaRows || []).forEach(coa => {
    coaMap[String(coa.kode_akun || "").trim()] = {
      kode_akun: coa.kode_akun || "",
      nama_akun: coa.nama_akun || "",
      kategori: coa.kategori || "",
      saldo_normal: coa.saldo_normal || "",
      laporan: coa.laporan || "",
      seksi: coa.seksi || "",
      total_debet: 0,
      total_kredit: 0,
      net: 0
    }
  })

  const monthlyDebet = {}
  const monthlyKredit = {}
  const monthlyPendapatan = {}
  const monthlyBeban = {}
  const monthlyLabaBersih = {}

  DASHBOARD_MONTHS.forEach(month => {
    monthlyDebet[month.index] = 0
    monthlyKredit[month.index] = 0
    monthlyPendapatan[month.index] = 0
    monthlyBeban[month.index] = 0
    monthlyLabaBersih[month.index] = 0
  })

  let totalTransaksi = 0
  let totalDebet = 0
  let totalKredit = 0

  ;(jurnalRows || []).forEach(row => {
    const kode = String(row.kode_coa || "").trim()
    const month = getMonthFromDate(row.tanggal)

    totalTransaksi += 1
    totalDebet += Number(row.debet || 0)
    totalKredit += Number(row.kredit || 0)

    if (month) {
      monthlyDebet[month] += Number(row.debet || 0)
      monthlyKredit[month] += Number(row.kredit || 0)
    }

    if (!coaMap[kode]) {
      coaMap[kode] = {
        kode_akun: row.kode_coa || "",
        nama_akun: row.nama_coa || "",
        kategori: "",
        saldo_normal: "",
        laporan: "",
        seksi: "",
        total_debet: 0,
        total_kredit: 0,
        net: 0
      }
    }

    coaMap[kode].total_debet += Number(row.debet || 0)
    coaMap[kode].total_kredit += Number(row.kredit || 0)
  })

  const prevTotalTransaksi = Number((prevJurnalRows || []).length || 0)
  const prevTotalDebet = (prevJurnalRows || []).reduce((acc, row) => acc + Number(row.debet || 0), 0)
  const prevTotalKredit = (prevJurnalRows || []).reduce((acc, row) => acc + Number(row.kredit || 0), 0)

  dashboardAllRows = Object.values(coaMap)
    .map(row => ({
      ...row,
      net: Number(row.total_debet || 0) - Number(row.total_kredit || 0)
    }))
    .sort((a, b) => String(a.kode_akun || "").localeCompare(String(b.kode_akun || "")))

  const totalAsetLancar = dashboardAllRows
    .filter(isAsetLancarAccount)
    .reduce((acc, row) => acc + Number(row.net || 0), 0)

  const totalAsetTetap = dashboardAllRows
    .filter(isAsetTetapAccount)
    .reduce((acc, row) => acc + Number(row.net || 0), 0)

  const totalKewajibanLancar = dashboardAllRows
    .filter(isKewajibanLancarAccount)
    .reduce((acc, row) => acc + Number(row.total_kredit || 0) - Number(row.total_debet || 0), 0)

  const totalEkuitas = dashboardAllRows
    .filter(isEkuitasAccount)
    .reduce((acc, row) => acc + Number(row.total_kredit || 0) - Number(row.total_debet || 0), 0)

  const lrRows = dashboardAllRows.filter(row =>
    String(row.laporan || "").trim().toLowerCase() === "laba rugi"
  )

  lrRows.forEach(row => {
    const klasifikasi = classifyDashboardLRAccount(row)

    ;(jurnalRows || [])
      .filter(j => String(j.kode_coa || "").trim() === String(row.kode_akun || "").trim())
      .forEach(j => {
        const month = getMonthFromDate(j.tanggal)
        if (!month) return

        if (klasifikasi === "pendapatan" || klasifikasi === "pendapatan_lain") {
          monthlyPendapatan[month] += Number(j.kredit || 0)
        }

        if (
          klasifikasi === "beban_penjualan" ||
          klasifikasi === "beban_administrasi" ||
          klasifikasi === "beban_lain"
        ) {
          monthlyBeban[month] += Number(j.debet || 0)
        }
      })
  })

  DASHBOARD_MONTHS.forEach(month => {
    monthlyLabaBersih[month.index] =
      Number(monthlyPendapatan[month.index] || 0) - Number(monthlyBeban[month.index] || 0)
  })

  setText("dashTotalTransaksi", new Intl.NumberFormat("id-ID").format(totalTransaksi))
  setText("dashTotalDebet", formatCurrency(totalDebet))
  setText("dashTotalKredit", formatCurrency(totalKredit))
  setText("dashNet", formatSignedCurrency(totalDebet - totalKredit))
  setText("dashAsetLancar", formatSignedCurrency(totalAsetLancar))
  setText("dashAsetTetap", formatSignedCurrency(totalAsetTetap))
  setText("dashKewajibanLancar", formatSignedCurrency(totalKewajibanLancar))
  setText("dashEkuitas", formatSignedCurrency(totalEkuitas))

  setText("dashCompareTransaksi", getCompareText(totalTransaksi, prevTotalTransaksi, "tahun lalu"))
  setText("dashCompareDebet", getCompareText(totalDebet, prevTotalDebet, "tahun lalu"))
  setText("dashCompareKredit", getCompareText(totalKredit, prevTotalKredit, "tahun lalu"))

  renderDashboardProfitLossChart(
    monthlyPendapatan,
    monthlyBeban,
    monthlyLabaBersih,
    currentStart,
    currentEnd
  )
  renderDashboardCoaTable(dashboardAllRows)
}

async function initDashboard() {
  renderDashboardYearOptions()
  renderDashboardDateInputs()
  initDashboardYearSelect()
  initDashboardDateFilters()
  initDashboardSearch()
  await loadDashboard()
}

function getMonthRangeFromDates(startDate, endDate) {
  const startMonth = Number(String(startDate).slice(5, 7))
  const endMonth = Number(String(endDate).slice(5, 7))

  return DASHBOARD_MONTHS.filter(m => m.index >= startMonth && m.index <= endMonth)
}

function formatDateToDisplay(value) {
  if (!value) return ""

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(String(value))) {
    return value
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    const [yyyy, mm, dd] = String(value).split("-")
    return `${dd}/${mm}/${yyyy}`
  }

  const dateObj = new Date(value)
  if (Number.isNaN(dateObj.getTime())) return ""

  const dd = String(dateObj.getDate()).padStart(2, "0")
  const mm = String(dateObj.getMonth() + 1).padStart(2, "0")
  const yyyy = dateObj.getFullYear()

  return `${dd}/${mm}/${yyyy}`
}