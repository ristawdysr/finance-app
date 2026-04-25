let items = []
let coas = []
let vendors = []
let vendorSelectInstance = null
let coaSelectInstance = null
let tipeSelectInstance = null
let editingIndex = null

function ensureCanInputJurnal() {
  const role = String(
    JSON.parse(localStorage.getItem("finance_app_session") || sessionStorage.getItem("finance_app_session") || "null")?.role || ""
  ).toLowerCase()

  if (!["master", "superuser", "editor"].includes(role)) {
    appToast("Role ini tidak boleh input jurnal", "error")
    if (typeof handleMenuClick === "function") {
      handleMenuClick("dashboard")
    }
    return false
  }

  return true
}

function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function formatNumber(num) {
  return "Rp " + new Intl.NumberFormat("id-ID").format(Number(num || 0))
}

function initPrettySelects() {
  if (vendorSelectInstance) {
    vendorSelectInstance.destroy()
    vendorSelectInstance = null
  }

  if (coaSelectInstance) {
    coaSelectInstance.destroy()
    coaSelectInstance = null
  }

  if (tipeSelectInstance) {
    tipeSelectInstance.destroy()
    tipeSelectInstance = null
  }

  const vendorEl = document.getElementById("vendor")
  const coaEl = document.getElementById("coa")
  const tipeEl = document.getElementById("tipe")

  if (vendorEl) {
    vendorSelectInstance = new TomSelect(vendorEl, {
      create: false,
      sortField: { field: "text", direction: "asc" },
      placeholder: "Pilih Vendor"
    })
  }

  if (coaEl) {
    coaSelectInstance = new TomSelect(coaEl, {
      create: false,
      sortField: { field: "text", direction: "asc" },
      placeholder: "Pilih Kode COA",
      searchField: ["text"],
      render: {
        option: function(data, escape) {
          return `<div>${escape(data.text)}</div>`
        },
        item: function(data, escape) {
          const kode = data.$option?.dataset?.kode || data.text?.split("|")[0]?.trim() || data.text || ""
          return `<div>${escape(kode)}</div>`
        }
      },
      onChange: function(value) {
        fillNamaCOA(value)
      }
    })
  }

  if (tipeEl) {
    tipeSelectInstance = new TomSelect(tipeEl, {
      create: false,
      placeholder: "Pilih Tipe"
    })
  }
}

function setSelectValue(instance, elementId, value) {
  if (instance) {
    instance.setValue(String(value || ""))
  } else {
    const el = document.getElementById(elementId)
    if (el) el.value = String(value || "")
  }
}

function fillFormForEdit(item, index) {
  editingIndex = index

  const tanggalEl = document.getElementById("tanggal")
  const namaCoaEl = document.getElementById("nama_coa")
  const nominalEl = document.getElementById("nominal")
  const ketEl = document.getElementById("keterangan")
  const actionBtn = document.getElementById("btnAddItem")

  if (tanggalEl) {
    tanggalEl.value = item.tanggal ? item.tanggal.split("-").reverse().join("/") : ""
  }

  setSelectValue(vendorSelectInstance, "vendor", item.id_vendor || "")
  setSelectValue(coaSelectInstance, "coa", item.coa_id || "")
  setSelectValue(
    tipeSelectInstance,
    "tipe",
    Number(item.debet || 0) > 0 ? "debet" : "kredit"
  )

  if (namaCoaEl) namaCoaEl.value = item.nama_coa || ""
  if (nominalEl) nominalEl.value = formatRupiahInput(Number(item.debet || 0) || Number(item.kredit || 0))
  if (ketEl) ketEl.value = item.keterangan || ""

  if (actionBtn) {
    actionBtn.innerText = "Update Jurnal"
    actionBtn.className = "btn-warning w-full"
  }
}

function resetActionButton() {
  const actionBtn = document.getElementById("btnAddItem")
  if (!actionBtn) return

  actionBtn.innerText = "Tambah ke Jurnal"
  actionBtn.className = "btn-primary w-full"
}

