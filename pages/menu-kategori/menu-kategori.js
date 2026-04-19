let menuKategoriFilterAwal = null
let menuKategoriFilterAkhir = null

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
  if (value < 0) return `(${formatCurrency(Math.abs(value))})`
  return formatCurrency(value)
}

async function getActiveMenuCoaMeta(kodeCoa) {
  const companyId = localStorage.getItem("activeCompanyId") || ""
  if (!companyId || !kodeCoa) return null

  const { data, error } = await supabaseClient
    .from("master_coa")
    .select("kode_akun, nama_akun, is_lampiran, is_penyusutan")
    .eq("company_id", companyId)
    .eq("kode_akun", kodeCoa)
    .maybeSingle()

  if (error) {
    console.error("LOAD ACTIVE COA META ERROR:", error)
    return null
  }

  return data || null
}

function renderMenuKategoriHead(showLampiran) {
  const headEl = document.getElementById("menuKategoriHead")
  if (!headEl) return

  headEl.innerHTML = `
    <tr>
      <th class="px-4 py-3 text-left font-semibold whitespace-nowrap">Tanggal</th>
      <th class="px-4 py-3 text-left font-semibold whitespace-nowrap">Kode COA</th>
      <th class="px-4 py-3 text-left font-semibold whitespace-nowrap">Nama COA</th>
      <th class="px-4 py-3 text-left font-semibold whitespace-nowrap">Vendor</th>
      <th class="px-4 py-3 text-left font-semibold whitespace-nowrap">Keterangan</th>
      <th class="px-4 py-3 text-right font-semibold whitespace-nowrap">Debet</th>
      <th class="px-4 py-3 text-right font-semibold whitespace-nowrap">Kredit</th>
      ${showLampiran ? `<th class="px-4 py-3 text-center font-semibold whitespace-nowrap">Lampiran PDF</th>` : ""}
    </tr>
  `
}

function getLampiranPreviewHtml(row) {
  const hasLampiran = !!row.lampiran_url

  if (!hasLampiran) {
    return `
      <div class="flex items-center justify-center">
        <label class="inline-flex items-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-50">
          Upload PDF
          <input
            type="file"
            accept="application/pdf"
            class="hidden"
            onchange="uploadLampiran('${row.id}', this)"
          >
        </label>
      </div>
    `
  }

  return `
    <div class="flex items-center justify-center gap-2">
      <button
        type="button"
        onclick="previewLampiran('${escapeJsString(row.lampiran_url)}')"
        class="inline-flex items-center rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
      >
        Lihat
      </button>

      <label class="inline-flex items-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-50">
        Ganti
        <input
          type="file"
          accept="application/pdf"
          class="hidden"
          onchange="uploadLampiran('${row.id}', this)"
        >
      </label>

      <button
        type="button"
        onclick="deleteLampiran('${row.id}', '${escapeJsString(row.lampiran_path || "")}')"
        class="inline-flex items-center rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700"
      >
        Hapus
      </button>
    </div>
  `
}

function previewLampiran(url) {
  if (!url) {
    Swal.fire("Error", "Lampiran tidak ditemukan", "error")
    return
  }

  window.open(url, "_blank", "noopener,noreferrer")
}

