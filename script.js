// Initialize shopping list from localStorage or empty array
let shoppingList = JSON.parse(localStorage.getItem('shoppingList')) || [];

// Function to save list to localStorage
function saveList() {
    localStorage.setItem('shoppingList', JSON.stringify(shoppingList));
}

// Function to render the shopping list
function renderList() {
    const listElement = document.getElementById('shoppingList');
    listElement.innerHTML = '';
    
    shoppingList.forEach((item, index) => {
        const li = document.createElement('li');
        li.innerHTML = `
            <div class="item-content" onclick="toggleItem(${index})">
                <input type="checkbox" id="item${index}" ${item.checked ? 'checked' : ''} onchange="event.stopPropagation()">
                <span class="${item.checked ? 'checked' : ''}">${item.text}</span>
            </div>
            <div class="item-actions">
                <button onclick="editItem(${index})" class="edit-btn">Edit</button>
                <button onclick="removeItem(${index})">Remove</button>
            </div>
        `;
        listElement.appendChild(li);
    });
}

// Function to add a new item
function addItem() {
    const input = document.getElementById('itemInput');
    const item = input.value.trim();
    
    if (item) {
        shoppingList.push({ text: item, checked: false });
        saveList();
        renderList();
        input.value = '';
    }
}

// Function to toggle item checked state
function toggleItem(index) {
    shoppingList[index].checked = !shoppingList[index].checked;
    saveList();
    renderList();
}

// Function to remove an item
function removeItem(index) {
    shoppingList.splice(index, 1);
    saveList();
    renderList();
}

// Function to clear all items
function clearList() {
    if (confirm('Are you sure you want to clear all items?')) {
        shoppingList = [];
        saveList();
        renderList();
    }
}

// Function to share the list
function shareList() {
    const text = shoppingList.map(item => `${item.checked ? '✓' : '○'} ${item.text}`).join('\n');
    if (navigator.share) {
        navigator.share({
            title: 'My Shopping List',
            text: text
        }).catch(console.error);
    } else {
        // Fallback for browsers that don't support Web Share API
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        alert('Shopping list copied to clipboard!');
    }
}

// Add scanning styles to the document
function addScanningStyles() {
    if (!document.getElementById('scanning-styles')) {
        const style = document.createElement('style');
        style.id = 'scanning-styles';
        style.textContent = `
            .scanning-overlay {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 70%;
                height: 40%;
                border: 3px solid #00b894;
                border-radius: 8px;
                box-shadow: 0 0 0 2000px rgba(0, 0, 0, 0.5);
                pointer-events: none;
            }
            
            .scanning-message {
                color: white;
                font-size: 1.2rem;
                margin-bottom: 1rem;
                text-align: center;
                padding: 0 1rem;
                z-index: 10;
            }
            
            .scanning-progress {
                width: 80%;
                max-width: 300px;
                height: 4px;
                background-color: rgba(255, 255, 255, 0.2);
                border-radius: 2px;
                margin-top: 1rem;
                overflow: hidden;
                position: relative;
            }
            
            .scanning-progress-bar {
                height: 100%;
                width: 0%;
                background-color: #00b894;
                border-radius: 2px;
                transition: width 0.2s;
            }
        `;
        document.head.appendChild(style);
    }
}

