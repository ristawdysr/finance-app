let editVendorId = null
let vendorPreviewData = []
let selectedVendorIds = new Set()

function updateVendorDeleteSelectedVisibility() {
  const btn = document.getElementById("vendorDeleteSelectedBtn")
  if (!btn) return

  if (selectedVendorIds.size > 0) {
    btn.classList.remove("hidden")
  } else {
    btn.classList.add("hidden")
  }
}

function updateVendorBulkCounter() {
  const counter = document.getElementById("vendorSelectedCounter")
  if (!counter) return

  if (selectedVendorIds.size > 0) {
    counter.classList.remove("hidden")
    counter.classList.add("inline-flex")
    counter.innerText = `${selectedVendorIds.size} dipilih`
  } else {
    counter.classList.add("hidden")
    counter.classList.remove("inline-flex")
    counter.innerText = "0 dipilih"
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

function getActiveCompanyId() {
  return localStorage.getItem("activeCompanyId") || ""
}

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "")
}

function formatContactNumber(value) {
  const digits = onlyDigits(value).slice(0, 20)
  return digits.replace(/(\d{4})(?=\d)/g, "$1-")
}

function initVendorContactFormatter() {
  const kontakEl = document.getElementById("kontak")
  if (!kontakEl) return

  kontakEl.setAttribute("inputmode", "numeric")
  kontakEl.setAttribute("autocomplete", "off")
  kontakEl.setAttribute("spellcheck", "false")

  const applyFormat = () => {
    kontakEl.value = formatContactNumber(kontakEl.value)
  }

  kontakEl.addEventListener("input", applyFormat)
  kontakEl.addEventListener("blur", applyFormat)

  kontakEl.addEventListener("paste", function () {
    setTimeout(applyFormat, 0)
  })

  kontakEl.addEventListener("keydown", function (e) {
    const allowedKeys = [
      "Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab", "Home", "End"
    ]

    if (allowedKeys.includes(e.key)) return

    if (!/^\d$/.test(e.key)) {
      e.preventDefault()
    }
  })
}

function ensureMasterDataAccess() {
  const raw =
    localStorage.getItem("finance_app_session") ||
    sessionStorage.getItem("finance_app_session")

  if (!raw) return false

  try {
    const user = JSON.parse(raw)
    const role = String(user.role || "").toLowerCase()

    if (role === "master" || role === "superuser") {
      return true
    }

    appToast("Halaman ini hanya untuk master atau superuser", "error")

    if (typeof handleMenuClick === "function") {
      handleMenuClick("dashboard")
    } else {
      window.location.href = "index.html"
    }

    return false
  } catch {
    return false
  }
}

function initMasterVendor() {
  if (!ensureMasterDataAccess()) return
  initVendorContactFormatter()
  loadVendor()

  const uploadVendor = document.getElementById("uploadVendor")
  if (uploadVendor) {
    uploadVendor.onchange = handleUploadVendor
  }
}

