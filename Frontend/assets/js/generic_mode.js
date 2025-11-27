// generic_mode.js - Generic Mode leveraging shared general_mode functionality

// Import general mode functionality
if (typeof window.generalMode === 'undefined') {
    console.error("❌ General mode not loaded. Make sure general_mode.js is included first.");
}

class GenericEqualizer {
    constructor() {
        // Use shared configuration from general_mode
        this.baseURL = window.generalMode?.API_BASE_URL?.replace('/api', '/api/generic') || "http://127.0.0.1:5000/api/generic";
        
        // Use shared audio context if available
        this.audioContext = window.generalMode?.audioContext || null;

        // Data storage - Generic mode specific
        this.bands = [];
        this.currentScale = "linear";
        this.currentAudioFile = null;
        this.spectrumData = null;
        this.audioData = null;
        this.sampleRate = null;
        this.processedAudioUrl = null;
        this.processedAudioData = null;

        // Plotly instances - Generic mode uses different plot structure
        this.inputWaveformPlot = null;
        this.outputWaveformPlot = null;
        this.frequencyChart = null;
        this.inputSpectrogram = null;
        this.outputSpectrogram = null;

        // Use shared scale settings from general_mode
        this.currentInputScale = window.generalMode?.currentInputScale || "linear";
        this.currentOutputScale = window.generalMode?.currentOutputScale || "linear";

        // Audio data arrays
        this.inputTimeData = [];
        this.inputAmplitudeData = [];
        this.outputTimeData = [];
        this.outputAmplitudeData = [];

        // Playback state - Use shared where possible
        this.isPlaying = false;
        this.playbackInterval = null;
        this.currentTime = 0;
        this.totalDuration = 0;
        this.inputPlaybackSpeed = 1.0;
        this.outputPlaybackSpeed = 1.0;

        // Audio buffers and sources
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

        // Generic mode specific features
        this.currentPreset = null;
        this.realTimeProcessing = true;
        this.processingTimeout = null;
        this.processingDelay = 300;
        this.selectedBand = null;

        // Playhead and drag state
        this.inputPlayhead = null;
        this.outputPlayhead = null;
        this.isDraggingPlayhead = false;
        this.dragStartX = 0;
        this.dragStartTime = 0;

        // UI components
        this.addBandModal = null;
        this.syncingSpeed = false;
        this.isProcessing = false;
        this.processingLoader = null;

        console.log("🎵 GenericEqualizer initialized with shared general mode");
    }

    // MAIN INITIALIZATION - Uses shared functionality
    initializeApp() {
        console.log("🚀 Initializing Generic Mode with shared components...");
        
        // Use shared initialization for common components
        this.initializeSharedComponents();
        
        // Initialize generic-specific components
        this.initializeGenericComponents();
        
        console.log("✅ GenericEqualizer fully initialized");
    }

    // SHARED COMPONENTS INITIALIZATION
    initializeSharedComponents() {
        console.log("🔄 Initializing shared components from general mode...");
        
        // Use shared audio context initialization
        if (window.generalMode?.audioContext && !this.audioContext) {
            this.audioContext = window.generalMode.audioContext;
            console.log("✅ Using shared audio context from general mode");
        } else if (!this.audioContext) {
            this.initializeAudioContext();
        }

        // Use shared backend connection test
        if (window.generalMode?.testBackendConnection) {
            window.generalMode.testBackendConnection().then(() => {
                console.log("✅ Backend connection verified via general mode");
            }).catch(error => {
                console.error("❌ Backend connection failed:", error);
            });
        } else {
            this.testBackendConnection();
        }

        // Use shared plot synchronization if available
        if (window.generalMode?.setupSynchronizedZoom) {
            console.log("✅ Using shared plot synchronization from general mode");
        }
    }

    // GENERIC-SPECIFIC COMPONENTS INITIALIZATION
    initializeGenericComponents() {
        console.log("🔧 Initializing generic-specific components...");
        
        this.initializeEventListeners();
        this.initializePlots();
        this.addDefaultBands();
        this.loadPresetsList();
        this.renderVerticalSliders();
        this.initializePlayheads();
        this.initializeAddBandModal();
        this.initializeProcessingLoader();
    }

