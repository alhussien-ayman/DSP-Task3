// customized_mode.js - Customized Mode specific functionality

// Import general mode functionality
if (typeof window.generalMode === 'undefined') {
    console.error("❌ General mode not loaded. Make sure general_mode.js is included first.");
}

// Mode-specific global variables
let currentMode = '';
let currentSettings = null;
let lastProcessedGains = null;

// Initialize application
function init() {
    console.log("🚀 Initializing Customized Mode...");
    
    // Initialize shared general functionality FIRST (same flow as original)
    window.generalMode.initGeneral();
    
    // THEN setup event listeners (same flow as original)
    setupEventListeners();
}

// Setup event listeners
function setupEventListeners() {
    console.log("🔧 Setting up event listeners...");
    
    const elements = window.generalMode.elements;
    
    // File upload (EXACTLY THE SAME AS ORIGINAL)
    elements.uploadArea.addEventListener('click', () => elements.audioFile.click());
    elements.audioFile.addEventListener('change', (e) => window.generalMode.loadAudioFile(e.target.files[0]));
    
    // Mode selection
    elements.modeSelect.addEventListener('change', (e) => switchMode(e.target.value));
    
    // Playback controls
    elements.playInputBtn.addEventListener('click', () => window.generalMode.playAudio('input'));
    elements.playOutputBtn.addEventListener('click', () => window.generalMode.playAudio('output'));
    elements.pauseBtn.addEventListener('click', window.generalMode.pauseSignal);
    elements.pauseOutputBtn.addEventListener('click', window.generalMode.pauseSignal);
    
    // Speed control - SYNC BOTH CONTROLS
    elements.speedControl.addEventListener('input', (e) => window.generalMode.setSpeed(e.target.value));
    elements.speedControlOutput.addEventListener('input', (e) => window.generalMode.setSpeed(e.target.value));
    
    // Scale controls
    elements.inputLinearScale.addEventListener('click', () => window.generalMode.setInputScale('linear'));
    elements.inputAudiogramScale.addEventListener('click', () => window.generalMode.setInputScale('audiogram'));
    elements.outputLinearScale.addEventListener('click', () => window.generalMode.setOutputScale('linear'));
    elements.outputAudiogramScale.addEventListener('click', () => window.generalMode.setOutputScale('audiogram'));
    
    // Spectrogram toggles
    elements.inputSpectrogramToggle.addEventListener('click', window.generalMode.toggleInputSpectrogram);
    elements.outputSpectrogramToggle.addEventListener('click', window.generalMode.toggleOutputSpectrogram);
    
    // Output controls
    elements.downloadBtn.addEventListener('click', window.generalMode.downloadOutput);
    elements.resetBtn.addEventListener('click', resetEqualizer);
    elements.saveSettingsBtn.addEventListener('click', window.generalMode.saveSettings);
}

// Switch processing mode
async function switchMode(mode) {
    if (!mode) {
        // Clear sliders if no mode selected
        const elements = window.generalMode.elements;
        if (elements.equalizerControls) {
            elements.equalizerControls.innerHTML = `
                <div class="text-center text-muted py-4">
                    <i class="bi bi-sliders" style="font-size: 2rem; opacity: 0.3;"></i>
                    <p class="mt-2">Frequency controls will appear here<br>after selecting a mode</p>
                </div>
            `;
        }
        currentMode = '';
        window.currentMode = '';
        return;
    }
    
    currentMode = mode;
    window.currentMode = mode; // Make available to general mode
    
    try {
        console.log(`🔄 Switching to mode: ${mode}`);
        const elements = window.generalMode.elements;
        if (elements.modeStatus) {
            elements.modeStatus.innerHTML = `<i class="bi bi-hourglass-split"></i> Loading ${mode} settings...`;
        }
        
        const response = await fetch(`${window.generalMode.API_BASE_URL}/${mode}/settings`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }
        
        currentSettings = await response.json();
        console.log(`✅ ${mode} settings loaded:`, currentSettings);
        
        if (!currentSettings.sliders || currentSettings.sliders.length === 0) {
            throw new Error('No sliders found in backend settings');
        }
        
        generateEqualizerSliders(mode, currentSettings);
        
        if (elements.modeStatus) {
            elements.modeStatus.innerHTML = `<i class="bi bi-check-circle"></i> ${mode.charAt(0).toUpperCase() + mode.slice(1)} mode loaded (${currentSettings.sliders.length} sliders)`;
        }
        
        // Auto-process with default slider values when mode changes
        if (window.generalMode.isAudioLoaded) {
            await processImmediately();
        }
        
    } catch (error) {
        console.error('❌ Error loading mode settings:', error);
        const elements = window.generalMode.elements;
        if (elements.modeStatus) {
            elements.modeStatus.innerHTML = `<i class="bi bi-exclamation-triangle"></i> Backend Error: ${error.message}`;
        }
    }
}

