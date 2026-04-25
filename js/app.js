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
let bellNudgeInterval = null
let notificationPollingInterval = null
let lastUnreadNotificationCount = 0

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
  const mobileBrandEl = document.getElementById("mobileAppBrandName")

  if (brandEl) {
    brandEl.innerText = companyName
  }

  if (mobileBrandEl) {
    mobileBrandEl.innerText = companyName
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
    appToast(error.message || "Gagal update favorit", "error")
    return
  }

  row.is_starred = nextValue
  renderNotificationDrawerList()
}

async function deleteNotification(notificationId) {
  const row = notificationRows.find(x => String(x.id) === String(notificationId))
  if (!row) return

  const result = await Swal.fire({
    title: "Hapus notifikasi?",
    text: "Notifikasi ini akan dihapus permanen.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Ya, hapus",
    cancelButtonText: "Batal",
    reverseButtons: true,
    confirmButtonColor: "#dc2626",
    cancelButtonColor: "#94a3b8"
  })

  if (!result.isConfirmed) return

  const { error } = await supabaseClient
    .from("app_notifications")
    .delete()
    .eq("id", notificationId)

  if (error) {
    appToast(error.message || "Gagal hapus notifikasi", "error")
    return
  }

  notificationRows = notificationRows.filter(x => String(x.id) !== String(notificationId))
  renderNotificationDrawerList()
  await loadNotificationCount()
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
                  onclick="event.stopPropagation(); handleNotificationOpen('${row.id}')"
                >${isRead ? "Buka Lagi" : "Buka"}</button>`
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

  if (drawer) {
    drawer.classList.remove("hidden")
    requestAnimationFrame(() => drawer.classList.add("is-open"))
  }

  if (overlay) {
    overlay.classList.remove("hidden")
    requestAnimationFrame(() => overlay.classList.add("is-open"))
  }
}

function closeNotificationDrawer() {
  const drawer = document.getElementById("notifDrawer")
  const overlay = document.getElementById("notifDrawerOverlay")

  if (drawer) {
    drawer.classList.remove("is-open")
    setTimeout(() => drawer.classList.add("hidden"), 260)
  }

  if (overlay) {
    overlay.classList.remove("is-open")
    setTimeout(() => overlay.classList.add("hidden"), 240)
  }
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
      appToast(`Akun ${target.targetName} tidak ditemukan`, "info")
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

window.handleNotificationDelete = async function(notificationId) {
  await deleteNotification(notificationId)
}

window.handleNotificationOpen = async function(notificationId) {
  const row = notificationRows.find(x => String(x.id) === String(notificationId))
  if (!row) return

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

  const activeCompanyId = getActiveCompanyId()
  const rows = (data || []).filter(
    row => String(row.company_id) !== String(activeCompanyId)
  )

  if (!rows.length) {
    listEl.innerHTML = `
      <div class="col-span-full rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center text-slate-500">
        Tidak ada perusahaan lain
      </div>
    `
    return
  }

  listEl.innerHTML = rows.map(row => `
    <button
      type="button"
      class="company-choice rounded-3xl border border-slate-200 bg-slate-50 p-6 text-left transition hover:border-blue-300 hover:bg-blue-50"
      data-company-id="${row.company_id}"
      data-company-name="${row.company_name}"
    >
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="text-lg font-bold text-slate-800">${row.company_name}</div>
          <div class="mt-2 text-sm text-slate-500">${row.company_description || "-"}</div>
        </div>
      </div>
    </button>
  `).join("")

  bindAppCompanyButtons()
}

function triggerBellAnimation(type = "soft") {
  const desktopBell = document.getElementById("notificationBellBtn")
  const mobileBell = document.getElementById("mobileNotificationBellBtn")

  const className = type === "loud" ? "bell-ring-loud" : "bell-ring-soft"
  const removeClasses = ["bell-ring-soft", "bell-ring-loud"]

  if (desktopBell) {
    desktopBell.classList.remove(...removeClasses)
    void desktopBell.offsetWidth
    desktopBell.classList.add(className)
  }

  if (mobileBell) {
    mobileBell.classList.remove(...removeClasses)
    void mobileBell.offsetWidth
    mobileBell.classList.add(className)
  }
}

function updateBellNudgeLoop(unreadCount) {
  if (bellNudgeInterval) {
    clearInterval(bellNudgeInterval)
    bellNudgeInterval = null
  }

  if (Number(unreadCount || 0) > 0) {
    bellNudgeInterval = setInterval(() => {
      triggerBellAnimation("soft")
    }, 6000)
  }
}

function startNotificationPolling() {
  if (notificationPollingInterval) {
    clearInterval(notificationPollingInterval)
    notificationPollingInterval = null
  }

  if (!canSeeBell()) return

  notificationPollingInterval = setInterval(() => {
    loadNotificationCount(true)
  }, 5000)
}

async function loadNotificationCount(shouldAnimateNew = true) {
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
  const hasNewNotification = finalCount > lastUnreadNotificationCount

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

  updateBellNudgeLoop(finalCount)

  if (shouldAnimateNew && hasNewNotification) {
    triggerBellAnimation("loud")
  }

  lastUnreadNotificationCount = finalCount

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

  if (desktopDropdown) {
    desktopDropdown.classList.add("hidden")
    desktopDropdown.classList.remove("is-open")
  }

  if (mobileDropdown) {
    mobileDropdown.classList.add("hidden")
    mobileDropdown.classList.remove("is-open")
  }
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

  // DESKTOP
  if (desktopUserButton && desktopDropdown) {
    desktopUserButton.onclick = function (e) {
      e.stopPropagation()

      const isHidden = desktopDropdown.classList.contains("hidden")

      closeUserDropdowns()

      if (isHidden) {
        desktopDropdown.classList.remove("hidden")
        desktopDropdown.classList.add("is-open")
      }
    }
  }

  // MOBILE
  if (mobileUserButton && mobileDropdown) {
    mobileUserButton.parentElement?.classList.add("relative")
    mobileUserButton.onclick = function (e) {
      e.stopPropagation()

      const isHidden = mobileDropdown.classList.contains("hidden")

      closeUserDropdowns()

      if (isHidden) {
        mobileDropdown.classList.remove("hidden")
        mobileDropdown.classList.add("is-open")
      }
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

  if (btnTambah) btnTambah.onclick = openAddCompanyModal
  if (btnEdit) btnEdit.onclick = openManageCompanyModal
}

function companyToast(message, type = "success") {
  const el = document.getElementById("companyToast")
  if (!el) {
    alert(message)
    return
  }

  el.textContent = message
  el.className = "fixed top-5 right-5 z-[10010] rounded-2xl px-5 py-4 text-sm font-semibold shadow-2xl"
  el.classList.add(type === "error" ? "bg-red-600" : "bg-emerald-600", "text-white")
  el.classList.remove("hidden")
  setTimeout(() => el.classList.add("hidden"), 2400)
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
  const user = getSessionUser()
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
  await renderCompanyChoicesInApp()
  await loadNotificationCount()
}

async function openManageCompanyModal() {
  const user = getSessionUser()
  const selectEl = document.getElementById("manageCompanyId")
  const modal = document.getElementById("manageCompanyModal")

  if (!user?.id) return companyToast("Session user tidak ditemukan", "error")
  if (!selectEl || !modal) return companyToast("Modal Kelola Company belum ada di index.html", "error")

  const { data, error } = await supabaseClient.rpc("app_list_my_companies", {
    p_user_id: user.id
  })

  if (error) return companyToast(error.message || "Gagal load company", "error")

  const rows = data || []
  if (!rows.length) return companyToast("Belum ada company untuk dikelola", "error")

  selectEl.innerHTML = rows.map(row => `
    <option value="${escapeHtml(row.company_id)}">
      ${escapeHtml(row.company_name)} ${row.company_status ? `(${escapeHtml(row.company_status)})` : ""}
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
  const user = getSessionUser()
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

  if (currentCompanyError) return companyToast(currentCompanyError.message || "Gagal mengambil data company", "error")

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
  await renderCompanyChoicesInApp()
  await loadNotificationCount()
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
  const user = getSessionUser()
  const companyId = document.getElementById("manageCompanyId")?.value || ""
  const activeCompanyId = getActiveCompanyId()
  const confirmText = document.getElementById("deleteCompanyConfirmInput")?.value?.trim() || ""

  if (!user?.id) return companyToast("Session user tidak ditemukan", "error")
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

  if (String(companyId) === String(activeCompanyId)) {
    localStorage.removeItem("finance_app_company")
    localStorage.removeItem("activeCompanyId")
    localStorage.removeItem("activeCompanyName")
    window.location.href = "login.html"
    return
  }

  showCompanyPickerModal()
  await renderCompanyChoicesInApp()
  await loadNotificationCount()
}

