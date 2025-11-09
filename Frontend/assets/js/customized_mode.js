// Global variables
let currentMode = '';
let audioContext;
let inputSignal = null;
let outputSignal = null;
let currentInputScale = 'linear';
let currentOutputScale = 'linear';
let playbackSource = null;
let isAudioLoaded = false;
let playbackRate = 1.0;
let isPlaying = false;
let inputSpectrogramVisible = true;
let outputSpectrogramVisible = true;
let gainValues = {};
let currentSettings = null;
let currentAudioBuffer = null;
let processedAudioBuffer = null;

// Backend API base URL
const API_BASE_URL = 'http://localhost:5000/api';

// DOM Elements
const elements = {
    audioFile: document.getElementById('audioFile'),
    uploadArea: document.getElementById('uploadArea'),
    fileInfo: document.getElementById('fileInfo'),
    modeSelect: document.getElementById('modeSelect'),
    modeStatus: document.getElementById('modeStatus'),
    equalizerControls: document.getElementById('equalizerControls'),
    applyButton: document.getElementById('applyButton'),
    processStatus: document.getElementById('processStatus'),
    outputSection: document.getElementById('outputSection'),
    playInputBtn: document.getElementById('playInputBtn'),
    playOutputBtn: document.getElementById('playOutputBtn'),
    pauseBtn: document.getElementById('pauseBtn'),
    stopBtn: document.getElementById('stopBtn'),
    speedControl: document.getElementById('speedControl'),
    speedValue: document.getElementById('speedValue'),
    inputLinearScale: document.getElementById('inputLinearScale'),
    inputAudiogramScale: document.getElementById('inputAudiogramScale'),
    outputLinearScale: document.getElementById('outputLinearScale'),
    outputAudiogramScale: document.getElementById('outputAudiogramScale'),
    inputSpectrogramToggle: document.getElementById('inputSpectrogramToggle'),
    outputSpectrogramToggle: document.getElementById('outputSpectrogramToggle'),
    downloadBtn: document.getElementById('downloadBtn'),
    resetBtn: document.getElementById('resetBtn'),
    resetViewBtn: document.getElementById('resetViewBtn'),
    saveSettingsBtn: document.getElementById('saveSettingsBtn')
};

// Plotly configuration
const plotlyConfig = {
    displayModeBar: true,
    displaylogo: false,
    modeBarButtons: [
        ['zoom2d', 'pan2d'],
        ['zoomIn2d', 'zoomOut2d'],
        ['autoScale2d', 'resetScale2d'],
        ['toImage']
    ],
    modeBarButtonsToRemove: ['lasso2d', 'select2d'],
    scrollZoom: true
};

// Initialize application
function init() {
    console.log("🚀 Initializing Signal Equalizer...");
    
    // Initialize audio context
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        console.log("✅ Audio context initialized");
    } catch (error) {
        console.error("❌ Audio context failed:", error);
        showError("Audio context not supported in this browser");
        return;
    }
    
    // Test backend connection first
    testBackendConnection().then(() => {
        initializePlots();
        setupEventListeners();
        updateUIState();
    });
    
    window.addEventListener('scroll', function() {
        const scrollTop = document.getElementById('scroll-top');
        if (window.scrollY > 100) {
            scrollTop.classList.add('active');
        } else {
            scrollTop.classList.remove('active');
        }
    });
}

// Test backend connection
async function testBackendConnection() {
    try {
        console.log('🔌 Testing backend connection...');
        
        // Test basic endpoint first
        const testResponse = await fetch(`${API_BASE_URL}/test`);
        if (!testResponse.ok) throw new Error(`Backend test failed: ${testResponse.status}`);
        
        const testResult = await testResponse.json();
        console.log('✅ Backend test:', testResult.message);
        
        // Test health endpoint
        const healthResponse = await fetch(`${API_BASE_URL}/health`);
        if (healthResponse.ok) {
            const health = await healthResponse.json();
            console.log('✅ Backend health:', health);
        }
        
        elements.fileInfo.innerHTML = `<span class="status-indicator status-ready">
            <i class="bi bi-check-circle"></i> Backend connected successfully
        </span>`;
        
    } catch (error) {
        console.error('❌ Backend connection failed:', error);
        showError(`Backend connection failed: ${error.message}. Make sure the backend is running on port 5000.`);
        throw error;
    }
}

