(() => {
  let glTahunInstance = null
  let generalLedgerRows = []
  let selectedGeneralLedgerIds = new Set()  

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
  
  function canManageGeneralLedger() {
    const raw =
      localStorage.getItem("finance_app_session") ||
      sessionStorage.getItem("finance_app_session")

    if (!raw) return false

    try {
      const user = JSON.parse(raw)
      const role = String(user.role || "").toLowerCase()

      return role === "master" || role === "superuser"
    } catch {
      return false
    }
  }

  function formatCurrency(num) {
    return "Rp " + new Intl.NumberFormat("id-ID").format(Number(num || 0))
  }

  function formatNetValue(debet, kredit) {
    const d = Number(debet || 0)
    const k = Number(kredit || 0)

    if (d > 0) return formatCurrency(d)
    if (k > 0) return `(${formatCurrency(k)})`
    return formatCurrency(0)
  }

  function getGeneralLedgerYearOptions() {
    const currentYear = new Date().getFullYear()
    const years = []

    for (let y = currentYear - 5; y <= currentYear + 2; y++) {
      years.push(y)
    }

    return years
  }

  function renderGeneralLedgerYearOptions() {
    const el = document.getElementById("glTahun")
    if (!el) return

    const selectedYear =
      localStorage.getItem("generalLedgerTahun") || String(new Date().getFullYear())

    el.innerHTML = getGeneralLedgerYearOptions()
      .map(year => `
        <option value="${year}" ${String(year) === String(selectedYear) ? "selected" : ""}>
          ${year}
        </option>
      `)
      .join("")
  }

  function updateGeneralLedgerSelectionVisibility() {
    const head = document.getElementById("glCheckAllHead")
    const checkAll = document.getElementById("glCheckAll")

    const canManage = canManageGeneralLedger()

    if (head) {
      head.classList.toggle("hidden", !canManage)
    }

    if (checkAll) {
      checkAll.checked = false
    }
  }

  function initGeneralLedgerYearSelect() {
    const el = document.getElementById("glTahun")
    if (!el) return

    if (glTahunInstance) {
      glTahunInstance.destroy()
      glTahunInstance = null
    }

    glTahunInstance = new TomSelect(el, {
      create: false,
      sortField: { field: "text", direction: "asc" },
      placeholder: "Pilih Tahun",
      onChange: function(value) {
        localStorage.setItem("generalLedgerTahun", value)
        loadGeneralLedger()
      }
    })
  }

  function bindGeneralLedgerCheckboxes() {
    const checkAll = document.getElementById("glCheckAll")
    const selectAllBtn = document.getElementById("glSelectAllBtn")
    const deleteSelectedBtn = document.getElementById("glDeleteSelectedBtn")
    const deleteAllBtn = document.getElementById("glDeleteAllBtn")

    document.querySelectorAll(".gl-row-check").forEach(cb => {
      cb.onchange = function () {
        const id = this.getAttribute("data-id")
        if (!id) return

        if (this.checked) {
          selectedGeneralLedgerIds.add(id)
        } else {
          selectedGeneralLedgerIds.delete(id)
        }

        syncGeneralLedgerCheckAll()
        updateDeleteSelectedVisibility()
        updateGeneralLedgerBulkCounter()
      }
    })

    if (checkAll) {
      checkAll.onchange = function () {
        const checked = !!this.checked
        document.querySelectorAll(".gl-row-check").forEach(cb => {
          cb.checked = checked
          const id = cb.getAttribute("data-id")
          if (!id) return

          if (checked) {
            selectedGeneralLedgerIds.add(id)
          } else {
            selectedGeneralLedgerIds.delete(id)
          }
        })
        updateDeleteSelectedVisibility()
        updateGeneralLedgerBulkCounter()
      }
      
    }

    if (selectAllBtn) {
      selectAllBtn.onclick = function () {
        const shouldSelectAll = selectedGeneralLedgerIds.size !== generalLedgerRows.length

        document.querySelectorAll(".gl-row-check").forEach(cb => {
          cb.checked = shouldSelectAll
          const id = cb.getAttribute("data-id")
          if (!id) return

          if (shouldSelectAll) {
            selectedGeneralLedgerIds.add(id)
          } else {
            selectedGeneralLedgerIds.delete(id)
          }
        })

        syncGeneralLedgerCheckAll()
        updateDeleteSelectedVisibility()
        updateGeneralLedgerBulkCounter()
      }
    }

    if (deleteSelectedBtn) {
      deleteSelectedBtn.onclick = deleteSelectedGeneralLedgerRows
    }

    if (deleteAllBtn) {
      deleteAllBtn.onclick = deleteAllGeneralLedgerRows
    }

    syncGeneralLedgerCheckAll()
  }

  function syncGeneralLedgerCheckAll() {
    const checkAll = document.getElementById("glCheckAll")
    if (!checkAll) return

    if (!generalLedgerRows.length) {
      checkAll.checked = false
      return
    }

    checkAll.checked = selectedGeneralLedgerIds.size === generalLedgerRows.length
  }

  function updateDeleteSelectedVisibility() {
    const btn = document.getElementById("glDeleteSelectedBtn")
    if (!btn) return

    if (selectedGeneralLedgerIds.size > 0) {
      btn.classList.remove("hidden")
    } else {
      btn.classList.add("hidden")
    }
  }

  function updateGeneralLedgerBulkCounter() {
    const counter = document.getElementById("glSelectedCounter")
    if (!counter) return

    if (selectedGeneralLedgerIds.size > 0) {
      counter.classList.remove("hidden")
      counter.classList.add("inline-flex")
      counter.innerText = `${selectedGeneralLedgerIds.size} dipilih`
    } else {
      counter.classList.add("hidden")
      counter.classList.remove("inline-flex")
      counter.innerText = "0 dipilih"
    }
  }

  async function deleteSelectedGeneralLedgerRows() {
    if (!selectedGeneralLedgerIds.size) {
      appToast("Pilih data yang ingin dihapus", "error")
      return
    }

    const result = await Swal.fire({
      title: "Hapus data terpilih?",
      text: `${selectedGeneralLedgerIds.size} baris jurnal akan dihapus permanen dari database`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Ya, hapus",
      cancelButtonText: "Batal",
      confirmButtonColor: "#dc2626"
    })

    if (!result.isConfirmed) return

    const ids = Array.from(selectedGeneralLedgerIds)

    const { error } = await supabaseClient
      .from("jurnal_detail")
      .delete()
      .in("id", ids)

    if (error) {
      appToast(error.message || "Gagal hapus data", "error")
      return
    }

    selectedGeneralLedgerIds.clear()
    appToast("Data terpilih berhasil dihapus")
    await loadGeneralLedger()
  }

  async function deleteAllGeneralLedgerRows() {
    if (!generalLedgerRows.length) {
      appToast("Tidak ada data untuk dihapus", "error")
      return
    }

    const tahun = Number(
      localStorage.getItem("generalLedgerTahun") || new Date().getFullYear()
    )
    const companyId = getActiveCompanyId()

    const result = await Swal.fire({
      title: `Hapus semua jurnal tahun ${tahun}?`,
      text: "Semua data General Ledger pada tahun ini akan dihapus permanen dari database",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Ya, hapus semua",
      cancelButtonText: "Batal",
      confirmButtonColor: "#dc2626"
    })

    if (!result.isConfirmed) return

    const { error } = await supabaseClient
      .from("jurnal_detail")
      .delete()
      .eq("company_id", companyId)
      .gte("tanggal", `${tahun}-01-01`)
      .lte("tanggal", `${tahun}-12-31`)

    if (error) {
      appToast(error.message || "Gagal hapus semua data", "error")
      return
    }

    selectedGeneralLedgerIds.clear()
    appToast(`Semua jurnal tahun ${tahun} berhasil dihapus`)
    await loadGeneralLedger()
  }

  function updateGeneralLedgerSummary(rows) {
    const totalBarisEl = document.getElementById("glTotalBaris")
    const totalDebetEl = document.getElementById("glTotalDebet")
    const totalKreditEl = document.getElementById("glTotalKredit")
    const totalNetEl = document.getElementById("glTotalNet")

    let totalDebet = 0
    let totalKredit = 0

    rows.forEach(row => {
      totalDebet += Number(row.debet || 0)
      totalKredit += Number(row.kredit || 0)
    })

    const totalNet = totalDebet - totalKredit

    if (totalBarisEl) totalBarisEl.innerText = new Intl.NumberFormat("id-ID").format(rows.length)
    if (totalDebetEl) totalDebetEl.innerText = formatCurrency(totalDebet)
    if (totalKreditEl) totalKreditEl.innerText = formatCurrency(totalKredit)

    if (totalNetEl) {
      totalNetEl.innerText =
        totalNet < 0
          ? `(${formatCurrency(Math.abs(totalNet))})`
          : formatCurrency(totalNet)
    }
  }

  function updateGeneralLedgerBulkBar() {
    const bar = document.getElementById("glBulkActionBar")
    if (!bar) return

    bar.classList.toggle("hidden", !canManageGeneralLedger() || !generalLedgerRows.length)
  }

  async function loadGeneralLedger() {
    const table = document.getElementById("generalLedgerTable")
    if (!table) return

    const tahun = Number(
      localStorage.getItem("generalLedgerTahun") || new Date().getFullYear()
    )
    const companyId = getActiveCompanyId()

    if (!companyId) {
      table.innerHTML = `
        <tr>
          <td colspan=10" class="px-4 py-6 text-center text-red-500">
            Company belum dipilih
          </td>
        </tr>
      `
      updateGeneralLedgerSummary([])
      return
    }

    table.innerHTML = `
      <tr>
        <td colspan="10" class="px-4 py-6 text-center text-slate-400">
          Loading...
        </td>
      </tr>
    `

    const { data, error } = await supabaseClient
      .from("jurnal_detail")
      .select("*")
      .eq("company_id", companyId)
      .gte("tanggal", `${tahun}-01-01`)
      .lte("tanggal", `${tahun}-12-31`)
      .order("tanggal", { ascending: true })
      .order("created_at", { ascending: true })

    if (error) {
      console.error("GENERAL LEDGER ERROR:", error)
      table.innerHTML = `
        <tr>
          <td colspan="10" class="px-4 py-6 text-center text-red-500">
            ${escapeHtml(error.message)}
          </td>
        </tr>
      `
      updateGeneralLedgerSummary([])
      return
    }

    const rows = data || []
    generalLedgerRows = rows
    selectedGeneralLedgerIds.clear()
    updateDeleteSelectedVisibility()
    updateGeneralLedgerBulkCounter()
    updateGeneralLedgerBulkBar()
    updateGeneralLedgerSelectionVisibility()

    if (!rows.length) {
      table.innerHTML = `
        <tr>
          <td colspan="10" class="px-4 py-6 text-center text-slate-400">
            Belum ada data general ledger
          </td>
        </tr>
      `
      updateGeneralLedgerSummary([])
      return
    }

    let html = ""

    rows.forEach((row, index) => {
      html += `
        <tr class="${index % 2 === 0 ? "bg-white" : "bg-slate-50"} hover:bg-blue-50 transition">
          <td class="px-4 py-3 text-center">
            ${canManageGeneralLedger() ? `
              <input
                type="checkbox"
                class="gl-row-check"
                data-id="${row.id}"
              >
            ` : ""}
          </td>
          <td class="px-4 py-3 whitespace-nowrap">${index + 1}</td>
          <td class="px-4 py-3 whitespace-nowrap">${escapeHtml(row.tanggal || "")}</td>
          <td class="px-4 py-3 whitespace-nowrap">${escapeHtml(row.kode_coa || "")}</td>
          <td class="px-4 py-3 whitespace-nowrap">${escapeHtml(row.nama_coa || "")}</td>
          <td class="px-4 py-3 whitespace-nowrap">${escapeHtml(row.nama_vendor || "-")}</td>
          <td class="px-4 py-3">${escapeHtml(row.keterangan || "-")}</td>
          <td class="px-4 py-3 text-right whitespace-nowrap text-green-700 font-medium">
            ${formatCurrency(row.debet)}
          </td>
          <td class="px-4 py-3 text-right whitespace-nowrap text-red-700 font-medium">
            ${formatCurrency(row.kredit)}
          </td>
          <td class="px-4 py-3 text-right whitespace-nowrap font-semibold ${Number(row.kredit || 0) > 0 ? "text-red-700" : "text-slate-800"}">
            ${formatNetValue(row.debet, row.kredit)}
          </td>
        </tr>
      `
    })

    table.innerHTML = html
    bindGeneralLedgerCheckboxes()
    updateGeneralLedgerSummary(rows)
  }

  window.initGeneralLedger = async function() {
    renderGeneralLedgerYearOptions()
    initGeneralLedgerYearSelect()
    await loadGeneralLedger()
  }
})()