from fastapi import FastAPI, HTTPException, UploadFile, File, Form, status, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import os
import gridfs
import base64
from fastapi.responses import StreamingResponse
import io
from bson import ObjectId
from backend.auth.auth import get_current_user
from backend.db.db import get_db, test_connection
from backend.logging.logger import setup_logging
from backend.models.models import genai_service
from dotenv import load_dotenv

load_dotenv()
logger = setup_logging()
app = FastAPI(title="Family Soundboard API")
pin = os.getenv("ADMIN_PIN")
# --- 2. Dynamic CORS Middleware ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://192.168.1.6:5173"
    ],
    # REGEX matches ANY local IP address (e.g. 192.168.1.x) OR any .vercel.app domain
    allow_origin_regex=r"https://.*\.vercel\.app|http://192\.168\.\d+\.\d+(:\d+)?|http://10\.\d+\.\d+\.\d+(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup():
    test_connection()

# --- Pydantic Schemas ---
class SoundCardCreate(BaseModel):
    title: str               # e.g., "Auntie Sarah"
    relation: str            # e.g., "Auntie"
    photo_url: str           # Public image link or base64 string
    bg_color: Optional[str] = "#dbeafe" # Default soft blue
    fact: Optional[str] = ""            # 🕵️ Single active clue
    facts: Optional[List[str]] = []     # 🕵️ List of all clues


class BulkPhotoDelete(BaseModel):
    photo_ids: List[str]

class BulkAudioDelete(BaseModel):
    audio_ids: List[str]

class PinVerification(BaseModel):
    pin: str

class CardOrderUpdate(BaseModel):
    card_ids: List[str]

class SoundCardUpdate(BaseModel):
    title: Optional[str] = None
    relation: Optional[str] = None
    bg_color: Optional[str] = None
    photo_urls: Optional[List[str]] = None
    photo_url: Optional[str] = None
    fact: Optional[str] = ""            # 🕵️ Single active clue
    facts: Optional[List[str]] = []     # 🕵️ List of all clues

class BeautifyRequest(BaseModel):
    image_base64: str

# --- 1. Request Logging Middleware ---
@app.middleware("http")
async def log_incoming_requests(request: Request, call_next):
    logger.info(f"================== INCOMING REQUEST ==================")
    logger.info(f"Method & Path: {request.method} {request.url.path}")
    logger.info(f"Origin Header: {request.headers.get('origin', 'No Origin Header')}")
    logger.info(f"Auth Header: {'Present' if 'authorization' in request.headers else 'Missing'}")
    response = await call_next(request)
    logger.info(f"Response Status: {response.status_code}")
    logger.info(f"======================================================")
    return response

@app.get("/api/cards")
def get_sound_cards(current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]  # Unique Clerk ID (e.g., 'user_2pX...')
    db = get_db()
    if db is None:
        return []
    # Scoped strictly to the logged-in user
    cards = list(db.sound_cards.find({"user_id": user_id}).sort("order", 1))
    for card in cards:
        card["id"] = str(card["_id"])
        del card["_id"]
    logger.info(f"Retrieved cards for user {current_user['sub']}")
    return cards

@app.post("/api/cards")
async def create_sound_card(
    title: str = Form(...),
    relation: str = Form(""),
    photo_url: Optional[str] = Form(None),
    bg_color: Optional[str] = Form("#dbeafe"),
    fact: Optional[str] = Form(""),
    file: Optional[UploadFile] = File(None),
    current_user: dict = Depends(get_current_user)
):
    db = get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database disabled")

    try:
        final_photo_url = photo_url

        # 1. If an image file was uploaded, stream it straight into GridFS
        if file and file.filename:
            fs = gridfs.GridFS(db)
            file_id = fs.put(
                await file.read(),
                filename=file.filename,
                content_type=file.content_type
            )
            final_photo_url = f"/api/photo/{str(file_id)}"

        if not final_photo_url:
            raise HTTPException(status_code=400, detail="Must provide either a photo URL or upload an image file")

        # 2. Build the MongoDB document
        new_card = {
            "title": title,
            "relation": relation,
            "photo_url": final_photo_url,
            "photo_urls": [final_photo_url],
            "bg_color": bg_color,
            "fact": fact,
            "facts": [fact] if fact else [],
            "user_id": current_user["sub"],
            "audio_url": None
        }

        # 3. Save to MongoDB sound_cards collection
        result = db.sound_cards.insert_one(new_card) 
        new_card["id"] = str(result.inserted_id)
        del new_card["_id"]

        logger.info(f"Created card {new_card['id']} with GridFS image for user {current_user['sub']}")
        return new_card

    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Failed to create new card: {e}")
        raise HTTPException(status_code=500, detail="Failed to create card")