// Show error message
function showError(message) {
    console.error('❌ Error:', message);
    elements.fileInfo.innerHTML = `<span class="status-indicator error">
        <i class="bi bi-exclamation-triangle"></i> ${message}
    </span>`;
}

// Setup event listeners
function setupEventListeners() {
    console.log("🔧 Setting up event listeners...");
    
    // File upload
    elements.uploadArea.addEventListener('click', () => elements.audioFile.click());
    elements.audioFile.addEventListener('change', (e) => loadAudioFile(e.target.files[0]));
    
    // Mode selection
    elements.modeSelect.addEventListener('change', (e) => switchMode(e.target.value));
    
    // Apply button
    elements.applyButton.addEventListener('click', processSignal);
    
    // Playback controls
    elements.playInputBtn.addEventListener('click', playInput);
    elements.playOutputBtn.addEventListener('click', playOutput);
    elements.pauseBtn.addEventListener('click', pauseSignal);
    elements.stopBtn.addEventListener('click', stopSignal);
    
    // Speed control
    elements.speedControl.addEventListener('input', (e) => setSpeed(e.target.value));
    
    // Scale controls
    elements.inputLinearScale.addEventListener('click', () => setInputScale('linear'));
    elements.inputAudiogramScale.addEventListener('click', () => setInputScale('audiogram'));
    elements.outputLinearScale.addEventListener('click', () => setOutputScale('linear'));
    elements.outputAudiogramScale.addEventListener('click', () => setOutputScale('audiogram'));
    
    // Spectrogram toggles
    elements.inputSpectrogramToggle.addEventListener('click', toggleInputSpectrogram);
    elements.outputSpectrogramToggle.addEventListener('click', toggleOutputSpectrogram);
    
    // Output controls
    elements.downloadBtn.addEventListener('click', downloadOutput);
    elements.resetBtn.addEventListener('click', resetEqualizer);
    elements.resetViewBtn.addEventListener('click', resetView);
    elements.saveSettingsBtn.addEventListener('click', saveSettings);
}

