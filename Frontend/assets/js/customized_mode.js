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
let currentPlaybackTime = 0;
let currentPlaybackBuffer = null;
let isProcessing = false;

// Request tracking variables
let currentRequestId = 0;
let pendingRequests = new Map();
let lastSuccessfulRequestId = 0;
let lastProcessedGains = null;

// Playback synchronization variables
let playbackStartTime = 0;
let playbackOffset = 0;

// Real-time processing variables
let processingDebounce = null;
const PROCESSING_DEBOUNCE_MS = 700; // 700ms delay before backend processing

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
    processStatus: document.getElementById('processStatus'),
    outputSection: document.getElementById('outputSection'),
    playInputBtn: document.getElementById('playInputBtn'),
    playOutputBtn: document.getElementById('playOutputBtn'),
    pauseBtn: document.getElementById('pauseBtn'),
    pauseOutputBtn: document.getElementById('pauseOutputBtn'),
    speedControl: document.getElementById('speedControl'),
    speedValue: document.getElementById('speedValue'),
    speedControlOutput: document.getElementById('speedControlOutput'),
    speedValueOutput: document.getElementById('speedValueOutput'),
    inputLinearScale: document.getElementById('inputLinearScale'),
    inputAudiogramScale: document.getElementById('inputAudiogramScale'),
    outputLinearScale: document.getElementById('outputLinearScale'),
    outputAudiogramScale: document.getElementById('outputAudiogramScale'),
    inputSpectrogramToggle: document.getElementById('inputSpectrogramToggle'),
    outputSpectrogramToggle: document.getElementById('outputSpectrogramToggle'),
    downloadBtn: document.getElementById('downloadBtn'),
    resetBtn: document.getElementById('resetBtn'),
    saveSettingsBtn: document.getElementById('saveSettingsBtn')
};

// Plotly configuration with synchronized zoom
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

// Global ranges for synchronization
let globalTimeRange = [0, 1];
let globalFreqRange = [0, 1];

// Initialize application
function init() {
    console.log("🚀 Initializing Signal Equalizer...");
    
    // Show output section from the start
    elements.outputSection.classList.remove('hidden');
    
    // Initialize audio context
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        console.log("✅ Audio context initialized");
    } catch (error) {
        console.error("❌ Audio context failed:", error);
        showError("Audio context not supported in this browser");
        return;
    }
    
    // Setup reset buttons FIRST to ensure they're available
    setupResetButtons();
    
    // Then setup other event listeners
    setupEventListeners();

    // Initialize plots
    initializePlots();

    // Test backend connection
    testBackendConnection().then(() => {
        updateUIState();
    }).catch(error => {
        console.error("Backend connection failed, continuing with limited functionality");
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
        
        const testResponse = await fetch(`${API_BASE_URL}/test`);
        if (!testResponse.ok) throw new Error(`Backend test failed: ${testResponse.status}`);
        
        const testResult = await testResponse.json();
        console.log('✅ Backend test:', testResult.message);
        
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
    
    // Playback controls
    elements.playInputBtn.addEventListener('click', () => playAudio('input'));
    elements.playOutputBtn.addEventListener('click', () => playAudio('output'));
    elements.pauseBtn.addEventListener('click', pauseSignal);
    elements.pauseOutputBtn.addEventListener('click', pauseSignal);
    
    // Speed control - SYNC BOTH CONTROLS
    elements.speedControl.addEventListener('input', (e) => setSpeed(e.target.value));
    elements.speedControlOutput.addEventListener('input', (e) => setSpeed(e.target.value));
    
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
    elements.saveSettingsBtn.addEventListener('click', saveSettings);
}

// Setup reset buttons with direct event listeners
function setupResetButtons() {
    console.log("🔧 Setting up reset buttons...");
    
    // Reset Input Signal
    const resetInputSignalBtn = document.getElementById('resetInputSignalBtn');
    if (resetInputSignalBtn) {
        resetInputSignalBtn.addEventListener('click', resetInputSignal);
        console.log("✅ Reset Input Signal button attached");
    } else {
        console.error("❌ Reset Input Signal button not found");
    }
    
    // Reset Input Fourier
    const resetInputFourierBtn = document.getElementById('resetInputFourierBtn');
    if (resetInputFourierBtn) {
        resetInputFourierBtn.addEventListener('click', resetInputFourier);
        console.log("✅ Reset Input Fourier button attached");
    } else {
        console.error("❌ Reset Input Fourier button not found");
    }
    
    // Reset Input Spectrogram
    const resetInputSpectrogramBtn = document.getElementById('resetInputSpectrogramBtn');
    if (resetInputSpectrogramBtn) {
        resetInputSpectrogramBtn.addEventListener('click', resetInputSpectrogram);
        console.log("✅ Reset Input Spectrogram button attached");
    } else {
        console.error("❌ Reset Input Spectrogram button not found");
    }
    
    // Reset Output Signal
    const resetOutputSignalBtn = document.getElementById('resetOutputSignalBtn');
    if (resetOutputSignalBtn) {
        resetOutputSignalBtn.addEventListener('click', resetOutputSignal);
        console.log("✅ Reset Output Signal button attached");
    } else {
        console.error("❌ Reset Output Signal button not found");
    }
    
    // Reset Output Fourier
    const resetOutputFourierBtn = document.getElementById('resetOutputFourierBtn');
    if (resetOutputFourierBtn) {
        resetOutputFourierBtn.addEventListener('click', resetOutputFourier);
        console.log("✅ Reset Output Fourier button attached");
    } else {
        console.error("❌ Reset Output Fourier button not found");
    }
    
    // Reset Output Spectrogram
    const resetOutputSpectrogramBtn = document.getElementById('resetOutputSpectrogramBtn');
    if (resetOutputSpectrogramBtn) {
        resetOutputSpectrogramBtn.addEventListener('click', resetOutputSpectrogram);
        console.log("✅ Reset Output Spectrogram button attached");
    } else {
        console.error("❌ Reset Output Spectrogram button not found");
    }
}

// Initialize empty Plotly charts with synchronized zoom
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
            linecolor: '#E9ECEF',
            range: globalFreqRange
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
            linecolor: '#E9ECEF',
            range: globalFreqRange
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
            linecolor: '#E9ECEF',
            range: globalTimeRange
        },
        yaxis: { 
            title: 'Frequency (Hz)',
            linecolor: '#E9ECEF',
            range: globalFreqRange
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
            linecolor: '#E9ECEF',
            range: globalTimeRange
        },
        yaxis: { 
            title: 'Frequency (Hz)',
            linecolor: '#E9ECEF',
            range: globalFreqRange
        },
        plot_bgcolor: '#000000'
    }, plotlyConfig);
    
    console.log("✅ All plots initialized");
    
    // Setup synchronized zoom after plots are created
    setupSynchronizedZoom();
}

