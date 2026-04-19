(function checkAppSession() {
  const appRoot = document.getElementById("appRoot")
  const localSession = localStorage.getItem("finance_app_session")
  const sessionOnly = sessionStorage.getItem("finance_app_session")
  const userSession = localSession || sessionOnly
  const selectedCompany = localStorage.getItem("finance_app_company")

  if (!userSession) {
    window.location.replace("login.html")
    return
  }

  if (!selectedCompany) {
    window.location.replace("login.html")
    return
  }

  try {
    window.currentUser = JSON.parse(userSession)
    window.selectedCompany = selectedCompany

    if (appRoot) {
      appRoot.classList.remove("hidden")
    }
  } catch (err) {
    localStorage.removeItem("finance_app_session")
    sessionStorage.removeItem("finance_app_session")
    localStorage.removeItem("finance_app_company")
    window.location.replace("login.html")
  }
})()

let notificationRows = []
let notificationFilter = "all"
let notificationSearch = ""

function formatNotificationTime(value) {
  if (!value) return "-"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleString("id-ID")
}

function getActiveCompanyName() {
  return (
    localStorage.getItem("activeCompanyName") ||
    sessionStorage.getItem("activeCompanyName") ||
    "Nama Perusahaan"
  )
}

function updateAppBrand() {
  const companyName = getActiveCompanyName()

  const brandEl = document.getElementById("appBrandName")
  if (brandEl) {
    brandEl.innerText = companyName
  }

  document.title = `${companyName} - Finance App`
}

function getNotificationTarget(notification) {
  const type = String(notification?.type || "").toLowerCase()
  const title = String(notification?.title || "").toLowerCase()
  const message = String(notification?.message || "").toLowerCase()

  if (
    type.includes("user_registration") ||
    title.includes("pendaftaran user") ||
    message.includes("menunggu approval")
  ) {
    return { page: "manage-akun" }
  }

  if (
    type.includes("pph21") ||
    title.includes("pph 21") ||
    message.includes("pph 21")
  ) {
    return {
      page: "menu-kategori",
      targetName: "Hutang Pph 21"
    }
  }

  if (
    type.includes("pph23") ||
    title.includes("pph 23") ||
    message.includes("pph 23")
  ) {
    return {
      page: "menu-kategori",
      targetName: "Hutang Pph 23"
    }
  }

  if (
    type.includes("lampiran") ||
    title.includes("lampiran") ||
    message.includes("lampiran")
  ) {
    return {
      page: "menu-kategori",
      targetName: "Hutang Pph 23"
    }
  }

  return null
}

async function markNotificationAsRead(notificationId) {
  const row = notificationRows.find(x => String(x.id) === String(notificationId))
  if (!row || row.is_read) return

  const { error } = await supabaseClient
    .from("app_notifications")
    .update({ is_read: true })
    .eq("id", notificationId)

  if (!error) {
    row.is_read = true
  }
}

async function toggleNotificationStar(notificationId) {
  const row = notificationRows.find(x => String(x.id) === String(notificationId))
  if (!row) return

  const nextValue = !row.is_starred

  const { error } = await supabaseClient
    .from("app_notifications")
    .update({ is_starred: nextValue })
    .eq("id", notificationId)

  if (error) {
    Swal.fire("Error", error.message || "Gagal update favorit", "error")
    return
  }

  row.is_starred = nextValue
  renderNotificationDrawerList()
}

function filterNotificationRows() {
  let rows = [...notificationRows]

  if (notificationFilter === "unread") {
    rows = rows.filter(row => !row.is_read)
  }

  if (notificationFilter === "starred") {
    rows = rows.filter(row => !!row.is_starred)
  }

  if (notificationSearch) {
    const q = notificationSearch.toLowerCase()
    rows = rows.filter(row => {
      const title = String(row.title || "").toLowerCase()
      const message = String(row.message || "").toLowerCase()
      return title.includes(q) || message.includes(q)
    })
  }

  return rows
}

function renderNotificationDrawerList() {
  const listEl = document.getElementById("notifDrawerList")
  if (!listEl) return

  const rows = filterNotificationRows()

  if (!rows.length) {
    listEl.innerHTML = `<div class="notif-empty">Tidak ada notifikasi</div>`
    return
  }

  listEl.innerHTML = rows.map(row => {
    const isRead = !!row.is_read
    const isStarred = !!row.is_starred
    const target = getNotificationTarget(row)

    return `
      <div class="notif-item ${isRead ? "is-read" : "is-unread"}">
        <div class="notif-item-top">
          <div class="notif-item-main" onclick="handleNotificationOpen('${row.id}')">
            <div class="notif-item-title">${escapeHtml(row.title || "-")}</div>
            <div class="notif-item-message">${escapeHtml(row.message || "-")}</div>
            <div class="notif-item-time">${escapeHtml(formatNotificationTime(row.created_at))}</div>
          </div>

          <div class="notif-item-actions">
            <button
              type="button"
              class="notif-star-btn ${isStarred ? "is-starred" : ""}"
              onclick="event.stopPropagation(); handleNotificationStar('${row.id}')"
              title="Favorit"
            >★</button>
            <span class="notif-dot"></span>
          </div>
        </div>

        <div class="notif-item-footer">
          ${
            target
              ? `<button
                  type="button"
                  class="notif-action-btn primary"
                  onclick="handleNotificationOpen('${row.id}')"
                >${isRead ? "Buka Lagi" : "Buka"}</button>`
              : ""
          }

          ${
            !isRead
              ? `<button
                  type="button"
                  class="notif-action-btn"
                  onclick="handleNotificationReadOnly('${row.id}')"
                >Tandai dibaca</button>`
              : ""
          }
        </div>
      </div>
    `
  }).join("")
}

