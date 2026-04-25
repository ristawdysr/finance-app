window.createPenyusutanPage = function createPenyusutanPage(config) {
  const state = {
    filterAwalInstance: null,
    filterAkhirInstance: null,
    tanggalPerolehanInstance: null,
    editingId: null
  }

  const MONTHS = [
    { key: "jan", label: "Jan", index: 0 },
    { key: "feb", label: "Feb", index: 1 },
    { key: "mar", label: "Mar", index: 2 },
    { key: "apr", label: "Apr", index: 3 },
    { key: "mei", label: "Mei", index: 4 },
    { key: "jun", label: "Jun", index: 5 },
    { key: "jul", label: "Jul", index: 6 },
    { key: "agu", label: "Agu", index: 7 },
    { key: "sep", label: "Sep", index: 8 },
    { key: "okt", label: "Okt", index: 9 },
    { key: "nov", label: "Nov", index: 10 },
    { key: "des", label: "Des", index: 11 }
  ]

  function el(key) {
    return document.getElementById(config.ids[key])
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
    return "Rp " + new Intl.NumberFormat("id-ID").format(Math.round(Number(num || 0)))
  }

  function formatPercent(num) {
    return `${Number(num || 0).toFixed(2).replace(".00", "")}%`
  }

  function parseRupiah(value) {
    return Number(String(value || "").replace(/[^\d]/g, "")) || 0
  }

  function formatRupiahInput(value) {
    const number = parseRupiah(value)
    if (!number) return ""
    return "Rp " + new Intl.NumberFormat("id-ID").format(number)
  }

  function toDbDate(value) {
    if (!value) return null
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value

    const parts = String(value).split("/")
    if (parts.length !== 3) return null

    const [dd, mm, yyyy] = parts
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`
  }

  function toDisplayDate(value) {
    if (!value) return "-"
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(String(value))) return value
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
      const [yyyy, mm, dd] = String(value).split("-")
      return `${dd}/${mm}/${yyyy}`
    }
    return value
  }

    function initYearFilter() {
        const yearEl = el("filterTahun")
        if (!yearEl) return

        const currentYear = new Date().getFullYear()
        const years = [`<option value="">Semua Tahun</option>`]

        for (let y = currentYear + 10; y >= currentYear - 10; y--) {
            years.push(`<option value="${y}">${y}</option>`)
        }

        yearEl.innerHTML = years.join("")
        yearEl.value = ""

        if (yearEl.tomselect) {
            yearEl.tomselect.destroy()
        }

        new TomSelect(yearEl, {
            create: false,
            controlInput: null,
            placeholder: "Semua Tahun",
            allowEmptyOption: true,
            onChange: function() {
            loadData()
            }
        })
    }

    function initFlatpickr() {
    if (typeof flatpickr === "undefined") return

    const awalEl = el("filterAwal")
    const akhirEl = el("filterAkhir")
    const tanggalEl = el("tanggalPerolehan")

    if (state.filterAwalInstance) state.filterAwalInstance.destroy()
    if (state.filterAkhirInstance) state.filterAkhirInstance.destroy()
    if (state.tanggalPerolehanInstance) state.tanggalPerolehanInstance.destroy()

    if (awalEl) {
        state.filterAwalInstance = flatpickr(awalEl, {
        dateFormat: "d/m/Y",
        allowInput: true,
        disableMobile: true,
        monthSelectorType: "static",
        prevArrow: `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m15 18-6-6 6-6"/>
            </svg>
        `,
        nextArrow: `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m9 18 6-6-6-6"/>
            </svg>
        `,
        onChange: loadData
        })
    }

    if (akhirEl) {
        state.filterAkhirInstance = flatpickr(akhirEl, {
        dateFormat: "d/m/Y",
        allowInput: true,
        disableMobile: true,
        monthSelectorType: "static",
        prevArrow: `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m15 18-6-6 6-6"/>
            </svg>
        `,
        nextArrow: `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m9 18 6-6-6-6"/>
            </svg>
        `,
        onChange: loadData
        })
    }

    if (tanggalEl) {
        state.tanggalPerolehanInstance = flatpickr(tanggalEl, {
        dateFormat: "d/m/Y",
        allowInput: true,
        disableMobile: true,
        monthSelectorType: "static",
        prevArrow: `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m15 18-6-6 6-6"/>
            </svg>
        `,
        nextArrow: `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m9 18 6-6-6-6"/>
            </svg>
        `
        })
    }
    }

  function initHargaFormatter() {
    const input = el("hargaPerolehan")
    if (!input) return

    input.oninput = function() {
      const cursorAtEnd = this.selectionStart === this.value.length
      this.value = formatRupiahInput(this.value)

      if (cursorAtEnd) {
        const len = this.value.length
        this.setSelectionRange(len, len)
      }
    }

    input.onblur = function() {
      this.value = formatRupiahInput(this.value)
    }
  }

  function initCollapse() {
    const btn = el("toggleFormBtn")
    const wrapper = el("formWrapper")
    const label = el("toggleFormLabel")

    if (!btn || !wrapper || !label) return

    btn.onclick = function() {
      const isHidden = wrapper.classList.contains("hidden")
      wrapper.classList.toggle("hidden", !isHidden)
      label.innerText = isHidden ? "Tutup Input Baru" : "Input Aset Baru"
    }
  }

  function openForm() {
    const wrapper = el("formWrapper")
    const label = el("toggleFormLabel")
    if (wrapper) wrapper.classList.remove("hidden")
    if (label) label.innerText = "Tutup Input Baru"
  }

  function closeForm() {
    const wrapper = el("formWrapper")
    const label = el("toggleFormLabel")
    if (wrapper) wrapper.classList.add("hidden")
    if (label) label.innerText = "Input Aset Baru"
  }

  function setSubtitle() {
    const subtitleEl = el("subtitle")
    if (!subtitleEl) return

    const tahun = String(el("filterTahun")?.value || "").trim()
    const awal = String(el("filterAwal")?.value || "").trim()
    const akhir = String(el("filterAkhir")?.value || "").trim()

    if (tahun) {
      subtitleEl.innerText = `Data Penyusutan Tahun ${tahun}`
      return
    }

    if (awal || akhir) {
      subtitleEl.innerText = `Data Penyusutan Periode ${awal || "-"} s/d ${akhir || "-"}`
      return
    }

    subtitleEl.innerText = "Data Penyusutan Semua Tahun Sampai Nilai Buku Habis"
  }

  function getFilters() {
    const tahun = String(el("filterTahun")?.value || "").trim()
    let startDate = toDbDate(el("filterAwal")?.value || "")
    let endDate = toDbDate(el("filterAkhir")?.value || "")

    if (startDate && endDate && startDate > endDate) {
      const temp = startDate
      startDate = endDate
      endDate = temp
    }

    return {
      tahun: tahun ? Number(tahun) : null,
      startDate,
      endDate
    }
  }

  function getMonthsInYear(tanggalPerolehan, year) {
    const acqDate = new Date(`${tanggalPerolehan}T00:00:00`)
    const acqYear = acqDate.getFullYear()
    const acqMonth = acqDate.getMonth()

    if (year < acqYear) return []
    if (year === acqYear) {
      return MONTHS.filter(m => m.index >= acqMonth)
    }
    return MONTHS.slice()
  }

  function buildScheduleForAsset(asset, filters) {
    const hargaPerolehan = Number(asset.harga_perolehan || 0)
    const tarifTahunPct = Number(asset.tarif_tahun || 0)
    const tarifBulanPct = tarifTahunPct / 12
    const depresiasiBulanan = hargaPerolehan * (tarifTahunPct / 100) / 12

    let akumulasi = 0
    let nilaiBuku = hargaPerolehan

    const acquisitionYear = Number(String(asset.tanggal_perolehan || "").slice(0, 4))
    const maxLoopYear = acquisitionYear + 100
    const rows = []

    for (let year = acquisitionYear; year <= maxLoopYear; year++) {
      if (nilaiBuku <= 0) break

      const monthsActive = getMonthsInYear(asset.tanggal_perolehan, year)
      if (!monthsActive.length) continue

      const monthValues = {}
      MONTHS.forEach(m => {
        monthValues[m.key] = 0
      })

      monthsActive.forEach(m => {
        const value = Math.min(depresiasiBulanan, nilaiBuku)
        monthValues[m.key] = value
        akumulasi += value
        nilaiBuku = hargaPerolehan - akumulasi
        if (nilaiBuku < 0) nilaiBuku = 0
      })

      const totalDepresiasi = MONTHS.reduce((acc, m) => acc + Number(monthValues[m.key] || 0), 0)

      const includeByYear = !filters.tahun || year === filters.tahun

      const includeByDate = (() => {
        if (!filters.startDate && !filters.endDate) return true
        const yearStart = `${year}-01-01`
        const yearEnd = `${year}-12-31`
        if (filters.startDate && yearEnd < filters.startDate) return false
        if (filters.endDate && yearStart > filters.endDate) return false
        return true
      })()

      if (includeByYear && includeByDate) {
        rows.push({
          id: asset.id,
          year,
          keterangan: asset.keterangan || "",
          jumlah_unit: Number(asset.jumlah_unit || 0),
          tarif_tahun_pct: tarifTahunPct,
          tarif_bulan_pct: tarifBulanPct,
          tanggal_perolehan: asset.tanggal_perolehan,
          harga_perolehan: hargaPerolehan,
          total_depresiasi: totalDepresiasi,
          akumulasi_penyusutan: akumulasi,
          nilai_buku: nilaiBuku,
          months: monthValues
        })
      }
    }

    return rows
  }

  function groupRowsByYear(rows) {
    const grouped = {}
    rows.forEach(row => {
      if (!grouped[row.year]) grouped[row.year] = []
      grouped[row.year].push(row)
    })
    return grouped
  }

  function renderTableSections(rows) {
    const wrapper = el("tableWrapper")
    if (!wrapper) return

    if (!rows.length) {
      wrapper.innerHTML = `
        <div class="rounded-xl border border-slate-200 bg-white">
          <div class="px-4 py-6 text-center text-slate-400">Belum ada data aset ${escapeHtml(config.emptyLabel)}</div>
        </div>
      `
      return
    }

    const grouped = groupRowsByYear(rows)
    const years = Object.keys(grouped).map(Number).sort((a, b) => a - b)

    let html = ""

    years.forEach(year => {
      const yearRows = grouped[year]
      const subtotal = {
        harga_perolehan: 0,
        total_depresiasi: 0,
        akumulasi_penyusutan: 0,
        nilai_buku: 0
      }

      MONTHS.forEach(m => {
        subtotal[m.key] = 0
      })

      html += `
        <div class="rounded-2xl border border-slate-200 overflow-hidden bg-white">
          <div class="px-4 py-3 bg-slate-50 border-b border-slate-200">
            <div class="text-lg font-bold text-slate-800">Tahun ${year}</div>
          </div>

          <div class="table-responsive">
            <table class="min-w-[2200px] w-full text-sm text-slate-700">
              <thead class="bg-slate-100 text-slate-700">
                <tr>
                  <th class="px-4 py-3 text-center font-semibold whitespace-nowrap">No</th>
                  ${canManagePenyusutan() ? `<th class="px-4 py-3 text-center font-semibold whitespace-nowrap">Aksi</th>` : ""}
                  <th class="px-4 py-3 text-left font-semibold whitespace-nowrap">Keterangan</th>
                  <th class="px-4 py-3 text-right font-semibold whitespace-nowrap">Jumlah / Unit</th>
                  <th class="px-4 py-3 text-right font-semibold whitespace-nowrap">Tarif / Tahun</th>
                  <th class="px-4 py-3 text-right font-semibold whitespace-nowrap">Tarif / Bulan</th>
                  <th class="px-4 py-3 text-left font-semibold whitespace-nowrap">Tanggal Perolehan</th>
                  <th class="px-4 py-3 text-right font-semibold whitespace-nowrap">Harga Perolehan</th>
                  ${MONTHS.map(m => `<th class="px-4 py-3 text-right font-semibold whitespace-nowrap">${m.label}</th>`).join("")}
                  <th class="px-4 py-3 text-right font-semibold whitespace-nowrap">Total Depresiasi</th>
                  <th class="px-4 py-3 text-right font-semibold whitespace-nowrap">Akumulasi Penyusutan</th>
                  <th class="px-4 py-3 text-right font-semibold whitespace-nowrap">Nilai Buku</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-200">
      `

      yearRows.forEach((row, index) => {
        subtotal.harga_perolehan += Number(row.harga_perolehan || 0)
        subtotal.total_depresiasi += Number(row.total_depresiasi || 0)
        subtotal.akumulasi_penyusutan += Number(row.akumulasi_penyusutan || 0)
        subtotal.nilai_buku += Number(row.nilai_buku || 0)

        MONTHS.forEach(m => {
          subtotal[m.key] += Number(row.months[m.key] || 0)
        })

        html += `
          <tr class="${index % 2 === 0 ? "bg-white" : "bg-slate-50"} hover:bg-blue-50 transition">
            <td class="px-4 py-3 text-center whitespace-nowrap">${index + 1}</td>
            ${canManagePenyusutan() ? `
            <td class="px-4 py-3 text-center whitespace-nowrap">
              <div class="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onclick="${config.editFnName}(${row.id})"
                  class="text-blue-600 hover:text-blue-800"
                  title="Edit"
                >
                  <i data-lucide="pencil" class="w-4 h-4"></i>
                </button>

                <button
                  type="button"
                  onclick="${config.deleteFnName}(${row.id})"
                  class="text-red-600 hover:text-red-800"
                  title="Hapus"
                >
                  <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
              </div>
            </td>
            ` : ""}
            <td class="px-4 py-3 whitespace-nowrap font-semibold">${escapeHtml(row.keterangan)}</td>
            <td class="px-4 py-3 text-right whitespace-nowrap">${new Intl.NumberFormat("id-ID").format(row.jumlah_unit)}</td>
            <td class="px-4 py-3 text-right whitespace-nowrap">${formatPercent(row.tarif_tahun_pct)}</td>
            <td class="px-4 py-3 text-right whitespace-nowrap">${formatPercent(row.tarif_bulan_pct)}</td>
            <td class="px-4 py-3 whitespace-nowrap">${toDisplayDate(row.tanggal_perolehan)}</td>
            <td class="px-4 py-3 text-right whitespace-nowrap">${formatCurrency(row.harga_perolehan)}</td>
            ${MONTHS.map(m => `<td class="px-4 py-3 text-right whitespace-nowrap">${formatCurrency(row.months[m.key])}</td>`).join("")}
            <td class="px-4 py-3 text-right whitespace-nowrap font-semibold">${formatCurrency(row.total_depresiasi)}</td>
            <td class="px-4 py-3 text-right whitespace-nowrap">${formatCurrency(row.akumulasi_penyusutan)}</td>
            <td class="px-4 py-3 text-right whitespace-nowrap font-semibold">${formatCurrency(row.nilai_buku)}</td>
          </tr>
        `
      })

      html += `
              </tbody>
              <tfoot>
                <tr class="bg-slate-100 border-t border-slate-200 font-semibold">
                  <td colspan="${canManagePenyusutan() ? 7 : 6}" class="px-4 py-3 text-right">Jumlah</td>
                  <td class="px-4 py-3 text-right whitespace-nowrap">${formatCurrency(subtotal.harga_perolehan)}</td>
                  ${MONTHS.map(m => `<td class="px-4 py-3 text-right whitespace-nowrap">${formatCurrency(subtotal[m.key])}</td>`).join("")}
                  <td class="px-4 py-3 text-right whitespace-nowrap">${formatCurrency(subtotal.total_depresiasi)}</td>
                  <td class="px-4 py-3 text-right whitespace-nowrap">${formatCurrency(subtotal.akumulasi_penyusutan)}</td>
                  <td class="px-4 py-3 text-right whitespace-nowrap">${formatCurrency(subtotal.nilai_buku)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      `
    })

    wrapper.innerHTML = html

    if (window.lucide) {
      lucide.createIcons()
    }
  }

  function getCurrentRole() {
    const raw =
      localStorage.getItem("finance_app_session") ||
      sessionStorage.getItem("finance_app_session")

    if (!raw) return ""

    try {
      return String(JSON.parse(raw).role || "").toLowerCase()
    } catch {
      return ""
    }
  }

  function canManagePenyusutan() {
    const role = getCurrentRole()
    return role === "master" || role === "superuser" || role === "editor"
  }

  function applyPenyusutanAccess() {
    const canManage = canManagePenyusutan()

    const toggleBtn = el("toggleFormBtn")
    const formWrapper = el("formWrapper")

    if (toggleBtn) {
      toggleBtn.classList.toggle("hidden", !canManage)
      toggleBtn.classList.toggle("inline-flex", canManage)
    }

    if (!canManage && formWrapper) {
      formWrapper.classList.add("hidden")
    }
  }

  function getActiveCompanyId() {
    return localStorage.getItem("activeCompanyId") || ""
  }

  function getFormPayload() {
    return {
      company_id: getActiveCompanyId(),
      jenis_aset: config.jenisAset,
      kode_coa: localStorage.getItem("menuKodeCOA") || "",
      nama_coa: localStorage.getItem("menuLabel") || config.pageTitle,
      keterangan: String(el("keterangan")?.value || "").trim(),
      jumlah_unit: Number(el("jumlah")?.value || 0),
      tarif_tahun: Number(el("tarif")?.value || 0),
      masa_manfaat_tahun: Number(el("masaManfaat")?.value || 0),
      tanggal_perolehan: toDbDate(el("tanggalPerolehan")?.value || ""),
      harga_perolehan: parseRupiah(el("hargaPerolehan")?.value || "")
    }
  }

  function validatePayload(payload) {
    if (!payload.company_id) return "Company aktif belum dipilih"
    if (!payload.keterangan) return "Keterangan wajib diisi"
    if (!payload.jumlah_unit || payload.jumlah_unit <= 0) return "Jumlah / Unit wajib lebih dari 0"
    if (!payload.tarif_tahun || payload.tarif_tahun <= 0) return "Tarif wajib lebih dari 0"
    if (!payload.masa_manfaat_tahun || payload.masa_manfaat_tahun <= 0) return "Masa manfaat wajib lebih dari 0"
    if (!payload.tanggal_perolehan) return "Tanggal perolehan wajib diisi"
    if (!payload.harga_perolehan || payload.harga_perolehan <= 0) return "Harga perolehan wajib lebih dari 0"
    return ""
  }

  function resetForm() {
    state.editingId = null

    el("keterangan").value = ""
    el("jumlah").value = ""
    el("tarif").value = ""
    el("masaManfaat").value = ""
    el("tanggalPerolehan").value = ""
    el("hargaPerolehan").value = ""

    const btn = el("submitBtn")
    if (btn) btn.innerText = "Simpan Aset"

    closeForm()
  }

  async function saveData() {
    if (!canManagePenyusutan()) {
      appToast("Viewer tidak boleh input atau mengubah aset", "error")
      return
}
    const payload = getFormPayload()
    const errorText = validatePayload(payload)

    if (errorText) {
      appToast(errorText, "error")
      return
    }

    let result

    if (state.editingId) {
      result = await supabaseClient
        .from("aset_penyusutan")
        .update(payload)
        .eq("id", state.editingId)
    } else {
      result = await supabaseClient
        .from("aset_penyusutan")
        .insert(payload)
    }

    if (result.error) {
      appToast(result.error.message || "Gagal simpan data", "error")
      return
    }

    appToast(state.editingId ? "Data aset berhasil diupdate" : "Data aset berhasil disimpan")

    resetForm()
    await loadData()
  }

  async function loadForEdit(id) {

    if (!canManagePenyusutan()) {
      appToast("Viewer tidak boleh mengedit aset", "error")
      return
    }
    const { data, error } = await supabaseClient
      .from("aset_penyusutan")
      .select("*")
      .eq("id", id)
      .eq("jenis_aset", config.jenisAset)
      .eq("company_id", getActiveCompanyId())
      .maybeSingle()

    if (error || !data) {
      appToast(error?.message || "Data tidak ditemukan", "error")
      return
    }

    state.editingId = data.id

    el("keterangan").value = data.keterangan || ""
    el("jumlah").value = Number(data.jumlah_unit || 0)
    el("tarif").value = Number(data.tarif_tahun || 0)
    el("masaManfaat").value = Number(data.masa_manfaat_tahun || 0)
    el("tanggalPerolehan").value = toDisplayDate(data.tanggal_perolehan)
    el("hargaPerolehan").value = formatRupiahInput(data.harga_perolehan)

    const btn = el("submitBtn")
    if (btn) btn.innerText = "Update Aset"

    openForm()
  }

  async function removeData(id) {
    if (!canManagePenyusutan()) {
      appToast("Viewer tidak boleh menghapus aset", "error")
      return
    }
    const confirmDelete = await Swal.fire({
      title: "Hapus data ini?",
      text: "Data aset akan dihapus permanen.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Ya, hapus",
      cancelButtonText: "Batal",
      reverseButtons: true,
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#94a3b8"
    })

    if (!confirmDelete.isConfirmed) return

    const { error } = await supabaseClient
      .from("aset_penyusutan")
      .delete()
      .eq("id", id)
      .eq("jenis_aset", config.jenisAset)
      .eq("company_id", getActiveCompanyId())

    if (error) {
      appToast(error.message || "Gagal hapus data", "error")
      return
    }

    appToast("Data aset berhasil dihapus")

    await loadData()
  }

  async function loadData() {
    setSubtitle()

    const wrapper = el("tableWrapper")
    if (wrapper) {
      wrapper.innerHTML = `
        <div class="rounded-xl border border-slate-200 bg-white">
          <div class="px-4 py-6 text-center text-slate-400">Loading...</div>
        </div>
      `
    }

    const { data, error } = await supabaseClient
      .from("aset_penyusutan")
      .select("*")
      .eq("company_id", getActiveCompanyId())
      .eq("jenis_aset", config.jenisAset)
      .order("tanggal_perolehan", { ascending: true })
      .order("created_at", { ascending: true })

    if (error) {
      if (wrapper) {
        wrapper.innerHTML = `
          <div class="rounded-xl border border-red-200 bg-white">
            <div class="px-4 py-6 text-center text-red-500">${escapeHtml(error.message)}</div>
          </div>
        `
      }
      return
    }

    const filters = getFilters()
    const scheduleRows = []

    ;(data || []).forEach(asset => {
      const assetRows = buildScheduleForAsset(asset, filters)
      scheduleRows.push(...assetRows)
    })

    renderTableSections(scheduleRows)
  }

  function bindEvents() {
    const btnSubmit = el("submitBtn")
    const btnReset = el("resetBtn")

    if (btnSubmit) btnSubmit.onclick = saveData
    if (btnReset) btnReset.onclick = resetForm
  }

  window[config.editFnName] = loadForEdit
  window[config.deleteFnName] = removeData

  return async function initPage() {
    const companyEl = el("companyTitle")
    if (companyEl) companyEl.innerText = config.companyName

    applyPenyusutanAccess()
    initYearFilter()
    initFlatpickr()
    initHargaFormatter()
    initCollapse()
    bindEvents()
    setSubtitle()
    applyPenyusutanAccess()
    await loadData()
  }
}