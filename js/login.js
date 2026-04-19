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

    try {
      const { data, error } = await supabaseClient.rpc("login_app_user", {
        p_username: username,
        p_password: password
      })

      if (error) throw error

      const user = Array.isArray(data) ? data[0] : null

      if (!user) {
        Swal.fire("Login gagal", "Username / password salah atau akun belum disetujui", "error")
        return
      }

      saveSession(user, rememberMe, password)
      await openCompanyModal()
    } catch (err) {
      console.error("LOGIN ERROR:", err)
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

    if (btnTambah) {
    btnTambah.onclick = async function () {
      const user = getCurrentSessionUser()
      if (!user?.id) {
        Swal.fire("Error", "Session user tidak ditemukan", "error")
        return
      }

      const modal = document.getElementById("companyModal")
      if (modal) {
        modal.classList.add("hidden")
        modal.classList.remove("flex")
      }

      const { value: formValues } = await Swal.fire({
        title: "Tambah Company",
        html: `
          <div style="text-align:left; margin-top:8px;">

            <div style="display:grid; grid-template-columns:140px 1fr; gap:12px; align-items:center; margin-bottom:14px;">
              <label for="swal_company_code" style="font-size:13px; font-weight:600; color:#334155;">
                Kode Company
              </label>
              <input
                id="swal_company_code"
                class="swal2-input"
                style="margin:0; width:100%;"
                placeholder="contoh: indo-kreatif"
              >
            </div>

            <div style="display:grid; grid-template-columns:140px 1fr; gap:12px; align-items:center; margin-bottom:14px;">
              <label for="swal_company_name" style="font-size:13px; font-weight:600; color:#334155;">
                Nama Company
              </label>
              <input
                id="swal_company_name"
                class="swal2-input"
                style="margin:0; width:100%;"
              >
            </div>

            <div style="display:grid; grid-template-columns:140px 1fr; gap:12px; align-items:start;">
              <label for="swal_company_desc" style="font-size:13px; font-weight:600; color:#334155; padding-top:12px;">
                Deskripsi
              </label>
              <textarea
                id="swal_company_desc"
                class="swal2-textarea"
                style="margin:0; width:100%; min-height:120px; resize:vertical;"
              ></textarea>
            </div>

          </div>
        `,
        width: 760,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: "Simpan",
        cancelButtonText: "Batal",
        preConfirm: () => {
          const code = document.getElementById("swal_company_code")?.value?.trim().toLowerCase() || ""
          const name = document.getElementById("swal_company_name")?.value?.trim() || ""
          const description = document.getElementById("swal_company_desc")?.value?.trim() || ""

          if (!code || !name) {
            Swal.showValidationMessage("Kode dan nama company wajib diisi")
            return false
          }

          return { code, name, description }
        }
      })

      if (!formValues) {
        if (modal) {
          modal.classList.remove("hidden")
          modal.classList.add("flex")
        }
        return
      }

      const { data, error } = await supabaseClient.rpc("app_create_company", {
        p_actor_user_id: user.id,
        p_code: formValues.code,
        p_name: formValues.name,
        p_description: formValues.description || null
      })

      if (error) {
        await Swal.fire("Error", error.message || "Gagal tambah company", "error")
        if (modal) {
          modal.classList.remove("hidden")
          modal.classList.add("flex")
        }
        return
      }

      await Swal.fire("Berhasil", data || "Company berhasil dibuat", "success")

      if (modal) {
        modal.classList.remove("hidden")
        modal.classList.add("flex")
      }

      await loadCompaniesFromDb()
    }
  }

  if (btnEdit) {
    btnEdit.onclick = async function () {
      const user = getCurrentSessionUser()
      if (!user?.id) {
        Swal.fire("Error", "Session user tidak ditemukan", "error")
        return
      }

      const modal = document.getElementById("companyModal")
      if (modal) {
        modal.classList.add("hidden")
        modal.classList.remove("flex")
      }

      const { data: companies, error: companyError } = await supabaseClient.rpc("app_list_my_companies", {
        p_user_id: user.id
      })

      if (companyError || !companies?.length) {
        await Swal.fire("Info", "Belum ada company untuk dikelola", "info")
        if (modal) {
          modal.classList.remove("hidden")
          modal.classList.add("flex")
        }
        return
      }

      const companyOptionsHtml = companies.map(row => `
        <option value="${row.company_id}">
          ${row.company_name} ${row.company_status ? `(${row.company_status})` : ""}
        </option>
      `).join("")

      const result = await Swal.fire({
        title: "Kelola Company",
        html: `
          <div style="text-align:left; margin-top:8px;">

            <div style="display:grid; grid-template-columns:140px 1fr; gap:12px; align-items:center; margin-bottom:14px;">
              <label for="swal_edit_company_id" style="font-size:13px; font-weight:600; color:#334155;">
                Pilih Company
              </label>
              <select id="swal_edit_company_id" class="swal2-input" style="margin:0; width:100%;">
                ${companyOptionsHtml}
              </select>
            </div>

            <div style="display:grid; grid-template-columns:140px 1fr; gap:12px; align-items:center; margin-bottom:14px;">
              <label for="swal_edit_company_name" style="font-size:13px; font-weight:600; color:#334155;">
                Nama Company
              </label>
              <input id="swal_edit_company_name" class="swal2-input" style="margin:0; width:100%;">
            </div>

            <div style="display:grid; grid-template-columns:140px 1fr; gap:12px; align-items:start; margin-bottom:14px;">
              <label for="swal_edit_company_desc" style="font-size:13px; font-weight:600; color:#334155; padding-top:12px;">
                Deskripsi
              </label>
              <textarea id="swal_edit_company_desc" class="swal2-textarea" style="margin:0; width:100%; min-height:120px; resize:vertical;"></textarea>
            </div>

            <div style="display:grid; grid-template-columns:140px 1fr; gap:12px; align-items:center;">
              <label for="swal_edit_company_status" style="font-size:13px; font-weight:600; color:#334155;">
                Status
              </label>
              <select id="swal_edit_company_status" class="swal2-input" style="margin:0; width:100%;">
                <option value="active">active</option>
                <option value="inactive">inactive</option>
              </select>
            </div>

          </div>
        `,
        width: 760,
        showDenyButton: true,
        showCancelButton: true,
        confirmButtonText: "Simpan Perubahan",
        denyButtonText: "Hapus Company",
        denyButtonColor: "#dc2626",
        cancelButtonText: "Tutup",
        didOpen: async () => {
          const selectEl = document.getElementById("swal_edit_company_id")
          const nameEl = document.getElementById("swal_edit_company_name")
          const descEl = document.getElementById("swal_edit_company_desc")
          const statusEl = document.getElementById("swal_edit_company_status")

          async function fillCompanyDetail(companyId) {
            const { data, error } = await supabaseClient
              .from("companies")
              .select("id, code, name, description, status")
              .eq("id", companyId)
              .single()

            if (error) return

            if (nameEl) nameEl.value = data?.name || ""
            if (descEl) descEl.value = data?.description || ""
            if (statusEl) statusEl.value = data?.status || "active"
          }

          if (selectEl) {
            await fillCompanyDetail(selectEl.value)
            selectEl.onchange = async function () {
              await fillCompanyDetail(this.value)
            }
          }
        },
        preConfirm: () => {
          const companyId = document.getElementById("swal_edit_company_id")?.value || ""
          const name = document.getElementById("swal_edit_company_name")?.value?.trim() || ""
          const description = document.getElementById("swal_edit_company_desc")?.value?.trim() || ""
          const status = document.getElementById("swal_edit_company_status")?.value || "active"

          if (!companyId) {
            Swal.showValidationMessage("Pilih company terlebih dahulu")
            return false
          }

          if (!name) {
            Swal.showValidationMessage("Nama company wajib diisi")
            return false
          }

          return { companyId, name, description, status }
        }
      })

      if (result.isConfirmed) {
        const formValues = result.value

        const { data: currentCompany, error: currentCompanyError } = await supabaseClient
          .from("companies")
          .select("code")
          .eq("id", formValues.companyId)
          .single()

        if (currentCompanyError) {
          await Swal.fire("Error", currentCompanyError.message || "Gagal mengambil data company", "error")
        } else {
          const { data, error } = await supabaseClient.rpc("app_update_company", {
            p_actor_user_id: user.id,
            p_company_id: formValues.companyId,
            p_code: currentCompany.code,
            p_name: formValues.name,
            p_description: formValues.description || null,
            p_status: formValues.status
          })

          if (error) {
            await Swal.fire("Error", error.message || "Gagal update company", "error")
          } else {
            await Swal.fire("Berhasil", data || "Company berhasil diupdate", "success")
          }
        }
      }

      if (result.isDenied) {
        const deleteResult = await Swal.fire({
          title: "Hapus Company",
          html: `
            <div style="text-align:left;">
              <div style="display:grid; grid-template-columns:140px 1fr; gap:12px; align-items:center; margin-bottom:14px;">
                <label for="swal_delete_company_id" style="font-size:13px; font-weight:600; color:#334155;">
                  Pilih Company
                </label>
                <select id="swal_delete_company_id" class="swal2-input" style="margin:0; width:100%;">
                  ${companyOptionsHtml}
                </select>
              </div>

              <div style="padding:12px 14px; border:1px solid #fecaca; background:#fef2f2; border-radius:12px; color:#991b1b; font-size:13px; margin-bottom:14px;">
                Semua data yang berkaitan dengan company ini akan ikut terhapus permanen.
              </div>

              <div style="display:grid; grid-template-columns:140px 1fr; gap:12px; align-items:center;">
                <label for="swal_delete_confirm" style="font-size:13px; font-weight:600; color:#991b1b;">
                  Ketik Konfirmasi
                </label>
                <input
                  id="swal_delete_confirm"
                  class="swal2-input"
                  style="margin:0; width:100%;"
                  placeholder="HAPUS PERMANEN"
                >
              </div>
            </div>
          `,
          width: 760,
          icon: "warning",
          showCancelButton: true,
          confirmButtonText: "Hapus Permanen",
          confirmButtonColor: "#dc2626",
          cancelButtonText: "Batal",
          preConfirm: () => {
            const companyId = document.getElementById("swal_delete_company_id")?.value || ""
            const confirmText = document.getElementById("swal_delete_confirm")?.value?.trim() || ""

            if (!companyId) {
              Swal.showValidationMessage("Pilih company terlebih dahulu")
              return false
            }

            if (confirmText !== "HAPUS PERMANEN") {
              Swal.showValidationMessage("Ketik persis: HAPUS PERMANEN")
              return false
            }

            return { companyId, confirmText }
          }
        })

        if (deleteResult.isConfirmed) {
          const { data, error } = await supabaseClient.rpc("app_delete_company", {
            p_actor_user_id: user.id,
            p_company_id: deleteResult.value.companyId,
            p_confirmation_text: deleteResult.value.confirmText
          })

          if (error) {
            await Swal.fire("Error", error.message || "Gagal hapus company", "error")
          } else {
            await Swal.fire("Berhasil", data || "Company berhasil dihapus permanen", "success")
          }
        }
      }

      if (modal) {
        modal.classList.remove("hidden")
        modal.classList.add("flex")
      }

      await loadCompaniesFromDb()
    }
  }
  }

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