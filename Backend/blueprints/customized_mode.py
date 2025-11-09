from .base_mode import BaseMode

class CustomizedMode(BaseMode):
    """Customized mode base class for instruments, animals, voices"""
    
    def __init__(self, mode_name):
        super().__init__(mode_name, 'customized')

# Create specific mode instances and export their blueprints
instruments_mode = CustomizedMode('instruments')
animals_mode = CustomizedMode('animals') 
voices_mode = CustomizedMode('voices')

instruments_bp = instruments_mode.blueprint
animals_bp = animals_mode.blueprint
voices_bp = voices_mode.blueprint