async function loadVendor() {
  const companyId = getActiveCompanyId()
  const table = document.getElementById("vendorTable")
  if (!table) return

  if (!companyId) {
    table.innerHTML = `
      <tr>
        <td colspan="5" class="text-center text-slate-400 py-6">Company aktif belum dipilih</td>
      </tr>
    `
    return
  }

  table.innerHTML = `
    <tr>
      <td colspan="5" class="text-center text-slate-400 py-6">Loading...</td>
    </tr>
  `

  const { data, error } = await supabaseClient
    .from("master_vendor")
    .select("*")
    .eq("company_id", companyId)
    .order("nama_vendor", { ascending: true })

  if (error) {
    console.error("LOAD VENDOR ERROR:", error)
    table.innerHTML = `
      <tr>
        <td colspan="5" class="text-center text-red-500 py-6">${error.message}</td>
      </tr>
    `
    return
  }

  if (!data || !data.length) {
    table.innerHTML = `
      <tr>
        <td colspan="5" class="text-center text-slate-400 py-6">Belum ada data vendor</td>
      </tr>
    `
    return
  }

  let html = ""

  data.forEach((row, index) => {
    html += `
      <tr class="${index % 2 === 0 ? "bg-white" : "bg-slate-50"} hover:bg-blue-50 transition">
        <td class="px-4 py-3">${escapeHtml(row.nama_vendor || "")}</td>
        <td class="px-4 py-3">${escapeHtml(row.kontak || "")}</td>
        <td class="px-4 py-3 min-w-[260px] whitespace-normal break-words">${escapeHtml(row.deskripsi || "-")}</td>
        <td class="px-4 py-3">${escapeHtml(row.created_at || "")}</td>
        <td class="px-4 py-3 text-center">
          <div class="flex items-center justify-center gap-3">
            <button onclick="editVendor('${row.id}')" class="text-blue-600 hover:text-blue-800" title="Edit">
              <i data-lucide="pencil" class="w-4 h-4"></i>
            </button>
            <button onclick="deleteVendor('${row.id}')" class="text-red-500 hover:text-red-700" title="Hapus">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>
        </td>
        <td class="px-4 py-3 text-center">
          <input type="checkbox" class="vendor-row-check" data-id="${row.id}">
        </td>
      </tr>
    `
  })

  table.innerHTML = html
  selectedVendorIds.clear()
  updateVendorDeleteSelectedVisibility()
  updateVendorBulkCounter()

  if (window.lucide) {
    lucide.createIcons()
  }
  bindVendorBulkActions()
}

function bindVendorBulkActions() {
  const checkAll = document.getElementById("vendorCheckAll")
  const selectAllBtn = document.getElementById("vendorSelectAllBtn")
  const deleteSelectedBtn = document.getElementById("vendorDeleteSelectedBtn")

  document.querySelectorAll(".vendor-row-check").forEach(cb => {
    cb.onchange = function () {
      const id = this.getAttribute("data-id")
      if (!id) return

      if (this.checked) selectedVendorIds.add(id)
      else selectedVendorIds.delete(id)

      syncVendorCheckAll()
      updateVendorDeleteSelectedVisibility()
      updateVendorBulkCounter()
    }
  })

  if (checkAll) {
    checkAll.onchange = function () {
      const checked = !!this.checked
      document.querySelectorAll(".vendor-row-check").forEach(cb => {
        cb.checked = checked
        const id = cb.getAttribute("data-id")
        if (!id) return

        if (checked) selectedVendorIds.add(id)
        else selectedVendorIds.delete(id)
      })
      updateVendorDeleteSelectedVisibility()
      updateVendorBulkCounter()
    }
  }

  if (selectAllBtn) {
    selectAllBtn.onclick = function () {
      const rows = document.querySelectorAll(".vendor-row-check")
      const shouldSelectAll = selectedVendorIds.size !== rows.length

      rows.forEach(cb => {
        cb.checked = shouldSelectAll
        const id = cb.getAttribute("data-id")
        if (!id) return

        if (shouldSelectAll) selectedVendorIds.add(id)
        else selectedVendorIds.delete(id)
      })

      syncVendorCheckAll()
      updateVendorDeleteSelectedVisibility()
      updateVendorBulkCounter()
    }
  }

  if (deleteSelectedBtn) {
    deleteSelectedBtn.onclick = deleteSelectedVendor
  }
}

function syncVendorCheckAll() {
  const checkAll = document.getElementById("vendorCheckAll")
  const rows = document.querySelectorAll(".vendor-row-check")
  if (!checkAll) return

  checkAll.checked = rows.length > 0 && selectedVendorIds.size === rows.length
  updateVendorDeleteSelectedVisibility()
  updateVendorBulkCounter()
}

