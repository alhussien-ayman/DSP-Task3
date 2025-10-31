from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import numpy as np
import scipy.io.wavfile as wavfile
import io
import json
import os
from blueprints.generic_mode import generic_bp
from blueprints.instruments_mode import instruments_bp
from blueprints.voices_mode import voices_bp
from blueprints.animals_mode import animals_bp
from blueprints.ai_comparison import ai_bp

app = Flask(__name__)
CORS(app)

# Register blueprints
app.register_blueprint(generic_bp, url_prefix='/api/generic')
app.register_blueprint(instruments_bp, url_prefix='/api/instruments')
app.register_blueprint(voices_bp, url_prefix='/api/voices')
app.register_blueprint(animals_bp, url_prefix='/api/animals')
app.register_blueprint(ai_bp, url_prefix='/api/ai')

@app.route('/')
def home():
    return jsonify({"message": "DSP Equalizer API"})

@app.route('/api/generate_test_signal', methods=['POST'])
def generate_test_signal():
    """Generate synthetic test signal with multiple frequencies"""
    data = request.json
    frequencies = data.get('frequencies', [100, 500, 1000, 2000, 4000])
    duration = data.get('duration', 5.0)
    sample_rate = data.get('sample_rate', 44100)
    
    t = np.linspace(0, duration, int(sample_rate * duration), endpoint=False)
    signal = np.zeros_like(t)
    
    for freq in frequencies:
        signal += np.sin(2 * np.pi * freq * t)
    
    # Normalize
    signal = signal / np.max(np.abs(signal))
    
    # Convert to WAV
    buffer = io.BytesIO()
    wavfile.write(buffer, sample_rate, (signal * 32767).astype(np.int16))
    buffer.seek(0)
    
    return send_file(
        buffer,
        mimetype='audio/wav',
        as_attachment=True,
        download_name='test_signal.wav'
    )

@app.route('/api/apply_equalizer', methods=['POST'])
def apply_equalizer():
    """Apply equalizer settings to audio signal"""
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400
    
    file = request.files['file']
    settings = json.loads(request.form.get('settings', '{}'))
    
    # Read audio file
    sample_rate, audio_data = wavfile.read(file)
    
    # Convert to mono if stereo
    if len(audio_data.shape) > 1:
        audio_data = np.mean(audio_data, axis=1)
    
    # Apply equalizer (simplified implementation)
    processed_audio = apply_equalizer_filter(audio_data, sample_rate, settings)
    
    # Convert to WAV
    buffer = io.BytesIO()
    wavfile.write(buffer, sample_rate, (processed_audio * 32767).astype(np.int16))
    buffer.seek(0)
    
    return send_file(
        buffer,
        mimetype='audio/wav',
        as_attachment=True,
        download_name='processed_audio.wav'
    )

def apply_equalizer_filter(audio, sample_rate, settings):
    """Apply equalizer filter based on settings"""
    # This is a simplified implementation
    # In practice, you'd use proper digital filter design
    processed_audio = audio.copy()
    
    for band in settings.get('bands', []):
        center_freq = band.get('center_freq', 1000)
        gain = band.get('gain', 1.0)
        bandwidth = band.get('bandwidth', 100)
        
        # Apply gain to frequency band (simplified)
        # Real implementation would use proper bandpass filters
        if gain != 1.0:
            # This is where you'd implement actual filtering
            pass
    
    return processed_audio

if __name__ == '__main__':
    app.run(debug=True, port=5000)