async function initJurnal() {
  if (!ensureCanInputJurnal()) return

  const companyId = localStorage.getItem("activeCompanyId") || ""
  if (!companyId) {
    appToast("Company aktif belum dipilih", "error")
    return
  }

  items = []

  const coaRes = await supabaseClient
    .from("master_coa")
    .select("*")
    .eq("company_id", companyId)
    .order("kode_akun", { ascending: true })

  const vendorRes = await supabaseClient
    .from("master_vendor")
    .select("*")
    .eq("company_id", companyId)
    .order("nama_vendor", { ascending: true })

  if (coaRes.error) {
    console.error("COA error:", coaRes.error)
    appToast(coaRes.error.message || "Gagal load COA", "error")
    return
  }

  if (vendorRes.error) {
    console.error("Vendor error:", vendorRes.error)
    appToast(vendorRes.error.message || "Gagal load vendor", "error")
    return
  }

  coas = coaRes.data || []
  vendors = vendorRes.data || []

  renderVendorOptions()
  renderCOAOptions()
  bindCOAChange()
  render()
  initPrettySelects()
  initNominalFormatter()
  initTanggalPicker()
}

function parseRupiah(value) {
  return Number(String(value || "").replace(/[^\d]/g, "")) || 0
}

function formatRupiahInput(value) {
  const number = parseRupiah(value)
  if (!number) return ""
  return "Rp " + new Intl.NumberFormat("id-ID").format(number)
}

function initNominalFormatter() {
  const nominalEl = document.getElementById("nominal")
  if (!nominalEl) return

  nominalEl.addEventListener("input", function() {
    const cursorAtEnd = this.selectionStart === this.value.length
    this.value = formatRupiahInput(this.value)

    if (cursorAtEnd) {
      const len = this.value.length
      this.setSelectionRange(len, len)
    }
  })

  nominalEl.addEventListener("blur", function() {
    this.value = formatRupiahInput(this.value)
  })
}

function renderVendorOptions() {
  const el = document.getElementById("vendor")
  if (!el) return

  let html = `<option value="">Pilih Vendor</option>`

  vendors.forEach(v => {
    html += `<option value="${String(v.id)}">${escapeHtml(v.nama_vendor || "")}</option>`
  })

  el.innerHTML = html
}

function renderCOAOptions() {
  const el = document.getElementById("coa")
  if (!el) return

  let html = `<option value="">Pilih Kode COA</option>`

  coas.forEach(c => {
    const kode = String(c.kode_akun || "")
    const nama = String(c.nama_akun || "")
    const label = `${kode} | ${nama}`

    html += `
      <option
        value="${c.id}"
        data-kode="${escapeHtml(kode)}"
        data-nama="${escapeHtml(nama)}"
      >
        ${escapeHtml(label)}
      </option>
    `
  })

  el.innerHTML = html
}

function bindCOAChange() {
  const coa = document.getElementById("coa")
  if (!coa) return

  coa.onchange = function () {
    fillNamaCOA(this.value)
  }
}

function fillNamaCOA(coaId) {
  const coa = coas.find(c => String(c.id) === String(coaId))
  document.getElementById("nama_coa").value = coa ? (coa.nama_akun || "") : ""
}

function addItem() {
  const tanggalInput = document.getElementById("tanggal").value.trim()
  const tanggal = toDbDate(tanggalInput)
  const coaId = document.getElementById("coa").value
  const nominal = parseRupiah(document.getElementById("nominal").value)
  const tipe = document.getElementById("tipe").value
  const ket = document.getElementById("keterangan").value.trim()
  const vendorId = String(document.getElementById("vendor").value || "")

  if (!tanggal) {
    appToast("Tanggal wajib diisi", "error")
    return
  }

  if (!coaId || !nominal || nominal <= 0 || !tipe) {
    appToast("Lengkapi Kode COA, Nominal, dan Tipe", "error")
    return
  }

  const coa = coas.find(c => String(c.id) === String(coaId))
  const vendor = vendors.find(v => String(v.id) === vendorId)

  if (!coa) {
    appToast("COA tidak ditemukan", "error")
    return
  }

  const payload = {
    tanggal,
    coa_id: coa.id || null,
    kode_coa: coa.kode_akun || "",
    nama_coa: coa.nama_akun || "",
    id_vendor: vendor?.id || null,
    nama_vendor: vendor?.nama_vendor || "",
    debet: tipe === "debet" ? nominal : 0,
    kredit: tipe === "kredit" ? nominal : 0,
    keterangan: ket
  }

  if (editingIndex !== null) {
    items[editingIndex] = payload

    appToast("Baris jurnal berhasil diupdate")

  } else {
    items.push(payload)
  }

  clearDetailForm()
  render()
}

