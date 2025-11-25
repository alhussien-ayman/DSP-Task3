/**
 * AI Mode - Music and Voice Separation with Gain Control and Frequency Plotting
 */

const API_BASE = 'http://localhost:5000/api/ai';

class AISeparationController {
    constructor() {
        this.currentStems = {};
        this.currentVoices = {};
        this.sampleRate = 44100;
        this.init();
    }
    
    init() {
        console.log('🎵 AI Separation Controller initialized');
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        const musicSeparateBtn = document.getElementById('musicSeparateBtn');
        if (musicSeparateBtn) {
            musicSeparateBtn.addEventListener('click', () => this.separateMusic());
        }
        
        const voiceSeparateBtn = document.getElementById('voiceSeparateBtn');
        if (voiceSeparateBtn) {
            voiceSeparateBtn.addEventListener('click', () => this.separateVoices());
        }
    }
    
    async separateMusic() {
        const fileInput = document.getElementById('musicUpload');
        const statusDiv = document.getElementById('musicStatus');
        const resultsDiv = document.getElementById('musicResults');
        
        if (!fileInput || !fileInput.files || !fileInput.files[0]) {
            this.showError(statusDiv, 'Please select an audio file first');
            return;
        }
        
        const file = fileInput.files[0];
        
        try {
            this.showLoading(statusDiv, 'Separating music into stems... This may take a few minutes.');
            resultsDiv.innerHTML = '<div class="empty-state"><i class="bi bi-hourglass-split"></i><p class="mt-3">Processing...</p></div>';
            
            const formData = new FormData();
            formData.append('audio', file);
            formData.append('model_name', 'htdemucs_6s');
            
            const response = await fetch(`${API_BASE}/music_separation`, {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error || 'Separation failed');
            }
            
            this.currentStems = data.stems;
            this.sampleRate = data.sample_rate;
            
            this.showSuccess(statusDiv, data.message);
            this.displayMusicResults(data.stems, data.sample_rate);
            
        } catch (error) {
            console.error('Music separation error:', error);
            this.showError(statusDiv, error.message);
            resultsDiv.innerHTML = '<div class="empty-state"><i class="bi bi-x-circle text-danger"></i><p class="mt-3 text-danger">Separation failed</p></div>';
        }
    }
    
    async separateVoices() {
        const fileInput = document.getElementById('voiceUpload');
        const statusDiv = document.getElementById('voiceStatus');
        const resultsDiv = document.getElementById('voiceResults');
        
        if (!fileInput || !fileInput.files || !fileInput.files[0]) {
            this.showError(statusDiv, 'Please select an audio file first');
            return;
        }
        
        const file = fileInput.files[0];
        
        try {
            this.showLoading(statusDiv, 'Separating voices... This may take a few minutes.');
            resultsDiv.innerHTML = '<div class="empty-state"><i class="bi bi-hourglass-split"></i><p class="mt-3">Processing...</p></div>';
            
            const formData = new FormData();
            formData.append('audio', file);
            
            const response = await fetch(`${API_BASE}/voice_separation`, {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error || 'Separation failed');
            }
            
            this.currentVoices = data.voices;
            this.sampleRate = data.sample_rate;
            
            this.showSuccess(statusDiv, data.message);
            this.displayVoiceResults(data.voices, data.sample_rate);
            
        } catch (error) {
            console.error('Voice separation error:', error);
            this.showError(statusDiv, error.message);
            resultsDiv.innerHTML = '<div class="empty-state"><i class="bi bi-x-circle text-danger"></i><p class="mt-3 text-danger">Separation failed</p></div>';
        }
    }
    
