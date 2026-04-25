(function () {
  const SESSION_KEY = "finance_app_session"
  const REMEMBERED_USERNAME_KEY = "finance_app_remembered_username"
  const REMEMBERED_PASSWORD_KEY = "finance_app_remembered_password"
  const COMPANY_KEY = "finance_app_company"

  function getStorage(rememberMe) {
    return rememberMe ? localStorage : sessionStorage
  }

  function getExistingSession() {
    return localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY)
  }

  function saveSession(user, rememberMe, password) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(user))
    localStorage.removeItem(SESSION_KEY)

    if (rememberMe) {
      localStorage.setItem(REMEMBERED_USERNAME_KEY, user.username || "")
      localStorage.setItem(REMEMBERED_PASSWORD_KEY, password || "")
    } else {
      localStorage.removeItem(REMEMBERED_USERNAME_KEY)
      localStorage.removeItem(REMEMBERED_PASSWORD_KEY)
    }
  }

  function getCurrentSessionUser() {
    const raw = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null

    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  }

  function isMasterRole() {
    return String(getCurrentSessionUser()?.role || "").toLowerCase() === "master"
  }

  function redirectToApp() {
    window.location.href = "index.html"
  }

  function openRegisterOverlay() {
    document.getElementById("registerOverlay")?.classList.remove("hidden")
  }

  function closeRegisterOverlay() {
    document.getElementById("registerOverlay")?.classList.add("hidden")
  }

  async function openCompanyModal() {
    const modal = document.getElementById("companyModal")
    if (!modal) return

    initMasterCompanyActions()
    await loadCompaniesFromDb()

    modal.classList.remove("hidden")
    modal.classList.add("flex")
  }

  function closeCompanyModal() {
    const modal = document.getElementById("companyModal")
    if (!modal) return
    modal.classList.add("hidden")
    modal.classList.remove("flex")
  }

  function preloadRememberedCredentials() {
    const rememberedUsername = localStorage.getItem(REMEMBERED_USERNAME_KEY)
    const rememberedPassword = localStorage.getItem(REMEMBERED_PASSWORD_KEY)

    const usernameEl = document.getElementById("loginUsername")
    const passwordEl = document.getElementById("loginPassword")
    const rememberEl = document.getElementById("rememberMe")

    if (rememberedUsername && usernameEl) {
      usernameEl.value = rememberedUsername
    }

    if (rememberedPassword && passwordEl) {
      passwordEl.value = rememberedPassword
    }

    if ((rememberedUsername || rememberedPassword) && rememberEl) {
      rememberEl.checked = true
    }
  }

  function initPasswordToggle(inputId, buttonId) {
    const input = document.getElementById(inputId)
    const button = document.getElementById(buttonId)

    if (!input || !button) return

    let visible = false

    button.addEventListener("click", function () {
      visible = !visible
      input.type = visible ? "text" : "password"

      button.innerHTML = visible
        ? '<i data-lucide="eye-off" class="w-5 h-5"></i>'
        : '<i data-lucide="eye" class="w-5 h-5"></i>'

      if (window.lucide) {
        lucide.createIcons()
      }
    })
  }
  
  function showLoginLoader() {
    document.getElementById("login-loader")?.classList.add("is-active")
  }

  function hideLoginLoader() {
    document.getElementById("login-loader")?.classList.remove("is-active")
  }  

  async function handleLogin(event) {
    event.preventDefault()

    const username = String(document.getElementById("loginUsername")?.value || "").trim()
    const password = String(document.getElementById("loginPassword")?.value || "").trim()
    const rememberMe = !!document.getElementById("rememberMe")?.checked
    const loginBtn = document.getElementById("loginBtn")

    if (!username || !password) {
      Swal.fire("Error", "Username dan password wajib diisi", "error")
      return
    }

    loginBtn.disabled = true
    loginBtn.innerText = "Memproses..."
    showLoginLoader()

    try {
      const { data, error } = await supabaseClient.rpc("login_app_user", {
        p_username: username,
        p_password: password
      })

      if (error) throw error

      const user = Array.isArray(data) ? data[0] : null

      if (!user) {
        hideLoginLoader()
        Swal.fire("Login gagal", "Username / password salah atau akun belum disetujui", "error")
        return
      }

      saveSession(user, rememberMe, password)
      hideLoginLoader()
      await openCompanyModal()
    } catch (err) {
      console.error("LOGIN ERROR:", err)
      hideLoginLoader()
      Swal.fire("Error", err.message || "Gagal login", "error")
    } finally {
      loginBtn.disabled = false
      loginBtn.innerText = "Login"
    }
  }

  async function handleRegister(event) {
    event.preventDefault()

    const username = String(document.getElementById("registerUsername")?.value || "").trim()
    const password = String(document.getElementById("registerPassword")?.value || "").trim()
    const passwordConfirm = String(document.getElementById("registerPasswordConfirm")?.value || "").trim()
    const registerBtn = document.getElementById("registerBtn")

    if (!username || !password || !passwordConfirm) {
      Swal.fire("Error", "Semua field pendaftaran wajib diisi", "error")
      return
    }

    if (password.length < 4) {
      Swal.fire("Error", "Password minimal 4 karakter", "error")
      return
    }

    if (password !== passwordConfirm) {
      Swal.fire("Error", "Konfirmasi password tidak sama", "error")
      return
    }

    registerBtn.disabled = true
    registerBtn.innerText = "Mengirim..."

    try {
      const { data, error } = await supabaseClient.rpc("register_app_user", {
        p_username: username,
        p_password: password
      })

      if (error) throw error

      await Swal.fire("Berhasil", data || "Pendaftaran berhasil", "success")
      document.getElementById("registerForm")?.reset()
      closeRegisterOverlay()
    } catch (err) {
      console.error("REGISTER ERROR:", err)
      Swal.fire("Error", err.message || "Gagal mendaftar", "error")
    } finally {
      registerBtn.disabled = false
      registerBtn.innerText = "Kirim Pendaftaran"
    }
  }

  function renderCompanyChoices(rows) {
    const listEl = document.getElementById("companyChoiceList")
    if (!listEl) return

    if (!rows.length) {
      listEl.innerHTML = `
        <div class="col-span-full rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center text-slate-500">
          Belum ada perusahaan yang bisa diakses
        </div>
      `
      return
    }

    listEl.innerHTML = rows.map(row => `
      <button
        type="button"
        class="company-choice rounded-3xl border border-slate-200 bg-slate-50 p-6 text-left hover:border-blue-300 hover:bg-blue-50 transition"
        data-company-id="${row.company_id}"
        data-company-name="${row.company_name}"
      >
        <div class="text-lg font-bold text-slate-800">${row.company_name}</div>
        <div class="mt-2 text-sm text-slate-500">${row.company_description || "-"}</div>
      </button>
    `).join("")

    bindCompanyButtons()
  }

  async function loadCompaniesFromDb() {
    const user = getCurrentSessionUser()
    const listEl = document.getElementById("companyChoiceList")
    if (!user?.id || !listEl) return

    listEl.innerHTML = `
      <div class="col-span-full rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center text-slate-500">
        Loading perusahaan...
      </div>
    `

    const { data, error } = await supabaseClient.rpc("app_list_my_companies", {
      p_user_id: user.id
    })

    if (error) {
      console.error("LOAD COMPANIES ERROR:", error)
      listEl.innerHTML = `
        <div class="col-span-full rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-red-500">
          Gagal load perusahaan
        </div>
      `
      return
    }

    renderCompanyChoices(data || [])
  }

  function bindCompanyButtons() {
    document.querySelectorAll("#companyChoiceList .company-choice").forEach(btn => {
      btn.onclick = function () {
        const companyId = this.getAttribute("data-company-id") || ""
        const companyName = this.getAttribute("data-company-name") || ""

        localStorage.setItem("activeCompanyId", companyId)
        localStorage.setItem("activeCompanyName", companyName)
        localStorage.setItem(COMPANY_KEY, companyId)

        closeCompanyModal()
        redirectToApp()
      }
    })
  }

 function initMasterCompanyActions() {
  const wrap = document.getElementById("masterCompanyActions")
  const btnTambah = document.getElementById("btnTambahCompany")
  const btnEdit = document.getElementById("btnEditCompany")

  if (!wrap) return

  wrap.classList.toggle("hidden", !isMasterRole())
  if (!isMasterRole()) return

  if (btnTambah) btnTambah.onclick = openAddCompanyModal
  if (btnEdit) btnEdit.onclick = openManageCompanyModal
}

