let editId = null
let coaPreviewData = []
let saldoNormalInstance = null
let selectedCoaIds = new Set()

const swalCustom = {
  customClass: {
    popup: "rounded-3xl shadow-2xl p-6",
    title: "text-xl font-bold text-slate-800",
    htmlContainer: "text-sm text-slate-600",
    confirmButton: "rounded-2xl bg-red-600 hover:bg-red-700 px-5 py-3 font-semibold text-white",
    cancelButton: "rounded-2xl bg-slate-200 hover:bg-slate-300 px-5 py-3 font-semibold text-slate-700"
  },
  buttonsStyling: false
}

function updateCOADeleteSelectedVisibility() {
  const btn = document.getElementById("coaDeleteSelectedBtn")
  if (!btn) return

  if (selectedCoaIds.size > 0) {
    btn.classList.remove("hidden")
  } else {
    btn.classList.add("hidden")
  }
}

function updateCOABulkCounter() {
  const counter = document.getElementById("coaSelectedCounter")
  if (!counter) return

  if (selectedCoaIds.size > 0) {
    counter.classList.remove("hidden")
    counter.classList.add("inline-flex")
    counter.innerText = `${selectedCoaIds.size} dipilih`
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

function normalizeSaldoNormal(val) {
  if (!val) return ""
  const text = String(val).trim().toLowerCase()

  if (text === "debet" || text === "debit") return "Debet"
  if (text === "kredit") return "Kredit"

  return ""
}

function initMasterCOA() {
  if (!ensureMasterDataAccess()) return
  loadCOA()

  const uploadCOA = document.getElementById("uploadCOA")
  if (uploadCOA) {
    uploadCOA.onchange = handleUploadCOA
  }

  initSaldoNormalSelect()
}

function initSaldoNormalSelect() {
  const el = document.getElementById("saldo_normal")
  if (!el) return

  if (saldoNormalInstance) {
    saldoNormalInstance.destroy()
    saldoNormalInstance = null
  }

  saldoNormalInstance = new TomSelect(el, {
    create: false,
    controlInput: null,
    placeholder: "Pilih Saldo Normal"
  })
}

async function loadCOA() {
  const table = document.getElementById("coaTable")
  if (!table) return

  table.innerHTML = `
    <tr>
      <td colspan="8" class="text-center text-slate-400 py-6">Loading...</td>
    </tr>
  `

  const companyId = localStorage.getItem("activeCompanyId") || ""

  const { data, error } = await supabaseClient
    .from("master_coa")
    .select("*")
    .eq("company_id", companyId)
    .order("kode_akun", { ascending: true })

  if (error) {
    console.error("LOAD COA ERROR:", error)
    table.innerHTML = `
      <tr>
        <td colspan="8" class="text-center text-red-500 py-6">${escapeHtml(error.message)}</td>
      </tr>
    `
    appToast(error.message, "error")
    return
  }

  if (!data || !data.length) {
    table.innerHTML = `
      <tr>
        <td colspan="8" class="text-center text-slate-400 py-6">Belum ada data COA</td>
      </tr>
    `
    return
  }

  let html = ""

  data.forEach((c, index) => {
    html += `
      <tr class="${index % 2 === 0 ? "bg-white" : "bg-slate-50"} hover:bg-blue-50 transition">
        <td class="px-4 py-3 whitespace-nowrap">${escapeHtml(c.kode_akun)}</td>
        <td class="px-4 py-3 whitespace-nowrap">${escapeHtml(c.nama_akun)}</td>
        <td class="px-4 py-3 whitespace-nowrap">${escapeHtml(c.kategori)}</td>
        <td class="px-4 py-3 whitespace-nowrap">${escapeHtml(c.seksi)}</td>
        <td class="px-4 py-3 whitespace-nowrap">${escapeHtml(c.laporan)}</td>
        <td class="px-4 py-3 whitespace-nowrap">${escapeHtml(c.saldo_normal)}</td>
        <td class="px-4 py-3 whitespace-nowrap">
          <div class="flex flex-wrap gap-2">
            ${c.is_lampiran ? '<span class="px-2 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-semibold">Lampiran</span>' : ''}
            ${c.is_penyusutan ? '<span class="px-2 py-1 rounded-full bg-purple-50 text-purple-700 text-xs font-semibold">Penyusutan</span>' : ''}
            ${!c.is_lampiran && !c.is_penyusutan ? '<span class="text-slate-400 text-xs">-</span>' : ''}
          </div>
        </td>
        <td class="px-4 py-3">
          <div class="flex items-center justify-center gap-3">
            <button onclick="editCOA('${c.id}')" class="text-blue-600 hover:text-blue-800" title="Edit">
              <i data-lucide="pencil" class="w-4 h-4"></i>
            </button>
            <button onclick="deleteCOA('${c.id}')" class="text-red-500 hover:text-red-700" title="Hapus">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>
        </td>
        <td class="px-4 py-3 text-center">
          <input type="checkbox" class="coa-row-check" data-id="${c.id}">
        </td>
        
      </tr>
    `
  })

  table.innerHTML = html
  selectedCoaIds.clear()
  updateCOADeleteSelectedVisibility()
  updateCOABulkCounter()

  if (window.lucide) {
    lucide.createIcons()
  }
  bindCOABulkActions()
}

function bindCOABulkActions() {
  const checkAll = document.getElementById("coaCheckAll")
  const selectAllBtn = document.getElementById("coaSelectAllBtn")
  const deleteSelectedBtn = document.getElementById("coaDeleteSelectedBtn")

  document.querySelectorAll(".coa-row-check").forEach(cb => {
    cb.onchange = function () {
      const id = this.getAttribute("data-id")
      if (!id) return

      if (this.checked) {
        selectedCoaIds.add(id)
      } else {
        selectedCoaIds.delete(id)
      }

      syncCOACheckAll()
      updateCOADeleteSelectedVisibility()
      updateCOABulkCounter()
    }
  })

  if (checkAll) {
    checkAll.onchange = function () {
      const checked = !!this.checked
      document.querySelectorAll(".coa-row-check").forEach(cb => {
        cb.checked = checked
        const id = cb.getAttribute("data-id")
        if (!id) return

        if (checked) selectedCoaIds.add(id)
        else selectedCoaIds.delete(id)
      })
      updateCOADeleteSelectedVisibility()
      updateCOABulkCounter()
    }
  }

  if (selectAllBtn) {
    selectAllBtn.onclick = function () {
      const rows = document.querySelectorAll(".coa-row-check")
      const shouldSelectAll = selectedCoaIds.size !== rows.length

      rows.forEach(cb => {
        cb.checked = shouldSelectAll
        const id = cb.getAttribute("data-id")
        if (!id) return

        if (shouldSelectAll) selectedCoaIds.add(id)
        else selectedCoaIds.delete(id)
      })

      syncCOACheckAll()
      updateCOADeleteSelectedVisibility()
      updateCOABulkCounter()  
    }
  }

  if (deleteSelectedBtn) {
    deleteSelectedBtn.onclick = deleteSelectedCOA
  }
}

function syncCOACheckAll() {
  const checkAll = document.getElementById("coaCheckAll")
  const rows = document.querySelectorAll(".coa-row-check")
  if (!checkAll) return

  checkAll.checked = rows.length > 0 && selectedCoaIds.size === rows.length
  updateCOADeleteSelectedVisibility()
  updateCOABulkCounter()
}

async function deleteSelectedCOA() {
  if (!selectedCoaIds.size) {
    appToast("Pilih data COA yang ingin dihapus", "info")
    return
  }

  const result = await Swal.fire({
    ...swalCustom,
    title: "Hapus COA terpilih?",
    html: `
      <div class="text-center">
        <div class="mb-3 text-4xl">⚠️</div>
        <div><b>${selectedCoaIds.size}</b> data COA akan dihapus.</div>
        <div class="mt-2 text-red-600 font-semibold">Tindakan ini tidak bisa dibatalkan.</div>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: "Ya, hapus",
    cancelButtonText: "Batal"
  })

  if (!result.isConfirmed) return

  const { error } = await supabaseClient
    .from("master_coa")
    .delete()
    .in("id", Array.from(selectedCoaIds))

  if (error) {
    appToast(error.message || "Gagal hapus COA", "error")
    return
  }

  selectedCoaIds.clear()
  await loadCOA()
  appToast("COA terpilih berhasil dihapus")
}

async function saveCOA() {
  const companyId = localStorage.getItem("activeCompanyId") || ""
  const kode_akun = document.getElementById("kode_akun").value.trim()
  const nama_akun = document.getElementById("nama_akun").value.trim()
  const kategori = document.getElementById("kategori").value.trim()
  const seksi = document.getElementById("seksi").value.trim()
  const laporan = document.getElementById("laporan").value.trim()
  const saldo_normal = document.getElementById("saldo_normal").value

  if (!companyId) {
    appToast("Company aktif belum dipilih", "error")
    return
  }

  if (!kode_akun || !nama_akun || !kategori || !seksi || !laporan || !saldo_normal) {
    appToast("Semua field COA wajib diisi", "error")
    return
  }

  const payload = {
    company_id: companyId,
    kode_akun,
    nama_akun,
    kategori,
    seksi,
    laporan,
    saldo_normal
  }

  let error = null

  if (editId) {
    const res = await supabaseClient
      .from("master_coa")
      .update({
        kode_akun,
        nama_akun,
        kategori,
        seksi,
        laporan,
        saldo_normal
      })
      .eq("id", editId)

    error = res.error
    editId = null
  } else {
    const res = await supabaseClient
      .from("master_coa")
      .insert(payload)

    error = res.error
  }

  if (error) {
    appToast(error.message, "error")
    return
  }

  resetCOAForm()
  await loadCOA()
  appToast("Data COA berhasil disimpan")
}

async function editCOA(id) {
  const { data, error } = await supabaseClient
    .from("master_coa")
    .select("*")
    .eq("id", id)
    .single()

  if (error) {
    appToast(error.message || "Terjadi kesalahan", "error")
    return
  }

  const { value: formValues } = await Swal.fire({
  ...swalCustom,
  title: "Edit Master COA",
    width: 720,
    html: `
      <div style="text-align:left; margin-top:10px;">
        <div style="display:grid;grid-template-columns:140px 1fr;gap:10px 14px;align-items:center">
          <label style="font-size:14px;font-weight:700;color:#334155;">Kode Akun</label>
          <input
            id="swal_kode_akun"
            class="swal2-input"
            placeholder="Kode Akun"
            value="${escapeHtml(data.kode_akun)}"
            style="margin:0;width:100%;height:44px;border-radius:12px;"
          >

          <label style="font-size:14px;font-weight:700;color:#334155;">Nama Akun</label>
          <input
            id="swal_nama_akun"
            class="swal2-input"
            placeholder="Nama Akun"
            value="${escapeHtml(data.nama_akun)}"
            style="margin:0;width:100%;height:44px;border-radius:12px;"
          >

          <label style="font-size:14px;font-weight:700;color:#334155;">Kategori</label>
          <input
            id="swal_kategori"
            class="swal2-input"
            placeholder="Kategori"
            value="${escapeHtml(data.kategori)}"
            style="margin:0;width:100%;height:44px;border-radius:12px;"
          >

          <label style="font-size:14px;font-weight:700;color:#334155;">Seksi LR / Neraca</label>
          <input
            id="swal_seksi"
            class="swal2-input"
            placeholder="Seksi LR / Neraca"
            value="${escapeHtml(data.seksi)}"
            style="margin:0;width:100%;height:44px;border-radius:12px;"
          >

          <label style="font-size:14px;font-weight:700;color:#334155;">Laporan</label>
          <input
            id="swal_laporan"
            class="swal2-input"
            placeholder="Laporan"
            value="${escapeHtml(data.laporan)}"
            style="margin:0;width:100%;height:44px;border-radius:12px;"
          >
        </div>

        <div style="margin-top:18px;padding:14px 16px;border:1px solid #e2e8f0;border-radius:16px;background:#f8fafc;">
          <div style="font-size:14px;font-weight:700;color:#334155;margin-bottom:10px;">Saldo Normal</div>

          <div style="position:relative;">
            <select
              id="swal_saldo_normal"
              class="swal2-select"
              style="
                margin:0;
                width:100%;
                height:46px;
                border:1px solid #cbd5e1;
                border-radius:12px;
                padding:0 40px 0 14px;
                font-size:14px;
                font-weight:600;
                color:#334155;
                background:#ffffff;
                appearance:none;
                -webkit-appearance:none;
                -moz-appearance:none;
                box-shadow:none;
                outline:none;
              "
            >
              <option value="">Pilih Saldo Normal</option>
              <option value="Debet" ${data.saldo_normal === "Debet" ? "selected" : ""}>Debet</option>
              <option value="Kredit" ${data.saldo_normal === "Kredit" ? "selected" : ""}>Kredit</option>
            </select>

            <div style="
              position:absolute;
              right:14px;
              top:50%;
              transform:translateY(-50%);
              pointer-events:none;
              color:#64748b;
              font-size:14px;
            ">▼</div>
          </div>
        </div>

        <div style="margin-top:14px;padding:14px 16px;border:1px solid #e2e8f0;border-radius:16px;background:#ffffff;">
          <div style="font-size:14px;font-weight:700;color:#334155;margin-bottom:12px;">Status Tambahan</div>

          <div style="display:flex;flex-direction:column;gap:12px;">
            <label for="swal_is_lampiran" style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc;cursor:pointer;">
              <span style="font-size:14px;font-weight:600;color:#334155;">Ada Lampiran</span>
              <span style="position:relative;display:inline-block;width:46px;height:26px;">
                <input
                  type="checkbox"
                  id="swal_is_lampiran"
                  ${data.is_lampiran ? "checked" : ""}
                  style="position:absolute;opacity:0;inset:0;width:46px;height:26px;cursor:pointer;z-index:2;"
                >
                <span id="lampiranSwitch" style="
                  position:absolute;
                  inset:0;
                  background:${data.is_lampiran ? "#2563eb" : "#cbd5e1"};
                  border-radius:999px;
                  transition:all .2s ease;
                ">
                  <span id="lampiranKnob" style="
                    position:absolute;
                    top:3px;
                    left:${data.is_lampiran ? "23px" : "3px"};
                    width:20px;
                    height:20px;
                    background:white;
                    border-radius:999px;
                    transition:all .2s ease;
                    box-shadow:0 1px 4px rgba(0,0,0,.15);
                  "></span>
                </span>
              </span>
            </label>

            <label for="swal_is_penyusutan" style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc;cursor:pointer;">
              <span style="font-size:14px;font-weight:600;color:#334155;">Penyusutan</span>
              <span style="position:relative;display:inline-block;width:46px;height:26px;">
                <input
                  type="checkbox"
                  id="swal_is_penyusutan"
                  ${data.is_penyusutan ? "checked" : ""}
                  style="position:absolute;opacity:0;inset:0;width:46px;height:26px;cursor:pointer;z-index:2;"
                >
                <span id="penyusutanSwitch" style="
                  position:absolute;
                  inset:0;
                  background:${data.is_penyusutan ? "#2563eb" : "#cbd5e1"};
                  border-radius:999px;
                  transition:all .2s ease;
                ">
                  <span id="penyusutanKnob" style="
                    position:absolute;
                    top:3px;
                    left:${data.is_penyusutan ? "23px" : "3px"};
                    width:20px;
                    height:20px;
                    background:white;
                    border-radius:999px;
                    transition:all .2s ease;
                    box-shadow:0 1px 4px rgba(0,0,0,.15);
                  "></span>
                </span>
              </span>
            </label>
          </div>
        </div>
      </div>
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: "Update",
    cancelButtonText: "Batal",
    confirmButtonColor: "#4f46e5",
    cancelButtonColor: "#6b7280",
    didOpen: () => {
      const lampiranInput = document.getElementById("swal_is_lampiran")
      const penyusutanInput = document.getElementById("swal_is_penyusutan")

      const lampiranSwitch = document.getElementById("lampiranSwitch")
      const lampiranKnob = document.getElementById("lampiranKnob")

      const penyusutanSwitch = document.getElementById("penyusutanSwitch")
      const penyusutanKnob = document.getElementById("penyusutanKnob")

      function renderSwitch(inputEl, switchEl, knobEl) {
        const checked = !!inputEl.checked
        switchEl.style.background = checked ? "#2563eb" : "#cbd5e1"
        knobEl.style.left = checked ? "23px" : "3px"
      }

      if (lampiranInput && lampiranSwitch && lampiranKnob) {
        renderSwitch(lampiranInput, lampiranSwitch, lampiranKnob)
        lampiranInput.addEventListener("change", () => {
          renderSwitch(lampiranInput, lampiranSwitch, lampiranKnob)
        })
      }

      if (penyusutanInput && penyusutanSwitch && penyusutanKnob) {
        renderSwitch(penyusutanInput, penyusutanSwitch, penyusutanKnob)
        penyusutanInput.addEventListener("change", () => {
          renderSwitch(penyusutanInput, penyusutanSwitch, penyusutanKnob)
        })
      }
    },
    preConfirm: () => {
      const kode_akun = document.getElementById("swal_kode_akun").value.trim()
      const nama_akun = document.getElementById("swal_nama_akun").value.trim()
      const kategori = document.getElementById("swal_kategori").value.trim()
      const seksi = document.getElementById("swal_seksi").value.trim()
      const laporan = document.getElementById("swal_laporan").value.trim()
      const saldo_normal = document.getElementById("swal_saldo_normal").value

      if (!kode_akun || !nama_akun || !kategori || !seksi || !laporan || !saldo_normal) {
        Swal.showValidationMessage("Semua field wajib diisi")
        return false
      }

      return {
        kode_akun,
        nama_akun,
        kategori,
        seksi,
        laporan,
        saldo_normal,
        is_lampiran: document.getElementById("swal_is_lampiran").checked,
        is_penyusutan: document.getElementById("swal_is_penyusutan").checked
      }
    }
  })

  if (!formValues) return

  const { error: updateError } = await supabaseClient
    .from("master_coa")
    .update(formValues)
    .eq("id", id)

  if (updateError) {
    appToast(updateError.message, "error")
    return
  }

  await loadCOA()
  appToast("Data COA berhasil diupdate")
}

async function deleteCOA(id) {
  const confirm = await Swal.fire({
    ...swalCustom,
    title: "Hapus data?",
    html: `
      <div class="text-center">
        <div class="mb-3 text-4xl">⚠️</div>
        <div>Data COA yang dihapus tidak bisa dikembalikan.</div>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: "Ya, hapus",
    cancelButtonText: "Batal"
  })

  if (!confirm.isConfirmed) return

  const { error } = await supabaseClient
    .from("master_coa")
    .delete()
    .eq("id", id)

  if (error) {
    appToast(error.message, "error")
    return
  }

  await loadCOA()

  if (typeof loadKategoriSidebar === "function") {
    await loadKategoriSidebar()
  }

  appToast("Data COA berhasil dihapus")
}

function resetCOAForm() {
  document.getElementById("kode_akun").value = ""
  document.getElementById("nama_akun").value = ""
  document.getElementById("kategori").value = ""
  document.getElementById("seksi").value = ""
  document.getElementById("laporan").value = ""
  document.getElementById("saldo_normal").value = ""
}

async function handleUploadCOA(e) {
  const file = e.target.files?.[0]
  if (!file) return

  if (typeof XLSX === "undefined") {
    appToast("Library XLSX tidak ditemukan. Pastikan file xlsx.full.min.js sudah dimuat.", "error")
    e.target.value = ""
    return
  }

  appToast("Membaca file Excel...", "info")

  try {
    const data = await file.arrayBuffer()
    const workbook = XLSX.read(data, { type: "array" })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const json = XLSX.utils.sheet_to_json(sheet, { defval: "" })

    if (!json.length) {
      appToast("File Excel kosong", "error")
      e.target.value = ""
      return
    }

    coaPreviewData = json.map((row, index) => {
      const item = {
        no: index + 1,
        kode_akun: String(row["Kode Akun"] || row["kode_akun"] || "").trim(),
        nama_akun: String(row["Nama Akun"] || row["nama_akun"] || "").trim(),
        kategori: String(row["Kategori"] || row["kategori"] || "").trim(),
        seksi: String(row["Seksi LR/Neraca"] || row["seksi"] || "").trim(),
        laporan: String(row["Laporan"] || row["laporan"] || "").trim(),
        saldo_normal: normalizeSaldoNormal(row["Saldo Normal"] || row["saldo_normal"])
      }

      let statusText = "Siap import"

      if (!item.kode_akun) {
        statusText = "Tanpa kode akun, tetap bisa import"
      }

      return {
        ...item,
        valid: true,
        errorText: "",
        statusText
      }
    })

    let previewHtml = `
      <div style="text-align:left; margin-bottom:10px;">
        Total row: <b>${coaPreviewData.length}</b>
      </div>

      <div style="max-height:350px; overflow:auto; border:1px solid #ddd;">
        <table style="width:100%; border-collapse:collapse; font-size:12px;">
          <thead style="position:sticky; top:0; background:#f3f4f6;">
            <tr>
              <th style="border:1px solid #ddd; padding:6px;">No</th>
              <th style="border:1px solid #ddd; padding:6px;">Kode Akun</th>
              <th style="border:1px solid #ddd; padding:6px;">Nama Akun</th>
              <th style="border:1px solid #ddd; padding:6px;">Kategori</th>
              <th style="border:1px solid #ddd; padding:6px;">Seksi LR/Neraca</th>
              <th style="border:1px solid #ddd; padding:6px;">Laporan</th>
              <th style="border:1px solid #ddd; padding:6px;">Saldo Normal</th>
              <th style="border:1px solid #ddd; padding:6px;">Status</th>
            </tr>
          </thead>
          <tbody>
    `

    coaPreviewData.forEach(row => {
      previewHtml += `
        <tr style="background:#fff;">
          <td style="border:1px solid #ddd; padding:6px;">${row.no}</td>
          <td style="border:1px solid #ddd; padding:6px;">${escapeHtml(row.kode_akun)}</td>
          <td style="border:1px solid #ddd; padding:6px;">${escapeHtml(row.nama_akun)}</td>
          <td style="border:1px solid #ddd; padding:6px;">${escapeHtml(row.kategori)}</td>
          <td style="border:1px solid #ddd; padding:6px;">${escapeHtml(row.seksi)}</td>
          <td style="border:1px solid #ddd; padding:6px;">${escapeHtml(row.laporan)}</td>
          <td style="border:1px solid #ddd; padding:6px;">${escapeHtml(row.saldo_normal)}</td>
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
    ...swalCustom,
    title: "Preview Import COA",
      html: previewHtml,
      width: 1200,
      showCancelButton: true,
      confirmButtonText: "Import Sekarang",
      cancelButtonText: "Batal"
    })

    if (result.isConfirmed) {
      await importPreviewCOA()
    }
  } catch (err) {
    console.error("HANDLE UPLOAD COA ERROR:", err)
    appToast("Gagal membaca file Excel: " + err.message, "error")
  } finally {
    e.target.value = ""
  }
}

async function importPreviewCOA() {
  if (!coaPreviewData.length) {
    appToast("Belum ada data preview", "error")
    return
  }

  const companyId = localStorage.getItem("activeCompanyId") || ""

  if (!companyId) {
    appToast("Company aktif belum dipilih", "error")
    return
  }

  Swal.fire({
    ...swalCustom,
    title: "Import data COA",
    html: `
      <div class="flex flex-col items-center gap-3">
        <div class="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
        <div class="text-sm text-slate-600">Mohon tunggu, data sedang diproses...</div>
      </div>
    `,
    showConfirmButton: false,
    allowOutsideClick: false,
    allowEscapeKey: false
  })

  let successCount = 0
  let skipCount = 0
  let failedCount = 0

  const skippedRows = []
  const failedRows = []

  for (const row of coaPreviewData) {
    try {
      if (row.kode_akun) {
        const companyId = localStorage.getItem("activeCompanyId") || ""

        const { data: existing, error: checkError } = await supabaseClient
          .from("master_coa")
          .select("id")
          .eq("company_id", companyId)
          .eq("kode_akun", row.kode_akun)
          .maybeSingle()

        if (checkError) {
          failedCount++
          failedRows.push(`Baris ${row.no}: gagal cek data existing - ${checkError.message}`)
          continue
        }

        if (existing) {
          skipCount++
          skippedRows.push(`Baris ${row.no}: kode_akun ${row.kode_akun} sudah ada`)
          continue
        }
      }

      const payload = {
        company_id: companyId,
        kode_akun: row.kode_akun || null,
        nama_akun: row.nama_akun || null,
        kategori: row.kategori || null,
        seksi: row.seksi || null,
        laporan: row.laporan || null,
        saldo_normal: row.saldo_normal || null
      }

      const { error } = await supabaseClient
        .from("master_coa")
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
    ...swalCustom,
    title: "Import selesai",
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

  coaPreviewData = []
  await loadCOA()
  await loadKategoriSidebar()
}

function triggerUploadCOA() {
  document.getElementById("uploadCOA").click()
}