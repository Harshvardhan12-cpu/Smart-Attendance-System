/**
 * Smart Attendance ERP - Teacher Dashboard Javascript
 * Handles live theme toggling, real-time date/clock, navigation, dynamic Flask API data binding, and modals.
 */

const todayStr = new Date().toISOString().split('T')[0];

document.addEventListener('DOMContentLoaded', () => {
    // Sync profile and session details from server
    if (window.AuthService) {
        window.AuthService.syncProfileUI();
    }

    // --- Dark/Light Mode Theme Toggle ---
    const themeToggleBtn = document.getElementById('themeToggle');
    const htmlElement = document.documentElement;

    const currentTheme = localStorage.getItem('theme') || 'light';
    htmlElement.setAttribute('data-bs-theme', currentTheme);
    updateThemeIcon(currentTheme);

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const activeTheme = htmlElement.getAttribute('data-bs-theme');
            const newTheme = activeTheme === 'light' ? 'dark' : 'light';
            
            htmlElement.setAttribute('data-bs-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            updateThemeIcon(newTheme);
            if (typeof updateSettingsThemeLabel === 'function') updateSettingsThemeLabel();
            showToast(`Theme changed to ${newTheme} mode!`, 'info');
        });
    }

    function updateThemeIcon(theme) {
        if (!themeToggleBtn) return;
        const icon = themeToggleBtn.querySelector('i');
        if (icon) {
            icon.className = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
        }
    }

    // --- Responsive Sidebar Menu ---
    const menuToggleBtn = document.getElementById('menuToggle');
    const sidebarMenu = document.getElementById('sidebarMenu');
    const sidebarBackdrop = document.getElementById('sidebarBackdrop');

    function toggleSidebar() {
        if (sidebarMenu) sidebarMenu.classList.toggle('active');
        if (sidebarBackdrop) sidebarBackdrop.classList.toggle('active');
    }

    function closeSidebar() {
        if (sidebarMenu) sidebarMenu.classList.remove('active');
        if (sidebarBackdrop) sidebarBackdrop.classList.remove('active');
    }

    if (menuToggleBtn) menuToggleBtn.addEventListener('click', toggleSidebar);
    if (sidebarBackdrop) sidebarBackdrop.addEventListener('click', closeSidebar);

    // --- Live Clock & Date ---
    const liveClock = document.getElementById('liveClock');
    const liveDate = document.getElementById('liveDate');

    function updateTime() {
        const now = new Date();
        let hours = now.getHours();
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12 || 12;
        if (liveClock) liveClock.textContent = `${String(hours).padStart(2, '0')}:${minutes}:${seconds} ${ampm}`;

        let day = now.getDate();
        let suffix = 'th';
        if (day === 1 || day === 21 || day === 31) suffix = 'st';
        else if (day === 2 || day === 22) suffix = 'nd';
        else if (day === 3 || day === 23) suffix = 'rd';

        const formatter = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', year: 'numeric' });
        const parts = formatter.formatToParts(now);
        const weekday = parts.find(p => p.type === 'weekday').value;
        const month = parts.find(p => p.type === 'month').value;
        const year = parts.find(p => p.type === 'year').value;

        if (liveDate) liveDate.textContent = `${weekday}, ${day}${suffix} ${month} ${year}`;
    }

    updateTime();
    setInterval(updateTime, 1000);

    // --- Live Table Search Filter ---
    const searchBar = document.getElementById('searchBar');
    if (searchBar) {
        searchBar.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            const rows = document.querySelectorAll('#recentAttendanceTableBody tr, #attendanceHistoryTableData tbody tr');

            rows.forEach(row => {
                const text = row.textContent.toLowerCase();
                row.style.display = text.includes(query) ? '' : 'none';
            });
        });
    }

    // Load initial dashboard stats & schedule
    loadDashboardStats();

    // Route to default page if configured in preferences
    try {
        const savedPrefs = JSON.parse(localStorage.getItem('erpSettings') || '{}');
        if (savedPrefs.defaultPage && savedPrefs.defaultPage !== 'Dashboard') {
            simulateNav(savedPrefs.defaultPage);
        }
    } catch (_) {}

    // History Filter Event Listeners
    const historyDateInput = document.getElementById('historyDateInput');
    const historyLectureSelect = document.getElementById('historyLectureSelect');
    const historyStatusSelect = document.getElementById('historyStatusSelect');

    if (historyDateInput) historyDateInput.addEventListener('change', filterAttendanceHistory);
    if (historyLectureSelect) historyLectureSelect.addEventListener('change', filterAttendanceHistory);
    if (historyStatusSelect) historyStatusSelect.addEventListener('change', filterAttendanceHistory);

    // Initialize Add Student Modal auto-class-loader
    initAddStudentModal();
});

