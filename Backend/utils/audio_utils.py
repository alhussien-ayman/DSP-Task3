import numpy as np
import scipy.io.wavfile as wavfile
import io
import json

class AudioUtils:
    """Audio processing utilities"""
    
    @staticmethod
    def load_audio_file(file):
        """Load audio file and return signal data"""
        sample_rate, audio_data = wavfile.read(file)
        
        # Convert to mono if stereo
        if len(audio_data.shape) > 1:
            audio_data = np.mean(audio_data, axis=1)
        
        # Normalize
        audio_data = audio_data.astype(np.float32) / np.max(np.abs(audio_data))
        
        return audio_data, sample_rate
    
    @staticmethod
    def save_audio_to_buffer(signal, sample_rate):
        """Save signal to in-memory buffer"""
        buffer = io.BytesIO()
        # Convert back to int16 for WAV
        int_signal = (signal * 32767).astype(np.int16)
        wavfile.write(buffer, sample_rate, int_signal)
        buffer.seek(0)
        return buffer
    
    @staticmethod
    def generate_test_signal(frequencies, duration=5.0, sample_rate=44100):
        """Generate synthetic test signal"""
        t = np.linspace(0, duration, int(sample_rate * duration), endpoint=False)
        signal = np.zeros_like(t)
        
        for freq in frequencies:
            signal += np.sin(2 * np.pi * freq * t)
        
        # Add some harmonics for realism
        for freq in frequencies:
            signal += 0.3 * np.sin(2 * np.pi * 2 * freq * t)  # 2nd harmonic
            signal += 0.1 * np.sin(2 * np.pi * 3 * freq * t)  # 3rd harmonic
        
        signal = signal / np.max(np.abs(signal))
        return signal, sample_rate
    
    @staticmethod
    def load_mode_settings(mode_name):
        """Load mode settings from JSON file"""
        settings_path = f"settings/{mode_name}.json"
        try:
            with open(settings_path, 'r') as f:
                return json.load(f)
        except FileNotFoundError:
            return AudioUtils.get_default_settings(mode_name)
    
    @staticmethod
    def get_default_settings(mode_name):
        """Get default settings for each mode"""
        defaults = {
            "instruments": {
                "sliders": [
                    {"name": "Guitar", "frequency_bands": [[80, 300], [1000, 2000], [4000, 6000]]},
                    {"name": "Piano", "frequency_bands": [[27, 4200]]},
                    {"name": "Drums", "frequency_bands": [[50, 150], [1000, 4000]]},
                    {"name": "Violin", "frequency_bands": [[200, 400], [800, 3500]]}
                ]
            },
            "animals": {
                "sliders": [
                    {"name": "Birds", "frequency_bands": [[2000, 8000]]},
                    {"name": "Dogs", "frequency_bands": [[500, 1000]]},
                    {"name": "Cats", "frequency_bands": [[750, 1500]]},
                    {"name": "Dolphins", "frequency_bands": [[8000, 16000]]}
                ]
            },
            "voices": {
                "sliders": [
                    {"name": "Male Voice", "frequency_bands": [[85, 180]]},
                    {"name": "Female Voice", "frequency_bands": [[165, 255]]},
                    {"name": "Child Voice", "frequency_bands": [[250, 400]]},
                    {"name": "Elderly Voice", "frequency_bands": [[100, 200]]}
                ]
            }
        }
        return defaults.get(mode_name, {"sliders": []})