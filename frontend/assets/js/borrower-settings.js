const API = window.API_BASE || window.location.origin;

function getSession() {
    const token = localStorage.getItem('borrower_token');
    if (!token) return null;
    return {
        access_token: token,
        borrower_id: parseInt(localStorage.getItem('borrower_id')),
    };
}

window.addEventListener('DOMContentLoaded', async () => {
    const session = getSession();
    if (!session) { window.location.href = '/borrower/login'; return; }
    await loadProfile(session);
});

async function loadProfile(session) {
    try {
        const res = await fetch(`${API}/api/borrower/profile/${session.borrower_id}`, {
            headers: { 'Authorization': `Bearer ${session.access_token}` }
        });
        const data = await res.json();

        document.getElementById('p-name').textContent       = data.full_name || '—';
        document.getElementById('p-mobile').textContent     = data.mobile || '—';
        document.getElementById('p-email').textContent      = data.email || '—';
        document.getElementById('p-aadhaar').textContent    = data.aadhaar_number || '—';
        document.getElementById('p-pan').textContent        = data.pan_number || '—';
        document.getElementById('p-dob').textContent        = data.date_of_birth || '—';
        document.getElementById('p-gender').textContent     = data.gender || '—';
        document.getElementById('p-employment').textContent = data.employment_type || '—';
// ── Topbar ──
        document.getElementById('userName').textContent   = data.full_name || 'Borrower';
        document.getElementById('userAvatar').textContent = (data.full_name || 'B').charAt(0).toUpperCase();

        document.getElementById('loadingState').style.display    = 'none';
        document.getElementById('settingsContent').style.display = 'block';
    } catch (e) {
        document.getElementById('loadingState').textContent = 'Could not load profile.';
    }
}
function togglePwVisibility(inputId, btn) {
    const input = document.getElementById(inputId);
    const icon = btn.querySelector('i');
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('ti-eye');
        icon.classList.add('ti-eye-off');
    } else {
        input.type = 'password';
        icon.classList.remove('ti-eye-off');
        icon.classList.add('ti-eye');
    }
}

function handleLogout() {
    ['borrower_token', 'borrower_id'].forEach(k => localStorage.removeItem(k));
    window.location.href = '/borrower/login';
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('collapsed');
    document.getElementById('sidebarOverlay').classList.toggle('active');
}

async function changePassword() {
    const session   = getSession();
    const currentPw = document.getElementById('s-current-pw').value;
    const newPw     = document.getElementById('s-new-pw').value;
    const confirmPw = document.getElementById('s-confirm-pw').value;   // ← new

    document.getElementById('pw-alert-ok').style.display  = 'none';
    document.getElementById('pw-alert-err').style.display = 'none';

    if (!currentPw || !newPw || !confirmPw) {                          // ← updated check
        document.getElementById('pw-alert-err-text').textContent = 'All fields are required.';
        document.getElementById('pw-alert-err').style.display = 'flex';
        return;
    }
    if (newPw.length < 8) {
        document.getElementById('pw-alert-err-text').textContent = 'New password must be at least 8 characters.';
        document.getElementById('pw-alert-err').style.display = 'flex';
        return;
    }
    if (newPw !== confirmPw) {                                          // ← new check
        document.getElementById('pw-alert-err-text').textContent = 'New password and confirmation do not match.';
        document.getElementById('pw-alert-err').style.display = 'flex';
        return;
    }

    try {
        const res = await fetch(`${API}/api/borrower/change-password/${session.borrower_id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ current_password: currentPw, new_password: newPw }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Failed to update password.');

        document.getElementById('pw-alert-ok').style.display = 'flex';
        document.getElementById('s-current-pw').value = '';
        document.getElementById('s-new-pw').value = '';
        document.getElementById('s-confirm-pw').value = '';            // ← new, clear on success
    } catch (e) {
        document.getElementById('pw-alert-err-text').textContent = e.message;
        document.getElementById('pw-alert-err').style.display = 'flex';
    }
}

async function deleteAccount() {
    const confirmed = confirm('Are you sure you want to delete your account? This cannot be undone.');
    if (!confirmed) return;

    const session = getSession();
    try {
        const res = await fetch(`${API}/api/borrower/account/${session.borrower_id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${session.access_token}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Failed to delete account.');

        ['borrower_token', 'borrower_id'].forEach(k => localStorage.removeItem(k));
        window.location.href = '/borrower/login';
    } catch (e) {
        alert(e.message);
    }
}