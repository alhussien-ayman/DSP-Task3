// any_mode.js - Generic template for ANY mode

// Wait for general mode
if (typeof window.generalMode === 'undefined') {
    console.error("❌ General mode not loaded. Make sure general_mode.js is included first.");
}

// Mode-specific variables
let currentMode = '';
let currentSettings = null;
let lastProcessedGains = null;

// Initialize your mode
function init() {
    console.log("🚀 Initializing Your Custom Mode...");
    
    // Initialize shared general functionality
    window.generalMode.initGeneral();
    
    // Setup your custom event listeners
    setupCustomEventListeners();
}

function setupCustomEventListeners() {
    console.log("🔧 Setting up custom event listeners...");
    
    const elements = window.generalMode.elements;
    
    // ========== USE GENERAL MODE FUNCTIONS ==========
    // File upload (works perfectly)
    elements.uploadArea.addEventListener('click', () => elements.audioFile.click());
    elements.audioFile.addEventListener('change', (e) => window.generalMode.loadAudioFile(e.target.files[0]));
    
    // Playback controls (works perfectly)
    elements.playInputBtn.addEventListener('click', () => window.generalMode.playAudio('input'));
    elements.playOutputBtn.addEventListener('click', () => window.generalMode.playAudio('output'));
    elements.pauseBtn.addEventListener('click', window.generalMode.pauseSignal);
    elements.pauseOutputBtn.addEventListener('click', window.generalMode.pauseSignal);
    
    // Speed controls (works perfectly)
    elements.speedControl.addEventListener('input', (e) => window.generalMode.setSpeed(e.target.value));
    elements.speedControlOutput.addEventListener('input', (e) => window.generalMode.setSpeed(e.target.value));
    
    // Scale controls (works perfectly)
    elements.inputLinearScale.addEventListener('click', () => window.generalMode.setInputScale('linear'));
    elements.inputAudiogramScale.addEventListener('click', () => window.generalMode.setInputScale('audiogram'));
    elements.outputLinearScale.addEventListener('click', () => window.generalMode.setOutputScale('linear'));
    elements.outputAudiogramScale.addEventListener('click', () => window.generalMode.setOutputScale('audiogram'));
    
    // Spectrogram toggles (works perfectly)
    elements.inputSpectrogramToggle.addEventListener('click', window.generalMode.toggleInputSpectrogram);
    elements.outputSpectrogramToggle.addEventListener('click', window.generalMode.toggleOutputSpectrogram);
    
    // Output controls (works perfectly)
    elements.downloadBtn.addEventListener('click', window.generalMode.downloadOutput);
    elements.saveSettingsBtn.addEventListener('click', window.generalMode.saveSettings);
    
    // ========== OVERRIDE WHAT YOU WANT ==========
    elements.modeSelect.addEventListener('change', (e) => switchMode(e.target.value));
    elements.resetBtn.addEventListener('click', resetEqualizer);
}