function openNotificationDrawer() {
  const drawer = document.getElementById("notifDrawer")
  const overlay = document.getElementById("notifDrawerOverlay")
  if (drawer) drawer.classList.remove("hidden")
  if (overlay) overlay.classList.remove("hidden")
}

function closeNotificationDrawer() {
  const drawer = document.getElementById("notifDrawer")
  const overlay = document.getElementById("notifDrawerOverlay")
  if (drawer) drawer.classList.add("hidden")
  if (overlay) overlay.classList.add("hidden")
}

async function goToNotificationTarget(notification) {
  const target = getNotificationTarget(notification)
  if (!target) return

  if (target.page === "manage-akun") {
    await loadPage("manage-akun")
    return
  }

  if (target.page === "menu-kategori") {
    const companyId = getActiveCompanyId()
    if (!companyId) return

    const { data, error } = await supabaseClient
      .from("master_coa")
      .select("kode_akun, nama_akun, kategori")
      .eq("company_id", companyId)
      .ilike("nama_akun", target.targetName)
      .limit(1)
      .maybeSingle()

    if (error || !data) {
      Swal.fire("Info", `Akun ${target.targetName} tidak ditemukan`, "info")
      return
    }

    localStorage.setItem("menuKodeCOA", data.kode_akun || "")
    localStorage.setItem("menuLabel", data.nama_akun || "")
    localStorage.setItem("menuKategori", data.kategori || "")
    localStorage.setItem("activeKategoriSubmenuId", "")

    await loadPage("menu-kategori")
  }
}

window.handleNotificationStar = async function(notificationId) {
  await toggleNotificationStar(notificationId)
  await loadNotificationCount()
}

window.handleNotificationReadOnly = async function(notificationId) {
  await markNotificationAsRead(notificationId)
  renderNotificationDrawerList()
  await loadNotificationCount()
}

window.handleNotificationOpen = async function(notificationId) {
  const row = notificationRows.find(x => String(x.id) === String(notificationId))
  if (!row) return

  await markNotificationAsRead(notificationId)
  renderNotificationDrawerList()
  await loadNotificationCount()
  closeNotificationDrawer()
  await goToNotificationTarget(row)
}

