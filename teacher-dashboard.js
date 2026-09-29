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

    // History Filter Event Listeners
    const historyDateInput = document.getElementById('historyDateInput');
    const historyLectureSelect = document.getElementById('historyLectureSelect');
    const historyStatusSelect = document.getElementById('historyStatusSelect');

    if (historyDateInput) historyDateInput.addEventListener('change', filterAttendanceHistory);
    if (historyLectureSelect) historyLectureSelect.addEventListener('change', filterAttendanceHistory);
    if (historyStatusSelect) historyStatusSelect.addEventListener('change', filterAttendanceHistory);
});

// --- Today's Schedule Management & Persistence ---
const STORAGE_KEY_SCHEDULE = 'smart_attendance_today_schedule';
const DIVISION_OPTIONS = [
    "SY Computer A",
    "SY Computer B",
    "TY IT A",
    "TY IT B",
    "Final Year CS"
];

const DEFAULT_TODAY_SCHEDULE = [
    {
        id: "sch_1",
        time: "09:00 AM",
        subject: "Data Structures",
        className: "SY Computer A",
        room: "Lab 5",
        status: "Completed"
    },
    {
        id: "sch_2",
        time: "11:15 AM",
        subject: "Operating Systems",
        className: "TY IT B",
        room: "Room 302",
        status: "Completed"
    },
    {
        id: "sch_3",
        time: "02:00 PM",
        subject: "Software Engineering",
        className: "SY Computer A",
        room: "Room 204",
        status: "Pending"
    },
    {
        id: "sch_4",
        time: "03:45 PM",
        subject: "Machine Learning",
        className: "Final Year CS",
        room: "Lab 2",
        status: "Upcoming"
    }
];

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatTimeRange(timeStr) {
    if (!timeStr) return "Scheduled";
    if (timeStr.includes("–") || timeStr.includes("-")) {
        return timeStr;
    }
    const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return timeStr;
    let hour = parseInt(match[1], 10);
    const min = match[2];
    let ampm = match[3].toUpperCase();
    
    let endHour = hour + 1;
    let endAmpm = ampm;
    if (endHour === 12) {
        endAmpm = (ampm === 'AM') ? 'PM' : 'AM';
    } else if (endHour > 12) {
        endHour = endHour - 12;
    }
    const padHour = String(endHour).padStart(2, '0');
    return `${timeStr} – ${padHour}:${min} ${endAmpm}`;
}

function formatNextLectureTime(currentTimeStr) {
    if (!currentTimeStr) return '04:30 PM';
    const match = currentTimeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return '04:30 PM';
    let hour = parseInt(match[1], 10);
    const min = match[2];
    let ampm = match[3].toUpperCase();
    hour = hour + 1;
    if (hour === 12) {
        ampm = (ampm === 'AM') ? 'PM' : 'AM';
    } else if (hour > 12) {
        hour = hour - 12;
    }
    return `${String(hour).padStart(2, '0')}:${min} ${ampm}`;
}

function getTodaySchedule() {
    const saved = localStorage.getItem(STORAGE_KEY_SCHEDULE);
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
                return parsed;
            }
        } catch (e) {
            console.error("Error reading stored schedule:", e);
        }
    }
    return JSON.parse(JSON.stringify(DEFAULT_TODAY_SCHEDULE));
}

