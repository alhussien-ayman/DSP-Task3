import numpy as np
import math

class SignalProcessor:
    """Custom signal processing without external libraries"""
    
    @staticmethod
    def custom_fft(x):
        """Custom FFT implementation using Cooley-Tukey algorithm"""
        n = len(x)
        if n <= 1:
            return x
        
        # Pad to next power of 2 if needed
        next_power = 2 ** math.ceil(math.log2(n))
        if n != next_power:
            x = np.pad(x, (0, next_power - n))
            n = next_power
        
        # Recursive FFT
        even = SignalProcessor.custom_fft(x[::2])
        odd = SignalProcessor.custom_fft(x[1::2])
        
        T = [np.exp(-2j * np.pi * k / n) * odd[k] for k in range(n // 2)]
        return [even[k] + T[k] for k in range(n // 2)] + [even[k] - T[k] for k in range(n // 2)]
    
    @staticmethod
    def custom_ifft(x):
        """Custom Inverse FFT implementation"""
        n = len(x)
        conj = np.conjugate(x)
        transform = SignalProcessor.custom_fft(conj)
        return np.conjugate(transform) / n
    
    @staticmethod
    def apply_multi_band_equalizer(signal, sliders_config, slider_values, sample_rate=44100):
        """
        Apply equalization with multiple frequency bands per slider
        
        Args:
            signal: Input audio signal
            sliders_config: List of slider configurations from JSON
            slider_values: Current values for each slider [0-2]
            sample_rate: Audio sample rate
        """
        # Apply FFT to convert to frequency domain
        fft_result = np.array(SignalProcessor.custom_fft(signal))
        freqs = np.fft.fftfreq(len(fft_result), 1/sample_rate)
        
        # Create frequency mask (start with no changes)
        frequency_mask = np.ones(len(fft_result), dtype=complex)
        
        # Apply each slider's gain to its frequency bands
        for i, (slider_config, gain) in enumerate(zip(sliders_config, slider_values)):
            frequency_bands = slider_config['frequency_bands']
            
            for band in frequency_bands:
                low_freq, high_freq = band
                
                # Find indices in this frequency range
                indices = np.where((np.abs(freqs) >= low_freq) & (np.abs(freqs) <= high_freq))[0]
                
                # Apply the gain to these frequency components
                frequency_mask[indices] *= gain
        
        # Apply the frequency mask
        modified_fft = fft_result * frequency_mask
        
        # Convert back to time domain
        processed_signal = np.real(SignalProcessor.custom_ifft(modified_fft))
        
        return processed_signal
    
    @staticmethod
    def compute_spectrogram(signal, window_size=1024, hop_size=512, sample_rate=44100):
        """Generate spectrogram using custom FFT"""
        # Ensure signal length is sufficient
        if len(signal) < window_size:
            signal = np.pad(signal, (0, window_size - len(signal)))
        
        num_frames = (len(signal) - window_size) // hop_size + 1
        spectrogram = []
        
        for i in range(num_frames):
            start = i * hop_size
            end = start + window_size
            window = signal[start:end] * np.hanning(window_size)
            fft_frame = np.abs(SignalProcessor.custom_fft(window))
            magnitude = np.abs(fft_frame[:window_size // 2])
            spectrogram.append(magnitude)
        
        return np.array(spectrogram).T