    displayMusicResults(stems, sampleRate) {
        const resultsDiv = document.getElementById('musicResults');
        
        const stemNames = ['drums', 'bass', 'vocals', 'guitar', 'piano', 'other'];
        const stemLabels = {
            'drums': '🥁 Drums',
            'bass': '🎸 Bass',
            'vocals': '🎤 Vocals',
            'guitar': '🎸 Guitar',
            'piano': '🎹 Piano',
            'other': '🎵 Other'
        };
        
        let html = '<div class="stems-container">';
        html += '<h4 class="mb-4" style="color: var(--heading-color); font-weight: 600;">🎼 Separated Stems</h4>';
        html += '<p class="text-muted mb-4">Control individual stem volumes with the sliders below</p>';
        html += '<div class="row">';
        
        stemNames.forEach(stemName => {
            if (stems[stemName]) {
                html += `
                    <div class="col-md-6 mb-3">
                        <div class="stem-card">
                            <div class="stem-header">
                                <h5>${stemLabels[stemName]}</h5>
                                <span class="gain-value" id="${stemName}-gain-value">100%</span>
                            </div>
                            <audio controls class="w-100 mb-2" src="${stems[stemName]}"></audio>
                            <div class="gain-control">
                                <label><i class="bi bi-volume-up"></i></label>
                                <input type="range" 
                                       class="form-range stem-gain-slider" 
                                       min="0" 
                                       max="100" 
                                       value="100" 
                                       data-stem="${stemName}"
                                       id="${stemName}-gain">
                            </div>
                        </div>
                    </div>
                `;
            }
        });
        
        html += '</div>';
        
        html += `
            <div class="mt-4 text-center">
                <button class="btn btn-primary btn-lg" id="mixStemsBtn">
                    <i class="bi bi-soundwave"></i> Mix All Stems with Current Gains
                </button>
            </div>
            <div id="mixedAudioContainer" class="mt-4"></div>
        `;
        
        html += '</div>';
        
        resultsDiv.innerHTML = html;
        
        document.querySelectorAll('.stem-gain-slider').forEach(slider => {
            slider.addEventListener('input', (e) => {
                const stemName = e.target.dataset.stem;
                const value = e.target.value;
                document.getElementById(`${stemName}-gain-value`).textContent = `${value}%`;
            });
        });
        
        const mixBtn = document.getElementById('mixStemsBtn');
        if (mixBtn) {
            mixBtn.addEventListener('click', () => this.mixStems());
        }
    }
    
    displayVoiceResults(voices, sampleRate) {
        const resultsDiv = document.getElementById('voiceResults');
        
        const voiceLabels = {
            'voice_1': '🎤 Speaker 1',
            'voice_2': '🎤 Speaker 2',
            'voice_3': '🎤 Speaker 3',
            'voice_4': '🎤 Speaker 4'
        };
        
        let html = '<div class="voices-container">';
        html += '<h4 class="mb-4" style="color: var(--heading-color); font-weight: 600;">🗣️ Separated Voices</h4>';
        html += '<p class="text-muted mb-4">Control individual speaker volumes with the sliders below</p>';
        html += '<div class="row">';
        
        Object.keys(voiceLabels).forEach(voiceKey => {
            if (voices[voiceKey]) {
                html += `
                    <div class="col-md-6 mb-3">
                        <div class="stem-card">
                            <div class="stem-header">
                                <h5>${voiceLabels[voiceKey]}</h5>
                                <span class="gain-value" id="${voiceKey}-gain-value">100%</span>
                            </div>
                            <audio controls class="w-100 mb-2" src="${voices[voiceKey]}"></audio>
                            <div class="gain-control">
                                <label><i class="bi bi-volume-up"></i></label>
                                <input type="range" 
                                       class="form-range voice-gain-slider" 
                                       min="0" 
                                       max="100" 
                                       value="100" 
                                       data-voice="${voiceKey}"
                                       id="${voiceKey}-gain">
                            </div>
                        </div>
                    </div>
                `;
            }
        });
        
        html += '</div>';
        
        html += `
            <div class="mt-4 text-center">
                <button class="btn btn-primary btn-lg" id="mixVoicesBtn">
                    <i class="bi bi-soundwave"></i> Mix All Voices with Current Gains
                </button>
            </div>
            <div id="mixedVoiceContainer" class="mt-4"></div>
        `;
        
        html += '</div>';
        
        resultsDiv.innerHTML = html;
        
        document.querySelectorAll('.voice-gain-slider').forEach(slider => {
            slider.addEventListener('input', (e) => {
                const voiceKey = e.target.dataset.voice;
                const value = e.target.value;
                document.getElementById(`${voiceKey}-gain-value`).textContent = `${value}%`;
            });
        });
        
        const mixBtn = document.getElementById('mixVoicesBtn');
        if (mixBtn) {
            mixBtn.addEventListener('click', () => this.mixVoices());
        }
    }
    
