// --- STATE VARIABLES ---
let mode = 'text'; // 'text' or 'file'
let coverImageLoaded = false;
let secretFileLoaded = false;
let secretFileBuffer = null;
let secretFileName = "";

// --- INITIALIZATION ---
// Force correct state when page loads
window.onload = function() {
    document.getElementById('landing-page').style.display = 'flex';
    document.getElementById('app-container').style.display = 'none';
    document.getElementById('navbar').style.display = 'none';
    
    // Default tab state
    switchTab('text');
}

// --- NAVIGATION LOGIC ---

function showApp(action) {
    // 1. Hide Landing Page
    document.getElementById('landing-page').style.display = 'none';
    
    // 2. Show App Container & Navbar
    document.getElementById('app-container').style.display = 'flex';
    document.getElementById('navbar').style.display = 'flex';

    // 3. Reset Cards (Hide Both)
    document.getElementById('card-encode').style.display = 'none';
    document.getElementById('card-decode').style.display = 'none';

    // 4. Show Selected Card
    if(action === 'encode') {
        document.getElementById('card-encode').style.display = 'flex';
    } else {
        document.getElementById('card-decode').style.display = 'flex';
    }
}

function goHome() {
    // Simple reload to reset everything
    location.reload();
}

function switchTab(selectedMode) {
    mode = selectedMode;
    
    // 1. Update Buttons Visuals
    const textBtn = document.querySelectorAll('.tab-btn')[0];
    const fileBtn = document.querySelectorAll('.tab-btn')[1];

    if(mode === 'text') {
        textBtn.classList.add('active');
        fileBtn.classList.remove('active');
        
        // 2. Force Show/Hide Inputs
        document.getElementById('input-text-section').style.display = 'block';
        document.getElementById('input-file-section').style.display = 'none';
    } else {
        fileBtn.classList.add('active');
        textBtn.classList.remove('active');

        // 2. Force Show/Hide Inputs
        document.getElementById('input-text-section').style.display = 'none';
        document.getElementById('input-file-section').style.display = 'block';
    }
    
    checkCapacity();
}


// --- UPLOAD HANDLERS ---

document.getElementById('upload-cover').addEventListener('change', (e) => handleImageUpload(e.target.files[0], 'preview-cover', true));
document.getElementById('upload-decode').addEventListener('change', (e) => handleImageUpload(e.target.files[0], 'preview-decode', false));
document.getElementById('pass-encode').addEventListener('input', function(e) {
    updateStrengthMeter(e.target.value);
});
document.getElementById('upload-secret').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if(!file) return;
    secretFileName = file.name;
    const reader = new FileReader();
    reader.onload = function(evt) {
        secretFileBuffer = evt.target.result;
        secretFileLoaded = true;
        document.getElementById('file-info').innerText = `Selected: ${file.name} (${formatBytes(file.size)})`;
        checkCapacity();
    };
    reader.readAsArrayBuffer(file);
});

// Text Area Capacity Check
document.getElementById('secret-text').addEventListener('input', checkCapacity);


function handleImageUpload(file, imgId, isEncode) {
    if(!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = document.getElementById(imgId);
        img.src = e.target.result;
        img.style.display = 'block';
        img.onload = function() {
            if(isEncode) {
                coverImageLoaded = true;
                checkCapacity();
            } else {
                document.getElementById('decode-btn').disabled = false;
            }
        }
    }
    reader.readAsDataURL(file);
}

function checkCapacity() {
    if (!coverImageLoaded) return;
    
    const img = document.getElementById('preview-cover');
    const totalBitsAvailable = (img.naturalWidth * img.naturalHeight) * 3;
    
    let requiredBits = 0;

    if (mode === 'text') {
        const text = document.getElementById('secret-text').value;
        if(text.length === 0) return;
        requiredBits = (text.length * 8) + 800; 
    } else {
        if (!secretFileLoaded) return;
        requiredBits = (secretFileBuffer.byteLength * 8) + 800;
    }

    const percent = (requiredBits / totalBitsAvailable) * 100;
    const fill = document.getElementById('capacity-fill');
    const text = document.getElementById('capacity-text');
    const btn = document.getElementById('encode-btn');

    fill.style.width = percent + "%";
    text.innerText = `${percent.toFixed(2)}% Capacity Used`;

    if (percent > 100) {
        fill.style.background = "red";
        btn.disabled = true;
    } else {
        fill.style.background = "#10b981";
        btn.disabled = false;
    }
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}


// --- CORE ENGINE (Unified) ---

document.getElementById('encode-btn').addEventListener('click', encodeProcess);
document.getElementById('decode-btn').addEventListener('click', decodeProcess);

function encodeProcess() {
    const password = document.getElementById('pass-encode').value;
    const img = document.getElementById('preview-cover');
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    ctx.drawImage(img, 0, 0);
    
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imgData.data;

    let payloadBuffer;
    let typeHeader = ""; 
    let nameHeader = ""; 

    if (mode === 'text') {
        const text = document.getElementById('secret-text').value;
        const encoder = new TextEncoder();
        payloadBuffer = encoder.encode(text);
        typeHeader = "txt";
        nameHeader = "msg"; 
    } else {
        payloadBuffer = new Uint8Array(secretFileBuffer);
        typeHeader = "file";
        nameHeader = secretFileName;
    }

    // --- CHANGE IS HERE: ADDED "BITS|" ---
    const header = `BITS|${typeHeader}|${nameHeader}|${payloadBuffer.length}|`;
    let binaryStream = "";
    
    for (let i = 0; i < header.length; i++) {
        binaryStream += header.charCodeAt(i).toString(2).padStart(8, '0');
    }

    for (let i = 0; i < payloadBuffer.length; i++) {
        let byte = payloadBuffer[i];
        if(password) {
            byte = byte ^ password.charCodeAt(i % password.length);
        }
        binaryStream += byte.toString(2).padStart(8, '0');
    }

    let dataIndex = 0;
    for (let i = 0; i < binaryStream.length; i++) {
        if ((dataIndex + 1) % 4 === 0) dataIndex++; 
        let bit = binaryStream[i];
        pixels[dataIndex] = (pixels[dataIndex] & 254) | parseInt(bit);
        dataIndex++;
    }

    ctx.putImageData(imgData, 0, 0);
    const link = document.createElement('a');
    link.download = 'stegavault_secure.png';
    link.href = canvas.toDataURL("image/png");
    link.click();
}