// Custom switch mode - DO WHATEVER YOU WANT HERE
async function switchMode(mode) {
    if (!mode) {
        // Clear sliders your way
        window.generalMode.elements.equalizerControls.innerHTML = `
            <div class="text-center text-muted py-4">
                <i class="bi bi-stars" style="font-size: 2rem; opacity: 0.3;"></i>
                <p class="mt-2">Your custom message here</p>
            </div>
        `;
        currentMode = '';
        return;
    }
    
    currentMode = mode;
    
    try {
        console.log(`🎯 YOUR CUSTOM MODE: Loading ${mode}...`);
        window.generalMode.elements.modeStatus.innerHTML = `<i class="bi bi-stars"></i> Loading ${mode} with YOUR algorithm...`;
        
        // Use general mode's backend call or make your own
        const response = await fetch(`${window.generalMode.API_BASE_URL}/${mode}/settings`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        currentSettings = await response.json();
        console.log(`✅ ${mode} settings loaded:`, currentSettings);
        
        // Generate sliders YOUR way
        generateEqualizerSliders(mode, currentSettings);
        
        window.generalMode.elements.modeStatus.innerHTML = `<i class="bi bi-stars"></i> YOUR ${mode} mode ready!`;
        
        // Auto-process if audio is loaded
        if (window.generalMode.isAudioLoaded) {
            await processImmediately();
        }
        
    } catch (error) {
        console.error('❌ Error in YOUR mode:', error);
        window.generalMode.elements.modeStatus.innerHTML = `<i class="bi bi-exclamation-triangle"></i> Your Custom Error: ${error.message}`;
    }
}

// Generate sliders YOUR way - COMPLETE FREEDOM
function generateEqualizerSliders(mode, settings) {
    console.log(`🎛️ YOUR CUSTOM sliders for ${mode}`);
    const sliders = settings.sliders;
    
    // Reset gain values
    window.generalMode.gainValues = new Array(sliders.length).fill(1.0);
    lastProcessedGains = [...window.generalMode.gainValues];
    
    // Create UI exactly how you want
    window.generalMode.elements.equalizerControls.innerHTML = `
        <div class="mb-3 p-3 bg-primary text-white rounded">
            <small><strong>🌟 YOUR ${mode.toUpperCase()} MODE:</strong> ${sliders.length} bands</small>
        </div>
        ${sliders.map((slider, index) => `
            <div class="slider-card" style="border-left: 4px solid #007bff;">
                <div class="slider-header">
                    <span class="slider-name">⭐ ${slider.name}</span>
                    <span class="slider-value" id="value${index}">1.0x</span>
                </div>
                ${slider.description ? `<div class="slider-description"><small>${slider.description}</small></div>` : ''}
                <input type="range" class="custom-slider" min="0" max="2" value="1" step="0.01" 
                        data-index="${index}" id="slider-${index}"
                        style="accent-color: #007bff;">
                <div class="frequency-bands">
                    <small>🎵 ${slider.frequency_bands.map(band => `${band[0]}-${band[1]}Hz`).join(', ')}</small>
                </div>
            </div>
        `).join('')}
        <div class="mt-3 p-2 bg-light rounded">
            <small>✨ Your custom footer message</small>
        </div>
    `;
    
    // Add event listeners your way
    document.querySelectorAll('.custom-slider').forEach(slider => {
        slider.addEventListener('input', (e) => {
            const index = parseInt(e.target.dataset.index);
            const value = parseFloat(e.target.value);
            
            // Use general mode's function or create your own
            window.generalMode.updateSliderValue(index, value);
            
            // Your custom feedback
            window.generalMode.elements.processStatus.innerHTML = '<i class="bi bi-stars"></i> Your custom processing...';
            
            // Use general mode's scheduling or your own
            window.generalMode.scheduleImmediateProcessing();
        });
    });
}

// Process YOUR way - COMPLETE FREEDOM
async function processImmediately() {
    if (!window.generalMode.inputSignal || !currentMode || !currentSettings) return;
    
    // Your custom duplicate check
    if (lastProcessedGains && window.generalMode.arraysEqual(window.generalMode.gainValues, lastProcessedGains)) {
        console.log("⏭️ YOUR MODE: Skipping duplicate");
        return;
    }
    
    const requestId = Date.now();
    window.generalMode.currentRequestId = requestId;
    const currentGainsToProcess = [...window.generalMode.gainValues];
    
    window.generalMode.pendingRequests.set(requestId, {
        gains: currentGainsToProcess,
        timestamp: Date.now()
    });
    
    console.log(`⚡ [YOUR MODE Request ${requestId}] Processing...`);
    window.generalMode.elements.processStatus.innerHTML = '<i class="bi bi-stars"></i> Your custom processing...';
    
    try {
        const formData = new FormData();
        formData.append('file', window.generalMode.inputSignal);
        formData.append('sliders', JSON.stringify(currentGainsToProcess));
        formData.append('scale', window.generalMode.currentOutputScale);
        
        // Add your custom parameters
        formData.append('custom_mode', 'your_special_mode');
        formData.append('timestamp', Date.now());
        
        const response = await fetch(`${window.generalMode.API_BASE_URL}/${currentMode}/process`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) throw new Error(`Backend error ${response.status}`);
        
        const result = await response.json();
        
        if (!isRequestStillRelevant(requestId, currentGainsToProcess)) {
            console.log(`🔄 [YOUR MODE Request ${requestId}] Outdated`);
            return;
        }
        
        if (!result.success) throw new Error(result.error || 'Processing failed');
        
        // Store processed audio
        if (result.processed_audio_base64) {
            const audioData = Uint8Array.from(atob(result.processed_audio_base64), c => c.charCodeAt(0));
            window.generalMode.processedAudioBuffer = await window.generalMode.audioContext.decodeAudioData(audioData.buffer);
        }
        
        // Update visualizations
        window.generalMode.updateOutputVisualizations(result);
        lastProcessedGains = [...currentGainsToProcess];
        window.generalMode.pendingRequests.clear();
        
        window.generalMode.elements.processStatus.innerHTML = '<i class="bi bi-stars"></i> YOUR processing complete!';
        
    } catch (error) {
        console.error(`❌ [YOUR MODE] Error:`, error);
        window.generalMode.elements.processStatus.innerHTML = `<i class="bi bi-exclamation-triangle"></i> Your custom error: ${error.message}`;
        window.generalMode.pendingRequests.delete(requestId);
    }
}

// Your custom reset
function resetEqualizer() {
    console.log("🔄 YOUR CUSTOM reset...");
    const sliders = document.querySelectorAll('.custom-slider');
    sliders.forEach((slider, index) => {
        slider.value = 1.0;
        window.generalMode.updateSliderValue(index, 1.0);
    });
    
    if (window.generalMode.isAudioLoaded && currentMode) {
        processImmediately();
    }
}

// Your helper function
function isRequestStillRelevant(requestId, originalGains) {
    if (requestId === window.generalMode.currentRequestId) return true;
    if (!window.generalMode.arraysEqual(originalGains, window.generalMode.gainValues)) return false;
    const newerRequests = Array.from(window.generalMode.pendingRequests.entries()).filter(([id]) => id > requestId);
    return newerRequests.length === 0;
}

// Make your mode available
window.yourModeName = {
    init: init,
    switchMode: switchMode,
    generateEqualizerSliders: generateEqualizerSliders,
    processImmediately: processImmediately,
    resetEqualizer: resetEqualizer
};

// Initialize when ready
document.addEventListener('DOMContentLoaded', init);

console.log("✅ Your custom mode loaded - complete freedom!");