function fillFormForEdit(item, index) {
  editingIndex = index

  const tanggalEl = document.getElementById("tanggal")
  const namaCoaEl = document.getElementById("nama_coa")
  const nominalEl = document.getElementById("nominal")
  const ketEl = document.getElementById("keterangan")
  const actionBtn = document.getElementById("btnAddItem")

  if (tanggalEl) {
    tanggalEl.value = item.tanggal ? item.tanggal.split("-").reverse().join("/") : ""
  }

  if (vendorSelectInstance) {
    vendorSelectInstance.setValue(String(item.id_vendor || ""))
  }

  if (coaSelectInstance) {
    coaSelectInstance.setValue(String(item.coa_id || ""))
  }

  if (tipeSelectInstance) {
    tipeSelectInstance.setValue(Number(item.debet || 0) > 0 ? "debet" : "kredit")
  }

  if (namaCoaEl) namaCoaEl.value = item.nama_coa || ""
  if (nominalEl) nominalEl.value = formatRupiahInput(Number(item.debet || 0) || Number(item.kredit || 0))
  if (ketEl) ketEl.value = item.keterangan || ""

  if (actionBtn) {
    actionBtn.innerText = "Update Jurnal"
    actionBtn.className = "btn-warning w-full"
  }
}

function editItem(index) {
  const item = items[index]
  if (!item) return
  fillFormForEdit(item, index)
}

async function removeItem(index) {
  const item = items[index]
  if (!item) return

  const confirmDelete = await Swal.fire({
    title: "Hapus baris ini?",
    text: "Data yang dihapus dari daftar belum tersimpan ke database.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Ya, hapus",
    cancelButtonText: "Batal",
    reverseButtons: true,
    confirmButtonColor: "#dc2626",
    cancelButtonColor: "#94a3b8"
  })

  if (!confirmDelete.isConfirmed) return

  items.splice(index, 1)

  if (editingIndex === index) {
    clearDetailForm()
  } else if (editingIndex !== null && editingIndex > index) {
    editingIndex--
  }

  render()

  appToast("Baris jurnal berhasil dihapus")
}

function updateSaveButton(isBalanced, hasItems) {
  const btn = document.getElementById("btnSave")
  if (!btn) return

  const canSave = isBalanced && hasItems
  btn.disabled = !canSave

  if (canSave) {
    btn.className = "btn-success w-full"
  } else {
    btn.className = "btn-success w-full"
  }
}