// Initialize empty Plotly charts
function initializePlots() {
    console.log("📊 Initializing plots...");
    
    // Input signal plot
    initializeEmptyPlot('inputSignalPlot', 'Input Signal', '#FF6B35');
    
    // Output signal plot
    initializeEmptyPlot('outputSignalPlot', 'Output Signal', '#E55A2B');

    // Input Fourier transform plot
    Plotly.newPlot('inputFourierPlot', [{
        x: [], y: [], 
        type: 'scatter', 
        mode: 'lines',
        line: { color: '#FF6B35', width: 2 },
        name: 'Input Frequency Spectrum'
    }], {
        margin: { t: 10, r: 30, b: 50, l: 60 },
        xaxis: { 
            title: 'Frequency (Hz)', 
            type: 'linear', 
            gridcolor: '#f8f9fa',
            linecolor: '#E9ECEF'
        },
        yaxis: { 
            title: 'Magnitude', 
            gridcolor: '#f8f9fa',
            linecolor: '#E9ECEF'
        },
        plot_bgcolor: '#FFFFFF',
        paper_bgcolor: '#FFFFFF',
        showlegend: false
    }, plotlyConfig);

    // Output Fourier transform plot
    Plotly.newPlot('outputFourierPlot', [{
        x: [], y: [], 
        type: 'scatter', 
        mode: 'lines',
        line: { color: '#E55A2B', width: 2 },
        name: 'Output Frequency Spectrum'
    }], {
        margin: { t: 10, r: 30, b: 50, l: 60 },
        xaxis: { 
            title: 'Frequency (Hz)', 
            type: 'linear', 
            gridcolor: '#f8f9fa',
            linecolor: '#E9ECEF'
        },
        yaxis: { 
            title: 'Magnitude', 
            gridcolor: '#f8f9fa',
            linecolor: '#E9ECEF'
        },
        plot_bgcolor: '#FFFFFF',
        paper_bgcolor: '#FFFFFF',
        showlegend: false
    }, plotlyConfig);

    // Input spectrogram
    Plotly.newPlot('inputSpectrogramPlot', [{
        z: [[]],
        type: 'heatmap',
        colorscale: 'Viridis',
        showscale: true,
        colorbar: {
            title: 'dB'
        },
        name: 'Input Spectrogram'
    }], {
        margin: { t: 10, r: 30, b: 50, l: 60 },
        xaxis: { 
            title: 'Time (s)',
            linecolor: '#E9ECEF'
        },
        yaxis: { 
            title: 'Frequency (Hz)',
            linecolor: '#E9ECEF'
        },
        plot_bgcolor: '#000000'
    }, plotlyConfig);

    // Output spectrogram
    Plotly.newPlot('outputSpectrogramPlot', [{
        z: [[]],
        type: 'heatmap',
        colorscale: 'Hot',
        showscale: true,
        colorbar: {
            title: 'dB'
        },
        name: 'Output Spectrogram'
    }], {
        margin: { t: 10, r: 30, b: 50, l: 60 },
        xaxis: { 
            title: 'Time (s)',
            linecolor: '#E9ECEF'
        },
        yaxis: { 
            title: 'Frequency (Hz)',
            linecolor: '#E9ECEF'
        },
        plot_bgcolor: '#000000'
    }, plotlyConfig);
    
    console.log("✅ All plots initialized");
}

