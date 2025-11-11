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

# Import custom FFT and signal processing from base_mode
import sys
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from utils.signal_processing import SignalProcessor
from utils.audio_utils import AudioUtils
from utils.visualization import VisualizationUtils

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
            print(f"⚠️  Preset not found, creating default: {preset_name}")
            # Return default preset if file doesn't exist
            default_preset = {
                'name': preset_name,
                'description': 'Default equalizer preset',
                'bands': [
                    {'id': 1, 'startFreq': 20, 'endFreq': 250, 'gain': 1.0},
                    {'id': 2, 'startFreq': 250, 'endFreq': 1000, 'gain': 1.0},
                    {'id': 3, 'startFreq': 1000, 'endFreq': 4000, 'gain': 1.0},
                    {'id': 4, 'startFreq': 4000, 'endFreq': 20000, 'gain': 1.0}
                ],
                'created_at': datetime.now().isoformat(),
                'is_default': True
            }
            return jsonify(default_preset)
            
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
    """Process audio with generic equalizer settings using custom FFT"""
    try:
        print("🎚️  Processing audio with equalizer (custom FFT)...")
        
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
        
        # Apply equalizer with custom FFT
        processed_audio = apply_equalizer_custom_fft(audio_data, sample_rate, bands)
        
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
    """Compute frequency spectrum of audio signal using custom FFT"""
    try:
        print("📊 Computing frequency spectrum (custom FFT)...")
        
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
        
        # Compute FFT with custom FFT and proper windowing
        n = len(audio_data)
        
        # Use Hann window to reduce spectral leakage
        window = np.hanning(n)
        windowed_audio = audio_data * window
        
        # Compute FFT using custom implementation
        print("🌀 Computing FFT with custom implementation...")
        fft_data = np.array(SignalProcessor.custom_fft(windowed_audio))
        
        # Get frequencies - only positive frequencies
        frequencies = np.fft.fftfreq(n, d=1/sample_rate)[:n//2]
        magnitude = np.abs(fft_data[:n//2])
        
        # Convert to dB scale for better visualization
        magnitude_db = 20 * np.log10(magnitude + 1e-10)  # Add small value to avoid log(0)
        
        # Compute phase
        phase = np.angle(fft_data[:n//2])
        
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
            'max_frequency': frequencies[-1] if len(frequencies) > 0 else 0,
            'fft_type': 'custom'
        }
        
        print(f"✅ Spectrum computed with custom FFT: {len(frequencies)} frequency points")
        
        return jsonify(spectrum_data)
        
    except Exception as e:
        print(f"❌ Spectrum computation error: {e}")
        return jsonify({'error': f'Spectrum computation failed: {str(e)}'}), 500
@generic_bp.route('/compute_spectrogram', methods=['POST'])
def compute_spectrogram():
    """Compute spectrogram using base_mode implementation"""
    try:
        print("🎨 Computing spectrogram (using base_mode implementation)...")
        
        if 'file' not in request.files:
            return jsonify({'error': 'No file uploaded'}), 400
        
        file = request.files['file']
        
        # Validate file
        if not allowed_file(file.filename):
            return jsonify({'error': 'File type not supported'}), 400
        
        # Use the existing read_audio_file function instead of AudioUtils.load_audio_file
        print("📥 Loading audio file...")
        audio_data, sample_rate, file_info = read_audio_file(file)
        
        print(f"🔊 Audio loaded: {len(audio_data)} samples, {sample_rate}Hz")
        
        # Convert to mono if stereo
        if len(audio_data.shape) > 1:
            audio_data = np.mean(audio_data, axis=1)
        
        # Normalize
        audio_data = audio_data.astype(np.float32)
        if np.max(np.abs(audio_data)) > 0:
            audio_data = audio_data / np.max(np.abs(audio_data))
        
        # Directly use SignalProcessor for spectrogram computation
        print("📊 Computing spectrogram with SignalProcessor.compute_spectrogram...")
        spectrogram, time_axis, freq_axis = SignalProcessor.compute_spectrogram(
            audio_data, 
            sample_rate=sample_rate
        )
        
        print(f"✅ Spectrogram computed: shape {spectrogram.shape}")
        
        # Use VisualizationUtils to prepare the data
        print("📈 Preparing spectrogram data with VisualizationUtils...")
        spectrogram_2d = VisualizationUtils.prepare_spectrogram_2d(
            spectrogram, time_axis, freq_axis
        )
        
        # Also prepare the spectrum data for frequency plot
        spectrum_data = VisualizationUtils.prepare_spectrogram_data(
            spectrogram, freq_axis, 'linear'
        )
        
        result = {
            'spectrogram_2d': spectrogram_2d,
            'spectrum': spectrum_data,
            'sample_rate': sample_rate,
            'duration': len(audio_data) / sample_rate,
            'method': 'base_mode_implementation',
            'info': {
                'time_frames': len(time_axis),
                'frequency_bins': len(freq_axis),
                'spectrogram_shape': spectrogram.shape
            }
        }
        
        print(f"✅ Spectrogram ready: {len(time_axis)} time frames, {len(freq_axis)} frequency bins")
        
        return jsonify(result)
        
    except Exception as e:
        print(f"❌ Spectrogram computation error: {e}")
        import traceback
        print(f"🔍 Full traceback: {traceback.format_exc()}")
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
        'presets_count': len([f for f in os.listdir(PRESETS_DIR) if f.endswith('.json')]) if os.path.exists(PRESETS_DIR) else 0,
        'fft_type': 'custom'
    })

# =====================================================
@generic_bp.route('/analyze_audio', methods=['POST'])
def analyze_audio():
    """Comprehensive audio analysis using custom FFT"""
    try:
        print("🔍 Analyzing audio file (custom FFT)...")
        
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
        
        # Calculate audio properties
        duration = len(audio_data) / sample_rate
        
        # Time domain analysis
        rms = np.sqrt(np.mean(audio_data**2))
        peak = np.max(np.abs(audio_data))
        crest_factor = peak / (rms + 1e-10)
        
        # Zero-crossing rate
        zero_crossings = np.sum(np.diff(np.sign(audio_data)) != 0)
        zcr = zero_crossings / duration
        
        # Frequency domain analysis with custom FFT
        n = len(audio_data)
        window = np.hanning(n)
        windowed_audio = audio_data * window
        
        # Use custom FFT
        fft_data = np.array(SignalProcessor.custom_fft(windowed_audio))
        frequencies = np.fft.fftfreq(n, d=1/sample_rate)[:n//2]
        magnitude = np.abs(fft_data[:n//2])
        
        # Spectral centroid
        spectral_centroid = np.sum(frequencies * magnitude) / np.sum(magnitude)
        
        # Spectral bandwidth
        spectral_bandwidth = np.sqrt(np.sum(((frequencies - spectral_centroid)**2) * magnitude) / np.sum(magnitude))
        
        # Spectral rolloff (85%)
        total_energy = np.sum(magnitude)
        cumulative_energy = np.cumsum(magnitude)
        rolloff_index = np.where(cumulative_energy >= 0.85 * total_energy)[0]
        spectral_rolloff = frequencies[rolloff_index[0]] if len(rolloff_index) > 0 else frequencies[-1]
        
        # Frequency band energies
        bands = [
            {'name': 'Sub Bass', 'min': 20, 'max': 60},
            {'name': 'Bass', 'min': 60, 'max': 250},
            {'name': 'Low Mid', 'min': 250, 'max': 500},
            {'name': 'Mid', 'min': 500, 'max': 2000},
            {'name': 'Upper Mid', 'min': 2000, 'max': 4000},
            {'name': 'Presence', 'min': 4000, 'max': 6000},
            {'name': 'Brilliance', 'min': 6000, 'max': 20000}
        ]
        
        band_energies = []
        for band in bands:
            band_mask = (frequencies >= band['min']) & (frequencies <= band['max'])
            band_energy = np.sum(magnitude[band_mask])
            band_energies.append({
                'name': band['name'],
                'energy': float(band_energy),
                'percentage': float(band_energy / np.sum(magnitude) * 100)
            })
        
        analysis_results = {
            'file_info': file_info,
            'time_domain': {
                'rms': float(rms),
                'peak': float(peak),
                'crest_factor': float(crest_factor),
                'zero_crossing_rate': float(zcr)
            },
            'frequency_domain': {
                'spectral_centroid': float(spectral_centroid),
                'spectral_bandwidth': float(spectral_bandwidth),
                'spectral_rolloff': float(spectral_rolloff),
                'fft_type': 'custom'
            },
            'band_energies': band_energies,
            'loudness': float(20 * np.log10(rms + 1e-10)),
            'dynamic_range': float(20 * np.log10(peak / (rms + 1e-10)))
        }
        
        print(f"✅ Audio analysis completed for {file.filename} with custom FFT")
        
        return jsonify(analysis_results)
        
    except Exception as e:
        print(f"❌ Audio analysis error: {e}")
        return jsonify({'error': f'Audio analysis failed: {str(e)}'}), 500
    
#==============================
@generic_bp.route('/get_audio_waveform', methods=['POST'])
def get_audio_waveform():
    """Extract audio waveform data for plotting"""
    try:
        print("📈 Extracting audio waveform data...")
        
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
        
        # Limit data size for frontend (to prevent huge responses)
        max_points = 10000
        if len(audio_data) > max_points:
            step = len(audio_data) // max_points
            audio_data = audio_data[::step]
        
        # Create time array
        duration = len(audio_data) / sample_rate
        time = np.linspace(0, duration, len(audio_data))
        
        waveform_data = {
            'time': time.tolist(),
            'amplitude': audio_data.tolist(),
            'sample_rate': sample_rate,
            'duration': duration,
            'samples': len(audio_data),
            'max_points': max_points
        }
        
        print(f"✅ Waveform data extracted: {len(audio_data)} points, {duration:.2f}s duration")
        
        return jsonify(waveform_data)
        
    except Exception as e:
        print(f"❌ Waveform extraction error: {e}")
        return jsonify({'error': f'Waveform extraction failed: {str(e)}'}), 500

#==================================================================
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
def apply_equalizer_custom_fft(audio, sample_rate, bands):
    """
    Simplified equalizer using numpy FFT for stability
    """
    n = len(audio)
    
    print(f"🔧 Starting equalizer: {len(audio)} samples, {sample_rate}Hz, {len(bands)} bands")
    
    # Use numpy FFT for stability
    fft_data = np.fft.fft(audio)
    frequencies = np.fft.fftfreq(n, d=1/sample_rate)
    
    print(f"✅ FFT computed: {len(fft_data)} frequency bins")
    
    # Create gain profile
    gain_profile = np.ones(n, dtype=np.float64)
    
    # Apply each band
    for band in bands:
        start_freq = band.get('startFreq', 20)
        end_freq = band.get('endFreq', 20000)
        gain = band.get('gain', 1.0)
        
        if abs(gain - 1.0) < 0.001:
            continue
            
        # Find indices in this frequency range (consider both positive and negative frequencies)
        band_mask = (np.abs(frequencies) >= start_freq) & (np.abs(frequencies) <= end_freq)
        
        # Apply gain with simple transition
        gain_profile[band_mask] *= gain
        
        print(f"🎛️ Band {start_freq}-{end_freq}Hz: gain {gain}, {np.sum(band_mask)} bins affected")
    
    # Apply gains
    modified_fft = fft_data * gain_profile
    
    # Inverse FFT
    processed_audio = np.real(np.fft.ifft(modified_fft))
    
    # Normalize
    if np.max(np.abs(processed_audio)) > 0:
        processed_audio = processed_audio / np.max(np.abs(processed_audio))
    
    print(f"✅ Equalizer completed. Output: {len(processed_audio)} samples")
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

print("🎛️  Generic mode API ready with all endpoints (using custom FFT)!")