/* ============================================================================
   KRISHI VOICE AI - UPGRADED APPLICATION SCRIPT
   ============================================================================ */

// DOM Elements
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const transcriptEl = document.getElementById('transcript');
const answerEl = document.getElementById('answer');
const backendUrlEl = document.getElementById('backendUrl');
const noteEl = document.getElementById('note');
const waveformEl = document.getElementById('waveform');
const transcriptStatusEl = document.getElementById('transcript-status');
const responseStatusEl = document.getElementById('response-status');
const themeToggleEl = document.getElementById('themeToggle');
const languageSelect = document.getElementById('languageSelect');

let recognition = null;
let isListening = false;
let currentAbortController = null;

/* ============================================================================
   UTILITY FUNCTIONS
   ============================================================================ */

function setNote(text, type = 'info') {
    noteEl.textContent = text || '';
    noteEl.className = `status-text ${type === 'listening' ? 'listening' : type === 'success' ? 'success' : ''}`;
}

function setTranscript(text) {
    transcriptEl.textContent = text || '(waiting for your voice...)';
    transcriptEl.classList.toggle('muted', !text || text === '(waiting for your voice...)');

    if (text && text !== '(waiting for your voice...)') {
        transcriptStatusEl.textContent = 'Received';
        transcriptStatusEl.className = 'box-status';
    } else {
        transcriptStatusEl.textContent = 'Ready';
        transcriptStatusEl.className = 'box-status';
    }
}

function setAnswer(text) {
    answerEl.textContent = text || '(waiting for response...)';
    answerEl.classList.toggle('muted', !text || text === '(waiting for response...)');

    if (text && !text.includes('Error') && !text.includes('(waiting')) {
        responseStatusEl.textContent = 'Complete';
        responseStatusEl.className = 'box-status';
    } else if (text && text.includes('Error')) {
        responseStatusEl.textContent = 'Error';
        responseStatusEl.className = 'box-status processing';
    } else {
        responseStatusEl.textContent = 'Idle';
        responseStatusEl.className = 'box-status';
    }
}

function showWaveform(show) {
    if (show) {
        waveformEl.style.display = 'flex';
    } else {
        waveformEl.style.display = 'none';
    }
}

function clearAll() {
    setTranscript('');
    setAnswer('');
    setNote('Cleared. Ready for new input.');
}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            setNote(`Fullscreen error: ${err.message}`);
        });
    } else {
        document.exitFullscreen();
    }
}

function toggleTheme() {
    const root = document.documentElement;
    const currentTheme = root.getAttribute('data-theme') || 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    root.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);

    updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
    themeToggleEl.textContent = theme === 'dark' ? '☀️' : '🌙';
}

function initializeTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