async function deleteSelectedVendor() {
  if (!selectedVendorIds.size) {
    appToast("Pilih vendor yang ingin dihapus", "info")
    return
  }

  const result = await Swal.fire({
    title: "Hapus vendor terpilih?",
    text: `${selectedVendorIds.size} vendor akan dihapus`,
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Ya, hapus",
    cancelButtonText: "Batal",
    confirmButtonColor: "#dc2626"
  })

  if (!result.isConfirmed) return

  const { error } = await supabaseClient
    .from("master_vendor")
    .delete()
    .in("id", Array.from(selectedVendorIds))

  if (error) {
    appToast(error.message || "Gagal hapus vendor", "error")
    return
  }

  selectedVendorIds.clear()
  await loadVendor()
  appToast("Vendor terpilih berhasil dihapus")
}

async function saveVendor() {
  const companyId = getActiveCompanyId()
  const nama_vendor = document.getElementById("nama_vendor")?.value?.trim() || ""
  const kontak = formatContactNumber(document.getElementById("kontak")?.value || "")
  const deskripsi = document.getElementById("deskripsi")?.value?.trim() || ""

  if (!companyId) {
    Swal.fire("Error", "Company aktif belum dipilih", "error")
    return
  }

  if (!nama_vendor) {
    Swal.fire("Error", "Nama vendor wajib diisi", "error")
    return
  }

  if (!kontak || onlyDigits(kontak).length === 0) {
    Swal.fire("Error", "Kontak wajib diisi angka", "error")
    return
  }

  const payload = {
    company_id: companyId,
    nama_vendor,
    kontak,
    deskripsi
  }

  let error = null

  if (window.editVendorId) {
    const res = await supabaseClient
      .from("master_vendor")
      .update({
        nama_vendor,
        kontak,
        deskripsi
      })
      .eq("id", window.editVendorId)

    error = res.error
    window.editVendorId = null
  } else {
    const res = await supabaseClient
      .from("master_vendor")
      .insert(payload)

    error = res.error
  }

  if (error) {
    appToast(error.message || "Gagal simpan vendor", "error")
    return
  }

  document.getElementById("nama_vendor").value = ""
  document.getElementById("kontak").value = ""
  document.getElementById("deskripsi").value = ""

  await loadVendor()
  appToast("Data vendor berhasil disimpan")
}

async function editVendor(rowId) {
  const { data, error } = await supabaseClient
    .from("master_vendor")
    .select("*")
    .eq("id", rowId)
    .single()

  if (error) {
    Swal.fire("Error", error.message, "error")
    return
  }

  const { value: formValues } = await Swal.fire({
    title: "Edit Vendor",
    width: 700,
    html: `
      <div style="text-align:left; margin-top:8px;">

        <div style="display:grid; grid-template-columns:140px 1fr; gap:12px; align-items:center; margin-bottom:14px;">
          <label style="font-size:13px; font-weight:600;">Nama Vendor</label>
          <input
            id="swal_nama_vendor"
            class="swal2-input"
            style="margin:0; width:100%;"
            value="${escapeHtml(data.nama_vendor)}"
          >
        </div>

        <div style="display:grid; grid-template-columns:140px 1fr; gap:12px; align-items:center; margin-bottom:14px;">
          <label style="font-size:13px; font-weight:600;">Kontak</label>
          <input
            id="swal_kontak_vendor"
            class="swal2-input"
            style="margin:0; width:100%;"
            value="${escapeHtml(formatContactNumber(data.kontak || ""))}"
          >
        </div>

        <div style="display:grid; grid-template-columns:140px 1fr; gap:12px; align-items:start;">
          <label style="font-size:13px; font-weight:600; padding-top:10px;">Deskripsi</label>
          <textarea
            id="swal_deskripsi_vendor"
            class="swal2-textarea"
            style="margin:0; width:100%; min-height:120px;"
          >${escapeHtml(data.deskripsi || "")}</textarea>
        </div>

      </div>
    `,
    showCancelButton: true,
    confirmButtonText: "Update",
    didOpen: () => {
      const kontakEl = document.getElementById("swal_kontak_vendor")
      if (kontakEl) {
        kontakEl.setAttribute("inputmode", "numeric")
        kontakEl.setAttribute("autocomplete", "off")
        kontakEl.setAttribute("spellcheck", "false")

        kontakEl.addEventListener("input", function () {
          this.value = formatContactNumber(this.value)
        })

        kontakEl.addEventListener("keydown", function (e) {
          const allowedKeys = [
            "Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab", "Home", "End"
          ]

          if (allowedKeys.includes(e.key)) return

          if (!/^\d$/.test(e.key)) {
            e.preventDefault()
          }
        })
      }
    },
    preConfirm: () => {
      const nama_vendor = document.getElementById("swal_nama_vendor").value.trim()
      const kontak = formatContactNumber(
        document.getElementById("swal_kontak_vendor").value
      )
      const deskripsi = document.getElementById("swal_deskripsi_vendor").value.trim()

      if (!nama_vendor) {
        Swal.showValidationMessage("Nama Vendor wajib diisi")
        return false
      }

      return { nama_vendor, kontak, deskripsi }
    }
  })

  if (!formValues) return

  const { error: updateError } = await supabaseClient
    .from("master_vendor")
    .update(formValues)
    .eq("id", rowId)

  if (updateError) {
    Swal.fire("Error", updateError.message, "error")
    return
  }

  Swal.fire("Success", "Data Vendor berhasil diupdate", "success")
  await loadVendor()
}

