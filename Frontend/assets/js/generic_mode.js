class GenericEqualizer {
    constructor() {
        this.baseURL = 'http://127.0.0.1:5000/api/generic';
        
        // Data storage
        this.bands = [];
        this.currentScale = 'linear';
        this.currentAudioFile = null;
        this.spectrumData = null;
        this.audioData = null;
        this.sampleRate = null;
        this.processedAudioUrl = null;
        this.processedAudioData = null;
        
        // Plotly instances and data
        this.inputWaveformPlot = null;
        this.outputWaveformPlot = null;
        this.frequencyChart = null;
        this.inputSpectrogram = null;
        this.outputSpectrogram = null;
        
        // Audio data arrays
        this.inputTimeData = [];
        this.inputAmplitudeData = [];
        this.outputTimeData = [];
        this.outputAmplitudeData = [];
        
        // Playback state
        this.isPlaying = false;
        this.playbackInterval = null;
        this.currentTime = 0;
        this.totalDuration = 0;
        this.inputPlaybackSpeed = 1.0;
        this.outputPlaybackSpeed = 1.0;
        
        // Audio context for actual playback
        this.audioContext = null;
        this.inputAudioBuffer = null;
        this.outputAudioBuffer = null;
        this.inputSource = null;
        this.outputSource = null;
        this.inputGainNode = null;
        this.outputGainNode = null;
        this.playbackStartTime = 0;
        
        // View synchronization
        this.inputXRange = [0, 1];
        this.outputXRange = [0, 1];
        this.inputYRange = [-1, 1];
        this.outputYRange = [-1, 1];
        
        // Current preset
        this.currentPreset = null;
        
        console.log('🎵 GenericEqualizer initialized');
    }

    initializeApp() {
        this.initializeEventListeners();
        this.initializePlots();
        this.addDefaultBands();
        this.loadPresetsList();
        this.testBackendConnection();
        this.initializeAudioContext();
    }

    initializeAudioContext() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.inputGainNode = this.audioContext.createGain();
            this.outputGainNode = this.audioContext.createGain();
            this.inputGainNode.connect(this.audioContext.destination);
            this.outputGainNode.connect(this.audioContext.destination);
            console.log('✅ Web Audio API initialized');
        } catch (error) {
            console.error('❌ Web Audio API not supported:', error);
        }
    }
