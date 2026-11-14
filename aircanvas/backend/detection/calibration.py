"""HSV calibration helpers. OpenCV hue values wrap around 0..179."""
import cv2
import numpy as np


def hue_mask(hsv: np.ndarray, hue: int, tolerance: int, min_saturation: int = 100,
             min_value: int = 65) -> np.ndarray:
    # Circular distance keeps red markers working across the hue boundary.
    channel = hsv[:, :, 0].astype(np.int16)
    delta = np.abs(channel - hue)
    distance = np.minimum(delta, 180 - delta)
    return ((distance <= tolerance) & (hsv[:, :, 1] >= min_saturation)
            & (hsv[:, :, 2] >= min_value)).astype(np.uint8) * 255


def sample_hue(image: np.ndarray, x: int, y: int) -> int:
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    y = max(0, min(image.shape[0] - 1, y))
    x = max(0, min(image.shape[1] - 1, x))
    return int(hsv[y, x, 0])
