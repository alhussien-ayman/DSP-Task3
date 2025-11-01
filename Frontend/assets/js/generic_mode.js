class GenericEqualizer {
    constructor() {
        // Backend API URL - MAKE SURE THIS MATCHES YOUR RUNNING BACKEND
        this.baseURL = 'http://127.0.0.1:5000/api/generic';
        
        this.bands = [];
        this.frequencyChart = null;
        this.inputWaveform = null;
        this.outputWaveform = null;
        this.inputWaveformPlot = null;
        this.outputWaveformPlot = null;
        this.currentScale = 'linear';
        this.isPlaying = false;
        this.audioContext = null;
        this.audioBuffer = null;
        this.currentAudioFile = null;
        this.spectrumData = null;
        this.audioData = null;
        this.sampleRate = null;
        
        console.log('🎵 GenericEqualizer initialized with baseURL:', this.baseURL);
    }

    initializeApp() {
        this.initializeEventListeners();
        this.initializeCharts();
        this.initializeWaveforms();
        this.initializePlotlyWaveforms();
        this.addDefaultBands();
        this.initializeAudioContext();
        this.testBackendConnection();
    }

    async testBackendConnection() {
        try {
            console.log('🔌 Testing backend connection to:', this.baseURL);
            const response = await fetch(`${this.baseURL}/health`);
            
            if (response.ok) {
                const data = await response.json();
                console.log('✅ Backend connected successfully:', data);
                this.updateDebugPanel('✅ Backend connected', 'success');
                this.showNotification('Backend connected successfully!', 'success');
                
                // Load presets after successful connection
                this.loadPresetsList();
                return true;
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
            return false;
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
        
        // Add band button
        document.getElementById('addBand').addEventListener('click', () => {
            this.addBand();
        });

        // Scale selector
        document.getElementById('scaleSelect').addEventListener('change', (e) => {
            this.currentScale = e.target.value;
            this.updateFrequencyChart();
        });

        // Preset controls
        document.getElementById('savePreset').addEventListener('click', () => {
            this.savePreset();
        });

        document.getElementById('loadPreset').addEventListener('click', () => {
            this.togglePresetList();
        });

        document.getElementById('presetList').addEventListener('change', (e) => {
            if (e.target.value) {
                this.loadPreset(e.target.value);
            }
        });

        // File upload
        document.getElementById('audioUpload').addEventListener('change', (e) => {
            this.handleFileUpload(e.target.files[0]);
        });

        // Test signal
        document.getElementById('generateTest').addEventListener('click', () => {
            this.generateTestSignal();
        });

        // Process audio
        document.getElementById('processAudio').addEventListener('click', () => {
            this.processAudio();
        });

        // Player controls - Input
        document.getElementById('playInput').addEventListener('click', () => {
            this.playInput();
        });

        document.getElementById('pauseInput').addEventListener('click', () => {
            this.pauseInput();
        });

        document.getElementById('stopInput').addEventListener('click', () => {
            this.stopInput();
        });

        // Player controls - Output
        document.getElementById('playOutput').addEventListener('click', () => {
            this.playOutput();
        });

        document.getElementById('pauseOutput').addEventListener('click', () => {
            this.pauseOutput();
        });

        document.getElementById('stopOutput').addEventListener('click', () => {
            this.stopOutput();
        });

        // Zoom controls
        document.getElementById('zoomInInput').addEventListener('click', () => {
            this.zoomInInput();
        });

        document.getElementById('zoomOutInput').addEventListener('click', () => {
            this.zoomOutInput();
        });

        document.getElementById('resetViewInput').addEventListener('click', () => {
            this.resetViewInput();
        });

        document.getElementById('zoomInOutput').addEventListener('click', () => {
            this.zoomInOutput();
        });

        document.getElementById('zoomOutOutput').addEventListener('click', () => {
            this.zoomOutOutput();
        });

        document.getElementById('resetViewOutput').addEventListener('click', () => {
            this.resetViewOutput();
        });

        // Speed control
        document.getElementById('speedInput').addEventListener('input', (e) => {
            const speed = e.target.value;
            document.getElementById('speedValue').textContent = speed + 'x';
            if (this.inputWaveform) {
                this.inputWaveform.setPlaybackRate(parseFloat(speed));
            }
            if (this.outputWaveform) {
                this.outputWaveform.setPlaybackRate(parseFloat(speed));
            }
        });

        // Spectrogram toggle
        document.getElementById('showSpectrograms').addEventListener('change', (e) => {
            const container = document.getElementById('spectrogramsContainer');
            container.style.display = e.target.checked ? 'block' : 'none';
        });

        // Waveform toggle
        document.getElementById('toggleWaveforms').addEventListener('click', (e) => {
            this.toggleWaveforms(e.target);
        });

        // Graph reset
        document.getElementById('resetGraph').addEventListener('click', () => {
            this.resetGraph();
        });

        // Export audio
        document.getElementById('exportAudio').addEventListener('click', () => {
            this.exportAudio();
        });

        console.log('✅ Event listeners initialized');
    }

    initializeAudioContext() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (error) {
            console.error('Error initializing audio context:', error);
            this.showNotification('Your browser does not support the Web Audio API. Please use a modern browser.', 'error');
        }
    }

    initializeCharts() {
        const ctx = document.getElementById('frequencyChart').getContext('2d');
        this.frequencyChart = new Chart(ctx, {
            type: 'line',
            data: {
                datasets: [
                    {
                        label: 'Input Spectrum',
                        data: [],
                        borderColor: 'rgb(108, 117, 125)',
                        backgroundColor: 'rgba(108, 117, 125, 0.1)',
                        borderWidth: 2,
                        tension: 0.4,
                        fill: true
                    },
                    {
                        label: 'Equalized Spectrum',
                        data: [],
                        borderColor: 'rgb(224, 58, 60)',
                        backgroundColor: 'rgba(224, 58, 60, 0.1)',
                        borderWidth: 2,
                        tension: 0.4,
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: function(context) {
                                return `${context.dataset.label}: ${context.parsed.y.toFixed(2)} dB at ${context.parsed.x.toFixed(0)} Hz`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'linear',
                        title: {
                            display: true,
                            text: 'Frequency (Hz)',
                            color: 'rgb(119, 119, 119)'
                        },
                        grid: {
                            color: 'rgba(119, 119, 119, 0.1)'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Magnitude (dB)',
                            color: 'rgb(119, 119, 119)'
                        },
                        grid: {
                            color: 'rgba(119, 119, 119, 0.1)'
                        }
                    }
                }
            }
        });

        // Initialize spectrograms
        this.initializeSpectrograms();
    }

    initializePlotlyWaveforms() {
        // Initialize Plotly waveform containers with placeholder data
        const placeholderTime = Array.from({length: 1000}, (_, i) => i / 1000);
        const placeholderData = placeholderTime.map(t => Math.sin(2 * Math.PI * 440 * t) * 0.5);

        const inputLayout = {
            title: '',
            height: 200,
            margin: { t: 30, r: 30, b: 40, l: 50 },
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            font: { color: '#6c757d' },
            xaxis: {
                title: 'Time (s)',
                gridcolor: 'rgba(128,128,128,0.2)',
                linecolor: 'rgba(128,128,128,0.5)'
            },
            yaxis: {
                title: 'Amplitude',
                gridcolor: 'rgba(128,128,128,0.2)',
                linecolor: 'rgba(128,128,128,0.5)',
                range: [-1, 1]
            },
            showlegend: false
        };

        const outputLayout = {...inputLayout};

        this.inputWaveformPlot = Plotly.newPlot('inputWaveformPlot', [{
            x: placeholderTime,
            y: placeholderData,
            type: 'scatter',
            mode: 'lines',
            line: { color: '#e03a3c', width: 1 },
            name: 'Input Signal'
        }], inputLayout);

        this.outputWaveformPlot = Plotly.newPlot('outputWaveformPlot', [{
            x: placeholderTime,
            y: placeholderData,
            type: 'scatter',
            mode: 'lines',
            line: { color: '#28a745', width: 1 },
            name: 'Output Signal'
        }], outputLayout);
    }

    toggleWaveforms(button) {
        const container = document.getElementById('waveformsContainer');
        const isVisible = container.style.display !== 'none';
        
        if (isVisible) {
            container.style.display = 'none';
            button.textContent = 'Show Waveforms';
            button.classList.remove('btn-primary');
            button.classList.add('btn-outline-primary');
        } else {
            container.style.display = 'block';
            button.textContent = 'Hide Waveforms';
            button.classList.remove('btn-outline-primary');
            button.classList.add('btn-primary');
            
            // Update waveforms if audio data is available
            if (this.audioData) {
                this.updateWaveformPlots();
            }
        }
    }

    updateWaveformPlots() {
        if (!this.audioData || !this.sampleRate) return;

        try {
            // Create time array
            const duration = this.audioData.length / this.sampleRate;
            const time = Array.from({length: this.audioData.length}, (_, i) => i / this.sampleRate);

            // Limit data points for performance (show every 10th point for long files)
            const maxPoints = 10000;
            let displayTime = time;
            let displayData = Array.from(this.audioData);

            if (this.audioData.length > maxPoints) {
                const step = Math.ceil(this.audioData.length / maxPoints);
                displayTime = time.filter((_, i) => i % step === 0);
                displayData = this.audioData.filter((_, i) => i % step === 0);
            }

            // Update input waveform plot
            Plotly.react('inputWaveformPlot', [{
                x: displayTime,
                y: displayData,
                type: 'scatter',
                mode: 'lines',
                line: { color: '#e03a3c', width: 1 },
                name: 'Input Signal'
            }], {
                title: `Input Signal (${duration.toFixed(2)}s)`,
                height: 200,
                margin: { t: 30, r: 30, b: 40, l: 50 },
                paper_bgcolor: 'rgba(0,0,0,0)',
                plot_bgcolor: 'rgba(0,0,0,0)',
                font: { color: '#6c757d' },
                xaxis: {
                    title: 'Time (s)',
                    gridcolor: 'rgba(128,128,128,0.2)',
                    linecolor: 'rgba(128,128,128,0.5)',
                    range: [0, duration]
                },
                yaxis: {
                    title: 'Amplitude',
                    gridcolor: 'rgba(128,128,128,0.2)',
                    linecolor: 'rgba(128,128,128,0.5)',
                    range: [-1, 1]
                },
                showlegend: false
            });

            console.log('✅ Input waveform plot updated');

        } catch (error) {
            console.error('Error updating waveform plots:', error);
        }
    }

    updateOutputWaveformPlot(processedAudio, sampleRate) {
        if (!processedAudio || !sampleRate) return;

        try {
            const duration = processedAudio.length / sampleRate;
            const time = Array.from({length: processedAudio.length}, (_, i) => i / sampleRate);

            // Limit data points for performance
            const maxPoints = 10000;
            let displayTime = time;
            let displayData = Array.from(processedAudio);

            if (processedAudio.length > maxPoints) {
                const step = Math.ceil(processedAudio.length / maxPoints);
                displayTime = time.filter((_, i) => i % step === 0);
                displayData = processedAudio.filter((_, i) => i % step === 0);
            }

            // Update output waveform plot
            Plotly.react('outputWaveformPlot', [{
                x: displayTime,
                y: displayData,
                type: 'scatter',
                mode: 'lines',
                line: { color: '#28a745', width: 1 },
                name: 'Output Signal'
            }], {
                title: `Output Signal (${duration.toFixed(2)}s)`,
                height: 200,
                margin: { t: 30, r: 30, b: 40, l: 50 },
                paper_bgcolor: 'rgba(0,0,0,0)',
                plot_bgcolor: 'rgba(0,0,0,0)',
                font: { color: '#6c757d' },
                xaxis: {
                    title: 'Time (s)',
                    gridcolor: 'rgba(128,128,128,0.2)',
                    linecolor: 'rgba(128,128,128,0.5)',
                    range: [0, duration]
                },
                yaxis: {
                    title: 'Amplitude',
                    gridcolor: 'rgba(128,128,128,0.2)',
                    linecolor: 'rgba(128,128,128,0.5)',
                    range: [-1, 1]
                },
                showlegend: false
            });

            console.log('✅ Output waveform plot updated');

        } catch (error) {
            console.error('Error updating output waveform plot:', error);
        }
    }

    initializeSpectrograms() {
        const inputCtx = document.getElementById('inputSpectrogram').getContext('2d');
        const outputCtx = document.getElementById('outputSpectrogram').getContext('2d');
        
        // Set canvas dimensions
        const width = 400;
        const height = 150;
        
        inputCtx.canvas.width = width;
        inputCtx.canvas.height = height;
        outputCtx.canvas.width = width;
        outputCtx.canvas.height = height;
        
        this.drawPlaceholderSpectrogram(inputCtx, 'Upload audio to see spectrogram');
        this.drawPlaceholderSpectrogram(outputCtx, 'Process audio to see spectrogram');
    }

    drawPlaceholderSpectrogram(ctx, text) {
        const width = ctx.canvas.width;
        const height = ctx.canvas.height;
        
        // Clear canvas
        ctx.fillStyle = 'rgb(248, 249, 250)';
        ctx.fillRect(0, 0, width, height);
        
        // Draw placeholder text
        ctx.fillStyle = 'rgb(119, 119, 119)';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(text, width / 2, height / 2);
    }

    initializeWaveforms() {
        // Initialize WaveSurfer.js for input waveform
        this.inputWaveform = WaveSurfer.create({
            container: '#inputWaveform',
            waveColor: '#6c757d',
            progressColor: '#e03a3c',
            cursorColor: '#e03a3c',
            height: 80,
            barWidth: 2,
            barGap: 1,
            responsive: true,
            normalize: true,
            minPxPerSec: 10
        });

        // Initialize WaveSurfer.js for output waveform
        this.outputWaveform = WaveSurfer.create({
            container: '#outputWaveform',
            waveColor: '#6c757d',
            progressColor: '#28a745',
            cursorColor: '#28a745',
            height: 80,
            barWidth: 2,
            barGap: 1,
            responsive: true,
            normalize: true,
            minPxPerSec: 10
        });

        // Sync the two waveforms
        this.syncWaveforms();

        // Show waveform instructions
        this.showWaveformInstructions();
    }

    syncWaveforms() {
        // Sync zoom level
        this.inputWaveform.on('zoom', (minPxPerSec) => {
            this.outputWaveform.zoom(minPxPerSec);
        });

        // Sync scroll position
        this.inputWaveform.on('scroll', (position) => {
            this.outputWaveform.setScrollPosition(position);
        });

        // Sync time position
        this.inputWaveform.on('timeupdate', (currentTime) => {
            if (Math.abs(this.outputWaveform.getCurrentTime() - currentTime) > 0.1) {
                this.outputWaveform.setTime(currentTime);
            }
        });

        this.outputWaveform.on('timeupdate', (currentTime) => {
            if (Math.abs(this.inputWaveform.getCurrentTime() - currentTime) > 0.1) {
                this.inputWaveform.setTime(currentTime);
            }
        });
    }

    showWaveformInstructions() {
        const inputWaveform = document.getElementById('inputWaveform');
        const outputWaveform = document.getElementById('outputWaveform');
        
        inputWaveform.innerHTML = `
            <div class="waveform-placeholder d-flex align-items-center justify-content-center h-100">
                <div class="text-center">
                    <i class="bi bi-upload display-4 text-muted mb-2"></i>
                    <p class="text-muted mb-0">Upload an audio file to begin</p>
                </div>
            </div>
        `;
        
        outputWaveform.innerHTML = `
            <div class="waveform-placeholder d-flex align-items-center justify-content-center h-100">
                <div class="text-center">
                    <i class="bi bi-sliders display-4 text-muted mb-2"></i>
                    <p class="text-muted mb-0">Processed audio will appear here</p>
                </div>
            </div>
        `;
    }

    addDefaultBands() {
        // Add 4 default frequency bands covering the audio spectrum
        const defaultBands = [
            { startFreq: 20, endFreq: 250, gain: 1.0 },   // Bass
            { startFreq: 250, endFreq: 1000, gain: 1.0 }, // Low Mid
            { startFreq: 1000, endFreq: 4000, gain: 1.0 }, // Mid
            { startFreq: 4000, endFreq: 20000, gain: 1.0 } // High
        ];

        defaultBands.forEach(band => this.addBand(band.startFreq, band.endFreq, band.gain));
    }

    addBand(startFreq = 1000, endFreq = 2000, gain = 1.0) {
        const band = {
            id: Date.now() + Math.random(),
            startFreq: startFreq,
            endFreq: endFreq,
            gain: gain
        };

        this.bands.push(band);
        this.renderBand(band);
        this.updateFrequencyChart();
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
                <div class="control-group">
                    <label>Start Frequency (Hz)</label>
                    <input type="number" class="form-control start-freq" value="${band.startFreq}" min="20" max="19900" step="10">
                </div>
                <div class="control-group">
                    <label>End Frequency (Hz)</label>
                    <input type="number" class="form-control end-freq" value="${band.endFreq}" min="30" max="20000" step="10">
                </div>
                <div class="control-group">
                    <label>Gain (0-2)</label>
                    <input type="range" class="form-range gain" min="0" max="2" step="0.1" value="${band.gain}">
                    <div class="d-flex justify-content-between">
                        <small>0</small>
                        <span class="gain-value fw-bold">${band.gain.toFixed(1)}</span>
                        <small>2</small>
                    </div>
                </div>
            </div>
        `;

        container.appendChild(bandElement);

        // Add event listeners for this band
        this.attachBandEventListeners(bandElement, band.id);
    }

    getBandName(startFreq, endFreq) {
        if (endFreq <= 250) return 'Sub Bass';
        if (endFreq <= 500) return 'Bass';
        if (endFreq <= 1000) return 'Low Mid';
        if (endFreq <= 2000) return 'Mid';
        if (endFreq <= 4000) return 'Upper Mid';
        if (endFreq <= 8000) return 'Presence';
        return 'Brilliance';
    }

    attachBandEventListeners(element, bandId) {
        const band = this.bands.find(b => b.id === bandId);
        
        element.querySelector('.start-freq').addEventListener('input', (e) => {
            band.startFreq = parseInt(e.target.value);
            this.updateFrequencyChart();
        });

        element.querySelector('.end-freq').addEventListener('input', (e) => {
            band.endFreq = parseInt(e.target.value);
            this.updateFrequencyChart();
        });

        element.querySelector('.gain').addEventListener('input', (e) => {
            band.gain = parseFloat(e.target.value);
            element.querySelector('.gain-value').textContent = band.gain.toFixed(1);
            this.updateFrequencyChart();
        });

        element.querySelector('.remove-band').addEventListener('click', () => {
            this.removeBand(bandId);
        });
    }

    removeBand(bandId) {
        this.bands = this.bands.filter(b => b.id !== bandId);
        this.updateBandsDisplay();
        this.updateFrequencyChart();
    }

    updateBandsDisplay() {
        const container = document.getElementById('bandsContainer');
        container.innerHTML = '';
        this.bands.forEach(band => this.renderBand(band));
    }

    updateFrequencyChart() {
        if (!this.frequencyChart || !this.spectrumData) return;

        const frequencies = this.spectrumData.frequencies;
        const inputMagnitude = this.spectrumData.magnitude;
        
        // Calculate equalized spectrum
        const equalizedMagnitude = this.calculateEqualizedSpectrum(frequencies, inputMagnitude);

        // Convert to dB for better visualization
        const inputDB = inputMagnitude.map(mag => 20 * Math.log10(mag + 1e-10));
        const equalizedDB = equalizedMagnitude.map(mag => 20 * Math.log10(mag + 1e-10));

        // Update chart data
        const chartData = frequencies.map((freq, i) => ({ x: freq, y: inputDB[i] }));
        const equalizedData = frequencies.map((freq, i) => ({ x: freq, y: equalizedDB[i] }));

        this.frequencyChart.data.datasets[0].data = chartData;
        this.frequencyChart.data.datasets[1].data = equalizedData;

        // Update scale type
        this.frequencyChart.options.scales.x.type = this.currentScale === 'audiogram' ? 'logarithmic' : 'linear';
        
        this.frequencyChart.update();
    }

    calculateEqualizedSpectrum(frequencies, inputMagnitude) {
        const equalizedMagnitude = [...inputMagnitude];
        
        this.bands.forEach(band => {
            const startFreq = band.startFreq;
            const endFreq = band.endFreq;
            const gain = band.gain;

            frequencies.forEach((freq, i) => {
                if (freq >= startFreq && freq <= endFreq) {
                    equalizedMagnitude[i] *= gain;
                }
            });
        });

        return equalizedMagnitude;
    }

    async handleFileUpload(file) {
        if (!file) return;
        
        // Validate file type
        const allowedTypes = [
            'audio/wav', 'audio/x-wav', 'audio/wave',
            'audio/flac', 'audio/x-flac',
            'audio/mpeg', 'audio/mp3', 'audio/mpeg3',
            'audio/mp4', 'audio/x-m4a',
            'audio/aac', 'audio/aacp',
            'audio/ogg', 'audio/vorbis',
            'audio/x-ms-wma',
            'audio/aiff', 'audio/x-aiff'
        ];
        
        const fileExt = file.name.split('.').pop().toLowerCase();
        const allowedExtensions = ['wav', 'wave', 'flac', 'mp3', 'm4a', 'aac', 'ogg', 'mp4', 'wma', 'aiff', 'aif'];
        
        if (!allowedExtensions.includes(fileExt) && !allowedTypes.includes(file.type)) {
            this.showNotification(
                `Unsupported file type: ${file.type || fileExt}. ` +
                `Supported formats: WAV, FLAC, MP3, M4A, AAC, OGG, AIFF`, 
                'error'
            );
            return;
        }
        
        // Validate file size (50MB limit)
        const maxSize = 50 * 1024 * 1024; // 50MB
        if (file.size > maxSize) {
            this.showNotification(
                `File too large: ${(file.size / (1024 * 1024)).toFixed(1)}MB. ` +
                `Maximum size is 50MB.`, 
                'error'
            );
            return;
        }
        
        this.showNotification(`Loading ${file.name}...`, 'info');
        
        try {
            const url = URL.createObjectURL(file);
            await this.inputWaveform.load(url);
            
            this.currentAudioFile = file;
            document.getElementById('processAudio').disabled = false;
            
            // Show file info
            this.showFileInfo(file);
            
            // Compute and display frequency spectrum
            await this.computeFrequencySpectrum(file);
            
            // Extract audio data for waveform plotting
            await this.extractAudioData(file);
            
            // Update waveform plots
            this.updateWaveformPlots();
            
            this.showNotification(`"${file.name}" loaded successfully!`, 'success');
            
        } catch (error) {
            console.error('Error loading audio file:', error);
            this.showNotification(
                `Error loading "${file.name}". Please try a different file format.`, 
                'error'
            );
        }
    }

    async extractAudioData(file) {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            
            // Get the first channel (mono) or mix down to mono
            const channelData = audioBuffer.getChannelData(0);
            this.audioData = channelData;
            this.sampleRate = audioBuffer.sampleRate;
            
            console.log(`✅ Audio data extracted: ${this.audioData.length} samples at ${this.sampleRate}Hz`);
            
            audioContext.close();
            
        } catch (error) {
            console.error('Error extracting audio data:', error);
            // Fallback: try to get data from wavesurfer
            if (this.inputWaveform && this.inputWaveform.getDecodedData()) {
                const decodedData = this.inputWaveform.getDecodedData();
                this.audioData = decodedData.getChannelData(0);
                this.sampleRate = decodedData.sampleRate;
            }
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
                    <strong>Type:</strong> ${fileExt} (${file.type || 'Unknown'})<br>
                    <strong>Size:</strong> ${sizeMB} MB
                </small>
            </div>
        `;
    }

    async computeFrequencySpectrum(file) {
        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch(`${this.baseURL}/compute_spectrum`, {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                this.spectrumData = await response.json();
                this.updateFrequencyChart();
            } else {
                console.warn('Server spectrum computation failed, using fallback');
                this.computeSpectrumClientSide(file);
            }
        } catch (error) {
            console.error('Error computing spectrum:', error);
            this.computeSpectrumClientSide(file);
        }
    }

    async computeSpectrumClientSide(file) {
        // Simple client-side FFT fallback
        try {
            const arrayBuffer = await file.arrayBuffer();
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            
            const channelData = audioBuffer.getChannelData(0);
            const sampleRate = audioBuffer.sampleRate;
            
            // Simple FFT using Web Audio API AnalyserNode
            const analyser = audioContext.createAnalyser();
            const source = audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(analyser);
            
            analyser.fftSize = 2048;
            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            analyser.getByteFrequencyData(dataArray);
            
            // Convert to frequency data
            const frequencies = Array.from({length: bufferLength}, (_, i) => i * sampleRate / analyser.fftSize);
            const magnitude = Array.from(dataArray, val => val / 255);
            
            this.spectrumData = {
                frequencies: frequencies,
                magnitude: magnitude,
                sample_rate: sampleRate
            };
            
            this.updateFrequencyChart();
            audioContext.close();
            
        } catch (error) {
            console.error('Client-side spectrum computation failed:', error);
        }
    }

    async generateTestSignal() {
        this.showNotification('Generating test signal...', 'info');
        
        try {
            console.log('🎵 Requesting test signal from:', `${this.baseURL}/generate_test_signal`);
            
            const response = await fetch(`${this.baseURL}/generate_test_signal`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    frequencies: [100, 250, 500, 1000, 2000, 4000, 8000],
                    duration: 5.0,
                    sample_rate: 44100,
                    amplitude: 0.8
                })
            });

            if (response.ok) {
                const blob = await response.blob();
                console.log('✅ Test signal received:', blob.size, 'bytes');
                
                if (blob.size === 0) {
                    throw new Error('Empty response from server');
                }
                
                const url = URL.createObjectURL(blob);
                await this.inputWaveform.load(url);
                this.currentAudioFile = blob;
                document.getElementById('processAudio').disabled = false;
                
                // Compute spectrum for test signal
                await this.computeFrequencySpectrum(blob);
                
                // Extract audio data for waveform plotting
                await this.extractAudioData(blob);
                
                // Update waveform plots
                this.updateWaveformPlots();
                
                this.showNotification('Test signal generated successfully!', 'success');
            } else {
                const errorText = await response.text();
                throw new Error(`Server returned ${response.status}: ${errorText}`);
            }
        } catch (error) {
            console.error('❌ Error generating test signal:', error);
            this.showNotification(`Error: ${error.message}`, 'error');
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

        try {
            // Simulate progress
            let progress = 0;
            const progressInterval = setInterval(() => {
                progress += 10;
                progressBar.querySelector('.progress-bar').style.width = `${progress}%`;
                if (progress >= 90) clearInterval(progressInterval);
            }, 100);

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
                const url = URL.createObjectURL(blob);
                await this.outputWaveform.load(url);
                
                // Extract processed audio data for waveform plotting
                const processedArrayBuffer = await blob.arrayBuffer();
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const processedAudioBuffer = await audioContext.decodeAudioData(processedArrayBuffer);
                const processedAudioData = processedAudioBuffer.getChannelData(0);
                
                this.updateOutputWaveformPlot(processedAudioData, processedAudioBuffer.sampleRate);
                
                audioContext.close();
                
                progressBar.querySelector('.progress-bar').style.width = '100%';
                setTimeout(() => {
                    progressBar.style.display = 'none';
                    progressBar.querySelector('.progress-bar').style.width = '0%';
                }, 500);
                
                this.showNotification('Audio processed successfully!', 'success');
                
                // Update output spectrogram
                this.updateOutputSpectrogram();
                
            } else {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
        } catch (error) {
            console.error('Error processing audio:', error);
            this.showNotification('Error processing audio. Please try again.', 'error');
        } finally {
            processButton.disabled = false;
            progressBar.style.display = 'none';
            progressBar.querySelector('.progress-bar').style.width = '0%';
        }
    }

    updateOutputSpectrogram() {
        const ctx = document.getElementById('outputSpectrogram').getContext('2d');
        this.drawPlaceholderSpectrogram(ctx, 'Output spectrogram - Processing complete');
    }

    async loadPresetsList() {
        try {
            const url = `${this.baseURL}/list_presets`;
            console.log('📡 Loading presets from:', url);
            
            const response = await fetch(url);
            
            if (response.ok) {
                const data = await response.json();
                console.log('📋 Presets response:', data);
                
                const presetList = document.getElementById('presetList');
                
                presetList.innerHTML = '<option value="">Select a preset...</option>';
                
                if (data.presets && data.presets.length > 0) {
                    data.presets.forEach(preset => {
                        const option = document.createElement('option');
                        // Handle both string and object formats
                        if (typeof preset === 'string') {
                            option.value = preset;
                            option.textContent = preset;
                        } else {
                            option.value = preset.name;
                            option.textContent = preset.name;
                        }
                        presetList.appendChild(option);
                    });
                    
                    this.showNotification(`Loaded ${data.presets.length} presets`, 'success');
                } else {
                    console.log('📝 No presets found');
                }
            } else {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
        } catch (error) {
            console.error('❌ Error loading presets list:', error);
            this.showNotification('Could not load presets. Check backend connection.', 'error');
        }
    }

    togglePresetList() {
        const container = document.getElementById('presetListContainer');
        container.style.display = container.style.display === 'none' ? 'block' : 'block';
    }

    async loadPreset(presetName) {
        try {
            console.log(`📥 Loading preset: ${presetName}`);
            const response = await fetch(`${this.baseURL}/load_preset?name=${encodeURIComponent(presetName)}`);
            
            if (response.ok) {
                const preset = await response.json();
                console.log('✅ Preset loaded:', preset);
                
                if (preset.bands && Array.isArray(preset.bands)) {
                    this.bands = preset.bands;
                    this.updateBandsDisplay();
                    this.updateFrequencyChart();
                    this.showNotification(`Preset "${presetName}" loaded!`, 'success');
                    
                    // Hide preset list after selection
                    const container = document.getElementById('presetListContainer');
                    container.style.display = 'none';
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
        const presetName = prompt('Enter preset name:');
        if (!presetName) return;

        try {
            const response = await fetch(`${this.baseURL}/save_preset`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: presetName,
                    bands: this.bands,
                    description: `Custom equalizer preset with ${this.bands.length} bands`
                })
            });

            if (response.ok) {
                const result = await response.json();
                console.log('✅ Preset saved:', result);
                this.showNotification('Preset saved successfully!', 'success');
                this.loadPresetsList(); // Reload the list
            } else {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
        } catch (error) {
            console.error('❌ Error saving preset:', error);
            this.showNotification('Failed to save preset', 'error');
        }
    }

    // Player control methods
    playInput() {
        if (this.inputWaveform) {
            this.inputWaveform.play();
        }
    }

    pauseInput() {
        if (this.inputWaveform) {
            this.inputWaveform.pause();
        }
    }

    stopInput() {
        if (this.inputWaveform) {
            this.inputWaveform.stop();
        }
    }

    playOutput() {
        if (this.outputWaveform) {
            this.outputWaveform.play();
        }
    }

    pauseOutput() {
        if (this.outputWaveform) {
            this.outputWaveform.pause();
        }
    }

    stopOutput() {
        if (this.outputWaveform) {
            this.outputWaveform.stop();
        }
    }

    // Zoom control methods
    zoomInInput() {
        if (this.inputWaveform) {
            const currentZoom = this.inputWaveform.getZoom();
            this.inputWaveform.zoom(currentZoom * 1.5);
        }
    }

    zoomOutInput() {
        if (this.inputWaveform) {
            const currentZoom = this.inputWaveform.getZoom();
            this.inputWaveform.zoom(currentZoom / 1.5);
        }
    }

    resetViewInput() {
        if (this.inputWaveform) {
            this.inputWaveform.zoom(1);
            this.inputWaveform.setTime(0);
        }
    }

    zoomInOutput() {
        if (this.outputWaveform) {
            const currentZoom = this.outputWaveform.getZoom();
            this.outputWaveform.zoom(currentZoom * 1.5);
        }
    }

    zoomOutOutput() {
        if (this.outputWaveform) {
            const currentZoom = this.outputWaveform.getZoom();
            this.outputWaveform.zoom(currentZoom / 1.5);
        }
    }

    resetViewOutput() {
        if (this.outputWaveform) {
            this.outputWaveform.zoom(1);
            this.outputWaveform.setTime(0);
        }
    }

    resetGraph() {
        this.frequencyChart.resetZoom();
    }

    exportAudio() {
        if (this.outputWaveform.getDuration() > 0) {
            this.showNotification('Export feature would download the processed audio file.', 'info');
            // In a real implementation, this would trigger download of the processed audio
        } else {
            this.showNotification('No processed audio available for export.', 'error');
        }
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
    const equalizer = new GenericEqualizer();
    equalizer.initializeApp();
    
    // Make it globally available for debugging
    window.equalizer = equalizer;
    
    console.log('✅ Generic Equalizer started successfully!');
});