function getSessionUser() {
  const raw =
    localStorage.getItem("finance_app_session") ||
    sessionStorage.getItem("finance_app_session")

  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function getUserRole() {
  return String(getSessionUser()?.role || "").toLowerCase()
}

function isMaster() {
  return getUserRole() === "master"
}

function isSuperuser() {
  return getUserRole() === "superuser"
}

function isEditor() {
  return getUserRole() === "editor"
}

function isViewer() {
  return getUserRole() === "viewer"
}

function canManageUsers() {
  return isMaster() || isSuperuser()
}

function canManageCompanies() {
  return isMaster()
}

function canSeeBell() {
  return isMaster() || isSuperuser()
}

function canInputJurnal() {
  return isMaster() || isSuperuser() || isEditor()
}

function canAccessMasterData() {
  return isMaster() || isSuperuser()
}

function canDeleteSavedData() {
  return isMaster() || isSuperuser()
}

function getActiveCompanyId() {
  return localStorage.getItem("activeCompanyId") || ""
}

async function renderCompanyChoicesInApp() {
  const user = getSessionUser()
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
    console.error("LOAD COMPANIES APP ERROR:", error)
    listEl.innerHTML = `
      <div class="col-span-full rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-red-500">
        Gagal load perusahaan
      </div>
    `
    return
  }

  const rows = data || []

  if (!rows.length) {
    listEl.innerHTML = `
      <div class="col-span-full rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center text-slate-500">
        Belum ada perusahaan
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

  bindAppCompanyButtons()
}

async function loadNotificationCount() {
  if (!canSeeBell()) return

  const session = getSessionUser()
  const companyId = getActiveCompanyId()

  const badge = document.getElementById("notificationBadge")
  const mobileBadge = document.getElementById("mobileNotificationBadge")
  const bellBtn = document.getElementById("notificationBellBtn")
  const mobileBellBtn = document.getElementById("mobileNotificationBellBtn")

  if (!session?.id) return

  if (bellBtn) bellBtn.classList.remove("hidden")
  if (mobileBellBtn) mobileBellBtn.classList.remove("hidden")

  let query = supabaseClient
    .from("app_notifications")
    .select("*", { count: "exact", head: true })
    .eq("is_read", false)
    .eq("target_role", session.role)

  if (companyId) {
    query = query.or(`company_id.is.null,company_id.eq.${companyId}`)
  } else {
    query = query.is("company_id", null)
  }

  const { count, error } = await query

  if (error) {
    console.error("LOAD NOTIFICATION COUNT ERROR:", error)
    return
  }

  const finalCount = count || 0

  if (badge) {
    if (finalCount > 0) {
      badge.classList.remove("hidden")
      badge.innerText = finalCount > 99 ? "99+" : String(finalCount)
    } else {
      badge.classList.add("hidden")
      badge.innerText = "0"
    }
  }

  if (mobileBadge) {
    if (finalCount > 0) {
      mobileBadge.classList.remove("hidden")
      mobileBadge.innerText = finalCount > 99 ? "99+" : String(finalCount)
    } else {
      mobileBadge.classList.add("hidden")
      mobileBadge.innerText = "0"
    }
  }

  if (window.lucide) {
    lucide.createIcons()
  }
}

async function logoutApp() {
  closeUserDropdowns()
  const result = await Swal.fire({
    title: "Logout sekarang?",
    text: "Kamu akan keluar dari aplikasi.",
    icon: "question",
    showCancelButton: true,
    confirmButtonText: "Ya, logout",
    cancelButtonText: "Batal",
    reverseButtons: true,
    confirmButtonColor: "#dc2626",
    cancelButtonColor: "#94a3b8"
  })

  if (!result.isConfirmed) return

  localStorage.removeItem("finance_app_session")
  sessionStorage.removeItem("finance_app_session")
  localStorage.removeItem("finance_app_company")
  localStorage.removeItem("activeCompanyId")
  localStorage.removeItem("activeCompanyName")
  localStorage.removeItem("lastPage")

  window.location.href = "login.html"
}

function getInitials(name) {
  const text = String(name || "").trim()
  if (!text) return "A"

  const parts = text.split(/\s+/).filter(Boolean)
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase()

  return (parts[0][0] + parts[1][0]).toUpperCase()
}

function closeUserDropdowns() {
  const desktopDropdown = document.getElementById("sidebarUserDropdown")
  const mobileDropdown = document.getElementById("mobileSidebarUserDropdown")

  if (desktopDropdown) desktopDropdown.classList.add("hidden")
  if (mobileDropdown) mobileDropdown.classList.add("hidden")
}

function initSidebarUserPanel() {
  const user = getSessionUser()
  if (!user) return

  const name = user.username || user.full_name || "Akun"
  const role = user.role || "-"
  const initials = getInitials(name)

  const desktopName = document.getElementById("sidebarUserName")
  const desktopRole = document.getElementById("sidebarUserRole")
  const desktopAvatar = document.getElementById("sidebarUserAvatar")

  const mobileName = document.getElementById("mobileSidebarUserName")
  const mobileRole = document.getElementById("mobileSidebarUserRole")
  const mobileAvatar = document.getElementById("mobileSidebarUserAvatar")

  if (desktopName) desktopName.innerText = name
  if (desktopRole) desktopRole.innerText = role
  if (desktopAvatar) desktopAvatar.innerText = initials

  if (mobileName) mobileName.innerText = name
  if (mobileRole) mobileRole.innerText = role
  if (mobileAvatar) mobileAvatar.innerText = initials

  const manageBtn = document.getElementById("sidebarManageAkunBtn")
  const mobileManageBtn = document.getElementById("mobileSidebarManageAkunBtn")
  const bellBtn = document.getElementById("notificationBellBtn")
  const mobileBellBtn = document.getElementById("mobileNotificationBellBtn")

  if (manageBtn) manageBtn.classList.toggle("hidden", !canManageUsers())
  if (mobileManageBtn) mobileManageBtn.classList.toggle("hidden", !canManageUsers())

  if (bellBtn) bellBtn.classList.toggle("hidden", !canSeeBell())
  if (mobileBellBtn) mobileBellBtn.classList.toggle("hidden", !canSeeBell())

  const desktopUserButton = document.getElementById("sidebarUserButton")
  const desktopDropdown = document.getElementById("sidebarUserDropdown")
  const mobileUserButton = document.getElementById("mobileSidebarUserButton")
  const mobileDropdown = document.getElementById("mobileSidebarUserDropdown")

  if (desktopUserButton && desktopDropdown) {
    desktopUserButton.onclick = function () {
      desktopDropdown.classList.toggle("hidden")
    }
  }

  if (mobileUserButton && mobileDropdown) {
    mobileUserButton.onclick = function () {
      mobileDropdown.classList.toggle("hidden")
    }
  }
}

function initMasterCompanyActionsInApp() {
  const user = getSessionUser()
  const wrap = document.getElementById("masterCompanyActions")
  const btnTambah = document.getElementById("btnTambahCompany")
  const btnEdit = document.getElementById("btnEditCompany")

  if (!wrap) return

  const isMasterUser = String(user?.role || "").toLowerCase() === "master"
  wrap.classList.toggle("hidden", !isMasterUser)

  if (!isMasterUser) return

  if (btnTambah) {
    btnTambah.onclick = async function () {
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
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: "Simpan",
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

      await renderCompanyChoicesInApp()
      await loadNotificationCount()
    }
  }

  if (btnEdit) {
    btnEdit.onclick = async function () {
      const modal = document.getElementById("companyModal")
      if (modal) {
        modal.classList.add("hidden")
        modal.classList.remove("flex")
      }

      const companyOptionsHtml = await getCompanyOptionsHtml()

      if (!companyOptionsHtml) {
        await Swal.fire("Info", "Belum ada company untuk dikelola", "info")
        if (modal) {
          modal.classList.remove("hidden")
          modal.classList.add("flex")
        }
        return
      }

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
            if (!companyId) return

            const { data, error } = await supabaseClient
              .from("companies")
              .select("id, code, name, description, status")
              .eq("id", companyId)
              .single()

            if (error) {
              console.error("LOAD COMPANY DETAIL ERROR:", error)
              return
            }

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
        const deleteOptionsHtml = await getCompanyOptionsHtml()

        const deleteResult = await Swal.fire({
          title: "Hapus Company",
          html: `
            <div style="text-align:left;">

              <div style="display:grid; grid-template-columns:140px 1fr; gap:12px; align-items:center; margin-bottom:14px;">
                <label for="swal_delete_company_id" style="font-size:13px; font-weight:600; color:#334155;">
                  Pilih Company
                </label>
                <select id="swal_delete_company_id" class="swal2-input" style="margin:0; width:100%;">
                  ${deleteOptionsHtml}
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

      await renderCompanyChoicesInApp()
      await loadNotificationCount()
    }
  }
}

