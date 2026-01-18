// --- DOM ELEMENTS ---
const appContainer = document.getElementById('app-container');
const landingPage = document.getElementById('landing-page');
const navbar = document.getElementById('navbar');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

let coverImage = null; // Stores the loaded image object
let secretFile = null; // Stores the file to hide (if any)
let currentMode = 'text'; // 'text' or 'file'

// --- NAVIGATION ---
function showApp(mode) {
    landingPage.classList.add('hidden');
    appContainer.classList.remove('hidden');
    navbar.classList.remove('hidden');
    
    document.getElementById('card-encode').classList.add('hidden-card');
    document.getElementById('card-decode').classList.add('hidden-card');

    if (mode === 'encode') document.getElementById('card-encode').classList.remove('hidden-card');
    else document.getElementById('card-decode').classList.remove('hidden-card');
}

function goHome() {
    landingPage.classList.remove('hidden');
    appContainer.classList.add('hidden');
    navbar.classList.add('hidden');
    resetAll();
}

function switchTab(tab) {
    currentMode = tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');

    if (tab === 'text') {
        document.getElementById('input-text-section').classList.remove('hidden');
        document.getElementById('input-file-section').classList.add('hidden');
    } else {
        document.getElementById('input-text-section').classList.add('hidden');
        document.getElementById('input-file-section').classList.remove('hidden');
    }
    checkCapacity();
}

function toggleTheme() {
    document.body.classList.toggle('hacker-mode');
}

// --- FILE UPLOADS ---
document.getElementById('upload-cover').addEventListener('change', function(e) {
    handleImageUpload(e.target.files[0], 'preview-cover', true);
});

document.getElementById('upload-decode').addEventListener('change', function(e) {
    handleImageUpload(e.target.files[0], 'preview-decode', false);
});

document.getElementById('upload-secret').addEventListener('change', function(e) {
    if(e.target.files.length > 0) {
        secretFile = e.target.files[0];
        document.getElementById('file-info').innerText = `Selected: ${secretFile.name} (${(secretFile.size/1024).toFixed(1)} KB)`;
        document.getElementById('file-info').classList.remove('hidden');
        checkCapacity();
    }
});

function handleImageUpload(file, previewId, isEncode) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(event) {
        const img = new Image();
        img.onload = function() {
            if (isEncode) {
                coverImage = img;
                checkCapacity();
                document.getElementById('encode-btn').disabled = false;
            } else {
                document.getElementById('decode-btn').disabled = false;
                document.getElementById('btn-steg-vision').classList.remove('hidden');
            }
            document.getElementById(previewId).src = event.target.result;
            document.getElementById(previewId).classList.remove('hidden');
        }
        img.src = event.target.result;
    }
    reader.readAsDataURL(file);
}

// --- CAPACITY CHECKER ---
document.getElementById('secret-text').addEventListener('input', checkCapacity);

function checkCapacity() {
    if (!coverImage) return;

    // Max capacity (using 3 bits per channel per pixel, usually safe is LSB 1-2 bits but let's assume 1 bit per channel RGB = 3 bits per pixel)
    // Safe Estimate: Width * Height * 3 bits / 8 (bytes)
    const maxBytes = (coverImage.width * coverImage.height * 3) / 8;
    
    let usedBytes = 0;
    if (currentMode === 'text') {
        usedBytes = document.getElementById('secret-text').value.length;
    } else if (secretFile) {
        usedBytes = secretFile.size;
    }

    const percentage = Math.min((usedBytes / maxBytes) * 100, 100);
    const fill = document.getElementById('capacity-fill');
    fill.style.width = percentage + '%';
    document.getElementById('capacity-text').innerText = `${percentage.toFixed(2)}% Capacity Used`;
    
    if (percentage > 90) fill.style.backgroundColor = 'red';
    else fill.style.backgroundColor = 'var(--success-color)';
}