function renderTodaySchedule(schedule) {
    const tbody = document.getElementById('todayScheduleTbody');
    if (!tbody) return;

    if (!schedule || schedule.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-4 text-muted">
                    <i class="fa-regular fa-calendar-xmark d-block mb-2" style="font-size: 1.5rem; opacity: 0.5;"></i>
                    No classes scheduled for today. Click <strong>✏️ Edit</strong> above to add lectures.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = schedule.map(item => {
        let badgeHtml = '';
        let actionBtnHtml = '';
        const safeSubject = escapeHtml(item.subject);
        
        if (item.status === 'Completed') {
            badgeHtml = `<span class="status-badge status-present"><i class="fa-solid fa-circle-check"></i> Completed</span>`;
            actionBtnHtml = `<button class="btn-outline-custom" onclick="triggerAction('View Attendance - ${safeSubject}')"><i class="fa-regular fa-eye"></i> View</button>`;
        } else if (item.status === 'Pending') {
            badgeHtml = `<span class="status-badge status-inprogress"><i class="fa-solid fa-rotate"></i> Pending</span>`;
            actionBtnHtml = `<button class="btn-primary-custom" onclick="simulateNav('Mark Attendance')"><i class="fa-solid fa-clipboard-user"></i> Mark</button>`;
        } else {
            badgeHtml = `<span class="status-badge status-upcoming"><i class="fa-regular fa-clock"></i> Upcoming</span>`;
            actionBtnHtml = `<button class="btn-outline-custom" onclick="triggerAction('Class Details - ${safeSubject}')"><i class="fa-solid fa-arrow-right"></i> Details</button>`;
        }

        return `
            <tr>
                <td class="fw-semibold">${escapeHtml(item.time)}</td>
                <td class="fw-medium">${safeSubject}</td>
                <td>${escapeHtml(item.className)}</td>
                <td>${escapeHtml(item.room)}</td>
                <td>${badgeHtml}</td>
                <td class="text-end">${actionBtnHtml}</td>
            </tr>
        `;
    }).join('');
}

function updateDashboardScheduleStats(schedule) {
    const total = schedule.length;
    const completed = schedule.filter(s => s.status === 'Completed').length;
    const pending = schedule.filter(s => s.status === 'Pending').length;
    const remaining = total - completed;

    // 1. Badge next to card title
    const sessionBadge = document.getElementById('scheduleSessionBadge');
    if (sessionBadge) {
        sessionBadge.textContent = `${total} ${total === 1 ? 'Session' : 'Sessions'}`;
    }

    // 2. Stat 1 (Today's Classes)
    const statTodayClasses = document.getElementById('statTodayClasses');
    if (statTodayClasses) {
        statTodayClasses.textContent = `${total} ${total === 1 ? 'Lecture' : 'Lectures'}`;
    }
    const statTodayDesc = document.getElementById('statTodayDesc');
    if (statTodayDesc) {
        statTodayDesc.textContent = `${completed} Completed, ${remaining} Remaining`;
    }

    // 3. Welcome Bar Subtext
    const welcomeSubtext = document.getElementById('welcomeSubtext');
    if (welcomeSubtext) {
        welcomeSubtext.textContent = `You have ${remaining} ${remaining === 1 ? 'class' : 'classes'} remaining today and ${pending} attendance ${pending === 1 ? 'record' : 'records'} pending.`;
    }

    // 4. Stat 3 (Attendance Submitted)
    const statAttendanceSubmitted = document.getElementById('statAttendanceSubmitted');
    if (statAttendanceSubmitted) {
        statAttendanceSubmitted.textContent = `${completed} / ${total} Classes`;
    }
    const statAttendanceSubmittedDesc = document.getElementById('statAttendanceSubmittedDesc');
    if (statAttendanceSubmittedDesc) {
        const submitPct = total > 0 ? Math.round((completed / total) * 100) : 0;
        statAttendanceSubmittedDesc.textContent = `${submitPct}% daily submission`;
    }

    // 5. Stat 6 (Pending Attendance)
    const statPendingAttendance = document.getElementById('statPendingAttendance');
    if (statPendingAttendance) {
        statPendingAttendance.textContent = `${pending} ${pending === 1 ? 'Class' : 'Classes'}`;
    }
    const statPendingAttendanceDesc = document.getElementById('statPendingAttendanceDesc');
    if (statPendingAttendanceDesc) {
        statPendingAttendanceDesc.textContent = pending > 0 ? 'Due before 05:00 PM' : 'All submitted';
    }

    // 6. Attendance Summary Widget (Pending Verification)
    const summaryPendingCount = document.getElementById('summaryPendingCount');
    if (summaryPendingCount) {
        summaryPendingCount.textContent = `${pending} ${pending === 1 ? 'Class' : 'Classes'}`;
    }
    const summaryPendingBar = document.getElementById('summaryPendingBar');
    if (summaryPendingBar) {
        const pendingPct = total > 0 ? Math.round((pending / total) * 100) : 0;
        summaryPendingBar.style.width = `${pendingPct}%`;
    }

    // 7. Next Lecture Card
    const nextLecture = schedule.find(s => s.status === 'Pending') || schedule.find(s => s.status === 'Upcoming');
    const nextLectureSubject = document.getElementById('nextLectureSubject');
    const nextLectureTime = document.getElementById('nextLectureTime');
    const nextLectureClass = document.getElementById('nextLectureClass');
    const nextLectureRoom = document.getElementById('nextLectureRoom');
    const nextLectureBadge = document.getElementById('nextLectureBadge');

    if (nextLecture) {
        if (nextLectureSubject) nextLectureSubject.textContent = nextLecture.subject;
        if (nextLectureTime) nextLectureTime.textContent = formatTimeRange(nextLecture.time);
        if (nextLectureClass) nextLectureClass.textContent = nextLecture.className;
        if (nextLectureRoom) nextLectureRoom.textContent = nextLecture.room;
        if (nextLectureBadge) {
            if (nextLecture.status === 'Pending') {
                nextLectureBadge.className = 'status-badge status-inprogress';
                nextLectureBadge.textContent = 'Pending';
            } else {
                nextLectureBadge.className = 'status-badge status-upcoming';
                nextLectureBadge.textContent = 'Scheduled';
            }
        }
    } else if (total > 0 && completed === total) {
        if (nextLectureSubject) nextLectureSubject.textContent = 'All Lectures Completed';
        if (nextLectureTime) nextLectureTime.textContent = 'No remaining classes today';
        if (nextLectureClass) nextLectureClass.textContent = '—';
        if (nextLectureRoom) nextLectureRoom.textContent = '—';
        if (nextLectureBadge) {
            nextLectureBadge.className = 'status-badge status-present';
            nextLectureBadge.textContent = 'Done';
        }
    } else {
        if (nextLectureSubject) nextLectureSubject.textContent = 'No Lectures Scheduled';
        if (nextLectureTime) nextLectureTime.textContent = 'Click Edit to add classes';
        if (nextLectureClass) nextLectureClass.textContent = '—';
        if (nextLectureRoom) nextLectureRoom.textContent = '—';
        if (nextLectureBadge) {
            nextLectureBadge.className = 'status-badge status-upcoming';
            nextLectureBadge.textContent = 'None';
        }
    }
}

function syncMockLecturesWithSchedule(schedule) {
    if (!Array.isArray(schedule)) return;
    mockLectures.length = 0;
    schedule.forEach((item, idx) => {
        let classId = 101;
        if (item.className.includes("IT")) classId = 102;
        else if (item.className.includes("Final")) classId = 103;

        const code = item.subject.split(/\s+/).map(w => w[0]).join('').toUpperCase() || `LEC${idx + 1}`;
        mockLectures.push({
            id: item.id || `LEC_${idx + 1}`,
            timetable_id: idx + 1,
            class_id: classId,
            code: code,
            name: item.subject,
            className: item.className,
            time: item.time,
            status: item.status
        });
    });
}

function initTodaySchedule() {
    const schedule = getTodaySchedule();
    renderTodaySchedule(schedule);
    updateDashboardScheduleStats(schedule);
    syncMockLecturesWithSchedule(schedule);
}

// --- Edit Schedule Modal Handlers ---
function openEditScheduleModal() {
    const schedule = getTodaySchedule();
    const tbody = document.getElementById('editScheduleModalTbody');
    if (!tbody) return;

    tbody.innerHTML = '';
    if (schedule.length === 0) {
        tbody.innerHTML = `
            <tr id="modalEmptyRow">
                <td colspan="6" class="text-center py-3 text-muted">
                    No classes in list. Click <strong>+ Add Class</strong> to insert a class.
                </td>
            </tr>
        `;
    } else {
        schedule.forEach(item => {
            renderModalRow(item);
        });
    }

    updateModalSessionBadge();
    const modalElement = document.getElementById('editScheduleModal');
    const modalInstance = new bootstrap.Modal(modalElement);
    modalInstance.show();
}

function renderModalRow(data = {}) {
    const tbody = document.getElementById('editScheduleModalTbody');
    const emptyRow = document.getElementById('modalEmptyRow');
    if (emptyRow) emptyRow.remove();

    const time = data.time || '10:00 AM';
    const subject = data.subject || '';
    const selectedClass = data.className || 'SY Computer A';
    const room = data.room || 'Room 101';
    const status = data.status || 'Upcoming';
    const rowId = data.id || `sch_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;

    // Build division options dropdown
    let divisionOptions = DIVISION_OPTIONS.slice();
    if (selectedClass && !divisionOptions.includes(selectedClass)) {
        divisionOptions.push(selectedClass);
    }
    const divisionOptionsHtml = divisionOptions.map(div => `
        <option value="${escapeHtml(div)}" ${div === selectedClass ? 'selected' : ''}>${escapeHtml(div)}</option>
    `).join('');

    // Build status options dropdown
    const statusOptions = ['Completed', 'Pending', 'Upcoming'];
    const statusOptionsHtml = statusOptions.map(st => `
        <option value="${st}" ${st === status ? 'selected' : ''}>${st}</option>
    `).join('');

    const tr = document.createElement('tr');
    tr.className = 'schedule-edit-row';
    tr.setAttribute('data-row-id', rowId);
    tr.innerHTML = `
        <td>
            <input type="text" class="form-control schedule-row-time" value="${escapeHtml(time)}" placeholder="09:00 AM">
        </td>
        <td>
            <input type="text" class="form-control schedule-row-subject" value="${escapeHtml(subject)}" placeholder="e.g. Operating Systems">
        </td>
        <td>
            <select class="form-select schedule-row-class">
                ${divisionOptionsHtml}
            </select>
        </td>
        <td>
            <input type="text" class="form-control schedule-row-room" value="${escapeHtml(room)}" placeholder="e.g. Room 204">
        </td>
        <td>
            <select class="form-select schedule-row-status">
                ${statusOptionsHtml}
            </select>
        </td>
        <td class="text-center">
            <button type="button" class="btn-schedule-delete" title="Delete class" onclick="removeScheduleModalRow(this)">
                <i class="fa-solid fa-trash-can"></i>
            </button>
        </td>
    `;
    tbody.appendChild(tr);
}

function addScheduleModalRow() {
    const existingRows = document.querySelectorAll('#editScheduleModalTbody tr.schedule-edit-row');
    let nextTime = '04:30 PM';
    if (existingRows.length > 0) {
        const lastTimeInput = existingRows[existingRows.length - 1].querySelector('.schedule-row-time');
        if (lastTimeInput && lastTimeInput.value) {
            nextTime = formatNextLectureTime(lastTimeInput.value);
        }
    }

    renderModalRow({
        time: nextTime,
        subject: '',
        className: 'SY Computer A',
        room: 'Room 101',
        status: 'Upcoming'
    });

    updateModalSessionBadge();

    const rows = document.querySelectorAll('#editScheduleModalTbody tr.schedule-edit-row');
    if (rows.length > 0) {
        const newRowSubjectInput = rows[rows.length - 1].querySelector('.schedule-row-subject');
        if (newRowSubjectInput) newRowSubjectInput.focus();
    }
}

function removeScheduleModalRow(btn) {
    const row = btn.closest('tr');
    if (row) {
        row.remove();
        updateModalSessionBadge();
        const remainingRows = document.querySelectorAll('#editScheduleModalTbody tr.schedule-edit-row');
        if (remainingRows.length === 0) {
            const tbody = document.getElementById('editScheduleModalTbody');
            tbody.innerHTML = `
                <tr id="modalEmptyRow">
                    <td colspan="6" class="text-center py-3 text-muted">
                        No classes in list. Click <strong>+ Add Class</strong> to insert a class.
                    </td>
                </tr>
            `;
        }
    }
}

function updateModalSessionBadge() {
    const badge = document.getElementById('modalSessionBadge');
    if (!badge) return;
    const count = document.querySelectorAll('#editScheduleModalTbody tr.schedule-edit-row').length;
    badge.textContent = `${count} ${count === 1 ? 'Session' : 'Sessions'}`;
}

function saveScheduleChanges() {
    const rows = document.querySelectorAll('#editScheduleModalTbody tr.schedule-edit-row');
    const updatedSchedule = [];

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const timeInput = row.querySelector('.schedule-row-time');
        const subjectInput = row.querySelector('.schedule-row-subject');
        const classSelect = row.querySelector('.schedule-row-class');
        const roomInput = row.querySelector('.schedule-row-room');
        const statusSelect = row.querySelector('.schedule-row-status');
        const rowId = row.getAttribute('data-row-id') || `sch_${i + 1}`;

        const time = timeInput ? timeInput.value.trim() : '';
        const subject = subjectInput ? subjectInput.value.trim() : '';
        const className = classSelect ? classSelect.value : 'SY Computer A';
        const room = roomInput ? roomInput.value.trim() : 'Room 101';
        const status = statusSelect ? statusSelect.value : 'Upcoming';

        if (!time) {
            showToast(`Please enter a valid time for row #${i + 1}.`, 'error');
            if (timeInput) timeInput.focus();
            return;
        }

        if (!subject) {
            showToast(`Please enter a subject name for row #${i + 1}.`, 'error');
            if (subjectInput) subjectInput.focus();
            return;
        }

        updatedSchedule.push({
            id: rowId,
            time: time,
            subject: subject,
            className: className,
            room: room || 'Room 101',
            status: status
        });
    }

    // Persist to localStorage for current session
    localStorage.setItem(STORAGE_KEY_SCHEDULE, JSON.stringify(updatedSchedule));

    // Update Today's Schedule Table immediately
    renderTodaySchedule(updatedSchedule);

    // Update all dashboard cards, statistics, and Next Lecture card
    updateDashboardScheduleStats(updatedSchedule);

    // Sync mock lectures list
    syncMockLecturesWithSchedule(updatedSchedule);

    // Close modal
    const modalElement = document.getElementById('editScheduleModal');
    const modalInstance = bootstrap.Modal.getInstance(modalElement);
    if (modalInstance) {
        modalInstance.hide();
    }

    showToast("Today's schedule updated successfully!", "success");
}