// Add this method to the GenericEqualizer class
setupSpectrogramTimeLimits() {
    console.log('⏰ Setting up spectrogram time limits...');
    
    // This will be used to limit spectrogram display to 10 seconds
    this.spectrogramMaxDuration = 10; // 10 seconds maximum
    
    // Update the backend to process only first 10 seconds
    this.spectrogramSettings = {
        max_duration: this.spectrogramMaxDuration
    };
}
    async testBackendConnection() {
        try {
            console.log('🔌 Testing backend connection...');
            const response = await fetch(`${this.baseURL}/health`);
            
            if (response.ok) {
                const data = await response.json();
                console.log('✅ Backend connected successfully:', data);
                this.updateDebugPanel('✅ Backend connected', 'success');
                this.showNotification('Backend connected successfully!', 'success');
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
        } catch (error) {
            console.error('❌ Backend connection failed:', error);
            this.updateDebugPanel('❌ Backend not found', 'error');
            this.showNotification(
                `Cannot connect to backend at ${this.baseURL}. Please make sure the Flask server is running.`, 
                'error'
            );
        }
    }

    updateDebugPanel(message, type) {
        const backendStatus = document.getElementById('backendStatus');
        const connectionDetails = document.getElementById('connectionDetails');
        
        if (backendStatus) {
            backendStatus.textContent = message;
            backendStatus.style.color = type === 'success' ? 'green' : 'red';
        }
        
        if (connectionDetails) {
            connectionDetails.innerHTML = `
                <strong>Backend URL:</strong> ${this.baseURL}<br>
                <strong>Status:</strong> ${type === 'success' ? 'Connected' : 'Disconnected'}
            `;
        }
    }

    initializeEventListeners() {
        console.log('🔧 Initializing event listeners...');
        
        // File upload
        document.getElementById('audioUpload').addEventListener('change', (e) => {
            this.handleFileUpload(e.target.files[0]);
        });

        // Test signal
        document.getElementById('generateTest').addEventListener('click', () => {
            this.generateTestSignal();
        });

        // Scale selector
        document.getElementById('scaleSelect').addEventListener('change', (e) => {
            this.currentScale = e.target.value;
            this.updateFrequencyChart();
        });

        // Preset selector
        document.getElementById('presetList').addEventListener('change', (e) => {
            if (e.target.value) {
                this.loadPreset(e.target.value);
            }
        });

        // Preset management
        document.getElementById('savePreset').addEventListener('click', () => {
            this.savePreset();
        });

        document.getElementById('updatePreset').addEventListener('click', () => {
            this.updatePreset();
        });

        document.getElementById('deletePreset').addEventListener('click', () => {
            this.deletePreset();
        });

        // Add band button
        document.getElementById('addBand').addEventListener('click', () => {
            this.addBand();
        });

        // Process audio
        document.getElementById('processAudio').addEventListener('click', () => {
            this.processAudio();
        });

        // Export audio
        document.getElementById('exportAudio').addEventListener('click', () => {
            this.exportAudio();
        });

        // Global playback controls
        document.getElementById('playAll').addEventListener('click', () => {
            this.playAll();
        });

        document.getElementById('pauseAll').addEventListener('click', () => {
            this.pauseAll();
        });

        document.getElementById('stopAll').addEventListener('click', () => {
            this.stopAll();
        });

        document.getElementById('resetViewAll').addEventListener('click', () => {
            this.resetViewAll();
        });

        // Individual viewer controls
        document.getElementById('playInput').addEventListener('click', () => {
            this.playInput();
        });

        document.getElementById('pauseInput').addEventListener('click', () => {
            this.pauseInput();
        });

        document.getElementById('stopInput').addEventListener('click', () => {
            this.stopInput();
        });

        document.getElementById('playOutput').addEventListener('click', () => {
            this.playOutput();
        });

        document.getElementById('pauseOutput').addEventListener('click', () => {
            this.pauseOutput();
        });

        document.getElementById('stopOutput').addEventListener('click', () => {
            this.stopOutput();
        });

        // Speed controls
        document.getElementById('inputSpeed').addEventListener('change', (e) => {
            this.inputPlaybackSpeed = parseFloat(e.target.value);
            if (this.inputSource) {
                this.inputSource.playbackRate.value = this.inputPlaybackSpeed;
            }
        });

        document.getElementById('outputSpeed').addEventListener('change', (e) => {
            this.outputPlaybackSpeed = parseFloat(e.target.value);
            if (this.outputSource) {
                this.outputSource.playbackRate.value = this.outputPlaybackSpeed;
            }
        });

        // Timeline slider
        document.getElementById('timelineSlider').addEventListener('input', (e) => {
            this.seekToTime(parseFloat(e.target.value) / 1000);
        });

        // Spectrogram toggle
        document.getElementById('showSpectrograms').addEventListener('change', (e) => {
            const container = document.getElementById('spectrogramsContainer');
            container.style.display = e.target.checked ? 'block' : 'none';
            if (e.target.checked && this.currentAudioFile) {
                this.updateSpectrograms();
            }
        });

        // Graph reset
        document.getElementById('resetGraph').addEventListener('click', () => {
            this.resetGraph();
        });

        // Export buttons
        document.getElementById('exportSpectrum').addEventListener('click', () => {
            this.exportSpectrum();
        });

        document.getElementById('exportSpectrograms').addEventListener('click', () => {
            this.exportSpectrograms();
        });

        console.log('✅ Event listeners initialized');
    }

    initializePlots() {
        this.initializeWaveformPlots();
        this.initializeFrequencyChart();
        this.initializeSpectrograms();
    }

    initializeWaveformPlots() {
        console.log('📈 Initializing waveform plots...');
        
        // Input waveform plot
        this.inputWaveformPlot = document.getElementById('inputWaveformPlot');
        Plotly.newPlot(this.inputWaveformPlot, [{
            x: [0],
            y: [0],
            type: 'scatter',
            mode: 'lines',
            line: { color: '#e03a3c', width: 1.5 },
            name: 'Input Signal'
        }], {
            title: { text: '', font: { size: 14, color: '#6c757d' } },
            margin: { t: 10, r: 30, b: 40, l: 50 },
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            font: { color: '#6c757d' },
            xaxis: {
                title: { text: 'Time (s)', font: { color: '#6c757d' } },
                gridcolor: 'rgba(128,128,128,0.2)',
                linecolor: 'rgba(128,128,128,0.5)',
                range: [0, 1],
                showgrid: true,
                zeroline: false
            },
            yaxis: {
                title: { text: 'Amplitude', font: { color: '#6c757d' } },
                gridcolor: 'rgba(128,128,128,0.2)',
                linecolor: 'rgba(128,128,128,0.5)',
                range: [-1, 1],
                showgrid: true,
                zeroline: true,
                zerolinecolor: 'rgba(128,128,128,0.3)'
            },
            showlegend: false
        }, {
            displayModeBar: true,
            displaylogo: false,
            modeBarButtonsToRemove: ['lasso2d', 'select2d'],
            scrollZoom: true
        });

        // Output waveform plot
        this.outputWaveformPlot = document.getElementById('outputWaveformPlot');
        Plotly.newPlot(this.outputWaveformPlot, [{
            x: [0],
            y: [0],
            type: 'scatter',
            mode: 'lines',
            line: { color: '#28a745', width: 1.5 },
            name: 'Output Signal'
        }], {
            title: { text: '', font: { size: 14, color: '#6c757d' } },
            margin: { t: 10, r: 30, b: 40, l: 50 },
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            font: { color: '#6c757d' },
            xaxis: {
                title: { text: 'Time (s)', font: { color: '#6c757d' } },
                gridcolor: 'rgba(128,128,128,0.2)',
                linecolor: 'rgba(128,128,128,0.5)',
                range: [0, 1],
                showgrid: true,
                zeroline: false
            },
            yaxis: {
                title: { text: 'Amplitude', font: { color: '#6c757d' } },
                gridcolor: 'rgba(128,128,128,0.2)',
                linecolor: 'rgba(128,128,128,0.5)',
                range: [-1, 1],
                showgrid: true,
                zeroline: true,
                zerolinecolor: 'rgba(128,128,128,0.3)'
            },
            showlegend: false
        }, {
            displayModeBar: true,
            displaylogo: false,
            modeBarButtonsToRemove: ['lasso2d', 'select2d'],
            scrollZoom: true
        });

        // Sync the plots
        this.syncWaveformPlots();
        
        console.log('✅ Waveform plots initialized');
    }

    syncWaveformPlots() {
        console.log('🔗 Syncing waveform plots...');
        
        // Sync input plot events to output plot
        this.inputWaveformPlot.on('plotly_relayout', (eventData) => {
            if (eventData['xaxis.range[0]'] !== undefined && eventData['xaxis.range[1]'] !== undefined) {
                this.inputXRange = [eventData['xaxis.range[0]'], eventData['xaxis.range[1]']];
                this.updateOutputPlotRange();
            }
            if (eventData['yaxis.range[0]'] !== undefined && eventData['yaxis.range[1]'] !== undefined) {
                this.inputYRange = [eventData['yaxis.range[0]'], eventData['yaxis.range[1]']];
                this.updateOutputPlotRange();
            }
        });

        // Sync output plot events to input plot
        this.outputWaveformPlot.on('plotly_relayout', (eventData) => {
            if (eventData['xaxis.range[0]'] !== undefined && eventData['xaxis.range[1]'] !== undefined) {
                this.outputXRange = [eventData['xaxis.range[0]'], eventData['xaxis.range[1]']];
                this.updateInputPlotRange();
            }
            if (eventData['yaxis.range[0]'] !== undefined && eventData['yaxis.range[1]'] !== undefined) {
                this.outputYRange = [eventData['yaxis.range[0]'], eventData['yaxis.range[1]']];
                this.updateInputPlotRange();
            }
        });
        
        console.log('✅ Waveform plots synchronized');
    }

    updateInputPlotRange() {
        Plotly.relayout(this.inputWaveformPlot, {
            'xaxis.range': this.outputXRange,
            'yaxis.range': this.outputYRange
        });
        this.inputXRange = this.outputXRange;
        this.inputYRange = this.outputYRange;
    }

    updateOutputPlotRange() {
        Plotly.relayout(this.outputWaveformPlot, {
            'xaxis.range': this.inputXRange,
            'yaxis.range': this.inputYRange
        });
        this.outputXRange = this.inputXRange;
        this.outputYRange = this.inputYRange;
    }

    initializeFrequencyChart() {
        console.log('📊 Initializing frequency chart...');
        
        this.frequencyChart = document.getElementById('frequencyChart');
        Plotly.newPlot(this.frequencyChart, [
            {
                x: [0],
                y: [0],
                type: 'scatter',
                mode: 'lines',
                line: { color: '#6c757d', width: 2 },
                name: 'Input Spectrum',
                hovertemplate: 'Frequency: %{x:.0f} Hz<br>Magnitude: %{y:.2f} dB<extra></extra>'
            },
            {
                x: [0],
                y: [0],
                type: 'scatter',
                mode: 'lines',
                line: { color: '#e03a3c', width: 2 },
                name: 'Equalized Spectrum',
                hovertemplate: 'Frequency: %{x:.0f} Hz<br>Magnitude: %{y:.2f} dB<extra></extra>'
            }
        ], {
            title: { text: '', font: { size: 14, color: '#6c757d' } },
            margin: { t: 10, r: 30, b: 50, l: 60 },
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            font: { color: '#6c757d' },
            xaxis: {
                title: { text: 'Frequency (Hz)', font: { color: '#6c757d' } },
                type: 'linear',
                gridcolor: 'rgba(128,128,128,0.2)',
                linecolor: 'rgba(128,128,128,0.5)',
                showgrid: true
            },
            yaxis: {
                title: { text: 'Magnitude (dB)', font: { color: '#6c757d' } },
                gridcolor: 'rgba(128,128,128,0.2)',
                linecolor: 'rgba(128,128,128,0.5)',
                showgrid: true
            },
            showlegend: true,
            legend: { 
                x: 0, 
                y: 1,
                bgcolor: 'rgba(255,255,255,0.8)',
                bordercolor: 'rgba(128,128,128,0.3)',
                borderwidth: 1
            },
            hovermode: 'closest'
        }, {
            displayModeBar: true,
            displaylogo: false,
            modeBarButtonsToRemove: ['lasso2d', 'select2d'],
            scrollZoom: true
        });
        
        console.log('✅ Frequency chart initialized');
    }

    initializeSpectrograms() {
        console.log('🎨 Initializing spectrograms...');
        
        // Input spectrogram
        this.inputSpectrogram = document.getElementById('inputSpectrogram');
        Plotly.newPlot(this.inputSpectrogram, [{
            z: [[0]],
            x: [0],
            y: [0],
            type: 'heatmap',
            colorscale: 'Viridis',
            showscale: true,
            colorbar: {
                title: 'dB',
                titleside: 'right'
            },
            hovertemplate: 'Time: %{x:.2f}s<br>Frequency: %{y:.0f}Hz<br>Magnitude: %{z:.2f} dB<extra></extra>'
        }], {
            title: { text: '', font: { size: 14, color: '#6c757d' } },
            margin: { t: 10, r: 30, b: 50, l: 60 },
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            font: { color: '#6c757d' },
            xaxis: { 
                title: { text: 'Time (s)', font: { color: '#6c757d' } },
                showgrid: true,
                gridcolor: 'rgba(128,128,128,0.1)'
            },
            yaxis: { 
                title: { text: 'Frequency (Hz)', font: { color: '#6c757d' } }, 
                type: 'log',
                showgrid: true,
                gridcolor: 'rgba(128,128,128,0.1)'
            }
        }, {
            displayModeBar: true,
            displaylogo: false
        });

        // Output spectrogram
        this.outputSpectrogram = document.getElementById('outputSpectrogram');
        Plotly.newPlot(this.outputSpectrogram, [{
            z: [[0]],
            x: [0],
            y: [0],
            type: 'heatmap',
            colorscale: 'Viridis',
            showscale: true,
            colorbar: {
                title: 'dB',
                titleside: 'right'
            },
            hovertemplate: 'Time: %{x:.2f}s<br>Frequency: %{y:.0f}Hz<br>Magnitude: %{z:.2f} dB<extra></extra>'
        }], {
            title: { text: '', font: { size: 14, color: '#6c757d' } },
            margin: { t: 10, r: 30, b: 50, l: 60 },
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            font: { color: '#6c757d' },
            xaxis: { 
                title: { text: 'Time (s)', font: { color: '#6c757d' } },
                showgrid: true,
                gridcolor: 'rgba(128,128,128,0.1)'
            },
            yaxis: { 
                title: { text: 'Frequency (Hz)', font: { color: '#6c757d' } }, 
                type: 'log',
                showgrid: true,
                gridcolor: 'rgba(128,128,128,0.1)'
            }
        }, {
            displayModeBar: true,
            displaylogo: false
        });
        
        console.log('✅ Spectrograms initialized');
    }

    addDefaultBands() {
        console.log('🎛️ Adding default frequency bands...');
        
        const defaultBands = [
            { startFreq: 20, endFreq: 250, gain: 1.0, bandwidth: 230 },
            { startFreq: 250, endFreq: 1000, gain: 1.0, bandwidth: 750 },
            { startFreq: 1000, endFreq: 4000, gain: 1.0, bandwidth: 3000 },
            { startFreq: 4000, endFreq: 20000, gain: 1.0, bandwidth: 16000 }
        ];

        defaultBands.forEach(band => this.addBand(band.startFreq, band.endFreq, band.gain, band.bandwidth));
        
        console.log('✅ Default bands added');
    }

    addBand(startFreq = 1000, endFreq = 2000, gain = 1.0, bandwidth = 1000) {
        const band = {
            id: Date.now() + Math.random(),
            startFreq: startFreq,
            endFreq: endFreq,
            gain: gain,
            bandwidth: bandwidth || (endFreq - startFreq)
        };

        this.bands.push(band);
        this.renderBand(band);
        this.updateFrequencyChart();
        
        console.log(`✅ Band added: ${startFreq}-${endFreq}Hz, gain: ${gain}`);
    }

    renderBand(band) {
        const container = document.getElementById('bandsContainer');
        const bandElement = document.createElement('div');
        bandElement.className = 'band-control';
        bandElement.innerHTML = `
            <div class="band-header">
                <h6>${this.getBandName(band.startFreq, band.endFreq)}</h6>
                <button class="btn btn-sm remove-band" data-id="${band.id}">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
            <div class="band-controls">
                <div class="frequency-range-control">
                    <label>Frequency Range: <span class="freq-display">${band.startFreq} - ${band.endFreq} Hz</span></label>
                    <div class="range-slider-container">
                        <input type="range" class="form-range range-slider freq-range" 
                               min="20" max="20000" step="10" 
                               value="${(band.startFreq + band.endFreq) / 2}">
                        <div class="range-labels">
                            <small>20 Hz</small>
                            <small>10 kHz</small>
                            <small>20 kHz</small>
                        </div>
                    </div>
                </div>
                <div class="gain-control">
                    <label>Gain</label>
                    <div class="gain-slider-container">
                        <input type="range" class="form-range gain-slider" 
                               min="0" max="2" step="0.1" value="${band.gain}">
                        <span class="gain-value">${band.gain.toFixed(1)}</span>
                    </div>
                    <div class="gain-labels d-flex justify-content-between">
                        <small>0 (mute)</small>
                        <small>1 (normal)</small>
                        <small>2 (2×)</small>
                    </div>
                </div>
            </div>
        `;

        container.appendChild(bandElement);

        // Add event listeners
        this.attachBandEventListeners(bandElement, band.id);
    }

    getBandName(startFreq, endFreq) {
        const centerFreq = (startFreq + endFreq) / 2;
        if (centerFreq <= 60) return 'Sub Bass';
        if (centerFreq <= 250) return 'Bass';
        if (centerFreq <= 500) return 'Low Mid';
        if (centerFreq <= 1000) return 'Mid';
        if (centerFreq <= 2000) return 'Upper Mid';
        if (centerFreq <= 4000) return 'Presence';
        if (centerFreq <= 8000) return 'Brilliance';
        return 'High End';
    }

    attachBandEventListeners(element, bandId) {
        const band = this.bands.find(b => b.id === bandId);
        const rangeSlider = element.querySelector('.freq-range');
        const gainSlider = element.querySelector('.gain-slider');
        const freqDisplay = element.querySelector('.freq-display');
        const gainValue = element.querySelector('.gain-value');

        // Frequency range slider
        rangeSlider.addEventListener('input', (e) => {
            const centerFreq = parseInt(e.target.value);
            const bandwidth = band.bandwidth;
            band.startFreq = Math.max(20, centerFreq - bandwidth / 2);
            band.endFreq = Math.min(20000, centerFreq + bandwidth / 2);
            freqDisplay.textContent = `${band.startFreq} - ${band.endFreq} Hz`;
            this.updateFrequencyChart();
        });

        // Gain slider
        gainSlider.addEventListener('input', (e) => {
            band.gain = parseFloat(e.target.value);
            gainValue.textContent = band.gain.toFixed(1);
            this.updateFrequencyChart();
        });

        // Remove band
        element.querySelector('.remove-band').addEventListener('click', () => {
            this.removeBand(bandId);
        });
    }

    removeBand(bandId) {
        this.bands = this.bands.filter(b => b.id !== bandId);
        this.updateBandsDisplay();
        this.updateFrequencyChart();
        console.log(`🗑️ Band removed: ${bandId}`);
    }

    updateBandsDisplay() {
        const container = document.getElementById('bandsContainer');
        container.innerHTML = '';
        this.bands.forEach(band => this.renderBand(band));
    }

    updateFrequencyChart() {
    if (!this.spectrumData) return;

    const frequencies = this.spectrumData.frequencies;
    const inputMagnitude = this.spectrumData.magnitude;
    const equalizedMagnitude = this.calculateEqualizedSpectrum(frequencies, inputMagnitude);

    // Convert to dB scale
    const inputDB = inputMagnitude.map(mag => 20 * Math.log10(mag + 1e-10));
    const equalizedDB = equalizedMagnitude.map(mag => 20 * Math.log10(mag + 1e-10));

    // Update frequency chart
    Plotly.react(this.frequencyChart, [
        {
            x: frequencies,
            y: inputDB,
            type: 'scatter',
            mode: 'lines',
            line: { color: '#6c757d', width: 2 },
            name: 'Input Spectrum',
            hovertemplate: 'Frequency: %{x:.0f} Hz<br>Magnitude: %{y:.2f} dB<extra></extra>'
        },
        {
            x: frequencies,
            y: equalizedDB,
            type: 'scatter',
            mode: 'lines',
            line: { color: '#e03a3c', width: 2 },
            name: 'Equalized Spectrum',
            hovertemplate: 'Frequency: %{x:.0f} Hz<br>Magnitude: %{y:.2f} dB<extra></extra>'
        }
    ], {
        xaxis: { 
            type: this.currentScale === 'audiogram' ? 'log' : 'linear',
            title: this.currentScale === 'audiogram' ? 'Frequency (Hz) - Log Scale' : 'Frequency (Hz)'
        }
    });

    // Update scale display
    document.getElementById('currentScaleDisplay').textContent = 
        this.currentScale === 'audiogram' ? 'Logarithmic' : 'Linear';

    console.log('📊 Frequency chart updated');
}

    calculateEqualizedSpectrum(frequencies, inputMagnitude) {
        const equalizedMagnitude = [...inputMagnitude];
        
        this.bands.forEach(band => {
            frequencies.forEach((freq, i) => {
                if (freq >= band.startFreq && freq <= band.endFreq) {
                    equalizedMagnitude[i] *= band.gain;
                }
            });
        });

        return equalizedMagnitude;
    }

    async handleFileUpload(file) {
        if (!file) return;
        
        console.log(`📁 Handling file upload: ${file.name}`);
        
        // Validate file
        const allowedExtensions = ['wav', 'wave', 'flac', 'mp3', 'm4a', 'aac', 'ogg', 'mp4', 'wma', 'aiff', 'aif'];
        const fileExt = file.name.split('.').pop().toLowerCase();
        
        if (!allowedExtensions.includes(fileExt)) {
            this.showNotification('Unsupported file type. Please use WAV, FLAC, MP3, M4A, AAC, OGG, or AIFF.', 'error');
            return;
        }

        this.showNotification(`Loading ${file.name}...`, 'info');

        try {
            this.currentAudioFile = file;
            document.getElementById('processAudio').disabled = false;

            // Show file info
            this.showFileInfo(file);

            // Extract audio data
            await this.extractAudioData(file);

            // Update waveform plots
            this.updateWaveformPlots();

            // Compute frequency spectrum
            await this.computeFrequencySpectrum(file);

            // Compute spectrograms
            await this.updateSpectrograms();

            this.showNotification(`"${file.name}" loaded successfully!`, 'success');

        } catch (error) {
            console.error('❌ Error loading audio file:', error);
            this.showNotification('Error loading audio file. Please try again.', 'error');
        }
    }

    async extractAudioData(file) {
        return new Promise((resolve, reject) => {
            console.log('🔊 Extracting audio data...');
            
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    if (!this.audioContext) {
                        this.initializeAudioContext();
                    }

                    this.inputAudioBuffer = await this.audioContext.decodeAudioData(e.target.result);
                    
                    this.audioData = this.inputAudioBuffer.getChannelData(0);
                    this.sampleRate = this.inputAudioBuffer.sampleRate;
                    this.totalDuration = this.inputAudioBuffer.duration;
                    
                    // Create time array
                    this.inputTimeData = Array.from({length: this.audioData.length}, (_, i) => i / this.sampleRate);
                    this.inputAmplitudeData = Array.from(this.audioData);
                    
                    // Initialize output data as copy of input
                    this.outputTimeData = [...this.inputTimeData];
                    this.outputAmplitudeData = [...this.inputAmplitudeData];
                    
                    // Update timeline
                    this.updateTimeline();
                    
                    console.log(`✅ Audio data extracted: ${this.audioData.length} samples, ${this.sampleRate}Hz, ${this.totalDuration.toFixed(2)}s`);
                    resolve();
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }

    updateTimeline() {
        const timelineSlider = document.getElementById('timelineSlider');
        const totalTimeElement = document.getElementById('totalTime');
        const inputDurationElement = document.getElementById('inputDuration');
        const outputDurationElement = document.getElementById('outputDuration');

        timelineSlider.max = Math.floor(this.totalDuration * 1000);
        totalTimeElement.textContent = this.totalDuration.toFixed(2);
        inputDurationElement.textContent = this.totalDuration.toFixed(2);
        outputDurationElement.textContent = this.totalDuration.toFixed(2);

        console.log(`⏰ Timeline updated: ${this.totalDuration.toFixed(2)}s`);
    }

    updateWaveformPlots() {
    if (!this.audioData || !this.sampleRate) return;

    console.log('📈 Updating waveform plots...');

    // Calculate the number of samples for 10 seconds
    const targetDuration = 10; // 10 seconds
    const maxSamples = Math.min(this.audioData.length, targetDuration * this.sampleRate);
    
    // Get the first 10 seconds of data (or all data if shorter than 10 seconds)
    const displayTime = Array.from({length: maxSamples}, (_, i) => i / this.sampleRate);
    const displayData = this.inputAmplitudeData.slice(0, maxSamples);

    // Limit data points for performance (only if we have more than 5000 points)
    let finalDisplayTime = displayTime;
    let finalDisplayData = displayData;

    if (maxSamples > 5000) {
        const step = Math.ceil(maxSamples / 5000);
        finalDisplayTime = displayTime.filter((_, i) => i % step === 0);
        finalDisplayData = displayData.filter((_, i) => i % step === 0);
    }

    const displayDuration = Math.min(this.totalDuration, targetDuration);

    // Update input waveform
    Plotly.react(this.inputWaveformPlot, [{
        x: finalDisplayTime,
        y: finalDisplayData,
        type: 'scatter',
        mode: 'lines',
        line: { color: '#e03a3c', width: 1.5 },
        name: 'Input Signal'
    }], {
        xaxis: { 
            range: [0, displayDuration],
            title: { text: `Time (s) - Displaying: ${displayDuration.toFixed(2)}s` }
        },
        yaxis: { range: [-1, 1] }
    });

    // Update output waveform (initially same as input)
    Plotly.react(this.outputWaveformPlot, [{
        x: finalDisplayTime,
        y: finalDisplayData,
        type: 'scatter',
        mode: 'lines',
        line: { color: '#28a745', width: 1.5 },
        name: 'Output Signal'
    }], {
        xaxis: { 
            range: [0, displayDuration],
            title: { text: `Time (s) - Displaying: ${displayDuration.toFixed(2)}s` }
        },
        yaxis: { range: [-1, 1] }
    });

    // Reset ranges
    this.inputXRange = [0, displayDuration];
    this.outputXRange = [0, displayDuration];
    
    console.log(`✅ Waveform plots updated - Displaying ${displayDuration.toFixed(2)} seconds`);
}

    async computeFrequencySpectrum(file) {
        try {
            console.log('📊 Computing frequency spectrum...');
            
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch(`${this.baseURL}/compute_spectrum`, {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                this.spectrumData = await response.json();
                this.updateFrequencyChart();
                console.log('✅ Frequency spectrum computed');
            } else {
                throw new Error(`HTTP ${response.status}: Spectrum computation failed`);
            }
        } catch (error) {
            console.error('❌ Error computing spectrum:', error);
            // Fallback to client-side computation
            this.computeSpectrumClientSide();
        }
    }

    computeSpectrumClientSide() {
        console.log('🔄 Using client-side spectrum computation...');
        
        if (!this.audioData || !this.sampleRate) return;

        // Simple FFT using Web Audio API AnalyserNode
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const analyser = audioContext.createAnalyser();
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        // Create a temporary source for analysis
        const buffer = audioContext.createBuffer(1, this.audioData.length, this.sampleRate);
        buffer.copyToChannel(this.audioData, 0);
        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(analyser);
        
        analyser.getByteFrequencyData(dataArray);

        // Convert to frequency data
        const frequencies = Array.from({length: bufferLength}, (_, i) => i * this.sampleRate / (2 * bufferLength));
        const magnitude = Array.from(dataArray, val => val / 255);

        this.spectrumData = {
            frequencies: frequencies,
            magnitude: magnitude,
            sample_rate: this.sampleRate
        };

        this.updateFrequencyChart();
        console.log('✅ Client-side spectrum computed');
    }

   async updateSpectrograms() {
    if (!this.currentAudioFile) return;

    try {
        console.log('🎨 Computing spectrograms (10-second limit)...');
        
        // Compute input spectrogram with time limit
        const formData = new FormData();
        formData.append('file', this.currentAudioFile);
        formData.append('max_duration', '10'); // Send max duration to backend

        const response = await fetch(`${this.baseURL}/compute_spectrogram`, {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            const spectrogramData = await response.json();
            this.updateSpectrogramPlot(this.inputSpectrogram, spectrogramData, 'Input Spectrogram');
            console.log('✅ Input spectrogram computed (10s limit)');

            // If processed audio exists, compute output spectrogram
            if (this.processedAudioUrl) {
                await this.computeOutputSpectrogram();
            }
        } else {
            throw new Error('Spectrogram computation failed');
        }
    } catch (error) {
        console.error('❌ Error computing spectrogram:', error);
        // Fallback to client-side computation without time limit
        this.computeSpectrogramClientSide();
    }
}

    async computeOutputSpectrogram() {
    try {
        const response = await fetch(this.processedAudioUrl);
        const blob = await response.blob();
        const processedFile = new File([blob], 'processed_audio.wav', { type: 'audio/wav' });
        
        const formData = new FormData();
        formData.append('file', processedFile);
        formData.append('max_duration', '10'); // Send max duration to backend

        const spectrogramResponse = await fetch(`${this.baseURL}/compute_spectrogram`, {
            method: 'POST',
            body: formData
        });

        if (spectrogramResponse.ok) {
            const spectrogramData = await spectrogramResponse.json();
            this.updateSpectrogramPlot(this.outputSpectrogram, spectrogramData, 'Output Spectrogram');
            console.log('✅ Output spectrogram computed (10s limit)');
        }
    } catch (error) {
        console.error('❌ Error computing output spectrogram:', error);
    }
}

   updateSpectrogramPlot(plotElement, spectrogramData, title) {
    // Ensure we only display up to 10 seconds
    const maxTime = 10; // 10 seconds maximum
    
    let displayTimes = spectrogramData.times;
    let displaySpectrogram = spectrogramData.spectrogram;
    
    // Filter data to only include times up to 10 seconds
    const timeLimitIndex = displayTimes.findIndex(time => time > maxTime);
    if (timeLimitIndex !== -1) {
        displayTimes = displayTimes.slice(0, timeLimitIndex);
        displaySpectrogram = displaySpectrogram.map(row => row.slice(0, timeLimitIndex));
    }
    
    // Update the plot title to show time limit
    const displayDuration = Math.min(Math.max(...displayTimes), maxTime);
    const actualTitle = `${title} (${displayDuration.toFixed(1)}s)`;

    Plotly.react(plotElement, [{
        z: displaySpectrogram,
        x: displayTimes,
        y: spectrogramData.frequencies,
        type: 'heatmap',
        colorscale: 'Viridis',
        showscale: true,
        colorbar: {
            title: 'dB',
            titleside: 'right'
        },
        hovertemplate: 'Time: %{x:.2f}s<br>Frequency: %{y:.0f}Hz<br>Magnitude: %{z:.2f} dB<extra></extra>'
    }], {
        title: { text: '', font: { size: 14, color: '#6c757d' } },
        xaxis: { 
            title: 'Time (s)',
            range: [0, displayDuration] // Set x-axis range to match displayed duration
        },
        yaxis: { 
            title: 'Frequency (Hz)', 
            type: 'log'
        }
    });
    
    console.log(`✅ ${title} updated - Displaying ${displayDuration.toFixed(1)} seconds`);
}

    async generateTestSignal() {
        this.showNotification('Generating test signal...', 'info');

        try {
            console.log('🎵 Generating test signal...');
            
            const response = await fetch(`${this.baseURL}/generate_test_signal`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    frequencies: [100, 250, 500, 1000, 2000, 4000, 8000],
                    duration: 5.0,
                    sample_rate: 44100,
                    amplitude: 0.8
                })
            });

            if (response.ok) {
                const blob = await response.blob();
                
                // Create a File object from the blob
                const file = new File([blob], 'test_signal.wav', { type: 'audio/wav' });
                await this.handleFileUpload(file);

                this.showNotification('Test signal generated successfully!', 'success');
            } else {
                const errorText = await response.text();
                throw new Error(`Server error: ${errorText}`);
            }
        } catch (error) {
            console.error('❌ Error generating test signal:', error);
            this.showNotification('Error generating test signal. Please check backend connection.', 'error');
        }
    }

    async processAudio() {
        if (!this.currentAudioFile || this.bands.length === 0) {
            this.showNotification('Please upload an audio file and configure frequency bands.', 'error');
            return;
        }

        this.showNotification('Processing audio...', 'info');

        const processButton = document.getElementById('processAudio');
        const progressBar = document.getElementById('processingProgress');

        processButton.disabled = true;
        progressBar.style.display = 'block';

        // Simulate progress
        let progress = 0;
        const progressInterval = setInterval(() => {
            progress += 10;
            progressBar.querySelector('.progress-bar').style.width = `${progress}%`;
            if (progress >= 90) clearInterval(progressInterval);
        }, 100);

        try {
            console.log('🎚️ Processing audio with equalizer...');
            
            const formData = new FormData();
            formData.append('file', this.currentAudioFile);
            formData.append('settings', JSON.stringify({ bands: this.bands }));

            const response = await fetch(`${this.baseURL}/process_audio`, {
                method: 'POST',
                body: formData
            });

            clearInterval(progressInterval);

            if (response.ok) {
                const blob = await response.blob();
                this.processedAudioUrl = URL.createObjectURL(blob);

                // Extract processed audio data
                await this.extractProcessedAudioData(blob);

                // Update output waveform
                this.updateOutputWaveform();

                // Update spectrograms
                await this.computeOutputSpectrogram();

                // Update progress to 100%
                progressBar.querySelector('.progress-bar').style.width = '100%';
                setTimeout(() => {
                    progressBar.style.display = 'none';
                    progressBar.querySelector('.progress-bar').style.width = '0%';
                }, 500);

                this.showNotification('Audio processed successfully!', 'success');
            } else {
                const errorText = await response.text();
                throw new Error(`Processing failed: ${errorText}`);
            }
        } catch (error) {
            console.error('❌ Error processing audio:', error);
            this.showNotification('Error processing audio. Please try again.', 'error');
        } finally {
            processButton.disabled = false;
            progressBar.style.display = 'none';
            progressBar.querySelector('.progress-bar').style.width = '0%';
        }
    }

    async extractProcessedAudioData(blob) {
        return new Promise((resolve, reject) => {
            console.log('🔊 Extracting processed audio data...');
            
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    this.outputAudioBuffer = await this.audioContext.decodeAudioData(e.target.result);
                    
                    this.processedAudioData = this.outputAudioBuffer.getChannelData(0);
                    this.outputAmplitudeData = Array.from(this.processedAudioData);
                    
                    console.log(`✅ Processed audio data extracted: ${this.processedAudioData.length} samples`);
                    resolve();
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(blob);
        });
    }

   updateOutputWaveform() {
    if (!this.processedAudioData) return;

    console.log('📈 Updating output waveform...');

    // Calculate the number of samples for 10 seconds
    const targetDuration = 10; // 10 seconds
    const maxSamples = Math.min(this.processedAudioData.length, targetDuration * this.sampleRate);
    
    // Get the first 10 seconds of data (or all data if shorter than 10 seconds)
    const displayTime = Array.from({length: maxSamples}, (_, i) => i / this.sampleRate);
    const displayData = this.outputAmplitudeData.slice(0, maxSamples);

    // Limit data points for performance (only if we have more than 5000 points)
    let finalDisplayTime = displayTime;
    let finalDisplayData = displayData;

    if (maxSamples > 5000) {
        const step = Math.ceil(maxSamples / 5000);
        finalDisplayTime = displayTime.filter((_, i) => i % step === 0);
        finalDisplayData = displayData.filter((_, i) => i % step === 0);
    }

    const displayDuration = Math.min(this.totalDuration, targetDuration);

    Plotly.react(this.outputWaveformPlot, [{
        x: finalDisplayTime,
        y: finalDisplayData,
        type: 'scatter',
        mode: 'lines',
        line: { color: '#28a745', width: 1.5 },
        name: 'Output Signal'
    }], {
        xaxis: { range: this.outputXRange },
        yaxis: { range: this.outputYRange }
    });

    console.log(`✅ Output waveform updated - Displaying ${displayDuration.toFixed(2)} seconds`);
}

    // Audio playback methods
    playInput() {
        if (!this.inputAudioBuffer) {
            this.showNotification('No input audio loaded', 'error');
            return;
        }

        this.stopAll(); // Stop any currently playing audio

        try {
            this.inputSource = this.audioContext.createBufferSource();
            this.inputSource.buffer = this.inputAudioBuffer;
            this.inputSource.connect(this.inputGainNode);
            this.inputSource.playbackRate.value = this.inputPlaybackSpeed;
            
            this.inputSource.start(0, this.currentTime);
            this.playbackStartTime = this.audioContext.currentTime - this.currentTime;
            
            this.startPlaybackTracking('input');
            this.showNotification('Playing input audio', 'info');
        } catch (error) {
            console.error('Error playing input audio:', error);
            this.showNotification('Error playing input audio', 'error');
        }
    }

    playOutput() {
        if (!this.outputAudioBuffer) {
            this.showNotification('No processed audio available. Please process audio first.', 'error');
            return;
        }

        this.stopAll(); // Stop any currently playing audio

        try {
            this.outputSource = this.audioContext.createBufferSource();
            this.outputSource.buffer = this.outputAudioBuffer;
            this.outputSource.connect(this.outputGainNode);
            this.outputSource.playbackRate.value = this.outputPlaybackSpeed;
            
            this.outputSource.start(0, this.currentTime);
            this.playbackStartTime = this.audioContext.currentTime - this.currentTime;
            
            this.startPlaybackTracking('output');
            this.showNotification('Playing output audio', 'info');
        } catch (error) {
            console.error('Error playing output audio:', error);
            this.showNotification('Error playing output audio', 'error');
        }
    }

    playAll() {
        if (!this.inputAudioBuffer) {
            this.showNotification('No audio loaded', 'error');
            return;
        }

        this.stopAll(); // Stop any currently playing audio

        try {
            // Play input audio
            this.inputSource = this.audioContext.createBufferSource();
            this.inputSource.buffer = this.inputAudioBuffer;
            this.inputSource.connect(this.inputGainNode);
            this.inputSource.playbackRate.value = this.inputPlaybackSpeed;
            
            // Play output audio if available
            if (this.outputAudioBuffer) {
                this.outputSource = this.audioContext.createBufferSource();
                this.outputSource.buffer = this.outputAudioBuffer;
                this.outputSource.connect(this.outputGainNode);
                this.outputSource.playbackRate.value = this.outputPlaybackSpeed;
                this.outputSource.start(0, this.currentTime);
            }
            
            this.inputSource.start(0, this.currentTime);
            this.playbackStartTime = this.audioContext.currentTime - this.currentTime;
            
            this.startPlaybackTracking('both');
            this.showNotification('Playing both audio signals', 'info');
        } catch (error) {
            console.error('Error playing audio:', error);
            this.showNotification('Error playing audio', 'error');
        }
    }

    pauseAll() {
        if (this.inputSource) {
            this.inputSource.stop();
            this.inputSource = null;
        }
        if (this.outputSource) {
            this.outputSource.stop();
            this.outputSource = null;
        }
        
        this.stopPlaybackTracking();
        this.showNotification('Playback paused', 'info');
    }

    stopAll() {
        this.pauseAll();
        this.currentTime = 0;
        this.updatePlaybackPosition();
        this.showNotification('Playback stopped', 'info');
    }

    pauseInput() {
        if (this.inputSource) {
            this.inputSource.stop();
            this.inputSource = null;
            this.showNotification('Input audio paused', 'info');
        }
    }

    stopInput() {
        this.pauseInput();
        this.currentTime = 0;
        this.updatePlaybackPosition();
        this.showNotification('Input audio stopped', 'info');
    }

    pauseOutput() {
        if (this.outputSource) {
            this.outputSource.stop();
            this.outputSource = null;
            this.showNotification('Output audio paused', 'info');
        }
    }

    stopOutput() {
        this.pauseOutput();
        this.currentTime = 0;
        this.updatePlaybackPosition();
        this.showNotification('Output audio stopped', 'info');
    }

    startPlaybackTracking(type) {
        this.stopPlaybackTracking();
        
        this.playbackInterval = setInterval(() => {
            this.currentTime = this.audioContext.currentTime - this.playbackStartTime;
            
            if (this.currentTime >= this.totalDuration) {
                this.stopAll();
                return;
            }
            
            this.updatePlaybackPosition();
        }, 50); // Update every 50ms for smooth playback
    }

    stopPlaybackTracking() {
        if (this.playbackInterval) {
            clearInterval(this.playbackInterval);
            this.playbackInterval = null;
        }
    }

    seekToTime(time) {
        this.currentTime = Math.max(0, Math.min(time, this.totalDuration));
        
        // If audio is playing, restart from new position
        if (this.inputSource || this.outputSource) {
            const wasPlaying = this.inputSource || this.outputSource;
            this.stopAll();
            if (wasPlaying) {
                this.playAll();
            }
        } else {
            this.updatePlaybackPosition();
        }
    }

    updatePlaybackPosition() {
        // Update timeline slider
        const timelineSlider = document.getElementById('timelineSlider');
        const currentTimeElement = document.getElementById('currentTime');
        const inputPositionElement = document.getElementById('inputPosition');
        const outputPositionElement = document.getElementById('outputPosition');

        timelineSlider.value = this.currentTime * 1000;
        currentTimeElement.textContent = this.currentTime.toFixed(2);
        inputPositionElement.textContent = this.currentTime.toFixed(2);
        outputPositionElement.textContent = this.currentTime.toFixed(2);
    }

    resetViewAll() {
        if (!this.audioData) return;

        console.log('🔄 Resetting all views...');

        const duration = this.totalDuration;
        
        Plotly.relayout(this.inputWaveformPlot, {
            'xaxis.range': [0, duration],
            'yaxis.range': [-1, 1]
        });
        
        Plotly.relayout(this.outputWaveformPlot, {
            'xaxis.range': [0, duration],
            'yaxis.range': [-1, 1]
        });

        this.inputXRange = [0, duration];
        this.outputXRange = [0, duration];
        this.inputYRange = [-1, 1];
        this.outputYRange = [-1, 1];

        this.showNotification('View reset', 'info');
    }

    resetGraph() {
        console.log('🔄 Resetting frequency graph...');
        
        Plotly.relayout(this.frequencyChart, {
            'xaxis.range': null,
            'yaxis.range': null
        });
        
        this.showNotification('Frequency graph reset', 'info');
    }

    exportAudio() {
        if (this.processedAudioUrl) {
            const a = document.createElement('a');
            a.href = this.processedAudioUrl;
            a.download = 'processed_audio.wav';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            this.showNotification('Processed audio downloaded!', 'success');
        } else {
            this.showNotification('No processed audio available for export.', 'error');
        }
    }

    exportSpectrum() {
        // Export frequency spectrum as image
        Plotly.downloadImage(this.frequencyChart, {
            format: 'png',
            width: 1200,
            height: 600,
            filename: 'frequency_spectrum'
        });
        this.showNotification('Frequency spectrum exported as PNG', 'success');
    }

    exportSpectrograms() {
        // Export both spectrograms
        Plotly.downloadImage(this.inputSpectrogram, {
            format: 'png',
            width: 800,
            height: 600,
            filename: 'input_spectrogram'
        });
        
        setTimeout(() => {
            Plotly.downloadImage(this.outputSpectrogram, {
                format: 'png',
                width: 800,
                height: 600,
                filename: 'output_spectrogram'
            });
        }, 500);
        
        this.showNotification('Spectrograms exported as PNG', 'success');
    }

    // Preset Management
    async loadPresetsList() {
        try {
            console.log('📋 Loading presets list...');
            
            const response = await fetch(`${this.baseURL}/list_presets`);
            if (response.ok) {
                const data = await response.json();
                const presetList = document.getElementById('presetList');
                
                presetList.innerHTML = '<option value="">Select preset...</option>';
                
                if (data.presets && data.presets.length > 0) {
                    data.presets.forEach(preset => {
                        const option = document.createElement('option');
                        option.value = preset.name;
                        option.textContent = preset.name;
                        if (preset.description) {
                            option.title = preset.description;
                        }
                        presetList.appendChild(option);
                    });
                    console.log(`✅ Loaded ${data.presets.length} presets`);
                } else {
                    console.log('📝 No presets found');
                }
            }
        } catch (error) {
            console.error('❌ Error loading presets:', error);
        }
    }

    async loadPreset(presetName) {
        try {
            console.log(`📥 Loading preset: ${presetName}`);
            
            const response = await fetch(`${this.baseURL}/load_preset?name=${encodeURIComponent(presetName)}`);
            if (response.ok) {
                const preset = await response.json();
                if (preset.bands && Array.isArray(preset.bands)) {
                    this.bands = preset.bands;
                    this.currentPreset = presetName;
                    document.getElementById('presetName').value = presetName;
                    this.updateBandsDisplay();
                    this.updateFrequencyChart();
                    this.showNotification(`Preset "${presetName}" loaded!`, 'success');
                    console.log(`✅ Preset loaded: ${presetName} with ${preset.bands.length} bands`);
                } else {
                    throw new Error('Invalid preset structure');
                }
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
        } catch (error) {
            console.error('❌ Error loading preset:', error);
            this.showNotification(`Failed to load preset "${presetName}"`, 'error');
        }
    }

    async savePreset() {
        const presetName = document.getElementById('presetName').value.trim();
        
        if (!presetName) {
            this.showNotification('Please enter a preset name', 'error');
            return;
        }

        if (this.bands.length === 0) {
            this.showNotification('No frequency bands configured', 'error');
            return;
        }

        try {
            console.log(`💾 Saving preset: ${presetName}`);
            
            const response = await fetch(`${this.baseURL}/save_preset`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: presetName,
                    bands: this.bands,
                    description: `Custom equalizer preset with ${this.bands.length} bands`
                })
            });

            if (response.ok) {
                this.currentPreset = presetName;
                await this.loadPresetsList();
                document.getElementById('presetList').value = presetName;
                this.showNotification(`Preset "${presetName}" saved successfully!`, 'success');
                console.log(`✅ Preset saved: ${presetName}`);
            } else {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to save preset');
            }
        } catch (error) {
            console.error('❌ Error saving preset:', error);
            this.showNotification(`Failed to save preset: ${error.message}`, 'error');
        }
    }

    async updatePreset() {
        const presetName = document.getElementById('presetName').value.trim();
        
        if (!presetName) {
            this.showNotification('Please select a preset to update', 'error');
            return;
        }

        if (this.bands.length === 0) {
            this.showNotification('No frequency bands configured', 'error');
            return;
        }

        try {
            console.log(`🔄 Updating preset: ${presetName}`);
            
            // For update, we'll delete and recreate the preset
            const deleteResponse = await fetch(`${this.baseURL}/delete_preset?name=${encodeURIComponent(presetName)}`, {
                method: 'DELETE'
            });

            if (deleteResponse.ok) {
                const saveResponse = await fetch(`${this.baseURL}/save_preset`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: presetName,
                        bands: this.bands,
                        description: `Updated equalizer preset with ${this.bands.length} bands`
                    })
                });

                if (saveResponse.ok) {
                    await this.loadPresetsList();
                    this.showNotification(`Preset "${presetName}" updated successfully!`, 'success');
                    console.log(`✅ Preset updated: ${presetName}`);
                } else {
                    throw new Error('Failed to save updated preset');
                }
            } else {
                throw new Error('Failed to delete old preset');
            }
        } catch (error) {
            console.error('❌ Error updating preset:', error);
            this.showNotification(`Failed to update preset: ${error.message}`, 'error');
        }
    }

    async deletePreset() {
        const presetName = document.getElementById('presetName').value.trim();
        
        if (!presetName) {
            this.showNotification('Please select a preset to delete', 'error');
            return;
        }

        if (!confirm(`Are you sure you want to delete the preset "${presetName}"?`)) {
            return;
        }

        try {
            console.log(`🗑️ Deleting preset: ${presetName}`);
            
            const response = await fetch(`${this.baseURL}/delete_preset?name=${encodeURIComponent(presetName)}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                this.currentPreset = null;
                document.getElementById('presetName').value = '';
                document.getElementById('presetList').value = '';
                await this.loadPresetsList();
                this.showNotification(`Preset "${presetName}" deleted successfully!`, 'success');
                console.log(`✅ Preset deleted: ${presetName}`);
            } else {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to delete preset');
            }
        } catch (error) {
            console.error('❌ Error deleting preset:', error);
            this.showNotification(`Failed to delete preset: ${error.message}`, 'error');
        }
    }

    showFileInfo(file) {
        const fileInfo = document.getElementById('fileInfo');
        const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
        const fileExt = file.name.split('.').pop().toUpperCase();
        
        fileInfo.innerHTML = `
            <div class="file-info p-2 bg-light rounded">
                <small class="text-muted">
                    <strong>File:</strong> ${file.name}<br>
                    <strong>Type:</strong> ${fileExt}<br>
                    <strong>Size:</strong> ${sizeMB} MB
                </small>
            </div>
        `;
    }

    showNotification(message, type = 'info') {
        // Remove any existing notifications
        const existingAlerts = document.querySelectorAll('.alert.position-fixed');
        existingAlerts.forEach(alert => alert.remove());

        // Create notification element
        const notification = document.createElement('div');
        notification.className = `alert alert-${type === 'error' ? 'danger' : type} alert-dismissible fade show position-fixed`;
        notification.style.cssText = `
            top: 20px;
            right: 20px;
            z-index: 9999;
            min-width: 300px;
            max-width: 400px;
        `;
        
        const icons = {
            'success': 'check-circle',
            'error': 'exclamation-triangle', 
            'info': 'info-circle',
            'warning': 'exclamation-circle'
        };
        
        notification.innerHTML = `
            <i class="bi bi-${icons[type] || 'info-circle'} me-2"></i>
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        document.body.appendChild(notification);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
    }
}

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Starting Generic Equalizer Application...');
    
    // Check if Plotly is available
    if (typeof Plotly === 'undefined') {
        console.error('❌ Plotly.js is not loaded!');
        alert('Error: Plotly.js library is required but not loaded. Please check your internet connection and refresh the page.');
        return;
    }
    
    const equalizer = new GenericEqualizer();
    equalizer.initializeApp();
    
    // Make it globally available for debugging
    window.equalizer = equalizer;
    
    console.log('✅ Generic Equalizer started successfully!');
});