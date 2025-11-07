from flask import Blueprint, request, jsonify, send_file
from utils.signal_processing import SignalProcessor
from utils.audio_utils import AudioUtils
from utils.visualization import VisualizationUtils

class BaseModeBlueprint:
    """Base blueprint for all modes to avoid code repetition"""
    
    def __init__(self, mode_name):
        self.mode_name = mode_name
        self.blueprint = Blueprint(f'{mode_name}_bp', __name__)
        self.setup_routes()
    
    def setup_routes(self):
        """Setup common routes for all modes"""
        bp = self.blueprint
        
        @bp.route('/settings', methods=['GET'])
        def get_settings():
            """Get mode-specific settings"""
            settings = AudioUtils.load_mode_settings(self.mode_name)
            return jsonify(settings)
        
        @bp.route('/process', methods=['POST'])
        def process_audio():
            """Process audio with equalizer settings"""
            try:
                if 'file' not in request.files:
                    return jsonify({'error': 'No file uploaded'}), 400
                
                file = request.files['file']
                slider_values = request.form.get('sliders', '[]')
                scale_type = request.form.get('scale', 'linear')
                
                # Load and process audio
                signal, sample_rate = AudioUtils.load_audio_file(file)
                slider_values = json.loads(slider_values)
                
                # Get mode settings
                settings = AudioUtils.load_mode_settings(self.mode_name)
                frequency_bands = [slider['frequency_bands'] for slider in settings['sliders']]
                
                # Apply equalizer
                frequency_mask = SignalProcessor.generate_frequency_mask(
                    len(signal), frequency_bands, slider_values, sample_rate
                )
                processed_signal = SignalProcessor.apply_frequency_filter(signal, frequency_mask)
                
                # Generate spectrograms
                input_spectrogram = SignalProcessor.compute_spectrogram(signal, sample_rate=sample_rate)
                output_spectrogram = SignalProcessor.compute_spectrogram(processed_signal, sample_rate=sample_rate)
                
                # Prepare response data
                input_spec_data = VisualizationUtils.prepare_spectrogram_data(input_spectrogram, scale_type)
                output_spec_data = VisualizationUtils.prepare_spectrogram_data(output_spectrogram, scale_type)
                input_signal_data = VisualizationUtils.prepare_signal_data(signal, sample_rate)
                output_signal_data = VisualizationUtils.prepare_signal_data(processed_signal, sample_rate)
                
                # Return processed audio
                audio_buffer = AudioUtils.save_audio_to_buffer(processed_signal, sample_rate)
                
                return jsonify({
                    'success': True,
                    'input_spectrogram': input_spec_data,
                    'output_spectrogram': output_spec_data,
                    'input_signal': input_signal_data,
                    'output_signal': output_signal_data,
                    'audio_url': f'/api/{self.mode_name}/download_processed'
                })
                
            except Exception as e:
                return jsonify({'success': False, 'error': str(e)})
        
        @bp.route('/download_processed', methods=['GET'])
        def download_processed():
            """Download processed audio file"""
            # In a real implementation, you'd store the processed audio temporarily
            # For now, return a test file
            test_signal, sr = AudioUtils.generate_test_signal([100, 500, 1000])
            buffer = AudioUtils.save_audio_to_buffer(test_signal, sr)
            
            return send_file(
                buffer,
                mimetype='audio/wav',
                as_attachment=True,
                download_name=f'processed_{self.mode_name}.wav'
            )
        
        @bp.route('/test_signal', methods=['POST'])
        def generate_test_signal():
            """Generate test signal for the specific mode"""
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