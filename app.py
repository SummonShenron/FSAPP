from fastapi import FastAPI, HTTPException, Response, UploadFile, File, Form, status, Depends, Request
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

# --- Dynamic CORS Middleware ---
origins = [
    # Custom Domain
    "https://familysoundboard.com",
    "https://www.familysoundboard.com",

    # Vercel Deployments & Previews
    "https://fsapp-git-main-jackharper0517-6113s-projects.vercel.app",
    
    # Local Development
    "http://localhost:3000",
    "http://localhost:5173",
    "http://192.168.1.6:3000",
    "http://192.168.1.6:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    # If you want to dynamically allow all Vercel preview deployments (*.vercel.app), use regex:
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup():
    logger.info("[STARTUP] Testing database connection on app startup...")
    test_connection()

# --- Pydantic Schemas ---
class SoundCardCreate(BaseModel):
    title: str               
    relation: str            
    photo_url: str           
    bg_color: Optional[str] = "#dbeafe" 
    fact: Optional[str] = ""            
    facts: Optional[List[str]] = []     

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
    fact: Optional[str] = ""            
    facts: Optional[List[str]] = []     

class BeautifyRequest(BaseModel):
    image_base64: str

# --- Request Logging Middleware ---
@app.middleware("http")
async def log_incoming_requests(request: Request, call_next):
    logger.info("================== INCOMING REQUEST ==================")
    logger.info(f"Method & Path: {request.method} {request.url.path}")
    logger.info(f"Origin Header: {request.headers.get('origin', 'No Origin Header')}")
    logger.info(f"Auth Header: {'Present' if 'authorization' in request.headers else 'Missing'}")
    response = await call_next(request)
    logger.info(f"Response Status: {response.status_code}")
    logger.info("======================================================")
    return response

@app.get("/api/cards")
def get_sound_cards(current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    logger.info(f"[GET CARDS] Fetching cards for user: {user_id}")
    db = get_db()
    if db is None:
        logger.error("[GET CARDS ERROR] Database disabled or unavailable.")
        return []
        
    cards = list(db.sound_cards.find({"user_id": user_id}).sort("order", 1))
    for card in cards:
        card["id"] = str(card["_id"])
        del card["_id"]
        
        # Fetch and attach associated audio clips for this card
        clips = list(db.audio_clips.find({"card_id": ObjectId(card["id"])}))
        audio_clips = []
        for clip in clips:
            audio_clips.append({
                "id": str(clip["_id"]),
                "card_id": str(clip["card_id"]),
                "label": clip.get("label", "Voice Clip"),
                "is_daily_postcard": clip.get("is_daily_postcard", False),
                "audio_url": f"/api/audio/{str(clip['file_id'])}"
            })
        card["audio_clips"] = audio_clips
        
    logger.info(f"[GET CARDS SUCCESS] Retrieved {len(cards)} cards for user {user_id}")
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
    user_id = current_user["sub"]
    logger.info(f"[CREATE CARD] Request received from user {user_id} | Title: '{title}', Relation: '{relation}', BG: '{bg_color}'")
    
    db = get_db()
    if db is None:
        logger.error("[CREATE CARD ERROR] Database disabled")
        raise HTTPException(status_code=500, detail="Database disabled")

    try:
        final_photo_url = photo_url

        if file and file.filename:
            logger.info(f"[CREATE CARD] Processing uploaded file: {file.filename} ({file.content_type})")
            fs = gridfs.GridFS(db)
            file_id = fs.put(
                await file.read(),
                filename=file.filename,
                content_type=file.content_type
            )
            final_photo_url = f"/api/photo/{str(file_id)}"
            logger.info(f"[CREATE CARD] File successfully stored in GridFS with ID: {file_id}")

        if not final_photo_url:
            logger.warning("[CREATE CARD WARNING] Failed validation: No photo URL or file provided.")
            raise HTTPException(status_code=400, detail="Must provide either a photo URL or upload an image file")

        new_card = {
            "title": title,
            "relation": relation,
            "photo_url": final_photo_url,
            "photo_urls": [final_photo_url],
            "bg_color": bg_color,
            "fact": fact,
            "facts": [fact] if fact else [],
            "user_id": user_id,
            "audio_url": None
        }

        result = db.sound_cards.insert_one(new_card) 
        new_card["id"] = str(result.inserted_id)
        del new_card["_id"]

        logger.info(f"[CREATE CARD SUCCESS] Successfully inserted card ID {new_card['id']} into MongoDB for user {user_id}")
        return new_card

    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"[CREATE CARD EXCEPTION] Failed to create new card: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to create card")

@app.post("/api/cards/reorder")
def reorder_cards(payload: CardOrderUpdate, current_user: dict = Depends(get_current_user)):
    logger.info(f"[REORDER CARDS] Request received from user {current_user['sub']} with {len(payload.card_ids)} card IDs.")
    db = get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database disabled")
        
    for index, card_id in enumerate(payload.card_ids):
        db.sound_cards.update_one(
            {"_id": ObjectId(card_id)},
            {"$set": {"order": index}}
        )
    logger.info("[REORDER CARDS SUCCESS] Cards reordered successfully.")
    return {"status": "success"}

@app.post("/api/cards/{card_id}/audio")
async def upload_audio_clip(
    card_id: str,
    label: str = Form(""),
    is_daily_postcard: bool = Form(False),
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    logger.info(f"[UPLOAD AUDIO] Request for card {card_id}, label: '{label}', filename: {file.filename}")
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
    audio_url = f"/api/audio/{str(file_id)}"
    db.sound_cards.update_one(
        {"_id": ObjectId(card_id)},
        {"$set": {"audio_url": audio_url}}
    )
    logger.info(f"[UPLOAD AUDIO SUCCESS] Audio clip {result.inserted_id} saved and linked to card {card_id}")
    return {
        "id": str(result.inserted_id),
        "card_id": card_id,
        "label": label,
        "is_daily_postcard": is_daily_postcard,
        "audio_url": audio_url,
    }

@app.post("/api/cards/{card_id}/audio-url")
def add_audio_url(
    card_id: str,
    data: dict,
    current_user: dict = Depends(get_current_user)
):
    db = get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database unavailable")
    
    card = db.sound_cards.find_one({"_id": ObjectId(card_id)})
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
        
    url = data.get("url")
    label = data.get("label", "Voice Clip")
    if not url:
        raise HTTPException(status_code=400, detail="URL is required")
        
    clip_doc = {
        "card_id": ObjectId(card_id),
        "label": label,
        "audio_url": url,
        "is_daily_postcard": False
    }
    db.audio_clips.insert_one(clip_doc)
    
    logger.info(f"[ADD AUDIO URL SUCCESS] Added external audio URL to card {card_id}")
    return {"success": True}

@app.get("/api/cards/{card_id}/audio")
def list_audio_clips(card_id: str):
    logger.info(f"[LIST AUDIO] Fetching audio clips for card {card_id}")
    db = get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database disabled")
    clips = list(db.audio_clips.find({"card_id": ObjectId(card_id)}))
    for clip in clips:
        clip["id"] = str(clip["_id"])
        clip["file_id"] = str(clip["file_id"])
        del clip["_id"]
        clip["audio_url"] = f"/api/audio/{clip['file_id']}"
    logger.info(f"[LIST AUDIO SUCCESS] Found {len(clips)} audio clips for card {card_id}")
    return clips

@app.patch("/api/cards/{card_id}")
def update_card(card_id: str, payload: SoundCardUpdate, current_user: dict = Depends(get_current_user)):
    logger.info(f"[UPDATE CARD] Request received for card {card_id} by user {current_user['sub']}")
    logger.info(f"[UPDATE CARD PAYLOAD] {payload.dict(exclude_unset=True)}")
    
    db = get_db()
    if db is None:
        logger.error("[UPDATE CARD ERROR] Database disabled")
        raise HTTPException(status_code=500, detail="Database disabled")
        
    card = db.sound_cards.find_one({"_id": ObjectId(card_id)})
    if card is None:
        logger.warning(f"[UPDATE CARD WARNING] Card {card_id} not found in database.")
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
    if payload.fact is not None:
        update_data["fact"] = payload.fact
    if payload.facts is not None:
        update_data["facts"] = payload.facts
        
    if update_data:
        logger.info(f"[UPDATE CARD] Applying changes to card {card_id}: {list(update_data.keys())}")
        db.sound_cards.update_one(
            {"_id": ObjectId(card_id)},
            {"$set": update_data}
        )
    else:
        logger.info(f"[UPDATE CARD] No fields provided to modify for card {card_id}.")
        
    updated = db.sound_cards.find_one({"_id": ObjectId(card_id)})
    updated["id"] = str(updated["_id"])
    del updated["_id"]
    
    logger.info(f"[UPDATE CARD SUCCESS] Card {card_id} updated successfully.")
    return updated

@app.delete("/api/cards/{card_id}")
def delete_card(card_id: str, current_user: dict = Depends(get_current_user)):
    logger.info(f"[DELETE CARD] Request to delete card {card_id} by user {current_user['sub']}")
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
        logger.info(f"[DELETE CARD SUCCESS] Card {card_id} and associated audio clips deleted.")
        return {"status": "success", "message": "Card and all audio clips deleted"}
    except Exception as e:
        logger.error(f"[DELETE CARD ERROR] Attempt to delete card {card_id} failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete card")

@app.delete("/api/audio/{clip_id}")
def delete_audio_clip(clip_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database unavailable")
    
    # Find and delete the clip document from MongoDB
    result = db.audio_clips.delete_one({"_id": ObjectId(clip_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Audio clip not found")
        
    logger.info(f"[DELETE AUDIO SUCCESS] Deleted clip: {clip_id}")
    return {"success": True}

@app.delete("/api/cards/{card_id}/audio")
def bulk_delete_audio(card_id: str, payload: BulkAudioDelete):
    logger.info(f"[BULK DELETE AUDIO] Request for card {card_id} with {len(payload.audio_ids)} clips.")
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
            logger.warning(f"[BULK DELETE AUDIO WARNING] Audio clip {audio_id} not found for card {card_id}")
            continue
        try:
            fs.delete(clip["file_id"])
        except Exception as e:
            logger.error(f"[BULK DELETE AUDIO ERROR] Failed to delete GridFS file {clip['file_id']}: {e}")
            continue
        db.audio_clips.delete_one({"_id": ObjectId(audio_id)})
        
    updated_clips = list(db.audio_clips.find({"card_id": ObjectId(card_id)}))
    for clip in updated_clips:
        clip["id"] = str(clip["_id"])
        clip["file_id"] = str(clip["file_id"])
        clip["audio_url"] = f"/api/audio/{clip['file_id']}"
        del clip["_id"]
    logger.info(f"[BULK DELETE AUDIO SUCCESS] Completed for card {card_id}")
    return updated_clips
    
@app.post("/api/cards/{card_id}/photos")
async def upload_photo(card_id: str, file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    logger.info(f"[UPLOAD PHOTO] Request for card {card_id}, filename: {file.filename}")
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
            "$set": {"photo_url": photo_url}  
        }
    )
    updated = db.sound_cards.find_one({"_id": ObjectId(card_id)})
    updated["id"] = str(updated["_id"])
    del updated["_id"]
    logger.info(f"[UPLOAD PHOTO SUCCESS] New photo added to card {card_id}")
    return updated

@app.delete("/api/cards/{card_id}/photos/{photo_id}")
def delete_photo(card_id: str, photo_id: str):
    logger.info(f"[DELETE PHOTO] Request to delete photo {photo_id} from card {card_id}")
    db = get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database disabled")
        
    card = db.sound_cards.find_one({"_id": ObjectId(card_id)})
    if card is None:
        raise HTTPException(status_code=404, detail="Card not found")
        
    photo_url = f"/api/photo/{photo_id}"
    if photo_url not in card.get("photo_urls", []):
        raise HTTPException(status_code=404, detail="Photo not found in card")
        
    fs = gridfs.GridFS(db)
    try:
        fs.delete(ObjectId(photo_id))
    except Exception as e:
        logger.error(f"[DELETE PHOTO ERROR] Failed to delete GridFS file {photo_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete photo file")
        
    db.sound_cards.update_one(
        {"_id": ObjectId(card_id)},
        {"$pull": {"photo_urls": photo_url}}
    )
    
    updated = db.sound_cards.find_one({"_id": ObjectId(card_id)})
    updated["id"] = str(updated["_id"])
    del updated["_id"]
    logger.info(f"[DELETE PHOTO SUCCESS] Photo {photo_id} removed from card {card_id}")
    return updated

@app.delete("/api/cards/{card_id}/photos")
def bulk_delete_photos(card_id: str, payload: BulkPhotoDelete):
    logger.info(f"[BULK DELETE PHOTOS] Request for card {card_id} with {len(payload.photo_ids)} IDs.")
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
            logger.warning(f"[BULK DELETE PHOTOS WARNING] Photo {photo_id} not found in card {card_id}")
            continue
        try:
            fs.delete(ObjectId(photo_id))
        except Exception as e:
            logger.error(f"[BULK DELETE PHOTOS ERROR] Failed to delete GridFS file {photo_id}: {e}")
            continue
        db.sound_cards.update_one(
            {"_id": ObjectId(card_id)},
            {"$pull": {"photo_urls": photo_url}}
        )
    updated = db.sound_cards.find_one({"_id": ObjectId(card_id)})
    updated["id"] = str(updated["_id"])
    del updated["_id"]
    logger.info(f"[BULK DELETE PHOTOS SUCCESS] Completed for card {card_id}")
    return updated
                        
@app.post("/api/admin/verify")
async def verify_admin(payload: PinVerification):
    expected_pin = os.getenv("ADMIN_PIN", "1234")
    if payload.pin != expected_pin:
        logger.warning("[ADMIN VERIFY] Failed PIN attempt.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect PIN"
        )
    logger.info("[ADMIN VERIFY SUCCESS] PIN verified successfully.")
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
        image_bytes = grid_out.read()
        
        # 1. Clean up missing or generic octet-stream content types
        content_type = grid_out.content_type
        if not content_type or content_type == "application/octet-stream":
            content_type = "image/jpeg"

        # 2. Use Response (which includes Content-Length) instead of StreamingResponse
        return Response(
            content=image_bytes,
            media_type=content_type,
            headers={
                "Content-Length": str(len(image_bytes)),
                "Cache-Control": "public, max-age=86400" # Optional caching for speed
            }
        )
    except Exception as e:
        logger.error(f"[GET PHOTO ERROR] Failed to fetch photo {file_id}: {e}")
        raise HTTPException(status_code=404, detail="Photo file not found")

@app.post("/api/beautify")
async def beautify_drawing(payload: BeautifyRequest):
    try:
        raw_b64 = payload.image_base64
        if "," in raw_b64:
            raw_b64 = raw_b64.split(",")[1]

        image_bytes = base64.b64decode(raw_b64)
        data_uri = genai_service.beautify_sketch(image_bytes)
        logger.info("[BEAUTIFY SUCCESS] Sketch successfully beautified.")
        return {
            "resultUrl": data_uri,
            "result_url": data_uri,
            "image": data_uri,
            "url": data_uri,
            "beautified_image": data_uri,
        }
    except Exception as e:
        logger.error(f"[BEAUTIFY ERROR] Failed to beautify drawing: {e}")
        raise HTTPException(status_code=500, detail="Failed to beautify drawing")