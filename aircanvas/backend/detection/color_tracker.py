"""Conservative colored-marker centroid detection; no contact-depth inference."""
from typing import Protocol
import cv2
import numpy as np
from .calibration import hue_mask


class PenTipDetector(Protocol):
    """Future custom keypoint models can implement this same detector interface."""
    def detect(self, image: np.ndarray, hue: int, tolerance: int) -> dict: ...


class ColorTracker:
    def detect(self, image: np.ndarray, hue: int, tolerance: int) -> dict:
        height, width = image.shape[:2]
        hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
        mask = hue_mask(hsv, hue, tolerance)
        kernel = np.ones((3, 3), np.uint8)
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        candidates = []
        for contour in contours:
            area = cv2.contourArea(contour)
            if not 12 <= area <= width * height * 0.025:
                continue
            x, y, w, h = cv2.boundingRect(contour)
            if max(w, h) / max(1, min(w, h)) > 5:
                continue
            moments = cv2.moments(contour)
            if moments['m00'] == 0:
                continue
            solidity = area / max(1, cv2.contourArea(cv2.convexHull(contour)))
            if solidity < 0.55:
                continue
            candidates.append((area, moments, solidity))
        if not candidates:
            return {'found': False, 'confidence': 0.0}
        candidates.sort(key=lambda c: c[0], reverse=True)
        # Two similarly sized blobs are ambiguous; never jump between them.
        if len(candidates) > 1 and candidates[1][0] > candidates[0][0] * 0.55:
            return {'found': False, 'confidence': 0.0, 'reason': 'ambiguous'}
        area, moments, solidity = candidates[0]
        return {'found': True, 'x': moments['m10'] / moments['m00'] / width,
                'y': moments['m01'] / moments['m00'] / height,
                'confidence': float(min(1, solidity * min(1, area / 30)))}
