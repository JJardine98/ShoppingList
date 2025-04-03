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
            <button onclick="removeItem(${index})">Remove</button>
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

async function startBarcodeScan() {
    try {
        // Check if camera is available
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('Camera access is not supported in your browser');
        }
        
        // Create preview container
        const previewContainer = document.createElement('div');
        previewContainer.className = 'camera-preview';
        previewContainer.innerHTML = `
            <div class="scanning-message">Point camera at barcode</div>
            <video id="scanner-video" autoplay playsinline></video>
            <button class="cancel-btn">Cancel</button>
        `;
        
        // Add preview to page
        document.body.appendChild(previewContainer);
        
        // Get video element
        const video = document.getElementById('scanner-video');
        
        // Request camera access
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                facingMode: 'environment',
                width: { ideal: 1280 },
                height: { ideal: 720 }
            } 
        });
        
        // Set video source
        video.srcObject = stream;
        
        // Wait for video to be ready
        await new Promise((resolve) => {
            video.onloadedmetadata = () => {
                resolve();
            };
        });
        
        // Make sure ZXing is loaded
        if (typeof ZXing === 'undefined') {
            throw new Error('ZXing library not loaded. Please check your internet connection and refresh the page.');
        }
        
        // Initialize barcode scanner
        const codeReader = new ZXing.BrowserMultiFormatReader();
        let scannerActive = true;
        
        // Function to handle results - add null check
        const handleResult = (result) => {
            if (!scannerActive) return;
            
            // Check if result is null
            if (!result) {
                console.log('No barcode detected');
                return;
            }
            
            console.log('Barcode detected:', result.getText());
            scannerActive = false;
            
            // Stop camera
            stream.getTracks().forEach(track => track.stop());
            
            // Reset code reader
            codeReader.reset();
            
            // Remove preview
            previewContainer.remove();
            
            // Look up product
            lookupProduct(result.getText());
        };
        
        // Cancel function to clean up resources
        const cancelScan = () => {
            scannerActive = false;
            codeReader.reset();
            stream.getTracks().forEach(track => track.stop());
            previewContainer.remove();
        };
        
        // Handle cancel button
        previewContainer.querySelector('.cancel-btn').onclick = cancelScan;
        
        // Start scanning with proper error handling
        try {
            await codeReader.decodeFromVideoDevice(undefined, 'scanner-video', handleResult);
        } catch (scanError) {
            console.error('Error during scanning:', scanError);
            alert(`Error during scanning: ${scanError.message}`);
            cancelScan();
        }
        
    } catch (error) {
        console.error('Error in barcode scanning:', error);
        alert(`Error: ${error.message}\n\nPlease ensure:\n1. You have granted camera permissions\n2. You are using a supported browser\n3. Your device has a working camera`);
    }
}

// Add event listener for Enter key
document.getElementById('itemInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        addItem();
    }
});

// Initial render
renderList();