@app.post("/api/cards/reorder")
def reorder_cards(payload: CardOrderUpdate):
    db = get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database disabled")
    for index, card_id in enumerate(payload.card_ids):
        db.sound_cards.update_one(
            {"_id": ObjectId(card_id)},
            {"$set": {"order": index}}
        )
    
    return {"status": "success"}

@app.post("/api/cards/{card_id}/audio")
async def upload_audio_clip(
    card_id: str,
    label: str = Form(""),
    is_daily_postcard: bool = Form(False),
    file: UploadFile = File(...)
):
    db = get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database disabled")
    fs = gridfs.GridFS(db)
    file_id = fs.put(await file.read(), filename=file.filename, content_type=file.content_type)
    audio_doc = {
        "card_id": ObjectId(card_id),
        "file_id": file_id,
        "label": label,
        "is_daily_postcard": is_daily_postcard,
    }
    result = db.audio_clips.insert_one(audio_doc)
    # NEW: Update the parent sound card's active audio_url
    audio_url = f"/api/audio/{str(file_id)}"
    db.sound_cards.update_one(
        {"_id": ObjectId(card_id)},
        {"$set": {"audio_url": audio_url}}
    )
    return {
        "id": str(result.inserted_id),
        "card_id": card_id,
        "label": label,
        "is_daily_postcard": is_daily_postcard,
        "audio_url": audio_url,
    }

@app.get("/api/cards/{card_id}/audio")
def list_audio_clips(card_id: str):
    db = get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database disabled")
    clips = list(db.audio_clips.find({"card_id": ObjectId(card_id)}))
    for clip in clips:
        clip["id"] = str(clip["_id"])
        clip["file_id"] = str(clip["file_id"])
        del clip["_id"]
        clip["audio_url"] = f"/api/audio/{clip['file_id']}"
    return clips

@app.patch("/api/cards/{card_id}")
def update_card(card_id: str, payload: SoundCardUpdate):
    db = get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database disabled")
    card = db.sound_cards.find_one({"_id": ObjectId(card_id)})
    if card is None:
        raise HTTPException(status_code=404, detail="Card not found")
        
    update_data = {}
    if payload.title is not None:
        update_data["title"] = payload.title
    if payload.relation is not None:
        update_data["relation"] = payload.relation
    if payload.bg_color is not None:
        update_data["bg_color"] = payload.bg_color
    if payload.photo_url is not None:
        update_data["photo_url"] = payload.photo_url
    if payload.photo_urls is not None:
        update_data["photo_urls"] = payload.photo_urls
    # 🕵️ Pass fact and facts to MongoDB update object
    if payload.fact is not None:
        update_data["fact"] = payload.fact
    if payload.facts is not None:
        update_data["facts"] = payload.facts
    if update_data:
        db.sound_cards.update_one(
            {"_id": ObjectId(card_id)},
            {"$set": update_data}
        )
    updated = db.sound_cards.find_one({"_id": ObjectId(card_id)})
    updated["id"] = str(updated["_id"])
    del updated["_id"]
    return updated
    