// --- Navigation Item Click & Header Update Simulation ---
function simulateNav(moduleName) {
    const menuItems = document.querySelectorAll('.sidebar-menu .menu-item');
    menuItems.forEach(item => {
        const link = item.querySelector('.menu-item-link');
        if (link && link.textContent.trim().includes(moduleName)) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    const pageTitle = document.getElementById('pageTitle');
    if (pageTitle) pageTitle.textContent = moduleName;

    const allSections = document.querySelectorAll('.spa-section');
    allSections.forEach(sec => {
        sec.style.display = 'none';
        sec.classList.remove('active');
    });

    const sectionId = 'section-' + moduleName.replace(/[\s&]/g, '');
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.style.display = 'block';
        setTimeout(() => targetSection.classList.add('active'), 50);

        if (moduleName === 'Dashboard') {
            loadDashboardStats();
        } else if (moduleName === 'My Classes') {
            loadMyClasses();
        } else if (moduleName === 'Mark Attendance') {
            loadAttendanceForm();
        } else if (moduleName === 'Attendance History') {
            loadAttendanceHistory();
        } else if (moduleName === 'Reports') {
            loadReportFilters();
        } else if (moduleName === 'Settings') {
            loadSettings();
        }
    }

    const sidebarMenu = document.getElementById('sidebarMenu');
    const sidebarBackdrop = document.getElementById('sidebarBackdrop');
    if (sidebarMenu) sidebarMenu.classList.remove('active');
    if (sidebarBackdrop) sidebarBackdrop.classList.remove('active');
}

// --- Dynamic Data Fetching Functions ---

async function loadDashboardStats() {
    try {
        const res = await fetch('/api/reports/dashboard-stats');
        if (!res.ok) return;
        const stats = await res.json();

        // Update card stats numbers using IDs for reliability
        const todayClassesEl = document.getElementById('statTodayClasses');
        if (todayClassesEl) todayClassesEl.textContent = `${stats.todays_classes} Lectures`;

        const statCards = document.querySelectorAll('.stat-card');
        if (statCards.length >= 2) {
            statCards[1].querySelector('.stat-number').textContent = `${stats.students_assigned} Students`;
        }
        const attSubmittedEl = document.getElementById('statAttendanceSubmitted');
        if (attSubmittedEl) attSubmittedEl.textContent = `${stats.attendance_submitted} / ${stats.todays_classes} Classes`;

        if (statCards.length >= 4) {
            statCards[3].querySelector('.stat-number').textContent = `${stats.students_present} Present`;
        }
        if (statCards.length >= 5) {
            statCards[4].querySelector('.stat-number').textContent = `${stats.students_absent} Absent`;
        }
        const pendingEl = document.getElementById('statPendingAttendance');
        if (pendingEl) pendingEl.textContent = `${stats.pending_attendance} Classes`;

        // Fetch today's timetable, recent attendance, whatsapp logs, and analytics
        loadTodaySchedule();
        loadRecentAttendance();
        loadWhatsappLogs();
        loadNotifications();
        loadAttendanceAnalytics();
    } catch (e) {
        console.error("Dashboard stats error:", e);
    }
}

async function loadAttendanceAnalytics() {
    try {
        const res = await fetch('/api/reports/attendance-analytics');
        if (!res.ok) return;
        const data = await res.json();

        // --- Widget 1: Weekly Attendance Trend ---
        const trendContainer = document.getElementById('analyticsWeeklyTrend');
        if (trendContainer && data.weekly_trend) {
            trendContainer.innerHTML = '';
            if (data.weekly_trend.length === 0) {
                trendContainer.innerHTML = '<div class="text-center w-100 py-3 text-muted" style="font-size: 11px;">No weekly trend data available.</div>';
            } else {
                const barsHtml = data.weekly_trend.map(day => {
                    const height = day.percentage > 0 ? Math.max(day.percentage, 8) : 4;
                    const barColor = day.is_future ? 'var(--border-color)' : (day.is_today ? 'var(--primary)' : 'var(--present)');
                    const labelColor = day.is_today ? 'var(--primary)' : 'var(--text-secondary)';
                    const fontWeight = day.is_today ? '700' : '500';
                    const valueText = day.is_future ? '—' : (day.has_data ? day.percentage + '%' : '0%');
                    return `
                        <div style="display: flex; flex-direction: column; align-items: center; gap: 4px; flex: 1;">
                            <span style="font-size: 10px; font-weight: 600; color: ${day.is_future ? 'var(--text-secondary)' : (day.percentage >= 75 ? 'var(--present)' : 'var(--absent)')}">${valueText}</span>
                            <div style="width: 100%; max-width: 38px; height: 80px; background: var(--bg-secondary); border-radius: 6px; display: flex; align-items: flex-end; overflow: hidden;">
                                <div style="width: 100%; height: ${height}%; background: ${barColor}; border-radius: 6px; transition: height 0.6s ease;"></div>
                            </div>
                            <span style="font-size: 10px; font-weight: ${fontWeight}; color: ${labelColor};">${day.label}</span>
                        </div>
                    `;
                }).join('');
                trendContainer.innerHTML = `<div style="display: flex; align-items: flex-end; gap: 6px; width: 100%; padding: 8px 0;">${barsHtml}</div>`;
            }
        }

        // --- Widget 2: Present vs Absent Distribution ---
        if (data.present_absent) {
            const pa = data.present_absent;
            const avgEl = document.getElementById('analyticsPresentAbsentAvg');
            if (avgEl) avgEl.textContent = pa.avg_pct > 0 ? pa.avg_pct + '% Avg' : '--% Avg';

            const presentText = document.getElementById('analyticsTotalPresentText');
            if (presentText) presentText.textContent = pa.present_count + ' Students';

            const absentText = document.getElementById('analyticsTotalAbsentText');
            if (absentText) absentText.textContent = pa.absent_count + ' Students';

            const fillPresent = document.getElementById('analyticsFillPresent');
            if (fillPresent) fillPresent.style.width = pa.present_pct + '%';

            const fillAbsent = document.getElementById('analyticsFillAbsent');
            if (fillAbsent) fillAbsent.style.width = pa.absent_pct + '%';

            const legendPresent = document.getElementById('analyticsLegendPresent');
            if (legendPresent) legendPresent.textContent = 'Present (' + pa.present_pct + '%)';

            const legendAbsent = document.getElementById('analyticsLegendAbsent');
            if (legendAbsent) legendAbsent.textContent = 'Absent (' + pa.absent_pct + '%)';
        }

        // --- Widget 3: Class-wise Attendance ---
        const classList = document.getElementById('analyticsClassList');
        const classCount = document.getElementById('analyticsClassCount');
        if (classList && data.class_wise) {
            if (classCount) classCount.textContent = data.class_wise.length + ' Batches';

            classList.innerHTML = '';
            if (data.class_wise.length === 0) {
                classList.innerHTML = '<div class="text-center w-100 py-3 text-muted" style="font-size: 11px;">No class data available yet.</div>';
            } else {
                data.class_wise.forEach(cls => {
                    const rate = cls.attendance_rate;
                    const barColor = rate >= 75 ? 'var(--present)' : (rate >= 50 ? 'var(--pending)' : 'var(--absent)');
                    classList.innerHTML += `
                        <div style="display: flex; align-items: center; gap: 10px; padding: 6px 0; border-bottom: 1px solid var(--border-color);">
                            <span style="font-size: 12px; font-weight: 600; color: var(--text-primary); min-width: 100px; white-space: nowrap;">${cls.section_name}</span>
                            <div style="flex: 1; height: 7px; background: var(--bg-secondary); border-radius: 4px; overflow: hidden;">
                                <div style="height: 100%; width: ${rate}%; background: ${barColor}; border-radius: 4px; transition: width 0.6s ease;"></div>
                            </div>
                            <span style="font-size: 11px; font-weight: 700; color: ${barColor}; min-width: 42px; text-align: right;">${rate}%</span>
                        </div>
                    `;
                });
            }
        }

    } catch (e) {
        console.error('Error loading attendance analytics:', e);
        // Show friendly error states
        const trendContainer = document.getElementById('analyticsWeeklyTrend');
        if (trendContainer) trendContainer.innerHTML = '<div class="text-center w-100 py-3 text-muted" style="font-size: 11px;"><i class="fa-solid fa-exclamation-circle me-1"></i> Could not load trend data.</div>';
        const classList = document.getElementById('analyticsClassList');
        if (classList) classList.innerHTML = '<div class="text-center w-100 py-3 text-muted" style="font-size: 11px;"><i class="fa-solid fa-exclamation-circle me-1"></i> Could not load class data.</div>';
    }
}

async function loadWhatsappLogs() {
    const container = document.getElementById('parentNotificationStatusList');
    if (!container) return;

    container.innerHTML = `
        <div class="spinner-loading-wrapper py-3">
            <i class="fa-solid fa-circle-notch spinner-loading-icon fs-5"></i>
            <span style="font-size: 11px;">Fetching WhatsApp notification logs...</span>
        </div>
    `;

    try {
        const res = await fetch('/api/whatsapp/logs');
        if (!res.ok) return;
        const logs = await res.json();

        container.innerHTML = '';
        if (!logs || logs.length === 0) {
            container.innerHTML = `
                <div class="p-3 text-center text-muted" style="font-size: 12px;">
                    <i class="fa-brands fa-whatsapp mb-1 d-block fs-5" style="opacity: 0.5;"></i>
                    No parent notification logs yet.
                </div>
            `;
            return;
        }

        logs.slice(0, 5).forEach(log => {
            const isSent = log.status === 'sent';
            const iconClass = isSent ? 'fa-check' : 'fa-exclamation';
            const indicatorClass = isSent ? 'success' : 'pending';
            const badgeClass = isSent ? 'status-present' : 'status-absent';
            const badgeText = isSent ? 'Sent' : (log.error_message ? 'Failed' : 'Pending');
            const timeStr = log.created_at ? log.created_at.split(' ')[1] || log.created_at : '';

            container.innerHTML += `
                <div class="notification-status-item">
                    <div class="notification-left">
                        <div class="notification-indicator ${indicatorClass}">
                            <i class="fa-solid ${iconClass}"></i>
                        </div>
                        <div class="notification-details">
                            <span class="notification-student">${log.student_name}</span>
                            <span class="notification-meta" title="${log.error_message || log.message}">${log.phone_number} &bull; ${timeStr}</span>
                        </div>
                    </div>
                    <span class="status-badge ${badgeClass}">${badgeText}</span>
                </div>
            `;
        });
    } catch (e) {
        console.error("Error loading whatsapp logs:", e);
    }
}

async function loadNotifications() {
    const container = document.getElementById('notifDropdownItems');
    const badge = document.getElementById('notifBadge');
    const countBadge = document.getElementById('notifCountBadge');

    if (!container) return;

    try {
        const res = await fetch('/api/reports/notifications');
        if (!res.ok) return;
        const notifications = await res.json();

        container.innerHTML = '';

        if (!notifications || notifications.length === 0) {
            container.innerHTML = `
                <li class="text-center py-3 text-muted" style="font-size: 12px;">
                    <i class="fa-solid fa-circle-check text-success d-block mb-1" style="font-size: 1.2rem;"></i>
                    All caught up! No new notifications.
                </li>
            `;
            if (badge) badge.style.display = 'none';
            if (countBadge) countBadge.textContent = '0';
            return;
        }

        // Update badge count
        const pendingCount = notifications.filter(n => n.type === 'pending' || n.type === 'whatsapp_failed' || n.type === 'low_attendance').length;
        if (badge) {
            badge.textContent = pendingCount > 0 ? pendingCount : '';
            badge.style.display = pendingCount > 0 ? 'inline-block' : 'none';
        }
        if (countBadge) countBadge.textContent = `${notifications.length} New`;

        notifications.forEach(n => {
            container.innerHTML += `
                <li>
                    <a class="dropdown-item py-2 border-bottom" href="#" onclick="simulateNav('${n.action}')">
                        <div class="d-flex gap-2">
                            <div class="mt-1" style="color: ${n.color};"><i class="${n.icon}"></i></div>
                            <div>
                                <p class="mb-0 text-wrap" style="font-size: 12.5px;">${n.message}</p>
                                <span class="text-muted" style="font-size: 11px;">${n.sub} • ${n.time}</span>
                            </div>
                        </div>
                    </a>
                </li>
            `;
        });
    } catch (e) {
        console.error('Error loading notifications:', e);
    }
}

function selectAndMarkLecture(timetableId) {
    simulateNav('Mark Attendance');
    setTimeout(() => {
        const select = document.getElementById('markAttLecture');
        if (select) {
            select.value = timetableId;
            fetchStudentsForAttendance();
        }
    }, 150);
}

async function loadTodaySchedule() {
    const tbody = document.getElementById('todaysScheduleTableBody');
    if (!tbody) return;

    tbody.innerHTML = `
        <tr>
            <td colspan="6" class="py-3">
                <div class="d-flex flex-column gap-2">
                    <div class="skeleton-box skeleton-text-md"></div>
                    <div class="skeleton-box skeleton-text-md" style="width: 85%;"></div>
                </div>
            </td>
        </tr>
    `;

    try {
        const res = await fetch('/api/timetable/today');
        if (!res.ok) return;
        const timetable = await res.json();

        const sessionBadge = document.getElementById('scheduleSessionBadge');
        if (sessionBadge) {
            sessionBadge.textContent = `${timetable.length} ${timetable.length === 1 ? 'Session' : 'Sessions'}`;
        }

        tbody.innerHTML = '';
        if (!timetable || timetable.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-4 text-muted">
                        <i class="fa-solid fa-calendar-xmark d-block mb-2" style="font-size: 1.5rem; opacity: 0.5;"></i>
                        No classes scheduled for today.
                    </td>
                </tr>
            `;
            updateNextLectureWidget(null);
            return;
        }

        timetable.forEach(t => {
            let badgeClass = 'status-upcoming';
            let badgeContent = t.status;
            let actionBtnText = 'Mark';

            if (t.is_marked || t.status === 'Marked') {
                badgeClass = 'status-present';
                badgeContent = '<i class="fa-solid fa-circle-check me-1"></i> Marked';
                actionBtnText = 'View / Edit';
            } else if (t.status === 'Completed') {
                badgeClass = 'status-late';
                badgeContent = '<i class="fa-solid fa-clock me-1"></i> Completed';
            } else if (t.status === 'In Progress') {
                badgeClass = 'status-inprogress';
                badgeContent = '<i class="fa-solid fa-spinner fa-spin me-1"></i> In Progress';
            }

            tbody.innerHTML += `
                <tr>
                    <td data-label="Time" class="fw-semibold">${t.start_time_str || t.start_time}</td>
                    <td data-label="Subject" class="fw-medium">${t.subject_name}</td>
                    <td data-label="Class">${t.class_name}</td>
                    <td data-label="Room">${t.room_number || 'Room 101'}</td>
                    <td data-label="Status"><span class="status-badge ${badgeClass}">${badgeContent}</span></td>
                    <td data-label="Action" class="text-end">
                        <button class="${t.is_marked ? 'btn-outline-custom' : 'btn-primary-custom'}" onclick="selectAndMarkLecture(${t.timetable_id})">
                            <i class="fa-solid ${t.is_marked ? 'fa-pen-to-square' : 'fa-clipboard-user'} me-1"></i> ${actionBtnText}
                        </button>
                    </td>
                </tr>
            `;
        });

        // Set Next Lecture widget
        const upcoming = timetable.find(t => t.status === 'Scheduled' || t.status === 'In Progress') || timetable[0];
        updateNextLectureWidget(upcoming);

    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-3 text-muted">Error loading schedule.</td></tr>`;
    }
}

function updateNextLectureWidget(lecture) {
    const cards = document.querySelectorAll('.next-lecture-card');
    if (!cards.length) return;

    cards.forEach(card => {
        if (!lecture) {
            card.querySelector('.next-lecture-subject, .next-lecture-subject-sync').textContent = 'No Lectures Today';
            card.querySelector('.next-lecture-details').innerHTML = `<span><i class="fa-regular fa-clock"></i> All sessions clear</span>`;
            return;
        }

        const subjectEl = card.querySelector('.next-lecture-subject') || card.querySelector('.next-lecture-subject-sync');
        if (subjectEl) subjectEl.textContent = lecture.subject_name;
        card.querySelector('.next-lecture-details').innerHTML = `
            <span><i class="fa-regular fa-clock"></i> ${lecture.start_time_str || lecture.start_time} – ${lecture.end_time_str || lecture.end_time}</span>
            <span><i class="fa-solid fa-chalkboard"></i> ${lecture.class_name}</span>
            <span><i class="fa-solid fa-location-dot"></i> ${lecture.room_number || 'Room 101'}</span>
        `;
    });
}

async function loadRecentAttendance() {
    const tbody = document.getElementById('recentAttendanceTableBody');
    if (!tbody) return;

    tbody.innerHTML = `
        <tr>
            <td colspan="5" class="py-3">
                <div class="skeleton-box skeleton-text-md"></div>
            </td>
        </tr>
    `;

    try {
        const res = await fetch('/api/attendance');
        if (!res.ok) return;
        const records = await res.json();

        tbody.innerHTML = '';
        if (!records || records.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center py-4 text-muted">
                        <i class="fa-solid fa-folder-open d-block mb-2" style="font-size: 1.5rem; opacity: 0.5;"></i>
                        No recent attendance records found.
                    </td>
                </tr>
            `;
            return;
        }

        records.slice(0, 5).forEach(r => {
            let badgeClass = r.status === 'present' ? 'status-present' : r.status === 'absent' ? 'status-absent' : 'status-late';
            tbody.innerHTML += `
                <tr>
                    <td data-label="Roll" class="fw-semibold">${r.roll_number}</td>
                    <td data-label="Student" class="fw-medium">${r.student_name}</td>
                    <td data-label="Class">${r.class_name}</td>
                    <td data-label="Status"><span class="status-badge ${badgeClass}">${r.status}</span></td>
                    <td data-label="Action" class="text-end">
                        <button class="btn-outline-custom" onclick="viewStudentDetails('${r.student_name}', '${r.roll_number}')">Details</button>
                    </td>
                </tr>
            `;
        });
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center py-3 text-muted">Error loading records.</td></tr>`;
    }
}

async function loadMyClasses() {
    const tbody = document.querySelector('#myClassesTable tbody');
    const classSelect = document.getElementById('addStudentClassSelect');
    if (!tbody) return;

    tbody.innerHTML = `
        <tr>
            <td colspan="4" class="py-4">
                <div class="d-flex flex-column gap-2">
                    <div class="skeleton-box skeleton-text-md"></div>
                    <div class="skeleton-box skeleton-text-md" style="width: 70%;"></div>
                </div>
            </td>
        </tr>
    `;

    try {
        const res = await fetch('/api/classes');
        if (!res.ok) return;
        const classes = await res.json();

        tbody.innerHTML = '';
        if (classSelect) classSelect.innerHTML = '<option value="">Select a class...</option>';

        if (!classes || classes.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center py-4 text-muted">
                        <i class="fa-solid fa-folder-open d-block mb-2" style="font-size: 1.8rem; opacity: 0.5;"></i>
                        No classes found for your account.<br>
                        <button class="btn-primary-custom mt-2" data-bs-toggle="modal" data-bs-target="#createClassModal" style="font-size: 12px;">
                            <i class="fa-solid fa-plus me-1"></i> Create Your First Class
                        </button>
                    </td>
                </tr>
            `;
            return;
        }

        classes.forEach(c => {
            tbody.innerHTML += `
                <tr>
                    <td data-label="Class Name" class="fw-medium">${c.section_name}</td>
                    <td data-label="Subject">${c.subject_name} <span class="text-muted" style="font-size: 11px;">(${c.subject_code})</span></td>
                    <td data-label="Semester">Sem ${c.semester || 1}</td>
                    <td data-label="Students">${c.student_count || 0} Students</td>
                </tr>
            `;

            if (classSelect) {
                classSelect.innerHTML += `<option value="${c.class_id}">${c.section_name} - ${c.subject_name}</option>`;
            }
        });

    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center py-3 text-muted">Error loading classes.</td></tr>`;
    }
}

async function loadAttendanceForm() {
    const dateInput = document.getElementById('markAttDate');
    if (dateInput && !dateInput.value) {
        dateInput.value = todayStr;
    }

    const select = document.getElementById('markAttLecture');
    if (!select) return;

    select.innerHTML = '<option value="">Loading lectures...</option>';

    try {
        const res = await fetch('/api/timetable/today');
        if (!res.ok) return;
        const timetables = await res.json();

        window.todayTimetable = timetables || [];

        select.innerHTML = '<option value="">Select a lecture...</option>';
        if (!timetables || timetables.length === 0) {
            select.innerHTML = '<option value="">No lectures scheduled today</option>';
            return;
        }

        timetables.forEach(t => {
            const markedTag = t.is_marked ? ' [✅ Attendance Marked]' : '';
            select.innerHTML += `<option value="${t.timetable_id}" data-classid="${t.class_id}">${t.start_time_str || t.start_time} - ${t.subject_name} (${t.class_name})${markedTag}</option>`;
        });
    } catch (e) {
        select.innerHTML = '<option value="">Error loading lectures</option>';
    }
}

async function fetchStudentsForAttendance() {
    const select = document.getElementById('markAttLecture');
    const dateInput = document.getElementById('markAttDate');
    const dateStr = dateInput ? dateInput.value : todayStr;

    if (!select || !select.value || !dateStr) {
        showToast('Please select date and lecture.', 'error');
        return;
    }

    const timetableId = select.value;
    const timetables = window.todayTimetable || [];
    const lecture = timetables.find(t => String(t.timetable_id) === String(timetableId));
    if (!lecture) return;

    window.currentAttLecture = lecture;

    const container = document.getElementById('markAttStudentsContainer');
    const tbody = document.querySelector('#markAttendanceTable tbody');
    
    if (container) container.style.display = 'block';
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="3" class="py-4 text-center">
                    <div class="spinner-loading-wrapper py-2">
                        <i class="fa-solid fa-circle-notch spinner-loading-icon fs-4"></i>
                        <span style="font-size: 12px; font-weight: 500;">Loading student roll call list...</span>
                    </div>
                </td>
            </tr>
        `;
    }

    try {
        const res = await fetch(`/api/classes/${lecture.class_id}/students?timetable_id=${timetableId}&date=${dateStr}`);
        if (!res.ok) {
            showToast('Error loading students.', 'error');
            return;
        }
        const students = await res.json();

        window.currentAttStudents = students || [];

        const countLabel = document.getElementById('markAttCountLabel');
        if (countLabel) {
            countLabel.textContent = `Roll Call for ${lecture.subject_name} (${lecture.class_name}) - ${students.length} Students`;
        }

        // Check if attendance is already marked for today
        const isAlreadyMarked = students.some(s => s.attendance_status !== null && s.attendance_status !== undefined);
        
        let noticeBanner = document.getElementById('attendanceMarkedNotice');
        
        if (!noticeBanner && container) {
            noticeBanner = document.createElement('div');
            noticeBanner.id = 'attendanceMarkedNotice';
            container.insertBefore(noticeBanner, container.firstChild);
        }

        if (noticeBanner) {
            if (isAlreadyMarked) {
                noticeBanner.className = 'alert alert-success d-flex align-items-center gap-2 mb-3 py-2 px-3 shadow-sm rounded-3';
                noticeBanner.style.borderLeft = '5px solid #10b981';
                noticeBanner.innerHTML = `
                    <i class="fa-solid fa-circle-check text-success fs-5"></i>
                    <div style="font-size: 13px;">
                        <strong class="text-success">Attendance is ALREADY MARKED for today (${dateStr})!</strong>
                        <span class="d-block text-secondary">Below are the recorded statuses. Modifying and clicking Submit will update existing records.</span>
                    </div>
                `;
            } else {
                noticeBanner.className = 'alert alert-info d-flex align-items-center gap-2 mb-3 py-2 px-3 shadow-sm rounded-3';
                noticeBanner.style.borderLeft = '5px solid #0284c7';
                noticeBanner.innerHTML = `
                    <i class="fa-solid fa-circle-info text-info fs-5"></i>
                    <div style="font-size: 13px;">
                        <strong class="text-info">Attendance NOT marked yet for today (${dateStr}).</strong>
                        <span class="d-block text-secondary">Select status for each student and click "Submit Attendance Record".</span>
                    </div>
                `;
            }
        }

        if (!tbody) return;

        tbody.innerHTML = '';
        if (students.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="3" class="text-center py-4 text-muted">
                        <i class="fa-solid fa-user-slash d-block mb-2" style="font-size: 1.5rem; opacity: 0.5;"></i>
                        No students enrolled in this class yet.<br>
                        <button class="btn-primary-custom mt-2" data-bs-toggle="modal" data-bs-target="#addStudentModal" style="font-size: 12px;">
                            <i class="fa-solid fa-user-plus me-1"></i> Add Student Now
                        </button>
                    </td>
                </tr>
            `;
            return;
        }

        students.forEach(s => {
            const currentStatus = s.attendance_status || 'present';
            const isPresent = currentStatus === 'present' ? 'active' : '';
            const isAbsent = currentStatus === 'absent' ? 'active' : '';
            const isLate = currentStatus === 'late' ? 'active' : '';

            tbody.innerHTML += `
                <tr>
                    <td data-label="Roll No" class="fw-semibold text-secondary" style="font-size: 13px;">${s.roll_number}</td>
                    <td data-label="Name" class="fw-medium">${s.full_name}</td>
                    <td data-label="Status">
                        <div class="status-btn-group" data-studentid="${s.student_id}" data-studentname="${s.full_name}" data-roll="${s.roll_number}" data-status="${currentStatus}">
                            <button type="button" class="status-btn btn-present ${isPresent}" onclick="setStudentStatus(this, 'present')">
                                <i class="fa-solid fa-circle-check"></i> Present
                            </button>
                            <button type="button" class="status-btn btn-absent ${isAbsent}" onclick="setStudentStatus(this, 'absent')">
                                <i class="fa-solid fa-circle-xmark"></i> Absent
                            </button>
                            <button type="button" class="status-btn btn-late ${isLate}" onclick="setStudentStatus(this, 'late')">
                                <i class="fa-solid fa-clock"></i> Late
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });
    } catch (e) {
        showToast('Network error loading students.', 'error');
    }
}

function setStudentStatus(btnEl, status) {
    const group = btnEl.closest('.status-btn-group');
    if (!group) return;
    group.querySelectorAll('.status-btn').forEach(btn => btn.classList.remove('active'));
    btnEl.classList.add('active');
    group.setAttribute('data-status', status);
}

function markAll(status) {
    document.querySelectorAll('.status-btn-group').forEach(group => {
        const targetBtn = group.querySelector(`.btn-${status}`);
        if (targetBtn) {
            setStudentStatus(targetBtn, status);
        }
    });
    showToast(`Marked all students as **${status.toUpperCase()}**`, 'info');
}

async function submitAttendance(btnEl) {
    const select = document.getElementById('markAttLecture');
    const dateStr = document.getElementById('markAttDate').value;
    const lecture = window.currentAttLecture;
    if (!lecture || !dateStr) return;

    const groups = document.querySelectorAll('.status-btn-group');
    if (groups.length === 0) return;

    const submitBtn = btnEl || document.querySelector('#markAttStudentsContainer button[onclick*="submitAttendance"]');
    const originalBtnHtml = submitBtn ? submitBtn.innerHTML : '<i class="fa-solid fa-paper-plane me-1"></i> Submit Attendance Record';

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.classList.add('btn-submitting');
        submitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin me-2"></i> Submitting & Sending WhatsApp Alerts...';
    }

    const attendanceRecords = [];
    groups.forEach(group => {
        const studentId = group.getAttribute('data-studentid');
        const status = group.getAttribute('data-status') || 'present';
        attendanceRecords.push({ student_id: parseInt(studentId), status: status });
    });

    try {
        const res = await fetch('/api/attendance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                timetable_id: lecture.timetable_id,
                date: dateStr,
                attendance: attendanceRecords
            })
        });

        const data = await res.json();

        if (res.ok) {
            showToast(`✅ Attendance recorded & marked for **${lecture.subject_name}**!`, 'success');
            
            // Show WhatsApp result toasts
            if (data.details) {
                if (data.details.whatsapp_sent > 0) {
                    setTimeout(() => {
                        showToast(`📱 WhatsApp alert automatically sent to ${data.details.whatsapp_sent} parent(s)!`, 'success');
                    }, 800);
                }
                if (data.details.whatsapp_errors && data.details.whatsapp_errors.length > 0) {
                    data.details.whatsapp_errors.forEach((err, i) => {
                        setTimeout(() => {
                            showToast(`⚠️ WhatsApp alert error for ${err.student}: ${err.error}`, 'error');
                        }, 1200 + (i * 800));
                    });
                }
            }
            
            loadDashboardStats();
            loadAttendanceForm();
            setTimeout(() => {
                fetchStudentsForAttendance();
            }, 300);
        } else {
            showToast(data.error || 'Failed to submit attendance.', 'error');
        }
    } catch (e) {
        showToast('Error submitting attendance.', 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.classList.remove('btn-submitting');
            submitBtn.innerHTML = originalBtnHtml;
        }
    }
}

async function loadAttendanceHistory() {
    const dateInput = document.getElementById('historyDateInput');
    if (dateInput && !dateInput.value) {
        dateInput.value = todayStr;
    }

    // Dynamically populate the lecture dropdown from teacher's classes
    const lectureSelect = document.getElementById('historyLectureSelect');
    if (lectureSelect) {
        const currentValue = lectureSelect.value;
        lectureSelect.innerHTML = '<option value="ALL">All Lectures</option>';

        try {
            const classRes = await fetch('/api/classes');
            if (classRes.ok) {
                const classes = await classRes.json();
                if (classes && classes.length > 0) {
                    classes.forEach(cls => {
                        const label = `${cls.subject_name} - ${cls.section_name}`;
                        const val = `${cls.section_name}||${cls.subject_name}`;
                        lectureSelect.innerHTML += `<option value="${val}">${label}</option>`;
                    });
                }
            }
        } catch (e) {
            console.error('Error loading classes for history filter:', e);
        }

        // Restore previous selection if it still exists
        if (currentValue && lectureSelect.querySelector(`option[value="${currentValue}"]`)) {
            lectureSelect.value = currentValue;
        }
    }

    const tbody = document.querySelector('#attendanceHistoryTableData tbody');
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="py-3">
                    <div class="skeleton-box skeleton-text-md"></div>
                </td>
            </tr>
        `;
    }

    try {
        const res = await fetch('/api/attendance');
        if (!res.ok) return;
        const records = await res.json();
        window.attendanceHistoryCache = records || [];

        filterAttendanceHistory();
    } catch (e) {
        console.error("Attendance history error:", e);
    }
}

function filterAttendanceHistory() {
    const selectedDate = document.getElementById('historyDateInput').value;
    const selectedLecture = document.getElementById('historyLectureSelect').value;
    const selectedStatus = document.getElementById('historyStatusSelect').value;
    let records = window.attendanceHistoryCache || [];

    if (selectedDate) {
        records = records.filter(r => r.attendance_date === selectedDate);
    }

    // Filter by selected class + subject
    if (selectedLecture && selectedLecture !== 'ALL') {
        const parts = selectedLecture.split('||');
        if (parts.length === 2) {
            const filterClassName = parts[0];
            const filterSubjectName = parts[1];
            records = records.filter(r => r.class_name === filterClassName && r.subject_name === filterSubjectName);
        }
    }

    if (selectedStatus && selectedStatus !== 'ALL') {
        records = records.filter(r => r.status === selectedStatus);
    }

    const totalCount = records.length;
    const presentCount = records.filter(r => r.status === 'present').length;
    const absentCount = records.filter(r => r.status === 'absent').length;
    const rate = totalCount > 0 ? ((presentCount / totalCount) * 100).toFixed(1) + '%' : '0%';

    const totalEl = document.getElementById('historyTotalCount');
    const presentEl = document.getElementById('historyPresentCount');
    const absentEl = document.getElementById('historyAbsentCount');
    const rateEl = document.getElementById('historyRate');

    if (totalEl) totalEl.textContent = totalCount;
    if (presentEl) presentEl.textContent = presentCount;
    if (absentEl) absentEl.textContent = absentCount;
    if (rateEl) rateEl.textContent = rate;

    const tbody = document.querySelector('#attendanceHistoryTableData tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (records.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center py-4 text-muted">
                    <i class="fa-solid fa-folder-open d-block mb-2" style="font-size: 1.5rem; opacity: 0.5;"></i>
                    No attendance records found for the selected filter.
                </td>
            </tr>
        `;
        return;
    }

    records.forEach(row => {
        let badgeClass = row.status === 'present' ? 'status-present' : row.status === 'absent' ? 'status-absent' : 'status-late';
        tbody.innerHTML += `
            <tr>
                <td data-label="Date" class="fw-semibold text-secondary" style="font-size: 12px;">${row.attendance_date}</td>
                <td data-label="Class"><span class="fw-medium">${row.class_name}</span></td>
                <td data-label="Subject">${row.subject_name}</td>
                <td data-label="Student" class="fw-medium">${row.student_name} <span class="text-muted" style="font-size: 11px;">(Roll: ${row.roll_number})</span></td>
                <td data-label="Status"><span class="status-badge ${badgeClass}">${row.status}</span></td>
            </tr>
        `;
    });
}

// --- Create Class Form Handler ---
async function submitCreateClass(e) {
    e.preventDefault();
    const className = document.getElementById('createClassName').value.trim();
    const subjectName = document.getElementById('createSubjectName').value.trim();
    const subjectCode = document.getElementById('createSubjectCode').value.trim();
    const semester = document.getElementById('createSemester').value;

    try {
        const res = await fetch('/api/classes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                className: className,
                section_name: className,
                subjectName: subjectName,
                subject_name: subjectName,
                subjectCode: subjectCode,
                semester: semester
            })
        });

        const data = await res.json();
        if (res.ok) {
            showToast(`Class **${className}** created successfully!`, 'success');
            const modalEl = document.getElementById('createClassModal');
            const modalInstance = bootstrap.Modal.getInstance(modalEl);
            if (modalInstance) modalInstance.hide();

            document.getElementById('createClassForm').reset();
            loadMyClasses();
            loadDashboardStats();
        } else {
            showToast(data.error || 'Failed to create class.', 'error');
        }
    } catch (err) {
        showToast('Error creating class.', 'error');
    }
}

// --- Add Student Form Handler ---
async function submitAddStudent(e) {
    e.preventDefault();
    const classId = document.getElementById('addStudentClassSelect').value;
    const rollNumber = document.getElementById('addStudentRoll').value.trim();
    const fullName = document.getElementById('addStudentName').value.trim();
    const email = document.getElementById('addStudentEmail').value.trim();
    const parentName = document.getElementById('addStudentParentName').value.trim();
    const parentPhone = document.getElementById('addStudentParentPhone').value.trim();

    if (!classId) {
        showToast('Please select a class first.', 'error');
        return;
    }
    if (!rollNumber || !fullName) {
        showToast('Roll number and student name are required.', 'error');
        return;
    }

    try {
        const res = await fetch('/api/students', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                class_id: parseInt(classId),
                roll_number: rollNumber,
                full_name: fullName,
                email: email,
                parent_name: parentName,
                parent_phone: parentPhone
            })
        });

        const data = await res.json();
        if (res.ok) {
            showToast(`Student **${fullName}** added successfully!`, 'success');
            const modalEl = document.getElementById('addStudentModal');
            const modalInstance = bootstrap.Modal.getInstance(modalEl);
            if (modalInstance) modalInstance.hide();

            document.getElementById('addStudentForm').reset();
            loadMyClasses();
            loadDashboardStats();
        } else {
            showToast(data.error || 'Failed to add student.', 'error');
        }
    } catch (err) {
        showToast('Error adding student.', 'error');
    }
}

/**
 * Pre-populate the Add Student class dropdown whenever the modal is opened.
 * This fixes the bug where the dropdown is empty if 'My Classes' was never visited.
 */
function initAddStudentModal() {
    const modalEl = document.getElementById('addStudentModal');
    if (!modalEl) return;
    modalEl.addEventListener('show.bs.modal', async function () {
        const classSelect = document.getElementById('addStudentClassSelect');
        if (!classSelect) return;
        // Only reload if empty (no real options loaded yet)
        if (classSelect.options.length <= 1) {
            classSelect.innerHTML = '<option value="">Loading classes...</option>';
            try {
                const res = await fetch('/api/classes');
                if (!res.ok) { classSelect.innerHTML = '<option value="">Error loading classes</option>'; return; }
                const classes = await res.json();
                classSelect.innerHTML = '<option value="">Select a class...</option>';
                (classes || []).forEach(c => {
                    classSelect.innerHTML += `<option value="${c.class_id}">${c.section_name} - ${c.subject_name}</option>`;
                });
            } catch (e) {
                classSelect.innerHTML = '<option value="">Error loading classes</option>';
            }
        }
    });
}

function viewStudentDetails(studentName, rollNo) {
    showToast(`Viewing student profile for **${studentName}** (Roll: ${rollNo})`, 'info');
}

// ============================================================
// Edit Today's Classes (Schedule) Modal Functions
// ============================================================

/**
 * Opens the Edit Today's Classes modal and pre-populates it
 * with the teacher's today timetable (from permanent classes).
 */
async function openEditScheduleModal() {
    const modalEl = document.getElementById('editScheduleModal');
    if (!modalEl) return;

    // Pre-fetch teacher's permanent subjects for the "Add Class" dropdown
    await loadTeacherSubjectsForSchedule();

    // Populate the modal table with existing today's sessions
    const tbody = document.getElementById('editScheduleModalTbody');
    const badge = document.getElementById('modalSessionBadge');

    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="py-3 text-center">
                    <div class="spinner-loading-wrapper py-2">
                        <i class="fa-solid fa-circle-notch spinner-loading-icon fs-5"></i>
                        <span style="font-size: 12px;">Loading today's schedule...</span>
                    </div>
                </td>
            </tr>
        `;
    }

    const modal = new bootstrap.Modal(modalEl);
    modal.show();

    try {
        const res = await fetch('/api/timetable/today');
        if (!res.ok) throw new Error('Failed to fetch');
        const timetable = await res.json();

        if (badge) badge.textContent = `${timetable.length} Session${timetable.length !== 1 ? 's' : ''}`;

        tbody.innerHTML = '';
        if (!timetable || timetable.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-4 text-muted" style="font-size: 12px;">
                        <i class="fa-solid fa-calendar-xmark d-block mb-2 fs-4" style="opacity:0.4;"></i>
                        No classes scheduled for today. Use "Add Class" below to add one.
                    </td>
                </tr>
            `;
            return;
        }

        timetable.forEach(t => {
            const statusBadge = t.is_marked
                ? `<span class="status-badge status-present"><i class="fa-solid fa-circle-check me-1"></i>Marked</span>`
                : `<span class="status-badge status-upcoming">${t.status || 'Scheduled'}</span>`;

            tbody.innerHTML += `
                <tr data-timetable-id="${t.timetable_id}" class="existing-schedule-row">
                    <td style="font-size: 13px;" class="fw-semibold">${t.start_time_str || t.start_time} – ${t.end_time_str || t.end_time}</td>
                    <td style="font-size: 13px;" class="fw-medium">${t.subject_name}</td>
                    <td style="font-size: 13px;">${t.class_name}</td>
                    <td style="font-size: 13px;">${t.room_number || 'Room 101'}</td>
                    <td>${statusBadge}</td>
                    <td class="text-center">
                        <span class="text-muted" style="font-size: 11px;" title="Permanent class — edit via Timetable settings">
                            <i class="fa-solid fa-lock"></i>
                        </span>
                    </td>
                </tr>
            `;
        });

    } catch (e) {
        if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="text-center py-3 text-muted">Error loading schedule.</td></tr>`;
    }
}

/**
 * Fetches teacher's permanent classes/subjects for the "Add Class" row dropdown.
 */
let _teacherSubjectsCache = null;
async function loadTeacherSubjectsForSchedule() {
    if (_teacherSubjectsCache) return _teacherSubjectsCache;
    try {
        const res = await fetch('/api/classes');
        if (!res.ok) return [];
        const classes = await res.json();
        _teacherSubjectsCache = classes || [];
        return _teacherSubjectsCache;
    } catch (e) {
        return [];
    }
}

/**
 * Adds a new editable row to the Edit Schedule modal table.
 * The teacher can set time, pick a class from their permanent classes, and set a room.
 */
async function addScheduleModalRow() {
    const tbody = document.getElementById('editScheduleModalTbody');
    if (!tbody) return;

    // Remove "no classes" placeholder row if present
    const placeholder = tbody.querySelector('td[colspan="6"]');
    if (placeholder) placeholder.closest('tr').remove();

    const subjects = await loadTeacherSubjectsForSchedule();

    let subjectOptions = `<option value="">Select Class & Subject...</option>`;
    subjects.forEach(s => {
        subjectOptions += `<option value="${s.teacher_subject_id}" data-classname="${s.section_name}">${s.section_name} — ${s.subject_name}</option>`;
    });

    const newRow = document.createElement('tr');
    newRow.className = 'new-schedule-row';
    newRow.setAttribute('data-new', 'true');
    newRow.innerHTML = `
        <td>
            <div class="d-flex gap-1 align-items-center">
                <input type="time" class="form-control form-control-sm sched-start" value="09:00" style="width:100px; font-size:12px;">
                <span class="text-muted" style="font-size:11px;">–</span>
                <input type="time" class="form-control form-control-sm sched-end" value="10:00" style="width:100px; font-size:12px;">
            </div>
        </td>
        <td colspan="2">
            <select class="form-select form-select-sm sched-subject" style="font-size:12px; min-width:220px;">
                ${subjectOptions}
            </select>
        </td>
        <td>
            <input type="text" class="form-control form-control-sm sched-room" placeholder="e.g. Room 102" value="Room 101" style="font-size:12px;">
        </td>
        <td>
            <span class="status-badge status-upcoming" style="font-size:10px;">New</span>
        </td>
        <td class="text-center">
            <button type="button" class="btn btn-sm" style="color:var(--absent);background:none;border:none;padding:2px 6px;font-size:1rem;" title="Remove row" onclick="this.closest('tr').remove()">
                <i class="fa-solid fa-trash-can"></i>
            </button>
        </td>
    `;
    tbody.appendChild(newRow);
}

/**
 * Saves all newly added schedule rows to the backend.
 * Existing/permanent rows are locked (skip them).
 */
async function saveScheduleChanges() {
    const tbody = document.getElementById('editScheduleModalTbody');
    if (!tbody) return;

    const newRows = tbody.querySelectorAll('tr[data-new="true"]');
    if (newRows.length === 0) {
        showToast('No new classes to save. Use "Add Class" to add new sessions.', 'info');
        return;
    }

    const today = new Date();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const todayName = dayNames[today.getDay()];

    const toCreate = [];
    let hasError = false;

    newRows.forEach(row => {
        const startInput = row.querySelector('.sched-start');
        const endInput = row.querySelector('.sched-end');
        const subjectSelect = row.querySelector('.sched-subject');
        const roomInput = row.querySelector('.sched-room');

        const teacherSubjectId = subjectSelect ? subjectSelect.value : '';
        const startTime = startInput ? startInput.value : '';
        const endTime = endInput ? endInput.value : '';
        const room = roomInput ? roomInput.value.trim() : 'Room 101';

        if (!teacherSubjectId || !startTime || !endTime) {
            row.style.outline = '2px solid var(--absent)';
            hasError = true;
            return;
        }

        if (startTime >= endTime) {
            showToast('End time must be after start time.', 'error');
            hasError = true;
            return;
        }

        row.style.outline = '';
        toCreate.push({ teacher_subject_id: parseInt(teacherSubjectId), day_of_week: todayName, start_time: startTime + ':00', end_time: endTime + ':00', room_number: room });
    });

    if (hasError) {
        showToast('Please fill in all required fields for new rows.', 'error');
        return;
    }

    // Save each new row
    const saveBtn = document.querySelector('#editScheduleModal .modal-footer .btn-primary-custom');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin me-1"></i> Saving...'; }

    let savedCount = 0;
    let errorCount = 0;

    for (const entry of toCreate) {
        try {
            const res = await fetch('/api/timetable', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(entry)
            });
            if (res.ok) {
                savedCount++;
            } else {
                const data = await res.json();
                showToast(`Error: ${data.error || 'Failed to save a session.'}`, 'error');
                errorCount++;
            }
        } catch (e) {
            errorCount++;
        }
    }

    if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = '<i class="fa-solid fa-check me-1"></i> Save Changes'; }

    if (savedCount > 0) {
        showToast(`✅ ${savedCount} new class session${savedCount > 1 ? 's' : ''} added to today's schedule!`, 'success');
        // Close the modal and reload
        const modalEl = document.getElementById('editScheduleModal');
        const modalInstance = bootstrap.Modal.getInstance(modalEl);
        if (modalInstance) modalInstance.hide();
        // Refresh dashboard schedule
        loadTodaySchedule();
        loadDashboardStats();
        // Invalidate cache so next open fetches fresh data
        _teacherSubjectsCache = null;
    }
}

// ============================================================
// Settings Functions
// ============================================================

function loadSettings() {
    // Load profile from session data
    const authUser = window.AuthService ? window.AuthService.getUser() : null;
    if (authUser) {
        const nameEl = document.getElementById('settingsFullName');
        const emailEl = document.getElementById('settingsEmail');
        const roleEl = document.getElementById('settingsRole');
        const teacherIdEl = document.getElementById('settingsTeacherId');
        if (nameEl) nameEl.value = authUser.full_name || '';
        if (emailEl) emailEl.value = authUser.email || '';
        if (roleEl) roleEl.value = (authUser.role || 'teacher').charAt(0).toUpperCase() + (authUser.role || 'teacher').slice(1);
        if (teacherIdEl) teacherIdEl.value = authUser.teacher_id ? `T-${authUser.teacher_id}` : (authUser.user_id ? `T-${authUser.user_id}` : 'N/A');
    }

    // Load saved settings from localStorage
    const saved = JSON.parse(localStorage.getItem('erpSettings') || '{}');

    // Attendance Policy elements
    const defaultMarkStatus = document.getElementById('settingsDefaultMarkStatus');
    const lateWeightage = document.getElementById('settingsLateWeightage');
    const lateGracePeriod = document.getElementById('settingsLateGracePeriod');
    const editLock = document.getElementById('settingsEditLock');

    if (defaultMarkStatus && saved.defaultMarkStatus) defaultMarkStatus.value = saved.defaultMarkStatus;
    if (lateWeightage && saved.lateWeightage !== undefined) lateWeightage.value = saved.lateWeightage;
    if (lateGracePeriod && saved.lateGracePeriod !== undefined) lateGracePeriod.value = saved.lateGracePeriod;
    if (editLock && saved.editLock) editLock.value = saved.editLock;

    // Notification elements
    const whatsappToggle = document.getElementById('settingsWhatsappEnabled');
    const absentOnlyToggle = document.getElementById('settingsAbsentOnlyAlert');
    const thresholdSlider = document.getElementById('settingsThreshold');
    const thresholdLabel = document.getElementById('thresholdValue');

    if (whatsappToggle && saved.whatsappEnabled !== undefined) whatsappToggle.checked = saved.whatsappEnabled;
    if (absentOnlyToggle && saved.absentOnlyAlert !== undefined) absentOnlyToggle.checked = saved.absentOnlyAlert;
    if (thresholdSlider && saved.threshold !== undefined) { thresholdSlider.value = saved.threshold; }
    if (thresholdLabel && thresholdSlider) thresholdLabel.textContent = `${thresholdSlider.value}%`;

    // Report preferences
    const defaultExportFormat = document.getElementById('settingsDefaultExportFormat');
    const highlightDefaulters = document.getElementById('settingsHighlightDefaulters');
    const includeSignatures = document.getElementById('settingsIncludeSignatures');

    if (defaultExportFormat && saved.defaultExportFormat) defaultExportFormat.value = saved.defaultExportFormat;
    if (highlightDefaulters && saved.highlightDefaulters !== undefined) highlightDefaulters.checked = saved.highlightDefaulters;
    if (includeSignatures && saved.includeSignatures !== undefined) includeSignatures.checked = saved.includeSignatures;

    // Display & Session elements
    const defaultPage = document.getElementById('settingsDefaultPage');
    const recordsPerPage = document.getElementById('settingsRecordsPerPage');
    const sessionTimeout = document.getElementById('settingsSessionTimeout');

    if (defaultPage && saved.defaultPage) defaultPage.value = saved.defaultPage;
    if (recordsPerPage && saved.recordsPerPage) recordsPerPage.value = saved.recordsPerPage;
    if (sessionTimeout && saved.sessionTimeout !== undefined) sessionTimeout.value = saved.sessionTimeout;

    // Academic Configuration
    const academicYear = document.getElementById('settingsAcademicYear');
    const semesterTerm = document.getElementById('settingsSemesterTerm');
    const department = document.getElementById('settingsDepartment');
    const institution = document.getElementById('settingsInstitution');

    if (academicYear && saved.academicYear) academicYear.value = saved.academicYear;
    if (semesterTerm && saved.semesterTerm) semesterTerm.value = saved.semesterTerm;
    if (department && saved.department) department.value = saved.department;
    if (institution && saved.institution) institution.value = saved.institution;

    // Threshold slider live update
    if (thresholdSlider) {
        thresholdSlider.oninput = function() {
            if (thresholdLabel) thresholdLabel.textContent = `${this.value}%`;
        };
    }

    // Update theme label
    updateSettingsThemeLabel();

    // Store global references
    window._erpSettings = saved;

    // Initialize keyboard shortcuts if not done
    initKeyboardShortcuts();
}

function updateSettingsThemeLabel() {
    const currentTheme = document.documentElement.getAttribute('data-bs-theme') || 'light';
    const label = document.getElementById('settingsThemeLabel');
    const icon = document.getElementById('settingsThemeIcon');
    if (label) label.textContent = currentTheme === 'dark' ? 'Dark Mode' : 'Light Mode';
    if (icon) icon.className = currentTheme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
}

function saveSettings() {
    const settings = {
        // Attendance Automation
        defaultMarkStatus: document.getElementById('settingsDefaultMarkStatus')?.value ?? 'present',
        lateWeightage: document.getElementById('settingsLateWeightage')?.value ?? '1.0',
        lateGracePeriod: document.getElementById('settingsLateGracePeriod')?.value ?? '10',
        editLock: document.getElementById('settingsEditLock')?.value ?? 'never',

        // Notifications
        whatsappEnabled: document.getElementById('settingsWhatsappEnabled')?.checked ?? true,
        absentOnlyAlert: document.getElementById('settingsAbsentOnlyAlert')?.checked ?? false,
        threshold: document.getElementById('settingsThreshold')?.value ?? '75',

        // Reports
        defaultExportFormat: document.getElementById('settingsDefaultExportFormat')?.value ?? 'pdf',
        highlightDefaulters: document.getElementById('settingsHighlightDefaulters')?.checked ?? true,
        includeSignatures: document.getElementById('settingsIncludeSignatures')?.checked ?? true,

        // Display & Session
        defaultPage: document.getElementById('settingsDefaultPage')?.value ?? 'Dashboard',
        recordsPerPage: document.getElementById('settingsRecordsPerPage')?.value ?? '25',
        sessionTimeout: document.getElementById('settingsSessionTimeout')?.value ?? '30',

        // Academic
        academicYear: document.getElementById('settingsAcademicYear')?.value ?? '2026-27',
        semesterTerm: document.getElementById('settingsSemesterTerm')?.value ?? 'odd',
        department: document.getElementById('settingsDepartment')?.value ?? 'Computer Engineering',
        institution: document.getElementById('settingsInstitution')?.value ?? 'College of Engineering'
    };

    localStorage.setItem('erpSettings', JSON.stringify(settings));
    window._erpSettings = settings;

    showToast('All ERP preferences saved successfully!', 'success');
}

async function changeTeacherPassword() {
    const currentPassword = document.getElementById('settingsCurrentPassword')?.value?.trim();
    const newPassword = document.getElementById('settingsNewPassword')?.value?.trim();

    if (!currentPassword || !newPassword) {
        showToast('Please enter both your current and new password.', 'error');
        return;
    }

    if (newPassword.length < 6) {
        showToast('New password must be at least 6 characters long.', 'error');
        return;
    }

    try {
        const res = await fetch('/api/auth/change-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ current_password: currentPassword, new_password: newPassword })
        });

        const data = await res.json();
        if (res.ok) {
            showToast('Password updated successfully!', 'success');
            const curInput = document.getElementById('settingsCurrentPassword');
            const newInput = document.getElementById('settingsNewPassword');
            if (curInput) curInput.value = '';
            if (newInput) newInput.value = '';
        } else {
            showToast(data.error || 'Failed to update password.', 'error');
        }
    } catch (e) {
        showToast('Error updating password: ' + e.message, 'error');
    }
}

function exportSettingsBackup() {
    const settings = localStorage.getItem('erpSettings') || '{}';
    const blob = new Blob([settings], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `erp_settings_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Settings backup downloaded!', 'success');
}

function importSettingsBackup(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const imported = JSON.parse(e.target.result);
            if (typeof imported === 'object' && imported !== null) {
                localStorage.setItem('erpSettings', JSON.stringify(imported));
                loadSettings();
                showToast('Settings restored successfully from backup!', 'success');
            } else {
                showToast('Invalid settings file format.', 'error');
            }
        } catch (err) {
            showToast('Error parsing settings file: ' + err.message, 'error');
        }
    };
    reader.readAsText(file);
    event.target.value = ''; // Reset input
}

function initKeyboardShortcuts() {
    if (window._erpShortcutsInitialized) return;
    window._erpShortcutsInitialized = true;

    document.addEventListener('keydown', function(e) {
        // Do not trigger shortcuts when user is typing in form inputs
        const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
        const isInput = activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select';

        // Alt + 1..5 for Navigation
        if (e.altKey && !e.ctrlKey && !e.shiftKey) {
            if (e.key === '1') { e.preventDefault(); switchSection('Dashboard'); }
            else if (e.key === '2') { e.preventDefault(); switchSection('Mark Attendance'); }
            else if (e.key === '3') { e.preventDefault(); switchSection('My Classes'); }
            else if (e.key === '4') { e.preventDefault(); switchSection('Attendance History'); }
            else if (e.key === '5') { e.preventDefault(); switchSection('Reports'); }
        }

        // Ctrl + Space or Ctrl + B for Chatbot toggle
        if ((e.ctrlKey && e.code === 'Space') || (e.ctrlKey && e.key.toLowerCase() === 'b')) {
            e.preventDefault();
            const chatbotTrigger = document.getElementById('chatbotTriggerBtn');
            if (chatbotTrigger) chatbotTrigger.click();
        }

        // Escape to close modals or chatbot
        if (e.key === 'Escape') {
            const chatbotModal = document.getElementById('chatbotContainer');
            if (chatbotModal && chatbotModal.classList.contains('active')) {
                const closeBtn = document.getElementById('chatbotCloseBtn');
                if (closeBtn) closeBtn.click();
            }
        }
    });
}

// ============================================================
// Monthly Reports Functions
// ============================================================

async function loadReportFilters() {
    // Set current month
    const monthSelect = document.getElementById('reportMonth');
    const yearInput = document.getElementById('reportYear');
    if (monthSelect) monthSelect.value = new Date().getMonth() + 1;
    if (yearInput) yearInput.value = new Date().getFullYear();

    // Load classes for filter
    const classFilter = document.getElementById('reportClassFilter');
    if (!classFilter) return;
    try {
        const res = await fetch('/api/classes');
        if (!res.ok) return;
        const classes = await res.json();
        classFilter.innerHTML = '<option value="">All Classes</option>';
        const seen = new Set();
        (classes || []).forEach(c => {
            if (!seen.has(c.class_id)) {
                seen.add(c.class_id);
                classFilter.innerHTML += `<option value="${c.class_id}">${c.section_name}</option>`;
            }
        });
    } catch (e) {
        console.error('Error loading report classes:', e);
    }
}

async function generateMonthlyReport() {
    const month = document.getElementById('reportMonth').value;
    const year = document.getElementById('reportYear').value;
    const classId = document.getElementById('reportClassFilter').value;
    const outputArea = document.getElementById('reportOutputArea');

    if (!outputArea) return;

    outputArea.innerHTML = `
        <div class="dashboard-card">
            <div class="text-center py-4">
                <div class="spinner-loading-wrapper">
                    <i class="fa-solid fa-circle-notch spinner-loading-icon fs-3"></i>
                    <span style="font-size: 13px; font-weight: 500;">Generating monthly class-wise attendance report...</span>
                </div>
            </div>
        </div>
    `;

    try {
        let url = `/api/reports/monthly-report?month=${month}&year=${year}`;
        if (classId) url += `&class_id=${classId}`;

        const res = await fetch(url);
        if (!res.ok) {
            outputArea.innerHTML = `<div class="dashboard-card"><p class="text-danger">Error generating report.</p></div>`;
            return;
        }
        const data = await res.json();

        // Store current params for download
        window._reportParams = { month, year, classId };

        if (!data.classes || data.classes.length === 0) {
            outputArea.innerHTML = `
                <div class="dashboard-card">
                    <div class="text-center py-4 text-muted">
                        <i class="fa-solid fa-folder-open d-block mb-2" style="font-size: 2rem; opacity: 0.4;"></i>
                        <p class="mb-0" style="font-size: 13px;">No attendance data found for ${data.month_name} ${data.year}.</p>
                    </div>
                </div>
            `;
            return;
        }

        const summary = data.summary || {};
        const avgColor = (summary.overall_attendance_pct >= 75) ? 'var(--present)' : (summary.overall_attendance_pct >= 50 ? 'var(--pending)' : 'var(--absent)');

        let html = `
            <!-- Top Report Banner with Global Export Actions -->
            <div class="dashboard-card mb-3">
                <div class="d-flex flex-wrap justify-content-between align-items-center gap-2">
                    <div>
                        <h5 class="fw-semibold mb-1" style="font-size: 1.05rem; color: var(--text-primary);">
                            <i class="fa-solid fa-calendar-check me-2" style="color: var(--primary);"></i>
                            ${data.month_name} ${data.year} — Monthly Attendance Report
                        </h5>
                        <p class="text-muted mb-0" style="font-size: 12px;">
                            Period: <strong>${data.start_date}</strong> to <strong>${data.end_date}</strong> &nbsp;|&nbsp; 
                            Covering <strong>${data.classes.length}</strong> class(es) &nbsp;|&nbsp;
                            <strong>${summary.total_students || 0}</strong> students
                        </p>
                    </div>
                    <div class="d-flex gap-2">
                        <button class="btn-outline-custom" onclick="downloadReportPDF()" style="font-size: 12px; padding: 0.4rem 0.85rem;" title="Download complete monthly report as PDF">
                            <i class="fa-solid fa-file-pdf me-1" style="color: #dc2626;"></i> Download Full PDF
                        </button>
                        <button class="btn-outline-custom" onclick="downloadReportExcel()" style="font-size: 12px; padding: 0.4rem 0.85rem;" title="Download complete monthly report as Excel">
                            <i class="fa-solid fa-file-excel me-1" style="color: #059669;"></i> Download Full Excel
                        </button>
                    </div>
                </div>
            </div>

            <!-- Executive KPI Metric Cards -->
            <div class="row g-2 mb-3">
                <div class="col-md-2 col-sm-4 col-6">
                    <div class="dashboard-card mb-0 p-3 text-center" style="border-top: 3px solid var(--primary);">
                        <div class="text-muted fw-medium" style="font-size: 11px;">Total Classes</div>
                        <div class="fs-4 fw-bold mt-1" style="color: var(--primary);">${summary.total_classes || 0}</div>
                    </div>
                </div>
                <div class="col-md-2 col-sm-4 col-6">
                    <div class="dashboard-card mb-0 p-3 text-center" style="border-top: 3px solid var(--primary-dark);">
                        <div class="text-muted fw-medium" style="font-size: 11px;">Enrolled Students</div>
                        <div class="fs-4 fw-bold mt-1" style="color: var(--text-primary);">${summary.total_students || 0}</div>
                    </div>
                </div>
                <div class="col-md-2 col-sm-4 col-6">
                    <div class="dashboard-card mb-0 p-3 text-center" style="border-top: 3px solid var(--present);">
                        <div class="text-muted fw-medium" style="font-size: 11px;">Total Present</div>
                        <div class="fs-4 fw-bold mt-1" style="color: var(--present);">${summary.total_present || 0}</div>
                    </div>
                </div>
                <div class="col-md-2 col-sm-4 col-6">
                    <div class="dashboard-card mb-0 p-3 text-center" style="border-top: 3px solid var(--absent);">
                        <div class="text-muted fw-medium" style="font-size: 11px;">Total Absent</div>
                        <div class="fs-4 fw-bold mt-1" style="color: var(--absent);">${summary.total_absent || 0}</div>
                    </div>
                </div>
                <div class="col-md-2 col-sm-4 col-6">
                    <div class="dashboard-card mb-0 p-3 text-center" style="border-top: 3px solid ${avgColor};">
                        <div class="text-muted fw-medium" style="font-size: 11px;">Overall Average</div>
                        <div class="fs-4 fw-bold mt-1" style="color: ${avgColor};">${summary.overall_attendance_pct || 0}%</div>
                    </div>
                </div>
                <div class="col-md-2 col-sm-4 col-6">
                    <div class="dashboard-card mb-0 p-3 text-center" style="border-top: 3px solid #dc2626;">
                        <div class="text-muted fw-medium" style="font-size: 11px;">Defaulters (&lt;75%)</div>
                        <div class="fs-4 fw-bold mt-1" style="color: #dc2626;">${summary.total_defaulters || 0}</div>
                    </div>
                </div>
            </div>

            <!-- Executive Summary: Class-Wise Total Attendance Table -->
            <div class="dashboard-card mb-3">
                <div class="card-title">
                    <span><i class="fa-solid fa-table-list me-2"></i>Executive Summary: Class-Wise Total Attendance</span>
                    <span class="badge" style="background-color: var(--primary-light); color: var(--primary); font-size: 11px;">All Classes Total Comparison</span>
                </div>
                <div class="table-responsive">
                    <table class="custom-table">
                        <thead>
                            <tr>
                                <th>Class Name</th>
                                <th class="text-center">Enrolled</th>
                                <th class="text-center">Lectures Held</th>
                                <th class="text-center">Total Present</th>
                                <th class="text-center">Total Absent</th>
                                <th class="text-center">Total Late</th>
                                <th class="text-center">Class Average %</th>
                                <th class="text-center">Defaulters (&lt;75%)</th>
                                <th class="text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
        `;

        data.classes.forEach(cls => {
            const clsAvgColor = cls.average_attendance >= 75 ? 'var(--present)' : (cls.average_attendance >= 50 ? 'var(--pending)' : 'var(--absent)');
            const defaulterBadge = cls.defaulters_count > 0 
                ? `<span class="badge" style="background-color: var(--absent-light); color: var(--absent); font-weight: 600;">${cls.defaulters_count} Student(s)</span>`
                : `<span class="badge" style="background-color: var(--present-light); color: var(--present); font-weight: 600;">None (0)</span>`;

            html += `
                <tr>
                    <td class="fw-semibold" style="color: var(--primary-dark); font-size: 13px;">
                        <i class="fa-solid fa-graduation-cap me-1 text-muted"></i> ${cls.class_name}
                    </td>
                    <td class="text-center">${cls.total_students}</td>
                    <td class="text-center fw-medium">${cls.total_lectures || 0}</td>
                    <td class="text-center fw-bold" style="color: var(--present);">${cls.total_present || 0}</td>
                    <td class="text-center fw-bold" style="color: var(--absent);">${cls.total_absent || 0}</td>
                    <td class="text-center fw-medium" style="color: var(--pending);">${cls.total_late || 0}</td>
                    <td class="text-center fw-bold" style="color: ${clsAvgColor}; font-size: 13px;">${cls.average_attendance}%</td>
                    <td class="text-center">${defaulterBadge}</td>
                    <td class="text-center">
                        <div class="d-flex justify-content-center gap-1">
                            <button class="btn-outline-custom" onclick="downloadReportPDF(${cls.class_id})" style="font-size: 11px; padding: 0.2rem 0.55rem;" title="Download PDF for ${cls.class_name}">
                                <i class="fa-solid fa-file-pdf me-1" style="color: #dc2626;"></i> PDF
                            </button>
                            <button class="btn-outline-custom" onclick="downloadReportExcel(${cls.class_id})" style="font-size: 11px; padding: 0.2rem 0.55rem;" title="Download Excel for ${cls.class_name}">
                                <i class="fa-solid fa-file-excel me-1" style="color: #059669;"></i> Excel
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });

        // Grand Total Row in Comparison Table
        html += `
                        <tr style="background-color: var(--bg-hover); font-weight: 700; border-top: 2px solid var(--border-color);">
                            <td><i class="fa-solid fa-chart-pie me-1" style="color: var(--primary);"></i> OVERALL TOTAL / ALL CLASSES</td>
                            <td class="text-center">${summary.total_students || 0}</td>
                            <td class="text-center">—</td>
                            <td class="text-center" style="color: var(--present);">${summary.total_present || 0}</td>
                            <td class="text-center" style="color: var(--absent);">${summary.total_absent || 0}</td>
                            <td class="text-center" style="color: var(--pending);">${summary.total_late || 0}</td>
                            <td class="text-center fw-bold" style="color: ${avgColor}; font-size: 13px;">${summary.overall_attendance_pct || 0}%</td>
                            <td class="text-center" style="color: #dc2626;">${summary.total_defaulters || 0} Defaulter(s)</td>
                            <td class="text-center">
                                <span class="badge" style="background-color: var(--primary-light); color: var(--primary);">All Classes</span>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Section Title: Class Rosters -->
        <div class="d-flex align-items-center justify-content-between mb-2 mt-4">
            <h6 class="fw-bold mb-0" style="color: var(--text-primary); font-size: 0.95rem;">
                <i class="fa-solid fa-users-rectangle me-2" style="color: var(--primary);"></i>
                Class-Wise Detailed Student Rosters
            </h6>
            <span class="text-muted" style="font-size: 11px;">Showing all student lecture breakdowns & defaulter flags</span>
        </div>
        `;

        // Render detailed cards for each class
        data.classes.forEach(cls => {
            let tableRows = '';
            cls.students.forEach(s => {
                const pctColor = s.attendance_percentage >= 75 ? 'var(--present)' : (s.attendance_percentage >= 50 ? 'var(--pending)' : 'var(--absent)');
                const isDefaulter = s.attendance_percentage < 75;
                const statusBadge = isDefaulter
                    ? `<span class="badge" style="background-color: var(--absent-light); color: var(--absent); font-weight: 600;">Defaulter</span>`
                    : `<span class="badge" style="background-color: var(--present-light); color: var(--present); font-weight: 600;">Regular</span>`;

                tableRows += `
                    <tr style="${isDefaulter ? 'background-color: rgba(220, 38, 38, 0.03);' : ''}">
                        <td class="fw-semibold text-secondary" style="font-size: 12px;">${s.roll_number}</td>
                        <td class="fw-medium">
                            ${s.full_name}
                            ${isDefaulter ? '<i class="fa-solid fa-triangle-exclamation ms-1 text-danger" title="Low attendance alert (<75%)"></i>' : ''}
                        </td>
                        <td class="text-center">${s.total_lectures}</td>
                        <td class="text-center" style="color: var(--present);">${s.present_count}</td>
                        <td class="text-center" style="color: var(--absent);">${s.absent_count}</td>
                        <td class="text-center" style="color: var(--pending);">${s.late_count}</td>
                        <td class="text-center fw-bold" style="color: ${pctColor};">${s.attendance_percentage}%</td>
                        <td class="text-center">${statusBadge}</td>
                    </tr>
                `;
            });

            const clsAvgColor = cls.average_attendance >= 75 ? 'var(--present)' : (cls.average_attendance >= 50 ? 'var(--pending)' : 'var(--absent)');

            html += `
                <div class="dashboard-card mb-3">
                    <div class="card-title">
                        <div class="d-flex align-items-center gap-2 flex-wrap">
                            <span><i class="fa-solid fa-chalkboard-user me-2"></i>Class: ${cls.class_name}</span>
                            <span class="badge" style="background-color: var(--primary-light); color: var(--primary); font-size: 11px;">${cls.total_students} Students</span>
                            <span class="badge" style="background-color: ${clsAvgColor}20; color: ${clsAvgColor}; font-size: 11px;">Avg: ${cls.average_attendance}%</span>
                            <span class="badge" style="background-color: #dc262618; color: #dc2626; font-size: 11px;">${cls.defaulters_count} Defaulter(s)</span>
                        </div>
                        <div class="d-flex gap-2 align-items-center">
                            <button class="btn-outline-custom" onclick="downloadReportPDF(${cls.class_id})" style="font-size: 11px; padding: 0.25rem 0.65rem;" title="Download PDF for ${cls.class_name}">
                                <i class="fa-solid fa-file-pdf me-1" style="color: #dc2626;"></i> PDF
                            </button>
                            <button class="btn-outline-custom" onclick="downloadReportExcel(${cls.class_id})" style="font-size: 11px; padding: 0.25rem 0.65rem;" title="Download Excel for ${cls.class_name}">
                                <i class="fa-solid fa-file-excel me-1" style="color: #059669;"></i> Excel
                            </button>
                        </div>
                    </div>
                    <div class="table-responsive">
                        <table class="custom-table">
                            <thead>
                                <tr>
                                    <th>Roll No</th>
                                    <th>Student Name</th>
                                    <th class="text-center">Total Lectures</th>
                                    <th class="text-center">Present</th>
                                    <th class="text-center">Absent</th>
                                    <th class="text-center">Late</th>
                                    <th class="text-center">Attendance %</th>
                                    <th class="text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${tableRows}
                                <tr style="background-color: var(--bg-hover); font-weight: 700;">
                                    <td></td>
                                    <td>CLASS TOTAL / AVERAGE (${cls.total_students} students)</td>
                                    <td class="text-center">${cls.total_lectures || 0}</td>
                                    <td class="text-center" style="color: var(--present);">${cls.total_present || 0}</td>
                                    <td class="text-center" style="color: var(--absent);">${cls.total_absent || 0}</td>
                                    <td class="text-center" style="color: var(--pending);">${cls.total_late || 0}</td>
                                    <td class="text-center fw-bold" style="color: ${clsAvgColor};">${cls.average_attendance}%</td>
                                    <td class="text-center" style="color: #dc2626;">${cls.defaulters_count} Defaulter(s)</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        });

        outputArea.innerHTML = html;
        showToast(`Report generated for ${data.month_name} ${data.year}!`, 'success');

    } catch (e) {
        outputArea.innerHTML = `<div class="dashboard-card"><p class="text-danger">Error generating report: ${e.message}</p></div>`;
    }
}

function downloadReportPDF(classId) {
    const month = document.getElementById('reportMonth')?.value || window._reportParams?.month || (new Date().getMonth() + 1);
    const year = document.getElementById('reportYear')?.value || window._reportParams?.year || new Date().getFullYear();
    const filterClassId = classId !== undefined ? classId : (document.getElementById('reportClassFilter')?.value || window._reportParams?.classId || '');

    let url = `/api/reports/monthly-report/download?month=${month}&year=${year}`;
    if (filterClassId) url += `&class_id=${filterClassId}`;

    showToast('Generating and downloading PDF report...', 'info');
    window.open(url, '_blank');
}

function downloadReportExcel(classId) {
    const month = document.getElementById('reportMonth')?.value || window._reportParams?.month || (new Date().getMonth() + 1);
    const year = document.getElementById('reportYear')?.value || window._reportParams?.year || new Date().getFullYear();
    const filterClassId = classId !== undefined ? classId : (document.getElementById('reportClassFilter')?.value || window._reportParams?.classId || '');

    let url = `/api/reports/monthly-report/excel?month=${month}&year=${year}`;
    if (filterClassId) url += `&class_id=${filterClassId}`;

    showToast('Generating and downloading Excel report...', 'info');
    window.open(url, '_blank');
}

// ============================================================

function simulateLogout() {
    if (confirm("Are you sure you want to logout of Smart Attendance ERP?")) {
        showToast("Logging out...", "info");
        setTimeout(() => {
            if (window.AuthService) {
                window.AuthService.logout('/login');
            } else {
                window.location.replace('/login');
            }
        }, 350);
    }
}

function triggerAction(actionName) {
    showToast(`Action Triggered: **${actionName}**`, 'info');
}

// --- Custom Toast Notification ---
function showToast(message, type = 'info') {
    let toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toastContainer';
        toastContainer.style.position = 'fixed';
        toastContainer.style.bottom = '2rem';
        toastContainer.style.right = '2rem';
        toastContainer.style.zIndex = '9999';
        toastContainer.style.display = 'flex';
        toastContainer.style.flexDirection = 'column';
        toastContainer.style.gap = '0.5rem';
        document.body.appendChild(toastContainer);
    }

    let bgColor = 'var(--primary-dark, #0d3b4c)';
    let icon = '<i class="fa-solid fa-circle-info me-2"></i>';
    if (type === 'success') {
        bgColor = '#059669';
        icon = '<i class="fa-solid fa-circle-check me-2"></i>';
    } else if (type === 'error') {
        bgColor = '#dc2626';
        icon = '<i class="fa-solid fa-circle-xmark me-2"></i>';
    }

    const toast = document.createElement('div');
    toast.style.background = bgColor;
    toast.style.color = '#ffffff';
    toast.style.padding = '0.75rem 1.25rem';
    toast.style.borderRadius = '8px';
    toast.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.2)';
    toast.style.fontSize = '0.825rem';
    toast.style.fontWeight = '500';
    toast.style.display = 'flex';
    toast.style.alignItems = 'center';
    toast.style.minWidth = '280px';
    toast.style.maxWidth = '380px';

    const formattedMsg = message.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    toast.innerHTML = `${icon} <span style="flex-grow: 1;">${formattedMsg}</span>`;

    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&times;';
    closeBtn.style.background = 'none';
    closeBtn.style.border = 'none';
    closeBtn.style.color = '#ffffff';
    closeBtn.style.fontSize = '1.2rem';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.marginLeft = '1rem';
    closeBtn.addEventListener('click', () => toast.remove());
    toast.appendChild(closeBtn);

    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 4000);
}

