from flask import request, jsonify
from .base_mode import BaseMode
from utils.ai_models import AIModelManager
from utils.signal_processing import SignalProcessor
import os
import base64
import io
import numpy as np
import soundfile as sf
import torch
import logging

logger = logging.getLogger(__name__)


class AIMode(BaseMode):
    """AI comparison mode with music and voice separation"""
    
    def __init__(self):
        super().__init__('ai', 'ai')
        self.ai_handler = AIModelManager()
        self.signal_processor = SignalProcessor()
        
        # Add custom AI endpoints
        self.blueprint.add_url_rule('/music_separation', 'music_separation', 
                                    self.separate_music, methods=['POST'])
        self.blueprint.add_url_rule('/voice_separation', 'voice_separation', 
                                    self.separate_voices, methods=['POST'])
        self.blueprint.add_url_rule('/mix_stems', 'mix_stems',
                                    self.mix_stems, methods=['POST'])
        self.blueprint.add_url_rule('/analyze_mixed_audio', 'analyze_mixed_audio',
                                    self.analyze_mixed_audio, methods=['POST'])
    
    def process_signal(self, signal, sample_rate, processing_data):
        """Override for AI processing"""
        result = super().process_signal(signal, sample_rate, processing_data)
        result['ai_suggestions'] = self.get_ai_suggestions(signal, sample_rate)
        return result
    
    def get_ai_suggestions(self, signal, sample_rate):
        """Generate AI-based suggestions for the audio"""
        return {
            "detected_features": "music" if len(signal) > sample_rate * 5 else "short_audio",
            "recommended_mode": "music_separation" if len(signal) > sample_rate * 5 else "voice_separation"
        }
    
    def tensor_to_base64(self, audio_tensor, sample_rate=44100):
        """Convert torch tensor to base64 audio data URI"""
        try:
            # Convert to numpy
            if isinstance(audio_tensor, torch.Tensor):
                audio_np = audio_tensor.cpu().numpy()
            else:
                audio_np = np.array(audio_tensor)
            
            logger.info(f"Converting tensor: shape={audio_np.shape}, sr={sample_rate}")
            
            # Ensure correct shape for soundfile (samples, channels)
            if audio_np.ndim == 1:
                audio_np = audio_np[:, np.newaxis]  # mono: (samples, 1)
            elif audio_np.ndim == 2:
                if audio_np.shape[0] < audio_np.shape[1]:
                    # If shape is (channels, samples), transpose
                    audio_np = audio_np.T
            
            logger.info(f"After reshape: {audio_np.shape}")
            
            # Create in-memory buffer
            buffer = io.BytesIO()
            
            # Write WAV to buffer
            sf.write(buffer, audio_np, sample_rate, format='WAV', subtype='PCM_16')
            buffer.seek(0)
            
            # Encode to base64
            audio_bytes = buffer.read()
            base64_audio = base64.b64encode(audio_bytes).decode('utf-8')
            
            logger.info(f"✅ Converted to base64: {len(base64_audio)} chars")
            
            # Return as data URI
            return f"data:audio/wav;base64,{base64_audio}"
            
        except Exception as e:
            logger.error(f"Error converting tensor to base64: {e}", exc_info=True)
            return None
    
    def separate_music(self):
        """Separate music into stems using Demucs"""
        try:
            logger.info("="*80)
            logger.info("🎵 MUSIC SEPARATION REQUEST")
            logger.info("="*80)
            
            # Get audio file from request
            audio_file = request.files.get('audio')
            if not audio_file:
                logger.error("No audio file in request")
                return jsonify({"success": False, "error": "No audio file provided"}), 400

            logger.info(f"Processing file: {audio_file.filename}")
            
            # Get model name
            model_name = request.form.get('model_name', 'htdemucs_6s')
            logger.info(f"Using model: {model_name}")
            
            # Reset file pointer
            audio_file.seek(0)
            
            # Call the AI handler (returns tensors)
            logger.info("Starting Demucs separation...")
            result = self.ai_handler.separate_with_htdemucs(audio_file, model_name)
            
            # Unpack results (7 values: 6 tensors + message)
            if len(result) != 7:
                logger.error(f"Unexpected return format: got {len(result)} values")
                return jsonify({
                    "success": False,
                    "error": f"Model returned unexpected format"
                }), 500
            
            drums, bass, other, vocals, guitar, piano, message = result
            
            # Check for errors
            if message and message.startswith("❌"):
                logger.error(f"Separation failed: {message}")
                return jsonify({"success": False, "error": message}), 500
            
            logger.info(f"Separation complete: {message}")
            
            # Build response
            response_data = {
                'success': True,
                'message': message,
                'sample_rate': 44100,
                'stems': {}
            }
            
            # Convert tensors to base64
            stems_data = {
                'drums': drums,
                'bass': bass,
                'other': other,
                'vocals': vocals,
                'guitar': guitar,
                'piano': piano
            }
            
            logger.info("Converting stem tensors to base64...")
            converted_count = 0
            
            for stem_name, tensor in stems_data.items():
                if tensor is not None:
                    logger.info(f"Converting {stem_name}: shape={tensor.shape}")
                    base64_data = self.tensor_to_base64(tensor, sample_rate=44100)
                    
                    if base64_data:
                        response_data['stems'][stem_name] = base64_data
                        converted_count += 1
                        logger.info(f"✅ {stem_name} converted")
                    else:
                        logger.error(f"❌ Failed to convert {stem_name}")
                else:
                    logger.warning(f"⚠️  {stem_name} is None")
            
            logger.info(f"Successfully converted {converted_count}/{len(stems_data)} stems")
            logger.info("="*80 + "\n")
            
            if converted_count == 0:
                return jsonify({
                    "success": False,
                    "error": "No stems were successfully generated"
                }), 500
            
            return jsonify(response_data), 200
            
        except Exception as e:
            logger.error(f"MUSIC SEPARATION ERROR: {str(e)}", exc_info=True)
            return jsonify({"success": False, "error": str(e)}), 500
    
    def separate_voices(self):
        """Separate voices using Asteroid"""
        try:
            logger.info("="*80)
            logger.info("🎤 VOICE SEPARATION REQUEST")
            logger.info("="*80)
            
            # Get audio file from request
            audio_file = request.files.get('audio')
            if not audio_file:
                logger.error("No audio file in request")
                return jsonify({"success": False, "error": "No audio file provided"}), 400

            logger.info(f"Processing file: {audio_file.filename}")
            
            # Reset file pointer
            audio_file.seek(0)
            
            # Call the AI handler (returns tensors)
            logger.info("Starting Asteroid separation...")
            result = self.ai_handler.separate_voices_with_asteroid(audio_file)
            
            # Unpack results (5 values: 4 tensors + message)
            if len(result) != 5:
                logger.error(f"Unexpected return format: got {len(result)} values")
                return jsonify({
                    "success": False,
                    "error": f"Model returned unexpected format"
                }), 500
            
            voice1, voice2, voice3, voice4, message = result
            
            # Check for errors
            if message and message.startswith("❌"):
                logger.error(f"Separation failed: {message}")
                return jsonify({"success": False, "error": message}), 500
            
            logger.info(f"Separation complete: {message}")
            
            # Build response
            response_data = {
                'success': True,
                'message': message,
                'sample_rate': 8000,
                'voices': {}
            }
            
            # Convert tensors to base64
            voices_data = {
                'voice_1': voice1,
                'voice_2': voice2,
                'voice_3': voice3,
                'voice_4': voice4
            }
            
            logger.info("Converting voice tensors to base64...")
            converted_count = 0
            
            for voice_name, tensor in voices_data.items():
                if tensor is not None:
                    logger.info(f"Converting {voice_name}: shape={tensor.shape}")
                    base64_data = self.tensor_to_base64(tensor, sample_rate=8000)
                    
                    if base64_data:
                        response_data['voices'][voice_name] = base64_data
                        converted_count += 1
                        logger.info(f"✅ {voice_name} converted")
                    else:
                        logger.error(f"❌ Failed to convert {voice_name}")
                else:
                    logger.warning(f"⚠️  {voice_name} is None")
            
            logger.info(f"Successfully converted {converted_count}/{len(voices_data)} voices")
            logger.info("="*80 + "\n")
            
            if converted_count == 0:
                return jsonify({
                    "success": False,
                    "error": "No voices were successfully generated"
                }), 500
            
            return jsonify(response_data), 200
            
        except Exception as e:
            logger.error(f"VOICE SEPARATION ERROR: {str(e)}", exc_info=True)
            return jsonify({"success": False, "error": str(e)}), 500
    
    def mix_stems(self):
        """Mix multiple stems/voices with individual gain controls"""
        try:
            logger.info("="*80)
            logger.info("🎚️ MIX STEMS REQUEST")
            logger.info("="*80)
            
            data = request.get_json()
            
            if not data or 'stems' not in data or 'gains' not in data:
                return jsonify({"success": False, "error": "Missing stems or gains data"}), 400
            
            stems_base64 = data['stems']
            gains = data['gains']
            sample_rate = data.get('sample_rate', 44100)
            
            logger.info(f"Mixing {len(stems_base64)} stems at {sample_rate}Hz")
            logger.info(f"Gains: {gains}")
            
            # Decode and mix all stems
            mixed_audio = None
            
            for stem_name, base64_data in stems_base64.items():
                if stem_name not in gains:
                    continue
                
                gain = gains[stem_name]
                
                try:
                    # Decode base64 to audio
                    if ',' in base64_data:
                        base64_data = base64_data.split(',')[1]
                    
                    audio_data = base64.b64decode(base64_data)
                    buffer = io.BytesIO(audio_data)
                    
                    # Load audio
                    audio, sr = sf.read(buffer)
                    
                    # Convert to stereo if mono
                    if audio.ndim == 1:
                        audio = np.stack([audio, audio], axis=-1)
                    
                    # Apply gain
                    audio = audio * gain
                    
                    # Mix
                    if mixed_audio is None:
                        mixed_audio = audio
                    else:
                        min_len = min(len(mixed_audio), len(audio))
                        mixed_audio = mixed_audio[:min_len] + audio[:min_len]
                
                except Exception as e:
                    logger.error(f"Error processing {stem_name}: {e}")
                    continue
            
            if mixed_audio is None:
                return jsonify({"success": False, "error": "No audio to mix"}), 400
            
            # Normalize
            max_val = np.abs(mixed_audio).max()
            if max_val > 0.99:
                mixed_audio = mixed_audio * (0.99 / max_val)
            
            # Convert to mono for frequency analysis
            mixed_mono = mixed_audio.mean(axis=1) if mixed_audio.ndim > 1 else mixed_audio
            
            # Compute frequency spectrum using custom FFT
            logger.info("Computing frequency spectrum...")
            fft_result = self.signal_processor.custom_fft(mixed_mono[:min(len(mixed_mono), 100000)])  # Limit for performance
            freqs = np.fft.fftfreq(len(fft_result), 1/sample_rate)
            magnitudes = np.abs(fft_result)
            
            # Only positive frequencies
            positive_freqs = freqs[:len(freqs)//2]
            positive_mags = magnitudes[:len(magnitudes)//2]
            
            # Convert back to base64
            buffer = io.BytesIO()
            sf.write(buffer, mixed_audio, sample_rate, format='WAV', subtype='PCM_16')
            buffer.seek(0)
            
            mixed_base64 = base64.b64encode(buffer.read()).decode('utf-8')
            mixed_data_uri = f"data:audio/wav;base64,{mixed_base64}"
            
            logger.info("✅ Mixing complete")
            logger.info("="*80 + "\n")
            
            return jsonify({
                'success': True,
                'mixed_audio': mixed_data_uri,
                'sample_rate': sample_rate,
                'frequency_data': {
                    'frequencies': positive_freqs.tolist()[:1000],  # Limit data size
                    'magnitudes': positive_mags.tolist()[:1000]
                }
            }), 200
            
        except Exception as e:
            logger.error(f"MIX STEMS ERROR: {str(e)}", exc_info=True)
            return jsonify({"success": False, "error": str(e)}), 500
    
    def analyze_mixed_audio(self):
        """Analyze mixed audio and return frequency plot data"""
        try:
            data = request.get_json()
            
            if not data or 'audio' not in data:
                return jsonify({"success": False, "error": "Missing audio data"}), 400
            
            base64_data = data['audio']
            sample_rate = data.get('sample_rate', 44100)
            
            # Decode base64 to audio
            if ',' in base64_data:
                base64_data = base64_data.split(',')[1]
            
            audio_data = base64.b64decode(base64_data)
            buffer = io.BytesIO(audio_data)
            
            # Load audio
            audio, sr = sf.read(buffer)
            
            # Convert to mono
            if audio.ndim > 1:
                audio = audio.mean(axis=1)
            
            # Compute FFT
            fft_result = self.signal_processor.custom_fft(audio[:min(len(audio), 100000)])
            freqs = np.fft.fftfreq(len(fft_result), 1/sample_rate)
            magnitudes = np.abs(fft_result)
            
            # Only positive frequencies
            positive_freqs = freqs[:len(freqs)//2]
            positive_mags = magnitudes[:len(magnitudes)//2]
            
            return jsonify({
                'success': True,
                'frequency_data': {
                    'frequencies': positive_freqs.tolist()[:1000],
                    'magnitudes': positive_mags.tolist()[:1000]
                }
            }), 200
            
        except Exception as e:
            logger.error(f"ANALYZE ERROR: {str(e)}", exc_info=True)
            return jsonify({"success": False, "error": str(e)}), 500


# Create AI mode blueprint instance
ai_mode_instance = AIMode()
ai_bp = ai_mode_instance.blueprint