from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import numpy as np
from scipy import signal
from scipy.io import wavfile
import io
import json
import os
import tempfile
from blueprints.generic_mode import generic_bp

app = Flask(__name__)
CORS(app)

# Register blueprints
app.register_blueprint(generic_bp, url_prefix='/api/generic')

@app.route('/')
def home():
    return jsonify({"message": "DSP Equalizer API"})

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy", "message": "DSP Equalizer API is running"})

if __name__ == '__main__':
    app.run(debug=True, port=5000)