// --- ENCODING LOGIC ---
document.getElementById('encode-btn').addEventListener('click', async function() {
    if (!coverImage) return;
    
    const password = document.getElementById('pass-encode').value;
    let dataToHide = '';

    // 1. Prepare Data
    if (currentMode === 'text') {
        const text = document.getElementById('secret-text').value;
        if (!text) return alert("Please enter text.");
        dataToHide = JSON.stringify({ type: 'text', data: text });
    } else {
        if (!secretFile) return alert("Please select a file.");
        const fileData = await readFileAsBase64(secretFile);
        dataToHide = JSON.stringify({ type: 'file', name: secretFile.name, data: fileData });
    }

    // 2. Encrypt (Simple XOR for demo, use AES in production)
    if (password) {
        dataToHide = encryptData(dataToHide, password);
    }
    
    // Prefix with length so we know how much to read back
    const binaryData = stringToBinary(dataToHide);
    
    // 3. Draw to Canvas & Embed
    canvas.width = coverImage.width;
    canvas.height = coverImage.height;
    ctx.drawImage(coverImage, 0, 0);
    
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imgData.data;

    if (binaryData.length > pixels.length * 0.75) { // 3 channels (RGB) used
        return alert("Data is too large for this image!");
    }

    // Embed Length (Fixed 32 bits header)
    const lengthBin = binaryData.length.toString(2).padStart(32, '0');
    let dataIndex = 0;

    // Embed Header first
    for (let i = 0; i < 32; i++) {
        if (lengthBin[i] === '1') pixels[i * 4] |= 1; // Set LSB to 1
        else pixels[i * 4] &= ~1; // Set LSB to 0
    }

    // Embed Body
    for (let i = 0; i < binaryData.length; i++) {
        const pixelIdx = (i + 32) * 4; // Skip alpha channel, skip header pixels
        // Simple sequential embedding (R channel, then G, then B... could be optimized)
        // Here we just use Red channel of subsequent pixels for simplicity
        // Better: Use R, G, B sequentially.
        
        // Let's keep it simple: Use Red channel of every pixel starting from 32
        if (binaryData[dataIndex] === '1') pixels[pixelIdx] |= 1;
        else pixels[pixelIdx] &= ~1;
        dataIndex++;
    }

    ctx.putImageData(imgData, 0, 0);

    // 4. Output Result
    const resultURL = canvas.toDataURL('image/png');
    
    // Setup Comparison Slider
    const compOriginal = document.getElementById('comp-original');
    const compEncoded = document.getElementById('comp-encoded');
    
    compOriginal.src = coverImage.src;
    compEncoded.src = resultURL;
    
    document.getElementById('encode-result').classList.remove('hidden');
    document.getElementById('download-link').href = resultURL;
    
    initComparisonSlider();
});

// --- DECODING LOGIC ---
document.getElementById('decode-btn').addEventListener('click', function() {
    const preview = document.getElementById('preview-decode');
    if (!preview.src) return;

    canvas.width = preview.naturalWidth;
    canvas.height = preview.naturalHeight;
    ctx.drawImage(preview, 0, 0);
    
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imgData.data;

    // 1. Extract Length Header
    let lengthBin = '';
    for (let i = 0; i < 32; i++) {
        lengthBin += (pixels[i * 4] & 1);
    }
    const dataLength = parseInt(lengthBin, 2);

    if (dataLength <= 0 || dataLength > pixels.length) {
        return alert("No hidden data found or image corrupted.");
    }

    // 2. Extract Body
    let binaryData = '';
    for (let i = 0; i < dataLength; i++) {
        const pixelIdx = (i + 32) * 4;
        binaryData += (pixels[pixelIdx] & 1);
    }

    // 3. Convert to Text
    let extractedStr = binaryToString(binaryData);
    
    // 4. Decrypt if needed
    const password = document.getElementById('pass-decode').value;
    if (password) {
        try {
            extractedStr = decryptData(extractedStr, password);
        } catch (e) {
            return alert("Wrong Password or Corrupt Data");
        }
    }

    // 5. Parse JSON
    try {
        const result = JSON.parse(extractedStr);
        document.getElementById('result-area').classList.remove('hidden');

        if (result.type === 'text') {
            document.getElementById('text-result').innerText = result.data;
            document.getElementById('text-result').classList.remove('hidden');
            document.getElementById('file-result').classList.add('hidden');
        } else if (result.type === 'file') {
            document.getElementById('found-filename').innerText = result.name;
            document.getElementById('file-result').classList.remove('hidden');
            document.getElementById('text-result').classList.add('hidden');
            
            // Setup download
            const link = document.getElementById('download-secret-btn');
            link.onclick = () => {
                const a = document.createElement('a');
                a.href = result.data;
                a.download = result.name;
                a.click();
            };
        }
    } catch (e) {
        // If JSON parse fails, it might be raw text or wrong password (if simple XOR used)
        alert("Failed to parse data. Is the password correct?");
    }
});