// Initialize empty plot with professional styling
function initializeEmptyPlot(elementId, title, color = '#FF6B35') {
    Plotly.newPlot(elementId, [{
        x: [], y: [], 
        type: 'scatter', 
        mode: 'lines',
        line: { color: color, width: 1.5 },
        name: title
    }], {
        margin: { t: 10, r: 30, b: 50, l: 60 },
        xaxis: { 
            title: 'Time (s)', 
            gridcolor: '#f8f9fa',
            linecolor: '#E9ECEF',
            showgrid: true
        },
        yaxis: { 
            title: 'Amplitude', 
            gridcolor: '#f8f9fa',
            linecolor: '#E9ECEF',
            showgrid: true
        },
        plot_bgcolor: '#FFFFFF',
        paper_bgcolor: '#FFFFFF',
        showlegend: false,
        font: { family: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif', size: 12, color: '#2D3748' }
    }, plotlyConfig);
}

// Update UI state based on audio loading
function updateUIState() {
    if (isAudioLoaded) {
        elements.modeSelect.disabled = false;
        elements.modeSelect.innerHTML = `
            <option value="">Select a processing mode</option>
            <option value="instruments">Musical Instruments</option>
            <option value="animals">Animal Sounds</option>
            <option value="voices">Human Voices</option>
        `;
        elements.applyButton.disabled = false;
        elements.playInputBtn.disabled = false;
        elements.pauseBtn.disabled = false;
        elements.stopBtn.disabled = false;
        elements.speedControl.disabled = false;
        elements.inputLinearScale.disabled = false;
        elements.inputAudiogramScale.disabled = false;
        
        elements.modeStatus.className = 'status-indicator status-ready';
        elements.modeStatus.innerHTML = '<i class="bi bi-check-circle"></i> Mode selection ready';
        elements.processStatus.className = 'status-indicator status-ready';
        elements.processStatus.innerHTML = '<i class="bi bi-check-circle"></i> Ready for processing';
    } else {
        elements.modeSelect.disabled = true;
        elements.modeSelect.innerHTML = '<option value="">Please upload audio first</option>';
        elements.applyButton.disabled = true;
        elements.playInputBtn.disabled = true;
        elements.playOutputBtn.disabled = true;
        elements.pauseBtn.disabled = true;
        elements.stopBtn.disabled = true;
        elements.speedControl.disabled = true;
        elements.inputLinearScale.disabled = true;
        elements.inputAudiogramScale.disabled = true;
        elements.outputLinearScale.disabled = true;
        elements.outputAudiogramScale.disabled = true;
        
        elements.modeStatus.className = 'status-indicator status-disabled';
        elements.modeStatus.innerHTML = '<i class="bi bi-sliders"></i> Mode selection disabled';
        elements.processStatus.className = 'status-indicator status-disabled';
        elements.processStatus.innerHTML = '<i class="bi bi-hourglass-split"></i> Ready for processing';
    }
}

// Load audio file
async function loadAudioFile(file) {
    if (!file) return;
    
    try {
        console.log(`📥 Loading audio file: ${file.name}`);
        elements.fileInfo.innerHTML = `<span class="status-indicator processing">
            <i class="bi bi-hourglass-split"></i> Loading audio file...
        </span>`;
        
        // Store the file for backend processing
        inputSignal = file;
        
        // Create audio buffer for frontend playback and visualization
        const arrayBuffer = await file.arrayBuffer();
        currentAudioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        isAudioLoaded = true;
        
        // Update UI
        updateUIState();
        
        // Get input visualizations from backend
        await getInputVisualizations(file);
        
        elements.fileInfo.innerHTML = `<span class="status-indicator status-ready">
            <i class="bi bi-check-circle"></i> Loaded: ${file.name} (${(file.size/1024/1024).toFixed(2)} MB)
        </span>`;
        
    } catch (error) {
        console.error('❌ Error loading audio file:', error);
        showError(`Error loading file: ${error.message}`);
    }
}

// Get input visualizations from backend
async function getInputVisualizations(file) {
    try {
        console.log("📊 Getting input visualizations from backend...");
        elements.processStatus.innerHTML = '<i class="bi bi-hourglass-split"></i> Generating input visualizations...';
        
        const formData = new FormData();
        formData.append('file', file);
        formData.append('sliders', JSON.stringify([1, 1, 1, 1])); // Default gains
        formData.append('scale', currentInputScale);
        
        // Use instruments mode as default for input visualization
        const response = await fetch(`${API_BASE_URL}/instruments/process`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Backend error ${response.status}: ${errorText}`);
        }
        
        const result = await response.json();
        console.log("✅ Input visualizations received:", result);
        
        if (!result.success) {
            throw new Error(result.error || 'Input visualization failed');
        }
        
        // Update input visualizations with backend data
        updateInputVisualizations(result);
        
        elements.processStatus.innerHTML = '<i class="bi bi-check-circle"></i> Input visualizations ready';
        
    } catch (error) {
        console.error('❌ Error getting input visualizations:', error);
        showError(`Input visualization failed: ${error.message}`);
    }
}

// Update input visualizations from backend response
function updateInputVisualizations(result) {
    console.log("🔄 Updating input visualizations...");
    
    // Update input signal plot
    if (result.input_signal && result.input_signal.time) {
        Plotly.react('inputSignalPlot', [{
            x: result.input_signal.time,
            y: result.input_signal.amplitude,
            type: 'scatter',
            mode: 'lines',
            line: { color: '#FF6B35', width: 1.5 },
            name: 'Input Signal'
        }], {
            margin: { t: 10, r: 30, b: 50, l: 60 },
            xaxis: { title: 'Time (s)' },
            yaxis: { title: 'Amplitude' }
        });
        console.log("✅ Input signal plot updated");
    }
    
    // Update input Fourier transform
    if (result.input_spectrogram) {
        Plotly.react('inputFourierPlot', [{
            x: result.input_spectrogram.frequencies,
            y: result.input_spectrogram.magnitudes,
            type: 'scatter',
            mode: 'lines',
            line: { color: '#FF6B35', width: 2 },
            name: 'Input Spectrum'
        }], {
            margin: { t: 10, r: 30, b: 50, l: 60 },
            xaxis: { title: 'Frequency (Hz)' },
            yaxis: { title: 'Magnitude' }
        });
        console.log("✅ Input frequency spectrum updated");
    }
    
    // Update input spectrogram if 2D data is available
    if (result.input_spectrogram_2d && result.input_spectrogram_2d.z) {
        Plotly.react('inputSpectrogramPlot', [{
            z: result.input_spectrogram_2d.z,
            x: result.input_spectrogram_2d.x,
            y: result.input_spectrogram_2d.y,
            type: 'heatmap',
            colorscale: 'Viridis',
            showscale: true,
            colorbar: {
                title: 'dB'
            },
            name: 'Input Spectrogram'
        }], {
            margin: { t: 10, r: 30, b: 50, l: 60 },
            xaxis: { title: 'Time (s)' },
            yaxis: { title: 'Frequency (Hz)' }
        });
        console.log("✅ Input spectrogram updated");
    }
}

// Switch processing mode
async function switchMode(mode) {
    if (!mode) {
        // Clear sliders if no mode selected
        elements.equalizerControls.innerHTML = `
            <div class="text-center text-muted py-4">
                <i class="bi bi-sliders" style="font-size: 2rem; opacity: 0.3;"></i>
                <p class="mt-2">Frequency controls will appear here<br>after selecting a mode</p>
            </div>
        `;
        currentMode = '';
        elements.applyButton.disabled = true;
        return;
    }
    
    currentMode = mode;
    
    try {
        console.log(`🔄 Switching to mode: ${mode}`);
        elements.modeStatus.innerHTML = `<i class="bi bi-hourglass-split"></i> Loading ${mode} settings...`;
        
        const response = await fetch(`${API_BASE_URL}/${mode}/settings`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }
        
        currentSettings = await response.json();
        console.log(`✅ ${mode} settings loaded:`, currentSettings);
        
        if (!currentSettings.sliders || currentSettings.sliders.length === 0) {
            throw new Error('No sliders found in backend settings');
        }
        
        generateEqualizerSliders(mode, currentSettings);
        elements.applyButton.disabled = false;
        
        elements.modeStatus.innerHTML = `<i class="bi bi-check-circle"></i> ${mode.charAt(0).toUpperCase() + mode.slice(1)} mode loaded (${currentSettings.sliders.length} sliders)`;
        
    } catch (error) {
        console.error('❌ Error loading mode settings:', error);
        elements.modeStatus.innerHTML = `<i class="bi bi-exclamation-triangle"></i> Backend Error: ${error.message}`;
        elements.applyButton.disabled = true;
    }
}

// Generate equalizer sliders from backend settings
function generateEqualizerSliders(mode, settings) {
    console.log(`🎛️ Generating sliders for ${mode} mode`);
    const sliders = settings.sliders;
    
    // Reset gain values for this mode
    gainValues = new Array(sliders.length).fill(1.0);
    
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
                <input type="range" class="custom-slider" min="0" max="2" value="1" step="0.1" 
                        data-index="${index}">
                <div class="frequency-bands">
                    <small>Frequency bands: ${slider.frequency_bands.map(band => `${band[0]}-${band[1]}Hz`).join(', ')}</small>
                </div>
            </div>
        `).join('')}
    `;
    
    // Add event listeners to sliders
    document.querySelectorAll('.custom-slider').forEach(slider => {
        slider.addEventListener('input', (e) => {
            const index = parseInt(e.target.dataset.index);
            updateSliderValue(index, e.target.value);
        });
    });
    
    console.log(`✅ ${sliders.length} sliders generated`);
}

// Update slider value display
function updateSliderValue(index, value) {
    gainValues[index] = parseFloat(value);
    document.getElementById(`value${index}`).textContent = `${value}x`;
    console.log(`🎚️ Slider ${index} updated to ${value}`);
}

// Process the signal with backend
async function processSignal() {
    if (!inputSignal || !currentMode || !currentSettings) return;
    
    try {
        console.log(`🔧 Processing signal with ${currentMode} mode...`);
        elements.processStatus.innerHTML = '<i class="bi bi-hourglass-split"></i> Processing with backend...';
        elements.applyButton.disabled = true;
        
        const formData = new FormData();
        formData.append('file', inputSignal);
        formData.append('sliders', JSON.stringify(gainValues));
        formData.append('scale', currentOutputScale);
        
        console.log('📤 Sending to backend:', {
            mode: currentMode,
            sliders: gainValues,
            scale: currentOutputScale
        });
        
        const response = await fetch(`${API_BASE_URL}/${currentMode}/process`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Backend error ${response.status}: ${errorText}`);
        }
        
        const result = await response.json();
        console.log('📥 Backend response:', result);
        
        if (!result.success) {
            throw new Error(result.error || 'Backend processing failed');
        }
        
        // Store processed audio buffer for playback
        if (result.processed_audio_base64) {
            console.log("🔊 Decoding processed audio...");
            const audioData = Uint8Array.from(atob(result.processed_audio_base64), c => c.charCodeAt(0));
            processedAudioBuffer = await audioContext.decodeAudioData(audioData.buffer);
            console.log("✅ Processed audio decoded");
        }
        
        // Update visualizations with backend data
        updateOutputVisualizations(result);
        
        // Show output section
        elements.outputSection.classList.remove('hidden');
        
        elements.processStatus.innerHTML = '<i class="bi bi-check-circle"></i> Backend processing complete';
        console.log("✅ Signal processing completed successfully");
        
    } catch (error) {
        console.error('❌ Error processing signal:', error);
        elements.processStatus.innerHTML = `<i class="bi bi-exclamation-triangle"></i> Backend Error: ${error.message}`;
    } finally {
        elements.applyButton.disabled = false;
    }
}

