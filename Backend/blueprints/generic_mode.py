from flask import Blueprint, request, jsonify, send_file
import numpy as np
from scipy import signal as scipy_signal
from scipy.io import wavfile
import scipy.fft as fft
import librosa
import io
import json
import os
import tempfile
import soundfile as sf
from datetime import datetime
import matplotlib
matplotlib.use('Agg')  # Use non-interactive backend
import matplotlib.pyplot as plt
from matplotlib.colors import LinearSegmentedColormap

generic_bp = Blueprint('generic', __name__)

print("✅ Generic mode blueprint loaded")

# Create presets directory if it doesn't exist
PRESETS_DIR = os.path.join(os.path.dirname(__file__), '..', '..', 'presets')
os.makedirs(PRESETS_DIR, exist_ok=True)

# Supported audio formats
ALLOWED_EXTENSIONS = {
    'wav', 'wave', 'flac', 'mp3', 'm4a', 'aac', 'ogg', 
    'mp4', 'm4p', 'm4b', '3gp', 'wma', 'aiff', 'aif', 
    'raw', 'pcm'
}

def allowed_file(filename):
    """Check if the file has an allowed extension"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@generic_bp.route('/')
def generic_home():
    """Root endpoint for generic mode"""
    return jsonify({
        "message": "Generic Mode API", 
        "status": "active",
        "endpoints": {
            "list_presets": "GET /api/generic/list_presets",
            "save_preset": "POST /api/generic/save_preset",
            "load_preset": "GET /api/generic/load_preset?name=preset_name",
            "delete_preset": "DELETE /api/generic/delete_preset?name=preset_name",
            "generate_test_signal": "GET/POST /api/generic/generate_test_signal",
            "process_audio": "POST /api/generic/process_audio",
            "compute_spectrum": "POST /api/generic/compute_spectrum",
            "compute_spectrogram": "POST /api/generic/compute_spectrogram",
            "health": "GET /api/generic/health"
        }
    })

@generic_bp.route('/list_presets', methods=['GET'])
def list_presets():
    """List all available presets"""
    try:
        print("📁 Listing presets from:", PRESETS_DIR)
        
        presets = []
        if os.path.exists(PRESETS_DIR):
            for file in os.listdir(PRESETS_DIR):
                if file.endswith('.json'):
                    preset_name = file[:-5]  # Remove .json extension
                    preset_file = os.path.join(PRESETS_DIR, file)
                    
                    try:
                        with open(preset_file, 'r', encoding='utf-8') as f:
                            preset_data = json.load(f)
                        
                        presets.append({
                            'name': preset_name,
                            'description': preset_data.get('description', ''),
                            'created_at': preset_data.get('created_at', ''),
                            'band_count': len(preset_data.get('bands', [])),
                            'bands': preset_data.get('bands', [])
                        })
                    except Exception as e:
                        print(f"⚠️  Skipping corrupted preset file {file}: {e}")
                        presets.append({'name': preset_name, 'error': 'Corrupted file'})
        
        print(f"📋 Found {len(presets)} presets")
        return jsonify({
            'presets': presets,
            'count': len(presets),
            'presets_dir': PRESETS_DIR
        })
        
    except Exception as e:
        print(f"❌ Error listing presets: {e}")
        return jsonify({'error': f'Failed to list presets: {str(e)}'}), 500

@generic_bp.route('/save_preset', methods=['POST'])
def save_preset():
    """Save equalizer preset to file"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No JSON data provided'}), 400
            
        preset_name = data.get('name', 'preset').strip()
        bands = data.get('bands', [])
        description = data.get('description', 'Custom equalizer preset')
        
        if not preset_name:
            return jsonify({'error': 'Preset name cannot be empty'}), 400
        
        # Validate bands structure
        for band in bands:
            if not all(key in band for key in ['startFreq', 'endFreq', 'gain']):
                return jsonify({'error': 'Invalid band structure'}), 400
        
        preset_data = {
            'name': preset_name,
            'description': description,
            'bands': bands,
            'created_at': datetime.now().isoformat(),
            'version': '1.0'
        }
        
        # Save to JSON file
        preset_file = os.path.join(PRESETS_DIR, f'{preset_name}.json')
        with open(preset_file, 'w', encoding='utf-8') as f:
            json.dump(preset_data, f, indent=2, ensure_ascii=False)
        
        print(f"💾 Saved preset: {preset_name} with {len(bands)} bands")
        
        return jsonify({
            'message': 'Preset saved successfully',
            'preset': preset_data,
            'file_path': preset_file
        })
        
    except Exception as e:
        print(f"❌ Error saving preset: {e}")
        return jsonify({'error': f'Failed to save preset: {str(e)}'}), 500