    async mixStems() {
        try {
            const statusDiv = document.getElementById('musicStatus');
            this.showLoading(statusDiv, 'Mixing stems with current gain levels...');
            
            const gains = {};
            document.querySelectorAll('.stem-gain-slider').forEach(slider => {
                const stemName = slider.dataset.stem;
                gains[stemName] = parseFloat(slider.value) / 100;
            });
            
            const response = await fetch(`${API_BASE}/mix_stems`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    stems: this.currentStems,
                    gains: gains,
                    sample_rate: this.sampleRate
                })
            });
            
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error || 'Mixing failed');
            }
            
            this.displayMixedResult(data, 'mixedAudioContainer');
            this.showSuccess(statusDiv, 'Stems mixed successfully!');
            
        } catch (error) {
            console.error('Mix error:', error);
            this.showError(document.getElementById('musicStatus'), error.message);
        }
    }
    
    async mixVoices() {
        try {
            const statusDiv = document.getElementById('voiceStatus');
            this.showLoading(statusDiv, 'Mixing voices with current gain levels...');
            
            const gains = {};
            document.querySelectorAll('.voice-gain-slider').forEach(slider => {
                const voiceKey = slider.dataset.voice;
                gains[voiceKey] = parseFloat(slider.value) / 100;
            });
            
            const response = await fetch(`${API_BASE}/mix_stems`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    stems: this.currentVoices,
                    gains: gains,
                    sample_rate: this.sampleRate
                })
            });
            
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error || 'Mixing failed');
            }
            
            this.displayMixedResult(data, 'mixedVoiceContainer');
            this.showSuccess(statusDiv, 'Voices mixed successfully!');
            
        } catch (error) {
            console.error('Mix error:', error);
            this.showError(document.getElementById('voiceStatus'), error.message);
        }
    }
    
    displayMixedResult(data, containerId) {
        const container = document.getElementById(containerId);
        
        // Store frequency data for export
        this.lastFrequencyData = data.frequency_data;
        
        let html = `
            <div class="mixed-audio-card">
                <h5><i class="bi bi-soundwave"></i> Mixed Output</h5>
                <p class="mb-3">Your custom mix is ready!</p>
                
                <audio controls class="w-100 mb-3" src="${data.mixed_audio}"></audio>
                
                <div class="row g-2 mb-3">
                    <div class="col-md-6">
                        <button class="btn btn-success w-100" onclick="aiController.downloadAudio('${data.mixed_audio}', 'mixed_audio.wav')">
                            <i class="bi bi-download"></i> Download Audio
                        </button>
                    </div>
                    <div class="col-md-6">
                        <button class="btn btn-light w-100" onclick="aiController.exportFrequencyData()">
                            <i class="bi bi-file-earmark-spreadsheet"></i> Export Spectrum CSV
                        </button>
                    </div>
                </div>
                
                <div class="frequency-plot-container mt-4">
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <h6 class="mb-0"><i class="bi bi-graph-up"></i> Frequency Spectrum (Custom FFT)</h6>
                        <span class="badge bg-info">Sample Rate: ${data.sample_rate} Hz</span>
                    </div>
                    <canvas id="frequencyCanvas_${containerId}" style="width: 100%; height: 300px; background: white; border-radius: 8px;"></canvas>
                    
                    <div class="spectrum-stats mt-3">
                        <div class="row text-center">
                            <div class="col-4">
                                <small class="text-white-50">Peak Frequency</small>
                                <div class="fw-bold" id="peakFreq_${containerId}">-</div>
                            </div>
                            <div class="col-4">
                                <small class="text-white-50">Max Magnitude</small>
                                <div class="fw-bold" id="maxMag_${containerId}">-</div>
                            </div>
                            <div class="col-4">
                                <small class="text-white-50">Data Points</small>
                                <div class="fw-bold">${data.frequency_data?.frequencies?.length || 0}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        container.innerHTML = html;
        
        if (data.frequency_data) {
            this.plotFrequencySpectrum(
                data.frequency_data.frequencies,
                data.frequency_data.magnitudes,
                `frequencyCanvas_${containerId}`
            );
            
            const magnitudes = data.frequency_data.magnitudes;
            const frequencies = data.frequency_data.frequencies;
            const maxMagIdx = magnitudes.indexOf(Math.max(...magnitudes));
            
            document.getElementById(`peakFreq_${containerId}`).textContent = 
                `${frequencies[maxMagIdx].toFixed(1)} Hz`;
            document.getElementById(`maxMag_${containerId}`).textContent = 
                magnitudes[maxMagIdx].toFixed(2);
        }
    }
    
    plotFrequencySpectrum(frequencies, magnitudes, canvasId) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.error('Canvas not found:', canvasId);
            return;
        }
        
        const ctx = canvas.getContext('2d');
        const width = canvas.width = canvas.offsetWidth * 2; // Retina display
        const height = canvas.height = canvas.offsetHeight * 2;
        ctx.scale(2, 2);
        
        const displayWidth = canvas.offsetWidth;
        const displayHeight = canvas.offsetHeight;
        
        // Clear canvas with gradient background
        const gradient = ctx.createLinearGradient(0, 0, 0, displayHeight);
        gradient.addColorStop(0, '#ffffff');
        gradient.addColorStop(1, '#f8f9fa');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, displayWidth, displayHeight);
        
        // Margins
        const margin = { top: 20, right: 20, bottom: 40, left: 60 };
        const plotWidth = displayWidth - margin.left - margin.right;
        const plotHeight = displayHeight - margin.top - margin.bottom;
        
        // Draw grid
        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 0.5;
        
        // Horizontal grid lines
        for (let i = 0; i <= 5; i++) {
            const y = margin.top + (i / 5) * plotHeight;
            ctx.beginPath();
            ctx.moveTo(margin.left, y);
            ctx.lineTo(margin.left + plotWidth, y);
            ctx.stroke();
        }
        
        // Vertical grid lines
        for (let i = 0; i <= 10; i++) {
            const x = margin.left + (i / 10) * plotWidth;
            ctx.beginPath();
            ctx.moveTo(x, margin.top);
            ctx.lineTo(x, margin.top + plotHeight);
            ctx.stroke();
        }
        
        // Draw axes
        ctx.strokeStyle = '#333333';
        ctx.lineWidth = 2;
        
        // Y-axis
        ctx.beginPath();
        ctx.moveTo(margin.left, margin.top);
        ctx.lineTo(margin.left, margin.top + plotHeight);
        ctx.stroke();
        
        // X-axis
        ctx.beginPath();
        ctx.moveTo(margin.left, margin.top + plotHeight);
        ctx.lineTo(margin.left + plotWidth, margin.top + plotHeight);
        ctx.stroke();
        
        // Find max magnitude for scaling
        const maxMag = Math.max(...magnitudes);
        const minMag = Math.min(...magnitudes.filter(m => m > 0));
        
        // Plot data
        ctx.strokeStyle = '#667eea';
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        for (let i = 0; i < frequencies.length; i++) {
            const x = margin.left + (i / (frequencies.length - 1)) * plotWidth;
            const normalizedMag = (magnitudes[i] - minMag) / (maxMag - minMag);
            const y = margin.top + plotHeight - (normalizedMag * plotHeight);
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        
        ctx.stroke();
        
        // Fill area under curve
        ctx.lineTo(margin.left + plotWidth, margin.top + plotHeight);
        ctx.lineTo(margin.left, margin.top + plotHeight);
        ctx.closePath();
        
        const fillGradient = ctx.createLinearGradient(0, margin.top, 0, margin.top + plotHeight);
        fillGradient.addColorStop(0, 'rgba(102, 126, 234, 0.3)');
        fillGradient.addColorStop(1, 'rgba(102, 126, 234, 0.05)');
        ctx.fillStyle = fillGradient;
        ctx.fill();
        
        // Y-axis labels (magnitude)
        ctx.fillStyle = '#333333';
        ctx.font = '11px Arial';
        ctx.textAlign = 'right';
        
        for (let i = 0; i <= 5; i++) {
            const y = margin.top + (i / 5) * plotHeight;
            const value = maxMag - (i / 5) * (maxMag - minMag);
            ctx.fillText(value.toFixed(0), margin.left - 10, y + 4);
        }
        
        // X-axis labels (frequency)
        ctx.textAlign = 'center';
        const freqMarkers = [
            { freq: 0, label: '0' },
            { freq: 100, label: '100' },
            { freq: 500, label: '500' },
            { freq: 1000, label: '1K' },
            { freq: 2000, label: '2K' },
            { freq: 5000, label: '5K' },
            { freq: 10000, label: '10K' },
            { freq: 20000, label: '20K' }
        ];
        
        freqMarkers.forEach(marker => {
            const maxFreq = frequencies[frequencies.length - 1];
            if (marker.freq <= maxFreq) {
                const idx = frequencies.findIndex(f => f >= marker.freq);
                if (idx !== -1) {
                    const x = margin.left + (idx / (frequencies.length - 1)) * plotWidth;
                    ctx.fillText(marker.label, x, margin.top + plotHeight + 20);
                    
                    // Tick marks
                    ctx.strokeStyle = '#333333';
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(x, margin.top + plotHeight);
                    ctx.lineTo(x, margin.top + plotHeight + 5);
                    ctx.stroke();
                }
            }
        });
        
        // Axis labels
        ctx.fillStyle = '#333333';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Frequency (Hz)', margin.left + plotWidth / 2, displayHeight - 5);
        
        ctx.save();
        ctx.translate(15, margin.top + plotHeight / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText('Magnitude', 0, 0);
        ctx.restore();
        
        // Add hover interaction
        canvas.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            const mouseX = (e.clientX - rect.left) * 2;
            
            if (mouseX >= margin.left && mouseX <= margin.left + plotWidth) {
                const idx = Math.floor(((mouseX - margin.left) / plotWidth) * frequencies.length);
                
                if (idx >= 0 && idx < frequencies.length) {
                    canvas.title = `Frequency: ${frequencies[idx].toFixed(2)} Hz\nMagnitude: ${magnitudes[idx].toFixed(2)}`;
                }
            }
        });
        
        console.log(`✅ Frequency spectrum plotted on ${canvasId}`);
    }
    
    exportFrequencyData() {
        if (!this.lastFrequencyData) {
            alert('No frequency data available to export');
            return;
        }
        
        const frequencies = this.lastFrequencyData.frequencies;
        const magnitudes = this.lastFrequencyData.magnitudes;
        
        // Create CSV data
        let csv = 'Frequency (Hz),Magnitude\n';
        for (let i = 0; i < frequencies.length; i++) {
            csv += `${frequencies[i]},${magnitudes[i]}\n`;
        }
        
        // Download CSV
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'frequency_spectrum.csv';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        console.log('✅ Frequency data exported');
    }
    
    downloadAudio(dataUri, filename) {
        const link = document.createElement('a');
        link.href = dataUri;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    
    showLoading(element, message) {
        element.innerHTML = `
            <div class="alert alert-info">
                <div class="spinner-border spinner-border-sm me-2" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                ${message}
            </div>
        `;
    }
    
    showSuccess(element, message) {
        element.innerHTML = `
            <div class="alert alert-success">
                <i class="bi bi-check-circle me-2"></i>${message}
            </div>
        `;
    }
    
    showError(element, message) {
        element.innerHTML = `
            <div class="alert alert-danger">
                <i class="bi bi-exclamation-triangle me-2"></i>${message}
            </div>
        `;
    }
}

let aiController;
document.addEventListener('DOMContentLoaded', () => {
    aiController = new AISeparationController();
    console.log('✅ AI Mode ready');
});