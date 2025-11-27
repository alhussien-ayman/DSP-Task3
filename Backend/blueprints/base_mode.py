from flask import Blueprint, request, jsonify, send_file
import json
import sys
import os
import numpy as np
import base64
import io
import time

# Add the utils directory to Python path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from utils.signal_processing import SignalProcessor
from utils.audio_utils import AudioUtils
from utils.visualization import VisualizationUtils

class BaseMode:
    """Base class for ALL modes to eliminate code repetition"""
    
    def __init__(self, mode_name, mode_type="customized"):
        self.mode_name = mode_name
        self.mode_type = mode_type
        self.blueprint = Blueprint(f'{mode_name}_{mode_type}_bp', __name__)
        self.setup_routes()
    
    def setup_routes(self):
        """Setup common routes for ALL modes"""
        bp = self.blueprint
        
        @bp.route('/settings', methods=['GET'])
        def get_settings():
            """Get mode-specific settings - AUTO LOADS EXTERNAL JSON"""
            try:
                settings = self.load_settings()
                return jsonify(settings)
            except Exception as e:
                return jsonify({"error": f"Failed to load settings: {str(e)}"}), 500
        
        @bp.route('/process', methods=['POST'])
        def process_audio():
            """Process audio with current settings - COMMON for all modes"""
            try:
                print(f"🎯 Processing request received for mode: {self.mode_name}")
                
                if 'file' not in request.files:
                    return jsonify({'error': 'No file uploaded'}), 400
                
                file = request.files['file']
                if file.filename == '':
                    return jsonify({'error': 'No file selected'}), 400
                
                processing_data = self.parse_processing_request(request)
                
                # Load audio and process
                print("📥 Loading audio file...")
                signal, sample_rate = AudioUtils.load_audio_file(file)
                print(f"✅ Audio loaded: {len(signal)} samples, {sample_rate}Hz")
                
                print("🔧 Processing signal...")
                result = self.process_signal(signal, sample_rate, processing_data)
                print("✅ Signal processing completed")
                
                return jsonify(result)
                
            except Exception as e:
                print(f"❌ Error in process_audio: {str(e)}")
                return jsonify({'success': False, 'error': str(e)}), 500
        
        @bp.route('/test_signal', methods=['POST'])
        def generate_test_signal():
            """Generate test signal - COMMON for all modes"""
            try:
                data = request.json
                frequencies = data.get('frequencies', [100, 500, 1000, 2000])
                
                signal, sample_rate = AudioUtils.generate_test_signal(frequencies)
                buffer = AudioUtils.save_audio_to_buffer(signal, sample_rate)
                
                return send_file(
                    buffer,
                    mimetype='audio/wav',
                    as_attachment=True,
                    download_name=f'test_signal_{self.mode_name}.wav'
                )
            except Exception as e:
                return jsonify({'error': str(e)}), 500
    
    def load_settings(self):
        """Load settings - Can be overridden by specific modes"""
        settings = AudioUtils.load_mode_settings(self.mode_name)
        if not settings.get('sliders'):
            raise Exception(f"No sliders found in settings for {self.mode_name}")
        return settings
    
    def parse_processing_request(self, request):
        """Parse processing request - Can be overridden"""
        slider_values = request.form.get('sliders', '[]')
        scale_type = request.form.get('scale', 'linear')
        
        try:
            slider_values = json.loads(slider_values)
            print(f"🎚️ Slider values received: {slider_values}")
        except json.JSONDecodeError:
            raise Exception("Invalid slider values format")
        
        return {
            'slider_values': slider_values,
            'scale_type': scale_type,
            'settings': self.load_settings()
        }
    
    def process_signal(self, signal, sample_rate, processing_data):
        """Process signal - 100% backend processing with enhanced output"""
        slider_values = processing_data['slider_values']
        settings = processing_data['settings']
        scale_type = processing_data['scale_type']
        
        print(f"⚙️ Processing parameters: {len(slider_values)} sliders, scale: {scale_type}")
        print(f"🎯 BACKEND DEBUG: Scale type received: '{scale_type}'")  
        
        # Validate input
        if not settings.get('sliders'):
            raise Exception("No slider configuration found")
        
        if len(slider_values) != len(settings['sliders']):
            raise Exception(f"Slider values count ({len(slider_values)}) doesn't match settings count ({len(settings['sliders'])})")
        
        # Apply equalizer
        print("🎛️ Applying multi-band equalizer...")
        start_time = time.time()
        processed_signal = SignalProcessor.apply_multi_band_equalizer(
            signal, settings['sliders'], slider_values, sample_rate
        )
        equalizer_time = time.time() - start_time
        print(f"✅ Equalizer applied in {equalizer_time:.3f}s")
        
        # Generate visualization data
        print("📊 Computing spectrograms...")
        start_time = time.time()
        input_spectrogram, input_time_axis, input_freq_axis = SignalProcessor.compute_spectrogram(signal, sample_rate=sample_rate)
        output_spectrogram, output_time_axis, output_freq_axis = SignalProcessor.compute_spectrogram(processed_signal, sample_rate=sample_rate)
        spectrogram_time = time.time() - start_time
        print(f"✅ Spectrograms computed in {spectrogram_time:.3f}s")
        
        # Prepare data for frontend
        print("📈 Preparing visualization data...")
        input_spec_data = VisualizationUtils.prepare_spectrogram_data(input_spectrogram, input_freq_axis, scale_type)
        output_spec_data = VisualizationUtils.prepare_spectrogram_data(output_spectrogram, output_freq_axis, scale_type)
        
        # Prepare 2D spectrogram data for heatmaps
        input_spectrogram_2d = VisualizationUtils.prepare_spectrogram_2d(input_spectrogram, input_time_axis, input_freq_axis)
        output_spectrogram_2d = VisualizationUtils.prepare_spectrogram_2d(output_spectrogram, output_time_axis, output_freq_axis)
        
        # Create time arrays for signal plots
        input_time = np.linspace(0, len(signal)/sample_rate, len(signal))
        output_time = np.linspace(0, len(processed_signal)/sample_rate, len(processed_signal))
        
        # Sample for performance
        step = max(1, len(signal) // 1000)
        input_signal_data = {
            'time': input_time[::step].tolist(),
            'amplitude': signal[::step].tolist()
        }
        output_signal_data = {
            'time': output_time[::step].tolist(),
            'amplitude': processed_signal[::step].tolist()
        }
        
        # Generate processed audio buffer for playback
        print("🔊 Generating processed audio buffer...")
        processed_buffer = AudioUtils.save_audio_to_buffer(processed_signal, sample_rate)
        processed_audio_base64 = base64.b64encode(processed_buffer.getvalue()).decode('utf-8')
        
        print("✅ All processing completed successfully!")
        
        return {
            'success': True,
            'mode': self.mode_name,
            'input_spectrogram': input_spec_data,
            'output_spectrogram': output_spec_data,
            'input_spectrogram_2d': input_spectrogram_2d,
            'output_spectrogram_2d': output_spectrogram_2d,
            'input_signal': input_signal_data,
            'output_signal': output_signal_data,
            'sample_rate': sample_rate,
            'duration': len(signal) / sample_rate,
            'processed_audio_base64': processed_audio_base64,
            'processing_times': {
                'equalizer': equalizer_time,
                'spectrogram': spectrogram_time
            }
        }