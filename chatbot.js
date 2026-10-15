/**
 * Attendance Assistant Chatbot — Frontend Logic
 * Enhanced with Voice Recognition (Speech-to-Text), One-Click ERP Action Buttons,
 * Message Copying, Transcript Export, and Live Attendance Notification Badges.
 */

(function () {
    'use strict';

    // =========================================================================
    // State
    // =========================================================================
    let chatHistory = [];      // Conversation history for context
    let isOpen = false;
    let isFirstOpen = true;
    let isSending = false;

    // =========================================================================
    // DOM Injection — Create chatbot HTML on load
    // =========================================================================
    function injectChatbotHTML() {
        const chatbotHTML = `
        <!-- Floating Toggle Button with Attention Badge -->
        <button class="chatbot-toggle-btn" id="chatbotToggleBtn" title="Attendance Assistant" aria-label="Open Attendance Assistant Chatbot">
            <span class="chatbot-icon-open"><i class="fa-solid fa-robot"></i></span>
            <span class="chatbot-icon-close"><i class="fa-solid fa-xmark"></i></span>
            <span class="chatbot-badge" id="chatbotToggleBadge" style="display:none;">!</span>
        </button>

        <!-- Chat Window -->
        <div class="chatbot-window" id="chatbotWindow" role="dialog" aria-label="Attendance Assistant Chat">
            <!-- Header -->
            <div class="chatbot-header">
                <div class="chatbot-header-left">
                    <div class="chatbot-header-icon">
                        <i class="fa-solid fa-robot"></i>
                    </div>
                    <div>
                        <div class="chatbot-header-title">Attendance Assistant</div>
                        <div class="chatbot-header-subtitle"><span class="chatbot-online-dot"></span> Live AI ERP Assistant</div>
                    </div>
                </div>
                <div class="chatbot-header-actions">
                    <button class="chatbot-header-btn" id="chatbotExportBtn" title="Export chat transcript" aria-label="Export conversation">
                        <i class="fa-solid fa-download"></i>
                    </button>
                    <button class="chatbot-header-btn" id="chatbotClearBtn" title="Clear conversation" aria-label="Clear conversation">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                    <button class="chatbot-header-btn" id="chatbotCloseBtn" title="Close" aria-label="Close chat">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
            </div>

            <!-- Messages Area -->
            <div class="chatbot-messages" id="chatbotMessages">
                <!-- Welcome message injected on first open -->
            </div>

            <!-- Typing Indicator -->
            <div class="chatbot-typing" id="chatbotTyping">
                <div class="chatbot-typing-dots">
                    <span></span><span></span><span></span>
                </div>
            </div>

            <!-- Quick Suggestion Chips -->
            <div class="chatbot-suggestions" id="chatbotSuggestions">
                <button class="chatbot-suggestion-chip" data-query="Who is absent today?">Who is absent today?</button>
                <button class="chatbot-suggestion-chip" data-query="What classes have pending attendance?">Pending attendance</button>
                <button class="chatbot-suggestion-chip" data-query="What is my next lecture?">Next lecture</button>
                <button class="chatbot-suggestion-chip" data-query="Show defaulters list">Defaulters list</button>
                <button class="chatbot-suggestion-chip" data-query="Who are top attendees?">Top students</button>
                <button class="chatbot-suggestion-chip" data-query="Check Roll 1">Check Roll 1</button>
                <button class="chatbot-suggestion-chip" data-query="Weekly attendance summary">Weekly summary</button>
                <button class="chatbot-suggestion-chip" data-query="What classes do I have today?">Today's schedule</button>
                <button class="chatbot-suggestion-chip" data-query="Show WhatsApp notification status">WhatsApp status</button>
            </div>

            <!-- Input Area with Voice Recognition -->
            <div class="chatbot-input-area">
                <textarea class="chatbot-input" id="chatbotInput" placeholder="Ask about attendance or tap 🎤..." rows="1" maxlength="500"></textarea>
                <button class="chatbot-mic-btn" id="chatbotMicBtn" title="Voice Search (Click to speak)" aria-label="Voice search">
                    <i class="fa-solid fa-microphone"></i>
                </button>
                <button class="chatbot-send-btn" id="chatbotSendBtn" title="Send message" aria-label="Send message">
                    <i class="fa-solid fa-paper-plane"></i>
                </button>
            </div>
        </div>
        `;

        // Append to body (outside any existing containers)
        const wrapper = document.createElement('div');
        wrapper.id = 'chatbotWrapper';
        wrapper.innerHTML = chatbotHTML;
        document.body.appendChild(wrapper);
    }

    // =========================================================================
    // Event Binding
    // =========================================================================
    function bindEvents() {
        const toggleBtn = document.getElementById('chatbotToggleBtn');
        const closeBtn = document.getElementById('chatbotCloseBtn');
        const clearBtn = document.getElementById('chatbotClearBtn');
        const exportBtn = document.getElementById('chatbotExportBtn');
        const sendBtn = document.getElementById('chatbotSendBtn');
        const input = document.getElementById('chatbotInput');
        const suggestionsContainer = document.getElementById('chatbotSuggestions');

        if (toggleBtn) toggleBtn.addEventListener('click', toggleChatbot);
        if (closeBtn) closeBtn.addEventListener('click', closeChatbot);
        if (clearBtn) clearBtn.addEventListener('click', clearConversation);
        if (exportBtn) exportBtn.addEventListener('click', exportConversation);
        if (sendBtn) sendBtn.addEventListener('click', sendMessage);

        // Enter to send (Shift+Enter for newline)
        if (input) {
            input.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                }
            });

            // Auto-resize textarea
            input.addEventListener('input', function () {
                this.style.height = 'auto';
                this.style.height = Math.min(this.scrollHeight, 80) + 'px';
            });
        }

        // Suggestion chips
        if (suggestionsContainer) {
            suggestionsContainer.addEventListener('click', function (e) {
                const chip = e.target.closest('.chatbot-suggestion-chip');
                if (chip) {
                    const query = chip.getAttribute('data-query');
                    if (query) {
                        input.value = query;
                        sendMessage();
                    }
                }
            });
        }

        // Voice Recognition
        initVoiceRecognition();

        // Close on Escape key
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && isOpen) {
                closeChatbot();
            }
        });
    }

    // =========================================================================
    // Voice Recognition (Speech-to-Text)
    // =========================================================================
    function initVoiceRecognition() {
        const micBtn = document.getElementById('chatbotMicBtn');
        const input = document.getElementById('chatbotInput');
        if (!micBtn) return;

        const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRec) {
            micBtn.style.display = 'none';
            return;
        }

        let recognition = new SpeechRec();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        let isListening = false;

        recognition.onstart = function () {
            isListening = true;
            micBtn.classList.add('listening');
            if (input) input.placeholder = 'Listening... Speak now 🎙️';
        };

        recognition.onresult = function (event) {
            const transcript = event.results[0][0].transcript;
            if (input) {
                input.value = transcript;
                input.style.height = 'auto';
                input.style.height = Math.min(input.scrollHeight, 80) + 'px';
            }
            sendMessage();
        };

        recognition.onerror = function (event) {
            console.warn('Speech recognition error:', event.error);
            if (window.showToast) window.showToast('Voice input cancelled or not recognized.', 'info');
            isListening = false;
            micBtn.classList.remove('listening');
            if (input) input.placeholder = 'Ask about attendance or tap 🎤...';
        };

        recognition.onend = function () {
            isListening = false;
            micBtn.classList.remove('listening');
            if (input) input.placeholder = 'Ask about attendance or tap 🎤...';
        };

        micBtn.addEventListener('click', function () {
            if (isListening) {
                recognition.stop();
            } else {
                try {
                    recognition.start();
                } catch (err) {
                    console.error('Speech recognition start failed:', err);
                }
            }
        });
    }

    // =========================================================================
    // Toggle / Open / Close
    // =========================================================================
    function toggleChatbot() {
        if (isOpen) {
            closeChatbot();
        } else {
            openChatbot();
        }
    }

    function openChatbot() {
        const windowEl = document.getElementById('chatbotWindow');
        const toggleBtn = document.getElementById('chatbotToggleBtn');
        const input = document.getElementById('chatbotInput');

        if (windowEl) windowEl.classList.add('open');
        if (toggleBtn) toggleBtn.classList.add('active');
        isOpen = true;

        // Hide badge once opened
        const badge = document.getElementById('chatbotToggleBadge');
        if (badge) badge.style.display = 'none';

        // Show welcome message on first open
        if (isFirstOpen) {
            showWelcomeMessage();
            isFirstOpen = false;
        }

        // Focus input
        setTimeout(() => { if (input) input.focus(); }, 350);
    }

    function closeChatbot() {
        const windowEl = document.getElementById('chatbotWindow');
        const toggleBtn = document.getElementById('chatbotToggleBtn');

        if (windowEl) windowEl.classList.remove('open');
        if (toggleBtn) toggleBtn.classList.remove('active');
        isOpen = false;
    }

    // =========================================================================
    // Welcome Message
    // =========================================================================
    function showWelcomeMessage() {
        const messagesContainer = document.getElementById('chatbotMessages');
        if (!messagesContainer) return;

        const welcomeHTML = `
            <div class="chatbot-welcome">
                <div class="chatbot-welcome-icon">
                    <i class="fa-solid fa-robot"></i>
                </div>
                <h4>Smart Attendance Assistant</h4>
                <p>Hello Professor! I can query live student records, flag defaulters, look up roll numbers, and guide navigation.</p>
                <div class="chatbot-welcome-tags">
                    <span class="badge rounded-pill bg-light text-dark border">🎙️ Voice Enabled</span>
                    <span class="badge rounded-pill bg-light text-dark border">⚡ Roll Lookups</span>
                    <span class="badge rounded-pill bg-light text-dark border">⚠️ Defaulters</span>
                    <span class="badge rounded-pill bg-light text-dark border">🚀 1-Click Actions</span>
                </div>
            </div>
        `;
        messagesContainer.innerHTML = welcomeHTML;
    }

    // =========================================================================
    // Send Message
    // =========================================================================
    function sendMessage() {
        const input = document.getElementById('chatbotInput');
        if (!input) return;

        const message = input.value.trim();
        if (!message || isSending) return;

        // Clear input
        input.value = '';
        input.style.height = 'auto';

        // Hide suggestions after first message
        const suggestions = document.getElementById('chatbotSuggestions');
        if (suggestions) suggestions.style.display = 'none';

        // Add user message to UI
        addMessageToUI(message, 'user');

        // Add to history
        chatHistory.push({ role: 'user', content: message });

        // Show typing indicator
        showTypingIndicator();
        isSending = true;

        // Send to backend
        fetch('/api/chatbot', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({
                message: message,
                history: chatHistory.slice(-10) // Send last 10 messages for context
            })
        })
        .then(response => {
            if (response.status === 401) {
                throw new Error('unauthorized');
            }
            return response.json();
        })
        .then(data => {
            hideTypingIndicator();
            isSending = false;

            const botResponse = data.response || 'Sorry, I could not process your request.';
            const responseType = data.type || 'text';
            const actions = data.actions || [];

            // Add bot message to UI
            addMessageToUI(botResponse, 'bot', responseType, actions);

            // Add to history with metadata for follow-up context
            const historyEntry = { role: 'assistant', content: botResponse };
            if (data._intent) historyEntry._intent = data._intent;
            if (data._params) historyEntry._params = data._params;
            chatHistory.push(historyEntry);
        })
        .catch(error => {
            hideTypingIndicator();
            isSending = false;

            if (error.message === 'unauthorized') {
                addMessageToUI('Your session has expired. Please log in again to use the chatbot.', 'bot', 'text');
            } else {
                addMessageToUI('Sorry, something went wrong. Please try again.', 'bot', 'text');
            }
            console.error('Chatbot error:', error);
        });
    }

    // =========================================================================
    // Add Message to UI
    // =========================================================================
    function addMessageToUI(content, sender, type, actions = []) {
        const messagesContainer = document.getElementById('chatbotMessages');
        if (!messagesContainer) return;

        // Remove welcome message if present
        const welcome = messagesContainer.querySelector('.chatbot-welcome');
        if (welcome) welcome.remove();

        const msgDiv = document.createElement('div');
        msgDiv.className = `chatbot-msg ${sender}`;

        const bubbleDiv = document.createElement('div');
        bubbleDiv.className = 'chatbot-msg-bubble';

        if (sender === 'user') {
            bubbleDiv.textContent = content;
        } else {
            // Bot message: parse markdown-like formatting and HTML tables
            bubbleDiv.innerHTML = formatBotMessage(content);

            // Copy button for bot response
            const copyBtn = document.createElement('button');
            copyBtn.className = 'chatbot-copy-btn';
            copyBtn.title = 'Copy response';
            copyBtn.setAttribute('aria-label', 'Copy response');
            copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i>';
            copyBtn.addEventListener('click', () => {
                const textToCopy = bubbleDiv.innerText || bubbleDiv.textContent;
                navigator.clipboard.writeText(textToCopy).then(() => {
                    copyBtn.innerHTML = '<i class="fa-solid fa-check text-success"></i>';
                    setTimeout(() => { copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i>'; }, 1500);
                    if (window.showToast) window.showToast('Copied to clipboard!', 'success');
                }).catch(() => {
                    copyBtn.innerHTML = '<i class="fa-solid fa-check text-success"></i>';
                    setTimeout(() => { copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i>'; }, 1500);
                });
            });
            bubbleDiv.appendChild(copyBtn);
        }

        const timeDiv = document.createElement('div');
        timeDiv.className = 'chatbot-msg-time';
        timeDiv.textContent = formatTime(new Date());

        msgDiv.appendChild(bubbleDiv);
        msgDiv.appendChild(timeDiv);

        // One-Click Action Buttons
        if (sender === 'bot' && actions && actions.length > 0) {
            const actionsContainer = document.createElement('div');
            actionsContainer.className = 'chatbot-actions-row';
            actions.forEach(act => {
                const actBtn = document.createElement('button');
                actBtn.className = 'cb-action-btn';
                const iconHtml = act.icon ? `<i class="${act.icon} me-1"></i>` : '';
                actBtn.innerHTML = `${iconHtml}${act.label}`;
                actBtn.addEventListener('click', () => {
                    if (act.nav) {
                        if (window.simulateNav) {
                            window.simulateNav(act.nav);
                            if (window.showToast) window.showToast(`Navigated to ${act.nav}`, 'info');
                        }
                    } else if (act.query) {
                        const input = document.getElementById('chatbotInput');
                        if (input) input.value = act.query;
                        sendMessage();
                    }
                });
                actionsContainer.appendChild(actBtn);
            });
            msgDiv.appendChild(actionsContainer);
        }

        messagesContainer.appendChild(msgDiv);

        // Add contextual follow-up chips for bot messages
        if (sender === 'bot' && type !== undefined) {
            const followUpDiv = document.createElement('div');
            followUpDiv.className = 'chatbot-followup-chips';
            followUpDiv.style.cssText = 'display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; align-self: flex-start;';
            
            const followUps = getFollowUpSuggestions(content);
            followUps.forEach(suggestion => {
                const chip = document.createElement('button');
                chip.className = 'chatbot-suggestion-chip';
                chip.style.cssText = 'font-size: 0.68rem; padding: 3px 8px;';
                chip.textContent = suggestion;
                chip.addEventListener('click', () => {
                    const input = document.getElementById('chatbotInput');
                    if (input) { input.value = suggestion; }
                    sendMessage();
                });
                followUpDiv.appendChild(chip);
            });

            if (followUps.length > 0) {
                messagesContainer.appendChild(followUpDiv);
            }
        }

        // Scroll to bottom
        scrollToBottom();
    }

    // =========================================================================
    // Format Bot Message (markdown parsing)
    // =========================================================================
    function formatBotMessage(text) {
        if (!text) return '';

        let formatted = text;

        // Preserve existing HTML blocks (tables, spans, etc.)
        const htmlParts = [];
        let htmlIndex = 0;
        formatted = formatted.replace(/<table[\s\S]*?<\/table>/gi, function (match) {
            const placeholder = `%%HTML_BLOCK_${htmlIndex}%%`;
            htmlParts.push(match);
            htmlIndex++;
            return placeholder;
        });
        formatted = formatted.replace(/<span[\s\S]*?<\/span>/gi, function (match) {
            const placeholder = `%%HTML_BLOCK_${htmlIndex}%%`;
            htmlParts.push(match);
            htmlIndex++;
            return placeholder;
        });

        // Bold: **text**
        formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

        // Italic: _text_
        formatted = formatted.replace(/(?<!\w)_(.+?)_(?!\w)/g, '<em>$1</em>');

        // Newlines to <br>
        formatted = formatted.replace(/\n/g, '<br>');

        // Bullet points: • text
        formatted = formatted.replace(/^•\s/gm, '&bull; ');

        // Restore HTML blocks
        for (let i = 0; i < htmlParts.length; i++) {
            formatted = formatted.replace(`%%HTML_BLOCK_${i}%%`, htmlParts[i]);
        }

        return formatted;
    }

    // =========================================================================
    // Typing Indicator
    // =========================================================================
    function showTypingIndicator() {
        const typing = document.getElementById('chatbotTyping');
        if (typing) typing.classList.add('visible');
        scrollToBottom();
    }

    function hideTypingIndicator() {
        const typing = document.getElementById('chatbotTyping');
        if (typing) typing.classList.remove('visible');
    }

    // =========================================================================
    // Clear Conversation
    // =========================================================================
    function clearConversation() {
        const messagesContainer = document.getElementById('chatbotMessages');
        if (messagesContainer) messagesContainer.innerHTML = '';

        chatHistory = [];
        isFirstOpen = true;
        showWelcomeMessage();

        // Show suggestions again
        const suggestions = document.getElementById('chatbotSuggestions');
        if (suggestions) suggestions.style.display = 'flex';
    }

    // =========================================================================
    // Export Conversation Transcript
    // =========================================================================
    function exportConversation() {
        if (!chatHistory || chatHistory.length === 0) {
            if (window.showToast) window.showToast('No chat messages to export.', 'info');
            return;
        }

        let transcript = `Smart Attendance ERP — Assistant Transcript\n` +
                         `Exported on: ${new Date().toLocaleString()}\n` +
                         `============================================================\n\n`;

        chatHistory.forEach((msg, idx) => {
            const role = msg.role === 'user' ? 'PROFESSOR' : 'ASSISTANT';
            const cleanContent = (msg.content || '')
                .replace(/<[^>]*>/g, ' ')
                .replace(/\s+/g, ' ')
                .replace(/&bull;/g, '•')
                .trim();
            transcript += `[${idx + 1}] ${role}:\n${cleanContent}\n\n`;
        });

        const blob = new Blob([transcript], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Attendance_Assistant_Transcript_${new Date().toISOString().slice(0, 10)}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        if (window.showToast) window.showToast('Chat transcript exported!', 'success');
    }

    // =========================================================================
    // Check Pending Badge on Floating Button
    // =========================================================================
    async function checkPendingBadge() {
        const badge = document.getElementById('chatbotToggleBadge');
        if (!badge) return;
        try {
            const res = await fetch('/api/reports/notifications');
            if (!res.ok) return;
            const notifs = await res.json();
            const pending = notifs.filter(n => n.type === 'pending');
            if (pending.length > 0) {
                badge.textContent = '!';
                badge.title = `${pending.length} pending class(es) today!`;
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        } catch (_) {}
    }

    // =========================================================================
    // Utilities
    // =========================================================================
    function scrollToBottom() {
        const messagesContainer = document.getElementById('chatbotMessages');
        if (messagesContainer) {
            setTimeout(() => {
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }, 50);
        }
    }

    function formatTime(date) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    function getFollowUpSuggestions(content) {
        const text = (content || '').toLowerCase();
        const suggestions = [];

        if (text.includes('pending')) {
            suggestions.push('Mark attendance');
            suggestions.push('Today\'s schedule');
        } else if (text.includes('next lecture') || text.includes('next class')) {
            suggestions.push('Mark attendance');
            suggestions.push('Pending attendance');
        } else if (text.includes('defaulter') || text.includes('below')) {
            suggestions.push('Top attendees');
            suggestions.push('Weekly summary');
        } else if (text.includes('absent')) {
            suggestions.push('Show present students');
            suggestions.push('WhatsApp status');
        } else if (text.includes('present')) {
            suggestions.push('Show absent students');
            suggestions.push('Class-wise attendance');
        } else if (text.includes('schedule') || text.includes('lecture')) {
            suggestions.push('Pending attendance');
            suggestions.push('Who is absent today?');
        } else if (text.includes('whatsapp') || text.includes('notification')) {
            suggestions.push('Show my stats');
            suggestions.push('Who is absent today?');
        } else if (text.includes('summary') || text.includes('stats')) {
            suggestions.push('Defaulters list');
            suggestions.push('Weekly summary');
        } else if (text.includes('roll')) {
            suggestions.push('Show attendance history');
            suggestions.push('Who is absent today?');
        }

        // Always offer at most 2 suggestions
        return suggestions.slice(0, 2);
    }

    // =========================================================================
    // Initialize on DOM Ready
    // =========================================================================
    function init() {
        injectChatbotHTML();
        bindEvents();
        setTimeout(checkPendingBadge, 1500);
    }

    // Run when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