// More robust synchronization setup with retry mechanism
function setupSynchronizedZoom() {
    console.log("🔄 Setting up synchronized zoom...");
    
    let retryCount = 0;
    const maxRetries = 5;
    
    const trySetupSync = () => {
        const plotPairs = [
            ['inputSignalPlot', 'outputSignalPlot'],
            ['inputFourierPlot', 'outputFourierPlot'],
            ['inputSpectrogramPlot', 'outputSpectrogramPlot']
        ];
        
        let allPlotsFound = true;
        
        plotPairs.forEach(([plot1Id, plot2Id]) => {
            const plot1 = document.getElementById(plot1Id);
            const plot2 = document.getElementById(plot2Id);
            
            if (plot1 && plot2) {
                syncPlots(plot1Id, plot2Id);
                console.log(`✅ Synced ${plot1Id} with ${plot2Id}`);
            } else {
                console.warn(`⚠️ Plots not ready: ${plot1Id}, ${plot2Id}`);
                allPlotsFound = false;
            }
        });
        
        if (!allPlotsFound && retryCount < maxRetries) {
            retryCount++;
            console.log(`🔄 Retrying synchronization setup (attempt ${retryCount})...`);
            setTimeout(trySetupSync, 500);
        } else if (allPlotsFound) {
            console.log("✅ All plots synchronized successfully");
        } else {
            console.error("❌ Failed to synchronize all plots after retries");
        }
    };
    
    trySetupSync();
}

