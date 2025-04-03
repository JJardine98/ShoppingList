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

// Barcode scanning functions
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
                video.play();
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
        
        // Function to handle results
        const handleResult = (result) => {
            if (!scannerActive) return;
            
            console.log('Barcode detected:', result.getText());
            scannerActive = false;
            
            // Stop camera
            stream.getTracks().forEach(track => track.stop());
            
            // Remove preview
            previewContainer.remove();
            
            // Look up product
            lookupProduct(result.getText());
        };
        
        // Start scanning
        codeReader.decodeFromVideoDevice(undefined, 'scanner-video', handleResult)
            .catch(error => {
                console.error('Error starting barcode scanner:', error);
                alert(`Error starting scanner: ${error.message}`);
                previewContainer.remove();
            });
        
        // Handle cancel button
        previewContainer.querySelector('.cancel-btn').onclick = () => {
            scannerActive = false;
            codeReader.reset();
            stream.getTracks().forEach(track => track.stop());
            previewContainer.remove();
        };
        
    } catch (error) {
        console.error('Error in barcode scanning:', error);
        alert(`Error: ${error.message}\n\nPlease ensure:\n1. You have granted camera permissions\n2. You are using a supported browser\n3. Your device has a working camera`);
    }
}

async function lookupProduct(barcode) {
    try {
        const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
        const data = await response.json();
        
        if (data.status === 1 && data.product) {
            const product = data.product;
            const itemName = product.product_name || product.generic_name || 'Unknown Product';
            
            // Add to shopping list
            shoppingList.push({ 
                text: itemName,
                checked: false
            });
            saveList();
            renderList();
        } else {
            alert('Product not found. Please try again or add manually.');
        }
    } catch (error) {
        console.error('Error looking up product:', error);
        alert('Error looking up product. Please try again or add manually.');
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