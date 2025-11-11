/**
 * AI Audio Separation Mode - Simplified
 * Simple file-based interface for music and voice separation
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const API_BASE_URL = 'http://localhost:5000/api/ai';
console.log('🚀 AI Mode JS Loaded');
console.log('📡 API Base URL:', API_BASE_URL);

let uploadedFile = null;
let currentMode = null;
let separatedFiles = {};

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('🎵 AI Mode initialized');
    initializeEventListeners();
    testAPIConnection();
});

async function testAPIConnection() {
    try {
        const response = await fetch('http://localhost:5000/api/test');
        const data = await response.json();
        console.log('✅ API Connection successful:', data);
    } catch (error) {
        console.error('❌ API Connection failed:', error);
        showError('Backend server is not running. Please start the Flask server.');
    }
}

function initializeEventListeners() {
    const audioFileInput = document.getElementById('audioFile');
    const aiModeSelect = document.getElementById('aiModeSelect');
    const separateButton = document.getElementById('separateButton');
    const downloadAllBtn = document.getElementById('downloadAllBtn');
    const resetBtn = document.getElementById('resetBtn');
    
    audioFileInput.addEventListener('change', handleFileSelect);
    aiModeSelect.addEventListener('change', handleModeChange);
    separateButton.addEventListener('click', startSeparation);
    
    if (downloadAllBtn) downloadAllBtn.addEventListener('click', downloadAll);
    if (resetBtn) resetBtn.addEventListener('click', resetAll);
}

// ============================================================================
// FILE HANDLING
// ============================================================================

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    console.log('📁 File selected:', file.name);
    
    // Validate file type
    const validTypes = ['audio/mpeg', 'audio/wav', 'audio/flac', 'audio/x-m4a', 'audio/mp3'];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(mp3|wav|flac|m4a)$/i)) {
        showError('Invalid file type. Please upload MP3, WAV, FLAC, or M4A files.');
        return;
    }
    
    // Validate file size (100MB max)
    if (file.size > 100 * 1024 * 1024) {
        showError('File too large. Maximum size is 100MB.');
        return;
    }
    
    uploadedFile = file;
    
    // Update UI
    document.getElementById('fileInfo').textContent = 
        `${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;
    
    // Enable mode selection
    const aiModeSelect = document.getElementById('aiModeSelect');
    aiModeSelect.disabled = false;
    aiModeSelect.innerHTML = `
        <option value="">-- Select Separation Type --</option>
        <option value="music">Music Separation (Drums, Bass, Vocals, Other)</option>
        <option value="voice">Voice Separation (Multiple Speakers)</option>
    `;
    
    // Show original audio player
    const originalAudio = document.getElementById('originalAudio');
    originalAudio.src = URL.createObjectURL(file);
    document.getElementById('originalFileSection').classList.remove('hidden');
    
    console.log('✅ File loaded successfully');
}

// ============================================================================
// MODE HANDLING
// ============================================================================

function handleModeChange(e) {
    const mode = e.target.value;
    console.log('🔄 Mode changed to:', mode);
    
    currentMode = mode;
    
    const musicSettings = document.getElementById('musicSettings');
    const voiceSettings = document.getElementById('voiceSettings');
    const separateButton = document.getElementById('separateButton');
    
    musicSettings.classList.add('hidden');
    voiceSettings.classList.add('hidden');
    
    if (mode === 'music') {
        musicSettings.classList.remove('hidden');
        separateButton.disabled = false;
    } else if (mode === 'voice') {
        voiceSettings.classList.remove('hidden');
        separateButton.disabled = false;
    } else {
        separateButton.disabled = true;
    }
}

// ============================================================================
// SEPARATION
// ============================================================================

async function startSeparation() {
    if (!uploadedFile || !currentMode) {
        showError('Please upload a file and select a mode first.');
        return;
    }
    
    console.log('🚀 Starting separation...');
    
    const separateButton = document.getElementById('separateButton');
    separateButton.disabled = true;
    separateButton.innerHTML = '<i class="bi bi-hourglass-split"></i> Processing...';
    
    const progressContainer = document.getElementById('progressContainer');
    progressContainer.classList.remove('hidden');
    
    try {
        if (currentMode === 'music') {
            await separateMusic();
        } else if (currentMode === 'voice') {
            await separateVoice();
        }
    } catch (error) {
        console.error('❌ Separation error:', error);
        showError('Separation failed: ' + error.message);
        
        separateButton.disabled = false;
        separateButton.innerHTML = '<i class="bi bi-cpu-fill"></i> Start Separation';
        progressContainer.classList.add('hidden');
    }
}

async function separateMusic() {
    console.log('🎵 Starting music separation...');
    
    const formData = new FormData();
    formData.append('audio', uploadedFile);
    formData.append('model_name', document.getElementById('musicModel').value);
    
    updateProgress(10, 'Uploading...');
    
    try {
        const response = await fetch(`${API_BASE_URL}/music_separation`, {
            method: 'POST',
            body: formData
        });
        
        updateProgress(50, 'AI processing...');
        
        // Check if response is JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            console.error('❌ Non-JSON response:', text);
            throw new Error('Server returned non-JSON response. Check if AI mode endpoint exists.');
        }
        
        const data = await response.json();
        console.log('📦 Response data:', data);
        
        if (!response.ok) {
            throw new Error(data.error || 'Music separation failed');
        }
        
        if (!data.success) {
            throw new Error(data.error || 'Separation failed');
        }
        
        updateProgress(90, 'Loading results...');
        displayMusicResults(data);
        updateProgress(100, 'Complete!');
        
        setTimeout(() => {
            document.getElementById('progressContainer').classList.add('hidden');
        }, 2000);
    } catch (error) {
        console.error('❌ Music separation error:', error);
        throw error;
    }
}

async function separateVoice() {
    console.log('🎤 Starting voice separation...');
    
    const formData = new FormData();
    formData.append('audio', uploadedFile);
    formData.append('num_speakers', document.getElementById('numSpeakers').value);
    formData.append('apply_enhancement', document.getElementById('applyEnhancement').checked);
    formData.append('noise_reduction', document.getElementById('noiseReduction').checked);
    
    updateProgress(10, 'Uploading...');
    
    try {
        const response = await fetch(`${API_BASE_URL}/voice_separation`, {
            method: 'POST',
            body: formData
        });
        
        updateProgress(50, 'AI processing...');
        
        // Check if response is JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            console.error('❌ Non-JSON response:', text);
            throw new Error('Server returned non-JSON response. Check if AI mode endpoint exists.');
        }
        
        const data = await response.json();
        console.log('📦 Response data:', data);
        
        if (!response.ok) {
            throw new Error(data.error || 'Voice separation failed');
        }
        
        if (!data.success) {
            throw new Error(data.error || 'Separation failed');
        }
        
        updateProgress(90, 'Loading results...');
        displayVoiceResults(data);
        updateProgress(100, 'Complete!');
        
        setTimeout(() => {
            document.getElementById('progressContainer').classList.add('hidden');
        }, 2000);
    } catch (error) {
        console.error('❌ Voice separation error:', error);
        throw error;
    }
}

function updateProgress(percent, message) {
    const progressBar = document.getElementById('progressBar');
    progressBar.style.width = percent + '%';
    progressBar.textContent = percent + '%';
}

// ============================================================================
// DISPLAY RESULTS
// ============================================================================

function displayMusicResults(data) {
    console.log('🎵 Displaying music results...');
    console.log('Data received:', data);
    
    separatedFiles = {};
    const container = document.getElementById('audioFilesContainer');
    container.innerHTML = '';
    
    const stems = [
        { key: 'drums', title: 'Drums', icon: 'bi-music-note-beamed' },
        { key: 'bass', title: 'Bass', icon: 'bi-music-note' },
        { key: 'vocals', title: 'Vocals', icon: 'bi-mic-fill' },
        { key: 'other', title: 'Other', icon: 'bi-soundwave' },
        { key: 'guitar', title: 'Guitar', icon: 'bi-music-note-list' },
        { key: 'piano', title: 'Piano', icon: 'bi-music-note' }
    ];
    
    stems.forEach(stem => {
        if (data[stem.key]) {
            // Don't encode the filename - send it as-is
            const fileUrl = `${API_BASE_URL}/download/${data[stem.key]}`;
            console.log(`Creating player for ${stem.title}: ${fileUrl}`);
            separatedFiles[stem.key] = { url: fileUrl, filename: `${stem.key}.wav` };
            createAudioFileItem(container, stem.title, stem.icon, fileUrl, stem.key);
        }
    });
    
    document.getElementById('resultsSection').classList.remove('hidden');
    console.log('✅ Music results displayed');
}

function displayVoiceResults(data) {
    console.log('🎤 Displaying voice results...');
    console.log('Data received:', data);
    
    separatedFiles = {};
    const container = document.getElementById('audioFilesContainer');
    container.innerHTML = '';
    
    if (data.voices) {
        Object.entries(data.voices).forEach(([voiceKey, filePath]) => {
            if (filePath) {
                // Don't encode the filename - send it as-is
                const fileUrl = `${API_BASE_URL}/download/${filePath}`;
                const title = voiceKey.replace(/_/g, ' ').toUpperCase();
                console.log(`Creating player for ${title}: ${fileUrl}`);
                separatedFiles[voiceKey] = { url: fileUrl, filename: `${voiceKey}.wav` };
                createAudioFileItem(container, title, 'bi-person-fill', fileUrl, voiceKey);
            }
        });
    }
    
    document.getElementById('resultsSection').classList.remove('hidden');
    console.log('✅ Voice results displayed');
}

function createAudioFileItem(container, title, icon, fileUrl, key) {
    const item = document.createElement('div');
    item.className = 'audio-file-item';
    item.innerHTML = `
        <div class="d-flex align-items-center justify-content-between mb-2">
            <div class="d-flex align-items-center">
                <i class="bi ${icon} fs-4 me-3 text-primary"></i>
                <strong>${title}</strong>
            </div>
            <button class="btn btn-sm btn-primary" onclick="downloadFile('${key}')">
                <i class="bi bi-download"></i> Download
            </button>
        </div>
        <audio controls class="w-100" preload="metadata">
            <source src="${fileUrl}" type="audio/wav">
            Your browser does not support the audio element.
        </audio>
    `;
    container.appendChild(item);
    
    console.log(`✅ Created audio player for ${title}`);
}

// ============================================================================
// DOWNLOAD
// ============================================================================

function downloadFile(key) {
    if (!separatedFiles[key]) return;
    
    const link = document.createElement('a');
    link.href = separatedFiles[key].url;
    link.download = separatedFiles[key].filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    console.log(`✅ Download started: ${separatedFiles[key].filename}`);
}

function downloadAll() {
    console.log('⬇️ Downloading all files...');
    
    Object.keys(separatedFiles).forEach((key, index) => {
        setTimeout(() => downloadFile(key), index * 500);
    });
    
    showSuccess(`Downloading ${Object.keys(separatedFiles).length} files...`);
}

// ============================================================================
// RESET
// ============================================================================

function resetAll() {
    console.log('🔄 Resetting...');
    
    // Stop all audio
    document.querySelectorAll('audio').forEach(audio => {
        audio.pause();
        audio.currentTime = 0;
    });
    
    // Clear state
    uploadedFile = null;
    currentMode = null;
    separatedFiles = {};
    
    // Reset UI
    document.getElementById('audioFile').value = '';
    document.getElementById('fileInfo').textContent = 'No file selected';
    document.getElementById('aiModeSelect').disabled = true;
    document.getElementById('aiModeSelect').innerHTML = '<option value="">Please upload audio first</option>';
    document.getElementById('separateButton').disabled = true;
    document.getElementById('separateButton').innerHTML = '<i class="bi bi-cpu-fill"></i> Start Separation';
    
    document.getElementById('musicSettings').classList.add('hidden');
    document.getElementById('voiceSettings').classList.add('hidden');
    document.getElementById('originalFileSection').classList.add('hidden');
    document.getElementById('resultsSection').classList.add('hidden');
    document.getElementById('progressContainer').classList.add('hidden');
    
    console.log('✅ Reset complete');
}

// ============================================================================
// NOTIFICATIONS
// ============================================================================

function showError(message) {
    console.error('❌ Error:', message);
    alert('Error: ' + message);
}

function showSuccess(message) {
    console.log('✅ Success:', message);
    
    const notification = document.createElement('div');
    notification.className = 'alert alert-success alert-dismissible fade show';
    notification.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 10000; min-width: 300px;';
    notification.innerHTML = `
        <i class="bi bi-check-circle-fill"></i> ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}

console.log('✅ AI Mode JavaScript loaded successfully');