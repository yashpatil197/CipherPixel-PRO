# 🛡️ CipherPixel PRO(BitMask)
### Client-Side Image Steganography & Encryption Tool

![Project Status](https://img.shields.io/badge/Status-Active-brightgreen)
![Tech Stack](https://img.shields.io/badge/Tech-HTML5_|_CSS3_|_VanillaJS-blue)
![Logic](https://img.shields.io/badge/Logic-Bitwise_Operations-orange)

**CipherPixel PRO** is a secure "Digital Courier" application that allows users to hide confidential text messages or sensitive files (PDFs, Zips, Docs) inside ordinary PNG images.

Unlike typical web apps that rely on libraries, this project implements **Least Significant Bit (LSB)** manipulation and **XOR Encryption** from scratch using raw binary data (`Uint8Array`), demonstrating low-level engineering logic in a browser environment.

---

## 🚀 Features

### 1. Dual-Mode Steganography
- **Text Mode:** Hide secret messages.
- **File Mode:** Embed entire files (PDF, ZIP, EXE) inside images.

### 2. Custom Security Protocol
- **XOR Encryption:** Implements a symmetric XOR cipher (`Byte ^ Key`) to scramble payload data before embedding.
- **Password Strength Meter:** Real-time entropy calculation ($L \times \log_2 N$) to estimate brute-force crack time.

### 3. Data Integrity & Safety
- **Magic Signature:** Injects a 4-byte signature (`BITS`) into the header to prevent reading garbage data from non-steganographic images.
- **Smart Capacity Engine:** Calculates the exact bit-capacity of the cover image and prevents buffer overflows.
- **Binary Header Injection:** Automatically embeds filename and file type so the decoder knows exactly what to reconstruct.

### 4. Zero-Server Privacy
- All processing happens in the browser's memory. No data is ever uploaded to a server.

---

## 🧠 The Engineering Behind It

This project focuses on **Data Structures and Algorithms (DSA)** applied to web development.

### 1. LSB Algorithm (The "C" Logic)
The core algorithm manipulates the binary data of the image pixels. We utilize bitwise operators to modify the **Least Significant Bit** of the Red, Green, and Blue channels.

```javascript
// Logic to embed a bit:
// 1. Clear the last bit using AND (& 254)
// 2. Set the new bit using OR (| bit)
pixels[i] = (pixels[i] & 254) | secretBit;