async function deleteVendor(rowId) {
  const confirm = await Swal.fire({
    title: "Hapus data?",
    text: "Data Vendor yang dihapus tidak bisa dikembalikan",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Ya, hapus",
    cancelButtonText: "Batal"
  })

  if (!confirm.isConfirmed) return

  let res = await supabaseClient
    .from("master_vendor")
    .delete()
    .eq("id", rowId)

  if (res.error) {
    res = await supabaseClient
      .from("master_vendor")
      .delete()
      .eq("id", rowId)
  }

  if (res.error) {
    Swal.fire("Error", res.error.message, "error")
    return
  }

  Swal.fire("Success", "Data Vendor berhasil dihapus", "success")
  await loadVendor()
}

function resetVendorForm() {
  document.getElementById("nama_vendor").value = ""
  document.getElementById("kontak").value = ""
  document.getElementById("deskripsi").value = ""
  editVendorId = null
}

async function handleUploadVendor(e) {
  const file = e.target.files[0]
  if (!file) return

  const data = await file.arrayBuffer()
  const workbook = XLSX.read(data)
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const json = XLSX.utils.sheet_to_json(sheet, { defval: "" })

  if (!json.length) {
    Swal.fire("Error", "File Excel vendor kosong", "error")
    e.target.value = ""
    return
  }

  vendorPreviewData = json.map((row, index) => {
    const item = {
      no: index + 1,
      nama_vendor: String(row["Nama Vendor"] || row["nama_vendor"] || "").trim(),
      kontak: String(row["Kontak"] || row["kontak"] || "").trim()
    }

    let statusText = "Siap import"

    if (!item.nama_vendor) {
      statusText = "Tanpa nama vendor, tetap bisa import"
    }

    return {
      ...item,
      valid: true,
      statusText
    }
  })

  let previewHtml = `
    <div style="text-align:left; margin-bottom:10px;">
      Total row: <b>${vendorPreviewData.length}</b>
    </div>

    <div style="max-height:350px; overflow:auto; border:1px solid #ddd;">
      <table style="width:100%; border-collapse:collapse; font-size:12px;">
        <thead style="position:sticky; top:0; background:#f3f4f6;">
          <tr>
            <th style="border:1px solid #ddd; padding:6px;">No</th>
            <th style="border:1px solid #ddd; padding:6px;">Nama Vendor</th>
            <th style="border:1px solid #ddd; padding:6px;">Kontak</th>
            <th style="border:1px solid #ddd; padding:6px;">Status</th>
          </tr>
        </thead>
        <tbody>
  `

  vendorPreviewData.forEach(row => {
    previewHtml += `
      <tr style="background:#fff;">
        <td style="border:1px solid #ddd; padding:6px;">${row.no}</td>
        <td style="border:1px solid #ddd; padding:6px;">${escapeHtml(row.nama_vendor)}</td>
        <td style="border:1px solid #ddd; padding:6px;">${escapeHtml(row.kontak)}</td>
        <td style="border:1px solid #ddd; padding:6px;">
          <span style="color:green;font-weight:bold;">${escapeHtml(row.statusText)}</span>
        </td>
      </tr>
    `
  })

  previewHtml += `
        </tbody>
      </table>
    </div>
  `

  const result = await Swal.fire({
    title: "Preview Import Vendor",
    html: previewHtml,
    width: 1000,
    showCancelButton: true,
    confirmButtonText: "Import Sekarang",
    cancelButtonText: "Batal"
  })

  if (result.isConfirmed) {
    await importPreviewVendor()
  }

  e.target.value = ""
}

