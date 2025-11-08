# Flask app for ai test
from flask import Flask, request, jsonify
from utils.ai_models import ai_manager
import os
import tempfile
app = Flask(__name__)
@app.route('/api/ai/separation', methods=['POST'])
def separate_audio():
    audio_file = request.files.get('audio')
    if not audio_file:
        return jsonify({"error": "No audio file provided"}), 400

    # Save uploaded file to a temporary location
    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp_audio:
        audio_path = temp_audio.name
        audio_file.save(audio_path)

    try:
        # Process the audio file with the AI model manager
        drums, bass, other, vocals, message = ai_manager.separate_with_htdemucs(audio_path)
        if message.startswith("❌"):
            return jsonify({"error": message}), 500

        return jsonify({
            "drums": drums,
            "bass": bass,
            "other": other,
            "vocals": vocals
        }), 200
    finally:
        # Clean up temporary file
        if os.path.exists(audio_path):
            os.remove(audio_path)

if __name__ == '__main__':
    app.run(debug=True)