function companyToast(message, type = "success") {
  const isError = type === "error"

  const old = document.getElementById("companyStatusModal")
  if (old) old.remove()

  const modal = document.createElement("div")
  modal.id = "companyStatusModal"
  modal.className = "fixed inset-0 z-[10020] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm px-4"

  modal.innerHTML = `
    <div class="w-full max-w-sm rounded-3xl bg-white p-7 text-center shadow-2xl border border-slate-200">
      <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ${
        isError ? "bg-red-100 text-red-600" : "bg-emerald-100 text-emerald-600"
      }">
        <div class="text-4xl font-bold">${isError ? "!" : "✓"}</div>
      </div>

      <h3 class="text-xl font-bold ${isError ? "text-red-700" : "text-slate-900"}">
        ${isError ? "Gagal" : "Berhasil"}
      </h3>

      <p class="mt-2 text-sm text-slate-600">
        ${message}
      </p>

      <button
        type="button"
        onclick="document.getElementById('companyStatusModal')?.remove()"
        class="mt-6 w-full rounded-2xl ${
          isError ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"
        } px-5 py-3 font-semibold text-white"
      >
        OK
      </button>
    </div>
  `

  document.body.appendChild(modal)
}

function hideCompanyPickerModal() {
  const modal = document.getElementById("companyModal")
  if (modal) {
    modal.classList.add("hidden")
    modal.classList.remove("flex")
  }
}