@app.delete("/api/cards/{card_id}")
def delete_card(card_id: str):
    db = get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database disabled")
    try:
        card = db.sound_cards.find_one({"_id": ObjectId(card_id)})
        if card is None:
            raise HTTPException(status_code=404, detail="Card not found")
        clips = list(db.audio_clips.find({"card_id": ObjectId(card_id)}))
        fs = gridfs.GridFS(db)
        for clip in clips:
            try:
                fs.delete(clip["file_id"])
            except Exception as e:
                logger.error(f"Failed to delete GridFS file {clip['file_id']}: {e}")
        db.audio_clips.delete_many({"card_id": ObjectId(card_id)})
        db.sound_cards.delete_one({"_id": ObjectId(card_id)})
        logger.info(f"Card {card_id} and all audio clips deleted successfully!")
        return {"status": "success", "message": "Card and all audio clips deleted"}
    except Exception as e:
        logger.error(f"Attempt to delete card {card_id} was unsuccessful: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete card")

@app.delete("/api/audio/{audio_id}/audio")
def delete_audio_clips(audio_id: str):
    db = get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database not found")
    clip = db.audio_clips.find_one({"_id": ObjectId(audio_id)})
    if clip is None:
        raise HTTPException(status_code=404, detail="Audio clip not found")
    file_id = clip["file_id"]
    fs = gridfs.GridFS(db)
    try:
        fs.delete(file_id)
        db.audio_clips.delete_one({"_id": ObjectId(audio_id)})
        logger.info(f"{file_id} deleted successfully!")
        return {"status": "success", "message": "Audio clip deleted"}
    except Exception as e:
        logger.error(f"failed to delete {file_id}") 
        logger.error(f"Failed to delete {file_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete audio clip")

@app.delete("/api/cards/{card_id}/audio")
def bulk_delete_audio(card_id: str, payload: BulkAudioDelete):
    db = get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database disabled")
    card = db.sound_cards.find_one({"_id": ObjectId(card_id)})
    if card is None:
        raise HTTPException(status_code=404, detail="Card not found")
    fs = gridfs.GridFS(db)
    for audio_id in payload.audio_ids:
        clip = db.audio_clips.find_one({"_id": ObjectId(audio_id)})
        if clip is None:
            logger.warning(f"Audio clip {audio_id} not found for card {card_id}")
            continue
        # Delete GridFS file
        try:
            fs.delete(clip["file_id"])
        except Exception as e:
            logger.error(f"Failed to delete GridFS file {clip['file_id']}: {e}")
            continue
        # Delete audio clip document
        db.audio_clips.delete_one({"_id": ObjectId(audio_id)})
    updated_clips = list(db.audio_clips.find({"card_id": ObjectId(card_id)}))
    for clip in updated_clips:
        clip["id"] = str(clip["_id"])
        clip["file_id"] = str(clip["file_id"])
        clip["audio_url"] = f"/api/audio/{clip['file_id']}"
        del clip["_id"]
    return updated_clips
    
@app.post("/api/cards/{card_id}/photos")
async def upload_photo(card_id: str, file: UploadFile = File(...)):
    db = get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database disabled")
    card = db.sound_cards.find_one({"_id": ObjectId(card_id)})
    if card is None:
        raise HTTPException(status_code=404, detail="Card not found")
    fs = gridfs.GridFS(db)
    file_id = fs.put(
        await file.read(),
        filename=file.filename,
        content_type=file.content_type
    )
    photo_url = f"/api/photo/{str(file_id)}"
    db.sound_cards.update_one(
        {"_id": ObjectId(card_id)},
        {
            "$push": {"photo_urls": photo_url},
            "$set": {"photo_url": photo_url}  # <-- Sets newly uploaded picture as primary photo
        }
    )
    updated = db.sound_cards.find_one({"_id": ObjectId(card_id)})
    updated["id"] = str(updated["_id"])
    del updated["_id"]
    return updated

