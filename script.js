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
        // Check if browser supports getUserMedia
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('Camera access is not supported in this browser');
        }

        // Check if Html5QrcodeScanner is loaded
        if (!window.Html5QrcodeScanner) {
            throw new Error('Barcode scanning library not loaded');
        }

        console.log('Requesting camera access...');
        
        // Create preview container
        const previewContainer = document.createElement('div');
        previewContainer.className = 'camera-preview';
        previewContainer.innerHTML = `
            <div class="scanning-message">Point camera at barcode</div>
            <div id="reader"></div>
            <button class="cancel-btn">Cancel</button>
        `;
        
        // Add preview to page
        document.body.appendChild(previewContainer);
        
        // Initialize scanner
        const html5QrcodeScanner = new Html5QrcodeScanner(
            "reader",
            {
                fps: 10,
                qrbox: { width: 250, height: 250 },
                formatsToSupport: [
                    "EAN_13",
                    "EAN_8",
                    "UPC_A",
                    "UPC_E",
                    "CODE_128",
                    "CODE_39",
                    "CODE_93",
                    "ITF"
                ]
            },
            false
        );

        // Start scanning
        html5QrcodeScanner.render(
            (decodedText, decodedResult) => {
                console.log('Barcode detected:', decodedText);
                // Stop scanner
                html5QrcodeScanner.clear();
                // Remove preview
                previewContainer.remove();
                // Look up product
                lookupProduct(decodedText);
            },
            (error) => {
                console.error('Scanning error:', error);
            }
        );
        
        // Handle cancel button
        previewContainer.querySelector('.cancel-btn').onclick = () => {
            html5QrcodeScanner.clear();
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