// Generate equalizer sliders with DELAYED real-time processing
function generateEqualizerSliders(mode, settings) {
    console.log(`🎛️ Generating sliders for ${mode} mode with DELAYED real-time processing`);
    const sliders = settings.sliders;
    
    // Reset gain values for this mode
    window.generalMode.gainValues = new Array(sliders.length).fill(1.0);
    lastProcessedGains = [...window.generalMode.gainValues];
    
    const elements = window.generalMode.elements;
    if (elements.equalizerControls) {
        elements.equalizerControls.innerHTML = `
            <div class="mb-3 p-3 bg-orange-light rounded">
                <small><strong>${mode.charAt(0).toUpperCase() + mode.slice(1)} Mode:</strong> ${sliders.length} frequency bands from backend</small>
            </div>
            ${sliders.map((slider, index) => `
                <div class="slider-card">
                    <div class="slider-header">
                        <span class="slider-name">${slider.name}</span>
                        <span class="slider-value" id="value${index}">1.0x</span>
                    </div>
                    ${slider.description ? `<div class="slider-description"><small>${slider.description}</small></div>` : ''}
                    <input type="range" class="custom-slider" min="0" max="2" value="1" step="0.01" 
                            data-index="${index}" id="slider-${index}">
                    <div class="frequency-bands">
                        <small>Frequency bands: ${slider.frequency_bands.map(band => `${band[0]}-${band[1]}Hz`).join(', ')}</small>
                    </div>
                </div>
            `).join('')}
        `;
        
        // Add event listeners to sliders with delayed processing
        document.querySelectorAll('.custom-slider').forEach(slider => {
            // Input event for immediate value update but delayed processing
            slider.addEventListener('input', (e) => {
                const index = parseInt(e.target.dataset.index);
                const value = parseFloat(e.target.value);
                updateSliderValue(index, value);
                
                // Show real-time feedback with delay indication
                window.generalMode.showRealTimeFeedback();
                
                // Schedule delayed processing
                window.generalMode.scheduleImmediateProcessing();
            });
        });
        
        console.log(`✅ ${sliders.length} sliders generated with ${window.generalMode.PROCESSING_DEBOUNCE_MS}ms delayed processing`);
    }
}