function toDbDate(value) {
  if (!value) return null

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value

  const parts = String(value).split("/")
  if (parts.length !== 3) return null

  const [dd, mm, yyyy] = parts
  return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`
}

function getMenuKategoriFilterRange(defaultYear) {
  const awalInput = document.getElementById("filterTanggalAwal")?.value?.trim() || ""
  const akhirInput = document.getElementById("filterTanggalAkhir")?.value?.trim() || ""

  const defaultStart = `${defaultYear}-01-01`
  const defaultEnd = `${defaultYear}-12-31`

  return {
    startDate: toDbDate(awalInput) || defaultStart,
    endDate: toDbDate(akhirInput) || defaultEnd
  }
}

function updateSummary(saldoAwalValue, totalDebet, totalKredit) {
  const saldoAwalEl = document.getElementById("summarySaldoAwal")
  const totalDebetEl = document.getElementById("summaryTotalDebet")
  const totalKreditEl = document.getElementById("summaryTotalKredit")
  const saldoAkhirEl = document.getElementById("summarySaldoAkhir")

  const saldoAkhir = Number(saldoAwalValue || 0) + Number(totalDebet || 0) - Number(totalKredit || 0)

  if (saldoAwalEl) saldoAwalEl.innerText = formatSignedCurrency(saldoAwalValue)
  if (totalDebetEl) totalDebetEl.innerText = formatCurrency(totalDebet)
  if (totalKreditEl) totalKreditEl.innerText = formatCurrency(totalKredit)
  if (saldoAkhirEl) saldoAkhirEl.innerText = formatSignedCurrency(saldoAkhir)
}

function renderMenuKategoriRows(rows, showLampiran = false) {
  const tableEl = document.getElementById("menuKategoriTable")
  if (!tableEl) return

  if (!rows || !rows.length) {
    tableEl.innerHTML = `
      <tr>
        <td colspan="${showLampiran ? 8 : 7}" class="px-4 py-6 text-center text-slate-400">
          Belum ada data jurnal
        </td>
      </tr>
    `
    return
  }

  let html = ""

  rows.forEach((row, index) => {
    const rowBg = index % 2 === 0 ? "bg-white" : "bg-slate-50"

    html += `
      <tr class="${rowBg} hover:bg-blue-50 transition">
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
        ${showLampiran ? `<td class="px-4 py-3 whitespace-nowrap text-center">${getLampiranPreviewHtml(row)}</td>` : ""}
      </tr>
    `
  })

  tableEl.innerHTML = html
}

function initMenuKategoriFilters(tahun) {
  const awalEl = document.getElementById("filterTanggalAwal")
  const akhirEl = document.getElementById("filterTanggalAkhir")

  if (awalEl && typeof flatpickr !== "undefined") {
    if (menuKategoriFilterAwal) {
      menuKategoriFilterAwal.destroy()
      menuKategoriFilterAwal = null
    }

    menuKategoriFilterAwal = flatpickr(awalEl, {
      dateFormat: "d/m/Y",
      allowInput: true,
      disableMobile: true,
      defaultDate: null,
      onChange: () => loadMenuKategoriData()
    })
  }

  if (akhirEl && typeof flatpickr !== "undefined") {
    if (menuKategoriFilterAkhir) {
      menuKategoriFilterAkhir.destroy()
      menuKategoriFilterAkhir = null
    }

    menuKategoriFilterAkhir = flatpickr(akhirEl, {
      dateFormat: "d/m/Y",
      allowInput: true,
      disableMobile: true,
      defaultDate: null,
      onChange: () => loadMenuKategoriData()
    })
  }
}

function getMenuKategoriContext() {
  return {
    kodeCoa: localStorage.getItem("menuKodeCOA") || "",
    menuLabel: localStorage.getItem("menuLabel") || "Data Jurnal",
    tahun: Number(localStorage.getItem("saldoAwalTahun") || new Date().getFullYear())
  }
}

async function uploadLampiran(rowId, inputEl) {
  const file = inputEl?.files?.[0]
  if (!file) return

  const maxSizeBytes = 10 * 1024 * 1024

  if (file.type !== "application/pdf") {
    Swal.fire("Error", "File harus berupa PDF", "error")
    inputEl.value = ""
    return
  }

  if (file.size > maxSizeBytes) {
    Swal.fire("Error", "Ukuran file maksimal 10 MB", "error")
    inputEl.value = ""
    return
  }

  Swal.fire({
    title: "Upload lampiran...",
    text: "Mohon tunggu",
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading()
  })

  try {
    const fileName = `${rowId}-${Date.now()}.pdf`
    const filePath = fileName

    const { error: uploadError } = await supabaseClient.storage
      .from("lampiran-pph")
      .upload(filePath, file, {
        upsert: true,
        contentType: "application/pdf"
      })

    if (uploadError) throw uploadError

    const { data: publicUrlData } = supabaseClient.storage
      .from("lampiran-pph")
      .getPublicUrl(filePath)

    const lampiranUrl = publicUrlData?.publicUrl || ""

    const { error: updateError } = await supabaseClient
      .from("jurnal_detail")
      .update({
        lampiran_url: lampiranUrl,
        lampiran_path: filePath
      })
      .eq("id", rowId)

    if (updateError) throw updateError

    Swal.fire("Berhasil", "Lampiran PDF berhasil diupload", "success")

    await supabaseClient.rpc("sync_missing_lampiran_notifications")

    await loadMenuKategoriData()

    if (typeof loadNotificationCount === "function") {
      await loadNotificationCount()
    }
  } catch (err) {
    console.error("UPLOAD LAMPIRAN ERROR:", err)
    Swal.fire("Error", err.message || "Gagal upload lampiran", "error")
  } finally {
    if (inputEl) inputEl.value = ""
  }
}

async function deleteLampiran(rowId, lampiranPath = "") {
  const confirmDelete = await Swal.fire({
    title: "Hapus lampiran?",
    text: "File PDF akan dihapus dari data ini.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Ya, hapus",
    cancelButtonText: "Batal",
    reverseButtons: true,
    confirmButtonColor: "#dc2626",
    cancelButtonColor: "#94a3b8"
  })

  if (!confirmDelete.isConfirmed) return

  try {
    let pathToDelete = lampiranPath

    if (!pathToDelete) {
      const { data: rowData, error: rowError } = await supabaseClient
        .from("jurnal_detail")
        .select("lampiran_path")
        .eq("id", rowId)
        .maybeSingle()

      if (rowError) throw rowError
      pathToDelete = rowData?.lampiran_path || ""
    }

    if (pathToDelete) {
      const { error: removeError } = await supabaseClient.storage
        .from("lampiran-pph")
        .remove([pathToDelete])

      if (removeError) throw removeError
    }

    const { error: updateError } = await supabaseClient
      .from("jurnal_detail")
      .update({
        lampiran_url: null,
        lampiran_path: null
      })
      .eq("id", rowId)

    if (updateError) throw updateError

    Swal.fire("Berhasil", "Lampiran berhasil dihapus", "success")

    await supabaseClient.rpc("sync_missing_lampiran_notifications")

    await loadMenuKategoriData()

    if (typeof loadNotificationCount === "function") {
      await loadNotificationCount()
    }
  } catch (err) {
    console.error("DELETE LAMPIRAN ERROR:", err)
    Swal.fire("Error", err.message || "Gagal hapus lampiran", "error")
  }
}

async function loadMenuKategoriData() {
  const { kodeCoa, menuLabel, tahun } = getMenuKategoriContext()
  const coaMeta = await getActiveMenuCoaMeta(kodeCoa)
  const showLampiran = !!coaMeta?.is_lampiran
  renderMenuKategoriHead(showLampiran)

  const titleEl = document.getElementById("menuKategoriTitle")
  const subtitleEl = document.getElementById("menuKategoriSubtitle")
  const tableEl = document.getElementById("menuKategoriTable")
  const summaryWrapper = document.getElementById("summaryWrapper")

  if (titleEl) titleEl.innerText = menuLabel

  const { startDate, endDate } = getMenuKategoriFilterRange(tahun)

  if (subtitleEl) {
    subtitleEl.innerText = `Menampilkan jurnal untuk akun: ${menuLabel} | ${startDate} s/d ${endDate}`
  }

  if (!kodeCoa) {
    if (summaryWrapper) summaryWrapper.classList.add("hidden")

    tableEl.innerHTML = `
      <tr>
        <td colspan="${showLampiran ? 8 : 7}" class="px-4 py-6 text-center text-slate-400">
          Kode COA tidak ditemukan
        </td>
      </tr>
    `
    return
  }

  tableEl.innerHTML = `
    <tr>
      <td colspan="${showLampiran ? 8 : 7}" class="px-4 py-6 text-center text-slate-400">
        Loading. . . .
      </td>
    </tr>
  `
  const companyId = localStorage.getItem("activeCompanyId") || ""

  const { data: saldoData, error: saldoError } = await supabaseClient
    .from("master_saldo_awal")
    .select("opening_debit, opening_kredit")
    .eq("company_id", companyId)
    .eq("kode_coa", kodeCoa)
    .eq("tahun", tahun)
    .maybeSingle()

  if (saldoError) {
    console.error("LOAD SALDO AWAL ERROR:", saldoError)
  }

  const openingDebit = Number(saldoData?.opening_debit || 0)
  const openingKredit = Number(saldoData?.opening_kredit || 0)
  const hasSaldoAwal = openingDebit > 0 || openingKredit > 0
  const saldoAwalValue = openingDebit - openingKredit

  if (summaryWrapper) {
    summaryWrapper.classList.toggle("hidden", !hasSaldoAwal)
  }

  let query = supabaseClient
    .from("jurnal_detail")
    .select("*")
    .eq("company_id", companyId)
    .eq("kode_coa", kodeCoa)
    .gte("tanggal", startDate)
    .lte("tanggal", endDate)
    .order("tanggal", { ascending: false })
    .order("created_at", { ascending: false })

  const { data, error } = await query

  if (error) {
    console.error("MENU KATEGORI ERROR:", error)
    tableEl.innerHTML = `
      <tr>
        <td colspan="${showLampiran ? 8 : 7}" class="px-4 py-6 text-center text-slate-400">
          Gagal load data
        </td>
      </tr>
    `

    if (hasSaldoAwal) {
      updateSummary(saldoAwalValue, 0, 0)
    }

    return
  }

  const rows = data || []

  let totalDebet = 0
  let totalKredit = 0

  rows.forEach(row => {
    totalDebet += Number(row.debet || 0)
    totalKredit += Number(row.kredit || 0)
  })

  renderMenuKategoriRows(rows, showLampiran)

  if (hasSaldoAwal) {
    updateSummary(saldoAwalValue, totalDebet, totalKredit)
  }
}

async function initMenuKategori() {
  const { menuLabel, tahun } = getMenuKategoriContext()

  const titleEl = document.getElementById("menuKategoriTitle")
  if (titleEl) titleEl.innerText = menuLabel

  initMenuKategoriFilters(tahun)
  await loadMenuKategoriData()
}