async function getCompanyOptionsHtml() {
  const user = getSessionUser()
  if (!user?.id) return ""

  const { data, error } = await supabaseClient.rpc("app_list_my_companies", {
    p_user_id: user.id
  })

  if (error) {
    console.error("GET COMPANY OPTIONS ERROR:", error)
    return ""
  }

  return (data || []).map(row => `
    <option value="${row.company_id}">
      ${row.company_name} ${row.company_status ? `(${row.company_status})` : ""}
    </option>
  `).join("")
}

async function openCompanyPickerAgain() {
  closeUserDropdowns()
  localStorage.removeItem("finance_app_company")
  localStorage.removeItem("activeCompanyId")
  localStorage.removeItem("activeCompanyName")

  const picker = document.getElementById("companyModal")
  if (!picker) return

  await renderCompanyChoicesInApp()
  initMasterCompanyActionsInApp()

  picker.classList.remove("hidden")
  picker.classList.add("flex")

  const desktopDropdown = document.getElementById("sidebarUserDropdown")
  const mobileDropdown = document.getElementById("mobileSidebarUserDropdown")

  if (desktopDropdown) desktopDropdown.classList.add("hidden")
  if (mobileDropdown) mobileDropdown.classList.add("hidden")
}

function initCompanyPickerClose() {
  const btn = document.getElementById("closeCompanyPickerBtn")
  const modal = document.getElementById("companyModal")

  if (!btn || !modal) return

  btn.onclick = () => {
    modal.classList.add("hidden")
    modal.classList.remove("flex")
  }
}


function openChangePasswordModal() {
  closeUserDropdowns()
  const modal = document.getElementById("changePasswordModal")
  if (modal) modal.classList.remove("hidden")
}

function closeChangePasswordModal() {
  const modal = document.getElementById("changePasswordModal")
  if (modal) modal.classList.add("hidden")
}

async function submitChangePassword(event) {
  event.preventDefault()

  const user = getSessionUser()
  const newPassword = document.getElementById("changePasswordInput")?.value?.trim() || ""

  if (!user?.id) {
    Swal.fire("Error", "Session user tidak ditemukan", "error")
    return
  }

  if (newPassword.length < 6) {
    Swal.fire("Error", "Password minimal 6 karakter", "error")
    return
  }

  const { data, error } = await supabaseClient.rpc("change_my_password", {
    p_user_id: user.id,
    p_new_password: newPassword
  })

  if (error) {
    Swal.fire("Error", error.message || "Gagal ganti password", "error")
    return
  }

  Swal.fire("Berhasil", data || "Password berhasil diganti", "success")
  document.getElementById("changePasswordForm")?.reset()
  closeChangePasswordModal()
}

const pageInitMap = {
  dashboard: "initDashboard",
  jurnal: "initJurnal",
  "general-ledger": "initGeneralLedger",
  "master-coa": "initMasterCOA",
  "master-vendor": "initMasterVendor",
  "menu-kategori": "initMenuKategori",
  "saldo-awal": "initSaldoAwal",
  "neraca-bulanan": "initNeracaBulanan",
  "laba-rugi-bulanan": "initLabaRugiBulanan",
  "laba-rugi-tahunan": "initLabaRugiTahunan",
  "neraca-tahunan": "initNeracaTahunan",
  "akm-penyusutan": "initAkmPenyusutan",
  "akm-penyusutan-inventaris": "initAkmPenyusutanInventaris",
  "akm-penyusutan-kendaraan": "initAkmPenyusutanKendaraan",
  "manage-akun": "initManageAkun"
}

const pageHtmlCache = new Map()
let currentLoadToken = 0

function appendDebugLog(message) {
  const el = document.getElementById("debug-log")
  if (!el) return

  el.classList.remove("hidden")

  const time = new Date().toLocaleTimeString("id-ID")
  el.textContent += `[${time}] ${message}\n`
}

window.addEventListener("error", function(event) {
  appendDebugLog(`ERROR: ${event.message} @ ${event.filename || "unknown"}:${event.lineno || 0}`)
})

window.addEventListener("unhandledrejection", function(event) {
  const reason = event.reason?.message || String(event.reason || "Unknown promise rejection")
  appendDebugLog(`PROMISE ERROR: ${reason}`)
})

function buildStaticSidebarMenu(isMobile = false) {
  const canJurnal = canInputJurnal()
  const canMaster = canAccessMasterData()
  const canUsers = canManageUsers()

  return `
    <ul class="space-y-1">
      <li class="menu" data-page="dashboard" onclick="handleMenuClick('dashboard', this)">Dashboard</li>
      ${canJurnal ? `<li class="menu" data-page="jurnal" onclick="handleMenuClick('jurnal', this)">Jurnal</li>` : ""}
      <li class="menu" data-page="general-ledger" onclick="handleMenuClick('general-ledger', this)">General Ledger</li>
    </ul>

    <div class="sidebar-section-title mt-4">Laporan</div>
    <ul class="space-y-1">
      <li class="menu" data-page="neraca-bulanan" onclick="handleMenuClick('neraca-bulanan', this)">Neraca Bulanan</li>
      <li class="menu" data-page="laba-rugi-bulanan" onclick="handleMenuClick('laba-rugi-bulanan', this)">Laba Rugi Bulanan</li>
      <li class="menu" data-page="laba-rugi-tahunan" onclick="handleMenuClick('laba-rugi-tahunan', this)">Laba Rugi Tahunan</li>
      <li class="menu" data-page="neraca-tahunan" onclick="handleMenuClick('neraca-tahunan', this)">Neraca Tahunan</li>
    </ul>

    ${canMaster ? `
      <div class="sidebar-section-title mt-4">Master Data</div>
      <ul class="space-y-1">
        <li class="menu" data-page="master-vendor" onclick="handleMenuClick('master-vendor', this)">Master Vendor</li>
        <li class="menu" data-page="master-coa" onclick="handleMenuClick('master-coa', this)">Master COA</li>
        <li class="menu" data-page="saldo-awal" onclick="handleMenuClick('saldo-awal', this)">Saldo Awal</li>
        ${canUsers ? `<li class="menu" data-page="manage-akun" onclick="handleMenuClick('manage-akun', this)">Manage Akun</li>` : ""}
      </ul>
    ` : ""}

    <div class="sidebar-section-title mt-4">Data Jurnal</div>
    <ul id="${isMobile ? "kategori-menu-mobile" : "kategori-menu"}" class="space-y-1"></ul>
  `
}