// --- Client-side Datasets (No Database Required) ---
const mockLectures = [
    { id: "DS", timetable_id: 1, class_id: 101, code: "DS", name: "Data Structures", className: "SY Computer A", time: "09:00 AM" },
    { id: "OS", timetable_id: 2, class_id: 102, code: "OS", name: "Operating Systems", className: "TY IT B", time: "11:15 AM" },
    { id: "SE", timetable_id: 3, class_id: 101, code: "SE", name: "Software Engineering", className: "SY Computer A", time: "02:00 PM" },
    { id: "ML", timetable_id: 4, class_id: 103, code: "ML", name: "Machine Learning", className: "Final Year CS", time: "03:45 PM" }
];

const mockStudentsByClass = {
    101: [ // SY Computer A
        { student_id: 101, roll_number: "101", full_name: "Rahul Sharma" },
        { student_id: 102, roll_number: "102", full_name: "Amit Patil" },
        { student_id: 103, roll_number: "103", full_name: "Sneha Kulkarni" },
        { student_id: 104, roll_number: "104", full_name: "Vikram Singh" },
        { student_id: 105, roll_number: "105", full_name: "Priya Joshi" },
        { student_id: 106, roll_number: "106", full_name: "Rohan Mehta" },
        { student_id: 107, roll_number: "107", full_name: "Neha Shinde" }
    ],
    102: [ // TY IT B
        { student_id: 201, roll_number: "201", full_name: "Aarav Gupta" },
        { student_id: 202, roll_number: "202", full_name: "Ananya Deshmukh" },
        { student_id: 203, roll_number: "203", full_name: "Siddharth Rao" },
        { student_id: 204, roll_number: "204", full_name: "Tanvi Kadam" },
        { student_id: 205, roll_number: "205", full_name: "Yash Pawar" }
    ],
    103: [ // Final Year CS
        { student_id: 301, roll_number: "301", full_name: "Aditya Joshi" },
        { student_id: 302, roll_number: "302", full_name: "Pooja Nair" },
        { student_id: 303, roll_number: "303", full_name: "Ishaan Verma" },
        { student_id: 304, roll_number: "304", full_name: "Diya Shah" },
        { student_id: 305, roll_number: "305", full_name: "Sameer Khan" }
    ]
};