// Robust helper function to synchronize two plots
function syncPlots(plot1Id, plot2Id) {
    const plot1 = document.getElementById(plot1Id);
    const plot2 = document.getElementById(plot2Id);
    
    if (!plot1 || !plot2) {
        console.error(`❌ Could not find plots: ${plot1Id} and/or ${plot2Id}`);
        return;
    }
    
    console.log(`🔗 Syncing ${plot1Id} with ${plot2Id}`);
    
    let isSyncing = false;
    
    // Function to handle synchronization
    const syncHandler = (sourcePlot, targetPlot, eventData) => {
        if (isSyncing) return;
        isSyncing = true;
        
        const update = {};
        
        // Handle all possible range and autorange changes
        const rangeProperties = [
            'xaxis.range', 'yaxis.range',
            'xaxis.autorange', 'yaxis.autorange',
            'xaxis.range[0]', 'xaxis.range[1]',
            'yaxis.range[0]', 'yaxis.range[1]'
        ];
        
        rangeProperties.forEach(prop => {
            if (eventData[prop] !== undefined) {
                update[prop] = eventData[prop];
            }
        });
        
        // Also handle domain changes for subplots
        if (eventData['xaxis.domain'] !== undefined) {
            update['xaxis.domain'] = eventData['xaxis.domain'];
        }
        if (eventData['yaxis.domain'] !== undefined) {
            update['yaxis.domain'] = eventData['yaxis.domain'];
        }
        
        // Apply the update if there are any changes
        if (Object.keys(update).length > 0) {
            Plotly.relayout(targetPlot, update)
                .then(() => {
                    isSyncing = false;
                })
                .catch(error => {
                    console.error('Error during sync:', error);
                    isSyncing = false;
                });
        } else {
            isSyncing = false;
        }
    };
    
    // Set up event listeners for both directions
    plot1.on('plotly_relayout', function(eventData) {
        syncHandler(plot1, plot2, eventData);
    });
    
    plot2.on('plotly_relayout', function(eventData) {
        syncHandler(plot2, plot1, eventData);
    });
    
    // Also sync double-click events for reset
    plot1.on('plotly_doubleclick', function() {
        if (isSyncing) return;
        isSyncing = true;
        Plotly.relayout(plot2, {
            'xaxis.autorange': true,
            'yaxis.autorange': true
        }).then(() => {
            isSyncing = false;
        });
    });
    
    plot2.on('plotly_doubleclick', function() {
        if (isSyncing) return;
        isSyncing = true;
        Plotly.relayout(plot1, {
            'xaxis.autorange': true,
            'yaxis.autorange': true
        }).then(() => {
            isSyncing = false;
        });
    });
}

// Re-synchronize plots after updates
function resyncPlotsAfterUpdate() {
    console.log("🔄 Re-establishing plot synchronization...");
    setupSynchronizedZoom();
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
            showgrid: true,
            range: globalTimeRange
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
    // Always show output section (moved this logic out)
    elements.outputSection.classList.remove('hidden');
    
    if (isAudioLoaded) {
        elements.modeSelect.disabled = false;
        elements.modeSelect.innerHTML = `
            <option value="">Select a processing mode</option>
            <option value="instruments">Musical Instruments</option>
            <option value="animals">Animal Sounds</option>
            <option value="voices">Human Voices</option>
        `;
        
        elements.playInputBtn.disabled = false;
        elements.playOutputBtn.disabled = false;
        elements.pauseBtn.disabled = false;
        elements.pauseOutputBtn.disabled = false;
        elements.speedControl.disabled = false;
        elements.speedControlOutput.disabled = false;
        elements.inputLinearScale.disabled = false;
        elements.inputAudiogramScale.disabled = false;
        elements.outputLinearScale.disabled = false;
        elements.outputAudiogramScale.disabled = false;
        
        elements.modeStatus.className = 'status-indicator status-ready';
        elements.modeStatus.innerHTML = '<i class="bi bi-check-circle"></i> Mode selection ready';
        elements.processStatus.className = 'status-indicator status-ready';
        elements.processStatus.innerHTML = '<i class="bi bi-check-circle"></i> Ready for processing';
    } else {
        elements.modeSelect.disabled = true;
        elements.modeSelect.innerHTML = '<option value="">Please upload audio first</option>';
        elements.playInputBtn.disabled = true;
        elements.playOutputBtn.disabled = true;
        elements.pauseBtn.disabled = true;
        elements.pauseOutputBtn.disabled = true;
        elements.speedControl.disabled = true;
        elements.speedControlOutput.disabled = true;
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
        processedAudioBuffer = currentAudioBuffer; // Initialize output with input
        
        isAudioLoaded = true;
        
        // Update UI and show both sections
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
        
        // Update both input and output visualizations with the same data initially
        updateInputVisualizations(result);
        updateOutputVisualizations(result);
        
        elements.processStatus.innerHTML = '<i class="bi bi-check-circle"></i> Input visualizations ready';
        
    } catch (error) {
        console.error('❌ Error getting input visualizations:', error);
        showError(`Input visualization failed: ${error.message}`);
    }
}