function decodeProcess() {
    const password = document.getElementById('pass-decode').value;
    const img = document.getElementById('preview-decode');
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    ctx.drawImage(img, 0, 0);

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imgData.data;

    let binaryStream = "";
    let extractedChars = "";
    let headerParts = [];
    let payloadLen = 0;
    let type = "";
    let fileName = "";
    let metadataRead = false;
    let pixelIdx = 0;

    // --- CHANGE IS HERE: HEADER PARSING LOGIC ---
    while (!metadataRead && pixelIdx < pixels.length) {
        if ((pixelIdx + 1) % 4 === 0) pixelIdx++;
        binaryStream += (pixels[pixelIdx] & 1).toString();
        pixelIdx++;

        if (binaryStream.length === 8) {
            let char = String.fromCharCode(parseInt(binaryStream, 2));
            extractedChars += char;
            binaryStream = "";

            if (char === '|') {
                headerParts.push(extractedChars.slice(0, -1));
                extractedChars = "";

                // CHECK 1: Is this a valid image?
                if (headerParts.length === 1 && headerParts[0] !== "BITS") {
                    alert("ERROR: No hidden data found in this image!");
                    return; 
                }

                // CHECK 2: Do we have all 4 parts? (BITS | type | name | size)
                if (headerParts.length === 4) {
                    type = headerParts[1]; 
                    fileName = headerParts[2];
                    payloadLen = parseInt(headerParts[3]);
                    metadataRead = true;
                }
            }
        }
    }

    const resultBytes = new Uint8Array(payloadLen);
    let currentByte = 0;
    binaryStream = ""; 

    while (currentByte < payloadLen && pixelIdx < pixels.length) {
        if ((pixelIdx + 1) % 4 === 0) pixelIdx++;
        binaryStream += (pixels[pixelIdx] & 1).toString();
        pixelIdx++;

        if (binaryStream.length === 8) {
            let byteVal = parseInt(binaryStream, 2);
            if(password) byteVal = byteVal ^ password.charCodeAt(currentByte % password.length);
            resultBytes[currentByte] = byteVal;
            currentByte++;
            binaryStream = "";
        }
    }

    document.getElementById('result-area').style.display = 'block';
    const textResult = document.getElementById('text-result');
    const fileResult = document.getElementById('file-result');

    textResult.style.display = 'none';
    fileResult.style.display = 'none';

    if (type === 'txt') {
        const decoder = new TextDecoder();
        const decodedText = decoder.decode(resultBytes);
        textResult.innerText = decodedText;
        textResult.style.display = 'block';
    } else {
        document.getElementById('found-filename').innerText = fileName;
        fileResult.style.display = 'block';
        
        document.getElementById('download-secret-btn').onclick = function() {
            const blob = new Blob([resultBytes], {type: "application/octet-stream"});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            a.click();
        };
    }
}

// --- SECURITY METRICS ---

function updateStrengthMeter(password) {
    const meter = document.getElementById('strength-meter');
    const fill = document.getElementById('strength-fill');
    const timeText = document.getElementById('time-text');

    if (password.length === 0) {
        meter.style.display = 'none';
        return;
    }

    meter.style.display = 'block';

    // 1. Calculate Pool Size
    let poolSize = 0;
    if (/[a-z]/.test(password)) poolSize += 26;
    if (/[A-Z]/.test(password)) poolSize += 26;
    if (/[0-9]/.test(password)) poolSize += 10;
    if (/[^a-zA-Z0-9]/.test(password)) poolSize += 32; // Special chars

    // 2. Calculate Entropy (Bits) = Length * log2(PoolSize)
    const entropy = password.length * Math.log2(poolSize || 1);

    // 3. Estimate Crack Time (Assuming 1 Trillion guesses/sec for a supercomputer)
    const guessesPerSec = 1_000_000_000_000; 
    const totalGuesses = Math.pow(2, entropy);
    const seconds = totalGuesses / guessesPerSec;

    // 4. Visual Updates
    let color = 'red';
    let width = '10%';
    
    if (entropy > 50) { color = 'orange'; width = '40%'; }
    if (entropy > 70) { color = '#fbbf24'; width = '70%'; } // Yellow
    if (entropy > 90) { color = '#10b981'; width = '100%'; } // Green

    fill.style.width = width;
    fill.style.background = color;
    timeText.innerText = formatTime(seconds);
    timeText.style.color = color;
}

function formatTime(seconds) {
    if (seconds < 1) return "Instantly";
    if (seconds < 60) return "Few seconds";
    if (seconds < 3600) return Math.round(seconds / 60) + " minutes";
    if (seconds < 86400) return Math.round(seconds / 3600) + " hours";
    if (seconds < 31536000) return Math.round(seconds / 86400) + " days";
    if (seconds < 3153600000) return Math.round(seconds / 31536000) + " years";
    return "Centuries";
}