window.closeAddCompanyModal = closeAddCompanyModal
window.saveNewCompany = saveNewCompany
window.closeManageCompanyModal = closeManageCompanyModal
window.saveManagedCompany = saveManagedCompany
window.deleteManagedCompany = deleteManagedCompany
window.closeDeleteCompanyModal = closeDeleteCompanyModal
window.confirmDeleteManagedCompany = confirmDeleteManagedCompany

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

  if (typeof window.closeMobileSidebar === "function") {
    window.closeMobileSidebar()
  }

  const picker = document.getElementById("companyModal")
  if (!picker) return

  await renderCompanyChoicesInApp()
  initMasterCompanyActionsInApp()

  picker.classList.remove("hidden")
  picker.classList.add("flex")
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
    appToast("Session user tidak ditemukan", "error")
    return
  }

  if (newPassword.length < 6) {
    appToast("Password minimal 6 karakter", "error")
    return
  }

  const { data, error } = await supabaseClient.rpc("change_my_password", {
    p_user_id: user.id,
    p_new_password: newPassword
  })

  if (error) {
    appToast(error.message || "Gagal ganti password", "error")
    return
  }

  appToast(data || "Password berhasil diganti")
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

function setKategoriMenuHtml(desktopHtml, mobileHtml = desktopHtml) {
  const desktopMenu = document.getElementById("kategori-menu")
  const mobileMenu = document.getElementById("kategori-menu-mobile")

  if (desktopMenu) desktopMenu.innerHTML = desktopHtml
  if (mobileMenu) mobileMenu.innerHTML = mobileHtml
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
  const titleWrap = document.getElementById("page-title-wrap")
  if (!titleWrap) return

  titleWrap.classList.remove("hidden")
  titleWrap.classList.add("md:flex", "justify-end")
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
  if (!el) return

  const isHidden = el.classList.contains("hidden")
  el.classList.toggle("hidden", !isHidden)
  el.classList.toggle("submenu-open", isHidden)
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
      setKategoriMenuHtml(
        `<li class="text-sm text-gray-200 px-2 py-1">Belum ada kategori</li>`,
        `<li class="text-sm text-gray-200 px-2 py-1">Belum ada kategori</li>`
      )
      return
    }

    const desktopHtml = buildKategoriMenuHtml(grouped, false)
    const mobileHtml = buildKategoriMenuHtml(grouped, true)

    setKategoriMenuHtml(desktopHtml, mobileHtml)

  } catch (err) {
    console.error("LOAD KATEGORI SIDEBAR ERROR:", err)
    setKategoriMenuHtml(`<li class="text-sm text-red-200 px-2 py-1">Error kategori</li>`)
  }
}