function setKategoriMenuHtml(html) {
  const desktopMenu = document.getElementById("kategori-menu")
  const mobileMenu = document.getElementById("kategori-menu-mobile")

  if (desktopMenu) desktopMenu.innerHTML = html
  if (mobileMenu) mobileMenu.innerHTML = html
}

async function animateContentOut() {
  const contentEl = document.getElementById("content")
  if (!contentEl) return

  contentEl.classList.add("page-leave")
  await wait(120)
  contentEl.classList.remove("page-leave")
}

function animateContentIn() {
  const contentEl = document.getElementById("content")
  if (!contentEl) return

  contentEl.classList.add("page-enter")

  requestAnimationFrame(() => {
    contentEl.classList.add("page-enter-active")
    contentEl.classList.remove("page-enter")
  })

  setTimeout(() => {
    contentEl.classList.remove("page-enter-active")
  }, 220)
}

function updatePageTitle(page) {
  const titleMap = {
    dashboard: "Dashboard",
    jurnal: "Jurnal Input",
    "general-ledger": "General Ledger",
    "master-coa": "Master COA",
    "master-vendor": "Master Vendor",
    "saldo-awal": "Saldo Awal",
    "neraca-bulanan": "Neraca Bulanan",
    "laba-rugi-bulanan": "Laba Rugi Bulanan",
    "laba-rugi-tahunan": "Laba Rugi Tahunan",
    "menu-kategori": "Data Jurnal",
    "neraca-tahunan": "Neraca Tahunan",
    "akm-penyusutan": localStorage.getItem("menuLabel") || "Akumulasi Penyusutan",
    "akm-penyusutan-inventaris": "Akm. Peny. Inventaris Kantor",
    "akm-penyusutan-kendaraan": "Akm. Peny. Kendaraan",
    "manage-akun": "Manage Akun"
  }

  const titleEl = document.getElementById("title")
  const titleWrap = document.getElementById("page-title-wrap")
  const mobileTitleEl = document.getElementById("mobilePageTitle")

  if (!titleEl || !titleWrap) return

  const pageHasOwnTitle = !!document.querySelector('#content [data-page-has-title="true"]')
  const text = pageHasOwnTitle ? "" : (titleMap[page] || page)
  const visibleText = titleMap[page] || page

  titleEl.innerText = text

  if (text) {
    titleWrap.classList.remove("hidden")
    titleWrap.classList.add("md:flex")
  } else {
    titleWrap.classList.add("hidden")
  }

  if (mobileTitleEl) {
    mobileTitleEl.innerText = visibleText
  }
}

async function fetchPageHtml(page) {
  const cacheKey = page

  if (pageHtmlCache.has(cacheKey)) {
    return pageHtmlCache.get(cacheKey)
  }

  const res = await fetch(`pages/${page}/${page}.html`)
  if (!res.ok) {
    throw new Error(`HTML page tidak ditemukan: ${page}`)
  }

  const html = await res.text()
  pageHtmlCache.set(cacheKey, html)
  return html
}

async function runPageInit(page) {
  const initName = pageInitMap[page]
  if (!initName) return

  const fn = window[initName]
  if (typeof fn === "function") {
    await fn()
  }
}

function renderSidebarContainers() {
  const desktopEl = document.getElementById("desktopSidebarMenu")
  const mobileEl = document.getElementById("mobileSidebarMenu")

  if (desktopEl) {
    desktopEl.innerHTML = buildStaticSidebarMenu(false)
  }

  if (mobileEl) {
    mobileEl.innerHTML = buildStaticSidebarMenu(true)
  }
}


async function loadPage(page) {
  appendDebugLog(`LOAD PAGE START: ${page}`)
  const token = ++currentLoadToken

  if (!pageInitMap[page]) {
    page = "dashboard"
  }

  localStorage.setItem("lastPage", page)
  showPageLoader()
  await animateContentOut()

  try {
    const html = await fetchPageHtml(page)

    if (token !== currentLoadToken) return

    document.getElementById("content").innerHTML = html
    updatePageTitle(page)

    await loadScript(`pages/${page}/${page}.js`)

    if (token !== currentLoadToken) return

    await runPageInit(page)

    if (page === "menu-kategori") {
      restoreKategoriSidebarState()
    } else {
      setSidebarActiveByPage(page)
    }

    animateContentIn()
  } catch (err) {
    console.error("LOAD PAGE ERROR:", err)
    document.getElementById("content").innerHTML = `
      <div class="bg-white border border-red-200 text-red-600 rounded-xl p-4">
        <div class="font-semibold mb-1">Page error</div>
        <div class="text-sm">${escapeHtml(err.message || "Unknown error")}</div>
      </div>
    `
    updatePageTitle(page)
    animateContentIn()
  } finally {
    hidePageLoader()
  }
}


function toggleMenu(id) {
  const el = document.getElementById(id)
  if (el) el.classList.toggle("hidden")
}

