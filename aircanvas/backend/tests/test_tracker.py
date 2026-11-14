import cv2
import numpy as np
from fastapi.testclient import TestClient
from aircanvas.backend.main import app
from aircanvas.backend.detection.color_tracker import ColorTracker
from aircanvas.backend.detection.calibration import hue_mask, sample_hue

client = TestClient(app)


def frame():
    image = np.zeros((360, 640, 3), dtype=np.uint8)
    cv2.circle(image, (320, 180), 8, (0, 255, 0), -1)
    return image


def test_centroid():
    result = ColorTracker().detect(frame(), 60, 10)
    assert result['found'] and result['confidence'] > 0.8
    assert abs(result['x'] - 0.5) < 0.01
    assert abs(result['y'] - 0.5) < 0.01


def test_lost_marker():
    assert not ColorTracker().detect(np.zeros((360, 640, 3), np.uint8), 60, 10)['found']


def test_ambiguous_markers():
    image = frame()
    cv2.circle(image, (100, 100), 8, (0, 255, 0), -1)
    assert not ColorTracker().detect(image, 60, 10)['found']


def test_hue_wrap_and_calibration():
    hsv = np.array([[[179, 255, 200], [1, 255, 200], [80, 255, 200]]], np.uint8)
    assert hue_mask(hsv, 0, 4).tolist() == [[255, 255, 0]]
    assert sample_hue(frame(), 320, 180) == 60


def test_endpoint():
    _, jpeg = cv2.imencode('.jpg', frame())
    response = client.post('/track?hue=60&tolerance=10', content=jpeg.tobytes(),
                           headers={'Content-Type': 'image/jpeg', 'Origin': 'http://localhost:5173'})
    assert response.status_code == 200 and response.json()['found']


def test_invalid_and_remote_frames():
    assert client.post('/track', content=b'invalid', headers={'Content-Type': 'image/jpeg'}).status_code == 400
    assert client.post('/track', content=b'', headers={'Content-Type': 'image/jpeg'}).status_code == 400
    assert client.post('/track', headers={'Origin': 'https://remote.example'}).status_code == 403
    assert client.post('/track', content=b'{}').status_code == 415
    assert client.post('/track?hue=900', content=b'x', headers={'Content-Type': 'image/jpeg'}).status_code == 422