@generic_bp.route('/load_preset', methods=['GET'])
def load_preset():
    """Load equalizer preset from file"""
    try:
        preset_name = request.args.get('name', 'default')
        print(f"📥 Loading preset: {preset_name}")
        
        preset_file = os.path.join(PRESETS_DIR, f'{preset_name}.json')
        
        if os.path.exists(preset_file):
            with open(preset_file, 'r', encoding='utf-8') as f:
                preset_data = json.load(f)
            print(f"✅ Loaded preset: {preset_name} with {len(preset_data.get('bands', []))} bands")
            return jsonify(preset_data)
        else:
            print(f"⚠️  Preset not found: {preset_name}")
            return jsonify({'error': f'Preset "{preset_name}" not found'}), 404
            
    except Exception as e:
        print(f"❌ Error loading preset: {e}")
        return jsonify({'error': f'Failed to load preset: {str(e)}'}), 500

@generic_bp.route('/delete_preset', methods=['DELETE'])
def delete_preset():
    """Delete a preset file"""
    try:
        preset_name = request.args.get('name')
        
        if not preset_name:
            return jsonify({'error': 'Preset name is required'}), 400
        
        preset_file = os.path.join(PRESETS_DIR, f'{preset_name}.json')
        
        if os.path.exists(preset_file):
            os.remove(preset_file)
            print(f"🗑️  Deleted preset: {preset_name}")
            return jsonify({'message': f'Preset "{preset_name}" deleted successfully'})
        else:
            return jsonify({'error': 'Preset not found'}), 404
            
    except Exception as e:
        print(f"❌ Error deleting preset: {e}")
        return jsonify({'error': f'Failed to delete preset: {str(e)}'}), 500

@generic_bp.route('/generate_test_signal', methods=['GET', 'POST'])
def generate_test_signal():
    """Generate synthetic test signal with multiple frequencies"""
    try:
        print("🎵 Generating test signal...")
        
        # Handle both GET and POST requests
        if request.method == 'POST':
            if request.is_json:
                data = request.get_json()
            else:
                data = {}
        else:  # GET method
            data = request.args.to_dict()
        
        # Parse parameters with defaults
        frequencies_str = data.get('frequencies', '100,250,500,1000,2000,4000,8000')
        if isinstance(frequencies_str, str):
            frequencies = [float(f.strip()) for f in frequencies_str.split(',')]
        else:
            frequencies = frequencies_str
            
        duration = float(data.get('duration', 5.0))
        sample_rate = int(data.get('sample_rate', 44100))
        amplitude = float(data.get('amplitude', 0.8))
        signal_type = data.get('type', 'sine')  # sine, square, sawtooth
        
        print(f"🔧 Parameters: {len(frequencies)} freqs, {duration}s, {sample_rate}Hz, type: {signal_type}")
        
        # Generate time array
        t = np.linspace(0, duration, int(sample_rate * duration), endpoint=False)
        signal_data = np.zeros_like(t)
        
        # Generate signal based on type
        for i, freq in enumerate(frequencies):
            freq_amplitude = amplitude * (0.7 + 0.3 * (i % 4))
            
            if signal_type == 'sine':
                signal_data += freq_amplitude * np.sin(2 * np.pi * freq * t)
            elif signal_type == 'square':
                signal_data += freq_amplitude * scipy_signal.square(2 * np.pi * freq * t)
            elif signal_type == 'sawtooth':
                signal_data += freq_amplitude * scipy_signal.sawtooth(2 * np.pi * freq * t)
            else:  # Default to sine
                signal_data += freq_amplitude * np.sin(2 * np.pi * freq * t)
        
        # Add slight noise for realism
        noise = np.random.normal(0, 0.01, len(signal_data))
        signal_data += noise
        
        # Apply gentle envelope to avoid clicks
        fade_samples = int(0.1 * sample_rate)  # 100ms fade
        envelope = np.ones_like(signal_data)
        envelope[:fade_samples] = np.linspace(0, 1, fade_samples)
        envelope[-fade_samples:] = np.linspace(1, 0, fade_samples)
        signal_data *= envelope
        
        # Normalize
        signal_data = signal_data / np.max(np.abs(signal_data))
        
        # Convert to WAV
        buffer = io.BytesIO()
        wavfile.write(buffer, sample_rate, (signal_data * 32767).astype(np.int16))
        buffer.seek(0)
        
        print(f"✅ Test signal generated: {len(signal_data)} samples, {sample_rate}Hz")
        
        return send_file(
            buffer,
            mimetype='audio/wav',
            as_attachment=False,
            download_name='test_signal.wav'
        )
        
    except Exception as e:
        print(f"❌ Error generating test signal: {e}")
        return jsonify({'error': f'Test signal generation failed: {str(e)}'}), 500

