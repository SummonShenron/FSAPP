import base64
import io
import os
import random
import re
import ssl
import urllib.parse
import urllib.request
from PIL import Image
from google import genai

class LazyGenAI:
    def __init__(self):
        self._client = None

    def _ensure_initialized(self):
        if self._client is None:
            api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
            self._client = genai.Client(api_key=api_key)

    def _get_working_vision_prompt(self, drawing_image) -> str:
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
            print("[STEP 1] Sending image to Gemini 3.5 Flash for vision analysis...")
            response = self._client.models.generate_content(
                model="gemini-3.5-flash",
                contents=[drawing_image, prompt_text]
            )
            raw_prompt = response.text.strip()
            cleaned_prompt = re.sub(r'\s+', ' ', raw_prompt)
            print(f"[STEP 1 SUCCESS] Raw Prompt: {cleaned_prompt}")
            return cleaned_prompt
        except Exception as e:
            print(f"[STEP 1 WARNING] Vision API failed ({e}). Falling back to a child-doodle interpretation prompt.")
            return (
                "A bright, whimsical child-doodle scene with the same drawn subject on a clean white canvas, "
                "smooth clean outlines, playful storybook colors, soft 2D background, cheerful and polished"
            )

    def beautify_sketch(self, image_bytes: bytes) -> str:
        try:
            self._ensure_initialized()

            # Open image
            drawing_image = Image.open(io.BytesIO(image_bytes))

            # Step 1: Generate concise prompt
            enhanced_prompt = self._get_working_vision_prompt(drawing_image)

            # Step 2: Truncate prompt to safe URL length (max 250 chars)
            short_prompt = enhanced_prompt[:250]
            print(f"[STEP 2] Rendering via Pollinations FLUX with prompt: {short_prompt}")

            seed = random.randint(1, 999999)
            encoded_prompt = urllib.parse.quote(short_prompt)
            url = (
                f"https://image.pollinations.ai/prompt/{encoded_prompt}"
                f"?width=800&height=600&nologo=true&model=flux&seed={seed}"
            )

            # Create unverified SSL context to prevent SSL cert hangs
            ctx = ssl.create_default_context()
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE

            req = urllib.request.Request(
                url, 
                headers={
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            )

            # 15-second strict timeout so it never hangs indefinitely
            with urllib.request.urlopen(req, timeout=15, context=ctx) as response:
                img_bytes = response.read()
                out_b64 = base64.b64encode(img_bytes).decode("utf-8")
                print("[STEP 2 SUCCESS] High-quality image generated successfully!")
                return f"data:image/jpeg;base64,{out_b64}"

        except Exception as e:
            print(f"[ERROR] Beautify failed completely: {e}")
            # Emergency fallback: return original uploaded image as base64 so UI doesn't break
            out_b64 = base64.b64encode(image_bytes).decode("utf-8")
            return f"data:image/png;base64,{out_b64}"

genai_service = LazyGenAI()