// Update input visualizations from backend response - FIXED VERSION
function updateInputVisualizations(result) {
    console.log("🔄 Updating input visualizations...");
    
    // Calculate consistent ranges
    let timeRange = [0, 1];
    let freqRange = [0, 1];
    
    // Update input signal plot
    if (result.input_signal && result.input_signal.time) {
        const times = result.input_signal.time;
        timeRange = [0, Math.max(...times)];
        globalTimeRange = timeRange;
        
        Plotly.react('inputSignalPlot', [{
            x: times,
            y: result.input_signal.amplitude,
            type: 'scatter',
            mode: 'lines',
            line: { color: '#FF6B35', width: 1.5 },
            name: 'Input Signal'
        }], {
            margin: { t: 10, r: 30, b: 50, l: 60 },
            xaxis: { 
                title: 'Time (s)',
                range: timeRange,
                fixedrange: false
            },
            yaxis: { 
                title: 'Amplitude',
                fixedrange: false
            }
        });
        console.log("✅ Input signal plot updated");
    }
   
    // Update input Fourier transform
    if (result.input_spectrogram) {
        const freqs = result.input_spectrogram.frequencies;
        freqRange = [0, Math.max(...freqs)];
        globalFreqRange = freqRange;
        
        Plotly.react('inputFourierPlot', [{
            x: freqs,
            y: result.input_spectrogram.magnitudes,
            type: 'scatter',
            mode: 'lines',
            line: { color: '#FF6B35', width: 2 },
            name: currentInputScale === 'audiogram' ? 'Input Audiogram' : 'Input Spectrum'
        }], {
            margin: { t: 10, r: 30, b: 50, l: 60 },
            xaxis: { 
                title: 'Frequency (Hz)',
                range: freqRange,
                fixedrange: false
            },
            yaxis: { 
                title: currentInputScale === 'audiogram' ? 'Relative Level (dB)' : 'Magnitude',
                gridcolor: '#f8f9fa',
                linecolor: '#E9ECEF',
                fixedrange: false
            },
            plot_bgcolor: '#FFFFFF',
            paper_bgcolor: '#FFFFFF',
            showlegend: false
        });
    }
    
    // Update input spectrogram if 2D data is available
    if (result.input_spectrogram_2d && result.input_spectrogram_2d.z) {
        const specTimes = result.input_spectrogram_2d.x;
        const specFreqs = result.input_spectrogram_2d.y;
        
        Plotly.react('inputSpectrogramPlot', [{
            z: result.input_spectrogram_2d.z,
            x: specTimes,
            y: specFreqs,
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
                range: timeRange,
                fixedrange: false
            },
            yaxis: { 
                title: 'Frequency (Hz)',
                range: freqRange,
                fixedrange: false
            }
        });
        console.log("✅ Input spectrogram updated");
    }
}

// Update output visualizations from backend response - FIXED VERSION
function updateOutputVisualizations(result) {
    console.log("🔄 Updating output visualizations...");
    
    // Use the same ranges as input for consistency
    const timeRange = globalTimeRange;
    const freqRange = globalFreqRange;
    
    // Update output signal plot - USE SAME TIME RANGE AS INPUT
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
            xaxis: { 
                title: 'Time (s)',
                range: timeRange, // Use same range as input
                fixedrange: false
            },
            yaxis: { 
                title: 'Amplitude',
                fixedrange: false
            }
        });
        console.log("✅ Output signal plot updated");
    }
   
    // Update output Fourier transform - USE SAME FREQUENCY RANGE AS INPUT
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
            xaxis: { 
                title: 'Frequency (Hz)',
                range: freqRange, // Use same range as input
                fixedrange: false
            },
            yaxis: { 
                title: 'Magnitude',
                gridcolor: '#f8f9fa',
                linecolor: '#E9ECEF',
                fixedrange: false
            },
            plot_bgcolor: '#FFFFFF',
            paper_bgcolor: '#FFFFFF',
            showlegend: false
        });
    }
    
    // Update output spectrogram if 2D data is available
    if (result.output_spectrogram_2d && result.output_spectrogram_2d.z) {
        const specTimes = result.output_spectrogram_2d.x;
        const specFreqs = result.output_spectrogram_2d.y;
        
        Plotly.react('outputSpectrogramPlot', [{
            z: result.output_spectrogram_2d.z,
            x: specTimes,
            y: specFreqs,
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
                range: timeRange, // Use same range as input
                fixedrange: false
            },
            yaxis: { 
                title: 'Frequency (Hz)',
                range: freqRange, // Use same range as input
                fixedrange: false
            }
        });
        console.log("✅ Output spectrogram updated");
    }
    
    // Re-establish synchronization after updates
    setTimeout(() => {
        resyncPlotsAfterUpdate();
        forceSynchronizeRanges();
    }, 100);
    
    // Enable output controls
    elements.playOutputBtn.disabled = false;
    elements.downloadBtn.disabled = false;
    elements.outputLinearScale.disabled = false;
    elements.outputAudiogramScale.disabled = false;
    elements.speedControlOutput.disabled = false;
    
    console.log("✅ All output visualizations updated with synchronized ranges");
}