function showCompanyPickerModal() {
  const modal = document.getElementById("companyModal")
  if (modal) {
    modal.classList.remove("hidden")
    modal.classList.add("flex")
  }
}

function openAddCompanyModal() {
  document.getElementById("addCompanyCode").value = ""
  document.getElementById("addCompanyName").value = ""
  document.getElementById("addCompanyDesc").value = ""

  hideCompanyPickerModal()
  document.getElementById("addCompanyModal")?.classList.remove("hidden")
}

function closeAddCompanyModal() {
  document.getElementById("addCompanyModal")?.classList.add("hidden")
  showCompanyPickerModal()
}

async function saveNewCompany() {
  const user = getCurrentSessionUser()
  const code = document.getElementById("addCompanyCode")?.value?.trim().toLowerCase() || ""
  const name = document.getElementById("addCompanyName")?.value?.trim() || ""
  const description = document.getElementById("addCompanyDesc")?.value?.trim() || ""

  if (!user?.id) return companyToast("Session user tidak ditemukan", "error")
  if (!code || !name) return companyToast("Kode dan nama company wajib diisi", "error")

  const { data, error } = await supabaseClient.rpc("app_create_company", {
    p_actor_user_id: user.id,
    p_code: code,
    p_name: name,
    p_description: description || null
  })

  if (error) return companyToast(error.message || "Gagal tambah company", "error")

  companyToast(data || "Company berhasil dibuat")

  document.getElementById("addCompanyModal")?.classList.add("hidden")
  showCompanyPickerModal()
  await loadCompaniesFromDb()
}

async function openManageCompanyModal() {
  const user = getCurrentSessionUser()
  const selectEl = document.getElementById("manageCompanyId")
  const modal = document.getElementById("manageCompanyModal")

  if (!user?.id) return companyToast("Session user tidak ditemukan", "error")
  if (!selectEl || !modal) return companyToast("Modal Kelola Company belum ada di login.html", "error")

  const { data, error } = await supabaseClient.rpc("app_list_my_companies", {
    p_user_id: user.id
  })

  if (error) return companyToast(error.message || "Gagal load company", "error")

  const rows = data || []
  if (!rows.length) return companyToast("Belum ada company untuk dikelola", "error")

  selectEl.innerHTML = rows.map(row => `
    <option value="${row.company_id}">
      ${row.company_name} ${row.company_status ? `(${row.company_status})` : ""}
    </option>
  `).join("")

  selectEl.onchange = async function () {
    await fillManagedCompanyDetail(this.value)
  }

  hideCompanyPickerModal()
  modal.classList.remove("hidden")
  await fillManagedCompanyDetail(selectEl.value)
}

function closeManageCompanyModal() {
  document.getElementById("manageCompanyModal")?.classList.add("hidden")
  showCompanyPickerModal()
}

async function fillManagedCompanyDetail(companyId) {
  if (!companyId) return

  const { data, error } = await supabaseClient
    .from("companies")
    .select("id, code, name, description, status")
    .eq("id", companyId)
    .single()

  if (error) return companyToast(error.message || "Gagal ambil detail company", "error")

  document.getElementById("manageCompanyName").value = data?.name || ""
  document.getElementById("manageCompanyDesc").value = data?.description || ""
  document.getElementById("manageCompanyStatus").value = data?.status || "active"
}