async function importPreviewVendor() {
  if (!vendorPreviewData.length) {
    Swal.fire("Error", "Belum ada data preview vendor", "error")
    return
  }

  let successCount = 0
  let skipCount = 0
  let failedCount = 0

  const skippedRows = []
  const failedRows = []

  for (const row of vendorPreviewData) {
    try {
      if (row.nama_vendor) {
        let checkRes = await supabaseClient
          .from("master_vendor")
          .select("id")
          .eq("nama_vendor", row.nama_vendor)
          .maybeSingle()

        if (checkRes.error) {
          checkRes = await supabaseClient
            .from("master_vendor")
            .select("id")
            .eq("nama_vendor", row.nama_vendor)
            .maybeSingle()
        }

        if (checkRes.error) {
          failedCount++
          failedRows.push(`Baris ${row.no}: gagal cek data existing - ${checkRes.error.message}`)
          continue
        }

        if (checkRes.data) {
          skipCount++
          skippedRows.push(`Baris ${row.no}: nama_vendor ${row.nama_vendor} sudah ada`)
          continue
        }
      }

      const companyId = getActiveCompanyId()

      const payload = {
        company_id: companyId,
        nama_vendor: row.nama_vendor || null,
        kontak: formatContactNumber(row.kontak || ""),
        deskripsi: null
      }

      const { error } = await supabaseClient
        .from("master_vendor")
        .insert(payload)

      if (error) {
        failedCount++
        failedRows.push(`Baris ${row.no}: ${error.message}`)
      } else {
        successCount++
      }
    } catch (err) {
      failedCount++
      failedRows.push(`Baris ${row.no}: ${err.message}`)
    }
  }

  let detailHtml = ""

  if (skippedRows.length > 0) {
    detailHtml += `
      <div style="text-align:left; margin-top:10px;">
        <div><b>Data di-skip:</b></div>
        <div style="max-height:120px; overflow:auto; font-size:12px; margin-top:6px;">
          ${skippedRows.map(msg => `<div>- ${escapeHtml(msg)}</div>`).join("")}
        </div>
      </div>
    `
  }

  if (failedRows.length > 0) {
    detailHtml += `
      <div style="text-align:left; margin-top:10px;">
        <div><b>Data gagal:</b></div>
        <div style="max-height:120px; overflow:auto; font-size:12px; margin-top:6px;">
          ${failedRows.map(msg => `<div>- ${escapeHtml(msg)}</div>`).join("")}
        </div>
      </div>
    `
  }

  await Swal.fire({
    title: "Import Vendor selesai",
    html: `
      <div style="text-align:left">
        <div>Berhasil diimport: <b>${successCount}</b> baris</div>
        <div>Di-skip: <b>${skipCount}</b> baris</div>
        <div>Gagal: <b>${failedCount}</b> baris</div>
      </div>
      ${detailHtml}
    `,
    icon: successCount > 0 ? "success" : "info"
  })

  vendorPreviewData = []
  await loadVendor()
}

function triggerUploadVendor() {
  document.getElementById("uploadVendor").click()
}