// Improved barcode scanning function
async function startBarcodeScan() {
    try {
        // Check if BarcodeDetector is supported
        if (!('BarcodeDetector' in window)) {
            throw new Error('Barcode scanning is not supported in your browser. Please use Chrome or Edge.');
        }

        // Create preview container
        const previewContainer = document.createElement('div');
        previewContainer.className = 'camera-preview';
        previewContainer.innerHTML = `
            <div class="scanning-message">Point camera at barcode</div>
            <div class="focus-box"></div>
            <video id="scanner-video" autoplay playsinline></video>
            <button class="cancel-btn">Cancel Scan</button>
        `;
        document.body.appendChild(previewContainer);

        // Get video element
        const video = document.getElementById('scanner-video');

        // Request camera access with higher quality settings
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                facingMode: 'environment',
                width: { ideal: 1920, min: 1280 },
                height: { ideal: 1080, min: 720 },
                frameRate: { ideal: 30, min: 24 },
                focusMode: 'continuous',
                advanced: [
                    { focusMode: 'continuous' },
                    { whiteBalanceMode: 'continuous' },
                    { exposureMode: 'continuous' }
                ]
            } 
        });

        // Set video source
        video.srcObject = stream;

        // Wait for video to be ready
        await new Promise((resolve) => {
            video.onloadedmetadata = () => {
                video.play();
                resolve();
            };
        });

        // Initialize barcode detector with all supported formats
        const barcodeDetector = new BarcodeDetector({
            formats: [
                'ean_13', 'ean_8', 'upc_a', 'upc_e',
                'code_128', 'code_39', 'code_93', 'itf',
                'codabar', 'code_128', 'code_39', 'code_93',
                'itf', 'qr_code', 'data_matrix', 'aztec'
            ]
        });

        let isScanning = true;
        let lastDetectedCode = null;
        let detectionCount = 0;

        // Start scanning loop
        async function scan() {
            if (!isScanning) return;

            try {
                const barcodes = await barcodeDetector.detect(video);
                
                if (barcodes.length > 0) {
                    const barcode = barcodes[0];
                    console.log('Barcode details:', {
                        rawValue: barcode.rawValue,
                        format: barcode.format,
                        cornerPoints: barcode.cornerPoints
                    });

                    // Only process if we've seen this code multiple times to reduce false positives
                    if (barcode.rawValue === lastDetectedCode) {
                        detectionCount++;
                        if (detectionCount >= 3) {
                            console.log('Confirmed barcode:', barcode.rawValue);
                            isScanning = false;
                            stream.getTracks().forEach(track => track.stop());
                            previewContainer.remove();
                            
                            try {
                                await lookupProduct(barcode.rawValue);
                            } catch (error) {
                                console.error('Error looking up product:', error);
                                alert('Product not found. Adding barcode instead.');
                                addItem(barcode.rawValue);
                            }
                        }
                    } else {
                        lastDetectedCode = barcode.rawValue;
                        detectionCount = 1;
                    }
                } else {
                    detectionCount = 0;
                }

                // Continue scanning
                requestAnimationFrame(scan);
            } catch (error) {
                console.error('Scanning error:', error);
                requestAnimationFrame(scan);
            }
        }

        // Start scanning
        scan();

        // Handle cancel button
        previewContainer.querySelector('.cancel-btn').onclick = () => {
            isScanning = false;
            stream.getTracks().forEach(track => track.stop());
            previewContainer.remove();
        };

    } catch (error) {
        console.error('Error accessing camera:', error);
        alert('Error: ' + error.message);
    }
}