// Update output visualizations from backend response
function updateOutputVisualizations(result) {
    console.log("🔄 Updating output visualizations...");
    
    // Update output signal plot
    if (result.output_signal && result.output_signal.time) {
        Plotly.react('outputSignalPlot', [{
            x: result.output_signal.time,
            y: result.output_signal.amplitude,
            type: 'scatter',
            mode: 'lines',
            line: { color: '#E55A2B', width: 1.5 },
            name: 'Output Signal'
        }], {
            margin: { t: 10, r: 30, b: 50, l: 60 },
            xaxis: { title: 'Time (s)' },
            yaxis: { title: 'Amplitude' }
        });
        console.log("✅ Output signal plot updated");
    }
    
    // Update output Fourier transform
    if (result.output_spectrogram) {
        Plotly.react('outputFourierPlot', [{
            x: result.output_spectrogram.frequencies,
            y: result.output_spectrogram.magnitudes,
            type: 'scatter',
            mode: 'lines',
            line: { color: '#E55A2B', width: 2 },
            name: 'Output Spectrum'
        }], {
            margin: { t: 10, r: 30, b: 50, l: 60 },
            xaxis: { title: 'Frequency (Hz)' },
            yaxis: { title: 'Magnitude' }
        });
        console.log("✅ Output frequency spectrum updated");
    }
    
    // Update output spectrogram if 2D data is available
    if (result.output_spectrogram_2d && result.output_spectrogram_2d.z) {
        Plotly.react('outputSpectrogramPlot', [{
            z: result.output_spectrogram_2d.z,
            x: result.output_spectrogram_2d.x,
            y: result.output_spectrogram_2d.y,
            type: 'heatmap',
            colorscale: 'Hot',
            showscale: true,
            colorbar: {
                title: 'dB'
            },
            name: 'Output Spectrogram'
        }], {
            margin: { t: 10, r: 30, b: 50, l: 60 },
            xaxis: { title: 'Time (s)' },
            yaxis: { title: 'Frequency (Hz)' }
        });
        console.log("✅ Output spectrogram updated");
    }
    
    // Enable output controls
    elements.playOutputBtn.disabled = false;
    elements.downloadBtn.disabled = false;
    elements.resetViewBtn.disabled = false;
    elements.outputLinearScale.disabled = false;
    elements.outputAudiogramScale.disabled = false;
    
    console.log("✅ All output visualizations updated");
}

