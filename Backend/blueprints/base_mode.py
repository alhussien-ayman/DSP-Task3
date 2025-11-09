from flask import Blueprint, request, jsonify, send_file
import json
import sys
import os

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
            settings = self.load_settings()
            return jsonify(settings)
        
        @bp.route('/process', methods=['POST'])
        def process_audio():
            """Process audio with current settings - COMMON for all modes"""
            try:
                if 'file' not in request.files:
                    return jsonify({'error': 'No file uploaded'}), 400
                
                file = request.files['file']
                processing_data = self.parse_processing_request(request)
                
                # Load audio and process
                signal, sample_rate = AudioUtils.load_audio_file(file)
                result = self.process_signal(signal, sample_rate, processing_data)
                
                return jsonify(result)
                
            except Exception as e:
                return jsonify({'success': False, 'error': str(e)})
        
        @bp.route('/test_signal', methods=['POST'])
        def generate_test_signal():
            """Generate test signal - COMMON for all modes"""
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
    
    def load_settings(self):
        """Load settings - Can be overridden by specific modes"""
        return AudioUtils.load_mode_settings(self.mode_name)
    
    def parse_processing_request(self, request):
        """Parse processing request - Can be overridden"""
        slider_values = request.form.get('sliders', '[]')
        scale_type = request.form.get('scale', 'linear')
        
        return {
            'slider_values': json.loads(slider_values),
            'scale_type': scale_type,
            'settings': self.load_settings()
        }
    
    def process_signal(self, signal, sample_rate, processing_data):
        """Process signal - Can be overridden by specific modes"""
        slider_values = processing_data['slider_values']
        settings = processing_data['settings']
        scale_type = processing_data['scale_type']
        
        # Default implementation for customized modes
        sliders_config = settings['sliders']
        
        # Apply equalizer
        processed_signal = SignalProcessor.apply_multi_band_equalizer(
            signal, sliders_config, slider_values, sample_rate
        )
        
        # Generate visualization data
        input_spectrogram = SignalProcessor.compute_spectrogram(signal, sample_rate=sample_rate)
        output_spectrogram = SignalProcessor.compute_spectrogram(processed_signal, sample_rate=sample_rate)
        
        input_spec_data = VisualizationUtils.prepare_spectrogram_data(input_spectrogram, scale_type)
        output_spec_data = VisualizationUtils.prepare_spectrogram_data(output_spectrogram, scale_type)
        input_signal_data = VisualizationUtils.prepare_signal_data(signal, sample_rate)
        output_signal_data = VisualizationUtils.prepare_signal_data(processed_signal, sample_rate)
        
        return {
            'success': True,
            'mode': self.mode_name,
            'input_spectrogram': input_spec_data,
            'output_spectrogram': output_spec_data,
            'input_signal': input_signal_data,
            'output_signal': output_signal_data
        }