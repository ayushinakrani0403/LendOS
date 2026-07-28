const API = window.API_BASE || window.location.origin;

// ── Session ──────────────────────────────────────────────────────
function getSession() {
    const token = localStorage.getItem('nbfc_token');
    if (!token) return null;
    return {
        access_token: token,
        nbfc_id:      parseInt(localStorage.getItem('nbfc_id')),
        nbfc_name:    localStorage.getItem('nbfc_name') || '',
    };
}

// ── On load ───────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
    const session = getSession();
    if (!session) { window.location.href = '/nbfc/register '; return; }
    document.body.style.visibility = 'hidden';
    // ADD THIS after body hide line
try {
    const verify = await fetch(`${API}/api/nbfc/dashboard/profile/${session.nbfc_id}`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
    });
    if (!verify.ok) {
        ['nbfc_token','nbfc_id','nbfc_name','nbfc_email']
            .forEach(k => localStorage.removeItem(k));
        window.location.href = '/nbfc/register';
        return;
    }
    const profile = await verify.json();
    const logoBox = document.getElementById('topLogoIcon');
    if (logoBox && profile.logo_url) {
        logoBox.innerHTML = `<img src="${profile.logo_url}" alt="${profile.company_name}"
            style="width:100%;height:100%;object-fit:contain;padding:3px;border-radius:6px;"/>`;
    }
} catch (e) {
    window.location.href = '/nbfc/register';
    return;
}
document.body.style.visibility = 'visible';

    // Fill topbar + sidebar
    const name = session.nbfc_name || 'NBFC';
    document.getElementById('topNbfcName').textContent     = name;
    document.getElementById('companyAvatar').textContent   = name.charAt(0).toUpperCase();
    document.getElementById('sidebarAvatar').textContent   = name.charAt(0).toUpperCase();
    document.getElementById('sidebarNbfcName').textContent = name;

    // Restore sidebar state
    if (localStorage.getItem('nbfc_sidebar_collapsed') === '1' && window.innerWidth > 768) {
        document.getElementById('sidebar')?.classList.add('collapsed');
    }

    await loadSettings(session);
});

// ── Load settings from backend ────────────────────────────────────
async function loadSettings(session) {
    try {
        const res = await fetch(
            `${API}/api/nbfc/dashboard/profile/${session.nbfc_id}`,
            { headers: { 'Authorization': `Bearer ${session.access_token}` } }
        );
        if (!res.ok) throw new Error('Failed to load');
        const data = await res.json();
        prefillForm(data);

    } catch (e) {
        document.getElementById('loadingState').innerHTML =
            `<i class="ti ti-alert-triangle" style="color:var(--error);font-size:20px;"></i>
             <span style="color:var(--error);">Could not load settings. Please refresh.</span>`;
        return;
    }

    // Show form
    document.getElementById('loadingState').style.display  = 'none';
    document.getElementById('settingsForm').style.display  = 'block';
}

// ── Prefill all form fields ───────────────────────────────────────
function prefillForm(data) {
    document.getElementById('s-min-loan').value   = data.min_loan_amount   ?? '';
    document.getElementById('s-max-loan').value   = data.max_loan_amount   ?? '';
    document.getElementById('s-min-tenure').value = data.min_tenure_months ?? '';
    document.getElementById('s-max-tenure').value = data.max_tenure_months ?? '';
    document.getElementById('s-interest').value   = data.interest_rate     ?? '';
    document.getElementById('s-proc-fee').value   = data.processing_fee    ?? '';
    document.getElementById('s-min-score').value  = data.min_credit_score  ?? '';
    document.getElementById('s-foir').value       = data.max_foir_percent  ?? '';
    document.getElementById('s-grace').value      = data.grace_period_days ?? '';
    document.getElementById('s-penalty').value    = data.late_penalty_flat ?? '';
    document.getElementById('s-upi').value        = data.upi_id            ?? '';
    document.getElementById('s-bank-name').value  = data.bank_name         ?? '';
    document.getElementById('s-bank-acc').value   = data.bank_account_no   ?? '';
    document.getElementById('s-bank-ifsc').value  = data.bank_ifsc         ?? '';
    updateEmiPreview();
    updateScoreBand();
    updateLatePenaltyPreview();
    updateLoanRangePreview();
}
function validatePaymentDetails() {
    const upi  = document.getElementById('s-upi').value.trim();
    const acc  = document.getElementById('s-bank-acc').value.trim();
    const ifsc = document.getElementById('s-bank-ifsc').value.trim().toUpperCase();

    ['err-upi', 'err-acc', 'err-ifsc'].forEach(id => document.getElementById(id).textContent = '');

    let ok = true;
    if (!/^[\w.\-]{2,256}@[a-zA-Z]{2,64}$/.test(upi)) {
        document.getElementById('err-upi').textContent = 'Enter a valid UPI ID (e.g. name@bank).';
        ok = false;
    }
    if (!/^[0-9]{9,18}$/.test(acc)) {
        document.getElementById('err-acc').textContent = 'Account number must be 9-18 digits.';
        ok = false;
    }
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) {
        document.getElementById('err-ifsc').textContent = 'Enter a valid 11-character IFSC code.';
        ok = false;
    }
    return ok;
}