@generic_bp.route('/process_audio', methods=['POST'])
def process_audio():
    """Process audio with generic equalizer settings"""
    try:
        print("🎚️  Processing audio with equalizer...")
        
        if 'file' not in request.files:
            return jsonify({'error': 'No file uploaded'}), 400
        
        file = request.files['file']
        settings = request.form.get('settings', '{}')
        
        print(f"📁 File received: {file.filename}")
        print(f"⚙️  Settings: {settings}")
        
        # Validate file
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        if not allowed_file(file.filename):
            return jsonify({'error': 'File type not supported'}), 400
        
        # Parse settings
        try:
            settings_data = json.loads(settings)
            bands = settings_data.get('bands', [])
            print(f"🎛️  Processing with {len(bands)} bands")
        except json.JSONDecodeError as e:
            return jsonify({'error': f'Invalid settings JSON: {str(e)}'}), 400
        
        # Read audio file with format detection
        audio_data, sample_rate, file_info = read_audio_file(file)
        
        print(f"🔊 Audio loaded: {file_info}")
        
        # Convert to mono if stereo
        if len(audio_data.shape) > 1:
            audio_data = np.mean(audio_data, axis=1)
            file_info['channels'] = 'mono (converted from stereo)'
            print("🔄 Converted stereo to mono")
        else:
            file_info['channels'] = 'mono'
        
        # Normalize audio to float32
        audio_data = audio_data.astype(np.float32)
        if np.max(np.abs(audio_data)) > 0:
            audio_data = audio_data / np.max(np.abs(audio_data))
        
        # Apply equalizer
        processed_audio = apply_equalizer_fft(audio_data, sample_rate, bands)
        
        # Normalize output
        if np.max(np.abs(processed_audio)) > 0:
            processed_audio = processed_audio / np.max(np.abs(processed_audio))
        
        # Convert to int16 for WAV
        processed_audio_int16 = (processed_audio * 32767).astype(np.int16)
        
        # Save to buffer
        buffer = io.BytesIO()
        wavfile.write(buffer, sample_rate, processed_audio_int16)
        buffer.seek(0)
        
        print("✅ Audio processing completed successfully")
        
        return send_file(
            buffer,
            mimetype='audio/wav',
            as_attachment=False,
            download_name=f'processed_{os.path.splitext(file.filename)[0]}.wav'
        )
        
    except Exception as e:
        print(f"❌ Audio processing error: {e}")
        return jsonify({'error': f'Processing failed: {str(e)}'}), 500

