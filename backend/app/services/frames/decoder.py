from dataclasses import dataclass

import cv2
import numpy as np
from cv2.typing import MatLike

SOI = b"\xff\xd8"
EOI = b"\xff\xd9"
# SOF0..SOF15 except DHT (C4), JPG (C8), DAC (CC)
SOF_MARKERS = frozenset(range(0xC0, 0xD0)) - {0xC4, 0xC8, 0xCC}


class FrameError(Exception):
    """A rejected frame; `status` is the HTTP status the API should return."""

    def __init__(self, status: int, message: str) -> None:
        super().__init__(message)
        self.status = status
        self.message = message


@dataclass(frozen=True)
class DecodedFrame:
    image: MatLike
    width: int
    height: int


# Segments with a 2-byte length that may legitimately precede the SOF: DQT, DHT, DRI, COM, DAC, APPn.
SEGMENTS_BEFORE_SOF = frozenset({0xDB, 0xC4, 0xDD, 0xFE, 0xCC, *range(0xE0, 0xF0)})


def jpeg_dimensions(data: bytes) -> tuple[int, int]:
    """Read (width, height) from the JPEG SOF header without decoding pixels.

    The walk is deliberately strict: libjpeg tolerates stray bytes and length-less markers
    (TEM, RSTn, FF00) that a length-skipping parser would misread, which would let a crafted
    file hide its real dimensions. Anything we cannot account for byte by byte is rejected.
    """
    if not data.startswith(SOI):
        raise FrameError(400, "Not a JPEG image")
    pos = 2
    while pos + 2 <= len(data):
        if data[pos] != 0xFF:
            raise FrameError(400, "JPEG header is missing or corrupt")
        marker = data[pos + 1]
        if marker == 0xFF:  # fill byte before a marker
            pos += 1
            continue
        if marker in SOF_MARKERS:
            if pos + 9 > len(data):
                break
            height = int.from_bytes(data[pos + 5 : pos + 7], "big")
            width = int.from_bytes(data[pos + 7 : pos + 9], "big")
            return width, height
        if marker not in SEGMENTS_BEFORE_SOF or pos + 4 > len(data):
            raise FrameError(400, "Unsupported JPEG structure")
        length = int.from_bytes(data[pos + 2 : pos + 4], "big")
        if length < 2:
            raise FrameError(400, "JPEG header is missing or corrupt")
        pos += 2 + length
    raise FrameError(400, "JPEG header is missing or corrupt")


def decode_jpeg(data: bytes, max_side: int) -> DecodedFrame:
    if not data:
        raise FrameError(400, "Empty frame")
    width, height = jpeg_dimensions(data)
    if width == 0 or height == 0:
        raise FrameError(400, "JPEG header is missing or corrupt")
    if width > max_side or height > max_side:
        raise FrameError(413, f"Frame dimensions exceed {max_side}px")
    if not data.rstrip(b"\x00").endswith(EOI):
        raise FrameError(400, "JPEG data is truncated")
    image = cv2.imdecode(np.frombuffer(data, dtype=np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise FrameError(400, "Could not decode JPEG")
    return DecodedFrame(image=image, width=int(image.shape[1]), height=int(image.shape[0]))