function buildKategoriMenuHtml(grouped, isMobile = false) {
  const prefix = isMobile ? "mobile" : "desktop"
  let html = ""

  Object.keys(grouped).forEach((kategori, index) => {
    const submenuId = `${prefix}-kategori-${slugify(kategori)}-${index}`
    const akunList = grouped[kategori]

    html += `
      <li>
        <div
          onclick="event.stopPropagation(); toggleMenu('${submenuId}')"
          class="sidebar-category cursor-pointer select-none"
        >
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

  return html
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
  startNotificationPolling()
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

function bindAppCompanyButtons() {
  document.querySelectorAll("#companyChoiceList .company-choice").forEach(btn => {
    const companyId = btn.getAttribute("data-company-id") || ""
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
      appToast(`Akun ${target.targetName} tidak ditemukan`, "info")
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
    return
  }

  const row = notificationRows.find(x => String(x.id) === String(notificationId))
  if (row) {
    row.is_read = true
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
    appToast(error.message || "Gagal load notifikasi", "error")
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

function appToast(message, type = "success") {
  const el = document.getElementById("appToast")

  if (!el) {
    alert(message)
    return
  }

  const isError = type === "error"

  el.innerHTML = `
    <div class="flex items-center gap-4">
      <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${isError ? "bg-red-500/20" : "bg-emerald-500/20"}">
        <span class="text-2xl leading-none">${isError ? "×" : "✓"}</span>
      </div>

      <div class="flex-1">
        <div class="text-sm font-bold leading-5">
          ${message}
        </div>
      </div>
    </div>
  `

  el.className = [
    "hidden fixed top-6 right-6 z-[10010]",
    "w-[380px] max-w-[calc(100vw-32px)]",
    "rounded-2xl px-5 py-4",
    "text-white shadow-2xl",
    "transition-all duration-300 ease-out",
    isError ? "bg-red-600" : "bg-emerald-600"
  ].join(" ")

  el.style.opacity = "0"
  el.style.transform = "translateX(40px) scale(0.96)"

  el.classList.remove("hidden")

  requestAnimationFrame(() => {
    el.style.opacity = "1"
    el.style.transform = "translateX(0) scale(1)"
  })

  clearTimeout(window.appToastTimer)

  window.appToastTimer = setTimeout(() => {
    el.style.opacity = "0"
    el.style.transform = "translateX(40px) scale(0.96)"

    setTimeout(() => {
      el.classList.add("hidden")
    }, 300)
  }, 2600)
}

window.appToast = appToast