function generateInitialAttendanceHistory() {
    const saved = localStorage.getItem('smart_attendance_history');
    if (saved) {
        try { return JSON.parse(saved); } catch(e) {}
    }
    
    // Rich default mock dataset matching standard academic schedule
    const records = [
        // Today - Data Structures
        { attendance_date: todayStr, class_name: "SY Computer A", subject_code: "DS", subject_name: "Data Structures", student_name: "Rahul Sharma", roll_number: "101", status: "present" },
        { attendance_date: todayStr, class_name: "SY Computer A", subject_code: "DS", subject_name: "Data Structures", student_name: "Amit Patil", roll_number: "102", status: "present" },
        { attendance_date: todayStr, class_name: "SY Computer A", subject_code: "DS", subject_name: "Data Structures", student_name: "Sneha Kulkarni", roll_number: "103", status: "absent" },
        { attendance_date: todayStr, class_name: "SY Computer A", subject_code: "DS", subject_name: "Data Structures", student_name: "Vikram Singh", roll_number: "104", status: "present" },
        { attendance_date: todayStr, class_name: "SY Computer A", subject_code: "DS", subject_name: "Data Structures", student_name: "Priya Joshi", roll_number: "105", status: "present" },
        { attendance_date: todayStr, class_name: "SY Computer A", subject_code: "DS", subject_name: "Data Structures", student_name: "Rohan Mehta", roll_number: "106", status: "absent" },
        { attendance_date: todayStr, class_name: "SY Computer A", subject_code: "DS", subject_name: "Data Structures", student_name: "Neha Shinde", roll_number: "107", status: "present" },

        // Today - Software Engineering
        { attendance_date: todayStr, class_name: "SY Computer A", subject_code: "SE", subject_name: "Software Engineering", student_name: "Rahul Sharma", roll_number: "101", status: "present" },
        { attendance_date: todayStr, class_name: "SY Computer A", subject_code: "SE", subject_name: "Software Engineering", student_name: "Amit Patil", roll_number: "102", status: "present" },
        { attendance_date: todayStr, class_name: "SY Computer A", subject_code: "SE", subject_name: "Software Engineering", student_name: "Sneha Kulkarni", roll_number: "103", status: "present" },
        { attendance_date: todayStr, class_name: "SY Computer A", subject_code: "SE", subject_name: "Software Engineering", student_name: "Vikram Singh", roll_number: "104", status: "absent" },
        { attendance_date: todayStr, class_name: "SY Computer A", subject_code: "SE", subject_name: "Software Engineering", student_name: "Priya Joshi", roll_number: "105", status: "present" },
        { attendance_date: todayStr, class_name: "SY Computer A", subject_code: "SE", subject_name: "Software Engineering", student_name: "Rohan Mehta", roll_number: "106", status: "late" },
        { attendance_date: todayStr, class_name: "SY Computer A", subject_code: "SE", subject_name: "Software Engineering", student_name: "Neha Shinde", roll_number: "107", status: "present" },

        // Today - Operating Systems
        { attendance_date: todayStr, class_name: "TY IT B", subject_code: "OS", subject_name: "Operating Systems", student_name: "Aarav Gupta", roll_number: "201", status: "present" },
        { attendance_date: todayStr, class_name: "TY IT B", subject_code: "OS", subject_name: "Operating Systems", student_name: "Ananya Deshmukh", roll_number: "202", status: "present" },
        { attendance_date: todayStr, class_name: "TY IT B", subject_code: "OS", subject_name: "Operating Systems", student_name: "Siddharth Rao", roll_number: "203", status: "absent" },
        { attendance_date: todayStr, class_name: "TY IT B", subject_code: "OS", subject_name: "Operating Systems", student_name: "Tanvi Kadam", roll_number: "204", status: "present" },
        { attendance_date: todayStr, class_name: "TY IT B", subject_code: "OS", subject_name: "Operating Systems", student_name: "Yash Pawar", roll_number: "205", status: "present" },

        // Today - Machine Learning
        { attendance_date: todayStr, class_name: "Final Year CS", subject_code: "ML", subject_name: "Machine Learning", student_name: "Aditya Joshi", roll_number: "301", status: "present" },
        { attendance_date: todayStr, class_name: "Final Year CS", subject_code: "ML", subject_name: "Machine Learning", student_name: "Pooja Nair", roll_number: "302", status: "present" },
        { attendance_date: todayStr, class_name: "Final Year CS", subject_code: "ML", subject_name: "Machine Learning", student_name: "Ishaan Verma", roll_number: "303", status: "late" },
        { attendance_date: todayStr, class_name: "Final Year CS", subject_code: "ML", subject_name: "Machine Learning", student_name: "Diya Shah", roll_number: "304", status: "present" },
        { attendance_date: todayStr, class_name: "Final Year CS", subject_code: "ML", subject_name: "Machine Learning", student_name: "Sameer Khan", roll_number: "305", status: "absent" }
    ];

    localStorage.setItem('smart_attendance_history', JSON.stringify(records));
    return records;
}