function initTanggalPicker() {
  const el = document.getElementById("tanggal")
  if (!el || typeof flatpickr === "undefined") return

  flatpickr(el, {
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

function toDbDate(value) {
  if (!value) return null

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value

  const parts = String(value).split("/")
  if (parts.length !== 3) return value

  const [dd, mm, yyyy] = parts
  return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`
}

function clearDetailForm() {
  const namaCoaEl = document.getElementById("nama_coa")
  const nominalEl = document.getElementById("nominal")
  const ketEl = document.getElementById("keterangan")

  if (namaCoaEl) namaCoaEl.value = ""
  if (nominalEl) nominalEl.value = ""
  if (ketEl) ketEl.value = ""

  if (vendorSelectInstance) {
    vendorSelectInstance.clear()
  } else {
    const vendorEl = document.getElementById("vendor")
    if (vendorEl) vendorEl.value = ""
  }

  if (coaSelectInstance) {
    coaSelectInstance.clear()
  } else {
    const coaEl = document.getElementById("coa")
    if (coaEl) coaEl.value = ""
  }

  if (tipeSelectInstance) {
    tipeSelectInstance.clear()
  } else {
    const tipeEl = document.getElementById("tipe")
    if (tipeEl) tipeEl.value = ""
  }

  editingIndex = null
  resetActionButton()
}

function render() {
  const tbody = document.getElementById("tableJurnal")
  let html = ""
  let d = 0
  let k = 0

  items.forEach((i, index) => {
    d += Number(i.debet || 0)
    k += Number(i.kredit || 0)

    html += `
      <tr class="${index % 2 === 0 ? 'bg-white' : 'bg-slate-50'} hover:bg-blue-50 transition">
        <td class="px-4 py-3">${escapeHtml(i.tanggal || "-")}</td>
        <td class="px-4 py-3">${escapeHtml(i.kode_coa)}</td>
        <td class="px-4 py-3">${escapeHtml(i.nama_coa)}</td>
        <td class="px-4 py-3">${escapeHtml(i.nama_vendor)}</td>
        <td class="px-4 py-3">${escapeHtml(i.keterangan)}</td>
        <td class="px-4 py-3 text-right text-green-700 font-medium">${formatNumber(i.debet)}</td>
        <td class="px-4 py-3 text-right text-red-600 font-medium">${formatNumber(i.kredit)}</td>
        <td class="px-4 py-3 text-center">
          <div class="flex items-center justify-center gap-3">
            <button onclick="editItem(${index})"
              class="text-blue-600 hover:text-blue-800"
              title="Edit">
              <i data-lucide="pencil" class="w-4 h-4"></i>
            </button>

            <button onclick="removeItem(${index})"
              class="text-red-500 hover:text-red-700"
              title="Hapus">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>
        </td>
      </tr>
    `
  })

  if (!items.length) {
    html = `
      <tr>
        <td colspan="8" class="text-center text-slate-400 py-6">
          Belum ada data
        </td>
      </tr>
    `
  }

  tbody.innerHTML = html
  if (window.lucide) {
    lucide.createIcons()
  }
  document.getElementById("totalDebet").innerText = formatNumber(d)
  document.getElementById("totalKredit").innerText = formatNumber(k)

  const status = document.getElementById("statusBalance")
  const box = document.getElementById("balanceBox")
  const isBalanced = items.length > 0 && d === k

  if (isBalanced) {
    status.innerText = "BALANCE"
    status.className = "text-2xl font-bold text-green-700"
    box.className = "flex-1 bg-green-50 border border-green-200 rounded-lg p-4"
  } else {
    status.innerText = "TIDAK BALANCE"
    status.className = "text-2xl font-bold text-gray-600"
    box.className = "flex-1 bg-gray-100 border border-gray-300 rounded-lg p-4"
  }

  updateSaveButton(isBalanced, items.length > 0)
}

async function saveJurnal() {
  const companyId = localStorage.getItem("activeCompanyId") || ""

  const d = items.reduce((a, b) => a + Number(b.debet || 0), 0)
  const k = items.reduce((a, b) => a + Number(b.kredit || 0), 0)

  if (!companyId) {
    Swal.fire("Error", "Company aktif belum dipilih", "error")
    return
  }

  if (!items.length) {
    appToast("Belum ada detail jurnal", "error")
    return
  }

  if (d !== k) {
    appToast("Jurnal tidak balance", "error")
    return
  }

  const confirmSave = await Swal.fire({
    title: "Simpan jurnal?",
    text: "Pastikan semua data jurnal sudah benar.",
    icon: "question",
    showCancelButton: true,
    confirmButtonText: "Ya, simpan",
    cancelButtonText: "Tidak",
    reverseButtons: true,
    confirmButtonColor: "#16a34a",
    cancelButtonColor: "#94a3b8"
  })

  if (!confirmSave.isConfirmed) {
    return
  }

  Swal.fire({
    title: "Menyimpan jurnal...",
    text: "Mohon tunggu",
    allowOutsideClick: false,
    allowEscapeKey: false,
    didOpen: () => Swal.showLoading()
  })

  let successCount = 0
  const failedRows = []

  for (const i of items) {
    const { error } = await supabaseClient
      .from("jurnal_detail")
      .insert({
        company_id: companyId,
        jurnal_id: null,
        coa_id: i.coa_id || null,
        nama_coa: i.nama_coa || null,
        kode_coa: i.kode_coa || null,
        keterangan: i.keterangan || null,
        debet: i.debet || 0,
        kredit: i.kredit || 0,
        tanggal: i.tanggal || null,
        nama_vendor: i.nama_vendor || null,
        id_vendor: i.id_vendor || null
      })

    if (error) {
      failedRows.push(error.message)
    } else {
      successCount++
    }
  }

  if (failedRows.length > 0) {
    appToast(failedRows.join(", "), "error")
    return
  }

  items = []
  document.getElementById("tanggal").value = ""
  clearDetailForm()
  render()

  appToast(`${successCount} baris jurnal berhasil disimpan`)
}