// Force synchronization of ranges between input and output plots
function forceSynchronizeRanges() {
    console.log("🔄 Forcing range synchronization...");
    
    const plotPairs = [
        { input: 'inputSignalPlot', output: 'outputSignalPlot', type: 'time' },
        { input: 'inputFourierPlot', output: 'outputFourierPlot', type: 'frequency' },
        { input: 'inputSpectrogramPlot', output: 'outputSpectrogramPlot', type: 'both' }
    ];
    
    plotPairs.forEach(pair => {
        const inputPlot = document.getElementById(pair.input);
        const outputPlot = document.getElementById(pair.output);
        
        if (inputPlot && outputPlot) {
            // Apply global ranges to both plots
            const update = {};
            
            if (pair.type === 'time' || pair.type === 'both') {
                update['xaxis.range'] = globalTimeRange;
            }
            
            if (pair.type === 'frequency' || pair.type === 'both') {
                if (pair.input === 'inputFourierPlot') {
                    update['xaxis.range'] = globalFreqRange;
                } else {
                    update['yaxis.range'] = globalFreqRange;
                }
            }
            
            if (Object.keys(update).length > 0) {
                // Apply to both input and output for consistency
                Plotly.relayout(inputPlot, update).catch(console.error);
                Plotly.relayout(outputPlot, update).catch(console.error);
            }
        }
    });
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
        
        elements.modeStatus.innerHTML = `<i class="bi bi-check-circle"></i> ${mode.charAt(0).toUpperCase() + mode.slice(1)} mode loaded (${currentSettings.sliders.length} sliders)`;
        
        // Auto-process with default slider values when mode changes
        if (isAudioLoaded) {
            await processImmediately();
        }
        
    } catch (error) {
        console.error('❌ Error loading mode settings:', error);
        elements.modeStatus.innerHTML = `<i class="bi bi-exclamation-triangle"></i> Backend Error: ${error.message}`;
    }
}

// Generate equalizer sliders with DELAYED real-time processing
function generateEqualizerSliders(mode, settings) {
    console.log(`🎛️ Generating sliders for ${mode} mode with DELAYED real-time processing`);
    const sliders = settings.sliders;
    
    // Reset gain values for this mode
    gainValues = new Array(sliders.length).fill(1.0);
    lastProcessedGains = [...gainValues];
    
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
            showRealTimeFeedback();
            
            // Schedule delayed processing
            scheduleImmediateProcessing();
        });
    });
    
    console.log(`✅ ${sliders.length} sliders generated with ${PROCESSING_DEBOUNCE_MS}ms delayed processing`);
}

// Schedule delayed processing with visual feedback
function scheduleImmediateProcessing() {
    // Clear any existing debounce
    if (processingDebounce) {
        clearTimeout(processingDebounce);
    }
    
    // Clean up very old pending requests (older than 30 seconds)
    const now = Date.now();
    for (let [requestId, data] of pendingRequests.entries()) {
        if (now - data.timestamp > 30000) { // 30 seconds
            console.log(`🧹 Cleaning up old request ${requestId}`);
            pendingRequests.delete(requestId);
        }
    }
    
    // Show "waiting" state with delay information
    elements.processStatus.innerHTML = `<i class="bi bi-clock text-info"></i> Adjusting... (Will process in ${PROCESSING_DEBOUNCE_MS}ms)`;
    
    // Schedule the processing function to run after debounce
    processingDebounce = setTimeout(() => {
        if (isAudioLoaded && currentMode) {
            processImmediately();
        }
    }, PROCESSING_DEBOUNCE_MS);
}

