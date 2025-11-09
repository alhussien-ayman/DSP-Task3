import torch
import torchaudio
from demucs.pretrained import get_model
from demucs.apply import apply_model
import time
import os
import sys
import traceback
import importlib.util

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
                
                # For Jupyter Notebook, use absolute path
                asteroid_path = "/mnt/data/Code/web_workspace/DSP-Task3/Backend/asteroid_model/asteroid/egs/wsj0-mix-var/Multi-Decoder-DPRNN"
                
                print(f"   Looking for model at: {asteroid_path}")
                
                # Check if path exists
                if not os.path.exists(asteroid_path):
                    raise FileNotFoundError(f"Path not found: {asteroid_path}")
                
                # Add to Python path
                if asteroid_path not in sys.path:
                    sys.path.insert(0, asteroid_path)
                    print(f"   Added to sys.path")
                # Import the model from the cloned repo (load model.py dynamically)
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
                print("   ✅ Imported MultiDecoderDPRNN")
                
                # Monkey-patch torch.load to fix PyTorch 2.6 weights_only issue
                original_load = torch.load
                
                def patched_load(*args, **kwargs):
                    # Force weights_only=False for Asteroid checkpoint (trusted source)
                    kwargs['weights_only'] = False
                    return original_load(*args, **kwargs)
                
                # Temporarily replace torch.load
                torch.load = patched_load
                
                try:
                    # Load pre-trained model
                    print("   Downloading pretrained weights...")
                    self.asteroid_model = MultiDecoderDPRNN.from_pretrained(
                        "JunzheJosephZhu/MultiDecoderDPRNN"
                    ).eval()
                finally:
                    # Restore original torch.load
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
        """Separate audio with Demucs"""
        if audio_path is None:
            return None, None, None, None, "Please upload an audio file."

        try:
            print(f"Loading audio from: {audio_path}")
            wav, sr = torchaudio.load(audio_path)

            if wav.shape[0] == 1:
                wav = wav.repeat(2, 1)

            model = self.load_demucs_model(model_name)

            print(f"Applying {model_name}...")
            with torch.no_grad():
                sources = apply_model(model, wav[None], device=self.device, progress=True)[0]
            print("✅ Separation complete.")

            #timestamp = int(time.time() * 1000)
            output_dir = f"demucs_{model_name}"
            os.makedirs(output_dir, exist_ok=True)

            output_paths = []
            for i, name in enumerate(model.sources):
                out_path = os.path.join(output_dir, f"{name}.wav")
                torchaudio.save(out_path, sources[i].cpu(), sr)
                output_paths.append(out_path)
                print(f"✅ Saved {name}")

            return (*output_paths, f"✅ Demucs separation successful!")

        except Exception as e:
            print(f"❌ Error: {e}")
            traceback.print_exc()
            num_stems = len(self.loaded_models.get(model_name, get_model(model_name)).sources)
            return (*([None] * num_stems), f"❌ Error: {str(e)}")
    
    def separate_voices_with_asteroid(self, audio_path, num_speakers=2):
        """
        Separate voices using Asteroid Multi-Decoder-DPRNN
        
        Args:
            audio_path: Path to audio file
            num_speakers: Expected number of speakers (default: 2)
            
        Returns:
            tuple: (*voice_paths, message)
        """
        if audio_path is None:
            return None, None, "Please upload an audio file."

        try:
            print(f"Asteroid: Loading audio from: {audio_path}")
            
            # Load audio
            mixture, sr = torchaudio.load(audio_path)
            print(f"Input: shape={mixture.shape}, sample_rate={sr}Hz")
            
            # Convert to mono if stereo
            if mixture.shape[0] == 2:
                print("Converting stereo to mono...")
                mixture = mixture.mean(dim=0, keepdim=True)
            
            # Resample to 8kHz (required by model)
            if sr != 8000:
                print(f"Resampling from {sr}Hz to 8000Hz...")
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
                # Use the separate method like in the notebook
                sources_est = model.separate(mixture).cpu()
            
            print(f"✅ Asteroid: Separation complete.")
            print(f"   Output shape: {sources_est.shape}")
            
            num_sources = sources_est.shape[0]
            print(f"   Found {num_sources} sources")
            
            # Save separated voices
            #timestamp = int(time.time() * 1000)
            output_dir = f"asteroid_voices"
            os.makedirs(output_dir, exist_ok=True)
            
            output_paths = []
            for i in range(num_sources):
                out_path = os.path.join(output_dir, f"voice_{i+1}.wav")
                voice_audio = sources_est[i].unsqueeze(0)  # Shape: (1, samples)
                torchaudio.save(out_path, voice_audio, 8000)
                output_paths.append(out_path)
                print(f"✅ Saved voice {i+1} to {out_path}")
            
            return (*output_paths, "✅ Asteroid voice separation successful!")

        except Exception as e:
            print(f"❌ Asteroid Error: {e}")
            traceback.print_exc()
            return None, None, f"❌ Asteroid Error: {str(e)}"
    
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
    test_audio_music = "/home/saif/Downloads/Data_DSP3/IRMAS-Sample/Testing/02. School Boy-9.wav"
    test_audio_voice = "/home/saif/Downloads/Data_DSP3/4_mixture.wav"
    
    print("=" * 60)
    print("Testing Demucs 6-stem separation (music)")
    print("=" * 60)
    result = ai_manager.separate_with_htdemucs(test_audio_music, 'htdemucs_6s')
    if result[0]:
        print("\n📁 Music Stems:")
        labels = ["🥁 Drums", "🎸 Bass", "🎹 Other", "🎤 Vocals", "🎸 Guitar", "🎹 Piano"]
        for label, path in zip(labels, result[:-1]):
            print(f"  {label}: {path}")
    
    print("\n" + "=" * 60)
    print("Testing Asteroid voice separation")
    print("=" * 60)
    voices_result = ai_manager.separate_voices_with_asteroid(test_audio_voice)
    if voices_result[0]:
        print("\n📁 Separated Voices:")
        for i, path in enumerate(voices_result[:-1]):
            print(f"  🎤 Voice {i+1}: {path}")