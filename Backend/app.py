from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import sys

# Add current directory to path
sys.path.append(os.path.dirname(__file__))

# Import blueprints directly to avoid import issues
try:
    from blueprints.ai_mode import ai_bp
    from blueprints.generic_mode import generic_bp
    from blueprints.customized_mode import instruments_bp, animals_bp, voices_bp
except ImportError as e:
    print(f"Import error: {e}")
    print("Trying alternative import...")
    # Alternative import method
    import importlib.util
    spec = importlib.util.spec_from_file_location("ai_mode", "blueprints/ai_mode.py")
    ai_mode = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(ai_mode)
    ai_bp = ai_mode.ai_bp
    
    spec = importlib.util.spec_from_file_location("generic_mode", "blueprints/generic_mode.py")
    generic_mode = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(generic_mode)
    generic_bp = generic_mode.generic_bp
    
    spec = importlib.util.spec_from_file_location("customized_mode", "blueprints/customized_mode.py")
    customized_mode = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(customized_mode)
    instruments_bp = customized_mode.instruments_bp
    animals_bp = customized_mode.animals_bp
    voices_bp = customized_mode.voices_bp

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Register all blueprints
app.register_blueprint(ai_bp, url_prefix='/api/ai')
app.register_blueprint(generic_bp, url_prefix='/api/generic')
app.register_blueprint(instruments_bp, url_prefix='/api/instruments')
app.register_blueprint(animals_bp, url_prefix='/api/animals')
app.register_blueprint(voices_bp, url_prefix='/api/voices')

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

@app.route('/api/modes', methods=['GET'])
def get_available_modes():
    """Get list of all available modes"""
    return jsonify({
        "modes": [
            {"id": "generic", "name": "Generic Mode", "type": "generic"},
            {"id": "instruments", "name": "Musical Instruments", "type": "customized"},
            {"id": "animals", "name": "Animal Sounds", "type": "customized"},
            {"id": "voices", "name": "Human Voices", "type": "customized"},
            {"id": "ai", "name": "AI Mode", "type": "ai"}
        ]
    })

if __name__ == '__main__':
    # Create settings directory if it doesn't exist
    os.makedirs('settings', exist_ok=True)
    
    print("Signal Equalizer API starting...")
    print("Make sure you have manually created JSON files in settings/ folder:")
    print("- instruments.json")
    print("- animals.json") 
    print("- voices.json")
    
    app.run(debug=True, port=5000)