// Play input audio
function playInput() {
    if (!currentAudioBuffer || isPlaying) return;
    
    try {
        console.log("▶️ Playing input audio...");
        if (playbackSource) {
            playbackSource.stop();
        }
        
        playbackSource = audioContext.createBufferSource();
        playbackSource.buffer = currentAudioBuffer;
        playbackSource.playbackRate.value = playbackRate;
        playbackSource.connect(audioContext.destination);
        playbackSource.start();
        
        isPlaying = true;
        
        playbackSource.onended = function() {
            console.log("⏹️ Input audio playback ended");
            isPlaying = false;
            playbackSource = null;
        };
        
    } catch (error) {
        console.error('❌ Error playing audio:', error);
        alert('Error playing audio: ' + error.message);
    }
}

// Play output audio
function playOutput() {
    if (!processedAudioBuffer || isPlaying) return;
    
    try {
        console.log("▶️ Playing output audio...");
        if (playbackSource) {
            playbackSource.stop();
        }
        
        playbackSource = audioContext.createBufferSource();
        playbackSource.buffer = processedAudioBuffer;
        playbackSource.playbackRate.value = playbackRate;
        playbackSource.connect(audioContext.destination);
        playbackSource.start();
        
        isPlaying = true;
        
        playbackSource.onended = function() {
            console.log("⏹️ Output audio playback ended");
            isPlaying = false;
            playbackSource = null;
        };
        
    } catch (error) {
        console.error('❌ Error playing output audio:', error);
        alert('Error playing output audio: ' + error.message);
    }
}