function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const old = document.getElementById("page-script")
    if (old) old.remove()

    const script = document.createElement("script")
    script.src = src
    script.id = "page-script"

    script.onload = () => {
      console.log("Script loaded:", src)
      resolve()
    }

    script.onerror = () => {
      console.error("Script gagal load:", src)
      reject(new Error(`Gagal load script: ${src}`))
    }

    document.body.appendChild(script)
  })
}

function escapeJsString(text) {
  return String(text ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
}

function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]/g, "")
}

async function getCoaFlags(kodeCoa) {
  const companyId = getActiveCompanyId()
  if (!companyId || !kodeCoa) {
    return {
      is_penyusutan: false,
      is_lampiran: false
    }
  }

  const { data, error } = await supabaseClient
    .from("master_coa")
    .select("is_penyusutan, is_lampiran")
    .eq("company_id", companyId)
    .eq("kode_akun", kodeCoa)
    .maybeSingle()

  if (error) {
    console.error("GET COA FLAGS ERROR:", error)
    return {
      is_penyusutan: false,
      is_lampiran: false
    }
  }

  return {
    is_penyusutan: !!data?.is_penyusutan,
    is_lampiran: !!data?.is_lampiran
  }
}



async function loadKategoriSidebar() {
  const desktopMenu = document.getElementById("kategori-menu")
  const mobileMenu = document.getElementById("kategori-menu-mobile")

  if (!desktopMenu && !mobileMenu) return

  try {
    const companyId = getActiveCompanyId()

    const { data, error } = await supabaseClient
      .from("master_coa")
      .select("kategori, nama_akun, kode_akun")
      .eq("company_id", companyId)
      .order("kategori", { ascending: true })
      .order("nama_akun", { ascending: true })

    if (error) {
      console.error("LOAD KATEGORI ERROR:", error)
      setKategoriMenuHtml(`<li class="text-sm text-red-200 px-2 py-1">Gagal load kategori</li>`)
      return
    }

    const grouped = {}

    ;(data || []).forEach(item => {
      const kategori = (item.kategori || "").trim()
      const namaAkun = (item.nama_akun || "").trim()
      const kodeAkun = (item.kode_akun || "").trim()

      if (!kategori) return

      if (!grouped[kategori]) grouped[kategori] = []

      if (namaAkun && kodeAkun) {
        const exists = grouped[kategori].some(x => x.kode_akun === kodeAkun)
        if (!exists) {
          grouped[kategori].push({
            nama_akun: namaAkun,
            kode_akun: kodeAkun
          })
        }
      }
    })

    const kategoriList = Object.keys(grouped)

    if (!kategoriList.length) {
      setKategoriMenuHtml(`<li class="text-sm text-gray-200 px-2 py-1">Belum ada kategori</li>`)
      return
    }

    let html = ""

    kategoriList.forEach((kategori, index) => {
      const submenuId = `kategori-${slugify(kategori)}-${index}`
      const akunList = grouped[kategori]

      html += `
        <li>
          <div onclick="toggleMenu('${submenuId}')" class="sidebar-category">
            <span>${escapeHtml(kategori)}</span>
            <span class="text-blue-100/80 text-xs">▾</span>
          </div>

          <ul id="${submenuId}" class="sidebar-submenu hidden space-y-1">
            ${
              akunList.length
                ? akunList.map(akun => `
                    <li
                      onclick="openMenuKategori(this, '${escapeJsString(akun.kode_akun)}', '${escapeJsString(akun.nama_akun)}', '${escapeJsString(kategori)}', '${submenuId}')"
                      class="menu text-sm"
                      data-kode-coa="${escapeHtml(akun.kode_akun)}"
                    >
                      ${escapeHtml(akun.nama_akun)}
                    </li>
                  `).join("")
                : `<li class="text-sm text-blue-100/80 px-3 py-2">Belum ada akun</li>`
            }
          </ul>
        </li>
      `
    })

    setKategoriMenuHtml(html)
  } catch (err) {
    console.error("LOAD KATEGORI SIDEBAR ERROR:", err)
    setKategoriMenuHtml(`<li class="text-sm text-red-200 px-2 py-1">Error kategori</li>`)
  }
}

async function openMenuKategori(el, kodeCoa, namaAkun, kategori, submenuId) {
  localStorage.setItem("menuKodeCOA", kodeCoa)
  localStorage.setItem("menuLabel", namaAkun)
  localStorage.setItem("menuKategori", kategori)
  localStorage.setItem("activeKategoriSubmenuId", submenuId)

  setSidebarActiveElement(el)

  const submenu = document.getElementById(submenuId)
  if (submenu) submenu.classList.remove("hidden")

  if (typeof window.closeMobileSidebar === "function") {
    window.closeMobileSidebar()
  }

  const flags = await getCoaFlags(kodeCoa)

  if (flags.is_penyusutan) {
    loadPage("akm-penyusutan")
    return
  }

  loadPage("menu-kategori")
}

function restoreKategoriSidebarState() {
  const submenuId = localStorage.getItem("activeKategoriSubmenuId")
  const kodeCoa = localStorage.getItem("menuKodeCOA")

  if (submenuId) {
    const submenu = document.getElementById(submenuId)
    if (submenu) submenu.classList.remove("hidden")
  }

  if (kodeCoa) {
    const activeEl = document.querySelector(`[data-kode-coa="${kodeCoa}"]`)
    if (activeEl) {
      setSidebarActiveElement(activeEl)
    }
  }
}