@generic_bp.route('/compute_spectrum', methods=['POST'])
def compute_spectrum():
    """Compute frequency spectrum of audio signal"""
    try:
        print("📊 Computing frequency spectrum...")
        
        if 'file' not in request.files:
            return jsonify({'error': 'No file uploaded'}), 400
        
        file = request.files['file']
        
        # Validate file
        if not allowed_file(file.filename):
            return jsonify({'error': 'File type not supported'}), 400
        
        # Read audio file
        audio_data, sample_rate, file_info = read_audio_file(file)
        
        # Convert to mono if stereo
        if len(audio_data.shape) > 1:
            audio_data = np.mean(audio_data, axis=1)
        
        # Normalize
        audio_data = audio_data.astype(np.float32)
        if np.max(np.abs(audio_data)) > 0:
            audio_data = audio_data / np.max(np.abs(audio_data))
        
        # Compute FFT with proper windowing
        n = len(audio_data)
        
        # Use Hann window to reduce spectral leakage
        window = np.hanning(n)
        windowed_audio = audio_data * window
        
        # Compute FFT
        fft_data = fft.rfft(windowed_audio)
        frequencies = fft.rfftfreq(n, d=1/sample_rate)
        magnitude = np.abs(fft_data)
        
        # Convert to dB scale for better visualization
        magnitude_db = 20 * np.log10(magnitude + 1e-10)  # Add small value to avoid log(0)
        
        # Compute phase
        phase = np.angle(fft_data)
        
        # Limit data size for frontend (to prevent huge responses)
        max_points = 2000
        if len(frequencies) > max_points:
            step = len(frequencies) // max_points
            frequencies = frequencies[::step]
            magnitude = magnitude[::step]
            magnitude_db = magnitude_db[::step]
            phase = phase[::step]
        
        spectrum_data = {
            'frequencies': frequencies.tolist(),
            'magnitude': magnitude.tolist(),
            'magnitude_db': magnitude_db.tolist(),
            'phase': phase.tolist(),
            'sample_rate': sample_rate,
            'length': n,
            'max_frequency': frequencies[-1] if len(frequencies) > 0 else 0
        }
        
        print(f"✅ Spectrum computed: {len(frequencies)} frequency points")
        
        return jsonify(spectrum_data)
        
    except Exception as e:
        print(f"❌ Spectrum computation error: {e}")
        return jsonify({'error': f'Spectrum computation failed: {str(e)}'}), 500

@generic_bp.route('/compute_spectrogram', methods=['POST'])
def compute_spectrogram():
    """Compute spectrogram for visualization with optional time limit"""
    try:
        print("🎨 Computing spectrogram...")
        
        if 'file' not in request.files:
            return jsonify({'error': 'No file uploaded'}), 400
        
        file = request.files['file']
        max_duration = float(request.form.get('max_duration', 0))  # 0 means no limit
        
        # Validate file
        if not allowed_file(file.filename):
            return jsonify({'error': 'File type not supported'}), 400
        
        # Read audio file
        audio_data, sample_rate, file_info = read_audio_file(file)
        
        # Convert to mono if stereo
        if len(audio_data.shape) > 1:
            audio_data = np.mean(audio_data, axis=1)
        
        # Apply time limit if specified
        if max_duration > 0:
            max_samples = int(max_duration * sample_rate)
            if len(audio_data) > max_samples:
                audio_data = audio_data[:max_samples]
                file_info['duration'] = min(file_info['duration'], max_duration)
                print(f"⏰ Limited audio to first {max_duration} seconds")
        
        # Normalize
        audio_data = audio_data.astype(np.float32)
        if np.max(np.abs(audio_data)) > 0:
            audio_data = audio_data / np.max(np.abs(audio_data))
        
        # Compute spectrogram using librosa
        n_fft = 2048
        hop_length = 512
        
        # Use librosa for high-quality spectrogram
        stft = librosa.stft(audio_data, n_fft=n_fft, hop_length=hop_length)
        spectrogram = np.abs(stft)
        
        # Convert to dB
        spectrogram_db = librosa.amplitude_to_db(spectrogram, ref=np.max)
        
        # Get time and frequency axes
        times = librosa.frames_to_time(np.arange(spectrogram.shape[1]), 
                                     sr=sample_rate, hop_length=hop_length)
        freqs = librosa.fft_frequencies(sr=sample_rate, n_fft=n_fft)
        
        # Limit data size for frontend
        max_freq_points = 500
        max_time_points = 500
        
        if len(freqs) > max_freq_points:
            step_freq = len(freqs) // max_freq_points
            freqs = freqs[::step_freq]
            spectrogram_db = spectrogram_db[::step_freq, :]
        
        if len(times) > max_time_points:
            step_time = len(times) // max_time_points
            times = times[::step_time]
            spectrogram_db = spectrogram_db[:, ::step_time]
        
        spectrogram_data = {
            'spectrogram': spectrogram_db.tolist(),
            'times': times.tolist(),
            'frequencies': freqs.tolist(),
            'sample_rate': sample_rate,
            'n_fft': n_fft,
            'hop_length': hop_length,
            'duration': file_info['duration'],
            'max_duration_applied': max_duration if max_duration > 0 else None
        }
        
        print(f"✅ Spectrogram computed: {spectrogram_db.shape[1]} time frames, {spectrogram_db.shape[0]} frequency bins, duration: {file_info['duration']:.1f}s")
        
        return jsonify(spectrogram_data)
        
    except Exception as e:
        print(f"❌ Spectrogram computation error: {e}")
        return jsonify({'error': f'Spectrogram computation failed: {str(e)}'}), 500