function speechSupported() {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

function saveBackendUrl() {
    const url = backendUrlEl.value.trim();
    if (url) {
        localStorage.setItem('backendUrl', url);
    }
}

function loadBackendUrl() {
    const saved = localStorage.getItem('backendUrl');
    if (saved) {
        backendUrlEl.value = saved;
    }
}

// Global audio object to allow cancelling
let currentAudio = null;

function speakText(text) {
    // Stop any ongoing Google TTS Audio
    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
    }
    
    // Stop any ongoing browser speech synthesis
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
    }

    const targetLang = languageSelect.value; // e.g., 'hi-IN', 'kn-IN'
    const langCode = targetLang.split('-')[0]; // 'hi', 'kn', 'en'
    
    // Check if browser has a native voice for this exact language
    let voices = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
    let nativeVoice = voices.find(v => v.lang === targetLang || v.lang.startsWith(langCode));

    // If Kannada, or if no native voice is found, use Google Translate TTS for guaranteed support
    if (langCode === 'kn' || !nativeVoice) {
        // Split long text into chunks if needed (Google TTS has a 200 char limit)
        const safeText = text.substring(0, 195);
        const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${langCode}&q=${encodeURIComponent(safeText)}`;
        currentAudio = new Audio(url);
        currentAudio.play().catch(e => {
            console.error("Audio fallback failed:", e);
            // If network fails, try native synthesis anyway
            fallbackToNativeSpeech(text, targetLang, nativeVoice);
        });
    } else {
        fallbackToNativeSpeech(text, targetLang, nativeVoice);
    }
}

function fallbackToNativeSpeech(text, lang, voice) {
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang;
        if (voice) utterance.voice = voice;
        utterance.rate = 0.9;
        window.speechSynthesis.speak(utterance);
    }
}

/* ============================================================================
   SPEECH RECOGNITION SETUP
   ============================================================================ */

function createRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const r = new SpeechRecognition();

    // Configuration
    r.lang = languageSelect.value; // Use the selected language
    r.continuous = false;
    r.interimResults = true;

    // Event Handlers
    r.onstart = () => {
        isListening = true;
        startBtn.disabled = true;
        startBtn.classList.add('listening');
        stopBtn.disabled = false;
        
        const langNames = {
            'hi-IN': 'Hindi',
            'kn-IN': 'Kannada',
            'en-US': 'English'
        };
        const selectedLangName = langNames[languageSelect.value] || 'your language';
        setNote(`Listening... speak in ${selectedLangName}.`, 'listening');
        showWaveform(true);
        setTranscript('');
        setAnswer('');
    };

    r.onerror = (e) => {
        const errorMessages = {
            'no-speech': 'No speech detected. Please speak clearly and try again.',
            'audio-capture': 'No microphone found. Check your device and permissions.',
            'network': 'Network error. Check your internet connection.',
            'aborted': 'Speech recognition was aborted.',
            'service-not-allowed': 'Speech recognition service is not allowed.',
        };

        const message = errorMessages[e.error] || `Speech error: ${e.error || 'unknown'}`;
        setNote(message);
        showWaveform(false);
    };

    r.onend = () => {
        isListening = false;
        startBtn.disabled = false;
        startBtn.classList.remove('listening');
        stopBtn.disabled = true;
        showWaveform(false);
        setNote('Ready to listen again.');
    };

    r.onresult = async (event) => {
        let finalText = '';
        let interimText = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
            const text = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                finalText += text;
            } else {
                interimText += text;
            }
        }

        const combined = (finalText || interimText || '').trim();
        setTranscript(combined);

        // Send to AI when final result is received
        if (finalText && finalText.trim()) {
            showWaveform(false);
            await askAI(finalText.trim());
        }
    };

    return r;
}

/* ============================================================================
   AI QUERY HANDLER
   ============================================================================ */

async function askAI(query) {
    try {
        const baseUrl = backendUrlEl.value.trim().replace(/\/$/, '');

        if (!baseUrl) {
            setAnswer('Error: Backend URL is not set. Please enter your backend URL.');
            setNote('Configuration error.');
            return;
        }

        // The backend route is mounted at /vapi/chat
        const url = `${baseUrl}/vapi/chat`;

        setNote('Asking AI...');
        responseStatusEl.textContent = 'Processing';
        responseStatusEl.className = 'box-status processing';
        setAnswer('Processing your query...');

        // Create new abort controller for this request
        currentAbortController = new AbortController();
        const timeoutId = setTimeout(() => {
            currentAbortController.abort();
        }, 30000); // 30 second timeout

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                // The backend expects { text: ..., language: ... }
                body: JSON.stringify({ 
                    text: query,
                    language: languageSelect.value
                }),
                signal: currentAbortController.signal
            });

            clearTimeout(timeoutId);

            // Handle response
            if (!response.ok) {
                let errorMsg = `HTTP ${response.status}: ${response.statusText}`;

                try {
                    const errorData = await response.json();
                    if (errorData.error) {
                        errorMsg = errorData.error;
                    }
                } catch (e) {
                    // Response wasn't JSON
                }

                setAnswer(`Error: ${errorMsg}`);
                setNote('Request failed. Check your backend.');
                responseStatusEl.textContent = 'Error';
                return;
            }

            // Parse response
            const contentType = response.headers.get('content-type');
            let data;

            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            } else {
                const text = await response.text();
                data = { answer: text };
            }

            // Display answer
            const answer = data.answer || data.response || data.result || JSON.stringify(data);
            setAnswer(answer);
            setNote('✓ Done!', 'success');
            responseStatusEl.textContent = 'Complete';
            responseStatusEl.className = 'box-status';

            // Speak the answer aloud
            speakText(answer);

            // Save backend URL for next session
            saveBackendUrl();

        } catch (fetchErr) {
            clearTimeout(timeoutId);

            let errorMsg = 'Unknown error occurred';

            if (fetchErr.name === 'AbortError') {
                errorMsg = 'Request timed out (30s). Backend may be down or slow.';
            } else if (fetchErr instanceof TypeError) {
                errorMsg = `Connection error: ${fetchErr.message}. Check if backend is running at ${baseUrl}`;
            } else {
                errorMsg = fetchErr.message || 'Failed to connect to backend';
            }

            setAnswer(`Error: ${errorMsg}`);
            setNote('Request failed.');
            responseStatusEl.textContent = 'Error';
        }

    } catch (err) {
        const msg = err.message || String(err) || 'Unknown error';
        setAnswer(`Error: ${msg}`);
        setNote('Unexpected error occurred.');
    }
}

/* ============================================================================
   EVENT LISTENERS
   ============================================================================ */

startBtn.addEventListener('click', () => {
    if (!speechSupported()) {
        setNote('Web Speech API not supported. Try Chrome, Edge, or Firefox.');
        setAnswer('Your browser does not support voice input.');
        return;
    }

    if (!recognition) {
        recognition = createRecognition();
    }

    // Abort any ongoing request
    if (currentAbortController) {
        currentAbortController.abort();
    }

    // Stop any ongoing speech
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
    }

    setTranscript('');
    setAnswer('');

    try {
        recognition.start();
    } catch (e) {
        // Recognition already started or other error
        if (e.message && e.message.includes('already started')) {
            // Already listening, ignore
        } else {
            setNote('Could not start microphone. Check permissions in browser settings.');
        }
    }
});

stopBtn.addEventListener('click', () => {
    // Stop any ongoing speech
    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
    }
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
    }

    if (!recognition || !isListening) {
        return;
    }

    try {
        recognition.stop();
        setNote('Stopped by user.');
    } catch (e) {
        setNote('Could not stop recognition.');
    }
});

themeToggleEl.addEventListener('click', toggleTheme);

backendUrlEl.addEventListener('change', saveBackendUrl);
backendUrlEl.addEventListener('blur', saveBackendUrl);

languageSelect.addEventListener('change', () => {
    if (recognition) {
        recognition.lang = languageSelect.value;
    }
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Space to start/stop listening
    if (e.code === 'Space' && document.activeElement !== backendUrlEl) {
        e.preventDefault();
        if (!isListening) {
            startBtn.click();
        }
    }

    // Escape to stop
    if (e.code === 'Escape' && isListening) {
        stopBtn.click();
    }
});

/* ============================================================================
   INITIALIZATION
   ============================================================================ */

window.addEventListener('DOMContentLoaded', () => {
    // Initialize theme
    initializeTheme();

    // Load saved backend URL
    loadBackendUrl();

    // Check speech support
    if (!speechSupported()) {
        setNote('⚠️ Web Speech API not supported in this browser. Use Chrome, Edge, or Firefox.');
        startBtn.disabled = true;
    } else {
        setNote('✓ Click the microphone or press Space to start talking.');
    }

    // Set initial states
    setTranscript('');
    setAnswer('');
});

/* ============================================================================
   CLEANUP
   ============================================================================ */

window.addEventListener('beforeunload', () => {
    if (recognition && isListening) {
        recognition.stop();
    }
    if (currentAbortController) {
        currentAbortController.abort();
    }
});

// Export functions for inline use
window.clearAll = clearAll;
window.toggleFullscreen = toggleFullscreen;