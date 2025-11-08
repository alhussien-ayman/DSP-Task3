from flask import Blueprint, request, jsonify
from utils.ai_models import AIModelHandler

ai_comparison_bp = Blueprint('ai_comparison', __name__)
ai_model_handler = AIModelHandler()

@ai_comparison_bp.route('/separation', methods=['POST'])
def separate_audio():
    audio_file = request.files.get('audio')
    if not audio_file:
        return jsonify({"error": "No audio file provided"}), 400

    # Process the audio file with the AI model handler
    drums, bass, other, vocals, message = ai_model_handler.separate_with_htdemucs(audio_file)
    if message.startswith("❌"):
        return jsonify({"error": message}), 500

    return jsonify({
        "drums": drums,
        "bass": bass,
        "other": other,
        "vocals": vocals
    }), 200