import numpy as np

class VisualizationUtils:
    """Visualization utilities for signals and spectrograms"""
    
    @staticmethod
    def linear_to_audiogram(frequencies, values):
        """Convert linear frequency scale to audiogram scale"""
        # Audiogram uses logarithmic-like scale for human hearing
        audiogram_freqs = 20 * (2 ** (frequencies / 1200))  # Simplified approximation
        return audiogram_freqs, values
    
    @staticmethod
    def prepare_spectrogram_data(spectrogram, scale='linear'):
        """Prepare spectrogram data for visualization"""
        if spectrogram.size == 0:
            return {'frequencies': [], 'magnitudes': []}
            
        freqs = np.linspace(0, 22050, spectrogram.shape[0])
        
        if scale == 'audiogram':
            freqs, spectrogram = VisualizationUtils.linear_to_audiogram(freqs, spectrogram)
        
        # Convert to list for JSON serialization
        return {
            'frequencies': freqs.tolist(),
            'magnitudes': spectrogram.tolist()
        }
    
    @staticmethod
    def prepare_signal_data(signal, sample_rate):
        """Prepare signal data for visualization"""
        time_axis = np.linspace(0, len(signal) / sample_rate, len(signal))
        
        # Sample for performance (show every 10th point)
        sampled_time = time_axis[::10]
        sampled_amplitude = signal[::10]
        
        return {
            'time': sampled_time.tolist(),
            'amplitude': sampled_amplitude.tolist()
        }
    