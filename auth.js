/**
 * Smart Attendance ERP - Central Authentication & Session Controller
 * Handles backend authentication, role management, route guarding, and profile sync.
 */

(function () {
    const STORAGE_KEY_SESSION = 'smart_attendance_auth_session';

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
            return !!(session && session.user);
        },

        /**
         * Authenticate user with backend API
         */
        login: async function (email, password, rememberMe = false) {
            const cleanEmail = (email || '').trim().toLowerCase();
            const cleanPass = (password || '').trim();

            if (!cleanEmail || !cleanPass) {
                throw new Error('Please enter both email and password.');
            }

            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: cleanEmail,
                    password: cleanPass
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Invalid email or password.');
            }

            const expiresAt = Date.now() + (rememberMe ? 7 * 24 : 24) * 60 * 60 * 1000;
            const session = {
                user: {
                    id: data.user.user_id,
                    name: data.user.full_name,
                    email: cleanEmail,
                    role: data.user.role,
                    teacher_id: data.user.teacher_id,
                    designation: data.user.role === 'teacher' ? 'Faculty Member' : 'Administrator',
                    avatar: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&q=80&w=120'
                },
                rememberMe: rememberMe,
                expiresAt: expiresAt
            };

            if (rememberMe) {
                localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(session));
            } else {
                sessionStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(session));
            }

            return session;
        },

        /**
         * Register a new user account with Flask MySQL backend
         */
        signup: async function (userData) {
            const fullName = (userData.fullName || '').trim();
            const email = (userData.email || '').trim().toLowerCase();
            const password = userData.password;
            const role = userData.role || 'teacher';

            if (!fullName || !email || !password) {
                throw new Error('Please fill in all required fields.');
            }

            const response = await fetch('/api/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    fullName: fullName,
                    full_name: fullName,
                    email: email,
                    password: password,
                    role: role
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Registration failed.');
            }

            const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
            const session = {
                user: {
                    id: data.user.user_id,
                    name: data.user.full_name,
                    email: data.user.email,
                    role: data.user.role,
                    teacher_id: data.user.teacher_id,
                    designation: data.user.role === 'teacher' ? 'Faculty Member' : 'Administrator',
                    avatar: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&q=80&w=120'
                },
                rememberMe: false,
                expiresAt: expiresAt
            };

            sessionStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(session));
            return session;
        },

        /**
         * Request password reset instructions
         */
        requestPasswordReset: function (email) {
            return Promise.resolve({
                success: true,
                message: 'Password reset instructions have been sent to your email.'
            });
        },

        /**
         * Reset password with new credentials
         */
        resetPassword: function (newPassword) {
            if (!newPassword || newPassword.length < 6) {
                return Promise.reject(new Error('Password must be at least 6 characters long.'));
            }
            return Promise.resolve({
                success: true,
                message: 'Your password has been reset successfully.'
            });
        },

        /**
         * Terminate user session and redirect to login
         */
        logout: async function (redirectPath) {
            try {
                await fetch('/api/logout', { method: 'POST' });
            } catch (e) {}

            sessionStorage.removeItem(STORAGE_KEY_SESSION);
            localStorage.removeItem(STORAGE_KEY_SESSION);

            const isInsideAuth = window.location.pathname.toLowerCase().includes('/authentication/');
            const target = redirectPath || (isInsideAuth ? 'login.html' : 'Authentication/login.html');
            window.location.replace(target);
        },

        /**
         * Protect routes from unauthenticated access
         */
        protectRoute: function () {
            if (!this.isAuthenticated()) {
                const isInsideAuth = window.location.pathname.toLowerCase().includes('/authentication/');
                const loginTarget = isInsideAuth ? 'login.html' : 'Authentication/login.html';
                
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
        syncProfileUI: async function () {
            try {
                const res = await fetch('/api/current-user');
                if (res.ok) {
                    const serverUser = await res.json();
                    const session = this.getSession() || { user: {} };
                    session.user.id = serverUser.user_id;
                    session.user.name = serverUser.full_name;
                    session.user.role = serverUser.role;
                    session.user.teacher_id = serverUser.teacher_id;
                    sessionStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(session));

                    const profileNameEls = document.querySelectorAll('.profile-dropdown-name, #profileDropdown + .dropdown-menu .fw-semibold');
                    profileNameEls.forEach(el => {
                        if (el && serverUser.full_name) el.textContent = serverUser.full_name;
                    });

                    const greetingEl = document.querySelector('.welcome-greeting');
                    if (greetingEl && serverUser.full_name) {
                        const firstName = serverUser.full_name.split(' ')[0] || serverUser.full_name;
                        greetingEl.textContent = `Good morning, ${serverUser.role === 'teacher' ? 'Prof. ' + firstName : serverUser.full_name}`;
                    }
                } else if (res.status === 401) {
                    this.logout();
                }
            } catch (e) {
                console.error("Profile sync error:", e);
            }
        }
    };

    window.AuthService = AuthService;
})();

