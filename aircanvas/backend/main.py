"""Run with: uvicorn aircanvas.backend.main:app --host 127.0.0.1 --port 8000"""
import cv2
import numpy as np
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.concurrency import run_in_threadpool
from .detection.color_tracker import ColorTracker

app = FastAPI(title='AirCanvas Local Marker Tracker', version='1.0.0')
ORIGINS = {'http://localhost:5173', 'http://127.0.0.1:5173',
           'http://localhost:4173', 'http://127.0.0.1:4173'}
app.add_middleware(CORSMiddleware, allow_origins=sorted(ORIGINS),
                   allow_methods=['GET', 'POST'], allow_headers=['Content-Type'])
detector = ColorTracker()


@app.get('/health')
def health():
    return {'status': 'ok', 'processing': 'local', 'detector': 'hsv-marker'}


@app.post('/track')
async def track(request: Request, hue: int = Query(65, ge=0, le=179),
                tolerance: int = Query(15, ge=3, le=45)):
    origin = request.headers.get('origin')
    if origin and origin not in ORIGINS:
        raise HTTPException(403, 'Only the local AirCanvas frontend may send frames.')
    if request.headers.get('content-type', '').split(';')[0] != 'image/jpeg':
        raise HTTPException(415, 'Send a JPEG frame.')
    body = bytearray()
    async for chunk in request.stream():
        body.extend(chunk)
        if len(body) > 2_000_000:
            raise HTTPException(413, 'Frame must be smaller than 2 MB.')
    if not body:
        raise HTTPException(400, 'Empty frame.')

    def detect():
        image = cv2.imdecode(np.frombuffer(body, np.uint8), cv2.IMREAD_COLOR)
        if image is None:
            raise HTTPException(400, 'Could not decode the JPEG frame.')
        if image.shape[0] * image.shape[1] > 2_000_000:
            raise HTTPException(413, 'Frame dimensions are too large.')
        return detector.detect(image, hue, tolerance)

    # No frame queues, files, recordings, or external requests.
    return await run_in_threadpool(detect)
