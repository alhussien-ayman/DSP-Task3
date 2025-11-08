import torch
import torchaudio
from demucs.pretrained import get_model
from demucs.apply import apply_model
import time
import os

device = 'cuda' if torch.cuda.is_available() else 'cpu'


class AIModelManager:

    def __init__(self):
        self.device = device
        self.demucs_model = None
        self.astroid_model = None
        
    def load_demucs_model(self, model_name='htdemucs'):
        """Load Demucs model for music source separation"""
        if self.demucs_model is None:
            print(f"Loading HT-Demucs model: {model_name}")
            self.demucs_model = get_model(name=model_name)
            self.demucs_model = self.demucs_model.to(self.device)
            self.demucs_model.eval()
            print("✅ HT-Demucs model loaded successfully.")
        return self.demucs_model

    def separate_with_htdemucs(self, audio_path, htdemucs_model=None):
        """
        Separates an audio file using HT-Demucs into drums, bass, other, and vocals.
        Returns FILE PATHS.
        """
        if audio_path is None:
            return None, None, None, None, "Please upload an audio file."

        try:
            print(f"HT-Demucs: Loading audio from: {audio_path}")

            # Load audio with torchaudio
            wav, sr = torchaudio.load(audio_path)

            if wav.shape[0] == 1:
                print("Audio is mono, converting to stereo.")
                wav = wav.repeat(2, 1)

            print("HT-Demucs: Applying the separation model...")
            with torch.no_grad():
                sources = apply_model(htdemucs_model, wav[None], device='cpu', progress=True)[0]
            print("HT-Demucs: Separation complete.")

            # Save stems with timestamp to ensure uniqueness
            timestamp = int(time.time() * 1000)  # millisecond timestamp
            output_dir = f"htdemucs_stems_{timestamp}"
            os.makedirs(output_dir, exist_ok=True)

            stem_names = ["drums", "bass", "other", "vocals"]

            output_paths = []
            for i, name in enumerate(stem_names):
                out_path = os.path.join(output_dir, f"{name}_{timestamp}.wav")
                torchaudio.save(out_path, sources[i].cpu(), sr)
                output_paths.append(out_path)
                print(f"✅ HT-Demucs saved {name} to {out_path}")

            return output_paths[0], output_paths[1], output_paths[2], output_paths[3], "✅ HT-Demucs separation successful!"

        except Exception as e:
            print(f"HT-Demucs Error: {e}")
            return None, None, None, None, f"❌ HT-Demucs Error: {str(e)}"
    
    def unload_models(self):
        """Free up memory by unloading models"""
        if self.demucs_model is not None:
            del self.demucs_model
            self.demucs_model = None
        if self.astroid_model is not None:
            del self.astroid_model
            self.astroid_model = None
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        print("✅ Models unloaded and memory cleared.")


# Singleton instance
ai_manager = AIModelManager()


# Test
if __name__ == "__main__":
    test_audio = "/home/saif/Downloads/Data_DSP3/IRMAS-Sample/Testing/14.  Boots Randolph - Yakety Sax-1.wav"
    
    # Load model
    model = ai_manager.load_demucs_model('htdemucs')
    
    # Separate audio
    drums, bass, other, vocals, message = ai_manager.separate_with_htdemucs(test_audio, model)
    print(f"\n{message}")
    
    if drums:
        print(f"\n📁 Output files:")
        print(f"  🥁 Drums:  {drums}")
        print(f"  🎸 Bass:   {bass}")
        print(f"  🎹 Other:  {other}")
        print(f"  🎤 Vocals: {vocals}")