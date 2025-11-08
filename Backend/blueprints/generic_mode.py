from flask import request, jsonify
import json
from .base_mode import BaseMode

class GenericMode(BaseMode):
    """Generic mode with dynamic frequency bands"""
    
    def __init__(self):
        super().__init__('generic', 'generic')
    
    def load_settings(self):
        """Override for generic mode - dynamic bands"""
        # Generic mode doesn't use predefined JSON
        return {"bands": []}  # Would be dynamic from UI
    
    def parse_processing_request(self, request):
        """Override for generic mode parameters"""
        bands_data = request.form.get('bands', '[]')
        gains_data = request.form.get('gains', '[]')
        scale_type = request.form.get('scale', 'linear')
        
        return {
            'bands': json.loads(bands_data),
            'gains': json.loads(gains_data),
            'scale_type': scale_type,
            'settings': self.load_settings()
        }
    
    def process_signal(self, signal, sample_rate, processing_data):
        """Override for generic mode processing"""
        bands = processing_data['bands']
        gains = processing_data['gains']
        
        # Convert to slider-like format for processing
        sliders_config = []
        slider_values = []
        
        for i, (band, gain) in enumerate(zip(bands, gains)):
            sliders_config.append({
                'name': f'Band {i+1}',
                'frequency_bands': [band]
            })
            slider_values.append(gain)
        
        # Use the base processing with dynamic bands
        processing_data['slider_values'] = slider_values
        processing_data['settings'] = {'sliders': sliders_config}
        
        return super().process_signal(signal, sample_rate, processing_data)

# Create generic mode blueprint instance
generic_mode_instance = GenericMode()
generic_bp = generic_mode_instance.blueprint