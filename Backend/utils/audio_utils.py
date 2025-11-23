import numpy as np
import scipy.io.wavfile as wavfile
import io
import json
import os

class AudioUtils:
    """Audio processing utilities"""
    
    @staticmethod
    def get_settings_path(mode_name):
        """Get correct path for settings file"""
        base_dir = os.path.dirname(os.path.dirname(__file__))
        return os.path.join(base_dir, 'settings', f'{mode_name}.json')
    
    @staticmethod
    def load_audio_file(file):
        """Load audio file and return signal data"""
        # If file is a filename string
        if isinstance(file, str):
            sample_rate, audio_data = wavfile.read(file)
        else:  # If it's a FileStorage object
            file_buffer = io.BytesIO(file.read())
            sample_rate, audio_data = wavfile.read(file_buffer)
        
        # Convert to mono if stereo
        if len(audio_data.shape) > 1:
            audio_data = np.mean(audio_data, axis=1)
        
        # Normalize to [-1, 1]
        audio_data = audio_data.astype(np.float32)
        if np.max(np.abs(audio_data)) > 0:
            audio_data = audio_data / np.max(np.abs(audio_data))
        
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
    def load_mode_settings(mode_name):
        """Load mode settings from JSON file - NO DEFAULT FALLBACK"""
        settings_path = AudioUtils.get_settings_path(mode_name)
        
        # Check if JSON file exists
        if not os.path.exists(settings_path):
            # Return empty settings if file doesn't exist
            print(f"Warning: Settings file not found: {settings_path}")
            return {"sliders": []}
        
        try:
            with open(settings_path, 'r') as f:
                return json.load(f)
        except Exception as e:
            print(f"Error loading settings: {e}")
            return {"sliders": []}
    
    @staticmethod
    def save_mode_settings(mode_name, settings):
        """Save settings to JSON file"""
        settings_path = AudioUtils.get_settings_path(mode_name)
        os.makedirs(os.path.dirname(settings_path), exist_ok=True)
        with open(settings_path, 'w') as f:
            json.dump(settings, f, indent=2)