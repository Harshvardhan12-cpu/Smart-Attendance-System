/**
 * Smart Attendance ERP - Teacher Dashboard Javascript
 * Handles theme toggling, live date-time, responsive sidebar, search filters, and modal simulations.
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- Profile & Authentication State Sync ---
    if (window.AuthService) {
        window.AuthService.syncProfileUI();
    }

    // --- Dark/Light Mode Theme Toggle ---
    const themeToggleBtn = document.getElementById('themeToggle');
    const htmlElement = document.documentElement;

    // Load theme setting
    const currentTheme = localStorage.getItem('theme') || 'light';
    htmlElement.setAttribute('data-bs-theme', currentTheme);
    updateThemeIcon(currentTheme);

    themeToggleBtn.addEventListener('click', () => {
        const activeTheme = htmlElement.getAttribute('data-bs-theme');
        const newTheme = activeTheme === 'light' ? 'dark' : 'light';
        
        htmlElement.setAttribute('data-bs-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        updateThemeIcon(newTheme);
        showToast(`Theme changed to ${newTheme} mode!`, 'info');
    });

    function updateThemeIcon(theme) {
        const icon = themeToggleBtn.querySelector('i');
        if (theme === 'dark') {
            icon.className = 'fa-solid fa-sun';
            themeToggleBtn.setAttribute('title', 'Switch to Light Mode');
        } else {
            icon.className = 'fa-solid fa-moon';
            themeToggleBtn.setAttribute('title', 'Switch to Dark Mode');
        }
    }

    // --- Responsive Sidebar Menu ---
    const menuToggleBtn = document.getElementById('menuToggle');
    const sidebarMenu = document.getElementById('sidebarMenu');
    const sidebarBackdrop = document.getElementById('sidebarBackdrop');

    function toggleSidebar() {
        sidebarMenu.classList.toggle('active');
        sidebarBackdrop.classList.toggle('active');
    }

    function closeSidebar() {
        sidebarMenu.classList.remove('active');
        sidebarBackdrop.classList.remove('active');
    }

    menuToggleBtn.addEventListener('click', toggleSidebar);
    sidebarBackdrop.addEventListener('click', closeSidebar);

    // --- Digital Clock & Real-time Calendar Update ---
    const liveClock = document.getElementById('liveClock');
    const liveDate = document.getElementById('liveDate');

    function updateTime() {
        const now = new Date();
        
        // Time formatting
        let hours = now.getHours();
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12; // conversion of 0 to 12
        const formattedTime = `${String(hours).padStart(2, '0')}:${minutes}:${seconds} ${ampm}`;
        liveClock.textContent = formattedTime;

        // Date formatting
        const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
        // Insert ordinal suffix (st, nd, rd, th)
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
        
        liveDate.textContent = `${weekday}, ${day}${suffix} ${month} ${year}`;
    }

    updateTime();
    setInterval(updateTime, 1000);

    // --- Search Filter Simulation ---
    const searchBar = document.getElementById('searchBar');
    const recentAttendanceTable = document.getElementById('recentAttendanceTable');

    searchBar.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        const rows = recentAttendanceTable.querySelectorAll('tbody tr');

        rows.forEach(row => {
            const studentName = row.cells[1].textContent.toLowerCase();
            const rollNo = row.cells[0].textContent.toLowerCase();
            const className = row.cells[2].textContent.toLowerCase();

            if (studentName.includes(query) || rollNo.includes(query) || className.includes(query)) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    });

    // --- History Filter Event Listeners ---
    const historyDateInput = document.getElementById('historyDateInput');
    const historyLectureSelect = document.getElementById('historyLectureSelect');
    const historyStatusSelect = document.getElementById('historyStatusSelect');

    if (historyDateInput) historyDateInput.addEventListener('change', filterAttendanceHistory);
    if (historyLectureSelect) historyLectureSelect.addEventListener('change', filterAttendanceHistory);
    if (historyStatusSelect) historyStatusSelect.addEventListener('change', filterAttendanceHistory);

    // Initialize Today's Schedule on load
    initTodaySchedule();
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

const todayStr = new Date().toISOString().split('T')[0];

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
        if (link.textContent.trim().includes(moduleName)) {
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
    } else {
        showToast(`Section ${moduleName} not found.`, 'error');
    }

    const sidebarMenu = document.getElementById('sidebarMenu');
    const sidebarBackdrop = document.getElementById('sidebarBackdrop');
    if (sidebarMenu) sidebarMenu.classList.remove('active');
    if (sidebarBackdrop) sidebarBackdrop.classList.remove('active');
}

// --- Data Loaders ---
function loadDashboardStats() {
    initTodaySchedule();
}

function loadMyClasses() {
    const tbody = document.querySelector('#myClassesTable tbody');
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td class="fw-medium">SY Computer A</td>
                <td>Data Structures</td>
                <td>Sem 3</td>
                <td>7 Students</td>
            </tr>
            <tr>
                <td class="fw-medium">SY Computer A</td>
                <td>Software Engineering</td>
                <td>Sem 3</td>
                <td>7 Students</td>
            </tr>
            <tr>
                <td class="fw-medium">TY IT B</td>
                <td>Operating Systems</td>
                <td>Sem 5</td>
                <td>5 Students</td>
            </tr>
            <tr>
                <td class="fw-medium">Final Year CS</td>
                <td>Machine Learning</td>
                <td>Sem 7</td>
                <td>5 Students</td>
            </tr>
        `;
    }
}

function loadAttendanceForm() {
    const dateInput = document.getElementById('markAttDate');
    if (dateInput && !dateInput.value) {
        dateInput.value = todayStr;
    }
    
    const select = document.getElementById('markAttLecture');
    if (select) {
        select.innerHTML = '<option value="">Select a lecture...</option>';
        mockLectures.forEach(l => {
            select.innerHTML += `<option value="${l.id}" data-classid="${l.class_id}">${l.time} - ${l.name} (${l.className})</option>`;
        });
    }
}

function fetchStudentsForAttendance() {
    const select = document.getElementById('markAttLecture');
    const dateStr = document.getElementById('markAttDate').value;
    if (!select || !select.value || !dateStr) {
        showToast('Please select date and lecture.', 'error');
        return;
    }
    
    const selectedOpt = select.options[select.selectedIndex];
    const classId = selectedOpt.getAttribute('data-classid');
    const lecture = mockLectures.find(l => l.id === select.value);
    const students = mockStudentsByClass[classId] || [];
    
    window.currentAttLecture = lecture;
    window.currentAttStudents = students;
    
    const countLabel = document.getElementById('markAttCountLabel');
    if (countLabel && lecture) {
        countLabel.textContent = `Roll Call for ${lecture.name} (${lecture.className}) - ${students.length} Students`;
    }

    document.getElementById('markAttStudentsContainer').style.display = 'block';
    const tbody = document.querySelector('#markAttendanceTable tbody');
    if (tbody) {
        tbody.innerHTML = '';
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

function submitAttendance() {
    const select = document.getElementById('markAttLecture');
    const dateStr = document.getElementById('markAttDate').value;
    const lecture = window.currentAttLecture;
    if (!lecture || !dateStr) return;

    const groups = document.querySelectorAll('.status-btn-group');
    if (groups.length === 0) return;

    // Filter out previous records for this date and subject
    attendanceHistoryStore = attendanceHistoryStore.filter(r => !(r.attendance_date === dateStr && r.subject_code === lecture.code));

    groups.forEach(group => {
        const studentName = group.getAttribute('data-studentname');
        const rollNo = group.getAttribute('data-roll');
        const status = group.getAttribute('data-status') || 'present';

        attendanceHistoryStore.unshift({
            attendance_date: dateStr,
            class_name: lecture.className,
            subject_code: lecture.code,
            subject_name: lecture.name,
            student_name: studentName,
            roll_number: rollNo,
            status: status
        });
    });

    localStorage.setItem('smart_attendance_history', JSON.stringify(attendanceHistoryStore));
    showToast(`Attendance recorded successfully for **${lecture.name}**!`, 'success');
}

function loadAttendanceHistory() {
    const dateInput = document.getElementById('historyDateInput');
    if (dateInput && !dateInput.value) {
        dateInput.value = todayStr;
    }
    filterAttendanceHistory();
}

function filterAttendanceHistory() {
    const selectedDate = document.getElementById('historyDateInput').value;
    const selectedLectureCode = document.getElementById('historyLectureSelect').value;
    const selectedStatus = document.getElementById('historyStatusSelect').value;

    let filtered = [...attendanceHistoryStore];

    // Filter by Date if selected
    if (selectedDate) {
        filtered = filtered.filter(r => r.attendance_date === selectedDate);
    }

    // Filter by Lecture/Subject code if selected (not ALL)
    if (selectedLectureCode && selectedLectureCode !== 'ALL') {
        filtered = filtered.filter(r => r.subject_code === selectedLectureCode);
    }

    // Filter by Status if selected (not ALL)
    if (selectedStatus && selectedStatus !== 'ALL') {
        filtered = filtered.filter(r => r.status === selectedStatus);
    }

    // Calculate Summary Stats
    const totalCount = filtered.length;
    const presentCount = filtered.filter(r => r.status === 'present').length;
    const absentCount = filtered.filter(r => r.status === 'absent').length;
    const rate = totalCount > 0 ? ((presentCount / totalCount) * 100).toFixed(1) + '%' : '0%';

    const totalEl = document.getElementById('historyTotalCount');
    const presentEl = document.getElementById('historyPresentCount');
    const absentEl = document.getElementById('historyAbsentCount');
    const rateEl = document.getElementById('historyRate');

    if (totalEl) totalEl.textContent = totalCount;
    if (presentEl) presentEl.textContent = presentCount;
    if (absentEl) absentEl.textContent = absentCount;
    if (rateEl) rateEl.textContent = rate;

    // Render Table Rows
    const tbody = document.querySelector('#attendanceHistoryTableData tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center py-4 text-muted">
                    <i class="fa-solid fa-folder-open d-block mb-2" style="font-size: 1.5rem; opacity: 0.5;"></i>
                    No attendance records found for the selected Date & Lecture.
                </td>
            </tr>
        `;
        return;
    }

    filtered.forEach(row => {
        let badgeClass = 'status-present';
        let statusLabel = 'Present';
        if (row.status === 'absent') {
            badgeClass = 'status-absent';
            statusLabel = 'Absent';
        } else if (row.status === 'late') {
            badgeClass = 'status-late';
            statusLabel = 'Late';
        }

        tbody.innerHTML += `
            <tr>
                <td class="fw-semibold text-secondary" style="font-size: 12px;">${row.attendance_date}</td>
                <td><span class="fw-medium">${row.class_name}</span></td>
                <td>${row.subject_name}</td>
                <td class="fw-medium">${row.student_name} <span class="text-muted" style="font-size: 11px;">(Roll: ${row.roll_number})</span></td>
                <td><span class="status-badge ${badgeClass}">${statusLabel}</span></td>
            </tr>
        `;
    });
}

// --- Quick Actions Click Simulations ---
function triggerAction(actionName) {
    showToast(`Quick Action Triggered: **${actionName}**`, 'success');
}

// --- Student Detail View Modal Simulation ---
const mockStudentDatabase = {
    "Rahul Sharma": {
        roll: "101",
        class: "SY Computer A",
        attendance: "88.5%",
        lectures: "52 / 60",
        parentName: "Mr. Ramesh Sharma",
        parentContact: "+91 98765 43210",
        img: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&q=80&w=120"
    },
    "Amit Patil": {
        roll: "102",
        class: "SY Computer A",
        attendance: "64.2%",
        lectures: "38 / 60",
        parentName: "Mr. Sunil Patil",
        parentContact: "Not Available",
        img: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=120"
    },
    "Sneha Kulkarni": {
        roll: "103",
        class: "SY Computer A",
        attendance: "78.3%",
        lectures: "47 / 60",
        parentName: "Mrs. V. Kulkarni",
        parentContact: "+91 91234 56789",
        img: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=120"
    },
    "Vikram Singh": {
        roll: "104",
        class: "SY Computer A",
        attendance: "93.3%",
        lectures: "56 / 60",
        parentName: "Mr. Rajendra Singh",
        parentContact: "+91 95432 10987",
        img: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=120"
    },
    "Priya Joshi": {
        roll: "105",
        class: "SY Computer A",
        attendance: "81.6%",
        lectures: "49 / 60",
        parentName: "Mr. Anant Joshi",
        parentContact: "+91 98712 34567",
        img: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&q=80&w=120"
    }
};

function viewStudentDetails(studentName, rollNo) {
    const student = mockStudentDatabase[studentName] || {
        roll: rollNo,
        class: "SY Computer A",
        attendance: "80.0%",
        lectures: "48 / 60",
        parentName: "N/A",
        parentContact: "N/A",
        img: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&q=80&w=120"
    };

    // Update modal elements
    document.getElementById('modalStudentImg').src = student.img;
    document.getElementById('modalStudentName').textContent = studentName;
    document.getElementById('modalStudentRoll').textContent = `Roll No: ${student.roll} | ${student.class}`;
    
    const attendanceVal = document.getElementById('modalStudentAttendance') || document.querySelector('#studentDetailModal .text-success, #studentDetailModal .text-danger');
    if (attendanceVal) {
        attendanceVal.textContent = student.attendance;
        if (parseFloat(student.attendance) < 75) {
            attendanceVal.className = 'fw-bold text-danger';
        } else {
            attendanceVal.className = 'fw-bold text-success';
        }
    }

    const lecturesVal = document.querySelector('#studentDetailModal .row .col-6:nth-child(2) span:last-child');
    lecturesVal.textContent = student.lectures;
    
    const parentNameVal = document.querySelector('#studentDetailModal .row .col-6:nth-child(3) span:last-child');
    parentNameVal.textContent = student.parentName;

    const parentContactVal = document.querySelector('#studentDetailModal .row .col-6:nth-child(4) span:last-child');
    parentContactVal.innerHTML = `<i class="fa-solid fa-phone me-1"></i> ${student.parentContact}`;

    // Show modal using Bootstrap instance
    const modalElement = document.getElementById('studentDetailModal');
    const modalInstance = new bootstrap.Modal(modalElement);
    modalInstance.show();
}

// --- Parent Contact Action Simulation ---
function simulateContactParent() {
    const studentName = document.getElementById('modalStudentName').textContent;
    const student = mockStudentDatabase[studentName];
    
    if (!student || student.parentContact === "Not Available") {
        showToast(`Cannot send notification: No contact info for ${studentName}'s parents.`, 'error');
    } else {
        showToast(`Successfully dispatched parent notification alert for **${studentName}** via WhatsApp!`, 'success');
        
        // Hide modal
        const modalElement = document.getElementById('studentDetailModal');
        const modalInstance = bootstrap.Modal.getInstance(modalElement);
        if (modalInstance) {
            modalInstance.hide();
        }
    }
}

// --- Logout Handler ---
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

// --- Custom Modern Toast System ---
function showToast(message, type = 'info') {
    // Create toast container if it doesn't exist
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

    // Colors according to toast type
    let bgColor = 'var(--primary-dark)';
    let icon = '<i class="fa-solid fa-circle-info me-2"></i>';
    if (type === 'success') {
        bgColor = 'var(--present)';
        icon = '<i class="fa-solid fa-circle-check me-2"></i>';
    } else if (type === 'error') {
        bgColor = 'var(--absent)';
        icon = '<i class="fa-solid fa-circle-xmark me-2"></i>';
    }

    // Build the Toast Element
    const toast = document.createElement('div');
    toast.style.background = bgColor;
    toast.style.color = '#ffffff';
    toast.style.padding = '0.75rem 1.25rem';
    toast.style.borderRadius = '8px';
    toast.style.border = '1px solid rgba(255, 255, 255, 0.15)';
    toast.style.boxShadow = '0 8px 24px rgba(18, 52, 59, 0.2)';
    toast.style.fontSize = '0.825rem';
    toast.style.fontWeight = '500';
    toast.style.display = 'flex';
    toast.style.alignItems = 'center';
    toast.style.animation = 'fadeIn 0.25s ease forwards';
    toast.style.minWidth = '280px';
    toast.style.maxWidth = '380px';

    // Parse Markdown bold elements **
    const formattedMsg = message.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    toast.innerHTML = `${icon} <span style="flex-grow: 1;">${formattedMsg}</span>`;

    // Add dismiss button
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&times;';
    closeBtn.style.background = 'none';
    closeBtn.style.border = 'none';
    closeBtn.style.color = '#ffffff';
    closeBtn.style.fontSize = '1.2rem';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.marginLeft = '1rem';
    closeBtn.style.padding = '0';
    closeBtn.style.lineHeight = '1';
    closeBtn.addEventListener('click', () => {
        toast.remove();
    });
    toast.appendChild(closeBtn);

    toastContainer.appendChild(toast);

    // Auto-remove after 4 seconds
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s ease forwards';
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 4000);
}

// Add animation keyframes for toast in JS (since they are generated dynamically)
const style = document.createElement('style');
style.innerHTML = `
    @keyframes fadeOut {
        from { opacity: 1; transform: translateY(0); }
        to { opacity: 0; transform: translateY(15px); }
    }
`;
document.head.appendChild(style);
