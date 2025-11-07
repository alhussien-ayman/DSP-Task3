from flask import Flask, request, jsonify, send_file, render_template
from flask_cors import CORS
import numpy as np
import io

# Import blueprints
from blueprints.instruments_mode import instruments_bp
from blueprints.animals_mode import animals_bp
from blueprints.voices_mode import voices_bp
from blueprints.ai_comparison import ai_bp

# Import utilities
from utils.audio_utils import AudioUtils

app = Flask(__name__)
CORS(app)

# Register blueprints
app.register_blueprint(instruments_bp, url_prefix='/api/instruments')
app.register_blueprint(animals_bp, url_prefix='/api/animals')
app.register_blueprint(voices_bp, url_prefix='/api/voices')
app.register_blueprint(ai_bp, url_prefix='/api/ai')

@app.route('/')
def home():
    return render_template('equalizer.html')

@app.route('/api/modes')
def get_available_modes():
    """Get list of available modes"""
    return jsonify({
        "modes": [
            {"id": "instruments", "name": "Musical Instruments", "description": "Control individual instruments"},
            {"id": "animals", "name": "Animal Sounds", "description": "Isolate animal sounds"},
            {"id": "voices", "name": "Human Voices", "description": "Separate different voices"}
        ]
    })

@app.route('/api/generate_test_signal', methods=['POST'])
def generate_test_signal():
    """Generate synthetic test signal with multiple frequencies"""
    data = request.json
    frequencies = data.get('frequencies', [100, 500, 1000, 2000, 4000])
    
    signal, sample_rate = AudioUtils.generate_test_signal(frequencies)
    buffer = AudioUtils.save_audio_to_buffer(signal, sample_rate)
    
    return send_file(
        buffer,
        mimetype='audio/wav',
        as_attachment=True,
        download_name='test_signal.wav'
    )

@app.route('/equalizer')
def equalizer_interface():
    """Main equalizer interface"""
    mode = request.args.get('mode', 'instruments')
    return render_template('equalizer.html', mode=mode)

if __name__ == '__main__':
    app.run(debug=True, port=5000)