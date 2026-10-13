/**
 * Attendance Assistant Chatbot — Frontend Logic
 * Handles UI interactions, message sending, and conversation history.
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
        <!-- Floating Toggle Button -->
        <button class="chatbot-toggle-btn" id="chatbotToggleBtn" title="Attendance Assistant" aria-label="Open Attendance Assistant Chatbot">
            <span class="chatbot-icon-open"><i class="fa-solid fa-robot"></i></span>
            <span class="chatbot-icon-close"><i class="fa-solid fa-xmark"></i></span>
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
                        <div class="chatbot-header-subtitle">Ask about students & attendance</div>
                    </div>
                </div>
                <div class="chatbot-header-actions">
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
                <button class="chatbot-suggestion-chip" data-query="Show class-wise attendance">Class-wise attendance</button>
                <button class="chatbot-suggestion-chip" data-query="Who has attendance below 75%?">Below 75%</button>
                <button class="chatbot-suggestion-chip" data-query="Show today's attendance">Today's attendance</button>
            </div>

            <!-- Input Area -->
            <div class="chatbot-input-area">
                <textarea class="chatbot-input" id="chatbotInput" placeholder="Ask about attendance..." rows="1" maxlength="500"></textarea>
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
        const sendBtn = document.getElementById('chatbotSendBtn');
        const input = document.getElementById('chatbotInput');
        const suggestionsContainer = document.getElementById('chatbotSuggestions');

        if (toggleBtn) toggleBtn.addEventListener('click', toggleChatbot);
        if (closeBtn) closeBtn.addEventListener('click', closeChatbot);
        if (clearBtn) clearBtn.addEventListener('click', clearConversation);
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

        // Close on Escape key
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && isOpen) {
                closeChatbot();
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
        const window = document.getElementById('chatbotWindow');
        const toggleBtn = document.getElementById('chatbotToggleBtn');
        const input = document.getElementById('chatbotInput');

        if (window) window.classList.add('open');
        if (toggleBtn) toggleBtn.classList.add('active');
        isOpen = true;

        // Show welcome message on first open
        if (isFirstOpen) {
            showWelcomeMessage();
            isFirstOpen = false;
        }

        // Focus input
        setTimeout(() => { if (input) input.focus(); }, 350);
    }

    function closeChatbot() {
        const window = document.getElementById('chatbotWindow');
        const toggleBtn = document.getElementById('chatbotToggleBtn');

        if (window) window.classList.remove('open');
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
                <h4>Attendance Assistant</h4>
                <p>Hi! I can help you with student attendance queries. Ask me anything about attendance, students, or class records.</p>
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

            // Add bot message to UI
            addMessageToUI(botResponse, 'bot', responseType);

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
    function addMessageToUI(content, sender, type) {
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
            if (type === 'html') {
                bubbleDiv.innerHTML = formatBotMessage(content);
            } else {
                bubbleDiv.innerHTML = formatBotMessage(content);
            }
        }

        const timeDiv = document.createElement('div');
        timeDiv.className = 'chatbot-msg-time';
        timeDiv.textContent = formatTime(new Date());

        msgDiv.appendChild(bubbleDiv);
        msgDiv.appendChild(timeDiv);
        messagesContainer.appendChild(msgDiv);

        // Scroll to bottom
        scrollToBottom();
    }

    // =========================================================================
    // Format Bot Message (basic markdown-like parsing)
    // =========================================================================
    function formatBotMessage(text) {
        if (!text) return '';

        // If it already contains HTML table tags, keep them as-is but format the rest
        let formatted = text;

        // Preserve existing HTML (tables, spans, etc.)
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

    // =========================================================================
    // Initialize on DOM Ready
    // =========================================================================
    function init() {
        injectChatbotHTML();
        bindEvents();
    }

    // Run when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