    // SHARED AUDIO CONTEXT INITIALIZATION
    initializeAudioContext() {
        if (this.audioContext) return;
        
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.inputGainNode = this.audioContext.createGain();
            this.outputGainNode = this.audioContext.createGain();
            this.inputGainNode.connect(this.audioContext.destination);
            this.outputGainNode.connect(this.audioContext.destination);
            console.log("✅ Web Audio API initialized for generic mode");
        } catch (error) {
            console.error("❌ Web Audio API not supported:", error);
            this.showNotification("Web Audio API not supported in this browser", "error");
        }
    }

    // SHARED FILE HANDLING
    async handleFileUpload(file) {
        if (!file) return;

        console.log(`📁 Handling file upload: ${file.name}`);

        // Use shared file validation if available
        const allowedExtensions = ["wav", "wave", "flac", "mp3", "m4a", "aac", "ogg", "mp4", "wma", "aiff", "aif"];
        const fileExt = file.name.split(".").pop().toLowerCase();

        if (!allowedExtensions.includes(fileExt)) {
            this.showNotification("Unsupported file type. Please use WAV, FLAC, MP3, M4A, AAC, OGG, or AIFF.", "error");
            return;
        }

        this.showNotification(`Loading ${file.name}...`, "info");

        try {
            this.currentAudioFile = file;
            this.showFileInfo(file);
            
            await this.extractAudioData(file);
            
            this.updateWaveformPlots();
            await this.computeFrequencySpectrum(file);
            
            // USE SHARED SPECTROGRAM FUNCTIONALITY
            await this.updateSpectrograms();

            if (this.realTimeProcessing) {
                await this.processAudioRealTime();
            }

            this.showNotification(`"${file.name}" loaded successfully!`, "success");
        } catch (error) {
            console.error("❌ Error loading audio file:", error);
            this.showNotification("Error loading audio file. Please try again.", "error");
        }
    }

    // SHARED AUDIO DATA EXTRACTION
    async extractAudioData(file) {
        return new Promise((resolve, reject) => {
            console.log("🔊 Extracting audio data...");

            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    if (!this.audioContext) {
                        this.initializeAudioContext();
                    }

                    this.inputAudioBuffer = await this.audioContext.decodeAudioData(e.target.result);
                    this.setupAudioData();
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

    setupAudioData() {
        this.audioData = this.inputAudioBuffer.getChannelData(0);
        this.sampleRate = this.inputAudioBuffer.sampleRate;
        this.totalDuration = this.inputAudioBuffer.duration;

        this.inputTimeData = Array.from({ length: this.audioData.length }, (_, i) => i / this.sampleRate);
        this.inputAmplitudeData = Array.from(this.audioData);
        this.outputTimeData = [...this.inputTimeData];
        this.outputAmplitudeData = [...this.inputAmplitudeData];

        this.updateTimeline();
    }

    updateTimeline() {
        const inputDurationElement = document.getElementById("inputDuration");
        const outputDurationElement = document.getElementById("outputDuration");

        if (inputDurationElement) inputDurationElement.textContent = this.totalDuration.toFixed(2);
        if (outputDurationElement) outputDurationElement.textContent = this.totalDuration.toFixed(2);

        console.log(`⏰ Duration updated: ${this.totalDuration.toFixed(2)}s`);
    }

    // SHARED NOTIFICATION SYSTEM
    showNotification(message, type = "info") {
        // Use general mode's notification system if available
        if (window.generalMode?.showError && type === 'error') {
            window.generalMode.showError(message);
            return;
        }

        // Use general mode's showNotification if available
        if (window.generalMode?.showNotification) {
            window.generalMode.showNotification(message, type);
            return;
        }

        // Fallback to local implementation
        const existingAlerts = document.querySelectorAll(".alert.position-fixed");
        existingAlerts.forEach((alert) => alert.remove());

        const notification = document.createElement("div");
        notification.className = `alert alert-${type === "error" ? "danger" : type} alert-dismissible fade show position-fixed`;
        notification.style.cssText = `
            top: 20px;
            right: 20px;
            z-index: 9999;
            min-width: 300px;
            max-width: 400px;
        `;

        const icons = {
            success: "check-circle",
            error: "exclamation-triangle",
            info: "info-circle",
            warning: "exclamation-circle",
        };

        notification.innerHTML = `
            <i class="bi bi-${icons[type] || "info-circle"} me-2"></i>
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
    }

    // SHARED BACKEND CONNECTION TEST
    async testBackendConnection() {
        try {
            console.log("🔌 Testing backend connection...");
            const response = await fetch(`${this.baseURL}/health`);

            if (response.ok) {
                const data = await response.json();
                console.log("✅ Backend connected successfully:", data);
                this.showNotification("Backend connected successfully!", "success");
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
        } catch (error) {
            console.error("❌ Backend connection failed:", error);
            this.showNotification(`Cannot connect to backend at ${this.baseURL}. Please make sure the Flask server is running.`, "error");
        }
    }

    // SHARED EXPORT FUNCTIONALITY
    exportAudio() {
        if (this.processedAudioUrl) {
            const a = document.createElement("a");
            a.href = this.processedAudioUrl;
            a.download = "processed_audio.wav";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            this.showNotification("Processed audio downloaded!", "success");
        } else {
            this.showNotification("No processed audio available for export.", "error");
        }
    }

    // ========== SPECTROGRAM FUNCTIONALITY - IMPORTED FROM GENERAL_MODE ==========

    /**
     * Update spectrograms using shared functionality from general_mode
     */
    async updateSpectrograms() {
        if (!this.currentAudioFile) return;

        console.log("🎨 Updating spectrograms using shared functionality...");

        try {
            // Use shared spectrogram functionality if available
            if (window.generalMode?.getInputVisualizations) {
                console.log("✅ Using shared spectrogram computation from general mode");
                
                // Get input visualizations from backend using shared function
                await window.generalMode.getInputVisualizations(this.currentAudioFile);
                
                // The shared function will automatically update the spectrograms
                // in the general mode, but we need to sync with our generic mode plots
                this.syncSpectrogramsWithSharedData();
            } else {
                // Fallback to local computation
                await this.computeSpectrogramsLocal();
            }
        } catch (error) {
            console.error("❌ Error updating spectrograms:", error);
            this.showNotification("Failed to compute spectrograms", "error");
        }
    }

    /**
     * Sync spectrogram data from shared general_mode with generic mode plots
     */
    syncSpectrogramsWithSharedData() {
        // This would typically involve transferring the spectrogram data
        // from general_mode's plots to generic_mode's plots
        // For now, we'll use the local computation as fallback
        this.computeSpectrogramsLocal();
    }

    /**
     * Local fallback for spectrogram computation
     */
    async computeSpectrogramsLocal() {
        try {
            console.log("🔄 Computing spectrograms locally...");

            const formData = new FormData();
            formData.append("file", this.currentAudioFile);

            const response = await fetch(`${this.baseURL}/compute_spectrogram`, {
                method: "POST",
                body: formData,
            });

            if (response.ok) {
                const spectrogramData = await response.json();
                this.updateSpectrogramPlot(
                    this.inputSpectrogram,
                    spectrogramData,
                    "Input Spectrogram"
                );
                console.log("✅ Input spectrogram computed");

                // If processed audio exists, compute output spectrogram
                if (this.processedAudioUrl) {
                    await this.computeOutputSpectrogram();
                }
            } else {
                throw new Error(`Server returned ${response.status}`);
            }
        } catch (error) {
            console.error("❌ Error computing spectrogram:", error);
            this.computeSpectrogramClientSide();
        }
    }

    /**
     * Compute output spectrogram using shared functionality
     */
    async computeOutputSpectrogram() {
        try {
            if (!this.processedAudioUrl) {
                console.log("No processed audio URL available");
                return;
            }

            // Use shared output visualization update if available
            if (window.generalMode?.updateOutputVisualizations && window.generalMode.processedAudioBuffer) {
                console.log("✅ Using shared output spectrogram computation");
                return;
            }

            // Fallback to local computation
            const response = await fetch(this.processedAudioUrl);
            const blob = await response.blob();
            const processedFile = new File([blob], "processed_audio.wav", {
                type: "audio/wav",
            });

            const formData = new FormData();
            formData.append("file", processedFile);

            const spectrogramResponse = await fetch(
                `${this.baseURL}/compute_spectrogram`,
                {
                    method: "POST",
                    body: formData,
                }
            );

            if (spectrogramResponse.ok) {
                const spectrogramData = await spectrogramResponse.json();
                this.updateSpectrogramPlot(
                    this.outputSpectrogram,
                    spectrogramData,
                    "Output Spectrogram"
                );
                console.log("✅ Output spectrogram computed");
            } else {
                // Fallback to client-side for output spectrogram
                if (this.processedAudioData && this.sampleRate) {
                    const clientSideResult = this.computeSpectrogramClientSideData(
                        this.processedAudioData,
                        this.sampleRate
                    );
                    this.updateSpectrogramPlot(
                        this.outputSpectrogram,
                        clientSideResult,
                        "Output Spectrogram (Client-side)"
                    );
                }
            }
        } catch (error) {
            console.error("❌ Error computing output spectrogram:", error);
            // Fallback to client-side computation
            if (this.processedAudioData && this.sampleRate) {
                const clientSideResult = this.computeSpectrogramClientSideData(
                    this.processedAudioData,
                    this.sampleRate
                );
                this.updateSpectrogramPlot(
                    this.outputSpectrogram,
                    clientSideResult,
                    "Output Spectrogram (Client-side)"
                );
            }
        }
    }

    /**
     * Client-side spectrogram computation (fallback)
     */
    computeSpectrogramClientSide() {
        if (!this.audioData || !this.sampleRate) return;

        try {
            console.log("🔄 Falling back to client-side spectrogram computation...");

            const clientSideResult = this.computeSpectrogramClientSideData(
                this.audioData,
                this.sampleRate
            );
            console.log("✅ Client-side spectrogram computed");

            // Update the input spectrogram with client-side data
            this.updateSpectrogramPlot(
                this.inputSpectrogram,
                clientSideResult,
                "Input Spectrogram (Client-side)"
            );

            // If we have processed audio, compute output spectrogram client-side too
            if (this.processedAudioData) {
                const outputClientSideResult = this.computeSpectrogramClientSideData(
                    this.processedAudioData,
                    this.sampleRate
                );
                this.updateSpectrogramPlot(
                    this.outputSpectrogram,
                    outputClientSideResult,
                    "Output Spectrogram (Client-side)"
                );
            }
        } catch (fallbackError) {
            console.error("❌ Client-side fallback also failed:", fallbackError);
            this.showNotification("Failed to compute spectrograms. Please try another file.", "error");
        }
    }

    /**
     * Core client-side spectrogram computation
     */
    computeSpectrogramClientSideData(audioData, sampleRate) {
        const windowSize = 1024;
        const hopSize = 512;

        try {
            // Simple client-side spectrogram computation
            const spectrogram = [];
            const timeAxis = [];
            const freqAxis = [];

            // Calculate frequency axis (only positive frequencies)
            for (let i = 0; i < windowSize / 2; i++) {
                freqAxis.push((i * sampleRate) / (2 * windowSize));
            }

            // Process audio in windows
            for (let start = 0; start + windowSize <= audioData.length; start += hopSize) {
                const window = audioData.slice(start, start + windowSize);

                // Apply Hanning window
                const windowed = window.map(
                    (sample, i) =>
                        sample * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (windowSize - 1)))
                );

                // Simple magnitude calculation (simplified FFT)
                const magnitudes = new Array(windowSize / 2);
                for (let i = 0; i < windowSize / 2; i++) {
                    magnitudes[i] = Math.abs(windowed[i]) || 0.001;
                }

                spectrogram.push(magnitudes);
                timeAxis.push(start / sampleRate);
            }

            // Convert to 2D format for visualization
            const spectrogram2D = {
                z: this.magnitudesToDB(spectrogram),
                x: timeAxis,
                y: freqAxis,
            };

            // Calculate average spectrum
            const spectrum = this.calculateAverageSpectrum(spectrogram, freqAxis);

            return {
                spectrogram_2d: spectrogram2D,
                spectrum: spectrum,
                sample_rate: sampleRate,
                duration: audioData.length / sampleRate,
                method: "client_side_fallback",
            };
        } catch (error) {
            console.error("❌ Client-side spectrogram failed:", error);
            throw error;
        }
    }

    /**
     * Convert magnitudes to dB scale
     */
    magnitudesToDB(spectrogram) {
        // Transpose the spectrogram for Plotly heatmap format
        const transposed = [];
        const numFreqBins = spectrogram[0].length;
        const numTimeFrames = spectrogram.length;

        for (let freqBin = 0; freqBin < numFreqBins; freqBin++) {
            const column = [];
            for (let timeFrame = 0; timeFrame < numTimeFrames; timeFrame++) {
                const magnitude = spectrogram[timeFrame][freqBin] || 0.001;
                column.push(20 * Math.log10(magnitude));
            }
            transposed.push(column);
        }

        return transposed;
    }

    /**
     * Calculate average spectrum from spectrogram
     */
    calculateAverageSpectrum(spectrogram, freqAxis) {
        const avgMagnitudes = new Array(spectrogram[0].length).fill(0);

        spectrogram.forEach((frame) => {
            frame.forEach((mag, i) => {
                avgMagnitudes[i] += mag;
            });
        });

        avgMagnitudes.forEach((mag, i) => {
            avgMagnitudes[i] = mag / spectrogram.length;
        });

        return {
            frequencies: freqAxis,
            magnitudes: avgMagnitudes,
        };
    }

    /**
     * Update spectrogram plot (shared visualization logic)
     */
    updateSpectrogramPlot(plotElement, spectrogramData, title) {
        if (!plotElement) return;
        
        try {
            console.log(`🎨 Updating spectrogram plot: ${title}`);

            // Extract data from the response structure
            const spectrogram2d = spectrogramData.spectrogram_2d || spectrogramData;

            let zData, xData, yData;

            if (spectrogram2d.z && spectrogram2d.x && spectrogram2d.y) {
                zData = spectrogram2d.z;
                xData = spectrogram2d.x;
                yData = spectrogram2d.y;
            } else {
                // Fallback to dummy data
                zData = [[0]];
                xData = [0];
                yData = [0];
            }

            // Limit data for performance if needed
            const maxTimePoints = 100;
            const maxFreqPoints = 100;

            if (xData.length > maxTimePoints) {
                const timeStep = Math.ceil(xData.length / maxTimePoints);
                xData = xData.filter((_, i) => i % timeStep === 0);
                zData = zData.map((row) => row.filter((_, i) => i % timeStep === 0));
            }

            if (yData.length > maxFreqPoints) {
                const freqStep = Math.ceil(yData.length / maxFreqPoints);
                yData = yData.filter((_, i) => i % freqStep === 0);
                zData = zData.filter((_, i) => i % freqStep === 0);
            }

            Plotly.react(
                plotElement,
                [
                    {
                        z: zData,
                        x: xData,
                        y: yData,
                        type: "heatmap",
                        colorscale: "Viridis",
                        showscale: true,
                        colorbar: {
                            title: "Magnitude",
                            titleside: "right",
                        },
                        hovertemplate:
                            "Time: %{x:.2f}s<br>Frequency: %{y:.0f}Hz<br>Magnitude: %{z:.6f}<extra></extra>",
                    },
                ],
                {
                    title: { text: title, font: { size: 14, color: "#6c757d" } },
                    margin: { t: 40, r: 30, b: 50, l: 60 },
                    paper_bgcolor: "rgba(0,0,0,0)",
                    plot_bgcolor: "rgba(0,0,0,0)",
                    font: { color: "#6c757d" },
                    xaxis: {
                        title: { text: "Time (s)", font: { color: "#6c757d" } },
                        showgrid: true,
                        gridcolor: "rgba(128,128,128,0.1)",
                    },
                    yaxis: {
                        title: { text: "Frequency (Hz)", font: { color: "#6c757d" } },
                        type: "log",
                        showgrid: true,
                        gridcolor: "rgba(128,128,128,0.1)",
                    },
                }
            );

            console.log(`✅ ${title} updated successfully`);
        } catch (error) {
            console.error(`❌ Error updating spectrogram plot:`, error);
        }
    }

    // ========== GENERIC-SPECIFIC FUNCTIONALITY ==========

    initializeEventListeners() {
        console.log("🔧 Initializing generic mode event listeners...");

        // File upload
        const audioUpload = document.getElementById("audioUpload");
        if (audioUpload) {
            audioUpload.addEventListener("change", (e) => {
                this.handleFileUpload(e.target.files[0]);
            });
        }

        // Test signal
        const generateTest = document.getElementById("generateTest");
        if (generateTest) {
            generateTest.addEventListener("click", () => {
                this.generateTestSignal();
            });
        }

        // Scale selector
        const scaleSelect = document.getElementById("scaleSelect");
        if (scaleSelect) {
            scaleSelect.addEventListener("change", (e) => {
                this.currentScale = e.target.value;
                this.updateFrequencyChart();
            });
        }

        // Preset management
        const presetList = document.getElementById("presetList");
        if (presetList) {
            presetList.addEventListener("change", (e) => {
                if (e.target.value) {
                    this.loadPreset(e.target.value);
                }
            });
        }

        const savePreset = document.getElementById("savePreset");
        if (savePreset) {
            savePreset.addEventListener("click", () => {
                this.savePreset();
            });
        }

        const updatePreset = document.getElementById("updatePreset");
        if (updatePreset) {
            updatePreset.addEventListener("click", () => {
                this.updatePreset();
            });
        }

        const deletePreset = document.getElementById("deletePreset");
        if (deletePreset) {
            deletePreset.addEventListener("click", () => {
                this.deletePreset();
            });
        }

        // Add band button
        const addBand = document.getElementById("addBand");
        if (addBand) {
            addBand.addEventListener("click", () => {
                this.openAddBandModal();
            });
        }

        // Export audio
        const exportAudio = document.getElementById("exportAudio");
        if (exportAudio) {
            exportAudio.addEventListener("click", () => {
                this.exportAudio();
            });
        }

        // Playback controls
        const playAll = document.getElementById("playAll");
        if (playAll) playAll.addEventListener("click", () => this.playAll());

        const pauseAll = document.getElementById("pauseAll");
        if (pauseAll) pauseAll.addEventListener("click", () => this.pauseAll());

        const stopAll = document.getElementById("stopAll");
        if (stopAll) stopAll.addEventListener("click", () => this.stopAll());

        const resetViewAll = document.getElementById("resetViewAll");
        if (resetViewAll) resetViewAll.addEventListener("click", () => this.resetViewAll());

        // Individual viewer controls
        const playInput = document.getElementById("playInput");
        if (playInput) playInput.addEventListener("click", () => this.playInput());

        const pauseInput = document.getElementById("pauseInput");
        if (pauseInput) pauseInput.addEventListener("click", () => this.pauseInput());

        const stopInput = document.getElementById("stopInput");
        if (stopInput) stopInput.addEventListener("click", () => this.stopInput());

        const playOutput = document.getElementById("playOutput");
        if (playOutput) playOutput.addEventListener("click", () => this.playOutput());

        const pauseOutput = document.getElementById("pauseOutput");
        if (pauseOutput) pauseOutput.addEventListener("click", () => this.pauseOutput());

        const stopOutput = document.getElementById("stopOutput");
        if (stopOutput) stopOutput.addEventListener("click", () => this.stopOutput());

        // Speed controls
        const inputSpeed = document.getElementById("inputSpeed");
        if (inputSpeed) {
            inputSpeed.addEventListener("change", (e) => {
                if (this.syncingSpeed) return;
                this.syncingSpeed = true;

                const value = parseFloat(e.target.value);
                this.inputPlaybackSpeed = value;
                this.outputPlaybackSpeed = value;

                if (this.inputSource) this.inputSource.playbackRate.value = value;
                if (this.outputSource) this.outputSource.playbackRate.value = value;

                const outputSpeed = document.getElementById("outputSpeed");
                if (outputSpeed) outputSpeed.value = value;
                this.syncingSpeed = false;
            });
        }

        const outputSpeed = document.getElementById("outputSpeed");
        if (outputSpeed) {
            outputSpeed.addEventListener("change", (e) => {
                if (this.syncingSpeed) return;
                this.syncingSpeed = true;

                const value = parseFloat(e.target.value);
                this.outputPlaybackSpeed = value;
                this.inputPlaybackSpeed = value;

                if (this.outputSource) this.outputSource.playbackRate.value = value;
                if (this.inputSource) this.inputSource.playbackRate.value = value;

                const inputSpeed = document.getElementById("inputSpeed");
                if (inputSpeed) inputSpeed.value = value;
                this.syncingSpeed = false;
            });
        }

        // Real-time processing toggle
        const realTimeProcessing = document.getElementById("realTimeProcessing");
        if (realTimeProcessing) {
            realTimeProcessing.addEventListener("change", (e) => {
                this.realTimeProcessing = e.target.checked;
                this.showNotification(
                    this.realTimeProcessing ? "Real-time processing enabled" : "Real-time processing disabled",
                    "info"
                );
            });
        }

        // Spectrogram toggle - Use shared functionality if available
        const showSpectrograms = document.getElementById("showSpectrograms");
        if (showSpectrograms) {
            showSpectrograms.addEventListener("change", (e) => {
                const container = document.getElementById("spectrogramsContainer");
                if (container) {
                    container.style.display = e.target.checked ? "block" : "none";
                    if (e.target.checked && this.currentAudioFile) {
                        this.updateSpectrograms();
                    }
                }
            });
        }

        // Graph reset
        const resetGraph = document.getElementById("resetGraph");
        if (resetGraph) {
            resetGraph.addEventListener("click", () => {
                this.resetGraph();
            });
        }

        // Export buttons
        const exportSpectrum = document.getElementById("exportSpectrum");
        if (exportSpectrum) {
            exportSpectrum.addEventListener("click", () => {
                this.exportSpectrum();
            });
        }

        const exportSpectrograms = document.getElementById("exportSpectrograms");
        if (exportSpectrograms) {
            exportSpectrograms.addEventListener("click", () => {
                this.exportSpectrograms();
            });
        }

        console.log("✅ Generic mode event listeners initialized");
    }

    initializePlots() {
        this.initializeWaveformPlots();
        this.initializeFrequencyChart();
        this.initializeSpectrograms();
        // Attempt to wire up shared synchronization utilities from general_mode
        try {
            this.useGeneralSync();
        } catch (err) {
            console.warn('⚠️ useGeneralSync failed:', err);
        }

    }

    /**
     * Use synchronization utilities provided by `general_mode.js` when available.
     * This will attempt to call global helpers such as `syncPlots`,
     * `setupSynchronizedZoom`, `forceSynchronizeRanges` or equivalents exported
     * by the shared general mode script so that generic-mode plots stay linked
     * with the input/output spectrograms and waveforms.
     */
    useGeneralSync() {
        // Prefer direct syncPlots if available globally
        if (typeof window.syncPlots === 'function') {
            try {
                window.syncPlots('inputWaveformPlot', 'outputWaveformPlot');
                window.syncPlots('inputSpectrogram', 'outputSpectrogram');
                console.log('✅ Generic mode: linked plots via global syncPlots');
                return;
            } catch (e) {
                console.warn('⚠️ global syncPlots threw:', e);
            }
        }

        // If generalMode exposes a setup function, call it (it may sync default ids)
        if (window.generalMode && typeof window.generalMode.setupSynchronizedZoom === 'function') {
            try {
                window.generalMode.setupSynchronizedZoom();
                console.log('✅ Generic mode: called generalMode.setupSynchronizedZoom()');
                return;
            } catch (e) {
                console.warn('⚠️ generalMode.setupSynchronizedZoom threw:', e);
            }
        }

        // Fallback: call any global setupSynchronizedZoom if present
        if (typeof window.setupSynchronizedZoom === 'function') {
            try {
                window.setupSynchronizedZoom();
                console.log('✅ Generic mode: called global setupSynchronizedZoom()');
                return;
            } catch (e) {
                console.warn('⚠️ global setupSynchronizedZoom threw:', e);
            }
        }

        console.log('ℹ️ No shared plot synchronization methods found. Using local sync only.');
    }
    initializeWaveformPlots() {
        console.log("📈 Initializing waveform plots...");

        // Input waveform plot
        this.inputWaveformPlot = document.getElementById("inputWaveformPlot");
        if (this.inputWaveformPlot) {
            Plotly.newPlot(
                this.inputWaveformPlot,
                [
                    {
                        x: [0],
                        y: [0],
                        type: "scatter",
                        mode: "lines",
                        line: { color: "#e03a3c", width: 1.5 },
                        name: "Input Signal",
                    },
                ],
                {
                    title: { text: "", font: { size: 14, color: "#6c757d" } },
                    margin: { t: 10, r: 30, b: 40, l: 50 },
                    paper_bgcolor: "rgba(0,0,0,0)",
                    plot_bgcolor: "rgba(0,0,0,0)",
                    font: { color: "#6c757d" },
                    xaxis: {
                        title: { text: "Time (s)", font: { color: "#6c757d" } },
                        gridcolor: "rgba(128,128,128,0.2)",
                        linecolor: "rgba(128,128,128,0.5)",
                        range: [0, 1],
                        showgrid: true,
                        zeroline: false,
                    },
                    yaxis: {
                        title: { text: "Amplitude", font: { color: "#6c757d" } },
                        gridcolor: "rgba(128,128,128,0.2)",
                        linecolor: "rgba(128,128,128,0.5)",
                        range: [-1, 1],
                        showgrid: true,
                        zeroline: true,
                        zerolinecolor: "rgba(128,128,128,0.3)",
                    },
                    showlegend: false,
                },
                {
                    displayModeBar: true,
                    displaylogo: false,
                    modeBarButtonsToRemove: ["lasso2d", "select2d"],
                    scrollZoom: true,
                }
            );
        }

        // Output waveform plot
        this.outputWaveformPlot = document.getElementById("outputWaveformPlot");
        if (this.outputWaveformPlot) {
            Plotly.newPlot(
                this.outputWaveformPlot,
                [
                    {
                        x: [0],
                        y: [0],
                        type: "scatter",
                        mode: "lines",
                        line: { color: "#28a745", width: 1.5 },
                        name: "Output Signal",
                    },
                ],
                {
                    title: { text: "", font: { size: 14, color: "#6c757d" } },
                    margin: { t: 10, r: 30, b: 40, l: 50 },
                    paper_bgcolor: "rgba(0,0,0,0)",
                    plot_bgcolor: "rgba(0,0,0,0)",
                    font: { color: "#6c757d" },
                    xaxis: {
                        title: { text: "Time (s)", font: { color: "#6c757d" } },
                        gridcolor: "rgba(128,128,128,0.2)",
                        linecolor: "rgba(128,128,128,0.5)",
                        range: [0, 1],
                        showgrid: true,
                        zeroline: false,
                    },
                    yaxis: {
                        title: { text: "Amplitude", font: { color: "#6c757d" } },
                        gridcolor: "rgba(128,128,128,0.2)",
                        linecolor: "rgba(128,128,128,0.5)",
                        range: [-1, 1],
                        showgrid: true,
                        zeroline: true,
                        zerolinecolor: "rgba(128,128,128,0.3)",
                    },
                    showlegend: false,
                },
                {
                    displayModeBar: true,
                    displaylogo: false,
                    modeBarButtonsToRemove: ["lasso2d", "select2d"],
                    scrollZoom: true,
                }
            );
        }

        // Sync the plots
        this.syncWaveformPlots();

        console.log("✅ Waveform plots initialized");
    }

    syncWaveformPlots() {
        console.log("🔗 Syncing waveform plots...");

        if (!this.inputWaveformPlot || !this.outputWaveformPlot) return;

        // Sync input plot events to output plot
        this.inputWaveformPlot.on("plotly_relayout", (eventData) => {
            if (
                eventData["xaxis.range[0]"] !== undefined &&
                eventData["xaxis.range[1]"] !== undefined
            ) {
                this.inputXRange = [
                    eventData["xaxis.range[0]"],
                    eventData["xaxis.range[1]"],
                ];
                this.updateOutputPlotRange();
            }
            if (
                eventData["yaxis.range[0]"] !== undefined &&
                eventData["yaxis.range[1]"] !== undefined
            ) {
                this.inputYRange = [
                    eventData["yaxis.range[0]"],
                    eventData["yaxis.range[1]"],
                ];
                this.updateOutputPlotRange();
            }
        });

        // Sync output plot events to input plot
        this.outputWaveformPlot.on("plotly_relayout", (eventData) => {
            if (
                eventData["xaxis.range[0]"] !== undefined &&
                eventData["xaxis.range[1]"] !== undefined
            ) {
                this.outputXRange = [
                    eventData["xaxis.range[0]"],
                    eventData["xaxis.range[1]"],
                ];
                this.updateInputPlotRange();
            }
            if (
                eventData["yaxis.range[0]"] !== undefined &&
                eventData["yaxis.range[1]"] !== undefined
            ) {
                this.outputYRange = [
                    eventData["yaxis.range[0]"],
                    eventData["yaxis.range[1]"],
                ];
                this.updateInputPlotRange();
            }
        });

        console.log("✅ Waveform plots synchronized");
    }

    updateInputPlotRange() {
        if (!this.inputWaveformPlot) return;
        Plotly.relayout(this.inputWaveformPlot, {
            "xaxis.range": this.outputXRange,
            "yaxis.range": this.outputYRange,
        });
        this.inputXRange = this.outputXRange;
        this.inputYRange = this.outputYRange;
    }

    updateOutputPlotRange() {
        if (!this.outputWaveformPlot) return;
        Plotly.relayout(this.outputWaveformPlot, {
            "xaxis.range": this.inputXRange,
            "yaxis.range": this.inputYRange,
        });
        this.outputXRange = this.inputXRange;
        this.outputYRange = this.inputYRange;
    }

    initializeFrequencyChart() {
        console.log("📊 Initializing frequency chart...");

        this.frequencyChart = document.getElementById("frequencyChart");
        if (this.frequencyChart) {
            Plotly.newPlot(
                this.frequencyChart,
                [
                    {
                        x: [0],
                        y: [0],
                        type: "scatter",
                        mode: "lines",
                        line: { color: "#6c757d", width: 2 },
                        name: "Input Spectrum",
                        hovertemplate:
                            "Frequency: %{x:.0f} Hz<br>Magnitude: %{y:.6f}<extra></extra>",
                    },
                    {
                        x: [0],
                        y: [0],
                        type: "scatter",
                        mode: "lines",
                        line: { color: "#e03a3c", width: 2 },
                        name: "Equalized Spectrum",
                        hovertemplate:
                            "Frequency: %{x:.0f} Hz<br>Magnitude: %{y:.6f}<extra></extra>",
                    },
                ],
                {
                    title: { text: "", font: { size: 14, color: "#6c757d" } },
                    margin: { t: 10, r: 30, b: 50, l: 60 },
                    paper_bgcolor: "rgba(0,0,0,0)",
                    plot_bgcolor: "rgba(0,0,0,0)",
                    font: { color: "#6c757d" },
                    xaxis: {
                        title: { text: "Frequency (Hz)", font: { color: "#6c757d" } },
                        type: "linear",
                        gridcolor: "rgba(128,128,128,0.2)",
                        linecolor: "rgba(128,128,128,0.5)",
                        showgrid: true,
                    },
                    yaxis: {
                        title: { text: "Magnitude", font: { color: "#6c757d" } },
                        gridcolor: "rgba(128,128,128,0.2)",
                        linecolor: "rgba(128,128,128,0.5)",
                        showgrid: true,
                    },
                    showlegend: true,
                    legend: {
                        x: 0,
                        y: 1,
                        bgcolor: "rgba(255,255,255,0.8)",
                        bordercolor: "rgba(128,128,128,0.3)",
                        borderwidth: 1,
                    },
                    hovermode: "closest",
                },
                {
                    displayModeBar: true,
                    displaylogo: false,
                    modeBarButtonsToRemove: ["lasso2d", "select2d"],
                    scrollZoom: true,
                }
            );
        }

        console.log("✅ Frequency chart initialized");
    }

    initializeSpectrograms() {
        console.log("🎨 Initializing spectrograms...");

        // Input spectrogram
        this.inputSpectrogram = document.getElementById("inputSpectrogram");
        if (this.inputSpectrogram) {
            Plotly.newPlot(
                this.inputSpectrogram,
                [
                    {
                        z: [[0]],
                        x: [0],
                        y: [0],
                        type: "heatmap",
                        colorscale: "Viridis",
                        showscale: true,
                        colorbar: {
                            title: "Magnitude",
                            titleside: "right",
                        },
                        hovertemplate:
                            "Time: %{x:.2f}s<br>Frequency: %{y:.0f}Hz<br>Magnitude: %{z:.2f} dB<extra></extra>",
                    },
                ],
                {
                    title: { text: "", font: { size: 14, color: "#6c757d" } },
                    margin: { t: 10, r: 30, b: 50, l: 60 },
                    paper_bgcolor: "rgba(0,0,0,0)",
                    plot_bgcolor: "rgba(0,0,0,0)",
                    font: { color: "#6c757d" },
                    xaxis: {
                        title: { text: "Time (s)", font: { color: "#6c757d" } },
                        showgrid: true,
                        gridcolor: "rgba(128,128,128,0.1)",
                    },
                    yaxis: {
                        title: { text: "Frequency (Hz)", font: { color: "#6c757d" } },
                        type: "log",
                        showgrid: true,
                        gridcolor: "rgba(128,128,128,0.1)",
                    },
                },
                {
                    displayModeBar: true,
                    displaylogo: false,
                }
            );
        }

        // Output spectrogram
        this.outputSpectrogram = document.getElementById("outputSpectrogram");
        if (this.outputSpectrogram) {
            Plotly.newPlot(
                this.outputSpectrogram,
                [
                    {
                        z: [[0]],
                        x: [0],
                        y: [0],
                        type: "heatmap",
                        colorscale: "Viridis",
                        showscale: true,
                        colorbar: {
                            title: "dB",
                            titleside: "right",
                        },
                        hovertemplate:
                            "Time: %{x:.2f}s<br>Frequency: %{y:.0f}Hz<br>Magnitude: %{z:.2f} dB<extra></extra>",
                    },
                ],
                {
                    title: { text: "", font: { size: 14, color: "#6c757d" } },
                    margin: { t: 10, r: 30, b: 50, l: 60 },
                    paper_bgcolor: "rgba(0,0,0,0)",
                    plot_bgcolor: "rgba(0,0,0,0)",
                    font: { color: "#6c757d" },
                    xaxis: {
                        title: { text: "Time (s)", font: { color: "#6c757d" } },
                        showgrid: true,
                        gridcolor: "rgba(128,128,128,0.1)",
                    },
                    yaxis: {
                        title: { text: "Frequency (Hz)", font: { color: "#6c757d" } },
                        type: "log",
                        showgrid: true,
                        gridcolor: "rgba(128,128,128,0.1)",
                    },
                },
                {
                    displayModeBar: true,
                    displaylogo: false,
                }
            );
        }

        console.log("✅ Spectrograms initialized");
    }

    updateFrequencyChart() {
        if (!this.spectrumData || !this.frequencyChart) return;

        const frequencies = this.spectrumData.frequencies;
        const inputMagnitude = this.spectrumData.magnitude;
        const equalizedMagnitude = this.calculateEqualizedSpectrum(
            frequencies,
            inputMagnitude
        );

        // Use magnitude values directly
        const inputLinear = inputMagnitude;
        const equalizedLinear = equalizedMagnitude;

        // Update frequency chart
        Plotly.react(
            this.frequencyChart,
            [
                {
                    x: frequencies,
                    y: inputLinear,
                    type: "scatter",
                    mode: "lines",
                    line: { color: "#6c757d", width: 2 },
                    name: "Input Spectrum",
                    hovertemplate:
                        "Frequency: %{x:.0f} Hz<br>Magnitude: %{y:.6f}<extra></extra>",
                },
                {
                    x: frequencies,
                    y: equalizedLinear,
                    type: "scatter",
                    mode: "lines",
                    line: { color: "#e03a3c", width: 2 },
                    name: "Equalized Spectrum",
                    hovertemplate:
                        "Frequency: %{x:.0f} Hz<br>Magnitude: %{y:.6f}<extra></extra>",
                },
            ],
            {
                xaxis: {
                    type: this.currentScale === "audiogram" ? "log" : "linear",
                    title:
                        this.currentScale === "audiogram"
                            ? "Frequency (Hz) - Log Scale"
                            : "Frequency (Hz)",
                },
                yaxis: {
                    title: { text: "Magnitude", font: { color: "#6c757d" } },
                }
            }
        );

        // Update scale display
        const currentScaleDisplay = document.getElementById("currentScaleDisplay");
        if (currentScaleDisplay) {
            currentScaleDisplay.textContent =
                this.currentScale === "audiogram" ? "Logarithmic" : "Linear";
        }

        console.log("📊 Frequency chart updated with linear magnitude");
    }

    calculateEqualizedSpectrum(frequencies, inputMagnitude) {
        const equalizedMagnitude = [...inputMagnitude];

        this.bands.forEach((band) => {
            frequencies.forEach((freq, i) => {
                if (freq >= band.startFreq && freq <= band.endFreq) {
                    equalizedMagnitude[i] *= band.gain;
                }
            });
        });

        return equalizedMagnitude;
    }

    updateWaveformPlots() {
        if (!this.audioData || !this.sampleRate) return;

        console.log("📈 Updating waveform plots...");

        // Calculate the number of samples for 10 seconds
        const targetDuration = 10;
        const maxSamples = Math.min(
            this.audioData.length,
            targetDuration * this.sampleRate
        );

        // Get the first 10 seconds of data
        const displayTime = Array.from(
            { length: maxSamples },
            (_, i) => i / this.sampleRate
        );
        const displayData = this.inputAmplitudeData.slice(0, maxSamples);

        // Limit data points for performance
        let finalDisplayTime = displayTime;
        let finalDisplayData = displayData;

        if (maxSamples > 5000) {
            const step = Math.ceil(maxSamples / 5000);
            finalDisplayTime = displayTime.filter((_, i) => i % step === 0);
            finalDisplayData = displayData.filter((_, i) => i % step === 0);
        }

        const displayDuration = Math.min(this.totalDuration, targetDuration);

        // Update input waveform
        if (this.inputWaveformPlot) {
            Plotly.react(
                this.inputWaveformPlot,
                [
                    {
                        x: finalDisplayTime,
                        y: finalDisplayData,
                        type: "scatter",
                        mode: "lines",
                        line: { color: "#e03a3c", width: 1.5 },
                        name: "Input Signal",
                    },
                ],
                {
                    xaxis: {
                        range: [0, displayDuration],
                        title: {
                            text: `Time (s) - Displaying: ${displayDuration.toFixed(2)}s`,
                        },
                    },
                    yaxis: { range: [-1, 1] },
                }
            );
        }

        // Update output waveform (initially same as input)
        if (this.outputWaveformPlot) {
            Plotly.react(
                this.outputWaveformPlot,
                [
                    {
                        x: finalDisplayTime,
                        y: finalDisplayData,
                        type: "scatter",
                        mode: "lines",
                        line: { color: "#28a745", width: 1.5 },
                        name: "Output Signal",
                    },
                ],
                {
                    xaxis: {
                        range: [0, displayDuration],
                        title: {
                            text: `Time (s) - Displaying: ${displayDuration.toFixed(2)}s`,
                        },
                    },
                    yaxis: { range: [-1, 1] },
                }
            );
        }

        // Reset ranges
        this.inputXRange = [0, displayDuration];
        this.outputXRange = [0, displayDuration];

        // Re-add click listeners after plot update and attempt shared resync
        setTimeout(() => {
            this.addWaveformClickListeners();
            // Try to re-sync ranges using shared helpers from general_mode
            if (typeof window.resyncPlotsAfterUpdate === 'function') {
                try { window.resyncPlotsAfterUpdate(); } catch (e) { console.warn('⚠️ resyncPlotsAfterUpdate failed', e); }
            } else if (typeof window.forceSynchronizeRanges === 'function') {
                try { window.forceSynchronizeRanges(); } catch (e) { console.warn('⚠️ forceSynchronizeRanges failed', e); }
            }
        }, 100);

        console.log(`✅ Waveform plots updated - Displaying ${displayDuration.toFixed(2)} seconds`);
    }

    async computeFrequencySpectrum(file) {
        try {
            console.log("📊 Computing frequency spectrum...");

            const formData = new FormData();
            formData.append("file", file);

            const response = await fetch(`${this.baseURL}/compute_spectrum`, {
                method: "POST",
                body: formData,
            });

            if (response.ok) {
                this.spectrumData = await response.json();
                this.updateFrequencyChart();
                console.log("✅ Frequency spectrum computed");
            } else {
                throw new Error(`HTTP ${response.status}: Spectrum computation failed`);
            }
        } catch (error) {
            console.error("❌ Error computing spectrum:", error);
            this.computeSpectrumClientSide();
        }
    }

    computeSpectrumClientSide() {
        console.log("🔄 Using client-side spectrum computation...");

        if (!this.audioData || !this.sampleRate) return;

        // Simple FFT using Web Audio API AnalyserNode
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const analyser = audioContext.createAnalyser();
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        // Create a temporary source for analysis
        const buffer = audioContext.createBuffer(
            1,
            this.audioData.length,
            this.sampleRate
        );
        buffer.copyToChannel(this.audioData, 0);
        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(analyser);

        analyser.getByteFrequencyData(dataArray);

        // Convert to frequency data
        const frequencies = Array.from(
            { length: bufferLength },
            (_, i) => (i * this.sampleRate) / (2 * bufferLength)
        );
        const magnitude = Array.from(dataArray, (val) => val / 255);

        this.spectrumData = {
            frequencies: frequencies,
            magnitude: magnitude,
            sample_rate: this.sampleRate,
        };

        this.updateFrequencyChart();
        console.log("✅ Client-side spectrum computed");
    }

    // VERTICAL SLIDERS AND BAND MANAGEMENT
    renderVerticalSliders() {
        const container = document.getElementById("verticalSlidersContainer");
        if (!container) return;
        
        container.innerHTML = "";

        this.bands.forEach((band, index) => {
            const sliderElement = document.createElement("div");
            sliderElement.className = "vertical-slider-item";
            sliderElement.innerHTML = `
                <div class="slider-header">
                    <h6>${this.getBandName(band.startFreq, band.endFreq)}</h6>
                    <button class="btn btn-sm btn-outline-danger remove-band" data-id="${band.id}">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
                <div class="slider-info">
                    <small class="text-muted">${band.startFreq} - ${band.endFreq} Hz</small>
                </div>
                <div class="vertical-slider-container">
                    <input 
                        type="range" 
                        class="vertical-slider" 
                        orient="vertical"
                        min="0" 
                        max="2" 
                        step="0.1" 
                        value="${band.gain}"
                        data-band-id="${band.id}"
                    >
                    <div class="slider-labels">
                        <span class="gain-value">${band.gain.toFixed(1)}×</span>
                    </div>
                </div>
                <div class="frequency-display">
                    <small>Center: ${Math.round((band.startFreq + band.endFreq) / 2)} Hz</small>
                </div>
            `;

            container.appendChild(sliderElement);

            // Add event listener for the slider
            const slider = sliderElement.querySelector(".vertical-slider");
            slider.addEventListener("input", (e) => {
                if (this.isProcessing) return;
                
                const newGain = parseFloat(e.target.value);
                this.updateBandGain(band.id, newGain);

                // Update display
                const gainValue = sliderElement.querySelector(".gain-value");
                gainValue.textContent = `${newGain.toFixed(1)}×`;

                // Color coding
                if (newGain > 1.0) {
                    gainValue.className = "gain-value text-success";
                } else if (newGain < 1.0) {
                    gainValue.className = "gain-value text-danger";
                } else {
                    gainValue.className = "gain-value text-primary";
                }

                // Add processing visual feedback
                sliderElement.classList.add('slider-processing');
                
                // Trigger real-time processing
                if (this.realTimeProcessing) {
                    this.scheduleRealTimeProcessing();
                }
            });

            // Add event listener for remove button
            const removeBtn = sliderElement.querySelector(".remove-band");
            removeBtn.addEventListener("click", () => {
                this.removeBand(band.id);
            });
        });
    }

    removeProcessingVisualFeedback() {
        document.querySelectorAll('.slider-processing').forEach(element => {
            element.classList.remove('slider-processing');
        });
    }

    updateBandGain(bandId, newGain) {
        const band = this.bands.find((b) => b.id === bandId);
        if (band) {
            band.gain = newGain;
            console.log(`🔧 Updated band ${bandId} gain to ${newGain}`);

            // Update frequency chart immediately
            this.updateFrequencyChart();

            // Process audio if real-time is enabled
            if (this.realTimeProcessing && this.currentAudioFile) {
                this.scheduleRealTimeProcessing();
            }
        }
    }

    scheduleRealTimeProcessing() {
        // Don't schedule if already processing
        if (this.isProcessing) {
            return;
        }

        // Clear any existing timeout
        if (this.processingTimeout) {
            clearTimeout(this.processingTimeout);
        }

        // Schedule new processing
        this.processingTimeout = setTimeout(() => {
            this.processAudioRealTime();
        }, this.processingDelay);
    }

    async processAudioRealTime() {
        if (!this.currentAudioFile || !this.audioData || this.isProcessing) {
            return;
        }

        try {
            console.log("⚡ Real-time audio processing...");
            
            // Show loading indicator
            this.showProcessingLoader();

            const formData = new FormData();
            formData.append("file", this.currentAudioFile);
            formData.append("settings", JSON.stringify({ bands: this.bands }));

            const response = await fetch(`${this.baseURL}/process_audio`, {
                method: "POST",
                body: formData,
            });

            if (response.ok) {
                const blob = await response.blob();
                this.processedAudioUrl = URL.createObjectURL(blob);

                // Extract processed audio data
                await this.extractProcessedAudioData(blob);

                // Update output waveform
                this.updateOutputWaveform();

                // Update spectrograms
                await this.computeOutputSpectrogram();

                console.log("✅ Real-time processing completed");
                this.showNotification("Audio processing completed", "success");
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
        } catch (error) {
            console.error("❌ Real-time processing error:", error);
            this.showNotification("Error processing audio", "error");
        } finally {
            // Always hide loader
            this.hideProcessingLoader();
        }
    }

    async extractProcessedAudioData(blob) {
        return new Promise((resolve, reject) => {
            console.log("🔊 Extracting processed audio data...");

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

        console.log("📈 Updating output waveform...");

        // Calculate the number of samples for 10 seconds
        const targetDuration = 10;
        const maxSamples = Math.min(
            this.processedAudioData.length,
            targetDuration * this.sampleRate
        );

        // Get the first 10 seconds of data
        const displayTime = Array.from(
            { length: maxSamples },
            (_, i) => i / this.sampleRate
        );
        const displayData = this.outputAmplitudeData.slice(0, maxSamples);

        // Limit data points for performance
        let finalDisplayTime = displayTime;
        let finalDisplayData = displayData;

        if (maxSamples > 5000) {
            const step = Math.ceil(maxSamples / 5000);
            finalDisplayTime = displayTime.filter((_, i) => i % step === 0);
            finalDisplayData = displayData.filter((_, i) => i % step === 0);
        }

        const displayDuration = Math.min(this.totalDuration, targetDuration);

        if (this.outputWaveformPlot) {
            Plotly.react(
                this.outputWaveformPlot,
                [
                    {
                        x: finalDisplayTime,
                        y: finalDisplayData,
                        type: "scatter",
                        mode: "lines",
                        line: { color: "#28a745", width: 1.5 },
                        name: "Output Signal",
                    },
                ],
                {
                    xaxis: { range: this.outputXRange },
                    yaxis: { range: this.outputYRange },
                }
            );
        }

        console.log(`✅ Output waveform updated - Displaying ${displayDuration.toFixed(2)} seconds`);
    }

    addBand(startFreq, endFreq, gain = 1.0, bandwidth = null) {
        const band = {
            id: Date.now() + Math.random(),
            startFreq: startFreq,
            endFreq: endFreq,
            gain: gain,
            bandwidth: bandwidth || endFreq - startFreq,
        };

        this.bands.push(band);
        this.renderVerticalSliders();
        this.updateFrequencyChart();

        console.log(`✅ Band added: ${startFreq}-${endFreq}Hz, gain: ${gain}`);

        // Process audio if real-time is enabled
        if (this.realTimeProcessing && this.currentAudioFile) {
            this.scheduleRealTimeProcessing();
        }
    }

    removeBand(bandId) {
        this.bands = this.bands.filter((b) => b.id !== bandId);
        this.renderVerticalSliders();
        this.updateFrequencyChart();

        console.log(`🗑️ Band removed: ${bandId}`);

        // Process audio if real-time is enabled
        if (this.realTimeProcessing && this.currentAudioFile) {
            this.scheduleRealTimeProcessing();
        }
    }

    getBandName(startFreq, endFreq) {
        const centerFreq = (startFreq + endFreq) / 2;
        if (centerFreq <= 60) return "Sub Bass";
        if (centerFreq <= 250) return "Bass";
        if (centerFreq <= 500) return "Low Mid";
        if (centerFreq <= 1000) return "Mid";
        if (centerFreq <= 2000) return "Upper Mid";
        if (centerFreq <= 4000) return "Presence";
        if (centerFreq <= 8000) return "Brilliance";
        return "High End";
    }

    addDefaultBands() {
        console.log("🎛️ Adding default frequency bands...");

        const defaultBands = [
            { startFreq: 20, endFreq: 60, gain: 1.0, bandwidth: 40 },
            { startFreq: 60, endFreq: 250, gain: 1.0, bandwidth: 190 },
            { startFreq: 250, endFreq: 500, gain: 1.0, bandwidth: 250 },
            { startFreq: 500, endFreq: 1000, gain: 1.0, bandwidth: 500 },
            { startFreq: 1000, endFreq: 2000, gain: 1.0, bandwidth: 1000 },
            { startFreq: 2000, endFreq: 4000, gain: 1.0, bandwidth: 2000 },
            { startFreq: 4000, endFreq: 8000, gain: 1.0, bandwidth: 4000 },
            { startFreq: 8000, endFreq: 16000, gain: 1.0, bandwidth: 8000 },
            { startFreq: 16000, endFreq: 20000, gain: 1.0, bandwidth: 4000 },
        ];

        defaultBands.forEach((band) =>
            this.addBand(band.startFreq, band.endFreq, band.gain, band.bandwidth)
        );

        console.log("✅ Default bands added");
    }

    // PLAYHEAD FUNCTIONALITY
    initializePlayheads() {
        console.log("🎯 Initializing playheads...");

        // Create playhead elements
        this.createPlayheadElements();

        // Add click event listeners to waveform plots
        this.addWaveformClickListeners();

        console.log("✅ Playheads initialized");
    }

    createPlayheadElements() {
        // Create input playhead
        this.inputPlayhead = document.createElement("div");
        this.inputPlayhead.className = "playhead";
        this.inputPlayhead.style.display = "none";
        this.inputPlayhead.id = "inputPlayhead";

        // Create output playhead
        this.outputPlayhead = document.createElement("div");
        this.outputPlayhead.className = "playhead";
        this.outputPlayhead.style.display = "none";
        this.outputPlayhead.id = "outputPlayhead";

        // Add playheads to their containers
        const inputPlot = document.getElementById("inputWaveformPlot");
        const outputPlot = document.getElementById("outputWaveformPlot");

        if (inputPlot) {
            inputPlot.style.position = "relative";
            inputPlot.appendChild(this.inputPlayhead);
        }

        if (outputPlot) {
            outputPlot.style.position = "relative";
            outputPlot.appendChild(this.outputPlayhead);
        }
    }

    addWaveformClickListeners() {
        const inputPlot = document.getElementById("inputWaveformPlot");
        const outputPlot = document.getElementById("outputWaveformPlot");

        // Input waveform click handler
        if (inputPlot) {
            inputPlot.on("plotly_click", (data) => {
                if (data.points && data.points[0]) {
                    const clickTime = data.points[0].x;
                    this.seekToTime(clickTime);
                    this.updatePlayheadPosition(clickTime);
                }
            });
        }

        // Output waveform click handler
        if (outputPlot) {
            outputPlot.on("plotly_click", (data) => {
                if (data.points && data.points[0]) {
                    const clickTime = data.points[0].x;
                    this.seekToTime(clickTime);
                    this.updatePlayheadPosition(clickTime);
                }
            });
        }

        // Add drag support for playheads
        this.addPlayheadDragSupport();
    }

    addPlayheadDragSupport() {
        let isDragging = false;

        const startDrag = (event) => {
            if (event.target.classList.contains("playhead")) {
                isDragging = true;
                this.isDraggingPlayhead = true;
                this.dragStartX = event.clientX;
                this.dragStartTime = this.currentTime;
                document.addEventListener("mousemove", doDrag);
                document.addEventListener("mouseup", stopDrag);
                event.preventDefault();
            }
        };

        const doDrag = (event) => {
            if (!isDragging) return;

            const plotRect = this.inputWaveformPlot.getBoundingClientRect();
            const plotWidth = plotRect.width;
            const deltaX = event.clientX - this.dragStartX;
            const timePerPixel = this.totalDuration / plotWidth;
            const newTime = this.dragStartTime + deltaX * timePerPixel;

            // Constrain to valid time range
            const constrainedTime = Math.max(0, Math.min(newTime, this.totalDuration));

            this.seekToTime(constrainedTime);
            this.updatePlayheadPosition(constrainedTime);
        };

        const stopDrag = () => {
            isDragging = false;
            this.isDraggingPlayhead = false;
            document.removeEventListener("mousemove", doDrag);
            document.removeEventListener("mouseup", stopDrag);
        };

        // Add event listeners to playheads
        if (this.inputPlayhead) {
            this.inputPlayhead.addEventListener("mousedown", startDrag);
        }
        if (this.outputPlayhead) {
            this.outputPlayhead.addEventListener("mousedown", startDrag);
        }
    }

    updatePlaybackPosition() {
        if (this.isDraggingPlayhead) return; // Don't update during drag

        // Update time displays
        const inputPositionElement = document.getElementById("inputPosition");
        const outputPositionElement = document.getElementById("outputPosition");

        if (inputPositionElement) inputPositionElement.textContent = this.currentTime.toFixed(2);
        if (outputPositionElement) outputPositionElement.textContent = this.currentTime.toFixed(2);

        // Update playhead positions
        this.updatePlayheadPosition(this.currentTime);
    }

    updatePlayheadPosition(time) {
        if (!this.inputPlayhead || !this.outputPlayhead || !this.totalDuration) return;

        const inputPlot = document.getElementById("inputWaveformPlot");
        const outputPlot = document.getElementById("outputWaveformPlot");

        if (!inputPlot || !outputPlot) return;

        const inputRect = inputPlot.getBoundingClientRect();
        const outputRect = outputPlot.getBoundingClientRect();

        // Calculate position as percentage of total duration
        const positionPercent = (time / this.totalDuration) * 100;
        const positionPx = (positionPercent / 100) * inputRect.width;

        // Update input playhead
        this.inputPlayhead.style.left = `${positionPx}px`;
        this.inputPlayhead.style.display = "block";

        // Update output playhead
        this.outputPlayhead.style.left = `${positionPx}px`;
        this.outputPlayhead.style.display = "block";

        // Add playing class if audio is playing
        const isPlaying = this.inputSource || this.outputSource;
        if (isPlaying) {
            this.inputPlayhead.classList.add("playing");
            this.outputPlayhead.classList.add("playing");
        } else {
            this.inputPlayhead.classList.remove("playing");
            this.outputPlayhead.classList.remove("playing");
        }
    }

    // PLAYBACK CONTROLS
    playInput() {
        if (!this.inputAudioBuffer) {
            this.showNotification("No input audio loaded", "error");
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

            this.startPlaybackTracking("input");
            this.showNotification("Playing input audio", "info");
        } catch (error) {
            console.error("Error playing input audio:", error);
            this.showNotification("Error playing input audio", "error");
        }
    }

    playOutput() {
        if (!this.outputAudioBuffer) {
            this.showNotification("No processed audio available. Please process audio first.", "error");
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

            this.startPlaybackTracking("output");
            this.showNotification("Playing output audio", "info");
        } catch (error) {
            console.error("Error playing output audio:", error);
            this.showNotification("Error playing output audio", "error");
        }
    }

    playAll() {
        if (!this.inputAudioBuffer) {
            this.showNotification("No audio loaded", "error");
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

            this.startPlaybackTracking("both");
            this.showNotification("Playing both audio signals", "info");
        } catch (error) {
            console.error("Error playing audio:", error);
            this.showNotification("Error playing audio", "error");
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
        this.showNotification("Playback paused", "info");
    }

    stopAll() {
        this.pauseAll();
        this.currentTime = 0;
        this.updatePlaybackPosition();

        // Hide playheads when stopped
        if (this.inputPlayhead) {
            this.inputPlayhead.style.display = "none";
        }
        if (this.outputPlayhead) {
            this.outputPlayhead.style.display = "none";
        }

        this.showNotification("Playback stopped", "info");
    }

    pauseInput() {
        if (this.inputSource) {
            this.inputSource.stop();
            this.inputSource = null;
            this.showNotification("Input audio paused", "info");
        }
    }

    stopInput() {
        this.pauseInput();
        this.currentTime = 0;
        this.updatePlaybackPosition();
        this.showNotification("Input audio stopped", "info");
    }

    pauseOutput() {
        if (this.outputSource) {
            this.outputSource.stop();
            this.outputSource = null;
            this.showNotification("Output audio paused", "info");
        }
    }

    stopOutput() {
        this.pauseOutput();
        this.currentTime = 0;
        this.updatePlaybackPosition();
        this.showNotification("Output audio stopped", "info");
    }

    startPlaybackTracking(type) {
        this.stopPlaybackTracking();

        // Show playheads when playback starts
        if (this.inputPlayhead) {
            this.inputPlayhead.style.display = "block";
        }
        if (this.outputPlayhead) {
            this.outputPlayhead.style.display = "block";
        }

        this.playbackInterval = setInterval(() => {
            if (this.isDraggingPlayhead) return; // Don't update during drag

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

        console.log(`⏱️ Seeked to: ${time.toFixed(2)}s`);
    }

    // ADD BAND MODAL FUNCTIONALITY
    initializeAddBandModal() {
        console.log("🎛️ Initializing add band modal...");

        // Initialize Bootstrap modal
        const addBandModalElement = document.getElementById("addBandModal");
        if (addBandModalElement) {
            this.addBandModal = new bootstrap.Modal(addBandModalElement);

            // Initialize frequency range slider
            this.initializeFrequencyRangeSlider();

            // Event listeners for modal
            const confirmAddBand = document.getElementById("confirmAddBand");
            if (confirmAddBand) {
                confirmAddBand.addEventListener("click", () => {
                    this.confirmAddBand();
                });
            }

            // Gain slider listener
            const bandGain = document.getElementById("bandGain");
            if (bandGain) {
                bandGain.addEventListener("input", (e) => {
                    const gain = parseFloat(e.target.value);
                    const gainValue = document.getElementById("gainValue");
                    if (gainValue) gainValue.textContent = gain.toFixed(1);

                    // Update gain meter visualization
                    const gainFill = document.getElementById("gainFill");
                    if (gainFill) {
                        const fillHeight = (gain / 2) * 100; // 0-2 range maps to 0-100%
                        gainFill.style.height = `${fillHeight}%`;

                        // Update color based on gain value
                        if (gain > 1.0) {
                            gainFill.style.background = "linear-gradient(to top, #28a745, #ffc107)";
                        } else if (gain < 1.0) {
                            gainFill.style.background = "linear-gradient(to top, #dc3545, #ffc107)";
                        } else {
                            gainFill.style.background = "linear-gradient(to top, #17a2b8, #28a745)";
                        }
                    }
                });
            }
        }

        console.log("✅ Add band modal initialized");
    }

    initializeFrequencyRangeSlider() {
        console.log("🎛️ Initializing frequency range slider...");

        // Create the dual-handle range slider
        const slider = document.getElementById("frequencyRangeSlider");
        if (slider && typeof noUiSlider !== 'undefined') {
            noUiSlider.create(slider, {
                start: [1000, 2000],
                connect: true,
                range: {
                    min: 20,
                    max: 20000,
                },
                step: 10,
                tooltips: [true, true],
                format: {
                    to: function (value) {
                        return Math.round(value);
                    },
                    from: function (value) {
                        return Number(value);
                    },
                },
            });

            // Update the display when slider values change
            slider.noUiSlider.on("update", (values, handle) => {
                const startFreq = Math.round(values[0]);
                const endFreq = Math.round(values[1]);

                // Update hidden inputs
                const startFreqInput = document.getElementById("startFreq");
                const endFreqInput = document.getElementById("endFreq");
                if (startFreqInput) startFreqInput.value = startFreq;
                if (endFreqInput) endFreqInput.value = endFreq;

                // Update display
                const currentRangeDisplay = document.getElementById("currentRangeDisplay");
                if (currentRangeDisplay) {
                    currentRangeDisplay.textContent = `${startFreq} - ${endFreq} Hz`;
                }

                // Update band info
                this.updateBandInfo();
            });
        }

        console.log("✅ Frequency range slider initialized");
    }

    updateBandInfo() {
        const startFreq = parseInt(document.getElementById("startFreq")?.value) || 100;
        const endFreq = parseInt(document.getElementById("endFreq")?.value) || 1000;

        // Validate and fix range if needed
        if (startFreq >= endFreq) {
            const endFreqInput = document.getElementById("endFreq");
            if (endFreqInput) endFreqInput.value = startFreq + 100;
            return this.updateBandInfo();
        }

        const bandwidth = endFreq - startFreq;
        const centerFreq = Math.round((startFreq + endFreq) / 2);
        const bandType = this.getBandName(startFreq, endFreq);

        const bandwidthValue = document.getElementById("bandwidthValue");
        const centerFreqValue = document.getElementById("centerFreqValue");
        const bandTypeElement = document.getElementById("bandType");

        if (bandwidthValue) bandwidthValue.textContent = bandwidth;
        if (centerFreqValue) centerFreqValue.textContent = centerFreq;
        if (bandTypeElement) bandTypeElement.textContent = bandType;
    }

    openAddBandModal() {
        console.log("🎛️ Opening add band modal...");

        // Reset to default values
        const slider = document.getElementById("frequencyRangeSlider");
        if (slider && slider.noUiSlider) {
            slider.noUiSlider.set([1000, 2000]);
        }

        const bandGain = document.getElementById("bandGain");
        if (bandGain) bandGain.value = 1.0;

        const gainValue = document.getElementById("gainValue");
        if (gainValue) gainValue.textContent = "1.0";

        // Update gain meter visualization
        const gainFill = document.getElementById("gainFill");
        if (gainFill) {
            gainFill.style.height = "50%";
            gainFill.style.background = "linear-gradient(to top, #17a2b8, #28a745)";
        }

        // Update displays
        this.updateBandInfo();

        // Show modal
        if (this.addBandModal) {
            this.addBandModal.show();
        }
    }

    confirmAddBand() {
        const startFreq = parseInt(document.getElementById("startFreq")?.value);
        const endFreq = parseInt(document.getElementById("endFreq")?.value);
        const gain = parseFloat(document.getElementById("bandGain")?.value);

        // Validation with proper NaN checks
        if (isNaN(startFreq) || isNaN(endFreq) || isNaN(gain)) {
            this.showNotification("Please enter valid frequency values", "error");
            return;
        }

        if (startFreq >= endFreq) {
            this.showNotification("Start frequency must be less than end frequency", "error");
            return;
        }

        if (startFreq < 20 || endFreq > 20000) {
            this.showNotification("Frequency range must be between 20Hz and 20,000Hz", "error");
            return;
        }

        // Add the band
        this.addBand(startFreq, endFreq, gain);

        // Close modal
        if (this.addBandModal) {
            this.addBandModal.hide();
        }

        this.showNotification(
            `Added ${this.getBandName(startFreq, endFreq)} band (${startFreq}-${endFreq}Hz)`,
            "success"
        );
    }

    // PROCESSING LOADER
    initializeProcessingLoader() {
        console.log("🔄 Initializing processing loader...");
        const processingLoaderElement = document.getElementById('processingLoader');
        if (processingLoaderElement) {
            this.processingLoader = new bootstrap.Modal(processingLoaderElement, {
                keyboard: false,
                backdrop: 'static'
            });
        }
        console.log("✅ Processing loader initialized");
    }

    showProcessingLoader() {
        if (this.processingLoader) {
            this.isProcessing = true;
            this.processingLoader.show();
            
            // Add disabled state to controls
            document.querySelectorAll('.vertical-slider, #addBand, #exportAudio').forEach(element => {
                element.classList.add('equalizer-disabled');
            });
        }
    }

    hideProcessingLoader() {
        if (this.processingLoader) {
            this.isProcessing = false;
            this.processingLoader.hide();
            
            // Remove disabled state from controls
            document.querySelectorAll('.vertical-slider, #addBand, #exportAudio').forEach(element => {
                element.classList.remove('equalizer-disabled');
            });
            
            // Remove processing visual feedback
            this.removeProcessingVisualFeedback();
        }
    }

    // PRESET MANAGEMENT
    async loadPresetsList() {
        try {
            console.log("📋 Loading presets list...");

            const response = await fetch(`${this.baseURL}/list_presets`);
            if (response.ok) {
                const data = await response.json();
                const presetList = document.getElementById("presetList");

                if (presetList) {
                    presetList.innerHTML = '<option value="">Select preset...</option>';

                    if (data.presets && data.presets.length > 0) {
                        data.presets.forEach((preset) => {
                            const option = document.createElement("option");
                            option.value = preset.name;
                            option.textContent = preset.name;
                            if (preset.description) {
                                option.title = preset.description;
                            }
                            presetList.appendChild(option);
                        });
                        console.log(`✅ Loaded ${data.presets.length} presets`);
                    } else {
                        console.log("📝 No presets found");
                    }
                }
            }
        } catch (error) {
            console.error("❌ Error loading presets:", error);
        }
    }

    async loadPreset(presetName) {
        try {
            console.log(`📥 Loading preset: ${presetName}`);

            const response = await fetch(
                `${this.baseURL}/load_preset?name=${encodeURIComponent(presetName)}`
            );
            if (response.ok) {
                const preset = await response.json();
                if (preset.bands && Array.isArray(preset.bands)) {
                    this.bands = preset.bands;
                    this.currentPreset = presetName;
                    const presetNameInput = document.getElementById("presetName");
                    if (presetNameInput) presetNameInput.value = presetName;
                    this.renderVerticalSliders();
                    this.updateFrequencyChart();

                    // Process audio if real-time is enabled
                    if (this.realTimeProcessing && this.currentAudioFile) {
                        this.scheduleRealTimeProcessing();
                    }

                    this.showNotification(`Preset "${presetName}" loaded!`, "success");
                    console.log(`✅ Preset loaded: ${presetName} with ${preset.bands.length} bands`);
                } else {
                    throw new Error("Invalid preset structure");
                }
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
        } catch (error) {
            console.error("❌ Error loading preset:", error);
            this.showNotification(`Failed to load preset "${presetName}"`, "error");
        }
    }

    async savePreset() {
        const presetNameInput = document.getElementById("presetName");
        const presetName = presetNameInput ? presetNameInput.value.trim() : '';

        if (!presetName) {
            this.showNotification("Please enter a preset name", "error");
            return;
        }

        if (this.bands.length === 0) {
            this.showNotification("No frequency bands configured", "error");
            return;
        }

        try {
            console.log(`💾 Saving preset: ${presetName}`);

            const response = await fetch(`${this.baseURL}/save_preset`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: presetName,
                    bands: this.bands,
                    description: `Custom equalizer preset with ${this.bands.length} bands`,
                }),
            });

            if (response.ok) {
                this.currentPreset = presetName;
                await this.loadPresetsList();
                const presetList = document.getElementById("presetList");
                if (presetList) presetList.value = presetName;
                this.showNotification(`Preset "${presetName}" saved successfully!`, "success");
                console.log(`✅ Preset saved: ${presetName}`);
            } else {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to save preset");
            }
        } catch (error) {
            console.error("❌ Error saving preset:", error);
            this.showNotification(`Failed to save preset: ${error.message}`, "error");
        }
    }

    async updatePreset() {
        const presetNameInput = document.getElementById("presetName");
        const presetName = presetNameInput ? presetNameInput.value.trim() : '';

        if (!presetName) {
            this.showNotification("Please select a preset to update", "error");
            return;
        }

        if (this.bands.length === 0) {
            this.showNotification("No frequency bands configured", "error");
            return;
        }

        try {
            console.log(`🔄 Updating preset: ${presetName}`);

            // For update, we'll delete and recreate the preset
            const deleteResponse = await fetch(
                `${this.baseURL}/delete_preset?name=${encodeURIComponent(presetName)}`,
                {
                    method: "DELETE",
                }
            );

            if (deleteResponse.ok) {
                const saveResponse = await fetch(`${this.baseURL}/save_preset`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: presetName,
                        bands: this.bands,
                        description: `Updated equalizer preset with ${this.bands.length} bands`,
                    }),
                });

                if (saveResponse.ok) {
                    await this.loadPresetsList();
                    this.showNotification(`Preset "${presetName}" updated successfully!`, "success");
                    console.log(`✅ Preset updated: ${presetName}`);
                } else {
                    throw new Error("Failed to save updated preset");
                }
            } else {
                throw new Error("Failed to delete old preset");
            }
        } catch (error) {
            console.error("❌ Error updating preset:", error);
            this.showNotification(`Failed to update preset: ${error.message}`, "error");
        }
    }

    async deletePreset() {
        const presetNameInput = document.getElementById("presetName");
        const presetName = presetNameInput ? presetNameInput.value.trim() : '';

        if (!presetName) {
            this.showNotification("Please select a preset to delete", "error");
            return;
        }

        if (!confirm(`Are you sure you want to delete the preset "${presetName}"?`)) {
            return;
        }

        try {
            console.log(`🗑️ Deleting preset: ${presetName}`);

            const response = await fetch(
                `${this.baseURL}/delete_preset?name=${encodeURIComponent(presetName)}`,
                {
                    method: "DELETE",
                }
            );

            if (response.ok) {
                this.currentPreset = null;
                if (presetNameInput) presetNameInput.value = "";
                const presetList = document.getElementById("presetList");
                if (presetList) presetList.value = "";
                await this.loadPresetsList();
                this.showNotification(`Preset "${presetName}" deleted successfully!`, "success");
                console.log(`✅ Preset deleted: ${presetName}`);
            } else {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to delete preset");
            }
        } catch (error) {
            console.error("❌ Error deleting preset:", error);
            this.showNotification(`Failed to delete preset: ${error.message}`, "error");
        }
    }

    // UTILITY FUNCTIONS
    showFileInfo(file) {
        const fileInfo = document.getElementById("fileInfo");
        if (!fileInfo) return;
        
        const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
        const fileExt = file.name.split(".").pop().toUpperCase();

        fileInfo.innerHTML = `
            <div class="file-info p-2 bg-light rounded">
                <small class="text-muted">
                    <strong>File:</strong> ${file.name}<br>
                    <strong>Type:</strong> ${fileExt}<br>
                    <strong>Size:</strong> ${sizeMB} MB<br>
                    <strong>Duration:</strong> ${this.totalDuration ? this.totalDuration.toFixed(2) + 's' : 'Loading...'}
                </small>
            </div>
        `;
    }

    resetViewAll() {
        if (!this.audioData) return;

        console.log("🔄 Resetting all views...");

        const duration = this.totalDuration;

        if (this.inputWaveformPlot) {
            Plotly.relayout(this.inputWaveformPlot, {
                "xaxis.range": [0, duration],
                "yaxis.range": [-1, 1],
            });
        }

        if (this.outputWaveformPlot) {
            Plotly.relayout(this.outputWaveformPlot, {
                "xaxis.range": [0, duration],
                "yaxis.range": [-1, 1],
            });
        }

        this.inputXRange = [0, duration];
        this.outputXRange = [0, duration];
        this.inputYRange = [-1, 1];
        this.outputYRange = [-1, 1];

        this.showNotification("View reset", "info");
    }

    resetGraph() {
        console.log("🔄 Resetting frequency graph...");

        if (this.frequencyChart) {
            Plotly.relayout(this.frequencyChart, {
                "xaxis.range": null,
                "yaxis.range": null,
            });
        }

        this.showNotification("Frequency graph reset", "info");
    }

    exportSpectrum() {
        // Export frequency spectrum as image
        if (this.frequencyChart) {
            Plotly.downloadImage(this.frequencyChart, {
                format: "png",
                width: 1200,
                height: 600,
                filename: "frequency_spectrum",
            });
            this.showNotification("Frequency spectrum exported as PNG", "success");
        }
    }

    exportSpectrograms() {
        // Export both spectrograms
        if (this.inputSpectrogram) {
            Plotly.downloadImage(this.inputSpectrogram, {
                format: "png",
                width: 800,
                height: 600,
                filename: "input_spectrogram",
            });
        }

        setTimeout(() => {
            if (this.outputSpectrogram) {
                Plotly.downloadImage(this.outputSpectrogram, {
                    format: "png",
                    width: 800,
                    height: 600,
                    filename: "output_spectrogram",
                });
            }
        }, 500);

        this.showNotification("Spectrograms exported as PNG", "success");
    }

    async generateTestSignal() {
        this.showNotification("Generating test signal...", "info");

        try {
            console.log("🎵 Generating test signal...");

            const response = await fetch(`${this.baseURL}/generate_test_signal`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    frequencies: [100, 250, 500, 1000, 2000, 4000, 8000],
                    duration: 5.0,
                    sample_rate: 44100,
                    amplitude: 0.8,
                }),
            });

            if (response.ok) {
                const blob = await response.blob();

                // Create a File object from the blob
                const file = new File([blob], "test_signal.wav", { type: "audio/wav" });
                await this.handleFileUpload(file);

                this.showNotification("Test signal generated successfully!", "success");
            } else {
                const errorText = await response.text();
                throw new Error(`Server error: ${errorText}`);
            }
        } catch (error) {
            console.error("❌ Error generating test signal:", error);
            this.showNotification("Error generating test signal. Please check backend connection.", "error");
        }
    }
}

// Initialize the application when the page loads
document.addEventListener("DOMContentLoaded", () => {
    console.log("🚀 Starting Generic Equalizer Application...");

    if (typeof Plotly === "undefined") {
        console.error("❌ Plotly.js is not loaded!");
        alert("Error: Plotly.js library is required but not loaded. Please check your internet connection and refresh the page.");
        return;
    }

    // Check if general mode is available
    if (typeof window.generalMode === 'undefined') {
        console.warn("⚠️ General mode not available, running in standalone mode");
    }

    const equalizer = new GenericEqualizer();
    equalizer.initializeApp();

    // Make it globally available for debugging
    window.equalizer = equalizer;

    console.log("✅ Generic Equalizer started successfully!");
});