@app.delete("/api/cards/{card_id}/photos/{photo_id}")
def delete_photo(card_id: str, photo_id: str):
    db = get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database disabled")
    # Find the card
    card = db.sound_cards.find_one({"_id": ObjectId(card_id)})
    if card is None:
        raise HTTPException(status_code=404, detail="Card not found")
    # Build the photo URL we expect to remove
    photo_url = f"/api/photo/{photo_id}"
    # Check if the photo exists in the card
    if photo_url not in card.get("photo_urls", []):
        raise HTTPException(status_code=404, detail="Photo not found in card")
    # Delete the GridFS file
    fs = gridfs.GridFS(db)
    try:
        fs.delete(ObjectId(photo_id))
    except Exception as e:
        logger.error(f"Failed to delete GridFS file {photo_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete photo file")
    # Remove the photo URL from the card
    db.sound_cards.update_one(
        {"_id": ObjectId(card_id)},
        {"$pull": {"photo_urls": photo_url}}
    )
    # Return updated card
    updated = db.sound_cards.find_one({"_id": ObjectId(card_id)})
    updated["id"] = str(updated["_id"])
    del updated["_id"]
    return updated

@app.delete("/api/cards/{card_id}/photos")
def bulk_delete_photos(card_id: str, payload: BulkPhotoDelete):
    db = get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database disabled")
    card = db.sound_cards.find_one({"_id": ObjectId(card_id)})
    if card is None:
        raise HTTPException(status_code=404, detail="Card not found")
    fs = gridfs.GridFS(db)
    for photo_id in payload.photo_ids:
        photo_url = f"/api/photo/{photo_id}"
        if photo_url not in card.get("photo_urls", []):
            logger.warning(f"Photo {photo_id} not found in card {card_id}")
            continue
        # Delete GridFS file
        try:
            fs.delete(ObjectId(photo_id))
        except Exception as e:
            logger.error(f"Failed to delete GridFS file {photo_id}: {e}")
            continue
        # Remove from photo_urls
        db.sound_cards.update_one(
            {"_id": ObjectId(card_id)},
            {"$pull": {"photo_urls": photo_url}}
        )
    updated = db.sound_cards.find_one({"_id": ObjectId(card_id)})
    updated["id"] = str(updated["_id"])
    del updated["_id"]
    return updated
                        
@app.post("/api/admin/verify")
async def verify_admin(payload: PinVerification):
    expected_pin = os.getenv("ADMIN_PIN", "1234")
    if payload.pin != expected_pin:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect PIN"
        )
    return {"success": True, "message": "Admin access granted"}

@app.get("/api/audio/{file_id}")
def get_audio_file(file_id: str):
    db = get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database disabled")
    fs = gridfs.GridFS(db)
    try:
        grid_out = fs.get(ObjectId(file_id))
        return StreamingResponse(
            io.BytesIO(grid_out.read()),
            media_type=grid_out.content_type or "audio/mpeg"
        )
    except Exception:
        raise HTTPException(status_code=404, detail="Audio file not found")

@app.get("/api/photo/{file_id}")
def get_photo_file(file_id: str):
    db = get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database disabled")
    fs = gridfs.GridFS(db)
    try:
        grid_out = fs.get(ObjectId(file_id))
        return StreamingResponse(
            io.BytesIO(grid_out.read()),
            media_type=grid_out.content_type or "image/jpeg"
        )
    except Exception:
        raise HTTPException(status_code=404, detail="Photo file not found")

@app.post("/api/beautify")
async def beautify_drawing(payload: BeautifyRequest):
    try:
        # Strip data header if present
        raw_b64 = payload.image_base64
        if "," in raw_b64:
            raw_b64 = raw_b64.split(",")[1]
            
        image_bytes = base64.b64decode(raw_b64)
        
        # Call model service
        result_url = genai_service.beautify_sketch(image_bytes)
        
        return {"resultUrl": result_url}

    except Exception as e:
        logger.error(f"Failed to beautify drawing: {e}")
        raise HTTPException(status_code=500, detail="Failed to beautify drawing")