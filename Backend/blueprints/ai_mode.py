from flask import request, jsonify, send_file, send_from_directory
from .base_mode import BaseMode
from utils.ai_models import AIModelManager
import os
import base64

class AIMode(BaseMode):
    """AI comparison mode with music and voice separation"""
    
    def __init__(self):
        super().__init__('ai', 'ai')
        self.ai_handler = AIModelManager()
        
        # Add custom AI endpoints
        self.blueprint.add_url_rule('/music_separation', 'music_separation', 
                                    self.separate_music, methods=['POST'])
        self.blueprint.add_url_rule('/voice_separation', 'voice_separation', 
                                    self.separate_voices, methods=['POST'])
        self.blueprint.add_url_rule('/download/<path:filename>', 'download_file',
                                    self.download_file, methods=['GET'])
    
    def process_signal(self, signal, sample_rate, processing_data):
        """Override for AI processing"""
        result = super().process_signal(signal, sample_rate, processing_data)
        result['ai_suggestions'] = self.get_ai_suggestions(signal, sample_rate)
        return result
    
    def separate_music(self):
        """Separate music into stems using Demucs"""
        try:
            print("\n" + "="*80)
            print("🎵 MUSIC SEPARATION REQUEST")
            print("="*80)
            
            audio_file = request.files.get('audio')
            if not audio_file:
                print("❌ No audio file in request")
                return jsonify({"success": False, "error": "No audio file provided"}), 400

            print(f"📁 Processing file: {audio_file.filename}")
            
            # Process the audio file with the AI model handler
            drums, bass, other, vocals, guitar, piano, message = self.ai_handler.separate_with_htdemucs(audio_file)
            
            if message.startswith("❌"):
                print(f"❌ Separation failed: {message}")
                return jsonify({"success": False, "error": message}), 500

            print(f"✅ Separation complete!")
            print(f"   Drums: {drums}")
            print(f"   Bass: {bass}")
            print(f"   Other: {other}")
            print(f"   Vocals: {vocals}")
            print(f"   Guitar: {guitar}")
            print(f"   Piano: {piano}")
            
            # Return file paths with proper structure
            response_data = {
                'success': True,
                'message': 'Music separation completed successfully',
                'drums': drums,
                'bass': bass,
                'other': other,
                'vocals': vocals,
                'guitar': guitar,
                'piano': piano
            }
            
            print(f"✅ Returning response")
            print("="*80 + "\n")
            
            return jsonify(response_data), 200
            
        except Exception as e:
            print(f"❌ Error in separate_music: {str(e)}")
            import traceback
            traceback.print_exc()
            return jsonify({"success": False, "error": str(e)}), 500
    
    def separate_voices(self):
        """Separate voices using Asteroid"""
        try:
            print("\n" + "="*80)
            print("🎤 VOICE SEPARATION REQUEST")
            print("="*80)
            
            audio_file = request.files.get('audio')
            if not audio_file:
                print("❌ No audio file in request")
                return jsonify({"success": False, "error": "No audio file provided"}), 400

            print(f"📁 Processing file: {audio_file.filename}")
            
            # Get original audio as base64 for display
            audio_file.seek(0)
            audio_bytes = audio_file.read()
            original_b64 = f"data:audio/wav;base64,{base64.b64encode(audio_bytes).decode('utf-8')}"
            
            print(f"✅ Original audio converted to base64: {len(original_b64)} bytes")
            
            # Reset file pointer for processing
            audio_file.seek(0)

            # Process the audio file with the AI model handler
            voice1, voice2, voice3, voice4, message = self.ai_handler.separate_voices_with_asteroid(audio_file)
            
            if message.startswith("❌"):
                print(f"❌ Separation failed: {message}")
                return jsonify({"success": False, "error": message}), 500

            print(f"✅ Voice separation complete!")
            print(f"   Voice 1: {voice1}")
            print(f"   Voice 2: {voice2}")
            print(f"   Voice 3: {voice3}")
            print(f"   Voice 4: {voice4}")
            
            # Return response with proper structure
            response_data = {
                'success': True,
                'message': 'Voice separation completed successfully',
                'original': original_b64,  # Base64 for original signal display
                'voices': {
                    'voice_1': voice1 if voice1 else None,
                    'voice_2': voice2 if voice2 else None,
                    'voice_3': voice3 if voice3 else None,
                    'voice_4': voice4 if voice4 else None
                }
            }
            
            print(f"✅ Returning response with {len([v for v in response_data['voices'].values() if v])} voices")
            print("="*80 + "\n")
            
            return jsonify(response_data), 200
            
        except Exception as e:
            print(f"❌ Error in separate_voices: {str(e)}")
            import traceback
            traceback.print_exc()
            return jsonify({"success": False, "error": str(e)}), 500
    
    def download_file(self, filename):
        """Serve audio files directly with proper headers for CORS and range requests"""
        try:
            print(f"\n📥 Download request: {filename}")
            
            # Get root directory (DSP-Task3)
            backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            root_dir = os.path.dirname(backend_dir)
            
            # Clean the filename (remove any leading slashes)
            clean_filename = filename.lstrip('/')
            
            # Try different path combinations
            possible_paths = [
                # Direct path from root
                os.path.join(root_dir, clean_filename),
                # With outputs prefix
                os.path.join(root_dir, 'outputs', clean_filename),
                # From backend directory
                os.path.join(backend_dir, clean_filename),
                os.path.join(backend_dir, 'outputs', clean_filename),
                # If filename already has outputs
                os.path.join(root_dir, clean_filename.replace('outputs/', '')),
            ]
            
            file_path = None
            for path in possible_paths:
                print(f"   Trying: {path}")
                if os.path.exists(path):
                    file_path = path
                    print(f"   ✅ Found at: {file_path}")
                    break
            
            if not file_path:
                print(f"   ❌ File not found in any location!")
                print(f"   Searched paths:")
                for path in possible_paths:
                    print(f"      - {path}")
                return jsonify({"error": f"File not found: {filename}"}), 404
            
            # Check file size
            file_size = os.path.getsize(file_path)
            print(f"   📊 File size: {file_size / 1024:.2f} KB")
            print(f"   ✅ Serving file")
            
            # Send file with proper headers for CORS and streaming
            response = send_file(
                file_path, 
                mimetype='audio/wav',
                as_attachment=False,
                download_name=os.path.basename(file_path)
            )
            
            # Add CORS headers explicitly
            response.headers['Access-Control-Allow-Origin'] = '*'
            response.headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS'
            response.headers['Access-Control-Allow-Headers'] = 'Range, Content-Type'
            response.headers['Access-Control-Expose-Headers'] = 'Content-Length, Content-Range, Accept-Ranges'
            response.headers['Accept-Ranges'] = 'bytes'
            response.headers['Cache-Control'] = 'no-cache'
            
            return response
            
        except Exception as e:
            print(f"❌ Error serving file: {str(e)}")
            import traceback
            traceback.print_exc()
            return jsonify({"error": str(e)}), 500


# Create AI mode blueprint instance
ai_mode_instance = AIMode()
ai_bp = ai_mode_instance.blueprint