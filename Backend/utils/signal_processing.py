import numpy as np
import json
import os

class SignalProcessor:
    """Custom FFT and signal processing implementation without external libraries"""
    
    @staticmethod
    def custom_fft(x):
        """Custom FFT implementation using Cooley-Tukey algorithm"""
        n = len(x)
        if n <= 1:
            return x
        even = SignalProcessor.custom_fft(x[0::2])
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
    def apply_frequency_filter(signal, frequency_mask):
        """Apply frequency domain filtering"""
        fft_result = SignalProcessor.custom_fft(signal)
        modified_fft = fft_result * frequency_mask
        return np.real(SignalProcessor.custom_ifft(modified_fft))
    
    @staticmethod
    def generate_frequency_mask(signal_length, frequency_bands, gains, sample_rate=44100):
        """Generate frequency mask based on bands and gains"""
        freqs = np.fft.fftfreq(signal_length, 1/sample_rate)
        mask = np.ones(signal_length, dtype=complex)
        
        for band, gain in zip(frequency_bands, gains):
            for freq_range in band:
                low_freq, high_freq = freq_range
                # Find indices in this frequency range
                indices = np.where((np.abs(freqs) >= low_freq) & (np.abs(freqs) <= high_freq))[0]
                mask[indices] *= gain
                
        return mask
    
    @staticmethod
    def compute_spectrogram(signal, window_size=1024, hop_size=512, sample_rate=44100):
        """Generate spectrogram using custom FFT"""
        num_frames = (len(signal) - window_size) // hop_size + 1
        spectrogram = []
        
        for i in range(num_frames):
            start = i * hop_size
            end = start + window_size
            window = signal[start:end] * np.hanning(window_size)
            fft_frame = np.abs(SignalProcessor.custom_fft(window))[:window_size//2]
            spectrogram.append(fft_frame)
        
        return np.array(spectrogram).T