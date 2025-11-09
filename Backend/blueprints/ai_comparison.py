from flask import Blueprint, request, jsonify
from utils.ai_models import AIModelHandler

ai_comparison_bp = Blueprint('ai_comparison', __name__)
ai_model_handler = AIModelHandler()

@ai_comparison_bp.route('/music_separation', methods=['POST'])
def separate_music():
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

@ai_comparison_bp.route('/voice_separation', methods=['POST'])
def separate_voices():
    audio_file = request.files.get('audio')
    num_speakers = int(request.form.get('num_speakers', 2))
    if not audio_file:
        return jsonify({"error": "No audio file provided"}), 400

    # Process the audio file with the AI model handler
    voice1, voice2, voice3, voice4, message = ai_model_handler.separate_voices_with_asteroid(audio_file, num_speakers)
    if message.startswith("❌"):
        return jsonify({"error": message}), 500

    return jsonify({
        "voice1": voice1,
        "voice2": voice2,
        "voice3": voice3,
        "voice4": voice4
    }), 200