let attendanceHistoryStore = generateInitialAttendanceHistory();

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

    const sectionId = 'section-' + moduleName.replace(/\s+/g, '');
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

        // Update card stats numbers
        const statCards = document.querySelectorAll('.stat-card');
        if (statCards.length >= 6) {
            statCards[0].querySelector('.stat-number').textContent = `${stats.todays_classes} Lectures`;
            statCards[1].querySelector('.stat-number').textContent = `${stats.students_assigned} Students`;
            statCards[2].querySelector('.stat-number').textContent = `${stats.attendance_submitted} / ${stats.todays_classes} Classes`;
            statCards[3].querySelector('.stat-number').textContent = `${stats.students_present} Present`;
            statCards[4].querySelector('.stat-number').textContent = `${stats.students_absent} Absent`;
            statCards[5].querySelector('.stat-number').textContent = `${stats.pending_attendance} Classes`;
        }

        // Fetch today's timetable and update schedule table
        loadTodaySchedule();
        loadRecentAttendance();
    } catch (e) {
        console.error("Dashboard stats error:", e);
    }
}

async function loadTodaySchedule() {
    const tbody = document.getElementById('todaysScheduleTableBody');
    if (!tbody) return;

    try {
        const res = await fetch('/api/timetable/today');
        if (!res.ok) return;
        const timetable = await res.json();

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
            if (t.status === 'Completed') badgeClass = 'status-present';
            else if (t.status === 'In Progress') badgeClass = 'status-inprogress';

            tbody.innerHTML += `
                <tr>
                    <td class="fw-semibold">${t.start_time_str || t.start_time}</td>
                    <td class="fw-medium">${t.subject_name}</td>
                    <td>${t.class_name}</td>
                    <td>${t.room_number || 'Room 101'}</td>
                    <td><span class="status-badge ${badgeClass}">${t.status}</span></td>
                    <td class="text-end">
                        <button class="btn-primary-custom" onclick="simulateNav('Mark Attendance')">
                            <i class="fa-solid fa-clipboard-user"></i> Mark
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
    const card = document.querySelector('.next-lecture-card');
    if (!card) return;

    if (!lecture) {
        card.querySelector('.next-lecture-subject').textContent = 'No Lectures Today';
        card.querySelector('.next-lecture-details').innerHTML = `<span><i class="fa-regular fa-clock"></i> All sessions clear</span>`;
        return;
    }

    card.querySelector('.next-lecture-subject').textContent = lecture.subject_name;
    card.querySelector('.next-lecture-details').innerHTML = `
        <span><i class="fa-regular fa-clock"></i> ${lecture.start_time_str || lecture.start_time} – ${lecture.end_time_str || lecture.end_time}</span>
        <span><i class="fa-solid fa-chalkboard"></i> ${lecture.class_name}</span>
        <span><i class="fa-solid fa-location-dot"></i> ${lecture.room_number || 'Room 101'}</span>
    `;
}

async function loadRecentAttendance() {
    const tbody = document.getElementById('recentAttendanceTableBody');
    if (!tbody) return;

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
                    <td class="fw-semibold">${r.roll_number}</td>
                    <td class="fw-medium">${r.student_name}</td>
                    <td>${r.class_name}</td>
                    <td><span class="status-badge ${badgeClass}">${r.status}</span></td>
                    <td class="text-end">
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
                    <td class="fw-medium">${c.section_name}</td>
                    <td>${c.subject_name} <span class="text-muted" style="font-size: 11px;">(${c.subject_code})</span></td>
                    <td>Sem ${c.semester || 1}</td>
                    <td>${c.student_count || 0} Students</td>
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
            select.innerHTML += `<option value="${t.timetable_id}" data-classid="${t.class_id}">${t.start_time_str || t.start_time} - ${t.subject_name} (${t.class_name})</option>`;
        });
    } catch (e) {
        select.innerHTML = '<option value="">Error loading lectures</option>';
    }
}

async function fetchStudentsForAttendance() {
    const select = document.getElementById('markAttLecture');
    const dateStr = document.getElementById('markAttDate').value;
    if (!select || !select.value || !dateStr) {
        showToast('Please select date and lecture.', 'error');
        return;
    }

    const timetableId = select.value;
    const timetables = window.todayTimetable || [];
    const lecture = timetables.find(t => String(t.timetable_id) === String(timetableId));
    if (!lecture) return;

    window.currentAttLecture = lecture;

    try {
        const res = await fetch(`/api/classes/${lecture.class_id}/students`);
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

        document.getElementById('markAttStudentsContainer').style.display = 'block';
        const tbody = document.querySelector('#markAttendanceTable tbody');
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
            tbody.innerHTML += `
                <tr>
                    <td class="fw-semibold text-secondary" style="font-size: 13px;">${s.roll_number}</td>
                    <td class="fw-medium">${s.full_name}</td>
                    <td>
                        <div class="status-btn-group" data-studentid="${s.student_id}" data-studentname="${s.full_name}" data-roll="${s.roll_number}" data-status="present">
                            <button type="button" class="status-btn btn-present active" onclick="setStudentStatus(this, 'present')">
                                <i class="fa-solid fa-circle-check"></i> Present
                            </button>
                            <button type="button" class="status-btn btn-absent" onclick="setStudentStatus(this, 'absent')">
                                <i class="fa-solid fa-circle-xmark"></i> Absent
                            </button>
                            <button type="button" class="status-btn btn-late" onclick="setStudentStatus(this, 'late')">
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

async function submitAttendance() {
    const select = document.getElementById('markAttLecture');
    const dateStr = document.getElementById('markAttDate').value;
    const lecture = window.currentAttLecture;
    if (!lecture || !dateStr) return;

    const groups = document.querySelectorAll('.status-btn-group');
    if (groups.length === 0) return;

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
            showToast(`Attendance recorded successfully for **${lecture.subject_name}**!`, 'success');
            loadDashboardStats();
        } else {
            showToast(data.error || 'Failed to submit attendance.', 'error');
        }
    } catch (e) {
        showToast('Error submitting attendance.', 'error');
    }
}