// Process with backend after delay - FIXED VERSION (No Race Conditions)
async function processImmediately() {
    if (!inputSignal || !currentMode || !currentSettings) return;
    
    // Check if we're already processing the same gains
    if (lastProcessedGains && arraysEqual(gainValues, lastProcessedGains)) {
        console.log("⏭️ Skipping duplicate processing request");
        return;
    }
    
    // Create a request ID to track this specific request
    const requestId = Date.now();
    currentRequestId = requestId;
    
    // Store the current gains that we're sending
    const currentGainsToProcess = [...gainValues];
    
    // Store this request in our pending queue
    pendingRequests.set(requestId, {
        gains: currentGainsToProcess,
        timestamp: Date.now()
    });
    
    console.log(`⚡ [Request ${requestId}] Processing signal with ${currentMode} mode...`, currentGainsToProcess);
    console.log(`📊 Active requests: ${pendingRequests.size}`);
    
    elements.processStatus.innerHTML = '<i class="bi bi-hourglass-split"></i> Processing changes with backend...';
    
    try {
        const formData = new FormData();
        formData.append('file', inputSignal);
        formData.append('sliders', JSON.stringify(currentGainsToProcess));
        formData.append('scale', currentOutputScale);
        
        console.log(`📤 [Request ${requestId}] Sending to backend:`, {
            mode: currentMode,
            sliders: currentGainsToProcess,
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
        
        // ⚠️ CRITICAL FIX: Check if this request is still relevant
        if (!isRequestStillRelevant(requestId, currentGainsToProcess)) {
            console.log(`🔄 [Request ${requestId}] Response outdated - ignoring. Current request: ${currentRequestId}`);
            pendingRequests.delete(requestId);
            return;
        }
        
        console.log(`📥 [Request ${requestId}] Backend response received and accepted`);
        
        if (!result.success) {
            throw new Error(result.error || 'Backend processing failed');
        }
        
        // Mark this as the last successful request
        lastSuccessfulRequestId = requestId;
        
        // Store processed audio buffer for playback
        if (result.processed_audio_base64) {
            console.log(`🔊 [Request ${requestId}] Decoding processed audio...`);
            const audioData = Uint8Array.from(atob(result.processed_audio_base64), c => c.charCodeAt(0));
            processedAudioBuffer = await audioContext.decodeAudioData(audioData.buffer);
            console.log(`✅ [Request ${requestId}] Processed audio decoded`);
        }
        
        // Update output visualizations with backend data
        updateOutputVisualizations(result);
        
        // Store last processed gains
        lastProcessedGains = [...currentGainsToProcess];
        
        // Clear all pending requests since we got a successful response
        pendingRequests.clear();
        
        elements.processStatus.innerHTML = '<i class="bi bi-check-circle"></i> Processing complete';
        console.log(`✅ [Request ${requestId}] Signal processing completed successfully`);
        
    } catch (error) {
        // Only show error if this request is still relevant
        if (isRequestStillRelevant(requestId, currentGainsToProcess)) {
            console.error(`❌ [Request ${requestId}] Error processing signal:`, error);
            elements.processStatus.innerHTML = `<i class="bi bi-exclamation-triangle"></i> Backend Error: ${error.message}`;
        } else {
            console.log(`🔇 [Request ${requestId}] Error ignored - request no longer relevant`);
        }
        
        // Clean up this request regardless
        pendingRequests.delete(requestId);
    }
}

// Helper function to check if a request is still relevant
function isRequestStillRelevant(requestId, originalGains) {
    // If this is the most recent request, it's always relevant
    if (requestId === currentRequestId) {
        return true;
    }
    
    // If gains have changed since this request was made, it's outdated
    if (!arraysEqual(originalGains, gainValues)) {
        return false;
    }
    
    // If there are newer pending requests, this one is outdated
    const newerRequests = Array.from(pendingRequests.entries())
        .filter(([id, data]) => id > requestId);
    
    return newerRequests.length === 0;
}

// Show real-time feedback during processing delay
function showRealTimeFeedback() {
    elements.processStatus.innerHTML = `<i class="bi bi-clock text-info"></i> Changes detected - will process in ${PROCESSING_DEBOUNCE_MS}ms...`;
}

// Helper function to compare arrays
function arraysEqual(arr1, arr2) {
    if (arr1.length !== arr2.length) return false;
    for (let i = 0; i < arr1.length; i++) {
        if (arr1[i] !== arr2[i]) return false;
    }
    return true;
}

// Update slider value display
function updateSliderValue(index, value) {
    gainValues[index] = parseFloat(value);
    document.getElementById(`value${index}`).textContent = `${value.toFixed(2)}x`;
    console.log(`🎚️ Slider ${index} updated to ${value}`);
}

// Play audio with synchronized playback - FIXED VERSION
function playAudio(type) {
    // If already playing the same buffer, pause it
    if (isPlaying && currentPlaybackBuffer === type) {
        pauseSignal();
        return;
    }
    
    // If playing different buffer, pause current first
    if (isPlaying && currentPlaybackBuffer !== type) {
        pauseSignal();
    }
    
    let bufferToPlay;
    if (type === 'input') {
        bufferToPlay = currentAudioBuffer;
        currentPlaybackBuffer = 'input';
    } else {
        bufferToPlay = processedAudioBuffer;
        currentPlaybackBuffer = 'output';
    }
    
    if (!bufferToPlay) return;
    
    try {
        console.log(`▶️ Playing ${type} audio from ${currentPlaybackTime.toFixed(2)}s...`);
        
        // Stop any existing playback
        if (playbackSource) {
            playbackSource.stop();
        }
        
        playbackSource = audioContext.createBufferSource();
        playbackSource.buffer = bufferToPlay;
        playbackSource.playbackRate.value = playbackRate;
        playbackSource.connect(audioContext.destination);
        
        // Calculate start offset based on current playback time
        const startOffset = Math.min(currentPlaybackTime, bufferToPlay.duration - 0.1);
        
        // Store playback start time for accurate position tracking
        playbackStartTime = audioContext.currentTime;
        playbackOffset = startOffset;
        
        // Start from current playback time
        playbackSource.start(0, startOffset);
        
        isPlaying = true;
        updatePlaybackButtons();
        
        // Update playback position in real-time
        const updateTime = () => {
            if (isPlaying && playbackSource) {
                currentPlaybackTime = playbackOffset + (audioContext.currentTime - playbackStartTime) * playbackRate;
                
                // Check if playback reached the end
                if (currentPlaybackTime >= bufferToPlay.duration) {
                    currentPlaybackTime = 0;
                    playbackOffset = 0;
                    isPlaying = false;
                    playbackSource = null;
                    updatePlaybackButtons();
                    console.log("⏹️ Audio playback completed");
                } else {
                    requestAnimationFrame(updateTime);
                }
            }
        };
        updateTime();
        
        playbackSource.onended = function() {
            console.log("⏹️ Audio playback ended");
            isPlaying = false;
            playbackSource = null;
            currentPlaybackTime = 0;
            playbackOffset = 0;
            updatePlaybackButtons();
        };
        
    } catch (error) {
        console.error('❌ Error playing audio:', error);
        alert('Error playing audio: ' + error.message);
    }
}

// Update playback buttons state - FIXED VERSION
function updatePlaybackButtons() {
    const isInputActive = isPlaying && currentPlaybackBuffer === 'input';
    const isOutputActive = isPlaying && currentPlaybackBuffer === 'output';
    
    // Update input button
    if (isInputActive) {
        elements.playInputBtn.innerHTML = '<i class="bi bi-pause-fill"></i> Pause';
        elements.playInputBtn.classList.add('active');
    } else {
        elements.playInputBtn.innerHTML = '<i class="bi bi-play-fill"></i> Play Input';
        elements.playInputBtn.classList.remove('active');
    }
    
    // Update output button
    if (isOutputActive) {
        elements.playOutputBtn.innerHTML = '<i class="bi bi-pause-fill"></i> Pause';
        elements.playOutputBtn.classList.add('active');
    } else {
        elements.playOutputBtn.innerHTML = '<i class="bi bi-play-fill"></i> Play Output';
        elements.playOutputBtn.classList.remove('active');
    }
    
    // Update pause buttons
    elements.pauseBtn.disabled = !isPlaying;
    elements.pauseOutputBtn.disabled = !isPlaying;
    
    // Update button states based on availability
    elements.playInputBtn.disabled = !currentAudioBuffer;
    elements.playOutputBtn.disabled = !processedAudioBuffer;
}

// Pause signal playback - FIXED VERSION
function pauseSignal() {
    if (playbackSource && isPlaying) {
        console.log(`⏸️ Pausing ${currentPlaybackBuffer} audio at ${currentPlaybackTime.toFixed(2)}s`);
        
        // Stop the current source
        playbackSource.stop();
        
        // Keep the currentPlaybackTime for resuming
        isPlaying = false;
        playbackSource = null;
        updatePlaybackButtons();
        
        console.log(`💾 Playback position saved: ${currentPlaybackTime.toFixed(2)}s`);
    }
}

// Stop signal playback - FIXED VERSION  
function stopSignal() {
    if (playbackSource) {
        console.log("⏹️ Stopping audio playback and resetting position");
        playbackSource.stop();
        isPlaying = false;
        playbackSource = null;
        currentPlaybackTime = 0;
        playbackOffset = 0;
        currentPlaybackBuffer = null;
        updatePlaybackButtons();
    }
}

// Set playback speed - FIXED VERSION WITH SYNCHRONIZED CONTROLS
function setSpeed(speed) {
    const newPlaybackRate = parseFloat(speed);
    
    // Update both speed controls to stay in sync
    elements.speedControl.value = speed;
    elements.speedControlOutput.value = speed;
    elements.speedValue.textContent = `${speed}x`;
    elements.speedValueOutput.textContent = `${speed}x`;
    
    // Only update if speed actually changed
    if (newPlaybackRate !== playbackRate) {
        playbackRate = newPlaybackRate;
        
        console.log(`🎚️ Playback speed set to ${speed}x`);
        
        // If currently playing, restart with new speed from current position
        if (playbackSource && isPlaying && currentPlaybackBuffer) {
            const wasPlaying = true;
            const currentBuffer = currentPlaybackBuffer;
            const oldTime = currentPlaybackTime;
            
            console.log(`🔄 Restarting playback with new speed from ${oldTime.toFixed(2)}s`);
            pauseSignal();
            currentPlaybackTime = oldTime; // Maintain position
            playAudio(currentBuffer); // Restart with new speed
        }
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
    
    // Auto-process with new scale
    if (isAudioLoaded && currentMode) {
        processImmediately();
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
    
    // Auto-process with reset values
    if (isAudioLoaded && currentMode) {
        processImmediately();
    }
}

// Reset individual graph functions
function resetInputSignal() {
    console.log("🔄 Clearing input signal plot...");
    try {
        Plotly.react('inputSignalPlot', [{
            x: [], y: [], 
            type: 'scatter', 
            mode: 'lines',
            line: { color: '#FF6B35', width: 1.5 },
            name: 'Input Signal'
        }], {
            margin: { t: 10, r: 30, b: 50, l: 60 },
            xaxis: { title: 'Time (s)', range: globalTimeRange },
            yaxis: { title: 'Amplitude' }
        });
        console.log("✅ Input signal plot cleared");
    } catch (error) {
        console.error("❌ Error clearing input signal:", error);
    }
}

function resetInputFourier() {
    console.log("🔄 Clearing input frequency spectrum...");
    try {
        Plotly.react('inputFourierPlot', [{
            x: [], y: [], 
            type: 'scatter', 
            mode: 'lines',
            line: { color: '#FF6B35', width: 2 },
            name: 'Input Frequency Spectrum'
        }], {
            margin: { t: 10, r: 30, b: 50, l: 60 },
            xaxis: { title: 'Frequency (Hz)', range: globalFreqRange },
            yaxis: { title: 'Magnitude' }
        });
        console.log("✅ Input frequency spectrum cleared");
    } catch (error) {
        console.error("❌ Error clearing input Fourier:", error);
    }
}

function resetInputSpectrogram() {
    console.log("🔄 Clearing input spectrogram...");
    try {
        Plotly.react('inputSpectrogramPlot', [{
            z: [[]],
            type: 'heatmap',
            colorscale: 'Viridis',
            showscale: true,
            colorbar: { title: 'dB' },
            name: 'Input Spectrogram'
        }], {
            margin: { t: 10, r: 30, b: 50, l: 60 },
            xaxis: { title: 'Time (s)', range: globalTimeRange },
            yaxis: { title: 'Frequency (Hz)', range: globalFreqRange }
        });
        console.log("✅ Input spectrogram cleared");
    } catch (error) {
        console.error("❌ Error clearing input spectrogram:", error);
    }
}

function resetOutputSignal() {
    console.log("🔄 Clearing output signal plot...");
    try {
        Plotly.react('outputSignalPlot', [{
            x: [], y: [], 
            type: 'scatter', 
            mode: 'lines',
            line: { color: '#E55A2B', width: 1.5 },
            name: 'Output Signal'
        }], {
            margin: { t: 10, r: 30, b: 50, l: 60 },
            xaxis: { title: 'Time (s)', range: globalTimeRange },
            yaxis: { title: 'Amplitude' }
        });
        console.log("✅ Output signal plot cleared");
    } catch (error) {
        console.error("❌ Error clearing output signal:", error);
    }
}

function resetOutputFourier() {
    console.log("🔄 Clearing output frequency spectrum...");
    try {
        Plotly.react('outputFourierPlot', [{
            x: [], y: [], 
            type: 'scatter', 
            mode: 'lines',
            line: { color: '#E55A2B', width: 2 },
            name: 'Output Frequency Spectrum'
        }], {
            margin: { t: 10, r: 30, b: 50, l: 60 },
            xaxis: { title: 'Frequency (Hz)', range: globalFreqRange },
            yaxis: { title: 'Magnitude' }
        });
        console.log("✅ Output frequency spectrum cleared");
    } catch (error) {
        console.error("❌ Error clearing output Fourier:", error);
    }
}

function resetOutputSpectrogram() {
    console.log("🔄 Clearing output spectrogram...");
    try {
        Plotly.react('outputSpectrogramPlot', [{
            z: [[]],
            type: 'heatmap',
            colorscale: 'Hot',
            showscale: true,
            colorbar: { title: 'dB' },
            name: 'Output Spectrogram'
        }], {
            margin: { t: 10, r: 30, b: 50, l: 60 },
            xaxis: { title: 'Time (s)', range: globalTimeRange },
            yaxis: { title: 'Frequency (Hz)', range: globalFreqRange }
        });
        console.log("✅ Output spectrogram cleared");
    } catch (error) {
        console.error("❌ Error clearing output spectrogram:", error);
    }
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