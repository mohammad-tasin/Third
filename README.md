# Mobile IC Identifier 🔬

A web application for identifying mobile phone integrated circuits (ICs) by uploading a PCB photo, scanning live with a camera, or entering a chip code manually.

## Features

- **📷 Image Upload** – Upload a photo of a chip marking; OCR extracts the code and matches it against the database
- **🎥 Live Camera Scan** – Use device camera to point at a chip and capture a frame for instant identification
- **🔍 Manual Search** – Type a chip code, part number, or name with fuzzy matching support
- **📚 Browse Database** – Browse 66+ chips organized by category with full technical details

## Supported IC Categories

CPU/SoC · eMMC/UFS · PMIC · Charging IC · RF IC · Audio IC · Wi-Fi/BT · Display Driver · Touch IC · Camera Sensor · IMU/Sensor · NFC IC · USB-C IC · Fingerprint IC · Secure Element · MCU

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Installation

```bash
npm install
```

### Run

```bash
npm start
```

Then open [http://localhost:3000](http://localhost:3000)

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/ocr` | Upload image, run OCR, return chip matches |
| `GET` | `/api/search?q=<query>` | Search chips by code/name |
| `GET` | `/api/chip/:id` | Get a specific chip by ID/code |
| `GET` | `/api/chips?category=<cat>` | List all chips (optionally filtered) |
| `GET` | `/api/categories` | List all IC categories |

## Tech Stack

- **Backend**: Node.js, Express, Tesseract.js (OCR), Sharp (image preprocessing), Fuse.js (fuzzy matching)
- **Frontend**: Vanilla HTML/CSS/JS (no framework required)
- **Security**: Helmet, rate limiting, input validation, memory-only file handling (no disk storage)

## Privacy

Uploaded images are processed in memory only and are **never stored to disk** or logged. They are discarded immediately after OCR processing.

## Disclaimer

This tool is provided for informational and diagnostic purposes for repair technicians and electronics enthusiasts. Chip data accuracy is not guaranteed. Always verify with official datasheets.