// ── Loan range summary (live update) ──────────────────────────────
function updateLoanRangePreview() {
    const minLoan   = parseInt(document.getElementById('s-min-loan').value)   || 0;
    const maxLoan   = parseInt(document.getElementById('s-max-loan').value)   || 0;
    const minTenure = parseInt(document.getElementById('s-min-tenure').value) || 0;
    const maxTenure = parseInt(document.getElementById('s-max-tenure').value) || 0;

    document.getElementById('previewLoanRange').textContent =
        (minLoan ? '₹' + minLoan.toLocaleString('en-IN') : '—') + ' – ' +
        (maxLoan ? '₹' + maxLoan.toLocaleString('en-IN') : '—');

    document.getElementById('previewTenureRange').textContent =
        (minTenure || maxTenure) ? `${minTenure}–${maxTenure} mo` : '—';
}

// ── EMI preview (live update) ─────────────────────────────────────
function updateEmiPreview() {
    const rate = parseFloat(document.getElementById('s-interest').value) || 0;
    document.getElementById('previewRate').textContent = rate;

    if (rate <= 0) {
        document.getElementById('previewEmi').textContent = '—';
        return;
    }
    // EMI for ₹1,00,000, 12 months, given rate
    const r   = rate / 1200;
    const n   = 12;
    const emi = (100000 * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    document.getElementById('previewEmi').textContent =
        '₹' + Math.round(emi).toLocaleString('en-IN') + '/mo';
}

// ── Late fee preview (live update) ───────────────────────────────
function updateLatePenaltyPreview() {
    const grace   = parseInt(document.getElementById('s-grace').value)   || 0;
    const penalty = parseInt(document.getElementById('s-penalty').value) || 0;

    document.getElementById('previewGrace').textContent     = grace;
    document.getElementById('previewGracePlus').textContent = grace + 1;

    document.getElementById('previewPenalty').textContent =
        penalty > 0 ? '+₹' + penalty.toLocaleString('en-IN') : '—';
}

// ── Score band indicator (live update) ───────────────────────────
function updateScoreBand() {
    const score = parseInt(document.getElementById('s-min-score').value) || 300;
    const pct   = Math.max(0, Math.min(100, ((score - 300) / 600) * 100));
    document.getElementById('scoreBandVal').textContent      = score;
    document.getElementById('scoreBandFill').style.width     = pct + '%';
}

// ── Wire live listeners ───────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('s-interest')?.addEventListener('input', updateEmiPreview);
    document.getElementById('s-min-score')?.addEventListener('input', updateScoreBand);
    document.getElementById('s-grace')?.addEventListener('input', updateLatePenaltyPreview);
    document.getElementById('s-penalty')?.addEventListener('input', updateLatePenaltyPreview);
    document.getElementById('s-min-loan')?.addEventListener('input', updateLoanRangePreview);
    document.getElementById('s-max-loan')?.addEventListener('input', updateLoanRangePreview);
    document.getElementById('s-min-tenure')?.addEventListener('input', updateLoanRangePreview);
    document.getElementById('s-max-tenure')?.addEventListener('input', updateLoanRangePreview);
});