async function loadAttendanceHistory() {
    const dateInput = document.getElementById('historyDateInput');
    if (dateInput && !dateInput.value) {
        dateInput.value = todayStr;
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
    const selectedStatus = document.getElementById('historyStatusSelect').value;
    let records = window.attendanceHistoryCache || [];

    if (selectedDate) {
        records = records.filter(r => r.attendance_date === selectedDate);
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
                <td class="fw-semibold text-secondary" style="font-size: 12px;">${row.attendance_date}</td>
                <td><span class="fw-medium">${row.class_name}</span></td>
                <td>${row.subject_name}</td>
                <td class="fw-medium">${row.student_name} <span class="text-muted" style="font-size: 11px;">(Roll: ${row.roll_number})</span></td>
                <td><span class="status-badge ${badgeClass}">${row.status}</span></td>
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

    try {
        const res = await fetch('/api/students', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                class_id: classId,
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

function viewStudentDetails(studentName, rollNo) {
    showToast(`Viewing student profile for **${studentName}** (Roll: ${rollNo})`, 'info');
}

function simulateLogout() {
    if (confirm("Are you sure you want to logout of Smart Attendance ERP?")) {
        showToast("Logging out...", "info");
        localStorage.removeItem(STORAGE_KEY_SCHEDULE);
        setTimeout(() => {
            if (window.AuthService) {
                window.AuthService.logout('Authentication/login.html');
            } else {
                window.location.replace('Authentication/login.html');
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

