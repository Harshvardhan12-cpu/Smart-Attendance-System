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

    // Load initial dashboard stats
    loadDashboardStats();
});

// --- SPA Navigation Controller ---
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

