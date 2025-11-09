from flask import Flask, jsonify, send_file
from flask_cors import CORS
import os
import sys

# Add current directory to path
sys.path.append(os.path.dirname(__file__))

app = Flask(__name__)
# Enhanced CORS configuration
CORS(app, origins=["*"], methods=["GET", "POST", "PUT", "DELETE"], allow_headers=["*"])

# Import and register blueprints one by one
try:
    # AI Mode
    from blueprints.ai_mode import AIMode
    ai_mode = AIMode()
    app.register_blueprint(ai_mode.blueprint, url_prefix='/api/ai')
    
    # Generic Mode
    from blueprints.generic_mode import GenericMode
    generic_mode = GenericMode()
    app.register_blueprint(generic_mode.blueprint, url_prefix='/api/generic')
    
    # Customized Modes
    from blueprints.customized_mode import CustomizedMode
    
    instruments_mode = CustomizedMode('instruments')
    app.register_blueprint(instruments_mode.blueprint, url_prefix='/api/instruments')
    
    animals_mode = CustomizedMode('animals')
    app.register_blueprint(animals_mode.blueprint, url_prefix='/api/animals')
    
    voices_mode = CustomizedMode('voices')
    app.register_blueprint(voices_mode.blueprint, url_prefix='/api/voices')
    
    print("✅ All blueprints registered successfully!")
    
except ImportError as e:
    print(f"❌ Import error: {e}")
    print("Please check your blueprint files.")

@app.route('/')
def hello():
    return jsonify({
        "message": "Signal Equalizer API is running!",
        "endpoints": {
            "ai_mode": "/api/ai",
            "generic_mode": "/api/generic", 
            "instruments_mode": "/api/instruments",
            "animals_mode": "/api/animals",
            "voices_mode": "/api/voices"
        }
    })

@app.route('/api/test', methods=['GET'])
def test_endpoint():
    """Test endpoint to verify backend is working"""
    return jsonify({
        "status": "success",
        "message": "Backend is running correctly!",
        "timestamp": "2024-01-01T00:00:00Z"
    })

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check for all modes"""
    modes = ['instruments', 'animals', 'voices']
    health_status = {}
    
    for mode in modes:
        try:
            from utils.audio_utils import AudioUtils
            settings = AudioUtils.load_mode_settings(mode)
            health_status[mode] = {
                "status": "healthy",
                "sliders_count": len(settings.get('sliders', [])),
                "has_settings": True
            }
        except Exception as e:
            health_status[mode] = {
                "status": "error",
                "error": str(e)
            }
    
    return jsonify({
        "status": "success",
        "health": health_status
    })

if __name__ == '__main__':
    os.makedirs('settings', exist_ok=True)
    print("🚀 Signal Equalizer API starting on http://localhost:5000")
    print("📊 Available endpoints:")
    print("   - GET  /api/test - Test endpoint")
    print("   - GET  /api/health - Health check")
    print("   - GET  /api/instruments/settings")
    print("   - GET  /api/animals/settings")
    print("   - GET  /api/voices/settings")
    print("   - POST /api/[mode]/process")
    app.run(debug=True, port=5000, host='0.0.0.0')