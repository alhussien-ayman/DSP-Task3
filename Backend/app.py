from flask import Flask, jsonify, request
from flask_cors import CORS
import numpy as np
from scipy import signal
from scipy.io import wavfile
import io
import json
import os
import tempfile
import sys

# Add current directory to path
sys.path.append(os.path.dirname(__file__))

app = Flask(__name__)
# Enhanced CORS configuration
CORS(app, origins=["*"], methods=["GET", "POST", "PUT", "DELETE"], allow_headers=["*"])

# Import and register blueprints one by one
try:
    # Generic Mode (function-based blueprint)
    from blueprints.generic_mode import generic_bp
    app.register_blueprint(generic_bp, url_prefix='/api/generic')
    print("✅ Generic mode blueprint registered successfully!")
    
except ImportError as e:
    print(f"❌ Generic mode import error: {e}")

try:
    # AI Mode (class-based blueprint)
    from blueprints.ai_mode import AIMode
    ai_mode = AIMode()
    app.register_blueprint(ai_mode.blueprint, url_prefix='/api/ai')
    print("✅ AI mode blueprint registered successfully!")
    
except ImportError as e:
    print(f"❌ AI mode import error: {e}")

try:
    # Customized Modes
    from blueprints.customized_mode import CustomizedMode
    
    instruments_mode = CustomizedMode('instruments')
    app.register_blueprint(instruments_mode.blueprint, url_prefix='/api/instruments')
    print("✅ Instruments mode blueprint registered successfully!")
    
    animals_mode = CustomizedMode('animals')
    app.register_blueprint(animals_mode.blueprint, url_prefix='/api/animals')
    print("✅ Animals mode blueprint registered successfully!")
    
    voices_mode = CustomizedMode('voices')
    app.register_blueprint(voices_mode.blueprint, url_prefix='/api/voices')
    print("✅ Voices mode blueprint registered successfully!")
    
except ImportError as e:
    print(f"❌ Customized modes import error: {e}")

@app.route('/')
def home():
    """Main API endpoint with all available modes"""
    endpoints = {
        "generic_mode": "/api/generic",
        "ai_mode": "/api/ai",
        "instruments_mode": "/api/instruments",
        "animals_mode": "/api/animals", 
        "voices_mode": "/api/voices",
        "health": "/api/health",
        "test": "/api/test"
    }
    
    # Check which modes are actually available
    available_endpoints = {}
    for name, path in endpoints.items():
        available_endpoints[name] = {
            "path": path,
            "status": "active" if is_blueprint_available(name) else "inactive"
        }
    
    return jsonify({
        "message": "DSP Equalizer API",
        "status": "active",
        "endpoints": available_endpoints
    })

@app.route('/api/health', methods=['GET'])
def health_check():
    """Comprehensive health check for all modes"""
    modes_status = {}
    
    # Check generic mode
    try:
        from blueprints.generic_mode import generic_bp
        modes_status['generic'] = {"status": "healthy", "type": "blueprint"}
    except ImportError:
        modes_status['generic'] = {"status": "unavailable", "type": "blueprint"}
    
    # Check AI mode
    try:
        from blueprints.ai_mode import AIMode
        modes_status['ai'] = {"status": "healthy", "type": "class"}
    except ImportError:
        modes_status['ai'] = {"status": "unavailable", "type": "class"}
    
    # Check customized modes
    customized_modes = ['instruments', 'animals', 'voices']
    for mode in customized_modes:
        try:
            from utils.audio_utils import AudioUtils
            settings = AudioUtils.load_mode_settings(mode)
            modes_status[mode] = {
                "status": "healthy",
                "type": "customized",
                "sliders_count": len(settings.get('sliders', [])),
                "has_settings": True
            }
        except Exception as e:
            modes_status[mode] = {
                "status": "error",
                "type": "customized", 
                "error": str(e)
            }
    
    return jsonify({
        "status": "success",
        "message": "DSP Equalizer API health status",
        "modes": modes_status
    })

@app.route('/api/test', methods=['GET'])
def test_endpoint():
    """Test endpoint to verify backend is working"""
    return jsonify({
        "status": "success",
        "message": "DSP Equalizer API is running correctly!",
        "version": "1.0.0",
        "modes_available": list_available_modes()
    })

@app.route('/api/info', methods=['GET'])
def api_info():
    """Detailed API information"""
    return jsonify({
        "name": "DSP Equalizer API",
        "version": "1.0.0",
        "description": "Digital Signal Processing Audio Equalizer with Multiple Modes",
        "features": [
            "Generic parametric equalizer",
            "AI-powered audio processing", 
            "Instrument-specific presets",
            "Animal sound enhancements",
            "Voice frequency optimization",
            "Real-time spectrogram generation",
            "Frequency spectrum analysis"
        ],
        "modes": {
            "generic": "Manual parametric equalizer controls",
            "ai": "Artificial intelligence based processing",
            "instruments": "Optimized for musical instruments",
            "animals": "Enhanced for animal sounds",
            "voices": "Tailored for human voice frequencies"
        }
    })

def is_blueprint_available(mode_name):
    """Check if a specific blueprint is available"""
    try:
        if mode_name == 'generic_mode':
            from blueprints.generic_mode import generic_bp
            return True
        elif mode_name == 'ai_mode':
            from blueprints.ai_mode import AIMode
            return True
        elif mode_name in ['instruments_mode', 'animals_mode', 'voices_mode']:
            from blueprints.customized_mode import CustomizedMode
            return True
    except ImportError:
        return False
    return False

def list_available_modes():
    """List all available modes"""
    available = []
    if is_blueprint_available('generic_mode'):
        available.append('generic')
    if is_blueprint_available('ai_mode'):
        available.append('ai')
    if is_blueprint_available('instruments_mode'):
        available.append('instruments')
    if is_blueprint_available('animals_mode'):
        available.append('animals') 
    if is_blueprint_available('voices_mode'):
        available.append('voices')
    return available

# Error handlers
@app.errorhandler(404)
def not_found(error):
    return jsonify({
        "status": "error",
        "message": "Endpoint not found",
        "available_endpoints": {
            "generic": "/api/generic/*",
            "ai": "/api/ai/*",
            "instruments": "/api/instruments/*",
            "animals": "/api/animals/*",
            "voices": "/api/voices/*"
        }
    }), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({
        "status": "error",
        "message": "Internal server error",
        "suggestion": "Check if all required blueprints are properly installed"
    }), 500

if __name__ == '__main__':
    # Create necessary directories
    os.makedirs('settings', exist_ok=True)
    os.makedirs('temp', exist_ok=True)
    
    print("🚀 DSP Equalizer API starting on http://localhost:5000")
    print("📊 Available endpoints:")
    print("   - GET  / - API information")
    print("   - GET  /api/health - Health check")
    print("   - GET  /api/test - Test endpoint")
    print("   - GET  /api/info - Detailed API info")
    print()
    print("🎛️  Processing endpoints:")
    print("   - POST /api/generic/process_audio - Process audio with equalizer")
    print("   - POST /api/generic/compute_spectrogram - Compute spectrogram")
    print("   - POST /api/generic/compute_spectrum - Compute frequency spectrum")
    print("   - POST /api/[mode]/process - Process audio in specific mode")
    print("   - GET  /api/[mode]/settings - Get mode settings")
    print()
    print("🔧 Modes available:", list_available_modes())
    
    app.run(debug=True, port=5000, host='0.0.0.0')