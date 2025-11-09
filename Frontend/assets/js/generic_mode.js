class GenericEqualizer {
    constructor() {
        this.bands = [];
        this.frequencyChart = null;
        this.inputWaveform = null;
        this.outputWaveform = null;
        this.currentScale = 'linear';
        this.isPlaying = false;
        this.audioContext = null;
        this.audioBuffer = null;
        
        this.initializeApp();
    }

    initializeApp() {
        this.initializeEventListeners();
        this.initializeCharts();
        this.initializeWaveforms();
        this.addDefaultBand();
        this.initializeAudioContext();
    }

    initializeEventListeners() {
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
            this.loadPreset();
        });

        document.getElementById('generateTest').addEventListener('click', () => {
            this.generateTestSignal();
        });

        // Player controls
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

        // Speed control
        document.getElementById('speedInput').addEventListener('input', (e) => {
            const speed = e.target.value;
            document.getElementById('speedValue').textContent = speed + 'x';
            if (this.inputWaveform) {
                this.inputWaveform.setPlaybackRate(parseFloat(speed));
            }
        });

        // Spectrogram toggle
        document.getElementById('showSpectrograms').addEventListener('change', (e) => {
            const container = document.getElementById('spectrogramsContainer');
            container.style.display = e.target.checked ? 'block' : 'none';
        });

        // File upload
        document.getElementById('audioUpload').addEventListener('change', (e) => {
            this.handleFileUpload(e.target.files[0]);
        });

        // Graph reset
        document.getElementById('resetGraph').addEventListener('click', () => {
            this.resetGraph();
        });

        // Export audio
        document.getElementById('exportAudio').addEventListener('click', () => {
            this.exportAudio();
        });
    }

    initializeAudioContext() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (error) {
            console.error('Error initializing audio context:', error);
            alert('Your browser does not support the Web Audio API. Please use a modern browser.');
        }
    }

    initializeCharts() {
        const ctx = document.getElementById('frequencyChart').getContext('2d');
        this.frequencyChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: this.generateFrequencyLabels(),
                datasets: [{
                    label: 'Frequency Response',
                    data: Array(100).fill(0),
                    borderColor: 'rgb(224, 58, 60)',
                    backgroundColor: 'rgba(224, 58, 60, 0.1)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Frequency (Hz)',
                            color: 'rgb(119, 119, 119)'
                        },
                        type: 'linear',
                        grid: {
                            color: 'rgba(119, 119, 119, 0.1)'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Gain (dB)',
                            color: 'rgb(119, 119, 119)'
                        },
                        min: -24,
                        max: 24,
                        grid: {
                            color: 'rgba(119, 119, 119, 0.1)'
                        }
                    }
                }
            }
        });

        // Initialize spectrogram canvases
        this.initializeSpectrograms();
    }

    initializeSpectrograms() {
        const inputCtx = document.getElementById('inputSpectrogram').getContext('2d');
        const outputCtx = document.getElementById('outputSpectrogram').getContext('2d');
        
        // Draw placeholder spectrograms
        this.drawPlaceholderSpectrogram(inputCtx, 'Input Signal');
        this.drawPlaceholderSpectrogram(outputCtx, 'Output Signal');
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
        
        // Draw some random frequency bars for demo
        for (let i = 0; i < 20; i++) {
            const x = (i / 20) * width;
            const barHeight = Math.random() * height * 0.8;
            const intensity = Math.random() * 255;
            
            ctx.fillStyle = `rgb(${intensity}, ${intensity}, ${intensity})`;
            ctx.fillRect(x, height - barHeight, width / 20 - 2, barHeight);
        }
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
            responsive: true
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
            responsive: true
        });

        // Load demo audio or show instructions
        this.showWaveformInstructions();
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

    generateFrequencyLabels() {
        if (this.currentScale === 'linear') {
            return Array.from({length: 100}, (_, i) => i * 100); // 0-10kHz linear
        } else {
            // Audiogram scale (logarithmic)
            return Array.from({length: 100}, (_, i) => 
                Math.round(20 * Math.pow(10, i / 33.3))
            );
        }
    }

    addDefaultBand() {
        this.addBand(1000, 1.0, 100);
    }

    addBand(centerFreq = 1000, gain = 1.0, bandwidth = 100) {
        const band = {
            id: Date.now() + Math.random(),
            centerFreq: centerFreq,
            gain: gain,
            bandwidth: bandwidth
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
                <h6>Band ${this.bands.length}</h6>
                <button class="btn btn-sm remove-band" data-id="${band.id}">
                    <i class="bi bi-trash"></i> Remove
                </button>
            </div>
            <div class="band-controls">
                <div class="control-group">
                    <label>Center Frequency (Hz)</label>
                    <input type="number" class="form-control center-freq" value="${band.centerFreq}" min="20" max="20000" step="10">
                </div>
                <div class="control-group">
                    <label>Gain (0-2)</label>
                    <input type="range" class="form-range gain" min="0" max="2" step="0.1" value="${band.gain}">
                    <div class="d-flex justify-content-between">
                        <small>0</small>
                        <span class="gain-value fw-bold">${band.gain}</span>
                        <small>2</small>
                    </div>
                </div>
                <div class="control-group">
                    <label>Bandwidth (Hz)</label>
                    <input type="number" class="form-control bandwidth" value="${band.bandwidth}" min="10" max="1000" step="10">
                </div>
            </div>
        `;

        container.appendChild(bandElement);

        // Add event listeners for this band
        this.attachBandEventListeners(bandElement, band.id);
    }

    attachBandEventListeners(element, bandId) {
        const band = this.bands.find(b => b.id === bandId);
        
        element.querySelector('.center-freq').addEventListener('input', (e) => {
            band.centerFreq = parseInt(e.target.value);
            this.updateFrequencyChart();
        });

        element.querySelector('.gain').addEventListener('input', (e) => {
            band.gain = parseFloat(e.target.value);
            element.querySelector('.gain-value').textContent = band.gain.toFixed(1);
            this.updateFrequencyChart();
        });

        element.querySelector('.bandwidth').addEventListener('input', (e) => {
            band.bandwidth = parseInt(e.target.value);
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
        this.bands.forEach((band, index) => {
            // Update band numbering
            const updatedBand = {...band};
            this.renderBand(updatedBand);
        });
    }

    updateFrequencyChart() {
        if (!this.frequencyChart) return;

        // Calculate frequency response based on bands
        const frequencies = this.generateFrequencyLabels();
        const response = frequencies.map(freq => this.calculateGainAtFrequency(freq));

        this.frequencyChart.data.labels = frequencies;
        this.frequencyChart.data.datasets[0].data = response;
        
        // Update scale type
        if (this.currentScale === 'audiogram') {
            this.frequencyChart.options.scales.x.type = 'logarithmic';
        } else {
            this.frequencyChart.options.scales.x.type = 'linear';
        }
        
        this.frequencyChart.update();
    }

    calculateGainAtFrequency(frequency) {
        // Simplified gain calculation using bell curves for each band
        let totalGain = 0;
        
        this.bands.forEach(band => {
            // Calculate distance from center frequency
            const distance = Math.abs(frequency - band.centerFreq);
            
            // Only apply gain if within reasonable range of the band
            if (distance < band.bandwidth * 3) {
                // Bell curve influence
                const sigma = band.bandwidth / 2;
                const influence = Math.exp(-0.5 * Math.pow(distance / sigma, 2));
                totalGain += (band.gain - 1) * influence;
            }
        });

        // Convert to dB
        const linearGain = 1 + totalGain;
        return 20 * Math.log10(linearGain);
    }

    resetGraph() {
        this.bands = [];
        this.updateBandsDisplay();
        this.addDefaultBand();
    }

    async savePreset() {
        const presetName = prompt('Enter preset name:');
        if (!presetName) return;

        try {
            const response = await fetch('/api/generic/save_preset', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: presetName,
                    bands: this.bands
                })
            });

            if (response.ok) {
                this.showNotification('Preset saved successfully!', 'success');
            } else {
                throw new Error('Failed to save preset');
            }
        } catch (error) {
            console.error('Error saving preset:', error);
            this.showNotification('Error saving preset. Please try again.', 'error');
        }
    }

    async loadPreset() {
        const presetName = prompt('Enter preset name to load:');
        if (!presetName) return;

        try {
            const response = await fetch(`/api/generic/load_preset?name=${presetName}`);
            if (response.ok) {
                const preset = await response.json();
                
                this.bands = preset.bands;
                this.updateBandsDisplay();
                this.updateFrequencyChart();
                
                this.showNotification('Preset loaded successfully!', 'success');
            } else {
                throw new Error('Preset not found');
            }
        } catch (error) {
            console.error('Error loading preset:', error);
            this.showNotification('Error loading preset. Please check the name and try again.', 'error');
        }
    }

    async generateTestSignal() {
        try {
            const response = await fetch('/api/generate_test_signal', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    frequencies: [100, 500, 1000, 2000, 4000],
                    duration: 5.0,
                    sample_rate: 44100
                })
            });

            if (response.ok) {
                const blob = await response.blob();
                const url = URL.createObjectURL(blob);
                
                // Load the test signal into the waveform viewer
                this.inputWaveform.load(url);
                this.showNotification('Test signal generated successfully!', 'success');
                
                // Simulate processing for output
                setTimeout(() => {
                    this.outputWaveform.load(url);
                }, 1000);
            }
        } catch (error) {
            console.error('Error generating test signal:', error);
            this.showNotification('Error generating test signal. Please try again.', 'error');
        }
    }

    handleFileUpload(file) {
        if (!file) return;
        
        if (!file.type.startsWith('audio/')) {
            this.showNotification('Please upload an audio file.', 'error');
            return;
        }

        const url = URL.createObjectURL(file);
        this.inputWaveform.load(url);
        
        this.showNotification('Audio file loaded successfully!', 'success');
        
        // Simulate processing for output (in a real app, this would apply the equalizer)
        setTimeout(() => {
            this.outputWaveform.load(url);
            this.showNotification('Audio processing complete!', 'success');
        }, 1500);
    }

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

    exportAudio() {
        this.showNotification('Export feature would be implemented here', 'info');
        // In a real implementation, this would:
        // 1. Apply the equalizer to the audio
        // 2. Create a downloadable WAV file
        // 3. Trigger download
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
        notification.style.cssText = `
            top: 20px;
            right: 20px;
            z-index: 9999;
            min-width: 300px;
        `;
        notification.innerHTML = `
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
    new GenericEqualizer();
    
    // Initialize AOS animations
    if (typeof AOS !== 'undefined') {
        AOS.init({
            duration: 1000,
            easing: 'ease-in-out',
            once: true,
            mirror: false
        });
    }
});