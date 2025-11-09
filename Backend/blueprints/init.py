from .ai_mode import ai_bp
from .generic_mode import generic_bp
from .customized_mode import instruments_bp, animals_bp, voices_bp

# Explicitly export all blueprints
__all__ = ['ai_bp', 'generic_bp', 'instruments_bp', 'animals_bp', 'voices_bp']