// Pause signal playback
function pauseSignal() {
    if (playbackSource && isPlaying) {
        console.log("⏸️ Pausing audio playback");
        playbackSource.stop();
        isPlaying = false;
        playbackSource = null;
    }
}

// Stop signal playback
function stopSignal() {
    if (playbackSource) {
        console.log("⏹️ Stopping audio playback");
        playbackSource.stop();
        isPlaying = false;
        playbackSource = null;
    }
}

// Set playback speed
function setSpeed(speed) {
    playbackRate = parseFloat(speed);
    elements.speedValue.textContent = `${speed}x`;
    console.log(`🎚️ Playback speed set to ${speed}x`);
    
    if (playbackSource && isPlaying) {
        playbackSource.playbackRate.value = playbackRate;
    }
}

// Set input frequency scale
function setInputScale(scale) {
    console.log(`🎚️ Setting input scale to: ${scale}`);
    currentInputScale = scale;
    elements.inputLinearScale.classList.toggle('active', scale === 'linear');
    elements.inputAudiogramScale.classList.toggle('active', scale === 'audiogram');
    
    // Refresh input visualizations with new scale
    if (isAudioLoaded) {
        getInputVisualizations(inputSignal);
    }
}

// Set output frequency scale
function setOutputScale(scale) {
    console.log(`🎚️ Setting output scale to: ${scale}`);
    currentOutputScale = scale;
    elements.outputLinearScale.classList.toggle('active', scale === 'linear');
    elements.outputAudiogramScale.classList.toggle('active', scale === 'audiogram');
    
    // Reprocess with new scale if we have output
    if (elements.outputSection && !elements.outputSection.classList.contains('hidden')) {
        processSignal();
    }
}

// Toggle input spectrogram visibility
function toggleInputSpectrogram() {
    const container = document.getElementById('inputSpectrogramContainer');
    
    inputSpectrogramVisible = !inputSpectrogramVisible;
    
    if (inputSpectrogramVisible) {
        container.classList.remove('hidden');
        elements.inputSpectrogramToggle.innerHTML = '<i class="bi bi-eye-fill"></i> Hide Spectrogram';
        elements.inputSpectrogramToggle.classList.add('active');
        console.log("👁️ Input spectrogram shown");
    } else {
        container.classList.add('hidden');
        elements.inputSpectrogramToggle.innerHTML = '<i class="bi bi-eye-fill"></i> Show Spectrogram';
        elements.inputSpectrogramToggle.classList.remove('active');
        console.log("👁️ Input spectrogram hidden");
    }
}

