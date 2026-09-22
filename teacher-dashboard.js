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
});

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
    // Stats remain populated by HTML template
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
