  (() => {
    const SESSION_KEY = "finance_app_session"

    function getSession() {
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

    function ensureAdminLevel() {
      const session = getSession()

      if (!session) {
        Swal.fire("Session habis", "Silakan login kembali", "warning").then(() => {
          window.location.href = "login.html"
        })
        return null
      }

      if (!["master", "superuser"].includes(session.role)) {
        Swal.fire("Akses ditolak", "Halaman ini hanya untuk master atau superuser", "error").then(() => {
          if (typeof handleMenuClick === "function") {
            handleMenuClick("dashboard")
          } else {
            window.location.href = "index.html"
          }
        })
        return null
      }

      return session
    }

    function formatDate(value) {
      if (!value) return "-"
      return new Date(value).toLocaleString("id-ID")
    }

    async function loadUsers() {
      const requestBody = document.getElementById("requestTableBody")
      const usersBody = document.getElementById("usersTableBody")

      if (requestBody) {
        requestBody.innerHTML = `
          <tr>
            <td colspan="5" class="px-4 py-6 text-center text-slate-400">Loading...</td>
          </tr>
        `
      }

      if (usersBody) {
        usersBody.innerHTML = `
          <tr>
            <td colspan="6" class="px-4 py-6 text-center text-slate-400">Loading...</td>
          </tr>
        `
      }

      const { data, error } = await supabaseClient.rpc("admin_list_app_users")

      if (error) {
        console.error("LOAD USERS ERROR:", error)

        if (requestBody) {
          requestBody.innerHTML = `
            <tr>
              <td colspan="5" class="px-4 py-6 text-center text-red-500">${error.message}</td>
            </tr>
          `
        }

        if (usersBody) {
          usersBody.innerHTML = `
            <tr>
              <td colspan="6" class="px-4 py-6 text-center text-red-500">${error.message}</td>
            </tr>
          `
        }

        return
      }

      const rows = data || []
      const requestRows = rows.filter(row => row.approval_status === "pending")
      const userRows = rows.filter(row => row.approval_status === "approved")

      renderRequestTable(requestRows)
      renderUsersTable(userRows)
    }

    function renderRequestTable(rows) {
      const body = document.getElementById("requestTableBody")
      if (!body) return

      if (!rows.length) {
        body.innerHTML = `
          <tr>
            <td colspan="5" class="px-4 py-6 text-center text-slate-400">Tidak ada request pendaftaran</td>
          </tr>
        `
        return
      }

      body.innerHTML = rows.map(row => `
        <tr class="border-t border-slate-200">
          <td class="px-4 py-3">${row.username}</td>
          <td class="px-4 py-3">${row.role}</td>
          <td class="px-4 py-3">${row.status}</td>
          <td class="px-4 py-3">${row.approval_status}</td>
          <td class="px-4 py-3">
            <div class="flex gap-2">
              <button
                onclick="approveUser('${row.id}')"
                class="rounded-xl bg-green-600 px-3 py-2 text-xs font-semibold text-white"
              >
                Approve
              </button>
              <button
                onclick="rejectUser('${row.id}')"
                class="rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold text-white"
              >
                Reject
              </button>
            </div>
          </td>
        </tr>
      `).join("")
    }

    function renderUsersTable(rows) {
      const body = document.getElementById("usersTableBody")
      if (!body) return

      if (!rows.length) {
        body.innerHTML = `
          <tr>
            <td colspan="6" class="px-4 py-6 text-center text-slate-400">Belum ada user</td>
          </tr>
        `
        return
      }

      body.innerHTML = rows.map(row => `
        <tr class="border-t border-slate-200">
          <td class="px-4 py-3 font-semibold">${row.username}</td>
          <td class="px-4 py-3">
            <select id="role-${row.id}" class="rounded-xl border border-slate-300 px-3 py-2">
              <option value="viewer" ${row.role === "viewer" ? "selected" : ""}>viewer</option>
              <option value="editor" ${row.role === "editor" ? "selected" : ""}>editor</option>
              <option value="superuser" ${row.role === "superuser" ? "selected" : ""}>superuser</option>
              <option value="master" ${row.role === "master" ? "selected" : ""}>master</option>
              </select>
          </td>
          <td class="px-4 py-3">
            <select id="status-${row.id}" class="rounded-xl border border-slate-300 px-3 py-2">
              <option value="active" ${row.status === "active" ? "selected" : ""}>active</option>
              <option value="inactive" ${row.status === "inactive" ? "selected" : ""}>inactive</option>
            </select>
          </td>
          <td class="px-4 py-3">
            <input
              id="password-${row.id}"
              type="password"
              class="w-40 rounded-xl border border-slate-300 px-3 py-2"
              placeholder="Isi jika ganti"
            />
          </td>
          <td class="px-4 py-3">${row.approval_status}</td>
          <td class="px-4 py-3 text-slate-500">${formatDate(row.created_at)}</td>
          <td class="px-4 py-3">
            <div class="flex gap-2">
              <div class="flex gap-2">
                <button
                  onclick="saveUser('${row.id}')"
                  class="rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white"
                >
                  Simpan
                </button>

                <button
                  onclick="deleteUser('${row.id}', '${row.username}')"
                  class="inline-flex items-center justify-center rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700"
                  title="Hapus User"
                >
                  <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
              </div>
            </div>
          </td>
        </tr>
      `).join("")

      if (window.lucide) {
        lucide.createIcons()
      }
    }

    async function createUser(event) {
      event.preventDefault()

      const session = getSession()
      if (!session?.id) {
        Swal.fire("Session habis", "Silakan login kembali", "warning")
        return
      }

      const username = String(document.getElementById("newUsername")?.value || "").trim()
      const password = String(document.getElementById("newPassword")?.value || "").trim()
      const role = String(document.getElementById("newRole")?.value || "viewer")
      const status = String(document.getElementById("newStatus")?.value || "active")
      const btn = document.getElementById("createUserBtn")

      if (!username || !password) {
        Swal.fire("Error", "Username dan password wajib diisi", "error")
        return
      }

      btn.disabled = true
      btn.innerText = "Memproses..."

      try {
        const { data, error } = await supabaseClient.rpc("admin_create_app_user", {
          p_actor_user_id: session.id,
          p_username: username,
          p_password: password,
          p_role: role,
          p_status: status
        })

        if (error) throw error

        Swal.fire("Berhasil", data || "User berhasil dibuat", "success")
        document.getElementById("adminCreateUserForm")?.reset()
        await loadUsers()
      } catch (err) {
        console.error("CREATE USER ERROR:", err)
        Swal.fire("Error", err.message || "Gagal membuat user", "error")
      } finally {
        btn.disabled = false
        btn.innerText = "Buat User"
      }
    }

    async function setApproval(userId, approvalStatus) {
      try {
        const { data, error } = await supabaseClient.rpc("admin_set_user_approval", {
          p_user_id: userId,
          p_approval_status: approvalStatus
        })

        if (error) throw error

        Swal.fire("Berhasil", data || "Approval berhasil diupdate", "success")
        await loadUsers()
      } catch (err) {
        console.error("APPROVAL ERROR:", err)
        Swal.fire("Error", err.message || "Gagal update approval", "error")
      }
    }

    async function removeUser(userId) {
      try {
        const { data, error } = await supabaseClient.rpc("admin_delete_app_user", {
          p_user_id: userId
        })

        if (error) throw error

        Swal.fire("Berhasil", data || "User berhasil dihapus", "success")
        await loadUsers()
      } catch (err) {
        console.error("DELETE USER ERROR:", err)
        Swal.fire("Error", err.message || "Gagal menghapus user", "error")
      }
    }

    async function saveUserChanges(userId) {
      const session = getSession()
      if (!session?.id) {
        Swal.fire("Session habis", "Silakan login kembali", "warning")
        return
      }

      const role = document.getElementById(`role-${userId}`)?.value || "viewer"
      const status = document.getElementById(`status-${userId}`)?.value || "active"
      const password = document.getElementById(`password-${userId}`)?.value || ""

      try {
        const { data, error } = await supabaseClient.rpc("admin_update_app_user", {
          p_actor_user_id: session.id,
          p_user_id: userId,
          p_role: role,
          p_status: status,
          p_new_password: password ? password : null
        })

        if (error) throw error

        Swal.fire("Berhasil", data || "Data user berhasil diupdate", "success")
        await loadUsers()
      } catch (err) {
        console.error("SAVE USER ERROR:", err)
        Swal.fire("Error", err.message || "Gagal menyimpan perubahan user", "error")
      }
    }

    window.initManageAkun = async function initManageAkun() {
      const session = ensureAdminLevel()
      if (!session) return

      document.getElementById("adminCreateUserForm")?.addEventListener("submit", createUser)
      document.getElementById("refreshRequestsBtn")?.addEventListener("click", loadUsers)
      document.getElementById("refreshUsersBtn")?.addEventListener("click", loadUsers)

      await loadUsers()
    }

    window.approveUser = function approveUser(id) {
      setApproval(id, "approved")
    }

    window.rejectUser = function rejectUser(id) {
      setApproval(id, "rejected")
    }

    window.saveUser = function saveUser(id) {
      saveUserChanges(id)
    }

    window.deleteUser = async function deleteUser(id, username) {
      const confirmDelete = await Swal.fire({
        title: "Hapus user ini?",
        text: `User ${username} akan dihapus permanen.`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Ya, hapus",
        cancelButtonText: "Batal",
        reverseButtons: true,
        confirmButtonColor: "#dc2626",
        cancelButtonColor: "#94a3b8"
      })

      if (!confirmDelete.isConfirmed) return

      await removeUser(id)
  }

    window.logoutApp = function logoutApp() {
      localStorage.removeItem("finance_app_session")
      sessionStorage.removeItem("finance_app_session")
      localStorage.removeItem("finance_app_company")
      window.location.href = "login.html"
    }
  })()