// Process with backend after delay - FIXED VERSION (No Race Conditions)
async function processImmediately() {
    if (!window.generalMode.inputSignal || !currentMode || !currentSettings) return;
    
    // Check if we're already processing the same gains
    if (lastProcessedGains && window.generalMode.arraysEqual(window.generalMode.gainValues, lastProcessedGains)) {
        console.log("⏭️ Skipping duplicate processing request");
        return;
    }
    
    // Create a request ID to track this specific request
    const requestId = Date.now();
    window.generalMode.currentRequestId = requestId;
    
    // Store the current gains that we're sending
    const currentGainsToProcess = [...window.generalMode.gainValues];
    
    // Store this request in our pending queue
    window.generalMode.pendingRequests.set(requestId, {
        gains: currentGainsToProcess,
        timestamp: Date.now()
    });
    
    console.log(`⚡ [Request ${requestId}] Processing signal with ${currentMode} mode...`, currentGainsToProcess);
    console.log(`📊 Active requests: ${window.generalMode.pendingRequests.size}`);
    
    const elements = window.generalMode.elements;
    if (elements.processStatus) {
        elements.processStatus.innerHTML = '<i class="bi bi-hourglass-split"></i> Processing changes with backend...';
    }
    
    try {
        const formData = new FormData();
        formData.append('file', window.generalMode.inputSignal);
        formData.append('sliders', JSON.stringify(currentGainsToProcess));
        formData.append('scale', window.generalMode.currentOutputScale);
        
        console.log(`📤 [Request ${requestId}] Sending to backend:`, {
            mode: currentMode,
            sliders: currentGainsToProcess,
            scale: window.generalMode.currentOutputScale
        });
        
        const response = await fetch(`${window.generalMode.API_BASE_URL}/${currentMode}/process`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Backend error ${response.status}: ${errorText}`);
        }
        
        const result = await response.json();
        
        // ⚠️ CRITICAL FIX: Check if this request is still relevant
        if (!isRequestStillRelevant(requestId, currentGainsToProcess)) {
            console.log(`🔄 [Request ${requestId}] Response outdated - ignoring. Current request: ${window.generalMode.currentRequestId}`);
            window.generalMode.pendingRequests.delete(requestId);
            return;
        }
        
        console.log(`📥 [Request ${requestId}] Backend response received and accepted`);
        
        if (!result.success) {
            throw new Error(result.error || 'Backend processing failed');
        }
        
        // Mark this as the last successful request
        window.generalMode.lastSuccessfulRequestId = requestId;
        
        // Store processed audio buffer for playback
        if (result.processed_audio_base64) {
            console.log(`🔊 [Request ${requestId}] Decoding processed audio...`);
            const audioData = Uint8Array.from(atob(result.processed_audio_base64), c => c.charCodeAt(0));
            window.generalMode.processedAudioBuffer = await window.generalMode.audioContext.decodeAudioData(audioData.buffer);
            console.log(`✅ [Request ${requestId}] Processed audio decoded`);
        }
        
        // Update output visualizations with backend data
        window.generalMode.updateOutputVisualizations(result);
        
        // Store last processed gains
        lastProcessedGains = [...currentGainsToProcess];
        
        // Clear all pending requests since we got a successful response
        window.generalMode.pendingRequests.clear();
        
        if (elements.processStatus) {
            elements.processStatus.innerHTML = '<i class="bi bi-check-circle"></i> Processing complete';
        }
        console.log(`✅ [Request ${requestId}] Signal processing completed successfully`);
        
    } catch (error) {
        // Only show error if this request is still relevant
        if (isRequestStillRelevant(requestId, currentGainsToProcess)) {
            console.error(`❌ [Request ${requestId}] Error processing signal:`, error);
            if (elements.processStatus) {
                elements.processStatus.innerHTML = `<i class="bi bi-exclamation-triangle"></i> Backend Error: ${error.message}`;
            }
        } else {
            console.log(`🔇 [Request ${requestId}] Error ignored - request no longer relevant`);
        }
        
        // Clean up this request regardless
        window.generalMode.pendingRequests.delete(requestId);
    }
}

// Helper function to check if a request is still relevant
function isRequestStillRelevant(requestId, originalGains) {
    // If this is the most recent request, it's always relevant
    if (requestId === window.generalMode.currentRequestId) {
        return true;
    }
    
    // If gains have changed since this request was made, it's outdated
    if (!window.generalMode.arraysEqual(originalGains, window.generalMode.gainValues)) {
        return false;
    }
    
    // If there are newer pending requests, this one is outdated
    const newerRequests = Array.from(window.generalMode.pendingRequests.entries())
        .filter(([id, data]) => id > requestId);
    
    return newerRequests.length === 0;
}

// Update slider value display
function updateSliderValue(index, value) {
    if (window.generalMode.gainValues) {
        window.generalMode.gainValues[index] = parseFloat(value);
    }
    const valueElement = document.getElementById(`value${index}`);
    if (valueElement) {
        valueElement.textContent = `${value.toFixed(2)}x`;
    }
    console.log(`🎚️ Slider ${index} updated to ${value}`);
}

// Reset equalizer
function resetEqualizer() {
    console.log("🔄 Resetting equalizer sliders...");
    // Reset all sliders to 1.0
    const sliders = document.querySelectorAll('.custom-slider');
    sliders.forEach((slider, index) => {
        slider.value = 1.0;
        updateSliderValue(index, 1.0);
    });
    
    // Auto-process with reset values
    if (window.generalMode.isAudioLoaded && currentMode) {
        processImmediately();
    }
}

// Make functions available globally
window.processImmediately = processImmediately;
window.switchMode = switchMode;
window.resetEqualizer = resetEqualizer;
window.updateSliderValue = updateSliderValue;
window.currentMode = '';

// Initialize when page loads
document.addEventListener('DOMContentLoaded', init);