window.addEventListener("DOMContentLoaded", async () => {
  appendDebugLog("DOMContentLoaded start")
  renderSidebarContainers()
  appendDebugLog("renderSidebarContainers OK")
  initSidebarUserPanel()
  updateAppBrand()

  document.addEventListener("click", function (e) {
    const desktopButton = document.getElementById("sidebarUserButton")
    const mobileButton = document.getElementById("mobileSidebarUserButton")
    const desktopDropdown = document.getElementById("sidebarUserDropdown")
    const mobileDropdown = document.getElementById("mobileSidebarUserDropdown")

    const insideDesktop =
      desktopButton?.contains(e.target) || desktopDropdown?.contains(e.target)
    const insideMobile =
      mobileButton?.contains(e.target) || mobileDropdown?.contains(e.target)

    if (!insideDesktop && !insideMobile) {
      closeUserDropdowns()
    }
  })

  initNotificationButtons()
  initCompanyPickerClose()

  document.getElementById("changePasswordForm")?.addEventListener("submit", submitChangePassword)

  initMobileSidebar()
  appendDebugLog("initMobileSidebar OK")

  const lastPage = localStorage.getItem("lastPage") || "dashboard"
    if (!pageInitMap[lastPage]) {
      localStorage.removeItem("lastPage")
    }
  appendDebugLog(`lastPage = ${lastPage}`)

  if (lastPage === "menu-kategori") {
    restoreKategoriSidebarState()
    appendDebugLog("restoreKategoriSidebarState OK")
  } else {
    setSidebarActiveByPage(lastPage)
    appendDebugLog("setSidebarActiveByPage OK")
  }

  appendDebugLog(`LOAD PAGE START: ${lastPage}`)
  loadPage(lastPage)
  appendDebugLog("loadPage called")

  loadKategoriSidebar().then(() => {
    appendDebugLog("loadKategoriSidebar OK")
    if (lastPage === "menu-kategori") {
      restoreKategoriSidebarState()
      appendDebugLog("restoreKategoriSidebarState after kategori load OK")
    }
  }).catch(err => {
    appendDebugLog(`loadKategoriSidebar FAILED: ${err.message || err}`)
    console.error("SIDEBAR INIT ERROR:", err)
  })
  await loadNotificationCount()
})

function clearSidebarActive() {
  document.querySelectorAll(".menu-active").forEach(el => {
    el.classList.remove("menu-active")
  })
}

function setSidebarActiveByPage(page) {
  clearSidebarActive()

  const pageMap = {
    dashboard: '[data-page="dashboard"]',
    jurnal: '[data-page="jurnal"]',
    "general-ledger": '[data-page="general-ledger"]',
    "master-coa": '[data-page="master-coa"]',
    "master-vendor": '[data-page="master-vendor"]',
    "saldo-awal": '[data-page="saldo-awal"]',
    "neraca-bulanan": '[data-page="neraca-bulanan"]',
    "laba-rugi-bulanan": '[data-page="laba-rugi-bulanan"]',
    "laba-rugi-tahunan": '[data-page="laba-rugi-tahunan"]',
    "neraca-tahunan": '[data-page="neraca-tahunan"]',
    "manage-akun": '[data-page="manage-akun"]',
  }

  const target = document.querySelector(pageMap[page])
  if (target) {
    target.classList.add("menu-active")
  }
}

function setSidebarActiveElement(el) {
  clearSidebarActive()
  if (el) el.classList.add("menu-active")
}

function showPageLoader() {
  const el = document.getElementById("page-loader")
  if (el) el.classList.add("is-active")
}

