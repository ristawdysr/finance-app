let saldoAwalRows = []
let saldoAwalTahunInstance = null

function formatCurrency(num) {
  return "Rp " + new Intl.NumberFormat("id-ID").format(Number(num || 0))
}

function getActiveCompanyId() {
  return localStorage.getItem("activeCompanyId") || ""
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

    Swal.fire("Akses ditolak", "Halaman ini hanya untuk master atau superuser", "error")

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

function parseRupiah(value) {
  return Number(String(value || "").replace(/[^\d]/g, "")) || 0
}

function formatRupiahInput(value) {
  const number = parseRupiah(value)
  if (!number) return ""
  return new Intl.NumberFormat("id-ID").format(number)
}

function getCurrentYearOptions() {
  const currentYear = new Date().getFullYear()
  const years = []

  for (let y = currentYear - 3; y <= currentYear + 3; y++) {
    years.push(y)
  }

  return years
}

function renderSaldoAwalYearOptions() {
  const el = document.getElementById("saldoAwalTahun")
  if (!el) return

  const years = getCurrentYearOptions()
  const selectedYear = localStorage.getItem("saldoAwalTahun") || String(new Date().getFullYear())

  el.innerHTML = years.map(year => `
    <option value="${year}" ${String(year) === String(selectedYear) ? "selected" : ""}>
      ${year}
    </option>
  `).join("")
}

function initSaldoAwalYearSelect() {
  const el = document.getElementById("saldoAwalTahun")
  if (!el) return

  if (saldoAwalTahunInstance) {
    saldoAwalTahunInstance.destroy()
    saldoAwalTahunInstance = null
  }

  saldoAwalTahunInstance = new TomSelect(el, {
    create: false,
    placeholder: "Pilih Tahun",
    onChange: function(value) {
      localStorage.setItem("saldoAwalTahun", value)
      loadSaldoAwal()
    }
  })
}

async function initSaldoAwal() {
  if (!ensureMasterDataAccess()) return
  renderSaldoAwalYearOptions()
  initSaldoAwalYearSelect()
  await loadSaldoAwal()
}

async function loadSaldoAwal() {
  const companyId = getActiveCompanyId()
  const table = document.getElementById("saldoAwalTable")
  if (!table) return

  const tahun = Number(localStorage.getItem("saldoAwalTahun") || new Date().getFullYear())

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

  const { data: coaData, error: coaError } = await supabaseClient
    .from("master_coa")
    .select("id, kode_akun, nama_akun")
    .eq("company_id", companyId)
    .order("kode_akun", { ascending: true })

  if (coaError) {
    console.error("LOAD MASTER COA ERROR:", coaError)
    table.innerHTML = `
      <tr>
        <td colspan="5" class="text-center text-red-500 py-6">Gagal load master COA</td>
      </tr>
    `
    return
  }

  const { data: saldoData, error: saldoError } = await supabaseClient
    .from("master_saldo_awal")
    .select("*")
    .eq("company_id", companyId)
    .eq("tahun", tahun)

  if (saldoError) {
    console.error("LOAD SALDO AWAL ERROR:", saldoError)
    table.innerHTML = `
      <tr>
        <td colspan="5" class="text-center text-red-500 py-6">Gagal load saldo awal</td>
      </tr>
    `
    return
  }

  const saldoMap = {}
  ;(saldoData || []).forEach(row => {
    saldoMap[row.kode_coa] = row
  })

  saldoAwalRows = (coaData || []).map(coa => {
    const saldo = saldoMap[coa.kode_akun] || null

    return {
      coa_id: coa.id,
      kode_coa: coa.kode_akun || "",
      nama_coa: coa.nama_akun || "",
      tahun,
      opening_debit: Number(saldo?.opening_debit || 0),
      opening_kredit: Number(saldo?.opening_kredit || 0),
      existing_id: saldo?.id || null
    }
  })

  renderSaldoAwalTable()
}

function renderSaldoAwalTable() {
  const table = document.getElementById("saldoAwalTable")
  if (!table) return

  if (!saldoAwalRows.length) {
    table.innerHTML = `
      <tr>
        <td colspan="5" class="text-center text-slate-400 py-6">Belum ada data</td>
      </tr>
    `
    return
  }

  let html = ""

  saldoAwalRows.forEach((row, index) => {
    html += `
      <tr class="${index % 2 === 0 ? "bg-white" : "bg-slate-50"} hover:bg-blue-50 transition">
        <td class="px-4 py-3 whitespace-nowrap">${escapeHtml(row.kode_coa)}</td>
        <td class="px-4 py-3">${escapeHtml(row.nama_coa)}</td>
        <td class="px-4 py-3 text-right text-green-700 font-medium whitespace-nowrap">
          ${formatCurrency(row.opening_debit)}
        </td>
        <td class="px-4 py-3 text-right text-red-600 font-medium whitespace-nowrap">
          ${formatCurrency(row.opening_kredit)}
        </td>
        <td class="px-4 py-3 text-center">
          <button onclick="editSaldoAwal(${index})"
            class="icon-action-btn text-blue-600 hover:text-blue-800"
            title="Edit">
            <i data-lucide="pencil" class="w-4 h-4"></i>
            </button>
        </td>
      </tr>
    `
  })

  table.innerHTML = html

  if (window.lucide) {
    lucide.createIcons()
  }
}

async function editSaldoAwal(index) {
  const companyId = getActiveCompanyId()

  if (!companyId) {
    Swal.fire("Error", "Company aktif belum dipilih", "error")
    return
  }
  const row = saldoAwalRows[index]
  if (!row) return

  const { value: formValues } = await Swal.fire({
    title: "Edit Saldo Awal",
    width: 560,
    html: `
      <div style="text-align:left">
        <div style="margin-bottom:10px">
          <label style="display:block;margin-bottom:6px;font-weight:600">Tahun</label>
          <input id="swal_tahun" class="swal2-input" value="${row.tahun}" readonly>
        </div>

        <div style="margin-bottom:10px">
          <label style="display:block;margin-bottom:6px;font-weight:600">Kode COA</label>
          <input id="swal_kode_coa" class="swal2-input" value="${escapeHtml(row.kode_coa)}" readonly>
        </div>

        <div style="margin-bottom:10px">
          <label style="display:block;margin-bottom:6px;font-weight:600">Nama COA</label>
          <input id="swal_nama_coa" class="swal2-input" value="${escapeHtml(row.nama_coa)}" readonly>
        </div>

        <div style="margin-bottom:10px">
          <label style="display:block;margin-bottom:6px;font-weight:600">Opening Debit</label>
          <input id="swal_opening_debit" class="swal2-input" value="${formatRupiahInput(row.opening_debit)}" placeholder="Masukkan opening debit">
        </div>

        <div style="margin-bottom:10px">
          <label style="display:block;margin-bottom:6px;font-weight:600">Opening Kredit</label>
          <input id="swal_opening_kredit" class="swal2-input" value="${formatRupiahInput(row.opening_kredit)}" placeholder="Masukkan opening kredit">
        </div>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: "Simpan",
    cancelButtonText: "Batal",
    didOpen: () => {
      const debitEl = document.getElementById("swal_opening_debit")
      const kreditEl = document.getElementById("swal_opening_kredit")

      if (debitEl) {
        debitEl.addEventListener("input", function() {
          this.value = formatRupiahInput(this.value)
        })
      }

      if (kreditEl) {
        kreditEl.addEventListener("input", function() {
          this.value = formatRupiahInput(this.value)
        })
      }
    },
    preConfirm: () => {
      const opening_debit = parseRupiah(document.getElementById("swal_opening_debit").value)
      const opening_kredit = parseRupiah(document.getElementById("swal_opening_kredit").value)

      if (opening_debit > 0 && opening_kredit > 0) {
        Swal.showValidationMessage("Isi salah satu saja: Opening Debit atau Opening Kredit")
        return false
      }

      return {
        opening_debit,
        opening_kredit
      }
    }
  })

  if (!formValues) return

  const payload = {
    company_id: companyId,
    tahun: row.tahun,
    coa_id: row.coa_id || null,
    kode_coa: row.kode_coa,
    nama_coa: row.nama_coa,
    opening_debit: formValues.opening_debit || 0,
    opening_kredit: formValues.opening_kredit || 0
  }

  let error = null

  if (row.existing_id) {
    const res = await supabaseClient
      .from("master_saldo_awal")
      .update(payload)
      .eq("id", row.existing_id)

    error = res.error
  } else {
    const res = await supabaseClient
      .from("master_saldo_awal")
      .insert(payload)

    error = res.error
  }

  if (error) {
    Swal.fire("Error", error.message, "error")
    return
  }

  const snapshotPayload = {
    company_id: companyId,
    tahun: row.tahun,
    coa_id: row.coa_id || null,
    kode_coa: row.kode_coa,
    nama_coa: row.nama_coa,
    opening_debit: formValues.opening_debit || 0,
    opening_kredit: formValues.opening_kredit || 0
  }

  const { error: snapshotError } = await supabaseClient
    .from("saldo_awal_snapshot")
    .upsert(snapshotPayload, {
      onConflict: "company_id,tahun,coa_id"
    })

  if (snapshotError) {
    Swal.fire("Error", snapshotError.message, "error")
    return
  }

  Swal.fire({
    icon: "success",
    title: "Berhasil",
    text: "Saldo awal berhasil disimpan",
    timer: 1200,
    showConfirmButton: false
  })

  await loadSaldoAwal()
}