// --- STEG VISION (BIT-PLANE VISUALIZER) ---
// Shows the LSB layer as visual noise
function toggleStegVision() {
    const preview = document.getElementById('preview-decode');
    if (!preview.src) return;

    canvas.width = preview.naturalWidth;
    canvas.height = preview.naturalHeight;
    ctx.drawImage(preview, 0, 0);
    
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imgData.data;

    // Multiply LSB by 255 to make it visible (0 becomes 0, 1 becomes 255/white)
    for (let i = 0; i < pixels.length; i += 4) {
        const lsb = pixels[i] & 1;
        const val = lsb * 255;
        pixels[i] = val;     // R
        pixels[i+1] = val;   // G
        pixels[i+2] = val;   // B
        // Alpha remains 255
    }

    ctx.putImageData(imgData, 0, 0);
    preview.src = canvas.toDataURL(); // Replace preview with Steg Vision
}


// --- UTILITIES ---
function stringToBinary(str) {
    return str.split('').map(char => {
        return char.charCodeAt(0).toString(2).padStart(8, '0');
    }).join('');
}

function binaryToString(bin) {
    let str = '';
    for (let i = 0; i < bin.length; i += 8) {
        str += String.fromCharCode(parseInt(bin.substr(i, 8), 2));
    }
    return str;
}

function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
}

function resetAll() {
    coverImage = null;
    secretFile = null;
    document.getElementById('upload-cover').value = "";
    document.getElementById('upload-secret').value = "";
    document.getElementById('preview-cover').classList.add('hidden');
    document.getElementById('encode-result').classList.add('hidden');
    document.getElementById('secret-text').value = "";
    document.getElementById('pass-encode').value = "";
    document.getElementById('capacity-fill').style.width = "0%";
}

// Simple XOR Encryption (Replace with AES for Real Security)
function encryptData(data, key) {
    let result = '';
    for(let i = 0; i < data.length; i++) {
        result += String.fromCharCode(data.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return result;
}

const decryptData = encryptData; // XOR is symmetric

// --- COMPARISON SLIDER LOGIC ---
function initComparisonSlider() {
    const slider = document.querySelector(".img-comp-slider");
    const overlay = document.querySelector(".img-comp-overlay");
    const container = document.querySelector(".img-comp-container");
    let clicked = 0;
    let w = container.offsetWidth;

    slider.style.left = (w / 2) + "px";
    overlay.style.width = (w / 2) + "px";

    slider.addEventListener("mousedown", slideReady);
    window.addEventListener("mouseup", slideFinish);
    slider.addEventListener("touchstart", slideReady);
    window.addEventListener("touchend", slideFinish);

    function slideReady(e) {
        e.preventDefault();
        clicked = 1;
        window.addEventListener("mousemove", slideMove);
        window.addEventListener("touchmove", slideMove);
    }

    function slideFinish() {
        clicked = 0;
    }

    function slideMove(e) {
        if (clicked == 0) return false;
        let pos = getCursorPos(e);
        if (pos < 0) pos = 0;
        if (pos > w) pos = w;
        slide(pos);
    }

    function getCursorPos(e) {
        let a = container.getBoundingClientRect();
        let x = (e.changedTouches ? e.changedTouches[0].pageX : e.pageX) - a.left;
        return x - window.pageXOffset;
    }

    function slide(x) {
        overlay.style.width = x + "px";
        slider.style.left = x + "px";
    }
}