@generic_bp.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'generic_mode',
        'timestamp': datetime.now().isoformat(),
        'endpoints_working': True,
        'presets_dir_exists': os.path.exists(PRESETS_DIR),
        'presets_count': len([f for f in os.listdir(PRESETS_DIR) if f.endswith('.json')]) if os.path.exists(PRESETS_DIR) else 0
    })

def read_audio_file(file):
    """
    Read audio file with automatic format detection
    Returns: audio_data, sample_rate, file_info
    """
    file_ext = os.path.splitext(file.filename)[1].lower()
    
    try:
        # Try soundfile first (supports most formats)
        file.stream.seek(0)
        audio_data, sample_rate = sf.read(file.stream)
        file_info = {
            'format': 'detected by soundfile',
            'sample_rate': sample_rate,
            'duration': len(audio_data) / sample_rate,
            'samples': len(audio_data),
            'channels': audio_data.shape[1] if len(audio_data.shape) > 1 else 1
        }
        return audio_data, sample_rate, file_info
        
    except Exception as e:
        print(f"⚠️  Soundfile failed, trying scipy: {e}")
        
        # Fallback to scipy for WAV files
        if file_ext in ['.wav', '.wave']:
            try:
                file.stream.seek(0)
                sample_rate, audio_data = wavfile.read(file.stream)
                file_info = {
                    'format': 'WAV',
                    'sample_rate': sample_rate,
                    'duration': len(audio_data) / sample_rate,
                    'samples': len(audio_data),
                    'channels': audio_data.shape[1] if len(audio_data.shape) > 1 else 1
                }
                return audio_data, sample_rate, file_info
            except Exception as wav_e:
                raise Exception(f"Failed to read WAV file: {str(wav_e)}")
        
        # Try librosa for other formats
        elif file_ext in ['.mp3', '.m4a', '.flac', '.ogg']:
            try:
                file.stream.seek(0)
                # Save to temporary file for librosa
                with tempfile.NamedTemporaryFile(delete=False, suffix=file_ext) as tmp:
                    file.save(tmp.name)
                    audio_data, sample_rate = librosa.load(tmp.name, sr=None, mono=False)
                    os.unlink(tmp.name)  # Clean up
                
                file_info = {
                    'format': file_ext[1:].upper(),
                    'sample_rate': sample_rate,
                    'duration': len(audio_data) / sample_rate,
                    'samples': len(audio_data),
                    'channels': audio_data.shape[0] if len(audio_data.shape) > 1 else 1
                }
                return audio_data, sample_rate, file_info
                
            except Exception as lib_e:
                raise Exception(f"Failed to read {file_ext} file: {str(lib_e)}")
        
        else:
            raise Exception(f"Unsupported file format: {file_ext}")