function hidePageLoader() {
  const el = document.getElementById("page-loader")
  if (el) el.classList.remove("is-active")
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// responsive
function initMobileSidebar() {
  const btn = document.getElementById("mobileMenuBtn")
  const closeBtn = document.getElementById("mobileSidebarClose")
  const sidebar = document.getElementById("mobileSidebar")
  const overlay = document.getElementById("mobileSidebarOverlay")

  if (!btn || !closeBtn || !sidebar || !overlay) return

  const openSidebar = () => {
    sidebar.classList.add("is-open")
    overlay.classList.add("is-open")
    document.body.style.overflow = "hidden"
  }

  const closeSidebar = () => {
    sidebar.classList.remove("is-open")
    overlay.classList.remove("is-open")
    document.body.style.overflow = ""
  }

  btn.onclick = openSidebar
  closeBtn.onclick = closeSidebar
  overlay.onclick = closeSidebar

  document.addEventListener("keydown", function(e) {
    if (e.key === "Escape") {
      closeSidebar()
    }
  })

  window.closeMobileSidebar = closeSidebar
}

function handleMenuClick(page, el = null) {
  if (el) setSidebarActiveElement(el)
  if (typeof window.closeMobileSidebar === "function") {
    window.closeMobileSidebar()
  }
  loadPage(page)
}

function initCompanyPickerClose() {
  const btn = document.getElementById("closeCompanyPickerBtn")
  const picker = document.getElementById("companyPicker")

  if (!btn || !picker) return

  btn.onclick = () => {
    picker.classList.add("hidden")
  }
}

function bindAppCompanyButtons() {
  document.querySelectorAll("#companyChoiceList .company-choice").forEach(btn => {
    btn.onclick = async function () {
      const companyId = this.getAttribute("data-company-id") || ""
      const companyName = this.getAttribute("data-company-name") || ""
      const currentPage = localStorage.getItem("lastPage") || "dashboard"

      localStorage.setItem("finance_app_company", companyId)
      localStorage.setItem("activeCompanyId", companyId)
      localStorage.setItem("activeCompanyName", companyName)

      updateAppBrand()

      const modal = document.getElementById("companyModal")
      if (modal) {
        modal.classList.add("hidden")
        modal.classList.remove("flex")
      }

      await loadKategoriSidebar()
      await loadNotificationCount()
      await loadPage(currentPage)
    }
  })
}

function initCompanyPickerClose() {
  const btn = document.getElementById("closeCompanyPickerBtn")
  const modal = document.getElementById("companyModal")

  if (!btn || !modal) return

  btn.onclick = () => {
    modal.classList.add("hidden")
    modal.classList.remove("flex")
  }
}

function getNotificationTarget(notification) {
  const type = String(notification?.type || "").toLowerCase()
  const title = String(notification?.title || "").toLowerCase()
  const message = String(notification?.message || "").toLowerCase()

  // user daftar -> manage akun
  if (
    type.includes("user_registration") ||
    title.includes("pendaftaran user") ||
    message.includes("menunggu approval")
  ) {
    return {
      page: "manage-akun",
      menuKodeCOA: "",
      menuLabel: "",
      menuKategori: "",
      activeKategoriSubmenuId: ""
    }
  }

  // lampiran pajak -> hutang pph 21
  if (
    type.includes("pph21") ||
    title.includes("pph 21") ||
    message.includes("pph 21")
  ) {
    return {
      page: "menu-kategori",
      menuLabel: "Hutang Pph 21",
      targetName: "Hutang Pph 21"
    }
  }

  // lampiran pajak -> hutang pph 23
  if (
    type.includes("pph23") ||
    title.includes("pph 23") ||
    message.includes("pph 23")
  ) {
    return {
      page: "menu-kategori",
      menuLabel: "Hutang Pph 23",
      targetName: "Hutang Pph 23"
    }
  }

  // fallback lampiran pajak umum
  if (
    type.includes("lampiran") ||
    title.includes("lampiran") ||
    message.includes("lampiran")
  ) {
    return {
      page: "menu-kategori",
      menuLabel: "Hutang Pph 23",
      targetName: "Hutang Pph 23"
    }
  }

  return null
}

async function goToNotificationTarget(notification) {
  const target = getNotificationTarget(notification)
  if (!target) return

  if (target.page === "manage-akun") {
    await loadPage("manage-akun")
    return
  }

  if (target.page === "menu-kategori") {
    const companyId = getActiveCompanyId()
    if (!companyId) return

    const { data, error } = await supabaseClient
      .from("master_coa")
      .select("kode_akun, nama_akun, kategori")
      .eq("company_id", companyId)
      .ilike("nama_akun", target.targetName)
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error("LOAD TARGET MENU NOTIFICATION ERROR:", error)
      return
    }

    if (!data) {
      Swal.fire("Info", `Akun ${target.targetName} tidak ditemukan`, "info")
      return
    }

    localStorage.setItem("menuKodeCOA", data.kode_akun || "")
    localStorage.setItem("menuLabel", data.nama_akun || "")
    localStorage.setItem("menuKategori", data.kategori || "")
    localStorage.setItem("activeKategoriSubmenuId", "")

    await loadPage("menu-kategori")
  }
}

async function markNotificationAsRead(notificationId) {
  if (!notificationId) return

  const { error } = await supabaseClient
    .from("app_notifications")
    .update({ is_read: true })
    .eq("id", notificationId)

  if (error) {
    console.error("MARK NOTIFICATION READ ERROR:", error)
  }
}

window.handleNotificationAction = async function(notificationId) {
  if (!window.__notificationRowsMap) return

  const row = window.__notificationRowsMap[String(notificationId)]
  if (!row) return

  await markNotificationAsRead(notificationId)
  await loadNotificationCount()
  await Swal.close()
  await goToNotificationTarget(row)
}

async function openNotificationPanel() {
  if (!canSeeBell()) return

  const session = getSessionUser()
  const companyId = getActiveCompanyId()

  let query = supabaseClient
    .from("app_notifications")
    .select("*")
    .eq("target_role", session.role)
    .order("is_read", { ascending: true })
    .order("is_starred", { ascending: false })
    .order("created_at", { ascending: false })

  if (companyId) {
    query = query.or(`company_id.is.null,company_id.eq.${companyId}`)
  } else {
    query = query.is("company_id", null)
  }

  const { data, error } = await query

  if (error) {
    Swal.fire("Error", error.message || "Gagal load notifikasi", "error")
    return
  }

  notificationRows = data || []
  notificationFilter = "all"
  notificationSearch = ""

  const input = document.getElementById("notifSearchInput")
  if (input) input.value = ""

  document.querySelectorAll(".notif-tab").forEach(btn => {
    btn.classList.toggle("is-active", btn.dataset.filter === "all")
  })

  renderNotificationDrawerList()
  openNotificationDrawer()
  await loadNotificationCount()
}

function initNotificationButtons() {
  const desktopBell = document.getElementById("notificationBellBtn")
  const mobileBell = document.getElementById("mobileNotificationBellBtn")
  const closeBtn = document.getElementById("notifDrawerClose")
  const overlay = document.getElementById("notifDrawerOverlay")
  const searchInput = document.getElementById("notifSearchInput")

  if (desktopBell) desktopBell.onclick = openNotificationPanel
  if (mobileBell) mobileBell.onclick = openNotificationPanel
  if (closeBtn) closeBtn.onclick = closeNotificationDrawer
  if (overlay) overlay.onclick = closeNotificationDrawer

  document.querySelectorAll(".notif-tab").forEach(btn => {
    btn.onclick = function () {
      notificationFilter = this.dataset.filter || "all"
      document.querySelectorAll(".notif-tab").forEach(x => x.classList.remove("is-active"))
      this.classList.add("is-active")
      renderNotificationDrawerList()
    }
  })

  if (searchInput) {
    searchInput.oninput = function () {
      notificationSearch = String(this.value || "").trim()
      renderNotificationDrawerList()
    }
  }
}