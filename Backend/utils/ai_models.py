import torch
import torchaudio
from demucs.pretrained import get_model
from demucs.apply import apply_model
import os
import sys
import traceback
import importlib.util
import tempfile

device = 'cuda' if torch.cuda.is_available() else 'cpu'


class AIModelManager:

    def __init__(self):
        self.device = device
        self.loaded_models = {}
        self.asteroid_model = None
        
    def load_demucs_model(self, model_name='htdemucs'):
        """Load Demucs model for music source separation"""
        if model_name not in self.loaded_models:
            print(f"Loading Demucs model: {model_name}")
            model = get_model(name=model_name)
            model = model.to(self.device)
            model.eval()
            self.loaded_models[model_name] = model
            print(f"✅ {model_name} loaded: {model.sources}")
        return self.loaded_models[model_name]
    
    def load_asteroid_model(self):
        """Load Asteroid Multi-Decoder-DPRNN from local clone"""
        if self.asteroid_model is None:
            try:
                print("Loading Asteroid Multi-Decoder-DPRNN model from local repo...")
                
                # Get absolute path relative to this file
                current_dir = os.path.dirname(os.path.abspath(__file__))
                asteroid_path = os.path.join(
                    current_dir, 
                    "..", 
                    "asteroid_model", 
                    "asteroid", 
                    "egs", 
                    "wsj0-mix-var", 
                    "Multi-Decoder-DPRNN"
                )
                asteroid_path = os.path.normpath(asteroid_path)
                
                print(f"   Looking for model at: {asteroid_path}")
                
                if not os.path.exists(asteroid_path):
                    raise FileNotFoundError(f"Path not found: {asteroid_path}")
                
                if asteroid_path not in sys.path:
                    sys.path.insert(0, asteroid_path)
                    print(f"   Added to sys.path")
                    
                model_file = os.path.join(asteroid_path, "model.py")
                if not os.path.exists(model_file):
                    raise FileNotFoundError(f"Model file not found: {model_file}")
                    
                spec = importlib.util.spec_from_file_location("asteroid_model_module", model_file)
                module = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(module)
                
                MultiDecoderDPRNN = getattr(module, "MultiDecoderDPRNN", None)
                if MultiDecoderDPRNN is None:
                    raise ImportError("MultiDecoderDPRNN not found in model.py")
                    
                print("   ✅ Imported MultiDecoderDPRNN")
                
                # Monkey-patch torch.load
                original_load = torch.load
                
                def patched_load(*args, **kwargs):
                    kwargs['weights_only'] = False
                    return original_load(*args, **kwargs)
                
                torch.load = patched_load
                
                try:
                    print("   Downloading pretrained weights...")
                    self.asteroid_model = MultiDecoderDPRNN.from_pretrained(
                        "JunzheJosephZhu/MultiDecoderDPRNN"
                    ).eval()
                finally:
                    torch.load = original_load
                
                if torch.cuda.is_available():
                    self.asteroid_model = self.asteroid_model.to(self.device)
                
                print("✅ Asteroid model loaded successfully from local repo.")
            except Exception as e:
                print(f"❌ Failed to load Asteroid model: {e}")
                traceback.print_exc()
                raise
        return self.asteroid_model
    
    def separate_with_htdemucs(self, audio_path, model_name='htdemucs_6s'):
        """
        Separate audio with Demucs and return TENSORS
        
        Args:
            audio_path: Path to input audio file or file-like object
            model_name: Demucs model name
            
        Returns:
            tuple: (drums_tensor, bass_tensor, other_tensor, vocals_tensor, guitar_tensor, piano_tensor, message)
        """
        if audio_path is None:
            return None, None, None, None, None, None, "Please upload an audio file."

        try:
            # Handle file-like objects
            if hasattr(audio_path, 'read'):
                print("Saving uploaded file to temp location...")
                temp_input = tempfile.NamedTemporaryFile(suffix='.wav', delete=False)
                audio_path.save(temp_input.name)
                audio_path = temp_input.name
                print(f"   Saved to: {audio_path}")
            
            print(f"Loading audio from: {audio_path}")
            wav, sr = torchaudio.load(audio_path)
            print(f"   Input shape: {wav.shape}, Sample rate: {sr}Hz")

            # Convert mono to stereo
            if wav.shape[0] == 1:
                print("   Converting mono to stereo...")
                wav = wav.repeat(2, 1)

            # Load model
            model = self.load_demucs_model(model_name)
            
            # Resample if needed
            if sr != model.samplerate:
                print(f"   Resampling from {sr}Hz to {model.samplerate}Hz...")
                resampler = torchaudio.transforms.Resample(sr, model.samplerate)
                wav = resampler(wav)
                sr = model.samplerate

            print(f"Applying {model_name}...")
            wav = wav.to(self.device)
            
            with torch.no_grad():
                # apply_model expects shape: (batch, channels, samples)
                sources = apply_model(model, wav[None], device=self.device, progress=True)[0]
            
            print(f"✅ Separation complete.")
            print(f"   Output shape: {sources.shape}")
            print(f"   Sources: {model.sources}")

            # Return tensors directly (shape: [channels, samples] for each stem)
            output_tensors = [sources[i].cpu() for i in range(sources.shape[0])]
            
            # Return 6 tensors + success message
            return (*output_tensors, f"✅ Demucs separation successful! Generated {len(output_tensors)} stems.")

        except Exception as e:
            print(f"❌ Error: {e}")
            traceback.print_exc()
            return None, None, None, None, None, None, f"❌ Error: {str(e)}"
    
    def separate_voices_with_asteroid(self, audio_path):
        """
        Separate voices using Asteroid Multi-Decoder-DPRNN and return TENSORS
        
        Args:
            audio_path: Path to audio file or file-like object
            
        Returns:
            tuple: (voice1_tensor, voice2_tensor, voice3_tensor, voice4_tensor, message)
        """
        if audio_path is None:
            return None, None, None, None, "Please upload an audio file."

        try:
            # Handle file-like objects
            if hasattr(audio_path, 'read'):
                print("Saving uploaded file to temp location...")
                temp_input = tempfile.NamedTemporaryFile(suffix='.wav', delete=False)
                audio_path.save(temp_input.name)
                audio_path = temp_input.name
                print(f"   Saved to: {audio_path}")
            
            print(f"Asteroid: Loading audio from: {audio_path}")
            
            # Load audio
            mixture, sr = torchaudio.load(audio_path)
            print(f"   Input: shape={mixture.shape}, sample_rate={sr}Hz")
            
            # Convert to mono if stereo
            if mixture.shape[0] == 2:
                print("   Converting stereo to mono...")
                mixture = mixture.mean(dim=0, keepdim=True)
            
            # Resample to 8kHz (required by model)
            if sr != 8000:
                print(f"   Resampling from {sr}Hz to 8000Hz...")
                resampler = torchaudio.transforms.Resample(sr, 8000)
                mixture = resampler(mixture)
                sr = 8000
            
            # Load model
            model = self.load_asteroid_model()
            
            # Move to device
            if torch.cuda.is_available():
                mixture = mixture.to(self.device)
            
            print("Asteroid: Separating voices...")
            with torch.no_grad():
                sources_est = model.separate(mixture).cpu()
            
            print(f"✅ Asteroid: Separation complete.")
            print(f"   Output shape: {sources_est.shape}")
            
            num_sources = sources_est.shape[0]
            print(f"   Found {num_sources} sources")
            
            # Return up to 4 voice tensors
            output_tensors = [None, None, None, None]
            for i in range(min(num_sources, 4)):
                output_tensors[i] = sources_est[i].cpu()
            
            # Return exactly 5 values: 4 tensors + message
            return (*output_tensors, f"✅ Asteroid voice separation successful! Generated {num_sources} voices.")

        except Exception as e:
            print(f"❌ Asteroid Error: {e}")
            traceback.print_exc()
            return None, None, None, None, f"❌ Asteroid Error: {str(e)}"
    
    def unload_models(self):
        """Free memory"""
        self.loaded_models.clear()
        
        if self.asteroid_model is not None:
            del self.asteroid_model
            self.asteroid_model = None
        
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        print("✅ All models unloaded")


ai_manager = AIModelManager()


if __name__ == "__main__":
    test_audio_music = "dataset/02. School Boy-9.wav"
    test_audio_voice = "dataset/4_mixture.wav"
    
    print("=" * 60)
    print("Testing Demucs 6-stem separation (music)")
    print("=" * 60)
    result = ai_manager.separate_with_htdemucs(test_audio_music, 'htdemucs_6s')
    if result[0] is not None:
        print("\n📁 Music Stems (tensors):")
        labels = ["🥁 Drums", "🎸 Bass", "🎹 Other", "🎤 Vocals", "🎸 Guitar", "🎹 Piano"]
        for label, tensor in zip(labels, result[:-1]):
            if tensor is not None:
                print(f"  {label}: shape={tensor.shape}")
    
    print("\n" + "=" * 60)
    print("Testing Asteroid voice separation")
    print("=" * 60)
    voices_result = ai_manager.separate_voices_with_asteroid(test_audio_voice)
    if voices_result[0] is not None:
        print("\n📁 Separated Voices (tensors):")
        for i, tensor in enumerate(voices_result[:-1]):
            if tensor is not None:
                print(f"  🎤 Voice {i+1}: shape={tensor.shape}")