def apply_equalizer_fft(audio, sample_rate, bands):
    """
    Apply equalizer in frequency domain using FFT with smooth transitions
    """
    n = len(audio)
    
    # Compute FFT with proper windowing
    window = np.hanning(n)
    windowed_audio = audio * window
    fft_data = fft.rfft(windowed_audio)
    frequencies = fft.rfftfreq(n, d=1/sample_rate)
    
    # Create gain profile with smooth transitions
    gain_profile = np.ones_like(frequencies, dtype=np.float32)
    
    # Apply gains from bands with smooth transitions
    for band in bands:
        start_freq = band.get('startFreq', 20)
        end_freq = band.get('endFreq', 20000)
        gain = band.get('gain', 1.0)
        
        # Skip if gain is 1.0 (no change)
        if gain == 1.0:
            continue
            
        # Find frequency indices in this band
        band_indices = (frequencies >= start_freq) & (frequencies <= end_freq)
        
        if np.any(band_indices):
            # Apply smooth transition at boundaries
            transition_width = min(100, (end_freq - start_freq) * 0.1)  # 10% of band width or 100Hz
            
            # Create smooth gain curve
            band_gain = np.ones_like(frequencies)
            
            # Apply gain with smooth transitions
            for i, freq in enumerate(frequencies):
                if band_indices[i]:
                    # Calculate distance from boundaries
                    dist_start = max(0, freq - start_freq)
                    dist_end = max(0, end_freq - freq)
                    
                    # Calculate transition factor (0 to 1)
                    if dist_start < transition_width:
                        transition_factor = dist_start / transition_width
                    elif dist_end < transition_width:
                        transition_factor = dist_end / transition_width
                    else:
                        transition_factor = 1.0
                    
                    # Apply smooth gain
                    band_gain[i] = 1.0 + (gain - 1.0) * transition_factor
            
            # Multiply gain profiles
            gain_profile *= band_gain
    
    # Apply gain profile to FFT data
    fft_data_processed = fft_data * gain_profile
    
    # Inverse FFT
    processed_audio = fft.irfft(fft_data_processed, n)
    
    # Ensure same length as original
    if len(processed_audio) > n:
        processed_audio = processed_audio[:n]
    elif len(processed_audio) < n:
        processed_audio = np.pad(processed_audio, (0, n - len(processed_audio)))
    
    # Apply window again to reduce artifacts
    processed_audio = processed_audio * window
    
    return processed_audio

# Default presets creation
def create_default_presets():
    """Create some default presets if none exist"""
    default_presets = {
        'flat': {
            'name': 'Flat',
            'description': 'Flat frequency response',
            'bands': [
                {'id': 1, 'startFreq': 20, 'endFreq': 20000, 'gain': 1.0}
            ]
        },
        'bass_boost': {
            'name': 'Bass Boost',
            'description': 'Enhanced bass frequencies',
            'bands': [
                {'id': 1, 'startFreq': 20, 'endFreq': 250, 'gain': 1.8},
                {'id': 2, 'startFreq': 250, 'endFreq': 1000, 'gain': 1.2},
                {'id': 3, 'startFreq': 1000, 'endFreq': 4000, 'gain': 1.0},
                {'id': 4, 'startFreq': 4000, 'endFreq': 20000, 'gain': 1.0}
            ]
        },
        'treble_boost': {
            'name': 'Treble Boost',
            'description': 'Enhanced high frequencies',
            'bands': [
                {'id': 1, 'startFreq': 20, 'endFreq': 250, 'gain': 1.0},
                {'id': 2, 'startFreq': 250, 'endFreq': 1000, 'gain': 1.0},
                {'id': 3, 'startFreq': 1000, 'endFreq': 4000, 'gain': 1.2},
                {'id': 4, 'startFreq': 4000, 'endFreq': 20000, 'gain': 1.6}
            ]
        },
        'tv_mode': {
            'name': 'TV Mode',
            'description': 'Enhanced voice clarity for TV/movies',
            'bands': [
                {'id': 1, 'startFreq': 20, 'endFreq': 100, 'gain': 0.8},
                {'id': 2, 'startFreq': 100, 'endFreq': 300, 'gain': 1.0},
                {'id': 3, 'startFreq': 300, 'endFreq': 1000, 'gain': 1.5},
                {'id': 4, 'startFreq': 1000, 'endFreq': 3000, 'gain': 1.8},
                {'id': 5, 'startFreq': 3000, 'endFreq': 8000, 'gain': 1.3},
                {'id': 6, 'startFreq': 8000, 'endFreq': 20000, 'gain': 1.0}
            ]
        }
    }
    
    for preset_name, preset_data in default_presets.items():
        preset_file = os.path.join(PRESETS_DIR, f'{preset_name}.json')
        if not os.path.exists(preset_file):
            preset_data['created_at'] = datetime.now().isoformat()
            with open(preset_file, 'w', encoding='utf-8') as f:
                json.dump(preset_data, f, indent=2, ensure_ascii=False)
            print(f"📝 Created default preset: {preset_name}")

# Create default presets when module loads
create_default_presets()

print("🎛️  Generic mode API ready with all endpoints!")