import base64
import io
import os
import urllib.parse
import urllib.request
from PIL import Image
from google import genai
from google.genai import types

class LazyGenAI:
    def __init__(self):
        self._client = None

    def _ensure_initialized(self):
        if self._client is None:
            api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
            self._client = genai.Client(api_key=api_key)

    def _get_working_vision_prompt(self, drawing_image) -> str:
        # Prompt tuned specifically to polish and extend a 4-year-old's artwork
        prompt_text = (
            "This image is a canvas drawing made by a 4-year-old child, containing rough doodles, colors, and emojis.\n"
            "Create an image generation prompt that follows these rules strictly:\n\n"
            "1. INTERPRET INTENTION: Recognize what the child was trying to draw (e.g., a unicorn, house, sun, person, emojis).\n"
            "2. CORRECT & CLEAN UP: Smooth out shaky lines, fix crude shapes, and finish the drawing.\n"
            "3. KEEP COMPOSITION: Keep every drawn subject, emoji, and color in its original position on the canvas. Do NOT move them around or replace them with completely different objects.\n"
            "4. EXTEND BACKGROUND: Naturally build out a soft, 2d like background environment behind and around the corrected figures .\n\n"
            "Output ONLY the final detailed prompt for the image generator, nothing else."
        )

        try:
            available_models = []
            for m in self._client.models.list():
                name = m.name.replace("models/", "") if hasattr(m, 'name') else str(m)
                available_models.append(name)
            
            print(f"Models available on your Google API key: {available_models}")

            for model in available_models:
                if "gemini" in model.lower() and "embed" not in model.lower():
                    try:
                        response = self._client.models.generate_content(
                            model=model,
                            contents=[drawing_image, prompt_text]
                        )
                        print(f"Successfully matched active model: {model}")
                        return response.text
                    except Exception as e:
                        print(f"Model '{model}' tried but failed: {e}")
        except Exception as e:
            print(f"Could not list models from Google API: {e}")

        # Fallback prompt tuned for child drawing corrections
        print("Vision API bypass. Using child-drawing correction fallback!")
        return (
            "A charming 3D animated movie scene based on a child's colorful drawing. "
            "The rough doodle characters, emojis, and shapes are cleaned up into vibrant, polished 3D figures "
            "positioned in their original canvas layout, surrounded by an expanded, magical background scene."
        )

    def beautify_sketch(self, image_bytes: bytes) -> str:
        self._ensure_initialized()

        drawing_image = Image.open(io.BytesIO(image_bytes))

        # Step 1: Analyze child's drawing, interpret intent, and keep layout
        enhanced_prompt = self._get_working_vision_prompt(drawing_image)
        print(f"Polished Canvas Prompt: {enhanced_prompt}")

        # Step 2: Render image
        try:
            image_result = self._client.models.generate_images(
                model="imagen-3.0-generate-002",
                prompt=enhanced_prompt,
                config=types.GenerateImagesConfig(
                    number_of_images=1,
                    output_mime_type="image/jpeg",
                    aspect_ratio="4:3"
                )
            )
            generated_image = image_result.generated_images[0]
            out_b64 = base64.b64encode(generated_image.image.image_bytes).decode("utf-8")
            return f"data:image/jpeg;base64,{out_b64}"

        except Exception as e:
            print(f"Imagen API bypass ({e}). Rendering via FLUX pipeline...")
            encoded_prompt = urllib.parse.quote(enhanced_prompt)
            url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?width=800&height=600&nologo=true"
            
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req) as response:
                img_bytes = response.read()
                out_b64 = base64.b64encode(img_bytes).decode("utf-8")
                return f"data:image/jpeg;base64,{out_b64}"

genai_service = LazyGenAI()