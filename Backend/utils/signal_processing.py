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
        Apply equalization with multiple frequency bands per slider - FIXED
        """
        print(f"🔧 Starting equalizer: signal length={len(signal)}, sample_rate={sample_rate}")
        print(f"🎚️ Slider config: {len(sliders_config)} sliders")
        
        # Apply FFT to convert to frequency domain
        print("🌀 Computing FFT...")
        fft_result = np.array(SignalProcessor.custom_fft(signal))
        freqs = np.fft.fftfreq(len(fft_result), 1/sample_rate)
        print(f"✅ FFT computed: {len(fft_result)} frequency bins")
        
        # Create frequency mask (start with no changes)
        frequency_mask = np.ones(len(fft_result), dtype=complex)
        
        # Apply each slider's gain to its frequency bands
        for i, (slider_config, gain) in enumerate(zip(sliders_config, slider_values)):
            frequency_bands = slider_config['frequency_bands']
            print(f"🎛️ Processing slider {i}: '{slider_config['name']}' with gain {gain}")
            print(f"   Frequency bands: {frequency_bands}")
            
            for band_idx, band in enumerate(frequency_bands):
                low_freq, high_freq = band
                
                # Find indices in this frequency range (positive frequencies only)
                indices = np.where((freqs >= low_freq) & (freqs <= high_freq))[0]
                
                # Apply the gain to these frequency components
                frequency_mask[indices] *= gain
                
                # Also apply to negative frequencies (symmetric)
                neg_indices = np.where((freqs >= -high_freq) & (freqs <= -low_freq))[0]
                frequency_mask[neg_indices] *= gain
                
                print(f"   Band {band_idx}: {low_freq}-{high_freq}Hz -> {len(indices)} bins affected")
        
        # Apply the frequency mask
        print("🎨 Applying frequency mask...")
        modified_fft = fft_result * frequency_mask
        
        # Convert back to time domain
        print("🔄 Computing inverse FFT...")
        processed_signal = np.real(SignalProcessor.custom_ifft(modified_fft))
        
        # Normalize to prevent clipping
        if np.max(np.abs(processed_signal)) > 0:
            max_val = np.max(np.abs(processed_signal))
            processed_signal = processed_signal / max_val
            print(f"📏 Normalized signal (max amplitude: {max_val:.3f})")
        
        print(f"✅ Equalizer completed. Output signal length: {len(processed_signal)}")
        return processed_signal
    
    @staticmethod
    def compute_spectrogram(signal, window_size=1024, hop_size=512, sample_rate=44100):
        """Generate spectrogram using custom FFT - Returns 2D array with time and frequency axes"""
        print(f"📊 Computing spectrogram: signal={len(signal)}, window={window_size}, hop={hop_size}")
        
        # Ensure signal length is sufficient
        if len(signal) < window_size:
            signal = np.pad(signal, (0, window_size - len(signal)))
        
        num_frames = (len(signal) - window_size) // hop_size + 1
        spectrogram = []
        
        # Calculate time axis
        time_axis = np.arange(num_frames) * hop_size / sample_rate
        
        # Calculate frequency axis (only positive frequencies)
        freq_axis = np.fft.fftfreq(window_size, 1/sample_rate)[:window_size // 2]
        
        print(f"📈 Spectrogram frames: {num_frames}, frequency bins: {len(freq_axis)}")
        
        for i in range(num_frames):
            start = i * hop_size
            end = start + window_size
            window = signal[start:end] * np.hanning(window_size)
            fft_frame = np.abs(SignalProcessor.custom_fft(window))
            magnitude = np.abs(fft_frame[:window_size // 2])
            spectrogram.append(magnitude)
        
        spectrogram_array = np.array(spectrogram).T
        print(f"✅ Spectrogram computed: shape {spectrogram_array.shape}")
        return spectrogram_array, time_axis, freq_axis