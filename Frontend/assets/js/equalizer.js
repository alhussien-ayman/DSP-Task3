class EqualizerApp {
    constructor() {
        this.currentMode = 'instruments';
        this.currentAudio = null;
        this.sliderValues = [];
        this.slidersConfig = [];
        this.charts = {};
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadCurrentMode();
    }

    setupEventListeners() {
        // Mode selector
        document.getElementById('modeSelector').addEventListener('change', (e) => {
            this.currentMode = e.target.value;
            this.loadCurrentMode();
        });

        // Audio file upload
        document.getElementById('audioFile').addEventListener('change', (e) => {
            this.handleFileUpload(e.target.files[0]);
        });

        // Test signal
        document.getElementById('generateTestBtn').addEventListener('click', () => {
            this.generateTestSignal();
        });

        // Scale selector
        document.getElementById('scaleSelector').addEventListener('change', () => {
            if (this.currentAudio) {
                this.processAudio();
            }
        });

        // Settings upload
        document.getElementById('uploadSettingsBtn').addEventListener('click', () => {
            document.getElementById('settingsFile').click();
        });

        document.getElementById('settingsFile').addEventListener('change', (e) => {
            this.uploadSettingsFile(e.target.files[0]);
        });

        // Download settings
        document.getElementById('downloadSettingsBtn').addEventListener('click', () => {
            this.downloadCurrentSettings();
        });
    }

    async loadCurrentMode() {
        try {
            // Update UI
            this.updateModeTitle();
            
            // Load settings for current mode - DYNAMIC URL
            const response = await fetch(`/api/customized/${this.currentMode}/settings`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const settings = await response.json();
            
            this.slidersConfig = settings.sliders;
            this.sliderValues = new Array(settings.sliders.length).fill(1.0);
            
            this.createSliders();
            
        } catch (error) {
            console.error('Error loading mode:', error);
            document.getElementById('slidersContainer').innerHTML = 
                '<div class="alert alert-danger">Error loading mode settings. Please try again.</div>';
        }
    }

    updateModeTitle() {
        const modeTitles = {
            'instruments': '🎵 Musical Instruments Mode',
            'animals': '🐾 Animal Sounds Mode', 
            'voices': '🎤 Human Voices Mode'
        };
        document.getElementById('currentMode').textContent = modeTitles[this.currentMode];
    }

    getIconForSlider(sliderName) {
        const icons = {
            // Instruments
            'Guitar': '🎸', 'Piano': '🎹', 'Flute': '🎵', 'Triangle': '🔺',
            // Animals
            'Cat': '🐱', 'Cow': '🐮', 'Dog': '🐶', 'Sheep': '🐑',
            // Voices
            'Male Voice': '👨', 'Female Voice': '👩', 'Child Voice': '👦', 'Elderly Voice': '👴'
        };
        return icons[sliderName] || '🎛️';
    }

    createSliders() {
        const container = document.getElementById('slidersContainer');
        container.innerHTML = '';

        if (this.slidersConfig.length === 0) {
            container.innerHTML = '<div class="alert alert-warning">No sliders configured for this mode.</div>';
            return;
        }

        this.slidersConfig.forEach((slider, index) => {
            const sliderDiv = document.createElement('div');
            sliderDiv.className = 'slider-container';
            
            const icon = this.getIconForSlider(slider.name);
            const bandsInfo = slider.frequency_bands.map(band => 
                `${band[0]}-${band[1]}Hz`
            ).join(', ');
            
            sliderDiv.innerHTML = `
                <label class="form-label">
                    <span class="animal-icon">${icon}</span>
                    <strong>${slider.name}</strong>
                </label>
                <div class="frequency-bands">Frequency ranges: ${bandsInfo}</div>
                <input type="range" class="form-range equalizer-slider" 
                       min="0" max="2" step="0.01" value="1.0"
                       data-index="${index}">
                <div class="slider-value">100%</div>
                ${slider.description ? `<div class="slider-description text-muted small">${slider.description}</div>` : ''}
            `;
            
            container.appendChild(sliderDiv);

            // Add event listener
            const sliderElement = sliderDiv.querySelector('.equalizer-slider');
            const valueDisplay = sliderDiv.querySelector('.slider-value');
            
            sliderElement.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                this.sliderValues[index] = value;
                const percentage = Math.round(value * 100);
                
                // Color coding
                let colorClass = '';
                if (value === 0) colorClass = 'text-danger';
                else if (value < 1) colorClass = 'text-warning';
                else if (value > 1) colorClass = 'text-success';
                
                valueDisplay.textContent = `${percentage}%`;
                valueDisplay.className = `slider-value ${colorClass}`;
                
                if (this.currentAudio) {
                    this.processAudio();
                }
            });
        });
    }

    async handleFileUpload(file) {
        if (!file) return;
        
        // Show loading state
        const container = document.getElementById('slidersContainer');
        const originalContent = container.innerHTML;
        container.innerHTML = '<div class="alert alert-info">Processing audio file...</div>';
        
        this.currentAudio = file;
        await this.processAudio();
        
        // Restore sliders
        this.createSliders();
    }

    async processAudio() {
        if (!this.currentAudio) return;

        const formData = new FormData();
        formData.append('file', this.currentAudio);
        formData.append('sliders', JSON.stringify(this.sliderValues));
        formData.append('scale', document.getElementById('scaleSelector').value);

        try {
            // DYNAMIC URL for processing
            const response = await fetch(`/api/customized/${this.currentMode}/process`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            
            if (result.success) {
                this.updateVisualizations(result);
            } else {
                console.error('Processing failed:', result.error);
                this.showError('Error processing audio: ' + result.error);
            }
        } catch (error) {
            console.error('Error processing audio:', error);
            this.showError('Network error processing audio: ' + error.message);
        }
    }

    updateVisualizations(data) {
        // Update waveforms
        this.updateWaveform('inputWaveform', data.input_signal, 'Input Signal');
        this.updateWaveform('outputWaveform', data.output_signal, 'Output Signal');
        
        // Update spectrograms
        this.updateSpectrogram('inputSpectrogram', data.input_spectrogram, 'Input Spectrogram');
        this.updateSpectrogram('outputSpectrogram', data.output_spectrogram, 'Output Spectrogram');
    }

    updateWaveform(canvasId, signalData, title) {
        const ctx = document.getElementById(canvasId).getContext('2d');
        
        if (this.charts[canvasId]) {
            this.charts[canvasId].destroy();
        }

        this.charts[canvasId] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: signalData.time,
                datasets: [{
                    label: title,
                    data: signalData.amplitude,
                    borderColor: 'rgb(75, 192, 192)',
                    borderWidth: 1,
                    tension: 0.1,
                    pointRadius: 0,
                    fill: true,
                    backgroundColor: 'rgba(75, 192, 192, 0.1)'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { 
                        title: { display: true, text: 'Time (s)' },
                        grid: { display: false }
                    },
                    y: { 
                        title: { display: true, text: 'Amplitude' },
                        min: -1,
                        max: 1
                    }
                },
                plugins: {
                    legend: { display: true }
                }
            }
        });
    }

    updateSpectrogram(canvasId, spectrogramData, title) {
        const ctx = document.getElementById(canvasId).getContext('2d');
        
        if (this.charts[canvasId]) {
            this.charts[canvasId].destroy();
        }

        const frequencies = spectrogramData.frequencies || [];
        const magnitudes = spectrogramData.magnitudes || [];
        
        if (frequencies.length === 0 || magnitudes.length === 0) {
            return;
        }

        // Create heatmap data
        const data = {
            labels: Array.from({length: magnitudes[0].length}, (_, i) => i),
            datasets: [{
                label: title,
                data: this.prepareSpectrogramData(magnitudes),
                backgroundColor: this.createHeatmapGradient(ctx),
                borderWidth: 0
            }]
        };

        this.charts[canvasId] = new Chart(ctx, {
            type: 'scatter',
            data: data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { 
                        title: { display: true, text: 'Time Frame' },
                        grid: { display: false }
                    },
                    y: { 
                        title: { display: true, text: 'Frequency Bin' },
                        reverse: true
                    }
                },
                plugins: {
                    legend: { display: true }
                }
            }
        });
    }

    createHeatmapGradient(ctx) {
        const gradient = ctx.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, 'rgba(255, 0, 0, 0.8)');     // Red - high intensity
        gradient.addColorStop(0.5, 'rgba(255, 255, 0, 0.6)'); // Yellow - medium
        gradient.addColorStop(1, 'rgba(0, 0, 255, 0.4)');     // Blue - low intensity
        return gradient;
    }

    prepareSpectrogramData(magnitudes) {
        const data = [];
        // Sample data for performance
        for (let y = 0; y < magnitudes.length; y += 5) {
            for (let x = 0; x < magnitudes[y].length; x += 5) {
                if (magnitudes[y][x] > 0.05) { // Threshold to reduce noise
                    data.push({
                        x: x,
                        y: y,
                        v: magnitudes[y][x]
                    });
                }
            }
        }
        return data;
    }

    async generateTestSignal() {
        try {
            const frequencies = {
                'instruments': [220, 440, 880, 1760],
                'animals': [500, 1000, 2000, 4000],
                'voices': [250, 500, 1000, 2000]
            };

            const response = await fetch('/api/generate_test_signal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    frequencies: frequencies[this.currentMode] || [100, 500, 1000, 2000],
                    duration: 3.0
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const blob = await response.blob();
            const file = new File([blob], `test_signal_${this.currentMode}.wav`, { type: 'audio/wav' });
            this.currentAudio = file;
            await this.processAudio();
            
        } catch (error) {
            console.error('Error generating test signal:', error);
            this.showError('Error generating test signal: ' + error.message);
        }
    }

    async uploadSettingsFile(file) {
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);
        formData.append('mode', this.currentMode);

        try {
            const response = await fetch('/api/upload_settings', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            
            if (result.success) {
                this.showSuccess('Settings updated successfully!');
                // Reload the current mode to get new settings
                this.loadCurrentMode();
            } else {
                this.showError('Error updating settings: ' + result.error);
            }
        } catch (error) {
            console.error('Error uploading settings:', error);
            this.showError('Error uploading settings file: ' + error.message);
        }
    }

    downloadCurrentSettings() {
        // Create a JSON blob and download it
        const settings = { sliders: this.slidersConfig };
        const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.currentMode}_settings.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showSuccess(`Settings for ${this.currentMode} downloaded!`);
    }

    showError(message) {
        this.showNotification(message, 'danger');
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showNotification(message, type) {
        // Remove existing notifications
        const existingAlert = document.querySelector('.alert-toast');
        if (existingAlert) {
            existingAlert.remove();
        }

        const alert = document.createElement('div');
        alert.className = `alert alert-${type} alert-toast position-fixed`;
        alert.style.cssText = 'top: 20px; right: 20px; z-index: 1050; min-width: 300px;';
        alert.innerHTML = `
            <strong>${type === 'danger' ? '❌ Error' : '✅ Success'}</strong>
            <div>${message}</div>
        `;
        
        document.body.appendChild(alert);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (alert.parentNode) {
                alert.remove();
            }
        }, 5000);
    }
}

// Initialize the app when page loads
document.addEventListener('DOMContentContentLoaded', () => {
    window.equalizerApp = new EqualizerApp();
});