// Product lookup function
async function lookupProduct(barcode) {
    try {
        // Try each API in sequence until we find a match
        const apis = [
            // Open Food Facts (food items)
            async () => {
                if (!API_CONFIG.OPEN_FOOD_FACTS.enabled) return null;
                const response = await fetch(`${API_CONFIG.OPEN_FOOD_FACTS.url}${barcode}.json`);
                const data = await response.json();
                if (data.status === 1 && data.product) {
                    return data.product.product_name || data.product.generic_name;
                }
                return null;
            },
            // Barcodelookup.com (general items)
            async () => {
                if (!API_CONFIG.BARCODE_LOOKUP.enabled) return null;
                const response = await fetch(`${API_CONFIG.BARCODE_LOOKUP.url}?barcode=${barcode}&formatted=y&key=${API_CONFIG.BARCODE_LOOKUP.key}`);
                const data = await response.json();
                if (data.products && data.products.length > 0) {
                    return data.products[0].title || data.products[0].description;
                }
                return null;
            },
            // UPC Item DB (free trial)
            async () => {
                if (!API_CONFIG.UPC_ITEM_DB.enabled) return null;
                const response = await fetch(`${API_CONFIG.UPC_ITEM_DB.url}?upc=${barcode}`);
                const data = await response.json();
                if (data.items && data.items.length > 0) {
                    return data.items[0].title || data.items[0].description;
                }
                return null;
            },
            // Product Open Data
            async () => {
                if (!API_CONFIG.PRODUCT_OPEN_DATA.enabled) return null;
                const response = await fetch(`${API_CONFIG.PRODUCT_OPEN_DATA.url}${barcode}`);
                const data = await response.json();
                if (data.name) {
                    return data.name;
                }
                return null;
            },
            // UPC Lookup (household items)
            async () => {
                if (!API_CONFIG.UPC_LOOKUP.enabled) return null;
                const response = await fetch(`${API_CONFIG.UPC_LOOKUP.url}${barcode}`);
                const data = await response.json();
                if (data.product && data.product.name) {
                    return data.product.name;
                }
                return null;
            },
            // Barcode Spider (personal care items)
            async () => {
                if (!API_CONFIG.BARCODE_SPIDER.enabled) return null;
                const response = await fetch(`${API_CONFIG.BARCODE_SPIDER.url}?upc=${barcode}&token=${API_CONFIG.BARCODE_SPIDER.key}`);
                const data = await response.json();
                if (data.item_attributes && data.item_attributes.title) {
                    return data.item_attributes.title;
                }
                return null;
            },
            // UPC Database (if key is available)
            async () => {
                if (!API_CONFIG.UPC_DATABASE.enabled) return null;
                const response = await fetch(`${API_CONFIG.UPC_DATABASE.url}${barcode}?apikey=${API_CONFIG.UPC_DATABASE.key}`);
                const data = await response.json();
                if (data.success && data.title) {
                    return data.title;
                }
                return null;
            }
        ];

        // Try each API in sequence
        for (const api of apis) {
            try {
                const result = await api();
                if (result) {
                    // Found a match, add to shopping list
                    shoppingList.push({ 
                        text: result,
                        checked: false
                    });
                    saveList();
                    renderList();
                    return;
                }
            } catch (error) {
                console.error('Error with API:', error);
                // Continue to next API
            }
        }

        // If no API found a match, add the barcode
        shoppingList.push({ 
            text: `Unknown product (${barcode})`,
            checked: false
        });
        saveList();
        renderList();

    } catch (error) {
        console.error('Error looking up product:', error);
        // If there's an error, just add the barcode
        shoppingList.push({ 
            text: `Unknown product (${barcode})`,
            checked: false
        });
        saveList();
        renderList();
    }
}

// Add toast styles
function addToastStyles() {
    if (!document.getElementById('toast-styles')) {
        const style = document.createElement('style');
        style.id = 'toast-styles';
        style.textContent = `
            .toast {
                position: fixed;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%);
                padding: 12px 20px;
                border-radius: 8px;
                color: white;
                font-weight: 500;
                z-index: 1000;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                animation: toast-in 0.3s ease-out;
            }
            
            .toast.loading {
                background-color: #3498db;
            }
            
            .toast.success {
                background-color: #00b894;
            }
            
            .toast.error {
                background-color: #ff6b6b;
            }
            
            .toast.fade-out {
                animation: toast-out 0.5s ease-in forwards;
            }
            
            @keyframes toast-in {
                from { opacity: 0; transform: translate(-50%, 20px); }
                to { opacity: 1; transform: translate(-50%, 0); }
            }
            
            @keyframes toast-out {
                from { opacity: 1; transform: translate(-50%, 0); }
                to { opacity: 0; transform: translate(-50%, 20px); }
            }
        `;
        document.head.appendChild(style);
    }
}

// Add event listener for Enter key
document.getElementById('itemInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        addItem();
    }
});

function editItem(index) {
    const item = shoppingList[index];
    const newText = prompt('Edit item name:', item.text);
    
    if (newText && newText.trim() !== '') {
        item.text = newText.trim();
        saveList();
        renderList();
    }
}

// Initialize
(function init() {
    // Add styles
    addScanningStyles();
    addToastStyles();
    
    // Render initial list
    renderList();
})();