async function saveManagedCompany() {
  const user = getCurrentSessionUser()
  const companyId = document.getElementById("manageCompanyId")?.value || ""
  const name = document.getElementById("manageCompanyName")?.value?.trim() || ""
  const description = document.getElementById("manageCompanyDesc")?.value?.trim() || ""
  const status = document.getElementById("manageCompanyStatus")?.value || "active"

  if (!user?.id) return companyToast("Session user tidak ditemukan", "error")
  if (!companyId) return companyToast("Pilih company terlebih dahulu", "error")
  if (!name) return companyToast("Nama company wajib diisi", "error")

  const { data: currentCompany, error: currentCompanyError } = await supabaseClient
    .from("companies")
    .select("code")
    .eq("id", companyId)
    .single()

  if (currentCompanyError) return companyToast(currentCompanyError.message || "Gagal ambil data company", "error")

  const { data, error } = await supabaseClient.rpc("app_update_company", {
    p_actor_user_id: user.id,
    p_company_id: companyId,
    p_code: currentCompany.code,
    p_name: name,
    p_description: description || null,
    p_status: status
  })

  if (error) return companyToast(error.message || "Gagal update company", "error")

  companyToast(data || "Company berhasil diupdate")

  document.getElementById("manageCompanyModal")?.classList.add("hidden")
  showCompanyPickerModal()
  await loadCompaniesFromDb()
}

function deleteManagedCompany() {
  const companyId = document.getElementById("manageCompanyId")?.value || ""
  if (!companyId) return companyToast("Pilih company terlebih dahulu", "error")

  document.getElementById("deleteCompanyConfirmInput").value = ""
  document.getElementById("deleteCompanyModal")?.classList.remove("hidden")
}

function closeDeleteCompanyModal() {
  document.getElementById("deleteCompanyModal")?.classList.add("hidden")
}

async function confirmDeleteManagedCompany() {
  const user = getCurrentSessionUser()
  const companyId = document.getElementById("manageCompanyId")?.value || ""
  const confirmText = document.getElementById("deleteCompanyConfirmInput")?.value?.trim() || ""

  if (!user?.id) return companyToast("Session user tidak ditemukan", "error")
  if (!companyId) return companyToast("Pilih company terlebih dahulu", "error")
  if (confirmText !== "HAPUS PERMANEN") return companyToast("Ketik persis: HAPUS PERMANEN", "error")

  const { data, error } = await supabaseClient.rpc("app_delete_company", {
    p_actor_user_id: user.id,
    p_company_id: companyId,
    p_confirmation_text: "HAPUS PERMANEN"
  })

  if (error) return companyToast(error.message || "Gagal hapus company", "error")

  companyToast(data || "Company berhasil dihapus permanen")

  closeDeleteCompanyModal()
  document.getElementById("manageCompanyModal")?.classList.add("hidden")
  showCompanyPickerModal()
  await loadCompaniesFromDb()
}

window.closeAddCompanyModal = closeAddCompanyModal
window.saveNewCompany = saveNewCompany
window.closeManageCompanyModal = closeManageCompanyModal
window.saveManagedCompany = saveManagedCompany
window.deleteManagedCompany = deleteManagedCompany
window.closeDeleteCompanyModal = closeDeleteCompanyModal
window.confirmDeleteManagedCompany = confirmDeleteManagedCompany

  document.addEventListener("DOMContentLoaded", function () {
    const existingSession = getExistingSession()

    preloadRememberedCredentials()

    document.getElementById("loginForm")?.addEventListener("submit", handleLogin)
    document.getElementById("registerForm")?.addEventListener("submit", handleRegister)

    document.getElementById("openRegisterBtn")?.addEventListener("click", openRegisterOverlay)
    document.getElementById("backToLoginBtn")?.addEventListener("click", closeRegisterOverlay)
    document.getElementById("closeCompanyPickerBtn")?.addEventListener("click", closeCompanyModal)

    initPasswordToggle("loginPassword", "toggleLoginPassword")
    initPasswordToggle("registerPassword", "toggleRegisterPassword")
    initPasswordToggle("registerPasswordConfirm", "toggleRegisterPasswordConfirm")

    if (window.lucide) {
      lucide.createIcons()
    }

    if (existingSession) {
      sessionStorage.removeItem(SESSION_KEY)
      localStorage.removeItem(SESSION_KEY)
      localStorage.removeItem(COMPANY_KEY)
    }
  })

  window.logoutApp = function logoutApp() {
    localStorage.removeItem(SESSION_KEY)
    sessionStorage.removeItem(SESSION_KEY)
    localStorage.removeItem(COMPANY_KEY)
    localStorage.removeItem("activeCompanyId")
    localStorage.removeItem("activeCompanyName")
    window.location.href = "login.html"
  }
})()