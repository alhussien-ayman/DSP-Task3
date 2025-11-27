import numpy as np
from typing import List, Union , Dict
from math import log10

class VisualizationUtils:
    """Visualization utilities for signals and spectrograms"""
    
   
    @staticmethod
    def linear_to_audiogram(
    frequencies: Union[List[float], np.ndarray],
        values: Union[List[float], np.ndarray]
    ) -> Dict[str, List[float]]:
        """
        Convert a linear magnitude spectrum → audiogram-style plot
        (0 dB HL = peak of the signal)
        """
        freq = np.asarray(frequencies, dtype=float)
        mag  = np.asarray(values, dtype=float)

        if freq.shape != mag.shape:
            raise ValueError("frequencies and values must have the same length")

        # Prevent log(0) or log(negative)
        mag_clipped = np.where(mag <= 0, 1e-10, mag)

        # Linear magnitude → dB FS
        magnitude_db_fs = 20.0 * np.log10(mag_clipped)
        magnitude_db_fs = np.clip(magnitude_db_fs, -120.0, None)

        # Normalize so the peak becomes 0 dB HL (exactly what people want for "audiogram" plots)
        peak_db = np.max(magnitude_db_fs)
        magnitude_db_hl = magnitude_db_fs - peak_db

        return {
            "frequencies":       freq.tolist(),
            "magnitude_linear":  mag.tolist(),
            "magnitude_db_fs":   magnitude_db_fs.tolist(),
            "magnitude_db_hl":   magnitude_db_hl.tolist(),   # this is the one you plot!
            "peak_db_fs":        float(peak_db)
        }
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
            audiogram_data = VisualizationUtils.linear_to_audiogram(frequencies, magnitudes)
            # Return the dB HL values for audiogram display
            result = {
                'frequencies': audiogram_data['frequencies'],
                'magnitudes': audiogram_data['magnitude_db_hl']  # Use dB HL values
            }
        else:
            # Linear scale - return original magnitudes
            result = {
                'frequencies': frequencies.tolist(),
                'magnitudes': magnitudes.tolist()
            }
        
        print(f"✅ Spectrum data prepared: {len(result['frequencies'])} frequency points, scale={scale}")
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