// Toggle output spectrogram visibility
function toggleOutputSpectrogram() {
    const container = document.getElementById('outputSpectrogramContainer');
    
    outputSpectrogramVisible = !outputSpectrogramVisible;
    
    if (outputSpectrogramVisible) {
        container.classList.remove('hidden');
        elements.outputSpectrogramToggle.innerHTML = '<i class="bi bi-eye-fill"></i> Hide Spectrogram';
        elements.outputSpectrogramToggle.classList.add('active');
        console.log("👁️ Output spectrogram shown");
    } else {
        container.classList.add('hidden');
        elements.outputSpectrogramToggle.innerHTML = '<i class="bi bi-eye-fill"></i> Show Spectrogram';
        elements.outputSpectrogramToggle.classList.remove('active');
        console.log("👁️ Output spectrogram hidden");
    }
}

// Download output audio
function downloadOutput() {
    if (!processedAudioBuffer) {
        alert('No processed audio available for download');
        return;
    }
    
    try {
        console.log("💾 Downloading processed audio...");
        // Create a WAV file from the processed audio buffer
        const audioData = new Float32Array(processedAudioBuffer.length);
        audioData.set(processedAudioBuffer.getChannelData(0));
        
        const wavBuffer = audioBufferToWav(audioData, processedAudioBuffer.sampleRate);
        const blob = new Blob([wavBuffer], { type: 'audio/wav' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `processed_audio_${currentMode}_${Date.now()}.wav`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.log("✅ Audio download initiated");
        
    } catch (error) {
        console.error('❌ Error downloading audio:', error);
        alert('Error downloading audio: ' + error.message);
    }
}

// Convert audio buffer to WAV format
function audioBufferToWav(buffer, sampleRate) {
    const length = buffer.length;
    const wav = new DataView(new ArrayBuffer(44 + length * 2));
    const writeString = (offset, string) => {
        for (let i = 0; i < string.length; i++) {
            wav.setUint8(offset + i, string.charCodeAt(i));
        }
    };
    
    writeString(0, 'RIFF');
    wav.setUint32(4, 36 + length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    wav.setUint32(16, 16, true);
    wav.setUint16(20, 1, true);
    wav.setUint16(22, 1, true);
    wav.setUint32(24, sampleRate, true);
    wav.setUint32(28, sampleRate * 2, true);
    wav.setUint16(32, 2, true);
    wav.setUint16(34, 16, true);
    writeString(36, 'data');
    wav.setUint32(40, length * 2, true);
    
    for (let i = 0; i < length; i++) {
        const sample = Math.max(-1, Math.min(1, buffer[i]));
        wav.setInt16(44 + i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
    }
    
    return wav;
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
    
    // Reprocess the signal
    if (isAudioLoaded && currentMode) {
        processSignal();
    }
}

// Reset view
function resetView() {
    console.log("🔄 Resetting all views...");
    // Reset plots to their default view
    Plotly.relayout('inputSignalPlot', {});
    Plotly.relayout('outputSignalPlot', {});
    Plotly.relayout('inputFourierPlot', {});
    Plotly.relayout('outputFourierPlot', {});
    Plotly.relayout('inputSpectrogramPlot', {});
    Plotly.relayout('outputSpectrogramPlot', {});
}

// Save settings
function saveSettings() {
    const settings = {
        mode: currentMode,
        gains: gainValues,
        timestamp: new Date().toISOString()
    };
    
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(settings, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `equalizer_settings_${currentMode}_${Date.now()}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    
    console.log("💾 Settings saved");
    alert('Settings saved!');
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', init);