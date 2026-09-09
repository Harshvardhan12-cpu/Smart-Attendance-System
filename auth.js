/**
 * Smart Attendance ERP - Central Authentication & Session Controller
 * Handles token/session persistence, role management, route guarding, and profile sync.
 * Designed for immediate client-side operation and clean future backend API binding.
 */

(function () {
    const STORAGE_KEY_SESSION = 'smart_attendance_auth_session';
    const STORAGE_KEY_USERS = 'smart_attendance_registered_users';
    const SESSION_EXPIRY_HOURS = 24;

    // Seed default institutional users if not present in client storage
    function initSeedUsers() {
        if (!localStorage.getItem(STORAGE_KEY_USERS)) {
            const defaultUsers = [
                {
                    id: 'usr_001',
                    name: 'Prof. John Smith',
                    email: 'john.smith@university.edu',
                    role: 'Professor',
                    department: 'Computer Science',
                    designation: 'Senior Lecturer',
                    passwordHash: 'Admin@123', // In real production, authentication happens on server
                    avatar: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&q=80&w=120',
                    isVerified: true
                },
                {
                    id: 'usr_002',
                    name: 'Dr. Sarah Connor',
                    email: 'sarah.connor@university.edu',
                    role: 'Administrator',
                    department: 'Academic Affairs',
                    designation: 'Department Head',
                    passwordHash: 'Admin@123',
                    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=120',
                    isVerified: true
                }
            ];
            localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(defaultUsers));
        }
    }

    initSeedUsers();

    function getRegisteredUsers() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY_USERS)) || [];
        } catch (e) {
            return [];
        }
    }

    function saveRegisteredUser(user) {
        const users = getRegisteredUsers();
        users.push(user);
        localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
    }

    // Generate secure-looking token for session
    function generateToken(userId) {
        const randomPart = Math.random().toString(36).substring(2) + Date.now().toString(36);
        return `erp_token_${userId}_${randomPart}`;
    }

    const AuthService = {
        /**
         * Get the current active session from sessionStorage or localStorage
         */
        getSession: function () {
            let sessionData = sessionStorage.getItem(STORAGE_KEY_SESSION);
            if (!sessionData) {
                sessionData = localStorage.getItem(STORAGE_KEY_SESSION);
            }
            if (!sessionData) return null;

            try {
                const session = JSON.parse(sessionData);
                // Check expiry
                if (session.expiresAt && Date.now() > session.expiresAt) {
                    this.logout();
                    return null;
                }
                return session;
            } catch (e) {
                return null;
            }
        },

        /**
         * Check if the user is currently authenticated
         */
        isAuthenticated: function () {
            const session = this.getSession();
            return !!(session && session.token && session.user);
        },

        /**
         * Authenticate user with email and password
         */
        login: function (email, password, rememberMe = false) {
            return new Promise((resolve, reject) => {
                // Simulate realistic network latency
                setTimeout(() => {
                    const cleanEmail = (email || '').trim().toLowerCase();
                    const cleanPass = (password || '').trim();

                    if (!cleanEmail || !cleanPass) {
                        return reject(new Error('Please enter both email and password.'));
                    }

                    const users = getRegisteredUsers();
                    // Match against registered users or allow default test credentials
                    const matchedUser = users.find(u => u.email.toLowerCase() === cleanEmail);

                    if (matchedUser && matchedUser.passwordHash === cleanPass) {
                        const token = generateToken(matchedUser.id);
                        const expiresAt = Date.now() + (rememberMe ? 7 * 24 : SESSION_EXPIRY_HOURS) * 60 * 60 * 1000;

                        const session = {
                            token: token,
                            user: {
                                id: matchedUser.id,
                                name: matchedUser.name,
                                email: matchedUser.email,
                                role: matchedUser.role,
                                department: matchedUser.department || 'Academic Department',
                                designation: matchedUser.designation || 'Lecturer',
                                avatar: matchedUser.avatar || 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&q=80&w=120'
                            },
                            rememberMe: rememberMe,
                            expiresAt: expiresAt
                        };

                        if (rememberMe) {
                            localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(session));
                        } else {
                            sessionStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(session));
                        }

                        resolve(session);
                    } else {
                        // Secure generic error message
                        reject(new Error('Invalid email or password.'));
                    }
                }, 400);
            });
        },

        /**
         * Register a new user account
         */
        signup: function (userData) {
            return new Promise((resolve, reject) => {
                setTimeout(() => {
                    const email = (userData.email || '').trim().toLowerCase();
                    const users = getRegisteredUsers();

                    if (users.some(u => u.email.toLowerCase() === email)) {
                        return reject(new Error('An account with this email already exists.'));
                    }

                    const newUser = {
                        id: 'usr_' + Date.now().toString(36),
                        name: userData.fullName.trim(),
                        email: email,
                        role: userData.role || 'Professor',
                        department: userData.department || 'Computer Science',
                        designation: userData.designation || 'Faculty Member',
                        passwordHash: userData.password,
                        avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=120',
                        isVerified: true,
                        createdAt: new Date().toISOString()
                    };

                    saveRegisteredUser(newUser);

                    // Auto-authenticate after signup
                    const token = generateToken(newUser.id);
                    const session = {
                        token: token,
                        user: {
                            id: newUser.id,
                            name: newUser.name,
                            email: newUser.email,
                            role: newUser.role,
                            department: newUser.department,
                            designation: newUser.designation,
                            avatar: newUser.avatar
                        },
                        rememberMe: false,
                        expiresAt: Date.now() + SESSION_EXPIRY_HOURS * 60 * 60 * 1000
                    };

                    sessionStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(session));
                    resolve(session);
                }, 450);
            });
        },

        /**
         * Request password reset instructions
         */
        requestPasswordReset: function (email) {
            return new Promise((resolve) => {
                setTimeout(() => {
                    // Always resolve positively to prevent user enumeration
                    resolve({
                        success: true,
                        message: 'Password reset instructions have been sent to your email.'
                    });
                }, 400);
            });
        },

        /**
         * Reset password with new credentials
         */
        resetPassword: function (newPassword) {
            return new Promise((resolve, reject) => {
                setTimeout(() => {
                    if (!newPassword || newPassword.length < 8) {
                        return reject(new Error('Password must be at least 8 characters long.'));
                    }
                    resolve({
                        success: true,
                        message: 'Your password has been reset successfully.'
                    });
                }, 400);
            });
        },

        /**
         * Terminate user session and redirect to login
         */
        logout: function (redirectPath) {
            sessionStorage.removeItem(STORAGE_KEY_SESSION);
            localStorage.removeItem(STORAGE_KEY_SESSION);

            // Determine relative login route depending on current location
            const isInsideAuth = window.location.pathname.toLowerCase().includes('/authentication/');
            const target = redirectPath || (isInsideAuth ? 'login.html' : 'Authentication/login.html');
            window.location.replace(target);
        },

        /**
         * Protect routes from unauthenticated access
         * Redirects unauthenticated visitors to login immediately
         */
        protectRoute: function () {
            if (!this.isAuthenticated()) {
                const isInsideAuth = window.location.pathname.toLowerCase().includes('/authentication/');
                const loginTarget = isInsideAuth ? 'login.html' : 'Authentication/login.html';
                
                // Show immediate clean loading mask to prevent flicker
                document.documentElement.style.visibility = 'hidden';
                window.location.replace(loginTarget);
                return false;
            }
            return true;
        },

        /**
         * Redirect authenticated users away from login/signup pages to the dashboard
         */
        redirectIfAuthenticated: function () {
            if (this.isAuthenticated()) {
                const isInsideAuth = window.location.pathname.toLowerCase().includes('/authentication/');
                const dashboardTarget = isInsideAuth ? '../teacher-dashboard.html' : 'teacher-dashboard.html';
                
                document.documentElement.style.visibility = 'hidden';
                window.location.replace(dashboardTarget);
                return true;
            }
            return false;
        },

        /**
         * Update user details in header UI on teacher-dashboard.html
         */
        syncProfileUI: function () {
            const session = this.getSession();
            if (!session || !session.user) return;

            const user = session.user;

            // Update top-right profile dropdown button
            const profileNameEl = document.querySelector('.profile-dropdown-name');
            if (profileNameEl && user.name) {
                profileNameEl.textContent = user.name;
            }

            const profileImgEl = document.querySelector('.profile-dropdown-btn img');
            if (profileImgEl && user.avatar) {
                profileImgEl.src = user.avatar;
                profileImgEl.alt = user.name;
            }

            // Update dropdown inner header if present
            const dropdownHeaderName = document.querySelector('#profileDropdown + .dropdown-menu .fw-semibold');
            if (dropdownHeaderName && user.name) {
                dropdownHeaderName.textContent = user.name;
            }

            const dropdownHeaderSub = document.querySelector('#profileDropdown + .dropdown-menu .text-muted');
            if (dropdownHeaderSub && user.role) {
                dropdownHeaderSub.textContent = `${user.designation || user.role} • Dept. of ${user.department || 'CS'}`;
            }

            // Update greeting in welcome bar
            const greetingEl = document.querySelector('.welcome-greeting');
            if (greetingEl && user.name) {
                const firstName = user.name.split(' ')[0] || user.name;
                greetingEl.textContent = `Good morning, ${user.role === 'Professor' ? 'Prof. ' + firstName : user.name}`;
            }
        }
    };

    window.AuthService = AuthService;
})();
