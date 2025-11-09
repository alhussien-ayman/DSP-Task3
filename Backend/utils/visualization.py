import numpy as np

class VisualizationUtils:
    """Visualization utilities for signals and spectrograms"""
    
    @staticmethod
    def linear_to_audiogram(frequencies, values):
        """Convert linear frequency scale to audiogram scale"""
        print(f"🎧 Converting to audiogram scale: {len(frequencies)} frequency points")
        # Audiogram uses logarithmic-like scale for human hearing
        audiogram_freqs = 20 * (2 ** (frequencies / 1200))  # Simplified approximation
        return audiogram_freqs, values
    
    @staticmethod
    def prepare_spectrogram_data(spectrogram, frequencies, scale='linear'):
        """Prepare spectrogram data for frequency spectrum visualization"""
        print(f"📊 Preparing spectrogram data: scale={scale}, shape={spectrogram.shape}")
        
        if spectrogram.size == 0:
            return {'frequencies': [], 'magnitudes': []}
            
        # Take mean across time for magnitude spectrum
        magnitudes = np.mean(spectrogram, axis=1)
        
        if scale == 'audiogram':
            print("🔄 Converting to audiogram scale...")
            frequencies, magnitudes = VisualizationUtils.linear_to_audiogram(frequencies, magnitudes)
        
        # Convert to list for JSON serialization
        result = {
            'frequencies': frequencies.tolist(),
            'magnitudes': magnitudes.tolist()
        }
        print(f"✅ Spectrum data prepared: {len(result['frequencies'])} frequency points")
        return result
    
    @staticmethod
    def prepare_spectrogram_2d(spectrogram, time_axis, freq_axis):
        """Prepare 2D spectrogram data for heatmap visualization"""
        print(f"🔥 Preparing 2D spectrogram: shape={spectrogram.shape}")
        
        if spectrogram.size == 0:
            return {'z': [[]], 'x': [], 'y': []}
        
        # Convert to dB scale for better visualization
        spectrogram_db = 10 * np.log10(spectrogram + 1e-10)  # Add small value to avoid log(0)
        
        result = {
            'z': spectrogram_db.tolist(),
            'x': time_axis.tolist(),
            'y': freq_axis.tolist()
        }
        print(f"✅ 2D spectrogram prepared: {len(result['x'])} time points, {len(result['y'])} freq points")
        return result
    
    @staticmethod
    def prepare_signal_data(signal, sample_rate):
        """Prepare signal data for visualization"""
        print(f"📈 Preparing signal data: {len(signal)} samples")
        
        time_axis = np.linspace(0, len(signal) / sample_rate, len(signal))
        
        # Sample for performance (show every 100th point for smooth plotting)
        step = max(1, len(signal) // 1000)
        sampled_time = time_axis[::step]
        sampled_amplitude = signal[::step]
        
        result = {
            'time': sampled_time.tolist(),
            'amplitude': sampled_amplitude.tolist()
        }
        print(f"✅ Signal data prepared: {len(result['time'])} points")
        return result