// ── Save settings ─────────────────────────────────────────────────
async function saveSettings(event) {
    event.preventDefault();
 if (!validatePaymentDetails()) {
        document.getElementById('alert-err-text').textContent = 'Please fix the highlighted payment detail fields.';
        document.getElementById('alert-err').style.display = 'flex';
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
    }

    const session = getSession();
    if (!session) { window.location.href = '/nbfc/login'; return; }

    const btn = document.getElementById('saveBtn');
    btn.disabled  = true;
    btn.innerHTML = '<i class="ti ti-loader-2 spin"></i> Saving…';

    // Hide old alerts
    document.getElementById('alert-ok').style.display  = 'none';
    document.getElementById('alert-err').style.display = 'none';

    const body = {
        interest_rate:     parseFloat(document.getElementById('s-interest').value),
        min_loan_amount:   parseInt(document.getElementById('s-min-loan').value),
        max_loan_amount:   parseInt(document.getElementById('s-max-loan').value),
        min_tenure_months: parseInt(document.getElementById('s-min-tenure').value),
        max_tenure_months: parseInt(document.getElementById('s-max-tenure').value),
        processing_fee:    parseFloat(document.getElementById('s-proc-fee').value),
        min_credit_score:  parseInt(document.getElementById('s-min-score').value),
        grace_period_days: parseInt(document.getElementById('s-grace').value),
        late_penalty_flat: parseInt(document.getElementById('s-penalty').value),
        max_foir_percent:  parseFloat(document.getElementById('s-foir').value),
        upi_id:            document.getElementById('s-upi').value.trim()        || null,
    bank_name:         document.getElementById('s-bank-name').value.trim()  || null,
    bank_account_no:   document.getElementById('s-bank-acc').value.trim()   || null,
    bank_ifsc:         document.getElementById('s-bank-ifsc').value.trim().toUpperCase() || null,
    };

    try {
        const res  = await fetch(
            `${API}/api/nbfc/dashboard/settings/${session.nbfc_id}`,
            {
                method:  'PUT',
                headers: {
                    'Content-Type':  'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify(body),
            }
        );
        const data = await res.json();

      if (!res.ok) {
            document.getElementById('alert-err-text').textContent =
                data.detail || 'Failed to save settings.';
            document.getElementById('alert-err').style.display = 'flex';
            const msg = (data.detail || '').toLowerCase();
            if (msg.includes('upi')) {
                document.getElementById('err-upi').textContent = data.detail;
            } else if (msg.includes('account number')) {
                document.getElementById('err-acc').textContent = data.detail;
            } else if (msg.includes('ifsc')) {
                document.getElementById('err-ifsc').textContent = data.detail;
            }
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }

        document.getElementById('alert-ok').style.display = 'flex';
        window.scrollTo({ top: 0, behavior: 'smooth' });

    } catch (e) {
        document.getElementById('alert-err-text').textContent = 'Cannot connect to server.';
        document.getElementById('alert-err').style.display    = 'flex';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
        btn.disabled  = false;
        btn.innerHTML = '<i class="ti ti-device-floppy"></i> Save Settings';
    }
}


// ── Change password ─────────────────────────────────────────────
async function changePassword() {
    const session = getSession();
    const currentPw = document.getElementById('s-current-pw').value;
    const newPw     = document.getElementById('s-new-pw').value;
    const confirmPw = document.getElementById('s-confirm-pw').value;

    document.getElementById('pw-alert-ok').style.display  = 'none';
    document.getElementById('pw-alert-err').style.display = 'none';

    // Validate all fields are filled
    if (!currentPw || !newPw || !confirmPw) {
        document.getElementById('pw-alert-err-text').textContent = 'All fields are required.';
        document.getElementById('pw-alert-err').style.display = 'flex';
        return;
    }

    // Validate length
    if (newPw.length < 8) {
        document.getElementById('pw-alert-err-text').textContent = 'New password must be at least 8 characters.';
        document.getElementById('pw-alert-err').style.display = 'flex';
        return;
    }

    // Validate match
    if (newPw !== confirmPw) {
        document.getElementById('pw-alert-err-text').textContent = 'New passwords do not match.';
        document.getElementById('pw-alert-err').style.display = 'flex';
        return;
    }

    // Button loading state
    const submitBtn = document.querySelector('button[onclick="changePassword()"]');
    const originalBtnContent = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="ti ti-loader-2 spin"></i> Updating...';
    submitBtn.disabled = true;

    try {
        const res = await fetch(`${API}/api/nbfc/dashboard/change-password/${session.nbfc_id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ current_password: currentPw, new_password: newPw }),
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data.detail || 'Failed to update password.');

        // Success state
        document.getElementById('pw-alert-ok').style.display = 'flex';
        document.getElementById('s-current-pw').value = '';
        document.getElementById('s-new-pw').value = '';
        document.getElementById('s-confirm-pw').value = ''; // Clear confirm input
    } catch (e) {
        // Error state
        document.getElementById('pw-alert-err-text').textContent = e.message;
        document.getElementById('pw-alert-err').style.display = 'flex';
    } finally {
        // Restore button
        submitBtn.innerHTML = originalBtnContent;
        submitBtn.disabled = false;
    }
}
function togglePwVisibility(inputId, iconId) {
    const input = document.getElementById(inputId);
    const icon = document.getElementById(iconId);

    if (input.type === "password") {
        input.type = "text";
        icon.classList.remove('ti-eye');
        icon.classList.add('ti-eye-off'); // Tabler icon for hidden eye
    } else {
        input.type = "password";
        icon.classList.remove('ti-eye-off');
        icon.classList.add('ti-eye'); // Tabler icon for standard eye
    }
}


// ── Delete account ──────────────────────────────────────────────
async function deleteAccount() {
    const confirmed = confirm(
        'Are you sure you want to delete your account? This cannot be undone and will deactivate your NBFC profile.'
    );
    if (!confirmed) return;

    const session = getSession();
    try {
        const res = await fetch(`${API}/api/nbfc/dashboard/account/${session.nbfc_id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${session.access_token}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Failed to delete account.');

        handleLogout();
    } catch (e) {
        alert(e.message);
    }
}
// ── Sidebar toggle ────────────────────────────────────────────────
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (window.innerWidth <= 768) {
        sidebar.classList.toggle('mobile-open');
        overlay.classList.toggle('show');
    } else {
        sidebar.classList.toggle('collapsed');
        localStorage.setItem('nbfc_sidebar_collapsed',
            sidebar.classList.contains('collapsed') ? '1' : '0');
    }
}

// ── Logout ────────────────────────────────────────────────────────
function handleLogout() {
    ['nbfc_token', 'nbfc_id', 'nbfc_name', 'nbfc_email']
        .forEach(k => localStorage.removeItem(k));
    window.location.href = '/nbfc/register';
}