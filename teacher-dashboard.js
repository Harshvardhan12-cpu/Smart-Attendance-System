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
});

// --- Navigation Item Click & Header Update Simulation ---
function simulateNav(moduleName) {
    // Update active menu link
    const menuItems = document.querySelectorAll('.sidebar-menu .menu-item');
    menuItems.forEach(item => {
        const link = item.querySelector('.menu-item-link');
        if (link.textContent.trim().includes(moduleName)) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    // Update Top Title
    const pageTitle = document.getElementById('pageTitle');
    pageTitle.textContent = moduleName;

    // Toast Notice
    showToast(`Navigated to ${moduleName} module (Frontend Demo Only)`, 'info');

    // Close Mobile Sidebar if open
    const sidebarMenu = document.getElementById('sidebarMenu');
    const sidebarBackdrop = document.getElementById('sidebarBackdrop');
    sidebarMenu.classList.remove('active');
    sidebarBackdrop.classList.remove('active');
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
